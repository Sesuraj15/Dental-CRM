const express = require('express');
const crypto = require('crypto');
const { db } = require('./db');
const core = require('./core');
const bot = require('./bot');

const r = express.Router();

async function ingest(data) {
  const l = core.addLead(data);
  if (l && process.env.AUTO_ENGAGE !== 'false') {
    await core.engage(l).catch(console.error);
  }
  return l;
}

const parseCSV = t =>
  t.split(/\r?\n/)
    .map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
    .filter(c => c.length >= 2 && !/^name$/i.test(c[0]) && c[0] && c[1]);

async function importCSV(text, source = 'CSV Import') {
  let n = 0;
  for (const c of parseCSV(text)) {
    const name = c[0];
    const phone = c[1];
    const rowHash = crypto.createHash('sha256').update(`${name.toLowerCase()}|${core.l10(phone)}`).digest('hex');

    // Check if already processed
    const alreadyProcessed = db.prepare('SELECT rowHash FROM imported_sheet_rows WHERE rowHash = ?').get(rowHash);
    if (alreadyProcessed) continue;

    // Record hash before ingest
    db.prepare('INSERT OR IGNORE INTO imported_sheet_rows (rowHash, importedAt) VALUES (?, ?)').run(rowHash, Date.now());

    const created = await ingest({
      name,
      phone,
      source: c[2] || source
    });
    if (created) n++;
  }
  return n;
}

// Meta (Facebook/Instagram) Lead Ads Webhook
r.get('/meta-leads', bot.verify(process.env.WA_VERIFY_TOKEN));

r.post('/meta-leads', async (req, res) => {
  if (!bot.sigOk(req)) return res.sendStatus(401);
  res.sendStatus(200);

  try {
    for (const e of req.body.entry || []) {
      for (const c of e.changes || []) {
        if (c.field !== 'leadgen') continue;

        const val = c.value || {};
        const leadgenId = val.leadgen_id;
        const formId = val.form_id || null;
        const adId = val.ad_id || null;
        const pageId = val.page_id || null;

        const metaPageToken = process.env.META_PAGE_TOKEN;
        if (!metaPageToken) {
          console.error('[Meta Ads] Cannot fetch leadgen details: META_PAGE_TOKEN is unset');
          continue;
        }

        const graphRes = await fetch(`https://graph.facebook.com/v20.0/${leadgenId}?access_token=${metaPageToken}`);
        const j = await graphRes.json();
        const f = Object.fromEntries((j.field_data || []).map(x => [x.name, x.values?.[0]]));

        await ingest({
          name: f.full_name || f.first_name || 'Meta lead',
          phone: f.phone_number || f.phone,
          source: 'Meta Ads',
          cost: +(process.env.COST_META || 180),
          formId,
          adId,
          campaignId: val.campaign_id || null
        });
      }
    }
  } catch (err) {
    console.error('Meta lead processing error', err);
  }
});

// Google Ads lead form extension webhook
r.post('/google-ads', async (req, res) => {
  const b = req.body || {};
  const googleKey = process.env.GOOGLE_ADS_KEY;

  // Fail closed if server has no GOOGLE_ADS_KEY or mismatch
  if (!googleKey || googleKey === 'change-me' || !b.google_key || b.google_key !== googleKey) {
    return res.sendStatus(401);
  }
  res.sendStatus(200);

  try {
    const f = Object.fromEntries((b.user_column_data || []).map(x => [x.column_id, x.string_value]));
    const gclid = b.gclid || null;

    await ingest({
      name: f.FULL_NAME || f.FIRST_NAME || 'Google lead',
      phone: f.PHONE_NUMBER,
      source: 'Google Ads',
      cost: +(process.env.COST_GOOGLE || 240),
      gclid
    });
  } catch (err) {
    console.error('Google Ads lead processing error', err);
  }
});

/**
 * Generic webhook for Zapier, Make, custom landing page forms
 * STRICT AUTH: fails closed if GENERIC_API_KEY is missing, default, or header mismatch.
 */
r.post('/generic', async (req, res) => {
  const configuredKey = process.env.GENERIC_API_KEY;
  const headerKey = req.headers['x-api-key'];

  // Fail closed: unset, empty, or default 'change-me' are rejected
  if (!configuredKey || configuredKey === 'change-me' || !headerKey) {
    return res.status(401).json({ error: 'Unauthorized webhook request' });
  }

  // Safe timing comparison
  const keyBuf = Buffer.from(String(configuredKey));
  const headBuf = Buffer.from(String(headerKey));
  if (keyBuf.length !== headBuf.length || !crypto.timingSafeEqual(keyBuf, headBuf)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  try {
    const l = await ingest({
      ...req.body,
      source: req.body.source || 'Website Form'
    });
    res.json({ ok: 1, created: !!l, lead: l });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Google Drive / Sheets CSV Poller: tracks row hashes to prevent resurrected deleted leads
async function pollSheet() {
  const u = process.env.SHEET_CSV_URL;
  if (!u) return 0;

  try {
    const response = await fetch(u);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const count = await importCSV(text, 'Google Drive Sheet');
    if (count > 0) {
      console.log(`[Sheet Sync] Ingested ${count} new lead(s)`);
    }
    return count;
  } catch (e) {
    console.error('Sheet sync failed:', e.message);
    return 0;
  }
}

module.exports = {
  router: r,
  ingest,
  importCSV,
  pollSheet
};

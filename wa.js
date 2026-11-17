const { db } = require('./db');

const getToken = () => (process.env.WA_TOKEN || '').trim();
const getPhoneId = () => (process.env.WA_PHONE_ID || '').trim();

const on = () => !!(getToken() && getPhoneId());
const to = p => String(p || '').replace(/\D/g, '');

function isOptedOut(phone) {
  const cleanPh = to(phone).slice(-10);
  if (!cleanPh) return false;
  const row = db.prepare('SELECT optOut FROM patients WHERE phone LIKE ? AND deletedAt IS NULL').get(`%${cleanPh}`);
  return !!(row && row.optOut === 1);
}

function isWithin24HourWindow(phone) {
  const cleanPh = to(phone);
  const row = db.prepare('SELECT lastInboundAt FROM bot_sessions WHERE phone = ?').get(cleanPh);
  if (!row || !row.lastInboundAt) return false;
  return (Date.now() - row.lastInboundAt) < 24 * 3600 * 1000;
}

function recordInbound(phone) {
  const cleanPh = to(phone);
  const now = Date.now();
  db.prepare(`
    INSERT INTO bot_sessions (phone, pendingSlots, offeredAt, pendingCancellationApptId, lastInboundAt, updatedAt)
    VALUES (?, '[]', 0, NULL, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET lastInboundAt = ?, updatedAt = ?
  `).run(cleanPh, now, now, now, now);
}

function logChat(ph, sender, message, status = 'sent', metadata = null) {
  const cleanPh = to(ph);
  db.prepare(`
    INSERT INTO chats (phone, sender, message, status, metadata, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    cleanPh,
    sender,
    message,
    status,
    metadata ? (typeof metadata === 'object' ? JSON.stringify(metadata) : String(metadata)) : null,
    Date.now()
  );
}

async function api(body) {
  const token = getToken();
  const phoneId = getPhoneId();

  if (!token || !phoneId) {
    console.log('[WhatsApp dry-run / no credentials configured]', JSON.stringify(body));
    return {
      dryRun: true,
      status: 'dry_run',
      note: 'Set WA_TOKEN and WA_PHONE_ID in .env to send real messages'
    };
  }

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body })
  });

  const resJson = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = resJson?.error?.message || `Meta WhatsApp API error (${res.status})`;
    console.error('WhatsApp Cloud API error:', res.status, resJson);
    const err = new Error(errMsg);
    err.status = res.status;
    err.meta = resJson;
    throw err;
  }

  return { success: true, data: resJson };
}

async function text(ph, t) {
  const cleanPh = to(ph);
  if (isOptedOut(cleanPh)) {
    console.log(`[WhatsApp] Skipped sending to ${cleanPh}: patient has opted out.`);
    return { skipped: true, reason: 'opted_out' };
  }

  try {
    const res = await api({ to: cleanPh, type: 'text', text: { body: t } });
    logChat(cleanPh, 'bot', t, res.dryRun ? 'dry_run' : 'sent');
    return res;
  } catch (err) {
    logChat(cleanPh, 'bot', t, 'failed', { error: err.message });
    throw err;
  }
}

async function buttons(ph, t, b) {
  const cleanPh = to(ph);
  if (isOptedOut(cleanPh)) {
    return { skipped: true, reason: 'opted_out' };
  }

  const buttonText = t + '\n[' + b.map(x => x.title).join(' | ') + ']';

  try {
    const res = await api({
      to: cleanPh,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: t },
        action: { buttons: b.slice(0, 3).map(x => ({ type: 'reply', reply: { id: x.id, title: x.title.slice(0, 20) } })) }
      }
    });
    logChat(cleanPh, 'bot', buttonText, res.dryRun ? 'dry_run' : 'sent');
    return res;
  } catch (err) {
    // If interactive message fails (e.g., unsupported or template required), fallback to text attempt or throw
    console.warn(`Interactive button send failed, attempting text fallback: ${err.message}`);
    try {
      const fallbackText = t + '\n\nReply with: ' + b.map(x => x.title).join(' or ');
      const textRes = await api({ to: cleanPh, type: 'text', text: { body: fallbackText } });
      logChat(cleanPh, 'bot', fallbackText, textRes.dryRun ? 'dry_run' : 'sent');
      return textRes;
    } catch (innerErr) {
      logChat(cleanPh, 'bot', buttonText, 'failed', { error: innerErr.message });
      throw innerErr;
    }
  }
}

async function template(ph, name, params = []) {
  const cleanPh = to(ph);
  if (isOptedOut(cleanPh)) {
    return { skipped: true, reason: 'opted_out' };
  }

  const logDesc = `[Template: ${name}] ${params.join(', ')}`;

  try {
    const res = await api({
      to: cleanPh,
      type: 'template',
      template: {
        name,
        language: { code: process.env.WA_TEMPLATE_LANG || 'en' },
        components: params.length ? [{ type: 'body', parameters: params.map(x => ({ type: 'text', text: String(x) })) }] : []
      }
    });
    logChat(cleanPh, 'bot', logDesc, res.dryRun ? 'dry_run' : 'sent');
    return res;
  } catch (err) {
    logChat(cleanPh, 'bot', logDesc, 'failed', { error: err.message });
    throw err;
  }
}

module.exports = {
  on,
  logChat,
  getToken,
  getPhoneId,
  isOptedOut,
  isWithin24HourWindow,
  recordInbound,
  text,
  buttons,
  template,
  sendTest: async (targetPhone, customText = 'Hello from DentaDesk! 🦷 Testing live WhatsApp connection.') => {
    const cleanPh = to(targetPhone);
    const token = getToken();
    const phoneId = getPhoneId();

    if (!token || !phoneId) {
      return {
        success: false,
        isConfigured: false,
        error: 'WA_TOKEN or WA_PHONE_ID is empty. Set credentials in .env to send real messages.'
      };
    }

    try {
      const result = await api({ to: cleanPh, type: 'text', text: { body: customText } });
      logChat(cleanPh, 'bot', customText, 'sent');
      return {
        success: true,
        isConfigured: true,
        tokenPreview: token.slice(0, 8) + '...' + token.slice(-4),
        phoneId,
        result
      };
    } catch (err) {
      logChat(cleanPh, 'bot', customText, 'failed', { error: err.message });
      return {
        success: false,
        isConfigured: true,
        tokenPreview: token.slice(0, 8) + '...' + token.slice(-4),
        phoneId,
        error: err.message
      };
    }
  }
};

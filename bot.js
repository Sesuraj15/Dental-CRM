const crypto = require('crypto');
const { db, getSetting, getAllPrices } = require('./db');
const core = require('./core');
const wa = require('./wa');
const ai = require('./ai');

/**
 * Retrieves or initializes persistent bot session state from SQLite
 */
function getSession(phone) {
  const cleanPh = core.norm(phone);
  let session = db.prepare('SELECT * FROM bot_sessions WHERE phone = ?').get(cleanPh);
  if (!session) {
    const now = Date.now();
    db.prepare(`
      INSERT INTO bot_sessions (phone, pendingSlots, offeredAt, pendingCancellationApptId, lastInboundAt, updatedAt)
      VALUES (?, '[]', 0, NULL, ?, ?)
    `).run(cleanPh, now, now);
    session = db.prepare('SELECT * FROM bot_sessions WHERE phone = ?').get(cleanPh);
  }
  return {
    ...session,
    pendingSlots: JSON.parse(session.pendingSlots || '[]')
  };
}

function updateSession(phone, updates) {
  const cleanPh = core.norm(phone);
  const existing = getSession(cleanPh);
  const pendingSlotsStr = updates.pendingSlots !== undefined ? JSON.stringify(updates.pendingSlots) : JSON.stringify(existing.pendingSlots);
  const offeredAt = updates.offeredAt !== undefined ? updates.offeredAt : existing.offeredAt;
  const pendingCancel = updates.pendingCancellationApptId !== undefined ? updates.pendingCancellationApptId : existing.pendingCancellationApptId;
  const lastInboundAt = updates.lastInboundAt !== undefined ? updates.lastInboundAt : existing.lastInboundAt;
  const now = Date.now();

  db.prepare(`
    INSERT INTO bot_sessions (phone, pendingSlots, offeredAt, pendingCancellationApptId, lastInboundAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET
      pendingSlots = excluded.pendingSlots,
      offeredAt = excluded.offeredAt,
      pendingCancellationApptId = excluded.pendingCancellationApptId,
      lastInboundAt = excluded.lastInboundAt,
      updatedAt = excluded.updatedAt
  `).run(cleanPh, pendingSlotsStr, offeredAt, pendingCancel, lastInboundAt, now);
}

const offer = async (ph, skip = 0, preamble = '') => {
  const s = core.freeSlots(3, skip);
  const now = Date.now();
  updateSession(ph, { pendingSlots: s, offeredAt: now });

  if (!s.length) {
    return wa.text(ph, 'Sorry, all slots are currently filled for this window. Our clinic coordinator will contact you shortly to arrange a priority appointment.');
  }

  const best = s[0];
  const doctorName = getSetting('doctorName', 'Dr. Raj');
  const bestLabel = `${core.lab(best.date)} at ${best.time}`;

  let body = '';
  if (preamble) body += preamble + '\n\n';
  body += `⚡ **Priority Slot Available:**\n📅 **${bestLabel}** (${doctorName})\n\n`;
  body += `👉 Reply **YES** or **1** to confirm this slot!\n\n`;
  body += `Or pick an alternative time:\n`;
  s.forEach((x, i) => {
    body += `• ${i + 1}️⃣ ${core.lab(x.date)} ${x.time}${i === 0 ? ' (⚡ Priority)' : ''}\n`;
  });
  body += `\n(Reply 1, 2, 3 or say "tomorrow morning", "10am", or "MORE SLOTS")`;

  const buttons = [
    { id: `slot:${best.date}|${best.time}`, title: `Book ${best.time}` }
  ];
  if (s[1]) {
    buttons.push({ id: `slot:${s[1].date}|${s[1].time}`, title: `${core.lab(s[1].date).split(' ')[0]} ${s[1].time}` });
  }
  if (s[2]) {
    buttons.push({ id: `slot:${s[2].date}|${s[2].time}`, title: `${core.lab(s[2].date).split(' ')[0]} ${s[2].time}` });
  }

  return wa.buttons(ph, body, buttons);
};

async function handle(from, text = '', btn = '', name = '') {
  const ph = core.norm(from);
  const cleanL10 = core.l10(ph);
  const t = (text || '').trim().toLowerCase();
  const btnId = (btn || '').trim();

  // Record inbound timestamp for 24-hour customer service window
  wa.recordInbound(ph);
  const session = getSession(ph);

  // 1. Compliance: STOP / UNSUBSCRIBE / START opt-out handling
  if (/^(stop|unsubscribe|opt\s*out|quit)$/i.test(t)) {
    const now = Date.now();
    db.prepare('UPDATE patients SET optOut = 1, optedOutAt = ? WHERE phone LIKE ?').run(now, `%${cleanL10}`);
    db.prepare('UPDATE leads SET status = ' + "'Lost'" + ', updatedAt = ? WHERE phone LIKE ?').run(now, `%${cleanL10}`);
    return wa.text(ph, 'You have been unsubscribed from DentaDesk automated notifications. Reply START anytime to re-enable communication. 🦷');
  }

  if (/^start$/i.test(t)) {
    db.prepare('UPDATE patients SET optOut = 0, optedOutAt = NULL WHERE phone LIKE ?').run(`%${cleanL10}`);
    return wa.text(ph, 'Welcome back! You have re-enabled messaging. Reply BOOK to schedule an appointment with our clinic. 🦷');
  }

  // Look up contact or patient
  let patient = core.patientByPhone(ph);
  let lead = core.leadByPhone(ph);

  // 2. Cancellation Confirmation Flow
  if (session.pendingCancellationApptId) {
    if (/^(yes|yes\s*cancel|confirm|confirm\s*cancel|cancel\s*it)$/i.test(t)) {
      const apptId = session.pendingCancellationApptId;
      updateSession(ph, { pendingCancellationApptId: null });
      const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(apptId);
      if (a && a.status === 'Booked') {
        db.prepare(`UPDATE appointments SET status = 'Cancelled', updatedAt = ? WHERE id = ?`).run(Date.now(), apptId);
        core.notify(`${patient ? patient.name : 'Patient'} cancelled appointment on ${core.lab(a.date)} ${a.time}`);
        return wa.text(ph, `✅ Your appointment on ${core.lab(a.date)} at ${a.time} has been cancelled. Reply BOOK anytime to pick a new slot.`);
      }
      return wa.text(ph, 'Your appointment was already cancelled. Reply BOOK if you would like to reschedule.');
    } else if (/^(no|keep|keep\s*it|don'?t\s*cancel)$/i.test(t)) {
      const apptId = session.pendingCancellationApptId;
      updateSession(ph, { pendingCancellationApptId: null });
      const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(apptId);
      return wa.text(ph, `Got it! Your appointment on ${a ? core.lab(a.date) + ' at ' + a.time : 'the scheduled date'} remains confirmed. See you then! 🦷`);
    }
  }

  // Cancel intent initiation: ASK FOR CONFIRMATION
  if (/\bcancel\b/i.test(t) && !/^(yes\s*cancel|confirm\s*cancel)$/i.test(t)) {
    if (patient) {
      const todayStr = core.K(new Date());
      const upcoming = db.prepare(`
        SELECT * FROM appointments
        WHERE patientId = ? AND status = 'Booked' AND date >= ? AND deletedAt IS NULL
        ORDER BY date ASC, time ASC LIMIT 1
      `).get(patient.id, todayStr);

      if (upcoming) {
        updateSession(ph, { pendingCancellationApptId: upcoming.id });
        return wa.text(ph, `⚠️ Are you sure you want to cancel your appointment on **${core.lab(upcoming.date)} at ${upcoming.time}**?\n\nReply **YES CANCEL** to confirm, or **NO** to keep your appointment.`);
      }
    }
    return wa.text(ph, 'You do not have any upcoming booked appointments. Would you like to schedule one? Reply BOOK to view available slots! 🦷');
  }

  // Reschedule intent
  if (/resched/i.test(t)) {
    if (patient) {
      core.cancelUpcoming(patient.id);
      await wa.text(ph, "Sure! Let's pick a fresh time for your appointment:");
    } else {
      await wa.text(ph, "Sure! Let's find a convenient appointment slot for you:");
    }
    return offer(ph, 0);
  }

  // Anchored more slots intent: do NOT match 'next Monday' or 'next week'!
  if (/\b(more|next\s*(slots?|page|options?)|more\s*slots?)\b|^next$/i.test(t) && !/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|week)\b/i.test(t)) {
    return offer(ph, 3);
  }

  // Cost or price inquiry: DYNAMIC PRICES
  if (/\b(price|cost|how\s*much|rate|fees|charges)\b/i.test(t)) {
    const prices = getAllPrices();
    const clinicName = getSetting('clinicName', 'DentaDesk Dental Care');
    let priceMsg = `🦷 **${clinicName} Fee Schedule:**\n`;
    for (const [svc, pr] of Object.entries(prices)) {
      priceMsg += `• ${svc}: ₹${pr}\n`;
    }
    priceMsg += `\nReply **BOOK** to choose your appointment slot!`;
    await wa.text(ph, priceMsg);
    return offer(ph, 0);
  }

  // 3. Clinical Concern Collection
  const isMenuChoice = /^[1-5]$|^option\s*[1-5]$/i.test(t);
  const hasDentalIssueWords = /\b(pain|toothache|ache|swelling|swollen|bleed\w*|cavity|broken|chipped|sensitiv\w*|teeth|tooth|braces|aligner|whitening|gum|scaling|cleaning|checkup|filling|implant|crown)\b/i.test(t);

  const isLeadInquiryPhase = lead && (lead.aiStage === 'INQUIRY_SENT' || !lead.aiStage || lead.aiStage === 'NEW') && lead.status !== 'Won' && lead.status !== 'Booked';

  if ((isLeadInquiryPhase && (isMenuChoice || hasDentalIssueWords)) || (hasDentalIssueWords && !btnId && !session.pendingCancellationApptId)) {
    const assessment = ai.analyzeLeadConcern(text, (patient ? patient.name : (lead ? lead.name : name)));

    if (lead) {
      db.prepare(`
        UPDATE leads SET clinicalIssue = ?, aiStage = 'SLOTS_OFFERED', status = 'Engaged', urgency = ?, lastFollowupAt = ?, updatedAt = ?
        WHERE id = ?
      `).run(assessment.issueSummary, assessment.urgency || 'Routine', Date.now(), Date.now(), lead.id);
    }
    if (patient) {
      const newNotes = (patient.notes ? patient.notes + ' | ' : '') + 'Concern: ' + assessment.issueSummary;
      db.prepare('UPDATE patients SET notes = ?, updatedAt = ? WHERE id = ?').run(newNotes, Date.now(), patient.id);
    }
    core.notify(`Patient concern recorded for ${patient ? patient.name : (lead ? lead.name : ph)}: ${assessment.issueSummary}`);

    // Present clinician-approved advice and offered slots
    await wa.text(ph, assessment.reply);
    return offer(ph, 0);
  }

  // 4. Slot Selection: Match against slots offered in the last 15 minutes
  const matchedSlot = core.findMatchingSlot(btnId || t, session.pendingSlots, session.offeredAt);
  if (matchedSlot) {
    let bookingEntityId;
    let isLeadBooking = false;

    if (patient) {
      bookingEntityId = patient.id;
    } else {
      if (!lead) {
        lead = core.addLead({ name: name || 'WhatsApp User', phone: ph, source: 'WhatsApp Inbound' });
      }
      bookingEntityId = lead.id;
      isLeadBooking = true;
    }

    const appt = core.book(bookingEntityId, { date: matchedSlot.date, time: matchedSlot.time }, 'WhatsApp Bot', isLeadBooking);
    if (appt) {
      updateSession(ph, { pendingSlots: [], offeredAt: 0 });
      const clinicName = getSetting('clinicName', 'DentaDesk Dental Care');
      return wa.text(
        ph,
        `✅ **Booked!** Your dental visit is scheduled for **${core.lab(matchedSlot.date)} at ${matchedSlot.time}** with ${clinicName}.\nWe have notified our clinical desk. We will send you a reminder 24 hours prior. Reply CANCEL or RESCHEDULE anytime if your plans change. 🦷`
      );
    }
    await wa.text(ph, 'Sorry, that slot was just taken! Let us find you another available time.');
    return offer(ph, 0);
  }

  // 5. Booking or Greetings Intent
  if (/book|appoint|check|\bhi\b|\bhello\b|\bhey\b/i.test(t)) {
    if (isLeadInquiryPhase) {
      const firstName = ((lead ? lead.name : name) || 'there').split(' ')[0];
      const clinicName = getSetting('clinicName', 'DentaDesk Dental Care');
      await wa.text(
        ph,
        `Hi ${firstName}! Welcome to ${clinicName}. 🦷\n\nI am the clinic's AI Dental Care Assistant. To help our specialists prepare best for you, what dental concern or question can we help you with today?\n\n• 1️⃣ Tooth discomfort, cavity, or sensitivity\n• 2️⃣ Routine cleaning & general checkup\n• 3️⃣ Missing tooth / Implant / Crown\n• 4️⃣ Bleeding gums or bad breath\n• 5️⃣ Teeth alignment (Aligners/Braces) or Whitening\n\n(Reply with a number or simply describe your concern!)`
      );
      if (lead) {
        db.prepare(`UPDATE leads SET aiStage = 'INQUIRY_SENT', status = 'Contacted', updatedAt = ? WHERE id = ?`).run(Date.now(), lead.id);
      }
      return;
    }
    return offer(ph, 0);
  }

  // 6. Fallback
  await wa.text(ph, 'Thanks for reaching out! Reply BOOK to choose an appointment slot, or tell us your dental concern to connect with our care team. 🦷');
  core.notify(`Patient attention needed: ${(patient ? patient.name : (lead ? lead.name : ph))} wrote "${(text || '').slice(0, 100)}"`);
}

/**
 * Validates Meta Webhook signature.
 * STRICT: Fails closed! Rejects request if APP_SECRET is unset or signature does not match.
 */
function sigOk(req) {
  const s = process.env.APP_SECRET;
  if (!s || s.trim() === '') {
    console.error('[Security] Webhook rejected: APP_SECRET is unset. Refusing to fail open.');
    return false;
  }
  const h = (req.headers['x-hub-signature-256'] || '').replace('sha256=', '');
  if (!h) return false;
  try {
    const e = crypto.createHmac('sha256', s).update(req.rawBody || '').digest('hex');
    return h.length === e.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(e));
  } catch (err) {
    console.error('[Security] Webhook HMAC error:', err.message);
    return false;
  }
}

const verify = (tok) => (req, res) => {
  if (!tok || tok === 'change-me') {
    console.error('[Security] WA_VERIFY_TOKEN is missing or default "change-me"');
    return res.sendStatus(403);
  }
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === tok) {
    return res.send(req.query['hub.challenge']);
  }
  return res.sendStatus(403);
};

async function webhook(req, res) {
  if (!sigOk(req)) return res.sendStatus(401);
  res.sendStatus(200);
  try {
    for (const e of req.body.entry || []) {
      for (const c of e.changes || []) {
        const v = c.value || {};
        const nm = v.contacts?.[0]?.profile?.name;
        for (const m of v.messages || []) {
          const text = m.text?.body || m.button?.text || m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '';
          const btn = m.interactive?.button_reply?.id || m.interactive?.list_reply?.id || m.button?.payload || '';
          wa.logChat(core.norm(m.from), 'pt', text || btn);
          await handle(m.from, text, btn, nm);
        }
      }
    }
  } catch (err) {
    console.error('Webhook processing error', err);
  }
}

async function simulateInbound(phone, text = '', btn = '', name = '') {
  const ph = core.norm(phone);
  wa.logChat(ph, 'pt', text || btn);
  await handle(ph, text, btn, name);
  return { ok: true };
}

module.exports = {
  handle,
  webhook,
  verify,
  sigOk,
  simulateInbound,
  getSession,
  updateSession,
  offer
};

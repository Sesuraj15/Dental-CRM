const { db, getSetting, getAllSettings, getAllPrices, audit } = require('./db');
const wa = require('./wa');
const conversions = require('./conversions');

const pad = n => String(n).padStart(2, '0');
const K = x => x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());

const lab = s => {
  if (!s) return '–';
  try {
    const parts = String(s).split('-');
    if (parts.length === 3) {
      const dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      if (!isNaN(dt.getTime())) return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return s;
  }
};

const norm = p => {
  let x = String(p || '').replace(/\D/g, '');
  if (x.length === 10) x = (process.env.DEFAULT_CC || '91') + x;
  return x;
};

const l10 = p => String(p || '').replace(/\D/g, '').slice(-10);

const getWorkingHours = () => {
  try {
    const raw = getSetting('workingHours');
    if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {}
  return { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5, 6] };
};

const getSlotsList = () => {
  const envSlots = process.env.SLOTS;
  if (envSlots) return envSlots.split(',').map(s => s.trim());
  return ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
};

const SLOTS = getSlotsList();

const taken = (date, time, doctorId = null) => {
  let query = 'SELECT count(*) as count FROM appointments WHERE date = ? AND time = ? AND status = ? AND deletedAt IS NULL';
  const params = [date, time, 'Booked'];
  if (doctorId) {
    query += ' AND doctorId = ?';
    params.push(doctorId);
  }
  const row = db.prepare(query).get(...params);
  return row.count > 0;
};

function freeSlots(n = 10, skip = 0, forDate = null, doctorId = null) {
  const o = [];
  const now = new Date();
  const todayStr = K(now);
  const curTimeStr = pad(now.getHours()) + ':' + pad(now.getMinutes());
  const hours = getWorkingHours();
  const allowedDays = hours.days || [1, 2, 3, 4, 5, 6];
  const allSlots = getSlotsList();

  if (forDate) {
    for (const t of allSlots) {
      if (forDate === todayStr && t <= curTimeStr) continue;
      if (!taken(forDate, t, doctorId)) o.push({ date: forDate, time: t });
    }
    return o.slice(skip, skip + n);
  }

  for (let i = 0; i < 30 && o.length < (n + skip); i++) {
    const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (!allowedDays.includes(x.getDay())) continue;
    const dateStr = K(x);
    for (const t of allSlots) {
      if (i === 0 && t <= curTimeStr) continue;
      if (!taken(dateStr, t, doctorId)) o.push({ date: dateStr, time: t });
    }
  }
  return o.slice(skip, skip + n);
}

const OFFER_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes validity for offered slots

/**
 * Slot matching logic:
 * ONLY auto-books priority slot on casual affirmative words ("yes", "ok", "fine", "sure", "yeah")
 * if valid slots were explicitly offered to the user within the last 15 minutes!
 */
function findMatchingSlot(query = '', candidateSlots = [], offeredAt = null) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;

  const isRecentOffer = offeredAt && (Date.now() - offeredAt <= OFFER_EXPIRY_MS);
  const pool = (candidateSlots && candidateSlots.length) ? candidateSlots : [];

  // 1. Direct button token "slot:YYYY-MM-DD|HH:MM"
  const tokenMatch = q.match(/slot:([0-9]{4}-[0-9]{2}-[0-9]{2})\|([0-9]{2}:[0-9]{2})/);
  if (tokenMatch) {
    const dStr = tokenMatch[1], tStr = tokenMatch[2];
    const found = pool.find(s => s.date === dStr && s.time === tStr);
    if (found) return found;
    if (!taken(dStr, tStr)) return { date: dStr, time: tStr };
  }

  // 2. Choice by position: 1, 2, 3 (valid if slots were offered)
  if (pool.length > 0) {
    if (/^(1|slot\s*1|option\s*1|opt\s*1|first|first\s*one)$/i.test(q) && pool[0]) return pool[0];
    if (/^(2|slot\s*2|option\s*2|opt\s*2|second|second\s*one)$/i.test(q) && pool[1]) return pool[1];
    if (/^(3|slot\s*3|option\s*3|opt\s*3|third|third\s*one)$/i.test(q) && pool[2]) return pool[2];
  }

  // 3. Casual affirmative keywords (Yes, Confirm, OK, Sure, Fine, Yep, Yeah)
  // STRICT RULE: Only match if slots were actually offered in the last 15 minutes!
  if (/\b(yes|confirm|confirmed|ok|okay|sure|book\s*it|book\s*now|earliest|asap|urgent|auto|auto\s*book|auto\s*select|any\s*time|any\s*slot|go\s*ahead|fine|yep|yeah)\b/i.test(q)) {
    if (isRecentOffer && pool.length > 0) {
      return pool[0]; // Auto-selects the offered priority slot
    }
    // If no recent offer, do NOT auto-book! Return null so caller prompts with available slots
    return null;
  }

  // 4. Exact time specification
  let targetHour = null;
  const timeRegex = /\b(0?[9]|1[0-7]):00\b|\b(0?[9]|1[0-2])\s*(am|pm)\b|\b(1[3-7])\s*(pm)?\b/i;
  const tm = q.match(timeRegex);
  if (tm) {
    if (tm[1]) {
      targetHour = pad(parseInt(tm[1], 10)) + ':00';
    } else if (tm[2]) {
      let hr = parseInt(tm[2], 10);
      const ampm = (tm[3] || '').toLowerCase();
      if (ampm === 'pm' && hr < 12) hr += 12;
      if (ampm === 'am' && hr === 12) hr = 0;
      targetHour = pad(hr) + ':00';
    } else if (tm[4]) {
      targetHour = pad(parseInt(tm[4], 10)) + ':00';
    }
  }

  // 5. Day preference (e.g. tomorrow, monday, next wednesday)
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  let targetDate = null;

  if (/\btomorrow\b/i.test(q)) {
    const tom = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    targetDate = K(tom);
  } else if (/\btoday\b/i.test(q)) {
    targetDate = K(now);
  } else {
    for (let d = 0; d <= 6; d++) {
      if (new RegExp(`\\b${dayNames[d]}\\b`, 'i').test(q)) {
        let daysUntil = (d - now.getDay() + 7) % 7;
        if (daysUntil === 0) daysUntil = 7;
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil);
        targetDate = K(target);
        break;
      }
    }
  }

  // 6. Period preference
  const isMorning = /\bmorning\b/i.test(q);
  const isAfternoon = /\b(afternoon|noon|lunch)\b/i.test(q);
  const isEvening = /\bevening\b/i.test(q);

  const hasTimeOrDateCriteria = !!(targetHour || targetDate || isMorning || isAfternoon || isEvening);
  if (!hasTimeOrDateCriteria) return null;

  // Search in pool first
  const poolMatches = pool.filter(s => {
    if (targetDate && s.date !== targetDate) return false;
    if (targetHour && s.time !== targetHour) return false;
    const hr = parseInt(s.time.split(':')[0], 10);
    if (isMorning && (hr < 9 || hr >= 12)) return false;
    if (isAfternoon && (hr < 12 || hr >= 16)) return false;
    if (isEvening && (hr < 16 || hr > 18)) return false;
    return true;
  });
  if (poolMatches.length > 0) return poolMatches[0];

  // If specific time or date was requested but not in offered pool, check day slots
  if (targetDate) {
    const dayFree = freeSlots(20, 0, targetDate);
    const dayMatch = dayFree.find(s => {
      if (targetHour && s.time !== targetHour) return false;
      const hr = parseInt(s.time.split(':')[0], 10);
      if (isMorning && (hr < 9 || hr >= 12)) return false;
      if (isAfternoon && (hr < 12 || hr >= 16)) return false;
      if (isEvening && (hr < 16 || hr > 18)) return false;
      return true;
    });
    if (dayMatch) return dayMatch;
  }

  const allFree = freeSlots(60);
  const globalMatch = allFree.find(s => {
    if (targetDate && s.date !== targetDate) return false;
    if (targetHour && s.time !== targetHour) return false;
    const hr = parseInt(s.time.split(':')[0], 10);
    if (isMorning && (hr < 9 || hr >= 12)) return false;
    if (isAfternoon && (hr < 12 || hr >= 16)) return false;
    if (isEvening && (hr < 16 || hr > 18)) return false;
    return true;
  });
  if (globalMatch) return globalMatch;

  return null;
}

function notify(msg) {
  db.prepare('INSERT INTO notifications (msg, at) VALUES (?, ?)').run(msg, Date.now());
  const notifyList = (getSetting('notifyNumbers') || process.env.NOTIFY_NUMBERS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  for (const n of notifyList) {
    const t = process.env.WA_NOTIFY_TEMPLATE;
    if (t) {
      wa.template(norm(n), t, [msg.slice(0, 500)]).catch(console.error);
    } else {
      wa.text(norm(n), '🔔 ' + msg).catch(console.error);
    }
  }
}

function patientByPhone(ph) {
  const cleanPh = l10(ph);
  if (!cleanPh) return null;
  const row = db.prepare('SELECT * FROM patients WHERE phone LIKE ? AND deletedAt IS NULL').get(`%${cleanPh}`);
  return row || null;
}

function leadByPhone(ph) {
  const cleanPh = l10(ph);
  if (!cleanPh) return null;
  const row = db.prepare('SELECT * FROM leads WHERE phone LIKE ? AND deletedAt IS NULL').get(`%${cleanPh}`);
  return row || null;
}

/**
 * Contact resolution:
 * Retrieves patient if already registered; otherwise looks up or registers lead.
 * Does NOT prematurely create patient records for unbooked leads!
 */
function resolveContact(phone, name, source = 'Inbound') {
  const p = patientByPhone(phone);
  if (p) return { type: 'patient', record: p };

  let l = leadByPhone(phone);
  if (!l) {
    const now = Date.now();
    const info = db.prepare(`
      INSERT INTO leads (name, phone, source, cost, status, aiStage, clinicalIssue, urgency, followupCount, createdAt, updatedAt)
      VALUES (?, ?, ?, 0, 'New', 'NEW', '', 'Routine', 0, ?, ?)
    `).run(name || 'New Lead', norm(phone), source, now, now);
    l = db.prepare('SELECT * FROM leads WHERE id = ?').get(info.lastInsertRowid);
    notify(`New lead: ${l.name} from ${l.source}`);
  }
  return { type: 'lead', record: l };
}

function addLead({ name, phone, source = 'Manual', cost = 0, notes = '', campaignId = null, adId = null, formId = null, gclid = null }) {
  const ph = l10(phone);
  if (ph.length < 10 || !name) return null;
  if (leadByPhone(ph) || patientByPhone(ph)) return null;

  const now = Date.now();
  const res = db.prepare(`
    INSERT INTO leads (name, phone, source, campaignId, adId, formId, gclid, cost, notes, status, aiStage, clinicalIssue, urgency, followupCount, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'NEW', '', 'Routine', 0, ?, ?)
  `).run(
    String(name).trim().slice(0, 80),
    norm(phone),
    source,
    campaignId,
    adId,
    formId,
    gclid,
    +cost || 0,
    notes || '',
    now,
    now
  );

  const newLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(res.lastInsertRowid);
  notify(`New lead: ${newLead.name} from ${newLead.source}`);
  conversions.trackLeadEvent('Lead', { phone: newLead.phone, name: newLead.name, leadId: newLead.id, gclid: newLead.gclid }).catch(console.error);
  return newLead;
}

/**
 * Initial Engagement for new leads:
 * First contact to uninitiated leads outside 24h window MUST use an approved template!
 */
async function engage(lead) {
  const firstName = (lead.name || 'there').split(' ')[0];
  const clinicName = getSetting('clinicName', 'DentaDesk Dental Care');
  const now = Date.now();

  db.prepare(`
    UPDATE leads SET status = 'Contacted', aiStage = 'INQUIRY_SENT', followupCount = followupCount + 1, lastFollowupAt = ?, updatedAt = ?
    WHERE id = ?
  `).run(now, now, lead.id);

  // Check if within 24h window
  const isLive = wa.on();
  const within24h = wa.isWithin24HourWindow(lead.phone);

  if (isLive && !within24h && process.env.WA_LEAD_TEMPLATE) {
    // Send pre-approved WhatsApp Business template outside 24h
    try {
      await wa.template(lead.phone, process.env.WA_LEAD_TEMPLATE, [firstName, clinicName]);
      notify(`Dispatched WhatsApp template outreach to ${lead.name} (${lead.phone})`);
      return { ok: true, lead, templateUsed: true };
    } catch (err) {
      console.warn(`Template send failed for ${lead.phone}, falling back: ${err.message}`);
    }
  }

  // Free-text or dry-run inquiry
  const inquiryMsg =
    `Hi ${firstName}! Welcome to ${clinicName}. 🦷\n\n` +
    `I am the clinic's AI Dental Care Assistant. To help our dental specialists prepare best for you, could you please tell me: What dental concern or question can we assist you with today?\n\n` +
    `• 1️⃣ Tooth discomfort, cavity, or sensitivity\n` +
    `• 2️⃣ Routine cleaning & general checkup\n` +
    `• 3️⃣ Missing tooth / Implant / Crown\n` +
    `• 4️⃣ Bleeding gums or bad breath\n` +
    `• 5️⃣ Teeth alignment (Aligners/Braces) or Whitening\n\n` +
    `(Reply with a number or simply describe your concern in your own words!)`;

  await wa.text(lead.phone, inquiryMsg).catch(console.error);
  notify(`Initiated care inquiry for ${lead.name} (${lead.phone})`);
  return { ok: true, lead };
}

/**
 * Recall notification: sends ONLY ONE message (template if available/live; otherwise text).
 * Prevents double message bug!
 */
async function recall(p, customMessage) {
  const firstName = (p.name || 'there').split(' ')[0];
  const clinicName = getSetting('clinicName', 'DentaDesk Dental Care');
  const defaultMsg = `Hi ${firstName}, it's time for your routine dental checkup & cleaning at ${clinicName}! Preventive care keeps your smile bright. Reply BOOK to schedule your visit. 🦷`;
  const msg = customMessage || defaultMsg;

  const isLive = wa.on();
  const within24h = wa.isWithin24HourWindow(p.phone);
  const templateName = process.env.WA_RECALL_TEMPLATE || 'recall_checkup';

  if (isLive && !within24h && templateName) {
    // Send template only
    await wa.template(p.phone, templateName, [firstName, clinicName]).catch(console.error);
  } else {
    // Send text only
    await wa.text(p.phone, msg).catch(console.error);
  }

  const now = Date.now();
  db.prepare(`
    UPDATE patients SET recalledAt = ?, recallCount = recallCount + 1, updatedAt = ?
    WHERE id = ?
  `).run(now, now, p.id);

  notify(`Recall sent to ${p.name} (${p.phone})`);
  return { ok: true, message: msg };
}

function dueForRecall(thresholdDays) {
  const limitDays = +(thresholdDays || getSetting('recallDays', 180));
  const now = Date.now();
  const todayStr = K(new Date());

  const patients = db.prepare(`
    SELECT * FROM patients
    WHERE lastVisit IS NOT NULL AND optOut = 0 AND deletedAt IS NULL
  `).all();

  return patients.filter(p => {
    const visitDate = new Date(p.lastVisit.includes('T') ? p.lastVisit : p.lastVisit + 'T00:00');
    if (isNaN(visitDate.getTime())) return false;
    const patientLimit = +(p.recallDays || limitDays) * 864e5;
    if (now - visitDate.getTime() < patientLimit) return false;
    if (p.recalledAt && (now - p.recalledAt < 21 * 864e5)) return false; // Cooldown 21 days

    const hasUpcoming = db.prepare(`
      SELECT count(*) as count FROM appointments
      WHERE patientId = ? AND status = 'Booked' AND date >= ? AND deletedAt IS NULL
    `).get(p.id, todayStr).count > 0;

    return !hasUpcoming;
  });
}

/**
 * Creates patient record when an appointment is booked or lead is converted.
 */
function ensurePatient(phone, name, source = 'Manual') {
  let p = patientByPhone(phone);
  if (p) return p;

  const now = Date.now();
  const res = db.prepare(`
    INSERT INTO patients (name, phone, gender, lastVisit, lastService, notes, recallDays, consentGivenAt, consentSource, optOut, createdAt, updatedAt)
    VALUES (?, ?, 'Other', NULL, 'Consultation', '', 180, ?, ?, 0, ?, ?)
  `).run(name || 'Patient', norm(phone), now, source, now, now);

  return db.prepare('SELECT * FROM patients WHERE id = ?').get(res.lastInsertRowid);
}

/**
 * Book an appointment
 */
function book(patientOrLeadId, slot, source = 'Manual', isLead = false) {
  if (taken(slot.date, slot.time)) return null;

  let patient = null;
  let lead = null;

  if (isLead) {
    lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(patientOrLeadId);
    if (!lead) return null;
    patient = ensurePatient(lead.phone, lead.name, lead.source);
    db.prepare('UPDATE leads SET patientId = ?, status = ' + "'Won'" + ', aiStage = ' + "'BOOKED'" + ', updatedAt = ? WHERE id = ?').run(patient.id, Date.now(), lead.id);
  } else {
    patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientOrLeadId);
    if (!patient) return null;
    lead = db.prepare('SELECT * FROM leads WHERE patientId = ? OR phone LIKE ?').get(patient.id, `%${l10(patient.phone)}`);
  }

  const suggestedService = slot.service ||
    (lead?.clinicalIssue?.includes('Root canal') ? 'Root canal' :
      (lead?.clinicalIssue?.includes('Cleaning') ? 'Cleaning' :
        (lead?.clinicalIssue?.includes('Whitening') ? 'Whitening' :
          (lead?.clinicalIssue?.includes('Aligner') ? 'Ortho review' : 'Checkup'))));

  const now = Date.now();
  const apptRes = db.prepare(`
    INSERT INTO appointments (patientId, doctorId, chair, date, time, duration, service, notes, status, source, reminded, stockDeducted, createdAt, updatedAt)
    VALUES (?, 'Dr. Raj', 'Chair 1', ?, ?, 60, ?, ?, 'Booked', ?, 0, 0, ?, ?)
  `).run(
    patient.id,
    slot.date,
    slot.time,
    suggestedService,
    slot.notes || (lead?.clinicalIssue ? 'Issue: ' + lead.clinicalIssue : ''),
    source,
    now,
    now
  );

  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(apptRes.lastInsertRowid);

  if (lead) {
    db.prepare(`UPDATE leads SET status = 'Won', aiStage = 'BOOKED', patientId = ?, updatedAt = ? WHERE id = ?`).run(patient.id, now, lead.id);
  }

  notify(`${patient.name} booked ${appt.service} on ${lab(appt.date)} at ${appt.time} via ${source}`);
  conversions.trackLeadEvent('Schedule', { phone: patient.phone, name: patient.name, leadId: lead?.id, gclid: lead?.gclid }).catch(console.error);
  return appt;
}

function reschedule(apptId, newDate, newTime) {
  const a = db.prepare('SELECT * FROM appointments WHERE id = ? AND deletedAt IS NULL').get(apptId);
  if (!a) return null;
  if (taken(newDate, newTime)) return null;

  const oldDate = a.date, oldTime = a.time;
  const now = Date.now();
  db.prepare(`
    UPDATE appointments SET date = ?, time = ?, status = 'Booked', reminded = 0, updatedAt = ?
    WHERE id = ?
  `).run(newDate, newTime, now, apptId);

  const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(apptId);
  const p = db.prepare('SELECT * FROM patients WHERE id = ?').get(a.patientId);
  const pName = p ? p.name : 'Patient';

  notify(`${pName} rescheduled to ${lab(newDate)} ${newTime} (was ${lab(oldDate)} ${oldTime})`);

  if (p && p.phone) {
    wa.text(p.phone, `Hi ${pName.split(' ')[0]}, your appointment is updated to ${lab(newDate)} at ${newTime}. Reply CANCEL or RESCHEDULE if you need further adjustments. 🦷`).catch(console.error);
  }
  return updated;
}

/**
 * Cancels upcoming booked appointment
 */
function cancelUpcoming(patientId) {
  const todayStr = K(new Date());
  const a = db.prepare(`
    SELECT * FROM appointments
    WHERE patientId = ? AND status = 'Booked' AND date >= ? AND deletedAt IS NULL
    ORDER BY date ASC, time ASC LIMIT 1
  `).get(patientId, todayStr);

  if (!a) return null;

  const now = Date.now();
  db.prepare(`UPDATE appointments SET status = 'Cancelled', updatedAt = ? WHERE id = ?`).run(now, a.id);
  const p = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);

  notify(`${p ? p.name : 'Patient'} cancelled appointment on ${lab(a.date)} ${a.time} (slot freed)`);
  return a;
}

/**
 * Appointment Completion: handles invoice raising and per-service inventory deduction safely.
 * Prevents duplicate invoice and stock deductions!
 */
function completeAppointment(apptId) {
  const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(apptId);
  if (!a) return null;

  const now = Date.now();
  const p = db.prepare('SELECT * FROM patients WHERE id = ?').get(a.patientId);

  // 1. Update patient's last visit & service
  if (p) {
    db.prepare('UPDATE patients SET lastVisit = ?, lastService = ?, updatedAt = ? WHERE id = ?')
      .run(K(new Date()), a.service, now, p.id);
  }

  // 2. Create invoice IF NOT ALREADY CREATED
  let invoiceId = a.invoiceId;
  const existingInv = invoiceId ? db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) : null;

  if (!existingInv) {
    const prices = getAllPrices();
    const fee = prices[a.service] || 500;
    const invCount = db.prepare('SELECT count(*) as count FROM invoices').get().count + 1;
    const invNum = `INV-${new Date().getFullYear()}-${String(invCount).padStart(4, '0')}`;

    const invRes = db.prepare(`
      INSERT INTO invoices (invoiceNumber, appointmentId, patientId, service, amount, discount, taxRate, taxAmount, totalAmount, paid, method, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, 0, 'Pending', ?, ?)
    `).run(invNum, a.id, a.patientId, a.service, fee, fee, now, now);

    invoiceId = invRes.lastInsertRowid;
    notify(`Completed: ${p ? p.name : 'Patient'} (${a.service}). Invoice #${invNum} raised for ₹${fee}.`);
  }

  // 3. Deduct inventory IF NOT ALREADY DEDUCTED, strictly according to service bill-of-materials
  if (!a.stockDeducted) {
    const supplies = db.prepare('SELECT inventoryId, qtyPerService FROM service_supplies WHERE service = ?').all(a.service);
    for (const sup of supplies) {
      db.prepare(`
        UPDATE inventory SET qty = MAX(0, ROUND(qty - ?, 2)), updatedAt = ?
        WHERE id = ?
      `).run(sup.qtyPerService, now, sup.inventoryId);
    }
  }

  // 4. Update appointment status & flags
  db.prepare(`
    UPDATE appointments SET status = 'Completed', stockDeducted = 1, invoiceId = ?, updatedAt = ?
    WHERE id = ?
  `).run(invoiceId, now, a.id);

  // 5. Update lead status to Won if linked
  db.prepare(`UPDATE leads SET status = 'Won', updatedAt = ? WHERE patientId = ?`).run(now, a.patientId);

  conversions.trackLeadEvent('Purchase', { phone: p?.phone, name: p?.name, leadId: a.patientId, value: existingInv?.amount || 500 }).catch(console.error);

  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(a.id);
}

module.exports = {
  K,
  lab,
  norm,
  l10,
  SLOTS,
  freeSlots,
  findMatchingSlot,
  notify,
  resolveContact,
  patientByPhone,
  leadByPhone,
  ensurePatient,
  addLead,
  engage,
  recall,
  dueForRecall,
  book,
  reschedule,
  cancelUpcoming,
  completeAppointment
};

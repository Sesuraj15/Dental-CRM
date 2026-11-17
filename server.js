require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

const { db, getSetting, setSetting, getAllSettings, getAllPrices, setPrice, audit } = require('./db');
const core = require('./core');
const wa = require('./wa');
const bot = require('./bot');
const leads = require('./leads');
const sched = require('./scheduler');
const ai = require('./ai');

// ==================== SECURITY & STARTUP VALIDATION ====================
function validateSecrets() {
  const isProd = process.env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  const genericKey = process.env.GENERIC_API_KEY;
  if (!genericKey) errors.push('GENERIC_API_KEY is unset');
  else if (genericKey === 'change-me') errors.push('GENERIC_API_KEY is set to default "change-me"');

  const waVerify = process.env.WA_VERIFY_TOKEN;
  if (!waVerify) errors.push('WA_VERIFY_TOKEN is unset');
  else if (waVerify === 'change-me') errors.push('WA_VERIFY_TOKEN is set to default "change-me"');

  const appSecret = process.env.APP_SECRET;
  if (!appSecret) {
    if (isProd) errors.push('APP_SECRET is required in production for webhook verification');
    else warnings.push('APP_SECRET is unset; WhatsApp and Meta webhooks will fail closed until set');
  }

  if (errors.length > 0) {
    console.error('=================================================================');
    console.error('CRITICAL SECURITY CONFIGURATION ERROR:');
    errors.forEach(e => console.error('  ❌ ' + e));
    console.error('=================================================================');
    if (isProd) {
      throw new Error('Refusing to boot in production with missing or default secrets.');
    }
  }

  if (warnings.length > 0) {
    warnings.forEach(w => console.warn('  ⚠️ ' + w));
  }
}

validateSecrets();

// Secret for JWT (from ENV or persisted securely in database settings)
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  const existingSecret = getSetting('jwt_secret');
  if (existingSecret) {
    JWT_SECRET = existingSecret;
  } else {
    JWT_SECRET = crypto.randomBytes(32).toString('hex');
    setSetting('jwt_secret', JWT_SECRET);
  }
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb', verify: (req, _, buf) => { req.rawBody = buf; } }));

// Async route handler wrapper to prevent unhandled promise rejections on Express 4 / Node 20+
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ==================== RBAC AUTH MIDDLEWARE ====================
const auth = (...roles) => (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!token) return res.status(401).json({ error: 'Please sign in' });

    const decoded = jwt.verify(token, JWT_SECRET);

    // Validate tokenVersion to ensure password changes invalidate existing tokens
    const user = db.prepare('SELECT id, username, role, tokenVersion FROM users WHERE id = ?').get(decoded.id);
    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ error: 'Session invalidated or expired. Please sign in again.' });
    }

    if (roles.length && !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Access restricted: Not authorized for your role (' + user.role + ')' });
    }

    req.u = { id: user.id, username: user.username, role: user.role };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
};

const bad = (res, msg, status = 400) => res.status(status).json({ error: msg });

// ==================== PUBLIC WEBHOOKS ====================
app.get('/webhooks/whatsapp', bot.verify(process.env.WA_VERIFY_TOKEN));
app.post('/webhooks/whatsapp', asyncHandler(bot.webhook));
app.use('/webhooks', leads.router);

// ==================== AUTH & LOGIN API ====================
const fails = {};
app.post('/api/login', asyncHandler(async (req, res) => {
  const f = fails[req.ip] || { n: 0, t: 0 };
  if (f.n >= 5 && Date.now() < f.t) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in a minute.' });
  }

  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.hash)) {
    fails[req.ip] = { n: f.n + 1, t: Date.now() + 60000 };
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  delete fails[req.ip];
  audit({ userId: user.id, username: user.username, action: 'LOGIN', entity: 'USER', entityId: user.id, ip: req.ip });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, tokenVersion: user.tokenVersion },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
}));

// Password change endpoint (Owner or self). Revokes previous JWTs!
app.post('/api/users/password', auth(), asyncHandler(async (req, res) => {
  const targetUsername = String(req.body.username || req.u.username).toLowerCase();
  const newPassword = String(req.body.password || '');

  if (req.u.role !== 'Owner' && req.u.username !== targetUsername) {
    return res.status(403).json({ error: 'Only owners can change other users’ passwords' });
  }
  if (newPassword.length < 8) {
    return bad(res, 'Password must be at least 8 characters long');
  }

  const target = db.prepare('SELECT id, tokenVersion FROM users WHERE username = ?').get(targetUsername);
  if (!target) return bad(res, 'User not found');

  const newHash = bcrypt.hashSync(newPassword, 10);
  const nextVersion = (target.tokenVersion || 1) + 1;
  const now = Date.now();

  db.prepare('UPDATE users SET hash = ?, tokenVersion = ?, updatedAt = ? WHERE id = ?')
    .run(newHash, nextVersion, now, target.id);

  audit({ userId: req.u.id, username: req.u.username, action: 'PASSWORD_CHANGE', entity: 'USER', entityId: target.id, ip: req.ip });
  res.json({ ok: 1, message: 'Password changed successfully. Existing sessions have been revoked.' });
}));

// User management endpoints (Owner only)
app.get('/api/users', auth('Owner'), asyncHandler(async (req, res) => {
  const users = db.prepare('SELECT id, username, name, role, createdAt, updatedAt FROM users').all();
  res.json({ users });
}));

app.post('/api/users', auth('Owner'), asyncHandler(async (req, res) => {
  const { username, name, role, password } = req.body;
  if (!username || !password || !role) return bad(res, 'Username, password, and role are required');
  if (password.length < 8) return bad(res, 'Password must be at least 8 characters');

  const cleanUser = String(username).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUser);
  if (existing) return bad(res, 'Username already exists');

  const hash = bcrypt.hashSync(password, 10);
  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO users (username, name, role, hash, tokenVersion, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `).run(cleanUser, name || cleanUser, role, hash, now, now);

  audit({ userId: req.u.id, username: req.u.username, action: 'CREATE_USER', entity: 'USER', entityId: info.lastInsertRowid, ip: req.ip });
  res.json({ ok: 1, id: info.lastInsertRowid, username: cleanUser, role });
}));

// ==================== BOOTSTRAP / INITIAL STATE ====================
app.get('/api/bootstrap', auth(), asyncHandler(async (req, res) => {
  const isOwner = req.u.role === 'Owner';
  const todayStr = core.K(new Date());

  const patients = db.prepare('SELECT * FROM patients WHERE deletedAt IS NULL ORDER BY id DESC LIMIT 150').all();
  const appointments = db.prepare('SELECT * FROM appointments WHERE deletedAt IS NULL ORDER BY date DESC, time DESC LIMIT 150').all();
  const leadsList = db.prepare('SELECT * FROM leads WHERE deletedAt IS NULL ORDER BY id DESC LIMIT 150').all();
  const inventory = db.prepare('SELECT * FROM inventory WHERE deletedAt IS NULL ORDER BY id ASC').all();
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY at DESC LIMIT 60').all();
  const invoicesList = db.prepare('SELECT * FROM invoices WHERE deletedAt IS NULL ORDER BY id DESC LIMIT 150').all();

  // Chats grouped by phone for latest conversations
  const recentChats = db.prepare(`
    SELECT phone, sender as f, message as t, status, createdAt as at
    FROM chats ORDER BY id DESC LIMIT 300
  `).all();
  const chatsMap = {};
  for (const c of recentChats) {
    chatsMap[c.phone] = chatsMap[c.phone] || [];
    chatsMap[c.phone].unshift(c);
  }

  const recallDueCount = core.dueForRecall().length;
  const todayApptsCount = db.prepare(`
    SELECT count(*) as count FROM appointments WHERE date = ? AND status = 'Booked' AND deletedAt IS NULL
  `).get(todayStr).count;

  const totalPatientsCount = db.prepare('SELECT count(*) as count FROM patients WHERE deletedAt IS NULL').get().count;
  const totalLeadsCount = db.prepare('SELECT count(*) as count FROM leads WHERE deletedAt IS NULL').get().count;

  res.json({
    me: req.u,
    patients,
    appointments,
    leads: leadsList.map(l => isOwner ? l : { ...l, cost: undefined }),
    inventory,
    notifications,
    invoices: isOwner ? invoicesList : invoicesList.map(i => ({ ...i, amount: undefined, totalAmount: undefined })),
    chats: chatsMap,
    slots: core.SLOTS,
    prices: getAllPrices(),
    settings: getAllSettings(),
    waLive: wa.on(),
    automations: sched.getStatus(),
    metrics: {
      recallDue: recallDueCount,
      todayAppts: todayApptsCount,
      totalPatients: totalPatientsCount,
      totalLeads: totalLeadsCount
    }
  });
}));

// ==================== PATIENTS API (With Pagination & Consent) ====================
app.get('/api/patients', auth(), asyncHandler(async (req, res) => {
  const page = Math.max(1, +(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, +(req.query.limit || 50)));
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search.trim().toLowerCase()}%` : null;

  let query = 'SELECT * FROM patients WHERE deletedAt IS NULL';
  let countQuery = 'SELECT count(*) as total FROM patients WHERE deletedAt IS NULL';
  const params = [];

  if (search) {
    query += ' AND (LOWER(name) LIKE ? OR phone LIKE ?)';
    countQuery += ' AND (LOWER(name) LIKE ? OR phone LIKE ?)';
    params.push(search, search);
  }

  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  const total = db.prepare(countQuery).get(...params).total;
  const list = db.prepare(query).all(...params, limit, offset);

  res.json({ patients: list, page, limit, total, pages: Math.ceil(total / limit) });
}));

app.post('/api/patients', auth(), asyncHandler(async (req, res) => {
  const { name, phone, age, gender, medicalHistory, allergies, lastVisit, lastService, notes, recallDays } = req.body;
  if (!name || core.l10(phone).length < 10) {
    return bad(res, 'Valid patient name and 10-digit phone number are required');
  }
  if (core.patientByPhone(phone)) {
    return bad(res, 'A patient with this phone number already exists');
  }

  const now = Date.now();
  const consentGivenAt = now;
  const consentSource = 'In-clinic Registration';

  const info = db.prepare(`
    INSERT INTO patients (
      name, phone, age, gender, medicalHistory, allergies,
      lastVisit, lastService, notes, recallDays, consentGivenAt, consentSource, optOut,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    String(name).trim().slice(0, 80),
    core.norm(phone),
    age ? +age : null,
    gender || 'Other',
    medicalHistory || '',
    allergies || '',
    lastVisit || null,
    lastService || 'Checkup',
    notes ? String(notes).slice(0, 2000) : '',
    recallDays ? +recallDays : 180,
    consentGivenAt,
    consentSource,
    now,
    now
  );

  const newPatient = db.prepare('SELECT * FROM patients WHERE id = ?').get(info.lastInsertRowid);
  audit({ userId: req.u.id, username: req.u.username, action: 'CREATE_PATIENT', entity: 'PATIENT', entityId: newPatient.id, details: { name: newPatient.name }, ip: req.ip });
  core.notify(`New patient registered: ${newPatient.name} (${newPatient.phone})`);
  res.json({ ok: 1, patient: newPatient });
}));

app.patch('/api/patients/:id', auth(), asyncHandler(async (req, res) => {
  const p = db.prepare('SELECT * FROM patients WHERE id = ? AND deletedAt IS NULL').get(req.params.id);
  if (!p) return bad(res, 'Patient not found');

  const { name, phone, age, gender, medicalHistory, allergies, lastVisit, lastService, notes, recallDays, optOut } = req.body;
  const now = Date.now();

  const updatedName = name !== undefined ? String(name).trim().slice(0, 80) : p.name;
  const updatedPhone = (phone && core.l10(phone).length >= 10) ? core.norm(phone) : p.phone;
  const updatedAge = age !== undefined ? (+age || null) : p.age;
  const updatedGender = gender !== undefined ? gender : p.gender;
  const updatedMed = medicalHistory !== undefined ? String(medicalHistory) : p.medicalHistory;
  const updatedAllergies = allergies !== undefined ? String(allergies) : p.allergies;
  const updatedLastVisit = lastVisit !== undefined ? (lastVisit || null) : p.lastVisit;
  const updatedLastService = lastService !== undefined ? lastService : p.lastService;
  const updatedNotes = notes !== undefined ? String(notes).slice(0, 2000) : p.notes;
  const updatedRecall = recallDays !== undefined ? (+recallDays || 180) : p.recallDays;
  const updatedOptOut = optOut !== undefined ? (optOut ? 1 : 0) : p.optOut;

  db.prepare(`
    UPDATE patients SET
      name = ?, phone = ?, age = ?, gender = ?, medicalHistory = ?, allergies = ?,
      lastVisit = ?, lastService = ?, notes = ?, recallDays = ?, optOut = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    updatedName, updatedPhone, updatedAge, updatedGender, updatedMed, updatedAllergies,
    updatedLastVisit, updatedLastService, updatedNotes, updatedRecall, updatedOptOut, now, p.id
  );

  const updated = db.prepare('SELECT * FROM patients WHERE id = ?').get(p.id);
  audit({ userId: req.u.id, username: req.u.username, action: 'UPDATE_PATIENT', entity: 'PATIENT', entityId: p.id, ip: req.ip });
  res.json({ ok: 1, patient: updated });
}));

// Patient Deletion: restricted to Owner role, soft-deleted with audit logging
app.delete('/api/patients/:id', auth('Owner'), asyncHandler(async (req, res) => {
  const p = db.prepare('SELECT * FROM patients WHERE id = ? AND deletedAt IS NULL').get(req.params.id);
  if (!p) return bad(res, 'Patient not found');

  const now = Date.now();
  db.prepare('UPDATE patients SET deletedAt = ?, updatedAt = ? WHERE id = ?').run(now, now, p.id);
  audit({ userId: req.u.id, username: req.u.username, action: 'DELETE_PATIENT', entity: 'PATIENT', entityId: p.id, details: { name: p.name }, ip: req.ip });
  core.notify(`Patient record removed: ${p.name}`);
  res.json({ ok: 1 });
}));

// Patient Recall
app.post('/api/patients/:id/recall', auth(), asyncHandler(async (req, res) => {
  const p = db.prepare('SELECT * FROM patients WHERE id = ? AND deletedAt IS NULL').get(req.params.id);
  if (!p) return bad(res, 'Patient not found');
  const resRecall = await core.recall(p, req.body?.message);
  audit({ userId: req.u.id, username: req.u.username, action: 'RECALL_PATIENT', entity: 'PATIENT', entityId: p.id, ip: req.ip });
  res.json({ ok: 1, ...resRecall });
}));

app.get('/api/recall/due', auth(), asyncHandler(async (req, res) => {
  const due = core.dueForRecall(getSetting('recallDays'));
  const now = Date.now();
  const list = due.map(p => {
    const vDate = new Date(p.lastVisit.includes('T') ? p.lastVisit : p.lastVisit + 'T00:00');
    const daysSince = Math.floor((now - vDate.getTime()) / 864e5);
    return {
      ...p,
      daysSinceLastVisit: daysSince,
      daysOverdue: daysSince - (p.recallDays || 180)
    };
  });
  res.json({ count: list.length, patients: list });
}));

app.post('/api/recall/run', auth(), asyncHandler(async (req, res) => {
  const thresholdDays = req.body?.thresholdDays || getSetting('recallDays');
  const result = await sched.runRecall(thresholdDays);
  audit({ userId: req.u.id, username: req.u.username, action: 'RUN_RECALL_BATCH', entity: 'SYSTEM', details: result, ip: req.ip });
  res.json(result);
}));

// ==================== APPOINTMENTS API ====================
app.get('/api/appointments', auth(), asyncHandler(async (req, res) => {
  const date = req.query.date;
  const patientId = req.query.patientId;
  let query = 'SELECT * FROM appointments WHERE deletedAt IS NULL';
  const params = [];

  if (date) { query += ' AND date = ?'; params.push(date); }
  if (patientId) { query += ' AND patientId = ?'; params.push(patientId); }
  query += ' ORDER BY date DESC, time DESC';

  const list = db.prepare(query).all(...params);
  res.json({ appointments: list });
}));

app.post('/api/appointments', auth(), asyncHandler(async (req, res) => {
  const { patientId, date, time, service, notes } = req.body;
  if (!patientId || !date || !time) return bad(res, 'Patient, date, and time slot are required');

  const appt = core.book(+patientId, { date, time, service: service || 'Checkup', notes: notes || '' }, 'Manual');
  if (!appt) return bad(res, 'That slot is already booked or patient was not found');

  audit({ userId: req.u.id, username: req.u.username, action: 'CREATE_APPT', entity: 'APPOINTMENT', entityId: appt.id, details: { date, time, service }, ip: req.ip });
  res.json(appt);
}));

app.patch('/api/appointments/:id', auth(), asyncHandler(async (req, res) => {
  const a = db.prepare('SELECT * FROM appointments WHERE id = ? AND deletedAt IS NULL').get(req.params.id);
  if (!a) return bad(res, 'Appointment not found');

  // Handle rescheduling
  if (req.body.date && req.body.time && (req.body.date !== a.date || req.body.time !== a.time)) {
    const resched = core.reschedule(a.id, req.body.date, req.body.time);
    if (!resched) return bad(res, 'New slot is already taken');
    audit({ userId: req.u.id, username: req.u.username, action: 'RESCHEDULE_APPT', entity: 'APPOINTMENT', entityId: a.id, details: { newDate: req.body.date, newTime: req.body.time }, ip: req.ip });
    return res.json(resched);
  }

  // Handle status updates safely
  const st = req.body.status;
  if (st && st !== a.status) {
    if (st === 'Completed' && a.status !== 'Completed') {
      const completed = core.completeAppointment(a.id);
      audit({ userId: req.u.id, username: req.u.username, action: 'COMPLETE_APPT', entity: 'APPOINTMENT', entityId: a.id, ip: req.ip });
      return res.json(completed);
    }

    if (st === 'Cancelled' && a.status === 'Booked') {
      core.notify(`Appointment cancelled by staff: ${core.lab(a.date)} ${a.time}`);
      audit({ userId: req.u.id, username: req.u.username, action: 'CANCEL_APPT', entity: 'APPOINTMENT', entityId: a.id, ip: req.ip });
    }

    db.prepare('UPDATE appointments SET status = ?, updatedAt = ? WHERE id = ?').run(st, Date.now(), a.id);
  }

  if (req.body.service) {
    db.prepare('UPDATE appointments SET service = ?, updatedAt = ? WHERE id = ?').run(req.body.service, Date.now(), a.id);
  }
  if (req.body.notes !== undefined) {
    db.prepare('UPDATE appointments SET notes = ?, updatedAt = ? WHERE id = ?').run(req.body.notes, Date.now(), a.id);
  }

  const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(a.id);
  res.json(updated);
}));

app.delete('/api/appointments/:id', auth('Owner', 'Doctor'), asyncHandler(async (req, res) => {
  const a = db.prepare('SELECT * FROM appointments WHERE id = ? AND deletedAt IS NULL').get(req.params.id);
  if (!a) return bad(res, 'Appointment not found');

  db.prepare('UPDATE appointments SET deletedAt = ?, updatedAt = ? WHERE id = ?').run(Date.now(), Date.now(), a.id);
  audit({ userId: req.u.id, username: req.u.username, action: 'DELETE_APPT', entity: 'APPOINTMENT', entityId: a.id, ip: req.ip });
  core.notify(`Appointment removed: ${core.lab(a.date)} at ${a.time}`);
  res.json({ ok: 1 });
}));

app.get('/api/slots', auth(), asyncHandler(async (req, res) => {
  const dateStr = req.query.date || core.K(new Date());
  const free = core.freeSlots(20, 0, dateStr);
  res.json({ date: dateStr, slots: free, allSlots: core.SLOTS });
}));

// ==================== LEADS API ====================
app.get('/api/leads', auth(), asyncHandler(async (req, res) => {
  const isOwner = req.u.role === 'Owner';
  const list = db.prepare('SELECT * FROM leads WHERE deletedAt IS NULL ORDER BY id DESC').all();
  res.json({ leads: list.map(l => isOwner ? l : { ...l, cost: undefined }) });
}));

app.post('/api/leads', auth(), asyncHandler(async (req, res) => {
  const l = await leads.ingest({ ...req.body, source: req.body.source || 'Manual' });
  if (!l) return bad(res, 'Duplicate phone number or invalid lead info');
  audit({ userId: req.u.id, username: req.u.username, action: 'CREATE_LEAD', entity: 'LEAD', entityId: l.id, ip: req.ip });
  res.json(l);
}));

app.patch('/api/leads/:id', auth(), asyncHandler(async (req, res) => {
  const l = db.prepare('SELECT * FROM leads WHERE id = ? AND deletedAt IS NULL').get(req.params.id);
  if (!l) return bad(res, 'Lead not found');

  const isOwner = req.u.role === 'Owner';
  const name = req.body.name !== undefined ? String(req.body.name).trim() : l.name;
  const phone = req.body.phone !== undefined ? core.norm(req.body.phone) : l.phone;
  const status = req.body.status !== undefined ? req.body.status : l.status;
  const notes = req.body.notes !== undefined ? req.body.notes : l.notes;
  const cost = (isOwner && req.body.cost !== undefined) ? (+req.body.cost || 0) : l.cost;

  db.prepare(`
    UPDATE leads SET name = ?, phone = ?, status = ?, notes = ?, cost = ?, updatedAt = ?
    WHERE id = ?
  `).run(name, phone, status, notes, cost, Date.now(), l.id);

  const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(l.id);
  audit({ userId: req.u.id, username: req.u.username, action: 'UPDATE_LEAD', entity: 'LEAD', entityId: l.id, ip: req.ip });
  res.json(isOwner ? updated : { ...updated, cost: undefined });
}));

// Lead deletion: restricted to Owner
app.delete('/api/leads/:id', auth('Owner'), asyncHandler(async (req, res) => {
  const l = db.prepare('SELECT * FROM leads WHERE id = ? AND deletedAt IS NULL').get(req.params.id);
  if (!l) return bad(res, 'Lead not found');

  db.prepare('UPDATE leads SET deletedAt = ?, updatedAt = ? WHERE id = ?').run(Date.now(), Date.now(), l.id);
  audit({ userId: req.u.id, username: req.u.username, action: 'DELETE_LEAD', entity: 'LEAD', entityId: l.id, ip: req.ip });
  res.json({ ok: 1 });
}));

app.post('/api/leads/:id/convert', auth(), asyncHandler(async (req, res) => {
  const l = db.prepare('SELECT * FROM leads WHERE id = ? AND deletedAt IS NULL').get(req.params.id);
  if (!l) return bad(res, 'Lead not found');

  const p = core.ensurePatient(l.phone, l.name, l.source);
  db.prepare(`UPDATE leads SET patientId = ?, status = 'Won', updatedAt = ? WHERE id = ?`).run(p.id, Date.now(), l.id);

  audit({ userId: req.u.id, username: req.u.username, action: 'CONVERT_LEAD', entity: 'LEAD', entityId: l.id, details: { patientId: p.id }, ip: req.ip });

  if (req.body.date && req.body.time) {
    const appt = core.book(p.id, { date: req.body.date, time: req.body.time, service: req.body.service || 'Checkup' }, 'Lead Conversion');
    return res.json({ ok: 1, patient: p, appointment: appt });
  }
  res.json({ ok: 1, patient: p });
}));

app.post('/api/leads/import', auth(), asyncHandler(async (req, res) => {
  const count = await leads.importCSV(String(req.body.text || ''), 'CSV Import');
  audit({ userId: req.u.id, username: req.u.username, action: 'IMPORT_LEADS_CSV', entity: 'LEADS', details: { count }, ip: req.ip });
  res.json({ created: count });
}));

app.post('/api/leads/sync-sheet', auth(), asyncHandler(async (req, res) => {
  const count = await leads.pollSheet();
  audit({ userId: req.u.id, username: req.u.username, action: 'SYNC_SHEET_LEADS', entity: 'LEADS', details: { count }, ip: req.ip });
  res.json({ created: count });
}));

app.post('/api/leads/:id/engage', auth(), asyncHandler(async (req, res) => {
  const l = db.prepare('SELECT * FROM leads WHERE id = ? AND deletedAt IS NULL').get(req.params.id);
  if (!l) return bad(res, 'Lead not found');
  await core.engage(l);
  audit({ userId: req.u.id, username: req.u.username, action: 'ENGAGE_LEAD', entity: 'LEAD', entityId: l.id, ip: req.ip });
  res.json({ ok: 1 });
}));

// ==================== INVENTORY API ====================
app.get('/api/inventory', auth(), asyncHandler(async (req, res) => {
  const items = db.prepare('SELECT * FROM inventory WHERE deletedAt IS NULL ORDER BY id ASC').all();
  res.json({ inventory: items });
}));

app.post('/api/inventory', auth(), asyncHandler(async (req, res) => {
  const { name, qty, min, unit } = req.body;
  if (!name) return bad(res, 'Item name is required');

  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO inventory (name, qty, minQty, unit, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(String(name).trim(), +qty || 0, +min || 5, unit || 'units', now, now);

  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(info.lastInsertRowid);
  audit({ userId: req.u.id, username: req.u.username, action: 'CREATE_INVENTORY', entity: 'INVENTORY', entityId: item.id, ip: req.ip });
  res.json(item);
}));

app.patch('/api/inventory/:id', auth(), asyncHandler(async (req, res) => {
  const item = db.prepare('SELECT * FROM inventory WHERE id = ? AND deletedAt IS NULL').get(req.params.id);
  if (!item) return bad(res, 'Item not found');

  const name = req.body.name !== undefined ? req.body.name : item.name;
  const qty = req.body.qty !== undefined ? +req.body.qty : item.qty;
  const minQty = req.body.min !== undefined ? +req.body.min : item.minQty;
  const unit = req.body.unit !== undefined ? req.body.unit : item.unit;

  db.prepare(`
    UPDATE inventory SET name = ?, qty = ?, minQty = ?, unit = ?, updatedAt = ?
    WHERE id = ?
  `).run(name, qty, minQty, unit, Date.now(), item.id);

  const updated = db.prepare('SELECT * FROM inventory WHERE id = ?').get(item.id);
  audit({ userId: req.u.id, username: req.u.username, action: 'UPDATE_INVENTORY', entity: 'INVENTORY', entityId: item.id, ip: req.ip });
  res.json(updated);
}));

app.delete('/api/inventory/:id', auth('Owner'), asyncHandler(async (req, res) => {
  const item = db.prepare('SELECT * FROM inventory WHERE id = ? AND deletedAt IS NULL').get(req.params.id);
  if (!item) return bad(res, 'Item not found');

  db.prepare('UPDATE inventory SET deletedAt = ?, updatedAt = ? WHERE id = ?').run(Date.now(), Date.now(), item.id);
  audit({ userId: req.u.id, username: req.u.username, action: 'DELETE_INVENTORY', entity: 'INVENTORY', entityId: item.id, ip: req.ip });
  res.json({ ok: 1 });
}));

// ==================== BILLING & INVOICES API ====================
app.get('/api/invoices', auth(), asyncHandler(async (req, res) => {
  const isOwner = req.u.role === 'Owner' || req.u.role === 'Doctor';
  const list = db.prepare('SELECT * FROM invoices WHERE deletedAt IS NULL ORDER BY id DESC').all();
  res.json({ invoices: isOwner ? list : list.map(i => ({ ...i, amount: undefined, totalAmount: undefined })) });
}));

app.post('/api/invoices', auth('Owner', 'Doctor'), asyncHandler(async (req, res) => {
  const { patientId, service, amount, method, notes, appointmentId } = req.body;
  if (!patientId || !amount) return bad(res, 'Patient and amount are required');

  const now = Date.now();
  const count = db.prepare('SELECT count(*) as count FROM invoices').get().count + 1;
  const invNum = `INV-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

  const info = db.prepare(`
    INSERT INTO invoices (invoiceNumber, appointmentId, patientId, service, amount, discount, taxRate, taxAmount, totalAmount, paid, method, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, 0, ?, ?, ?, ?)
  `).run(invNum, appointmentId || null, +patientId, service || 'Consultation', +amount, +amount, method || 'Pending', notes || '', now, now);

  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(info.lastInsertRowid);
  const p = db.prepare('SELECT name FROM patients WHERE id = ?').get(patientId);
  core.notify(`Invoice #${invNum} created for ${p ? p.name : 'Patient'}: ₹${inv.amount}`);
  audit({ userId: req.u.id, username: req.u.username, action: 'CREATE_INVOICE', entity: 'INVOICE', entityId: inv.id, ip: req.ip });
  res.json(inv);
}));

app.patch('/api/invoices/:id/pay', auth('Owner'), asyncHandler(async (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ? AND deletedAt IS NULL').get(req.params.id);
  if (!inv) return bad(res, 'Invoice not found');

  const now = Date.now();
  const method = req.body.method || inv.method || 'Cash';
  db.prepare('UPDATE invoices SET paid = 1, paidAt = ?, method = ?, updatedAt = ? WHERE id = ?')
    .run(now, method, now, inv.id);

  const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(inv.id);
  const p = db.prepare('SELECT name FROM patients WHERE id = ?').get(inv.patientId);
  core.notify(`Payment received: ₹${inv.totalAmount} from ${p ? p.name : 'Patient'} (${method})`);
  audit({ userId: req.u.id, username: req.u.username, action: 'PAY_INVOICE', entity: 'INVOICE', entityId: inv.id, details: { method }, ip: req.ip });
  res.json(updated);
}));

// Printable receipt view/download endpoint
app.get('/api/invoices/:id/receipt', auth(), asyncHandler(async (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ? AND deletedAt IS NULL').get(req.params.id);
  if (!inv) return bad(res, 'Invoice not found');
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(inv.patientId);
  const settings = getAllSettings();

  res.json({
    receipt: {
      invoiceNumber: inv.invoiceNumber,
      date: new Date(inv.createdAt).toLocaleDateString('en-IN'),
      clinicName: settings.clinicName || 'DentaDesk Dental Care',
      clinicAddress: settings.address || '',
      clinicPhone: settings.phone || '',
      doctorName: settings.doctorName || 'Dr. Raj',
      patientName: patient ? patient.name : 'Patient',
      patientPhone: patient ? patient.phone : '',
      service: inv.service,
      amount: inv.amount,
      totalAmount: inv.totalAmount,
      paid: !!inv.paid,
      paidAt: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('en-IN') : null,
      method: inv.method
    }
  });
}));

// ==================== SETTINGS & CLINIC CONFIG (Strict Whitelist & RBAC) ====================
const ALLOWED_SETTING_KEYS = ['clinicName', 'doctorName', 'phone', 'address', 'recallDays', 'workingHours', 'timezone'];

app.get('/api/settings', auth(), asyncHandler(async (req, res) => {
  const all = getAllSettings();
  const whitelisted = {};
  for (const k of ALLOWED_SETTING_KEYS) {
    if (all[k] !== undefined) whitelisted[k] = all[k];
  }
  res.json({
    settings: whitelisted,
    prices: getAllPrices(),
    slots: core.SLOTS
  });
}));

app.patch('/api/settings', auth('Owner'), asyncHandler(async (req, res) => {
  if (req.body.settings && typeof req.body.settings === 'object') {
    // STRICT WHITELIST to prevent mass assignment vulnerability
    for (const [key, value] of Object.entries(req.body.settings)) {
      if (ALLOWED_SETTING_KEYS.includes(key)) {
        setSetting(key, typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }
  }

  if (req.body.prices && typeof req.body.prices === 'object') {
    for (const [service, price] of Object.entries(req.body.prices)) {
      setPrice(service, price);
    }
  }

  audit({ userId: req.u.id, username: req.u.username, action: 'UPDATE_SETTINGS', entity: 'SETTINGS', ip: req.ip });
  const all = getAllSettings();
  const whitelisted = {};
  for (const k of ALLOWED_SETTING_KEYS) {
    if (all[k] !== undefined) whitelisted[k] = all[k];
  }
  res.json({ ok: 1, settings: whitelisted, prices: getAllPrices() });
}));

// ==================== WHATSAPP & BOT SIMULATOR ====================
app.get('/api/chats/:phone', auth(), asyncHandler(async (req, res) => {
  const cleanPh = core.norm(req.params.phone);
  const chats = db.prepare(`
    SELECT phone, sender as f, message as t, status, createdAt as at
    FROM chats WHERE phone = ? ORDER BY id ASC LIMIT 100
  `).all(cleanPh);
  res.json({ chats });
}));

app.post('/api/chats/:phone/send', auth(), asyncHandler(async (req, res) => {
  const cleanPh = core.norm(req.params.phone);
  const text = String(req.body.text || '').slice(0, 1000);
  await wa.text(cleanPh, text);
  const chats = db.prepare(`
    SELECT phone, sender as f, message as t, status, createdAt as at
    FROM chats WHERE phone = ? ORDER BY id ASC LIMIT 100
  `).all(cleanPh);
  res.json({ ok: 1, chats });
}));

app.post('/api/chats/simulate', auth(), asyncHandler(async (req, res) => {
  const { phone, text, btn, name } = req.body;
  if (!phone) return bad(res, 'Phone number is required');
  const cleanPh = core.norm(phone);
  await bot.simulateInbound(cleanPh, text, btn, name);
  const chats = db.prepare(`
    SELECT phone, sender as f, message as t, status, createdAt as at
    FROM chats WHERE phone = ? ORDER BY id ASC LIMIT 100
  `).all(cleanPh);
  res.json({ ok: 1, chats });
}));

// WhatsApp status check: restricted to Owner to prevent credential leak
app.get('/api/wa/status', auth('Owner'), asyncHandler(async (req, res) => {
  const token = wa.getToken();
  res.json({
    live: wa.on(),
    tokenConfigured: !!token,
    tokenPreview: token ? token.slice(0, 4) + '...' + token.slice(-4) : null,
    phoneId: wa.getPhoneId() || null,
    notifyNumbers: getSetting('notifyNumbers') || process.env.NOTIFY_NUMBERS || ''
  });
}));

app.post('/api/wa/test', auth('Owner'), asyncHandler(async (req, res) => {
  const phone = req.body?.phone || getSetting('phone') || (process.env.NOTIFY_NUMBERS || '').split(',')[0];
  const text = req.body?.text || 'Hello from DentaDesk! 🦷 Testing live WhatsApp connection.';
  const resTest = await wa.sendTest(phone, text);
  res.json(resTest);
}));

// ==================== AUTOMATIONS API ====================
app.get('/api/automations', auth(), asyncHandler(async (req, res) => {
  res.json(sched.getStatus());
}));

app.post('/api/automations/run/:task', auth('Owner'), asyncHandler(async (req, res) => {
  const task = req.params.task;
  let result;
  if (task === 'recall') result = await sched.runRecall();
  else if (task === 'reminders') result = await sched.reminders();
  else if (task === 'noshows' || task === 'noShows') result = await sched.noShows();
  else if (task === 'sheet' || task === 'pollSheet') result = await sched.pollSheetAuto();
  else if (task === 'leadFollowup' || task === 'leadagent' || task === 'leads') result = await sched.runLeadFollowupAgent(true);
  else return bad(res, 'Unknown automation task: ' + task);

  audit({ userId: req.u.id, username: req.u.username, action: 'TRIGGER_AUTOMATION', entity: 'CRON', details: { task }, ip: req.ip });
  res.json({ ok: 1, task, result, status: sched.getStatus() });
}));

// ==================== CLINICAL RECORDS: TREATMENT PLANS & NOTES (P2) ====================
app.get('/api/patients/:id/treatment-plans', auth(), asyncHandler(async (req, res) => {
  const plans = db.prepare('SELECT * FROM treatment_plans WHERE patientId = ? AND deletedAt IS NULL ORDER BY id DESC').all(req.params.id);
  res.json({
    plans: plans.map(p => ({
      ...p,
      items: JSON.parse(p.itemsJson || '[]')
    }))
  });
}));

app.post('/api/patients/:id/treatment-plans', auth('Owner', 'Doctor'), asyncHandler(async (req, res) => {
  const { title, items, totalCost, notes } = req.body;
  if (!title || !items) return bad(res, 'Plan title and procedure items are required');

  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO treatment_plans (patientId, title, status, itemsJson, totalCost, notes, createdAt, updatedAt)
    VALUES (?, ?, 'Proposed', ?, ?, ?, ?, ?)
  `).run(+req.params.id, String(title).trim(), JSON.stringify(items || []), +totalCost || 0, notes || '', now, now);

  const plan = db.prepare('SELECT * FROM treatment_plans WHERE id = ?').get(info.lastInsertRowid);
  audit({ userId: req.u.id, username: req.u.username, action: 'CREATE_TREATMENT_PLAN', entity: 'TREATMENT_PLAN', entityId: plan.id, ip: req.ip });
  res.json({ ok: 1, plan: { ...plan, items: JSON.parse(plan.itemsJson) } });
}));

app.get('/api/patients/:id/clinical-notes', auth(), asyncHandler(async (req, res) => {
  const notes = db.prepare('SELECT * FROM clinical_notes WHERE patientId = ? AND deletedAt IS NULL ORDER BY id DESC').all(req.params.id);
  res.json({ notes });
}));

app.post('/api/patients/:id/clinical-notes', auth('Owner', 'Doctor'), asyncHandler(async (req, res) => {
  const { appointmentId, toothNumber, diagnosis, proceduresDone, prescriptions, notes } = req.body;
  const now = Date.now();

  const info = db.prepare(`
    INSERT INTO clinical_notes (patientId, appointmentId, doctorId, toothNumber, diagnosis, proceduresDone, prescriptions, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    +req.params.id,
    appointmentId ? +appointmentId : null,
    getSetting('doctorName', 'Dr. Raj'),
    toothNumber || null,
    diagnosis || '',
    proceduresDone || '',
    prescriptions || '',
    notes || '',
    now,
    now
  );

  const record = db.prepare('SELECT * FROM clinical_notes WHERE id = ?').get(info.lastInsertRowid);
  audit({ userId: req.u.id, username: req.u.username, action: 'CREATE_CLINICAL_NOTE', entity: 'CLINICAL_NOTE', entityId: record.id, ip: req.ip });
  res.json({ ok: 1, note: record });
}));

// ==================== AUDIT TRAIL API (Owner only) ====================
app.get('/api/audit-logs', auth('Owner'), asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, +(req.query.limit || 50)));
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
  res.json({ logs });
}));

// ==================== REPORTING & CSV EXPORT API ====================
app.get('/api/reports/summary', auth('Owner'), asyncHandler(async (req, res) => {
  const totalRev = db.prepare('SELECT SUM(totalAmount) as total FROM invoices WHERE paid = 1 AND deletedAt IS NULL').get().total || 0;
  const pendingRev = db.prepare('SELECT SUM(totalAmount) as total FROM invoices WHERE paid = 0 AND deletedAt IS NULL').get().total || 0;
  const totalAppts = db.prepare('SELECT count(*) as total FROM appointments WHERE deletedAt IS NULL').get().total || 0;
  const completedAppts = db.prepare("SELECT count(*) as total FROM appointments WHERE status = 'Completed' AND deletedAt IS NULL").get().total || 0;
  const noShowAppts = db.prepare("SELECT count(*) as total FROM appointments WHERE status = 'No-show' AND deletedAt IS NULL").get().total || 0;

  const noShowRate = totalAppts > 0 ? ((noShowAppts / totalAppts) * 100).toFixed(1) : 0;
  const completionRate = totalAppts > 0 ? ((completedAppts / totalAppts) * 100).toFixed(1) : 0;

  res.json({
    revenue: { collected: totalRev, pending: pendingRev },
    appointments: { total: totalAppts, completed: completedAppts, noShow: noShowAppts, noShowRate: +noShowRate, completionRate: +completionRate }
  });
}));

app.get('/api/reports/export/:type', auth('Owner'), asyncHandler(async (req, res) => {
  const type = req.params.type;
  let rows = [];
  let headers = [];

  if (type === 'patients') {
    rows = db.prepare('SELECT id, name, phone, age, gender, lastVisit, lastService, createdAt FROM patients WHERE deletedAt IS NULL').all();
    headers = ['ID', 'Name', 'Phone', 'Age', 'Gender', 'Last Visit', 'Last Service', 'Created At'];
  } else if (type === 'invoices') {
    rows = db.prepare('SELECT invoiceNumber, patientId, service, totalAmount, paid, method, createdAt FROM invoices WHERE deletedAt IS NULL').all();
    headers = ['Invoice Number', 'Patient ID', 'Service', 'Amount', 'Paid', 'Method', 'Date'];
  } else if (type === 'leads') {
    rows = db.prepare('SELECT id, name, phone, source, cost, status, aiStage, createdAt FROM leads WHERE deletedAt IS NULL').all();
    headers = ['ID', 'Name', 'Phone', 'Source', 'Cost', 'Status', 'AI Stage', 'Date'];
  } else {
    return bad(res, 'Unknown export type: ' + type);
  }

  const csvContent = [headers.join(',')].concat(
    rows.map(r => Object.values(r).map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="dentadesk_${type}_export.csv"`);
  res.send(csvContent);
}));

// ==================== PUBLIC WEB BOOKING ROUTE ====================
app.get('/api/public/clinic-info', asyncHandler(async (req, res) => {
  const settings = getAllSettings();
  res.json({
    clinicName: settings.clinicName || 'DentaDesk Dental Care',
    doctorName: settings.doctorName || 'Dr. Raj',
    address: settings.address || '',
    phone: settings.phone || '',
    prices: getAllPrices(),
    slots: core.SLOTS
  });
}));

app.post('/api/public/book', asyncHandler(async (req, res) => {
  const { name, phone, date, time, service, notes } = req.body;
  if (!name || core.l10(phone).length < 10 || !date || !time) {
    return bad(res, 'Name, 10-digit phone, date, and time slot are required');
  }

  let patient = core.patientByPhone(phone);
  if (!patient) {
    patient = core.ensurePatient(phone, name, 'Web Booking Portal');
  }

  const appt = core.book(patient.id, { date, time, service: service || 'Checkup', notes: notes || 'Booked via Web Portal' }, 'Web Booking Portal');
  if (!appt) return bad(res, 'The requested slot is already booked. Please choose another time.');

  audit({ userId: null, username: 'public_portal', action: 'WEB_BOOKING', entity: 'APPOINTMENT', entityId: appt.id, ip: req.ip });
  res.json({ ok: 1, message: 'Your appointment has been booked!', appointment: appt });
}));

// ==================== AI COPILOT & CLINICAL TRIAGE ====================
app.post('/api/ai/triage', auth(), asyncHandler(async (req, res) => {
  const { symptoms } = req.body;
  if (!symptoms) return bad(res, 'Please provide symptom description');
  const result = ai.triageSymptoms(symptoms);
  res.json(result);
}));

app.post('/api/ai/recall-optimizer', auth(), asyncHandler(async (req, res) => {
  const thresholdDays = req.body?.recallDays || getSetting('recallDays', 180);
  const patients = db.prepare('SELECT * FROM patients WHERE deletedAt IS NULL').all();
  const appointments = db.prepare('SELECT * FROM appointments WHERE deletedAt IS NULL').all();
  const analysis = ai.analyzeRecalls(patients, appointments, thresholdDays);
  res.json(analysis);
}));

app.post('/api/ai/draft-reply', auth(), asyncHandler(async (req, res) => {
  const { scenario, context } = req.body;
  const reply = ai.draftWhatsAppReply(scenario || 'lead_welcome', context || {});
  res.json({ reply });
}));

app.post('/api/ai/treatment-plan', auth(), asyncHandler(async (req, res) => {
  const { services, notes } = req.body;
  const plan = ai.generateTreatmentPlan(services || ['Checkup'], getAllPrices(), notes);
  res.json(plan);
}));

app.post('/api/ai/chat', auth(), asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) return bad(res, 'Message cannot be empty');
  const patients = db.prepare('SELECT * FROM patients WHERE deletedAt IS NULL').all();
  const appointments = db.prepare('SELECT * FROM appointments WHERE deletedAt IS NULL').all();
  const leadsList = db.prepare('SELECT * FROM leads WHERE deletedAt IS NULL').all();

  const response = await ai.chatWithCopilot(message, {
    patients,
    appointments,
    leads: leadsList,
    prices: getAllPrices()
  });
  res.json(response);
}));

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Client-side routing fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== GLOBAL ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack || err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 3000;
let serverInstance = null;

if (require.main === module) {
  serverInstance = app.listen(PORT, () => {
    console.log(`DentaDesk running on port ${PORT}` + (wa.on() ? ' [Live WhatsApp API]' : ' [Dry-Run WhatsApp Mode]'));
    sched.start();
  });
}

module.exports = { app, serverInstance };

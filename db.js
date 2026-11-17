const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const DB_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DB_DIR, { recursive: true });
const isTestEnv = process.env.NODE_ENV === 'test' || process.argv.some(a => a.includes('test'));
const defaultDbName = isTestEnv ? 'dentadesk.test.sqlite' : 'dentadesk.sqlite';
const DB_FILE = process.env.DB_FILE || path.join(DB_DIR, defaultDbName);
const BACKUP_DIR = path.join(DB_DIR, 'backups');
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);

// Set performance and durability pragmas
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize Schema
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT NOT NULL,
      hash TEXT NOT NULL,
      tokenVersion INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      medicalHistory TEXT DEFAULT '',
      allergies TEXT DEFAULT '',
      lastVisit TEXT,
      lastService TEXT,
      notes TEXT,
      recallDays INTEGER DEFAULT 180,
      recalledAt INTEGER,
      recallCount INTEGER DEFAULT 0,
      consentGivenAt INTEGER,
      consentSource TEXT,
      optOut INTEGER DEFAULT 0,
      optedOutAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      deletedAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
    CREATE INDEX IF NOT EXISTS idx_patients_deletedAt ON patients(deletedAt);

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patientId INTEGER NOT NULL,
      doctorId TEXT DEFAULT 'Dr. Raj',
      chair TEXT DEFAULT 'Chair 1',
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration INTEGER DEFAULT 60,
      service TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'Booked',
      source TEXT DEFAULT 'Manual',
      reminded INTEGER DEFAULT 0,
      stockDeducted INTEGER DEFAULT 0,
      invoiceId INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      deletedAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_appts_date_time ON appointments(date, time);
    CREATE INDEX IF NOT EXISTS idx_appts_patientId ON appointments(patientId);

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      source TEXT DEFAULT 'Manual',
      campaignId TEXT,
      adId TEXT,
      formId TEXT,
      gclid TEXT,
      cost REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'New',
      aiStage TEXT DEFAULT 'NEW',
      clinicalIssue TEXT,
      urgency TEXT DEFAULT 'Routine',
      followupCount INTEGER DEFAULT 0,
      lastFollowupAt INTEGER,
      patientId INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      deletedAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceNumber TEXT UNIQUE NOT NULL,
      appointmentId INTEGER,
      patientId INTEGER NOT NULL,
      service TEXT NOT NULL,
      amount REAL NOT NULL,
      discount REAL DEFAULT 0,
      taxRate REAL DEFAULT 0,
      taxAmount REAL DEFAULT 0,
      totalAmount REAL NOT NULL,
      paid INTEGER DEFAULT 0,
      paidAt INTEGER,
      method TEXT DEFAULT 'Pending',
      notes TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      deletedAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_invoices_patientId ON invoices(patientId);

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      qty REAL NOT NULL DEFAULT 0,
      minQty REAL NOT NULL DEFAULT 5,
      unit TEXT NOT NULL DEFAULT 'units',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      deletedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS service_supplies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service TEXT NOT NULL,
      inventoryId INTEGER NOT NULL,
      qtyPerService REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      sender TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      metadata TEXT,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chats_phone ON chats(phone);

    CREATE TABLE IF NOT EXISTS bot_sessions (
      phone TEXT PRIMARY KEY,
      pendingSlots TEXT,
      offeredAt INTEGER,
      pendingCancellationApptId INTEGER,
      lastInboundAt INTEGER,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS imported_sheet_rows (
      rowHash TEXT PRIMARY KEY,
      importedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      userId INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entityId TEXT,
      details TEXT,
      ip TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);

    CREATE TABLE IF NOT EXISTS treatment_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patientId INTEGER NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'Proposed',
      itemsJson TEXT NOT NULL,
      totalCost REAL NOT NULL,
      notes TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      deletedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS clinical_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patientId INTEGER NOT NULL,
      appointmentId INTEGER,
      doctorId TEXT,
      toothNumber TEXT,
      diagnosis TEXT,
      proceduresDone TEXT,
      prescriptions TEXT,
      notes TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      deletedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS prices (
      service TEXT PRIMARY KEY,
      price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      msg TEXT NOT NULL,
      at INTEGER NOT NULL
    );
  `);
  try { db.exec('ALTER TABLE leads ADD COLUMN notes TEXT;'); } catch {}
}

initSchema();

// Backup routine
function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `dentadesk_backup_${timestamp}.sqlite`);
  try {
    db.exec(`VACUUM INTO '${backupFile.replace(/'/g, "''")}';`);
    console.log(`[Backup] Database snapshot saved: ${backupFile}`);
    // Keep only latest 14 backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('dentadesk_backup_'))
      .sort();
    if (files.length > 14) {
      for (const oldFile of files.slice(0, files.length - 14)) {
        try { fs.unlinkSync(path.join(BACKUP_DIR, oldFile)); } catch {}
      }
    }
    return backupFile;
  } catch (err) {
    console.error('[Backup] Snapshot failed:', err.message);
    return null;
  }
}

// Initial defaults & seed migration from db.json if present
function seedDefaults() {
  const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  const legacyJsonFile = path.join(DB_DIR, 'db.json');
  let legacyData = null;

  if (fs.existsSync(legacyJsonFile)) {
    try {
      legacyData = JSON.parse(fs.readFileSync(legacyJsonFile, 'utf8'));
    } catch {}
  }

  // 1. Users
  if (userCount === 0) {
    const now = Date.now();
    if (legacyData?.users?.length) {
      for (const u of legacyData.users) {
        db.prepare(`
          INSERT OR IGNORE INTO users (id, username, name, role, hash, tokenVersion, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `).run(u.id, u.username, u.name || u.username, u.role, u.hash, now, now);
      }
      console.log(`[Seed] Migrated ${legacyData.users.length} users from db.json`);
    } else {
      const defaultOwnerPw = process.env.OWNER_PASSWORD || crypto.randomBytes(5).toString('hex');
      const defaultAdminPw = process.env.ADMIN_PASSWORD || crypto.randomBytes(5).toString('hex');
      db.prepare(`
        INSERT OR IGNORE INTO users (username, name, role, hash, tokenVersion, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `).run('owner', 'Clinic Owner', 'Owner', bcrypt.hashSync(defaultOwnerPw, 10), now, now);
      db.prepare(`
        INSERT OR IGNORE INTO users (username, name, role, hash, tokenVersion, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `).run('admin', 'Clinic Receptionist', 'Admin', bcrypt.hashSync(defaultAdminPw, 10), now, now);
      console.log(`Created login owner / ${defaultOwnerPw} (role: Owner)`);
      console.log(`Created login admin / ${defaultAdminPw} (role: Admin)`);
    }
  }

  // 2. Settings
  const getSetting = (k) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
    return row ? row.value : null;
  };
  const setSetting = (k, v) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(k, String(v));
  };

  if (!getSetting('clinicName')) {
    setSetting('clinicName', legacyData?.settings?.clinicName || 'DentaDesk Dental Care');
    setSetting('doctorName', legacyData?.settings?.doctorName || 'Dr. Raj');
    setSetting('phone', legacyData?.settings?.phone || (process.env.NOTIFY_NUMBERS ? process.env.NOTIFY_NUMBERS.split(',')[0].trim() : ''));
    setSetting('address', legacyData?.settings?.address || 'Suite 402, Dental Care Plaza, Indiranagar');
    setSetting('recallDays', legacyData?.settings?.recallDays || +(process.env.RECALL_DAYS || 180));
    setSetting('workingHours', JSON.stringify({ start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5, 6] }));
    setSetting('timezone', process.env.TZ || 'Asia/Kolkata');
  }

  // 3. Prices
  const priceCount = db.prepare('SELECT count(*) as count FROM prices').get().count;
  if (priceCount === 0) {
    const defaultPrices = legacyData?.prices || {
      'Checkup': 500,
      'Cleaning': 1200,
      'Root canal': 6500,
      'Whitening': 4000,
      'Ortho review': 800,
      'Filling': 1500,
      'Consultation': 300
    };
    for (const [svc, p] of Object.entries(defaultPrices)) {
      db.prepare('INSERT OR REPLACE INTO prices (service, price) VALUES (?, ?)').run(svc, +p);
    }
  }

  // 4. Inventory
  const invCount = db.prepare('SELECT count(*) as count FROM inventory WHERE deletedAt IS NULL').get().count;
  if (invCount === 0) {
    const now = Date.now();
    const defaultInventory = legacyData?.inventory?.length ? legacyData.inventory : [
      { id: 1, name: 'Gloves (box)', qty: 15, min: 5, unit: 'box' },
      { id: 2, name: 'Anaesthetic cartridges', qty: 25, min: 6, unit: 'cartridges' },
      { id: 3, name: 'Composite resin', qty: 10, min: 4, unit: 'tubes' },
      { id: 4, name: 'Dental floss packs', qty: 30, min: 10, unit: 'packs' },
      { id: 5, name: 'Sterile Dental Bibs', qty: 85, min: 20, unit: 'pieces' },
      { id: 6, name: 'Suction Tips (disposable)', qty: 70, min: 25, unit: 'pieces' }
    ];

    for (const item of defaultInventory) {
      db.prepare(`
        INSERT OR IGNORE INTO inventory (id, name, qty, minQty, unit, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(item.id, item.name, item.qty, item.min || item.minQty || 5, item.unit || 'units', now, now);
    }
  }

  // 5. Service Supplies (Bill of Materials per Service)
  const suppliesCount = db.prepare('SELECT count(*) as count FROM service_supplies').get().count;
  if (suppliesCount === 0) {
    // Look up inventory IDs
    const items = db.prepare('SELECT id, name FROM inventory').all();
    const itemMap = Object.fromEntries(items.map(i => [i.name, i.id]));

    const bom = [
      // Checkup
      { service: 'Checkup', item: 'Gloves (box)', qty: 0.2 },
      { service: 'Checkup', item: 'Sterile Dental Bibs', qty: 1.0 },
      { service: 'Checkup', item: 'Suction Tips (disposable)', qty: 1.0 },
      // Cleaning
      { service: 'Cleaning', item: 'Gloves (box)', qty: 0.2 },
      { service: 'Cleaning', item: 'Sterile Dental Bibs', qty: 1.0 },
      { service: 'Cleaning', item: 'Suction Tips (disposable)', qty: 1.0 },
      { service: 'Cleaning', item: 'Dental floss packs', qty: 0.1 },
      // Filling
      { service: 'Filling', item: 'Gloves (box)', qty: 0.2 },
      { service: 'Filling', item: 'Sterile Dental Bibs', qty: 1.0 },
      { service: 'Filling', item: 'Suction Tips (disposable)', qty: 1.0 },
      { service: 'Filling', item: 'Anaesthetic cartridges', qty: 1.0 },
      { service: 'Filling', item: 'Composite resin', qty: 0.25 },
      // Root canal
      { service: 'Root canal', item: 'Gloves (box)', qty: 0.3 },
      { service: 'Root canal', item: 'Sterile Dental Bibs', qty: 1.0 },
      { service: 'Root canal', item: 'Suction Tips (disposable)', qty: 2.0 },
      { service: 'Root canal', item: 'Anaesthetic cartridges', qty: 2.0 },
      { service: 'Root canal', item: 'Composite resin', qty: 0.2 },
      // Whitening
      { service: 'Whitening', item: 'Gloves (box)', qty: 0.2 },
      { service: 'Whitening', item: 'Sterile Dental Bibs', qty: 1.0 },
      { service: 'Whitening', item: 'Suction Tips (disposable)', qty: 1.0 },
      // Ortho review
      { service: 'Ortho review', item: 'Gloves (box)', qty: 0.2 },
      { service: 'Ortho review', item: 'Sterile Dental Bibs', qty: 1.0 },
      { service: 'Ortho review', item: 'Suction Tips (disposable)', qty: 1.0 },
      // Consultation
      { service: 'Consultation', item: 'Gloves (box)', qty: 0.2 },
      { service: 'Consultation', item: 'Sterile Dental Bibs', qty: 1.0 }
    ];

    for (const b of bom) {
      const invId = itemMap[b.item];
      if (invId) {
        db.prepare(`
          INSERT OR IGNORE INTO service_supplies (service, inventoryId, qtyPerService)
          VALUES (?, ?, ?)
        `).run(b.service, invId, b.qty);
      }
    }
  }

  // 6. Migrate patients from legacy JSON if table is empty
  const ptCount = db.prepare('SELECT count(*) as count FROM patients').get().count;
  if (ptCount === 0 && legacyData?.patients?.length) {
    const now = Date.now();
    for (const p of legacyData.patients) {
      db.prepare(`
        INSERT OR IGNORE INTO patients (
          id, name, phone, age, gender, medicalHistory, allergies,
          lastVisit, lastService, notes, recallDays, recalledAt, recallCount,
          consentGivenAt, consentSource, optOut, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, ?, ?, 'Initial Import', 0, ?, ?)
      `).run(
        p.id,
        p.name,
        p.phone || '',
        p.age || null,
        p.gender || 'Other',
        p.lastVisit || null,
        p.lastService || 'Checkup',
        p.notes || '',
        p.recallDays || 180,
        p.recalledAt || null,
        p.recallCount || 0,
        p.createdAt || now,
        p.createdAt || now,
        now
      );
    }
    console.log(`[Seed] Migrated ${legacyData.patients.length} patients from db.json`);
  }

  // 7. Migrate appointments from legacy JSON if table is empty
  const apptCount = db.prepare('SELECT count(*) as count FROM appointments').get().count;
  if (apptCount === 0 && legacyData?.appointments?.length) {
    const now = Date.now();
    for (const a of legacyData.appointments) {
      db.prepare(`
        INSERT OR IGNORE INTO appointments (
          id, patientId, doctorId, chair, date, time, duration,
          service, notes, status, source, reminded, stockDeducted, invoiceId,
          createdAt, updatedAt
        ) VALUES (?, ?, 'Dr. Raj', 'Chair 1', ?, ?, 60, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
      `).run(
        a.id,
        a.patientId,
        a.date,
        a.time,
        a.service || 'Checkup',
        a.notes || '',
        a.status || 'Booked',
        a.source || 'Manual',
        a.reminded ? 1 : 0,
        a.status === 'Completed' ? 1 : 0,
        a.at || now,
        now
      );
    }
    console.log(`[Seed] Migrated ${legacyData.appointments.length} appointments from db.json`);
  }

  // 8. Migrate invoices from legacy JSON if table is empty
  const invCountDb = db.prepare('SELECT count(*) as count FROM invoices').get().count;
  if (invCountDb === 0 && legacyData?.invoices?.length) {
    const now = Date.now();
    for (const inv of legacyData.invoices) {
      const invNum = `INV-${new Date(inv.at || now).getFullYear()}-${String(inv.id).padStart(4, '0')}`;
      db.prepare(`
        INSERT OR IGNORE INTO invoices (
          id, invoiceNumber, appointmentId, patientId, service,
          amount, discount, taxRate, taxAmount, totalAmount, paid, paidAt, method, notes,
          createdAt, updatedAt
        ) VALUES (?, ?, NULL, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        inv.id,
        invNum,
        inv.patientId,
        inv.service || 'Consultation',
        inv.amount || 0,
        inv.amount || 0,
        inv.paid ? 1 : 0,
        inv.paid ? (inv.paidAt || inv.at || now) : null,
        inv.method || (inv.paid ? 'Cash' : 'Pending'),
        inv.notes || '',
        inv.at || now,
        now
      );
    }
    console.log(`[Seed] Migrated ${legacyData.invoices.length} invoices from db.json`);
  }

  // 9. Migrate leads from legacy JSON if table is empty
  const leadCountDb = db.prepare('SELECT count(*) as count FROM leads').get().count;
  if (leadCountDb === 0 && legacyData?.leads?.length) {
    const now = Date.now();
    for (const l of legacyData.leads) {
      db.prepare(`
        INSERT OR IGNORE INTO leads (
          id, name, phone, source, cost, status, aiStage, clinicalIssue,
          urgency, followupCount, lastFollowupAt, patientId, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Routine', ?, ?, ?, ?, ?)
      `).run(
        l.id,
        l.name,
        l.phone || '',
        l.source || 'Manual',
        l.cost || 0,
        l.status || 'New',
        l.aiStage || 'NEW',
        l.clinicalIssue || '',
        l.followupCount || 0,
        l.lastFollowupAt || null,
        l.patientId || null,
        l.at || now,
        now
      );
    }
  }

  // 10. Migrate chats from legacy JSON if table is empty
  const chatCountDb = db.prepare('SELECT count(*) as count FROM chats').get().count;
  if (chatCountDb === 0 && legacyData?.chats) {
    for (const [phone, msgs] of Object.entries(legacyData.chats)) {
      if (Array.isArray(msgs)) {
        for (const m of msgs) {
          db.prepare(`
            INSERT OR IGNORE INTO chats (phone, sender, message, status, createdAt)
            VALUES (?, ?, ?, 'sent', ?)
          `).run(phone, m.f === 'bot' ? 'bot' : 'pt', m.t || '', m.at || Date.now());
        }
      }
    }
  }
}

seedDefaults();

// Clean shutdown handler
function closeDatabase() {
  try {
    backupDatabase();
    db.close();
    console.log('[SQLite] Database closed safely.');
  } catch {}
}

process.once('SIGINT', () => { closeDatabase(); process.exit(0); });
process.once('SIGTERM', () => { closeDatabase(); process.exit(0); });
process.once('beforeExit', () => { closeDatabase(); });

module.exports = {
  db,
  backupDatabase,
  getSetting(k, fallback = null) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
    return row ? row.value : fallback;
  },
  setSetting(k, v) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(k, String(v));
  },
  getAllSettings() {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const result = {};
    for (const r of rows) {
      try {
        result[r.key] = JSON.parse(r.value);
      } catch {
        result[r.key] = r.value;
      }
    }
    return result;
  },
  getAllPrices() {
    const rows = db.prepare('SELECT service, price FROM prices').all();
    return Object.fromEntries(rows.map(r => [r.service, r.price]));
  },
  setPrice(service, price) {
    db.prepare('INSERT OR REPLACE INTO prices (service, price) VALUES (?, ?)').run(service, +price);
  },
  audit({ userId, username, action, entity, entityId, details, ip }) {
    db.prepare(`
      INSERT INTO audit_logs (timestamp, userId, username, action, entity, entityId, details, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Date.now(),
      userId || null,
      username || 'system',
      action,
      entity,
      entityId ? String(entityId) : null,
      typeof details === 'object' ? JSON.stringify(details) : (details || null),
      ip || null
    );
  }
};

const { test, describe } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const core = require('../core');
const leads = require('../leads');
const { db } = require('../db');

describe('Database Integrity & Correctness Tests (P1)', () => {

  test('Appointments do not produce duplicate invoices or double stock deductions on toggling', () => {
    // 1. Create a fresh test patient
    const ptPhone = '99999' + Math.floor(10000 + Math.random() * 90000);
    const patient = core.ensurePatient(ptPhone, 'Test Integrity Patient');

    // 2. Book appointment
    const appt = core.book(patient.id, { date: '2026-11-25', time: '14:00', service: 'Cleaning' }, 'Test Runner');
    assert.ok(appt);

    // Initial anaesthetic quantity
    const anaestheticItem = db.prepare("SELECT * FROM inventory WHERE name LIKE 'Anaesthetic%'").get();
    const bibItem = db.prepare("SELECT * FROM inventory WHERE name LIKE 'Sterile Dental Bibs%'").get();
    const initialAnaestheticQty = anaestheticItem.qty;
    const initialBibQty = bibItem.qty;

    // 3. Mark appointment Completed
    const completed1 = core.completeAppointment(appt.id);
    assert.strictEqual(completed1.status, 'Completed');
    assert.strictEqual(completed1.stockDeducted, 1);
    assert.ok(completed1.invoiceId);

    // Count invoices for this appointment
    const invoicesCount1 = db.prepare('SELECT count(*) as count FROM invoices WHERE appointmentId = ?').get(appt.id).count;
    assert.strictEqual(invoicesCount1, 1, 'Exactly one invoice must be raised');

    // Check inventory: Cleaning should NOT deduct Anaesthetic cartridges!
    const postCleaningAnaesthetic = db.prepare("SELECT qty FROM inventory WHERE id = ?").get(anaestheticItem.id).qty;
    assert.strictEqual(postCleaningAnaesthetic, initialAnaestheticQty, 'Cleaning must NOT deduct anaesthetic cartridges!');

    const postCleaningBib = db.prepare("SELECT qty FROM inventory WHERE id = ?").get(bibItem.id).qty;
    assert.ok(postCleaningBib < initialBibQty, 'Cleaning must deduct dental bibs');

    // 4. Toggle status to Booked and then Completed again
    db.prepare("UPDATE appointments SET status = 'Booked' WHERE id = ?").run(appt.id);
    const completed2 = core.completeAppointment(appt.id);

    // Verify no second invoice was raised
    const invoicesCount2 = db.prepare('SELECT count(*) as count FROM invoices WHERE appointmentId = ?').get(appt.id).count;
    assert.strictEqual(invoicesCount2, 1, 'Toggling status must not create a duplicate invoice');

    // Verify inventory was not deducted twice
    const postToggleBib = db.prepare("SELECT qty FROM inventory WHERE id = ?").get(bibItem.id).qty;
    assert.strictEqual(postToggleBib, postCleaningBib, 'Toggling status must not deduct inventory twice');
  });

  test('Per-service Bill of Materials: Root Canal deducts anaesthetic, Cleaning does not', () => {
    const cleaningSupplies = db.prepare("SELECT * FROM service_supplies WHERE service = 'Cleaning'").all();
    const rootCanalSupplies = db.prepare("SELECT * FROM service_supplies WHERE service = 'Root canal'").all();
    const anaestheticId = db.prepare("SELECT id FROM inventory WHERE name LIKE 'Anaesthetic%'").get().id;

    const cleaningUsesAnaesthetic = cleaningSupplies.some(s => s.inventoryId === anaestheticId);
    const rootCanalUsesAnaesthetic = rootCanalSupplies.some(s => s.inventoryId === anaestheticId);

    assert.strictEqual(cleaningUsesAnaesthetic, false, 'Cleaning procedure must not consume anaesthetic');
    assert.strictEqual(rootCanalUsesAnaesthetic, true, 'Root canal procedure must consume anaesthetic');
  });

  test('Adding a lead does NOT prematurely create a patient record', () => {
    const leadPhone = '88888' + Math.floor(10000 + Math.random() * 90000);
    const newLead = core.addLead({ name: 'Prospect Lead', phone: leadPhone, source: 'Meta Ads' });
    assert.ok(newLead);

    // Check patients table
    const patientRow = core.patientByPhone(leadPhone);
    assert.strictEqual(patientRow, null, 'Leads must not be inserted into patients table upon creation');
  });

  test('Google Sheet poller tracks row hashes to prevent re-importing deleted leads', async () => {
    const testName = 'Deleted Sheet Lead ' + Date.now();
    const testPhone = '77777' + Math.floor(10000 + Math.random() * 90000);
    const csvRow = `name,phone,source\n${testName},${testPhone},Sheet\n`;

    // 1. First import
    const importedCount1 = await leads.importCSV(csvRow, 'Sheet');
    assert.strictEqual(importedCount1, 1, 'First import should ingest the lead');

    // 2. Staff deletes the lead
    const lead = core.leadByPhone(testPhone);
    assert.ok(lead);
    db.prepare("UPDATE leads SET deletedAt = ? WHERE id = ?").run(Date.now(), lead.id);

    // 3. Second import (simulating periodic 10-minute cron)
    const importedCount2 = await leads.importCSV(csvRow, 'Sheet');
    assert.strictEqual(importedCount2, 0, 'Re-polling sheet must NOT resurrect deleted leads');
  });
});

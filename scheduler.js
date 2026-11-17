const cron = require('node-cron');
const { db, getSetting } = require('./db');
const core = require('./core');
const wa = require('./wa');
const leads = require('./leads');
const ai = require('./ai');
const bot = require('./bot');

const tz = { timezone: process.env.TZ || getSetting('timezone', 'Asia/Kolkata') };

// Automation state in memory with DB fallback
const statusState = {
  recall: { lastRun: null, lastResult: 'Waiting for scheduled run', totalSent: 0 },
  reminders: { lastRun: null, lastResult: 'Waiting for scheduled run', totalSent: 0 },
  noShows: { lastRun: null, lastResult: 'Waiting for scheduled run', totalSent: 0 },
  pollSheet: { lastRun: null, lastResult: 'Waiting for scheduled run', totalSent: 0 },
  leadFollowup: { lastRun: null, lastResult: 'Waiting for scheduled run', totalProcessed: 0 }
};

const automationLogs = [];

function logAutomation(task, msg) {
  automationLogs.unshift({
    task,
    msg,
    at: Date.now()
  });
  if (automationLogs.length > 50) automationLogs.length = 50;
}

/**
 * 1. Automatic Patient Recall (Runs daily at 10:00 AM)
 * Sends exactly ONE message per overdue patient (template or text, never duplicate!)
 */
async function runRecall(thresholdDays) {
  const due = core.dueForRecall(thresholdDays);
  const sentList = [];

  for (const p of due) {
    try {
      await core.recall(p);
      sentList.push(p.name);
    } catch (err) {
      console.error('Error recalling patient', p.name, err);
    }
  }

  const resultMsg = sentList.length
    ? `Sent automated recall reminders to ${sentList.length} patient(s): ${sentList.join(', ')}`
    : `Scanned patients: No patients currently due for recall (${due.length} scanned)`;

  statusState.recall = {
    lastRun: Date.now(),
    lastResult: resultMsg,
    totalSent: (statusState.recall?.totalSent || 0) + sentList.length
  };
  logAutomation('recall', resultMsg);

  if (sentList.length) {
    core.notify(`🔔 Automated Recall: Contacted ${sentList.length} patient(s) due for checkup`);
  }
  return { sent: sentList.length, patients: sentList, message: resultMsg };
}

/**
 * 2. Automatic 24-Hour Appointment Reminders (Runs every hour)
 * Checks booked appointments in the next 24 hours that haven't been reminded.
 * Sends ONLY ONE message per reminder (template if available/required, or text. Never both!).
 */
async function reminders() {
  const now = Date.now();
  const remindedList = [];

  const appts = db.prepare(`
    SELECT * FROM appointments
    WHERE status = 'Booked' AND reminded = 0 AND deletedAt IS NULL
  `).all();

  for (const a of appts) {
    const t = new Date(a.date + 'T' + a.time).getTime();
    if (t > now && (t - now) <= 864e5) {
      const p = db.prepare('SELECT * FROM patients WHERE id = ? AND deletedAt IS NULL').get(a.patientId);
      if (!p || p.optOut) continue;

      db.prepare('UPDATE appointments SET reminded = 1, updatedAt = ? WHERE id = ?').run(now, a.id);
      const firstName = (p.name || 'there').split(' ')[0];
      const clinicName = getSetting('clinicName', 'DentaDesk Dental Care');

      const isLive = wa.on();
      const within24h = wa.isWithin24HourWindow(p.phone);
      const reminderTemplate = process.env.WA_REMINDER_TEMPLATE || 'appointment_reminder';

      if (isLive && !within24h && reminderTemplate) {
        // Send single template
        await wa.template(p.phone, reminderTemplate, [firstName, core.lab(a.date), a.time, clinicName]).catch(console.error);
      } else {
        // Send single text
        await wa.text(
          p.phone,
          `Hi ${firstName}! 🦷 Reminder: Your dental appointment at ${clinicName} is on ${core.lab(a.date)} at ${a.time}. Reply CANCEL or RESCHEDULE if your plans change. See you soon!`
        ).catch(console.error);
      }

      remindedList.push(`${p.name} (${core.lab(a.date)} ${a.time})`);
    }
  }

  const resultMsg = remindedList.length
    ? `Dispatched 24h reminders to ${remindedList.length} appointment(s): ${remindedList.join(', ')}`
    : 'Checked upcoming schedule: No appointments requiring 24h reminders right now';

  statusState.reminders = {
    lastRun: Date.now(),
    lastResult: resultMsg,
    totalSent: (statusState.reminders?.totalSent || 0) + remindedList.length
  };
  logAutomation('reminders', resultMsg);

  return { remindedCount: remindedList.length, remindedList, message: resultMsg };
}

/**
 * 3. Automatic Missed Visit / No-Show Follow-up (Runs daily at 21:30)
 * Evaluates today's visits (date === today) that were not completed or cancelled,
 * marks them No-show, alerts clinic desk, and sends timely re-booking message with correct date wording.
 */
async function noShows() {
  const todayStr = core.K(new Date());
  const now = Date.now();
  const noShowList = [];

  // 1. Check appointments scheduled for TODAY that were left Booked
  const todayMissed = db.prepare(`
    SELECT * FROM appointments
    WHERE status = 'Booked' AND date = ? AND deletedAt IS NULL
  `).all(todayStr);

  for (const a of todayMissed) {
    db.prepare(`UPDATE appointments SET status = 'No-show', updatedAt = ? WHERE id = ?`).run(now, a.id);
    const p = db.prepare('SELECT * FROM patients WHERE id = ?').get(a.patientId);

    if (p && !p.optOut) {
      noShowList.push(`${p.name} (Today ${a.time})`);
      core.notify(`🚨 Auto No-Show: ${p.name} missed visit today at ${a.time}`);
      const firstName = (p.name || 'there').split(' ')[0];
      await wa.text(
        p.phone,
        `Hi ${firstName}, we missed you today at your scheduled dental visit. Your oral health is important to us—reply BOOK anytime to pick a convenient new slot! 🦷`
      ).catch(console.error);
    }
  }

  // 2. Also catch any past unclosed appointments with accurate wording
  const pastMissed = db.prepare(`
    SELECT * FROM appointments
    WHERE status = 'Booked' AND date < ? AND deletedAt IS NULL
  `).all(todayStr);

  for (const a of pastMissed) {
    db.prepare(`UPDATE appointments SET status = 'No-show', updatedAt = ? WHERE id = ?`).run(now, a.id);
    const p = db.prepare('SELECT * FROM patients WHERE id = ?').get(a.patientId);
    if (p && !p.optOut) {
      noShowList.push(`${p.name} (${core.lab(a.date)} ${a.time})`);
      const firstName = (p.name || 'there').split(' ')[0];
      await wa.text(
        p.phone,
        `Hi ${firstName}, we missed your dental visit on ${core.lab(a.date)}. Reply BOOK anytime to reschedule a convenient time with our clinic! 🦷`
      ).catch(console.error);
    }
  }

  const resultMsg = noShowList.length
    ? `Flagged ${noShowList.length} missed visit(s) and sent re-booking messages: ${noShowList.join(', ')}`
    : 'Checked daily schedule: No missed appointments detected today';

  statusState.noShows = {
    lastRun: Date.now(),
    lastResult: resultMsg,
    totalSent: (statusState.noShows?.totalSent || 0) + noShowList.length
  };
  logAutomation('noShows', resultMsg);

  return { noShowCount: noShowList.length, noShowList, message: resultMsg };
}

/**
 * 4. Automatic Google Sheet Lead Polling (Runs every 10 minutes)
 */
async function pollSheetAuto() {
  const count = await leads.pollSheet();
  const resultMsg = count > 0
    ? `Polled Google Sheet: Ingested ${count} new lead(s) with automated outreach`
    : 'Polled Google Sheet: No new rows found';

  statusState.pollSheet = {
    lastRun: Date.now(),
    lastResult: resultMsg,
    totalSent: (statusState.pollSheet?.totalSent || 0) + count
  };
  logAutomation('pollSheet', resultMsg);
  return { count, message: resultMsg };
}

/**
 * 5. Autonomous Lead Follow-up Agent (Runs every 3 hours or on-demand)
 */
async function runLeadFollowupAgent(force = false) {
  const now = Date.now();
  const cooldownMs = force ? 0 : 3 * 3600 * 1000;
  const clinicName = getSetting('clinicName', 'DentaDesk Dental Care');
  const doctorName = getSetting('doctorName', 'Dr. Raj');

  const eligibleLeads = db.prepare(`
    SELECT * FROM leads
    WHERE status NOT IN ('Booked', 'Won', 'Lost')
      AND aiStage NOT IN ('BOOKED', 'PAUSED')
      AND followupCount < 4
      AND deletedAt IS NULL
  `).all().filter(l => {
    if (l.lastFollowupAt && (now - l.lastFollowupAt) < cooldownMs) return false;
    return true;
  });

  const processed = [];
  for (const l of eligibleLeads) {
    try {
      if (!l.aiStage || l.aiStage === 'NEW') {
        await core.engage(l);
        processed.push({ name: l.name, phone: l.phone, stage: 'INQUIRY_SENT' });
        continue;
      }

      const msg = ai.generateAutonomousLeadFollowup(l, clinicName, doctorName);
      await wa.text(l.phone, msg);

      const newCount = (l.followupCount || 0) + 1;
      const newStage = newCount >= 4 ? 'PAUSED' : l.aiStage;

      db.prepare(`
        UPDATE leads SET followupCount = ?, aiStage = ?, lastFollowupAt = ?, updatedAt = ?
        WHERE id = ?
      `).run(newCount, newStage, now, now, l.id);

      if (l.aiStage === 'SLOTS_OFFERED') {
        await bot.offer(l.phone, 0);
      }

      processed.push({ name: l.name, phone: l.phone, stage: newStage, count: newCount });
    } catch (err) {
      console.error('Error running autonomous lead followup on', l.name, err);
    }
  }

  const resultMsg = processed.length
    ? `Autonomous Lead Agent followed up with ${processed.length} prospective lead(s)`
    : 'Scanned leads: All active leads are either booked, on cooldown, or fully nurtured';

  statusState.leadFollowup = {
    lastRun: Date.now(),
    lastResult: resultMsg,
    totalProcessed: (statusState.leadFollowup?.totalProcessed || 0) + processed.length
  };
  logAutomation('leadFollowup', resultMsg);

  if (processed.length) {
    core.notify(`🤖 Autonomous Lead Agent dispatched follow-ups to ${processed.length} prospective lead(s)`);
  }

  return { processedCount: processed.length, processed, message: resultMsg };
}

function getStatus() {
  return {
    timezone: tz.timezone,
    currentTime: new Date().toLocaleString('en-IN', { timeZone: tz.timezone }),
    tasks: {
      leadFollowup: {
        id: 'leadFollowup',
        title: 'Autonomous Lead Care Outreach & Nurturing',
        cronSchedule: 'Every 3 hours (0 */3 * * *)',
        description: 'Conducts initial care inquiries and provides polite appointment scheduling follow-ups.',
        lastRun: statusState.leadFollowup.lastRun,
        lastResult: statusState.leadFollowup.lastResult,
        totalProcessed: statusState.leadFollowup.totalProcessed
      },
      recall: {
        id: 'recall',
        title: 'Automated 6-Month Hygiene Recalls',
        cronSchedule: 'Daily at 10:00 AM (0 10 * * *)',
        description: 'Notifies overdue hygiene patients for routine checkup with a single template or message.',
        lastRun: statusState.recall.lastRun,
        lastResult: statusState.recall.lastResult,
        totalSent: statusState.recall.totalSent
      },
      reminders: {
        id: 'reminders',
        title: '24-Hour Visit Reminders',
        cronSchedule: 'Hourly on the hour (0 * * * *)',
        description: 'Dispatches single 24-hour visit reminders for booked appointments with easy cancellation confirmations.',
        lastRun: statusState.reminders.lastRun,
        lastResult: statusState.reminders.lastResult,
        totalSent: statusState.reminders.totalSent
      },
      noShows: {
        id: 'noShows',
        title: 'Missed Appointment Re-engagement',
        cronSchedule: 'Daily at 9:30 PM (30 21 * * *)',
        description: 'Flags today’s missed visits at 21:30 and reaches out to help the patient rebook.',
        lastRun: statusState.noShows.lastRun,
        lastResult: statusState.noShows.lastResult,
        totalSent: statusState.noShows.totalSent
      },
      pollSheet: {
        id: 'pollSheet',
        title: 'Google Sheet Lead Sync & Auto-Engage',
        cronSchedule: 'Every 10 minutes (*/10 * * * *)',
        description: 'Imports new leads from published spreadsheets and prevents re-importing deleted records.',
        lastRun: statusState.pollSheet.lastRun,
        lastResult: statusState.pollSheet.lastResult,
        totalSent: statusState.pollSheet.totalSent
      }
    },
    recentLogs: automationLogs.slice(0, 15)
  };
}

module.exports = {
  runRecall,
  reminders,
  noShows,
  pollSheetAuto,
  runLeadFollowupAgent,
  getStatus,
  start() {
    console.log(`[Scheduler] Starting cron jobs in timezone: ${tz.timezone}`);
    cron.schedule('0 10 * * *', () => runRecall(), tz);
    cron.schedule('0 * * * *', reminders, tz);
    cron.schedule('30 21 * * *', noShows, tz);
    cron.schedule('*/10 * * * *', pollSheetAuto, tz);
    cron.schedule('0 */3 * * *', () => runLeadFollowupAgent(), tz);
  }
};

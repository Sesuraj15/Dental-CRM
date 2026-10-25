const cron=require('node-cron'),{d,save}=require('./db'),core=require('./core'),wa=require('./wa'),leads=require('./leads'),ai=require('./ai'),bot=require('./bot');

const tz={timezone:process.env.TZ||'Asia/Kolkata'};

// In-memory & DB automation monitor
if(!d.automationStatus){
  d.automationStatus={
    recall:{lastRun:null,lastResult:'Pending first run',totalSent:0},
    reminders:{lastRun:null,lastResult:'Pending first run',totalSent:0},
    noShows:{lastRun:null,lastResult:'Pending first run',totalSent:0},
    pollSheet:{lastRun:null,lastResult:'Pending first run',totalSent:0},
    leadFollowup:{lastRun:null,lastResult:'Pending first run',totalProcessed:0}
  };
}
if(!d.automationLogs) d.automationLogs=[];

function logAutomation(task,msg){
  d.automationLogs.unshift({
    task,
    msg,
    at:Date.now()
  });
  if(d.automationLogs.length>50) d.automationLogs.length=50;
  save();
}

/**
 * 1. Automatic Patient Recall (Runs daily at 10:00 AM)
 * Finds patients whose last visit was >= recallDays ago, who have no future booked visits,
 * and who haven't been recalled in the last 21 days.
 */
async function runRecall(thresholdDays){
  const due=core.dueForRecall(thresholdDays);
  const sentList=[];
  for(const p of due){
    try{
      await core.recall(p);
      sentList.push(p.name);
    }catch(err){
      console.error('Error recalling patient',p.name,err);
    }
  }

  const resultMsg=sentList.length
    ? `Sent automated recalls to ${sentList.length} patient(s): ${sentList.join(', ')}`
    : `No patients currently due for recall (${due.length} scanned)`;

  d.automationStatus.recall={
    lastRun:Date.now(),
    lastResult:resultMsg,
    totalSent:(d.automationStatus.recall?.totalSent||0)+sentList.length
  };
  logAutomation('recall',resultMsg);

  if(sentList.length){
    core.notify(`🔔 Automated Recall: Contacted ${sentList.length} patient(s) due for checkup`);
  }
  return {sent:sentList.length,patients:sentList,message:resultMsg};
}

/**
 * 2. Automatic 24-Hour Appointment Reminders (Runs every hour)
 * Checks booked appointments in the next 24 hours that haven't been reminded yet.
 */
async function reminders(){
  const now=Date.now();
  const remindedList=[];
  for(const a of d.appointments){
    if(a.status!=='Booked'||a.reminded)continue;
    const t=new Date(a.date+'T'+a.time).getTime();
    if(t>now&&t-now<=864e5){
      const p=d.patients.find(x=>x.id===a.patientId);
      if(!p)continue;
      a.reminded=true;
      save();
      const firstName=(p.name||'there').split(' ')[0];
      await wa.template(p.phone,process.env.WA_REMINDER_TEMPLATE||'appointment_reminder',[firstName,core.lab(a.date),a.time]).catch(console.error);
      await wa.text(p.phone,`Hi ${firstName}! 🦷 Reminder: Your dental appointment is on ${core.lab(a.date)} at ${a.time}. Reply CANCEL or RESCHEDULE if you need to adjust. See you soon!`).catch(console.error);
      remindedList.push(`${p.name} (${core.lab(a.date)} ${a.time})`);
    }
  }

  const resultMsg=remindedList.length
    ? `Dispatched 24h reminders to ${remindedList.length} patient(s): ${remindedList.join(', ')}`
    : 'Checked upcoming schedule: No appointments requiring 24h reminders right now';

  d.automationStatus.reminders={
    lastRun:Date.now(),
    lastResult:resultMsg,
    totalSent:(d.automationStatus.reminders?.totalSent||0)+remindedList.length
  };
  logAutomation('reminders',resultMsg);

  return {remindedCount:remindedList.length,remindedList,message:resultMsg};
}

/**
 * 3. Automatic Missed Visit / No-Show Follow-up (Runs daily at 21:30)
 * Finds appointments with date < today that were never completed or cancelled,
 * marks them No-show, alerts the clinic, and automatically messages the patient.
 */
async function noShows(){
  const t=core.K(new Date());
  const noShowList=[];
  for(const a of d.appointments){
    if(a.status==='Booked'&&a.date<t){
      a.status='No-show';
      save();
      const p=d.patients.find(x=>x.id===a.patientId);
      if(p){
        noShowList.push(`${p.name} (${core.lab(a.date)} ${a.time})`);
        core.notify(`🚨 Auto No-Show: ${p.name} missed visit on ${core.lab(a.date)} at ${a.time}`);
        const firstName=(p.name||'there').split(' ')[0];
        await wa.text(p.phone,`Hi ${firstName}, we missed you today at your scheduled dental visit. Your oral health is important to us—reply BOOK anytime to pick a convenient new slot! 🦷`).catch(console.error);
      }
    }
  }

  const resultMsg=noShowList.length
    ? `Flagged ${noShowList.length} missed visit(s) and sent re-booking messages: ${noShowList.join(', ')}`
    : 'No missed appointments detected today';

  d.automationStatus.noShows={
    lastRun:Date.now(),
    lastResult:resultMsg,
    totalSent:(d.automationStatus.noShows?.totalSent||0)+noShowList.length
  };
  logAutomation('noShows',resultMsg);

  return {noShowCount:noShowList.length,noShowList,message:resultMsg};
}

/**
 * 4. Automatic Google Sheet Lead Polling (Runs every 10 minutes)
 */
async function pollSheetAuto(){
  const count=await leads.pollSheet();
  const resultMsg=count>0
    ? `Polled Google Sheet: Ingested ${count} new lead(s) with automated WhatsApp engagement`
    : 'Polled Google Sheet: No new rows found';

  d.automationStatus.pollSheet={
    lastRun:Date.now(),
    lastResult:resultMsg,
    totalSent:(d.automationStatus.pollSheet?.totalSent||0)+count
  };
  logAutomation('pollSheet',resultMsg);
  return {count,message:resultMsg};
}

/**
 * 5. Autonomous AI Lead Follow-up & Triage Agent (Runs every 3 hours or on-demand)
 * Follows up with all unbooked leads without requiring human staff.
 * Inquires about tooth concerns, categorizes clinical issues, and follows up until booking is completed.
 */
async function runLeadFollowupAgent(force = false){
  const now = Date.now();
  const cooldownMs = force ? 0 : 3 * 3600 * 1000; // 3 hours cooldown between autonomous touches
  const clinicName = d.settings?.clinicName || 'DentaDesk Dental Care';

  const eligibleLeads = (d.leads || []).filter(l => {
    // Only unbooked leads
    if (['Booked', 'Won', 'Lost'].includes(l.status)) return false;
    if (l.aiStage === 'BOOKED' || l.aiStage === 'PAUSED') return false;
    // Max 4 followups
    if ((l.followupCount || 0) >= 4) return false;
    // Check cooldown
    if (l.lastFollowupAt && (now - l.lastFollowupAt < cooldownMs)) return false;
    return true;
  });

  const processed = [];
  for (const l of eligibleLeads) {
    try {
      const p = core.contact(l.phone, l.name, l.source);

      if (!l.aiStage || l.aiStage === 'NEW') {
        // Step 1: Dispatch diagnostic inquiry
        await core.engage(l);
        processed.push({ name: l.name, phone: l.phone, stage: 'INQUIRY_SENT' });
        continue;
      }

      // Generate context-aware follow-up
      const msg = ai.generateAutonomousLeadFollowup(l, clinicName);
      await wa.text(p.phone, msg);

      l.followupCount = (l.followupCount || 0) + 1;
      l.lastFollowupAt = Date.now();
      if (l.followupCount >= 4) {
        l.aiStage = 'PAUSED';
      }
      save();

      // If slots were already offered, present them directly
      if (l.aiStage === 'SLOTS_OFFERED') {
        await bot.offer(p.phone, 0);
      }

      processed.push({ name: l.name, phone: l.phone, stage: l.aiStage, count: l.followupCount });
    } catch (err) {
      console.error('Error running autonomous lead followup on', l.name, err);
    }
  }

  const resultMsg = processed.length
    ? `Autonomous Lead Agent followed up with ${processed.length} prospective lead(s)`
    : `Scanned ${d.leads?.length || 0} leads: All leads are either booked, on cooldown, or fully nurtured`;

  d.automationStatus.leadFollowup = {
    lastRun: Date.now(),
    lastResult: resultMsg,
    totalProcessed: (d.automationStatus.leadFollowup?.totalProcessed || 0) + processed.length
  };
  logAutomation('leadFollowup', resultMsg);

  if (processed.length) {
    core.notify(`🤖 Autonomous Lead Agent dispatched follow-ups to ${processed.length} prospective lead(s)`);
  }

  return { processedCount: processed.length, processed, message: resultMsg };
}

function getStatus(){
  return {
    timezone:tz.timezone,
    currentTime:new Date().toLocaleString('en-IN',{timeZone:tz.timezone}),
    tasks:{
      leadFollowup:{
        id:'leadFollowup',
        title:'Autonomous AI Lead Nurturing & Follow-up',
        cronSchedule:'Every 3 hours (0 */3 * * *)',
        description:'100% autonomous agent that asks leads about their teeth concerns, performs clinical triage, and continuously follows up until an appointment is booked.',
        lastRun:d.automationStatus?.leadFollowup?.lastRun,
        lastResult:d.automationStatus?.leadFollowup?.lastResult||'Waiting for scheduled run',
        totalProcessed:d.automationStatus?.leadFollowup?.totalProcessed||0
      },
      recall:{
        id:'recall',
        title:'Automated Patient Recalls',
        cronSchedule:'Daily at 10:00 AM (0 10 * * *)',
        description:'Scans all patient records. Overdue patients (e.g. 6 months past checkup/cleaning) automatically receive personalized WhatsApp recall invitations.',
        lastRun:d.automationStatus?.recall?.lastRun,
        lastResult:d.automationStatus?.recall?.lastResult||'Waiting for scheduled run',
        totalSent:d.automationStatus?.recall?.totalSent||0
      },
      reminders:{
        id:'reminders',
        title:'24-Hour Visit Reminders',
        cronSchedule:'Hourly on the hour (0 * * * *)',
        description:'Monitors upcoming visits and automatically sends WhatsApp reminders 24 hours prior with service details and easy CANCEL / RESCHEDULE replies.',
        lastRun:d.automationStatus?.reminders?.lastRun,
        lastResult:d.automationStatus?.reminders?.lastResult||'Waiting for scheduled run',
        totalSent:d.automationStatus?.reminders?.totalSent||0
      },
      noShows:{
        id:'noShows',
        title:'Missed Appointment Re-engagement',
        cronSchedule:'Daily at 9:30 PM (30 21 * * *)',
        description:'Flags missed appointments at the end of the day and automatically reaches out to the patient on WhatsApp to rebook.',
        lastRun:d.automationStatus?.noShows?.lastRun,
        lastResult:d.automationStatus?.noShows?.lastResult||'Waiting for scheduled run',
        totalSent:d.automationStatus?.noShows?.totalSent||0
      },
      pollSheet:{
        id:'pollSheet',
        title:'Google Sheet Lead Sync & Auto-Engage',
        cronSchedule:'Every 10 minutes (*/10 * * * *)',
        description:'Imports leads from connected spreadsheets and immediately dispatches WhatsApp welcome messages with booking links.',
        lastRun:d.automationStatus?.pollSheet?.lastRun,
        lastResult:d.automationStatus?.pollSheet?.lastResult||'Waiting for scheduled run',
        totalSent:d.automationStatus?.pollSheet?.totalSent||0
      }
    },
    recentLogs:d.automationLogs?.slice(0,15)||[]
  };
}

module.exports={
  runRecall,
  reminders,
  noShows,
  pollSheetAuto,
  runLeadFollowupAgent,
  getStatus,
  start(){
    console.log(`[Scheduler] Starting cron jobs in timezone: ${tz.timezone}`);
    cron.schedule('0 10 * * *',()=>runRecall(),tz);
    cron.schedule('0 * * * *',reminders,tz);
    cron.schedule('30 21 * * *',noShows,tz);
    cron.schedule('*/10 * * * *',pollSheetAuto,tz);
    cron.schedule('0 */3 * * *',()=>runLeadFollowupAgent(),tz);
  }
};

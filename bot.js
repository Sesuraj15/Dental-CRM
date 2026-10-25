const crypto=require('crypto'),{d,save}=require('./db'),core=require('./core'),wa=require('./wa'),ai=require('./ai');

const ST={};
const LAST_OFFERED={};

const offer=async(ph,skip=0,preamble='')=>{
  const s=core.freeSlots(3,skip);
  ST[ph]=skip;
  LAST_OFFERED[ph]=s;

  const p=core.patientByPhone(ph);
  if(p){
    p.pendingSlots=s;
    p.autoSelectedSlot=s[0]||null;
    save();
  }
  const l=d.leads?.find(x=>core.l10(x.phone)===core.l10(ph));
  if(l){
    l.pendingSlots=s;
    l.autoSelectedSlot=s[0]||null;
    l.aiStage='SLOTS_OFFERED';
    save();
  }

  if(!s.length){
    return wa.text(ph,'Sorry, no slots are open right now. Our clinic coordinator will contact you shortly to arrange a priority appointment.');
  }

  const best=s[0];
  const doctorName = (d.settings?.doctorName || 'Dr. Raj').split('&')[0].trim();
  const bestLabel = `${core.lab(best.date)} at ${best.time}`;

  let body = '';
  if(preamble){
    body += preamble + '\n\n';
  }
  body += `⚡ **Auto-Selected Priority Slot:**\n📅 **${bestLabel}** (${doctorName})\n\n`;
  body += `👉 Reply **YES** or **1** to confirm this slot instantly!\n\n`;
  body += `Or pick an alternative time:\n`;
  s.forEach((x, i) => {
    body += `• ${i + 1}️⃣ ${core.lab(x.date)} ${x.time}${i === 0 ? ' (⚡ Auto-Selected)' : ''}\n`;
  });
  body += `\n(Reply 1, 2, 3 or say "tomorrow morning", "10am", or "MORE")`;

  const buttons = [
    { id: `slot:${best.date}|${best.time}`, title: `⚡ Auto-Book ${best.time}` }
  ];
  if(s[1]){
    buttons.push({ id: `slot:${s[1].date}|${s[1].time}`, title: `📅 ${core.lab(s[1].date).split(' ')[0]} ${s[1].time}` });
  }
  if(s[2]){
    buttons.push({ id: `slot:${s[2].date}|${s[2].time}`, title: `📅 ${core.lab(s[2].date).split(' ')[0]} ${s[2].time}` });
  }

  return wa.buttons(ph, body, buttons);
};

async function handle(from,text='',btn='',name=''){
  const ph=core.norm(from);
  const p=core.contact(ph,name||'WhatsApp User','WhatsApp inbound');
  const t=(text||'').trim().toLowerCase();
  const btnId=(btn||'').trim();

  // Retrieve offered pool from memory or persistent patient/lead state, fallback to freeSlots
  const offeredPool = (LAST_OFFERED[ph] && LAST_OFFERED[ph].length)
    ? LAST_OFFERED[ph]
    : (p.pendingSlots && p.pendingSlots.length ? p.pendingSlots : core.freeSlots(10));

  const lead = d.leads?.find(x => core.l10(x.phone) === core.l10(ph));
  const isUnbookedLead = lead && lead.status !== 'Booked' && lead.status !== 'Won';
  const isLeadInquiryPhase = isUnbookedLead && (lead.aiStage === 'INQUIRY_SENT' || !lead.aiStage || lead.aiStage === 'NEW');

  // Cancel intent
  if(/\bcancel\b/.test(t)){
    const a=core.cancelUpcoming(p.id);
    return wa.text(ph,a?`Your appointment on ${core.lab(a.date)} has been cancelled. Reply BOOK anytime to schedule a fresh visit.`:'You do not have any upcoming booked appointments. Would you like to schedule one? Reply BOOK to view available slots! 🦷');
  }

  // Reschedule intent
  if(/resched/.test(t)){
    const a=core.cancelUpcoming(p.id);
    await wa.text(ph,a?`Your previous visit on ${core.lab(a.date)} was released. Let's pick a new time for your appointment:`:'Sure! Let us pick a convenient time for your appointment:');
    return offer(ph,0);
  }

  // More slots intent
  if(/\bmore\b|other\s*time|different\s*time|next/.test(t)){
    return offer(ph,(ST[ph]||0)+3);
  }

  // Cost or price inquiry
  if(/\bprice\b|\bcost\b|\bhow much\b|\brate\b|\bfees\b/.test(t)){
    await wa.text(ph,'🦷 DentaDesk Treatment Fees:\n• Consultation & Exam: ₹300-500\n• Teeth Cleaning (Scaling): ₹1,200\n• Aesthetic Filling: ₹1,500\n• Root Canal Therapy: ₹6,500\n• Laser Whitening: ₹4,000\n\nReply BOOK to pick your appointment slot!');
    return offer(ph,0);
  }

  // 1. Check if patient is answering the teeth concern inquiry
  const isMenuChoice = /^[1-5]$|^option\s*[1-5]$/i.test(t);
  const hasDentalIssueWords = /\bpain\b|\bache\b|\bswell|\bbleed|\bsever|\btoothache|\bbroken\b|\bemergency\b|\bcleaning\b|\bdecay\b|\bcavity\b|\bsensitiv|\bteeth\b|\btooth\b|\bbraces\b|\baligner\b|\bwhitening\b|\bgum\b|\bfloss\b|\bscaling\b|\bwisdom\b|\bcheckup\b|\bfilling\b|\bimplant\b|\bcrown\b/.test(t);

  if ((isLeadInquiryPhase && (isMenuChoice || hasDentalIssueWords)) || (hasDentalIssueWords && !btnId)) {
    const assessment = ai.analyzeLeadConcern(text, p.name);
    if(lead){
      lead.clinicalIssue = assessment.issueSummary;
      lead.aiStage = 'SLOTS_OFFERED';
      lead.status = 'Engaged';
      lead.lastFollowupAt = Date.now();
      save();
    }
    p.notes = (p.notes ? p.notes + ' | ' : '') + 'AI Concern: ' + assessment.issueSummary;
    save();
    core.notify(`💡 AI Lead Agent diagnosed concern for ${p.name}: ${assessment.issueSummary}`);

    // Check if the message ALSO requested a slot (e.g. "severe pain, please book tomorrow morning" or "1 book earliest")
    const instantSlot = core.findMatchingSlot(t, offeredPool);
    if(instantSlot && (/\btomorrow\b|\btoday\b|\bmorning\b|\bafternoon\b|\bearliest\b|\basap\b|\b(0?[9]|1[0-7]):00\b/i.test(t))){
      const a = core.book(p.id, { date: instantSlot.date, time: instantSlot.time }, 'WhatsApp Bot');
      if(a){
        delete LAST_OFFERED[ph];
        p.pendingSlots = [];
        p.autoSelectedSlot = null;
        save();
        return wa.text(
          ph,
          `${assessment.reply}\n\n⚡ **Auto-Booking Confirmed!**\n✅ Your dental visit has been scheduled for **${core.lab(instantSlot.date)} at ${instantSlot.time}** with DentaDesk.\nWe have notified our doctor and clinic desk. We will send you a reminder 24 hours prior. Reply CANCEL or RESCHEDULE anytime if your plans change. 🦷`
        );
      }
    }

    // Otherwise, present clinical advice + auto-selected priority slot
    await wa.text(ph, assessment.reply);
    return offer(ph, 0);
  }

  // 2. Check if input is a slot selection (Button click, "YES", "1", "2", "3", "tomorrow morning", "10am", "earliest", etc.)
  const matchedSlot = core.findMatchingSlot(btnId || t, offeredPool);
  if(matchedSlot){
    const a=core.book(p.id,{date:matchedSlot.date,time:matchedSlot.time},'WhatsApp Bot');
    if(a){
      delete LAST_OFFERED[ph];
      p.pendingSlots=[];
      p.autoSelectedSlot=null;
      save();
      return wa.text(ph,`✅ Booked! Your dental visit is scheduled for ${core.lab(matchedSlot.date)} at ${matchedSlot.time} with DentaDesk. We have notified our doctor and clinic desk. We will send you a reminder 24 hours prior. Reply CANCEL or RESCHEDULE anytime if your plans change. 🦷`);
    }
    await wa.text(ph,'Sorry, that slot was just taken! Let us find you another one.');
    return offer(ph,0);
  }

  // 3. Booking or greetings intent
  if(/book|appoint|check|\bhi\b|\bhello\b|\bhey\b/.test(t)){
    if (isLeadInquiryPhase) {
      const firstName = (p.name || 'there').split(' ')[0];
      const clinicName = d.settings?.clinicName || 'DentaDesk Dental Care';
      await wa.text(ph, `Hi ${firstName}! Welcome to ${clinicName}. 🦷\n\nI am the clinic's AI Dental Care Coordinator. To help our doctors prepare best for you, could you please tell me: What dental concern or issue are you experiencing today?\n\n• 1️⃣ Tooth pain, cavity, or sensitivity\n• 2️⃣ Routine cleaning & general checkup\n• 3️⃣ Missing tooth / Implant / Crown\n• 4️⃣ Bleeding gums or bad breath\n• 5️⃣ Teeth alignment (Aligners/Braces) or Whitening\n\n(Reply with a number or simply describe your teeth issue in your own words!)`);
      lead.aiStage = 'INQUIRY_SENT';
      lead.status = 'Contacted';
      save();
      return;
    }
    return offer(ph,0);
  }

  // Fallback
  await wa.text(ph,'Thanks for reaching out! Reply 1 or YES to book the auto-selected slot, or reply with your teeth concern to get clinical guidance. 🦷');
  core.notify(`Patient attention needed: ${p.name} wrote "${(text||'').slice(0,100)}"`);
}

function sigOk(req){
  const s=process.env.APP_SECRET;
  if(!s){
    return true; // Skip signature check in dry-run/dev if APP_SECRET is unset
  }
  const h=(req.headers['x-hub-signature-256']||'').replace('sha256=','');
  const e=crypto.createHmac('sha256',s).update(req.rawBody||'').digest('hex');
  return h.length===e.length&&crypto.timingSafeEqual(Buffer.from(h),Buffer.from(e));
}

const verify=(tok)=>(req,res)=>{
  if(req.query['hub.mode']==='subscribe'&&req.query['hub.verify_token']===tok){
    return res.send(req.query['hub.challenge']);
  }
  return res.sendStatus(403);
};

async function webhook(req,res){
  if(!sigOk(req))return res.sendStatus(401);
  res.sendStatus(200);
  try{
    for(const e of req.body.entry||[]){
      for(const c of e.changes||[]){
        const v=c.value||{};
        const nm=v.contacts?.[0]?.profile?.name;
        for(const m of v.messages||[]){
          const text=m.text?.body||m.button?.text||m.interactive?.button_reply?.title||m.interactive?.list_reply?.title||'';
          const btn=m.interactive?.button_reply?.id||m.interactive?.list_reply?.id||m.button?.payload||'';
          wa.log(core.norm(m.from),'pt',text||btn);
          await handle(m.from,text,btn,nm);
        }
      }
    }
  }catch(err){
    console.error('Webhook error',err);
  }
}

// Local simulation helper for UI WhatsApp simulator
async function simulateInbound(phone,text='',btn='',name=''){
  const ph=core.norm(phone);
  wa.log(ph,'pt',text||btn);
  await handle(ph,text,btn,name);
  return {ok:true};
}

module.exports={handle,webhook,verify,sigOk,simulateInbound};

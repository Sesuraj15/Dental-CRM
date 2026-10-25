const {d,save,id}=require('./db'),wa=require('./wa');

const pad=n=>String(n).padStart(2,'0');
const K=x=>x.getFullYear()+'-'+pad(x.getMonth()+1)+'-'+pad(x.getDate());

const lab=s=>{
  if(!s)return '–';
  try{
    const parts=String(s).split('-');
    if(parts.length===3){
      const dt=new Date(+parts[0],+parts[1]-1,+parts[2]);
      if(!isNaN(dt.getTime()))return dt.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
    }
    const d=new Date(s);
    return isNaN(d.getTime())?s:d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
  }catch{return s}
};

const norm=p=>{
  let x=String(p||'').replace(/\D/g,'');
  if(x.length===10)x=(process.env.DEFAULT_CC||'91')+x;
  return x;
};

const l10=p=>String(p||'').replace(/\D/g,'').slice(-10);

const SLOTS=(process.env.SLOTS||'09:00,10:00,11:00,12:00,14:00,15:00,16:00,17:00').split(',').map(s=>s.trim());

const taken=(date,time)=>d.appointments.some(a=>a.date===date&&a.time===time&&a.status==='Booked');

function freeSlots(n=10,skip=0,forDate=null){
  const o=[];
  const now=new Date();
  const todayStr=K(now);
  const curTimeStr=pad(now.getHours())+':'+pad(now.getMinutes());

  if(forDate){
    // Free slots for a specific date
    for(const t of SLOTS){
      if(forDate===todayStr&&t<=curTimeStr)continue;
      if(!taken(forDate,t))o.push({date:forDate,time:t});
    }
    return o.slice(skip,skip+n);
  }

  for(let i=0;i<30&&o.length<n+skip;i++){
    const x=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i);
    if(x.getDay()===0)continue; // Skip Sundays
    const dateStr=K(x);
    for(const t of SLOTS){
      if(i===0&&t<=curTimeStr)continue;
      if(!taken(dateStr,t))o.push({date:dateStr,time:t});
    }
  }
  return o.slice(skip,skip+n);
}

function findMatchingSlot(query='', candidateSlots=[]){
  const q=String(query||'').trim().toLowerCase();
  if(!q)return null;

  const pool=(candidateSlots&&candidateSlots.length)?candidateSlots:freeSlots(20);
  if(!pool.length)return null;

  // 1. Direct button token "slot:YYYY-MM-DD|HH:MM"
  const tokenMatch=q.match(/slot:([0-9]{4}-[0-9]{2}-[0-9]{2})\|([0-9]{2}:[0-9]{2})/);
  if(tokenMatch){
    const dStr=tokenMatch[1], tStr=tokenMatch[2];
    const found=pool.find(s=>s.date===dStr&&s.time===tStr);
    if(found)return found;
    if(!taken(dStr,tStr))return {date:dStr,time:tStr};
  }

  // 2. Choice by position: 1, 2, 3
  if(/^(1|slot\s*1|option\s*1|opt\s*1|first|first\s*one)$/i.test(q)&&pool[0])return pool[0];
  if(/^(2|slot\s*2|option\s*2|opt\s*2|second|second\s*one)$/i.test(q)&&pool[1])return pool[1];
  if(/^(3|slot\s*3|option\s*3|opt\s*3|third|third\s*one)$/i.test(q)&&pool[2])return pool[2];

  // 3. Auto-confirmation / Auto-selection keywords (Yes, Confirm, OK, Book it, Earliest, ASAP, Auto)
  if(/\b(yes|confirm|confirmed|ok|okay|sure|book\s*it|book\s*now|earliest|asap|urgent|auto|auto\s*book|auto\s*select|any\s*time|any\s*slot|go\s*ahead|fine|yep|yeah)\b/i.test(q)){
    return pool[0]; // Auto-selects the priority slot
  }

  // 4. Exact time specification
  let targetHour=null;
  const timeRegex=/\b(0?[9]|1[0-7]):00\b|\b(0?[9]|1[0-2])\s*(am|pm)\b|\b(1[3-7])\s*(pm)?\b/i;
  const tm=q.match(timeRegex);
  if(tm){
    if(tm[1]){
      targetHour=pad(parseInt(tm[1],10))+':00';
    }else if(tm[2]){
      let hr=parseInt(tm[2],10);
      const ampm=(tm[3]||'').toLowerCase();
      if(ampm==='pm'&&hr<12)hr+=12;
      if(ampm==='am'&&hr===12)hr=0;
      targetHour=pad(hr)+':00';
    }else if(tm[4]){
      targetHour=pad(parseInt(tm[4],10))+':00';
    }
  }

  // 5. Day preference
  const now=new Date();
  const dayNames=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  let targetDate=null;

  if(/\btomorrow\b/i.test(q)){
    const tom=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
    targetDate=K(tom);
  }else if(/\btoday\b/i.test(q)){
    targetDate=K(now);
  }else{
    for(let d=1;d<=6;d++){
      if(q.includes(dayNames[d])){
        for(let i=0;i<7;i++){
          const testDay=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i);
          if(testDay.getDay()===d){
            targetDate=K(testDay);
            break;
          }
        }
        break;
      }
    }
  }

  // 6. Period preference
  const isMorning=/\bmorning\b/i.test(q);
  const isAfternoon=/\b(afternoon|noon|lunch)\b/i.test(q);
  const isEvening=/\bevening\b/i.test(q);

  const hasTimeOrDateCriteria = !!(targetHour || targetDate || isMorning || isAfternoon || isEvening);
  if(!hasTimeOrDateCriteria) return null;

  // Match slot against date + time criteria in pool
  const matches=pool.filter(s=>{
    if(targetDate&&s.date!==targetDate)return false;
    if(targetHour&&s.time!==targetHour)return false;
    const hr=parseInt(s.time.split(':')[0],10);
    if(isMorning&&(hr<9||hr>=12))return false;
    if(isAfternoon&&(hr<12||hr>=16))return false;
    if(isEvening&&(hr<16||hr>18))return false;
    return true;
  });

  if(matches.length>0)return matches[0];

  // If specific time or date was requested but not in offered pool, check all free slots
  const allFree=freeSlots(25);
  const globalMatch=allFree.find(s=>{
    if(targetDate&&s.date!==targetDate)return false;
    if(targetHour&&s.time!==targetHour)return false;
    const hr=parseInt(s.time.split(':')[0],10);
    if(isMorning&&(hr<9||hr>=12))return false;
    if(isAfternoon&&(hr<12||hr>=16))return false;
    if(isEvening&&(hr<16||hr>18))return false;
    return true;
  });
  if(globalMatch)return globalMatch;

  return null;
}

function notify(msg){
  d.notifications.unshift({id:id(),at:Date.now(),msg});
  if(d.notifications.length>200)d.notifications.length=200;
  save();
  const notifyList=(d.settings?.notifyNumbers||process.env.NOTIFY_NUMBERS||'').split(',').map(s=>s.trim()).filter(Boolean);
  for(const n of notifyList){
    const t=process.env.WA_NOTIFY_TEMPLATE;
    (t?wa.template(norm(n),t,[msg.slice(0,500)]):wa.text(norm(n),'🔔 '+msg)).catch(console.error);
  }
}

const patientByPhone=ph=>d.patients.find(p=>l10(p.phone)===l10(ph));

function contact(phone,name,source){
  let p=patientByPhone(phone);
  if(p)return p;
  let l=d.leads.find(x=>l10(x.phone)===l10(phone));
  if(!l){
    l={id:id(),name:name||'New Lead',phone:norm(phone),source:source||'Inbound',cost:0,status:'New',at:Date.now()};
    d.leads.push(l);
    notify(`New lead: ${l.name} (${l.source})`);
  }
  p={id:id(),name:l.name,phone:l.phone,lastVisit:null,lastService:'Consultation',notes:'',lead:true,leadId:l.id};
  d.patients.push(p);
  l.patientId=p.id;
  save();
  return p;
}

function addLead({name,phone,source,cost=0,notes=''}){
  const ph=l10(phone);
  if(ph.length<10||!name)return null;
  if(d.leads.some(l=>l10(l.phone)===ph)||d.patients.some(p=>l10(p.phone)===ph))return null;
  const l={
    id:id(),
    name:String(name).trim().slice(0,80),
    phone:norm(phone),
    source:source||'Manual',
    cost:+cost||0,
    notes:notes||'',
    status:'New',
    aiStage:'NEW',
    clinicalIssue:'',
    followupCount:0,
    lastFollowupAt:null,
    at:Date.now()
  };
  d.leads.push(l);
  save();
  notify(`New lead: ${l.name} from ${l.source}`);
  return l;
}

async function engage(l){
  const p=contact(l.phone,l.name,l.source);
  l.status='Contacted';
  l.aiStage='INQUIRY_SENT';
  l.followupCount=(l.followupCount||0)+1;
  l.lastFollowupAt=Date.now();
  save();

  const firstName=(l.name||'there').split(' ')[0];
  const clinicName=d.settings?.clinicName||'DentaDesk Dental Care';
  const inquiryMsg=`Hi ${firstName}! Welcome to ${clinicName}. 🦷\n\nI am the clinic's AI Dental Coordinator. To help our dental specialists prepare best for you, could you please tell me: What dental concern or issue are you experiencing today?\n\n• 1️⃣ Tooth pain, cavity, or sensitivity\n• 2️⃣ Routine cleaning & general checkup\n• 3️⃣ Missing tooth / Implant / Crown\n• 4️⃣ Bleeding gums or bad breath\n• 5️⃣ Teeth alignment (Aligners/Braces) or Whitening\n\n(Reply with a number or simply describe your teeth issue in your own words!)`;

  await wa.text(p.phone,inquiryMsg).catch(console.error);
  notify(`AI Lead Agent initiated diagnostic inquiry for ${l.name} (${l.phone})`);
  return {ok:true,lead:l};
}

async function recall(p,customMessage){
  const firstName=(p.name||'there').split(' ')[0];
  const msg=customMessage||`Hi ${firstName}, it's time for your routine dental checkup & cleaning at DentaDesk! Preventive care keeps your smile bright. Reply BOOK to schedule your visit. 🦷`;
  await wa.template(p.phone,process.env.WA_RECALL_TEMPLATE||'recall_checkup',[firstName]).catch(console.error);
  await wa.text(p.phone,msg).catch(console.error);
  p.recalledAt=Date.now();
  p.recallCount=(p.recallCount||0)+1;
  save();
  notify(`Recall sent to ${p.name} (${p.phone})`);
  return {ok:true,message:msg};
}

function dueForRecall(thresholdDays){
  const limitDays=+(thresholdDays||process.env.RECALL_DAYS||180);
  const now=Date.now();
  const t=K(new Date());

  return d.patients.filter(p=>{
    if(!p.lastVisit)return false;
    const visitDate=new Date(p.lastVisit.includes('T')?p.lastVisit:p.lastVisit+'T00:00');
    if(isNaN(visitDate.getTime()))return false;
    const patientLimit=+(p.recallDays||limitDays)*864e5;
    if(now-visitDate.getTime()<patientLimit)return false;
    if(p.recalledAt&&(now-p.recalledAt<21*864e5))return false; // Skip if recalled in last 21 days
    const hasUpcoming=d.appointments.some(a=>a.patientId===p.id&&a.status==='Booked'&&a.date>=t);
    return !hasUpcoming;
  });
}

function book(pid,s,source='Manual'){
  if(taken(s.date,s.time))return null;
  const p=d.patients.find(x=>x.id===+pid);
  if(!p)return null;
  const l=d.leads.find(x=>x.patientId===p.id||l10(x.phone)===l10(p.phone));
  const suggestedService = s.service || (l?.clinicalIssue?.includes('Root canal') ? 'Root canal' : (l?.clinicalIssue?.includes('Cleaning') ? 'Cleaning' : (l?.clinicalIssue?.includes('Whitening') ? 'Whitening' : (l?.clinicalIssue?.includes('Aligner') ? 'Ortho review' : 'Checkup'))));
  const a={
    id:id(),
    patientId:p.id,
    date:s.date,
    time:s.time,
    service:suggestedService,
    notes:s.notes||(l?.clinicalIssue ? 'AI Concern: '+l.clinicalIssue : ''),
    status:'Booked',
    source:source||'Manual',
    at:Date.now()
  };
  d.appointments.push(a);
  if(l){
    l.status='Won';
    l.aiStage='BOOKED';
    l.bookedAt=Date.now();
  }
  save();
  notify(`${p.name} booked ${a.service} on ${lab(a.date)} at ${a.time} via ${source}`);
  return a;
}

function reschedule(apptId,newDate,newTime){
  const a=d.appointments.find(x=>x.id===+apptId);
  if(!a)return null;
  if(taken(newDate,newTime))return null;
  const oldDate=a.date,oldTime=a.time;
  a.date=newDate;
  a.time=newTime;
  a.status='Booked';
  a.reminded=false;
  save();
  const p=d.patients.find(x=>x.id===a.patientId);
  const pName=p?p.name:'Patient';
  notify(`${pName} rescheduled to ${lab(newDate)} ${newTime} (was ${lab(oldDate)} ${oldTime})`);
  if(p&&p.phone){
    wa.text(p.phone,`Hi ${pName.split(' ')[0]}, your appointment is updated to ${lab(newDate)} at ${newTime}. Reply CANCEL or RESCHEDULE if you need further changes. 🦷`).catch(console.error);
  }
  return a;
}

function cancelUpcoming(pid){
  const t=K(new Date());
  const a=d.appointments.filter(x=>x.patientId===pid&&x.status==='Booked'&&x.date>=t).pop();
  if(!a)return null;
  a.status='Cancelled';
  save();
  const p=d.patients.find(x=>x.id===pid);
  notify(`${p?p.name:'Patient'} cancelled ${lab(a.date)} ${a.time} (slot freed)`);
  return a;
}

module.exports={
  K,
  lab,
  norm,
  l10,
  SLOTS,
  freeSlots,
  findMatchingSlot,
  notify,
  contact,
  addLead,
  engage,
  recall,
  dueForRecall,
  book,
  reschedule,
  cancelUpcoming,
  patientByPhone
};

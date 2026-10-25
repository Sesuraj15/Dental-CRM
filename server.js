require('dotenv').config();
const express=require('express'),jwt=require('jsonwebtoken'),bcrypt=require('bcryptjs'),crypto=require('crypto'),path=require('path');
const {d,save,id}=require('./db'),core=require('./core'),wa=require('./wa'),bot=require('./bot'),leads=require('./leads'),sched=require('./scheduler'),ai=require('./ai');

const app=express();
app.disable('x-powered-by');
app.set('trust proxy',1);
app.use(express.json({limit:'2mb',verify:(q,_,b)=>{q.rawBody=b}}));

// Initialize secrets and defaults
if(!d.secret) d.secret=crypto.randomBytes(32).toString('hex');
if(!d.settings) {
  d.settings = {
    clinicName: 'DentaDesk Dental Care',
    doctorName: 'Dr. Raj',
    phone: process.env.NOTIFY_NUMBERS ? process.env.NOTIFY_NUMBERS.split(',')[0].trim() : '',
    address: 'Suite 402, Health Arcade, Dental Care Plaza',
    recallDays: +(process.env.RECALL_DAYS || 180)
  };
}
if(!d.users.length){
  for(const [u,r] of [['owner','Owner'],['admin','Admin']]){
    const pw=process.env[r.toUpperCase()+'_PASSWORD']||crypto.randomBytes(5).toString('hex');
    d.users.push({id:id(),username:u,role:r,hash:bcrypt.hashSync(pw,10)});
    console.log(`Created login ${u} / ${pw}  (change it in Team & Access)`);
  }
}
if(!d.inventory.length){
  d.inventory=[
    {id:id(),name:'Gloves (box)',qty:12,min:5,perVisit:0.2,unit:'box'},
    {id:id(),name:'Anaesthetic cartridges',qty:20,min:6,perVisit:1,unit:'units'},
    {id:id(),name:'Composite resin',qty:9,min:4,perVisit:0,unit:'tubes'},
    {id:id(),name:'Dental floss packs',qty:30,min:10,perVisit:0,unit:'packs'},
    {id:id(),name:'Sterile Dental Bibs',qty:80,min:20,perVisit:1,unit:'pieces'},
    {id:id(),name:'Suction Tips (disposable)',qty:65,min:25,perVisit:1,unit:'pieces'}
  ];
}
if(!d.prices){
  d.prices={
    'Checkup':500,
    'Cleaning':1200,
    'Root canal':6500,
    'Whitening':4000,
    'Ortho review':800,
    'Filling':1500,
    'Consultation':300
  };
}
save();

// Auth Middleware
const auth=(...roles)=>(q,s,n)=>{
  try{
    const authHeader=q.headers.authorization||'';
    const token=authHeader.startsWith('Bearer ')?authHeader.slice(7):authHeader;
    const u=jwt.verify(token,d.secret);
    if(roles.length&&!roles.includes(u.role)){
      return s.status(403).json({error:'Not allowed for your role'});
    }
    q.u=u;
    n();
  }catch{
    s.status(401).json({error:'Please sign in'});
  }
};

const find=(arr,i)=>arr.find(x=>x.id===+i);
const bad=(s,m)=>s.status(400).json({error:m});

// Public webhooks
app.get('/webhooks/whatsapp',bot.verify(process.env.WA_VERIFY_TOKEN));
app.post('/webhooks/whatsapp',bot.webhook);
app.use('/webhooks',leads.router);

// Auth login
const fails={};
app.post('/api/login',(q,s)=>{
  const f=fails[q.ip]||{n:0,t:0};
  if(f.n>=5&&Date.now()<f.t){
    return s.status(429).json({error:'Too many login attempts. Try again in a minute.'});
  }
  const username=String(q.body.username||'').trim().toLowerCase();
  const password=String(q.body.password||'');
  const u=d.users.find(x=>x.username===username);
  if(!u||!bcrypt.compareSync(password,u.hash)){
    fails[q.ip]={n:f.n+1,t:Date.now()+60000};
    return s.status(401).json({error:'Invalid username or password'});
  }
  delete fails[q.ip];
  s.json({token:jwt.sign({id:u.id,username:u.username,role:u.role},d.secret,{expiresIn:'24h'})});
});

// Bootstrap / Initial State
app.get('/api/bootstrap',auth(),(q,s)=>{
  const isOwner=q.u.role==='Owner';
  const recallDueCount=core.dueForRecall(d.settings?.recallDays).length;

  s.json({
    me:q.u,
    patients:d.patients,
    appointments:d.appointments,
    leads:d.leads.map(l=>isOwner?l:{...l,cost:undefined}),
    inventory:d.inventory,
    notifications:d.notifications.slice(0,60),
    invoices:isOwner?d.invoices:d.invoices.map(i=>({...i,amount:undefined})),
    chats:d.chats,
    slots:core.SLOTS,
    prices:d.prices,
    settings:d.settings,
    waLive:wa.on(),
    automations:sched.getStatus(),
    metrics:{
      recallDue:recallDueCount,
      todayAppts:d.appointments.filter(a=>a.date===core.K(new Date())&&a.status==='Booked').length,
      totalPatients:d.patients.length,
      totalLeads:d.leads.length
    }
  });
});

// ==================== PATIENTS API ====================
app.post('/api/patients',auth(),(q,s)=>{
  const {name,phone,age,gender,lastVisit,lastService,notes,recallDays}=q.body;
  if(!name||core.l10(phone).length<10){
    return bad(s,'Valid patient name and 10-digit phone number are required');
  }
  if(core.patientByPhone(phone)){
    return bad(s,'A patient with this phone number already exists');
  }
  const newPatient={
    id:id(),
    name:String(name).trim().slice(0,80),
    phone:core.norm(phone),
    age:age?+age:null,
    gender:gender||'Other',
    lastVisit:lastVisit||null,
    lastService:lastService||'Checkup',
    notes:notes?String(notes).slice(0,500):'',
    recallDays:recallDays?+recallDays:+(d.settings?.recallDays||180),
    createdAt:Date.now()
  };
  d.patients.push(newPatient);
  save();
  core.notify(`New patient registered: ${newPatient.name} (${newPatient.phone})`);
  s.json({ok:1,patient:newPatient});
});

app.patch('/api/patients/:id',auth(),(q,s)=>{
  const p=find(d.patients,q.params.id);
  if(!p)return bad(s,'Patient not found');
  const {name,phone,age,gender,lastVisit,lastService,notes,recallDays}=q.body;
  if(name) p.name=String(name).trim().slice(0,80);
  if(phone&&core.l10(phone).length>=10) p.phone=core.norm(phone);
  if(age!==undefined) p.age=+age||null;
  if(gender) p.gender=gender;
  if(lastVisit!==undefined) p.lastVisit=lastVisit||null;
  if(lastService) p.lastService=lastService;
  if(notes!==undefined) p.notes=String(notes).slice(0,500);
  if(recallDays!==undefined) p.recallDays=+recallDays||180;
  save();
  s.json({ok:1,patient:p});
});

app.delete('/api/patients/:id',auth(),(q,s)=>{
  const idx=d.patients.findIndex(x=>x.id===+q.params.id);
  if(idx===-1)return bad(s,'Patient not found');
  const removed=d.patients.splice(idx,1)[0];
  save();
  core.notify(`Patient record removed: ${removed.name}`);
  s.json({ok:1});
});

// Recall single patient
app.post('/api/patients/:id/recall',auth(),async(q,s)=>{
  const p=find(d.patients,q.params.id);
  if(!p)return bad(s,'Patient not found');
  const customMessage=q.body?.message;
  const res=await core.recall(p,customMessage);
  s.json({ok:1,...res});
});

// Get all patients currently due for recall
app.get('/api/recall/due',auth(),(q,s)=>{
  const due=core.dueForRecall(d.settings?.recallDays);
  const now=Date.now();
  const list=due.map(p=>{
    const vDate=new Date(p.lastVisit.includes('T')?p.lastVisit:p.lastVisit+'T00:00');
    const daysSince=Math.floor((now-vDate.getTime())/864e5);
    return {
      ...p,
      daysSinceLastVisit:daysSince,
      daysOverdue:daysSince-(p.recallDays||d.settings?.recallDays||180)
    };
  });
  s.json({count:list.length,patients:list});
});

// Run recall batch
app.post('/api/recall/run',auth(),async(q,s)=>{
  const thresholdDays=q.body?.thresholdDays||d.settings?.recallDays;
  const res=await sched.runRecall(thresholdDays);
  s.json(res);
});

// ==================== APPOINTMENTS API ====================
app.post('/api/appointments',auth(),(q,s)=>{
  const {patientId,date,time,service,notes}=q.body;
  if(!patientId||!date||!time)return bad(s,'Patient, date, and time slot are required');
  const appt=core.book(+patientId,{date,time,service:service||'Checkup',notes:notes||''},'Manual');
  if(!appt)return bad(s,'That slot is already booked or patient was not found');
  s.json(appt);
});

app.patch('/api/appointments/:id',auth(),(q,s)=>{
  const a=find(d.appointments,q.params.id);
  if(!a)return bad(s,'Appointment not found');

  // Handle rescheduling
  if(q.body.date&&q.body.time&&(q.body.date!==a.date||q.body.time!==a.time)){
    const resched=core.reschedule(a.id,q.body.date,q.body.time);
    if(!resched)return bad(s,'New slot is already taken');
    return s.json(resched);
  }

  // Handle status updates
  const st=q.body.status;
  if(st&&st!==a.status){
    if(st==='Completed'&&a.status!=='Completed'){
      const p=find(d.patients,a.patientId);
      if(p){
        p.lastVisit=core.K(new Date());
        p.lastService=a.service;
      }
      // Create invoice
      const fee=d.prices[a.service]||500;
      const inv={
        id:id(),
        patientId:a.patientId,
        service:a.service,
        amount:fee,
        paid:false,
        method:'Pending',
        at:Date.now()
      };
      d.invoices.push(inv);

      // Decrement inventory per visit
      d.inventory.forEach(item=>{
        if(item.perVisit>0){
          item.qty=Math.max(0,+(item.qty-item.perVisit).toFixed(1));
        }
      });

      // Update lead if linked
      const lead=d.leads.find(x=>x.patientId===a.patientId);
      if(lead)lead.status='Won';

      core.notify(`Completed: ${p?p.name:'Patient'} (${a.service}). Invoice #${inv.id} raised for ₹${fee}; supplies deducted.`);
    }

    if(st==='Cancelled'&&a.status==='Booked'){
      core.notify(`Appointment cancelled by staff: ${core.lab(a.date)} ${a.time}`);
    }

    a.status=st;
  }

  if(q.body.service) a.service=q.body.service;
  if(q.body.notes!==undefined) a.notes=q.body.notes;
  save();
  s.json(a);
});

app.delete('/api/appointments/:id',auth(),(q,s)=>{
  const idx=d.appointments.findIndex(x=>x.id===+q.params.id);
  if(idx===-1)return bad(s,'Appointment not found');
  const removed=d.appointments.splice(idx,1)[0];
  save();
  core.notify(`Appointment removed: ${core.lab(removed.date)} at ${removed.time}`);
  s.json({ok:1});
});

// Free slots for specific date
app.get('/api/slots',auth(),(q,s)=>{
  const dateStr=q.query.date||core.K(new Date());
  const free=core.freeSlots(20,0,dateStr);
  s.json({date:dateStr,slots:free,allSlots:core.SLOTS});
});

// ==================== LEADS API ====================
app.post('/api/leads',auth(),async(q,s)=>{
  const l=await leads.ingest({...q.body,source:q.body.source||'Manual'});
  if(!l)return bad(s,'Duplicate phone number or invalid lead info');
  s.json(l);
});

app.patch('/api/leads/:id',auth(),(q,s)=>{
  const l=find(d.leads,q.params.id);
  if(!l)return bad(s,'Lead not found');
  if(q.body.status) l.status=q.body.status;
  if(q.body.name) l.name=String(q.body.name).trim();
  if(q.body.phone) l.phone=core.norm(q.body.phone);
  if(q.body.cost!==undefined) l.cost=+q.body.cost||0;
  if(q.body.notes!==undefined) l.notes=q.body.notes;
  save();
  s.json(l);
});

app.delete('/api/leads/:id',auth(),(q,s)=>{
  const idx=d.leads.findIndex(x=>x.id===+q.params.id);
  if(idx===-1)return bad(s,'Lead not found');
  d.leads.splice(idx,1);
  save();
  s.json({ok:1});
});

app.post('/api/leads/:id/convert',auth(),async(q,s)=>{
  const l=find(d.leads,q.params.id);
  if(!l)return bad(s,'Lead not found');
  const p=core.contact(l.phone,l.name,l.source);
  l.patientId=p.id;
  l.status='Booked';
  save();

  if(q.body.date&&q.body.time){
    const appt=core.book(p.id,{date:q.body.date,time:q.body.time,service:q.body.service||'Checkup'},'Lead Conversion');
    return s.json({ok:1,patient:p,appointment:appt});
  }
  s.json({ok:1,patient:p});
});

app.post('/api/leads/import',auth(),async(q,s)=>{
  const count=await leads.importCSV(String(q.body.text||''),'CSV Import');
  s.json({created:count});
});

app.post('/api/leads/sync-sheet',auth(),async(q,s)=>{
  const count=await leads.pollSheet();
  s.json({created:count});
});

app.post('/api/leads/:id/engage',auth(),async(q,s)=>{
  const l=find(d.leads,q.params.id);
  if(!l)return bad(s,'Lead not found');
  await core.engage(l);
  s.json({ok:1});
});

// ==================== INVENTORY API ====================
app.post('/api/inventory',auth(),(q,s)=>{
  const {name,qty,min,perVisit,unit}=q.body;
  if(!name)return bad(s,'Item name is required');
  const item={
    id:id(),
    name:String(name).trim(),
    qty:+qty||0,
    min:+min||5,
    perVisit:+perVisit||0,
    unit:unit||'units'
  };
  d.inventory.push(item);
  save();
  s.json(item);
});

app.patch('/api/inventory/:id',auth(),(q,s)=>{
  const i=find(d.inventory,q.params.id);
  if(!i)return bad(s,'Item not found');
  if(q.body.name) i.name=q.body.name;
  if(q.body.qty!==undefined) i.qty=+q.body.qty;
  if(q.body.min!==undefined) i.min=+q.body.min;
  if(q.body.perVisit!==undefined) i.perVisit=+q.body.perVisit;
  if(q.body.unit!==undefined) i.unit=q.body.unit;
  save();
  s.json(i);
});

app.delete('/api/inventory/:id',auth(),(q,s)=>{
  const idx=d.inventory.findIndex(x=>x.id===+q.params.id);
  if(idx===-1)return bad(s,'Item not found');
  d.inventory.splice(idx,1);
  save();
  s.json({ok:1});
});

// ==================== BILLING & INVOICES API ====================
app.post('/api/invoices',auth(),(q,s)=>{
  const {patientId,service,amount,method,notes}=q.body;
  if(!patientId||!amount)return bad(s,'Patient and amount are required');
  const inv={
    id:id(),
    patientId:+patientId,
    service:service||'Consultation',
    amount:+amount,
    paid:q.body.paid===true||false,
    method:method||(q.body.paid?'Cash':'Pending'),
    notes:notes||'',
    at:Date.now()
  };
  d.invoices.push(inv);
  save();
  const p=find(d.patients,patientId);
  core.notify(`Invoice #${inv.id} created for ${p?p.name:'Patient'}: ₹${inv.amount}`);
  s.json(inv);
});

app.patch('/api/invoices/:id/pay',auth('Owner'),(q,s)=>{
  const i=find(d.invoices,q.params.id);
  if(!i)return bad(s,'Invoice not found');
  i.paid=true;
  i.paidAt=Date.now();
  if(q.body.method) i.method=q.body.method;
  save();
  const p=find(d.patients,i.patientId);
  core.notify(`Payment received: ₹${i.amount} from ${p?p.name:'Patient'} (${i.method||'Cash'})`);
  s.json(i);
});

// ==================== SETTINGS & CLINIC CONFIG ====================
app.get('/api/settings',auth(),(q,s)=>{
  s.json({
    settings:d.settings,
    prices:d.prices,
    slots:core.SLOTS
  });
});

app.patch('/api/settings',auth('Owner'),(q,s)=>{
  if(q.body.settings){
    d.settings={...d.settings,...q.body.settings};
  }
  if(q.body.prices){
    d.prices={...d.prices,...q.body.prices};
  }
  save();
  s.json({ok:1,settings:d.settings,prices:d.prices});
});

// ==================== WHATSAPP & BOT SIMULATOR ====================
app.post('/api/chats/:phone/send',auth(),async(q,s)=>{
  const cleanPh=core.norm(q.params.phone);
  const text=String(q.body.text||'').slice(0,1000);
  await wa.text(cleanPh,text);
  s.json({ok:1,chats:d.chats[cleanPh]||[]});
});

// Interactive Simulator: lets staff or demo user simulate incoming messages as a patient
app.post('/api/chats/simulate',auth(),async(q,s)=>{
  const {phone,text,btn,name}=q.body;
  if(!phone)return bad(s,'Phone number is required');
  const cleanPh=core.norm(phone);
  await bot.simulateInbound(cleanPh,text,btn,name);
  s.json({ok:1,chats:d.chats[cleanPh]||[]});
});

// WhatsApp Live Test & Diagnostics
app.get('/api/wa/status',auth(),(q,s)=>{
  s.json({
    live:wa.on(),
    tokenConfigured:!!wa.getToken(),
    tokenPreview:wa.getToken()?wa.getToken().slice(0,8)+'...'+wa.getToken().slice(-4):null,
    phoneId:wa.getPhoneId()||null,
    notifyNumbers:d.settings?.notifyNumbers||process.env.NOTIFY_NUMBERS||''
  });
});

app.post('/api/wa/test',auth(),async(q,s)=>{
  const phone=q.body?.phone||d.settings?.phone||(process.env.NOTIFY_NUMBERS||'').split(',')[0];
  const text=q.body?.text||'Hello from DentaDesk! 🦷 Testing live WhatsApp connection.';
  const res=await wa.sendTest(phone,text);
  s.json(res);
});

// ==================== AUTOMATIONS & CRON MONITOR API ====================
app.get('/api/automations',auth(),(q,s)=>{
  s.json(sched.getStatus());
});

app.post('/api/automations/run/:task',auth(),async(q,s)=>{
  const task=q.params.task;
  let result;
  if(task==='recall') result=await sched.runRecall();
  else if(task==='reminders') result=await sched.reminders();
  else if(task==='noshows'||task==='noShows') result=await sched.noShows();
  else if(task==='sheet'||task==='pollSheet') result=await sched.pollSheetAuto();
  else if(task==='leadFollowup'||task==='leadagent'||task==='leads') result=await sched.runLeadFollowupAgent(true);
  else return bad(s,'Unknown automation task: '+task);
  s.json({ok:1,task,result,status:sched.getStatus()});
});

app.post('/api/leads/:id/ai-followup',auth(),async(q,s)=>{
  const l=find(d.leads,q.params.id);
  if(!l)return bad(s,'Lead not found');
  const p=core.contact(l.phone,l.name,l.source);
  let msg;
  if(!l.aiStage||l.aiStage==='NEW'){
    await core.engage(l);
    return s.json({ok:1,stage:l.aiStage,message:'Dispatched initial teeth concern inquiry'});
  }
  msg=ai.generateAutonomousLeadFollowup(l,d.settings?.clinicName);
  await wa.text(p.phone,msg);
  l.followupCount=(l.followupCount||0)+1;
  l.lastFollowupAt=Date.now();
  save();
  if(l.aiStage==='SLOTS_OFFERED')await bot.offer(p.phone,0);
  core.notify(`AI Follow-up dispatched to ${l.name} (${l.phone})`);
  s.json({ok:1,lead:l,message:msg});
});

// ==================== AI DENTAL CLINICAL AGENT API ====================
app.post('/api/ai/triage',auth(),(q,s)=>{
  const {symptoms}=q.body;
  if(!symptoms)return bad(s,'Please provide symptom description');
  const result=ai.triageSymptoms(symptoms);
  s.json(result);
});

app.post('/api/ai/recall-optimizer',auth(),(q,s)=>{
  const thresholdDays=q.body?.recallDays||d.settings?.recallDays||180;
  const analysis=ai.analyzeRecalls(d.patients,d.appointments,thresholdDays);
  s.json(analysis);
});

app.post('/api/ai/draft-reply',auth(),(q,s)=>{
  const {scenario,context}=q.body;
  const reply=ai.draftWhatsAppReply(scenario||'lead_welcome',context||{});
  s.json({reply});
});

app.post('/api/ai/treatment-plan',auth(),(q,s)=>{
  const {services,notes}=q.body;
  const plan=ai.generateTreatmentPlan(services||['Checkup'],d.prices,notes);
  s.json(plan);
});

app.post('/api/ai/chat',auth(),async(q,s)=>{
  const {message}=q.body;
  if(!message)return bad(s,'Message cannot be empty');
  const response=await ai.chatWithCopilot(message,{
    patients:d.patients,
    appointments:d.appointments,
    leads:d.leads,
    prices:d.prices
  });
  s.json(response);
});

// Team Passwords
app.post('/api/users/password',auth('Owner'),(q,s)=>{
  const u=d.users.find(x=>x.username===q.body.username);
  if(!u||String(q.body.password||'').length<8){
    return bad(s,'Pick a user and a password of at least 8 characters');
  }
  u.hash=bcrypt.hashSync(q.body.password,10);
  save();
  s.json({ok:1});
});

// Static frontend
app.use(express.static(path.join(__dirname,'public')));

// Fallback to index.html for client-side navigation
app.get('*',(req,res)=>{
  res.sendFile(path.join(__dirname,'public','index.html'));
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>{
  console.log(`DentaDesk running on port ${PORT}`+(wa.on()?'':'  [WhatsApp DRY-RUN mode: set WA_TOKEN and WA_PHONE_ID to go live]'));
  sched.start();
});

const express=require('express'),core=require('./core'),bot=require('./bot'),r=express.Router();
async function ingest(x){const l=core.addLead(x);if(l&&process.env.AUTO_ENGAGE!=='false')await core.engage(l).catch(console.error);return l}
const parseCSV=t=>t.split(/\r?\n/).map(l=>l.split(',').map(c=>c.trim().replace(/^"|"$/g,''))).filter(c=>c.length>=2&&!/^name$/i.test(c[0]));
async function importCSV(text,source){let n=0;for(const c of parseCSV(text))if(await ingest({name:c[0],phone:c[1],source:c[2]||source}))n++;return n}
// Meta (Facebook/Instagram) Lead Ads: subscribe your Page to the "leadgen" webhook field
r.get('/meta-leads',bot.verify(process.env.WA_VERIFY_TOKEN));
r.post('/meta-leads',async(req,res)=>{if(!bot.sigOk(req))return res.sendStatus(401);res.sendStatus(200);
  try{for(const e of req.body.entry||[])for(const c of e.changes||[]){if(c.field!=='leadgen')continue;
    const j=await(await fetch(`https://graph.facebook.com/v20.0/${c.value.leadgen_id}?access_token=${process.env.META_PAGE_TOKEN}`)).json(),
      f=Object.fromEntries((j.field_data||[]).map(x=>[x.name,x.values?.[0]]));
    await ingest({name:f.full_name||f.first_name||'Meta lead',phone:f.phone_number||f.phone,source:'Meta Ads',cost:process.env.COST_META})}}catch(err){console.error('meta lead error',err)}});
// Google Ads lead form extension webhook: set the URL and key in the lead form
r.post('/google-ads',async(req,res)=>{const b=req.body||{};if(!process.env.GOOGLE_ADS_KEY||b.google_key!==process.env.GOOGLE_ADS_KEY)return res.sendStatus(401);res.sendStatus(200);
  const f=Object.fromEntries((b.user_column_data||[]).map(x=>[x.column_id,x.string_value]));
  await ingest({name:f.FULL_NAME||f.FIRST_NAME||'Google lead',phone:f.PHONE_NUMBER,source:'Google Ads',cost:process.env.COST_GOOGLE}).catch(console.error)});
// Generic webhook for Zapier/Make/website forms/Drive automations: POST {name,phone,source} with header x-api-key
r.post('/generic',async(req,res)=>{if(req.headers['x-api-key']!==process.env.GENERIC_API_KEY)return res.sendStatus(401);const l=await ingest({...req.body,source:req.body.source||'Website Form'});res.json({created:!!l})});
// Google Drive / Sheets: poll a sheet published as CSV
async function pollSheet(){const u=process.env.SHEET_CSV_URL;if(!u)return 0;try{const n=await importCSV(await(await fetch(u)).text(),'Google Drive Sheet');if(n)console.log('Sheet sync: '+n+' new leads');return n}catch(e){console.error('sheet sync failed',e.message);return 0}}
module.exports={router:r,ingest,importCSV,pollSheet};

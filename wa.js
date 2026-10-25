const {d,save}=require('./db');

const getToken=()=>(d.settings?.waToken||process.env.WA_TOKEN||'').trim();
const getPhoneId=()=>(d.settings?.waPhoneId||process.env.WA_PHONE_ID||'').trim();

const on=()=>!!(getToken()&&getPhoneId());

const log=(ph,f,t)=>{
  const cleanPh=String(ph).replace(/\D/g,'');
  const c=(d.chats[cleanPh]=d.chats[cleanPh]||[]);
  c.push({f,t,at:Date.now()});
  if(c.length>100)c.shift();
  save();
};

const to=p=>String(p).replace(/\D/g,'');

async function api(body){
  const token=getToken();
  const phoneId=getPhoneId();

  if(!token||!phoneId){
    console.log('[WhatsApp dry-run / no credentials configured]',JSON.stringify(body));
    return {dryRun:true,status:'dry_run',note:'Set WA_TOKEN and WA_PHONE_ID in .env or Settings to send real messages'};
  }

  try{
    const r=await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`,{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+token,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({messaging_product:'whatsapp',...body})
    });

    const resJson=await r.json().catch(()=>({}));
    if(!r.ok){
      console.error('WhatsApp Cloud API error:',r.status,resJson);
      return {error:resJson?.error?.message||`Meta API error (${r.status})`,meta:resJson};
    }
    return {success:true,data:resJson};
  }catch(e){
    console.error('WhatsApp network error:',e);
    return {error:e.message};
  }
}

module.exports={
  on,
  log,
  getToken,
  getPhoneId,
  text:async(ph,t)=>{
    log(ph,'bot',t);
    return api({to:to(ph),type:'text',text:{body:t}});
  },
  buttons:async(ph,t,b)=>{
    log(ph,'bot',t+' ['+b.map(x=>x.title).join(' | ')+']');
    const res=await api({
      to:to(ph),
      type:'interactive',
      interactive:{
        type:'button',
        body:{text:t},
        action:{buttons:b.slice(0,3).map(x=>({type:'reply',reply:{id:x.id,title:x.title.slice(0,20)}}))}
      }
    });
    // If interactive button fails or dry run, fallback to text
    if(res.error){
      return api({to:to(ph),type:'text',text:{body:t+'\n\nReply with: '+b.map(x=>x.title).join(' or ')}});
    }
    return res;
  },
  template:async(ph,name,params=[])=>{
    log(ph,'bot',`[Template: ${name}] ${params.join(', ')}`);
    const res=await api({
      to:to(ph),
      type:'template',
      template:{
        name,
        language:{code:process.env.WA_TEMPLATE_LANG||'en'},
        components:params.length?[{type:'body',parameters:params.map(x=>({type:'text',text:String(x)}))}]:[]
      }
    });
    return res;
  },
  // Diagnostics & test utility
  sendTest:async(targetPhone,customText='Hello from DentaDesk! 🦷 Your WhatsApp messaging is properly connected.')=>{
    const cleanPh=to(targetPhone);
    const token=getToken();
    const phoneId=getPhoneId();

    if(!token||!phoneId){
      return {
        success:false,
        isConfigured:false,
        error:'WA_TOKEN or WA_PHONE_ID is empty. You need a Meta WhatsApp Cloud API access token and Phone Number ID to send real messages.'
      };
    }

    log(cleanPh,'bot',customText);
    const result=await api({to:cleanPh,type:'text',text:{body:customText}});
    return {
      success:!result.error,
      isConfigured:true,
      tokenPreview:token.slice(0,8)+'...'+token.slice(-4),
      phoneId,
      result
    };
  }
};

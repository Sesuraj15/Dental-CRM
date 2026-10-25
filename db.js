const fs=require('fs'),path=require('path');
const F=process.env.DB_FILE||path.join(__dirname,'data','db.json');
fs.mkdirSync(path.dirname(F),{recursive:true});
const d={users:[],patients:[],appointments:[],leads:[],invoices:[],inventory:[],notifications:[],chats:{},seq:1,secret:null,prices:null};
try{Object.assign(d,JSON.parse(fs.readFileSync(F,'utf8')))}catch{}
let t;const save=()=>{clearTimeout(t);t=setTimeout(()=>{fs.writeFileSync(F+'.tmp',JSON.stringify(d));fs.renameSync(F+'.tmp',F)},200)};
process.on('SIGTERM',()=>{fs.writeFileSync(F,JSON.stringify(d));process.exit(0)});
module.exports={d,save,id:()=>d.seq++};

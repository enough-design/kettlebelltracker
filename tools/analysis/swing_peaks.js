const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
let src=html.slice(html.indexOf('/* SWINGVIZ-MODEL START */'),html.indexOf('/* SWINGVIZ-MODEL END */')).replace('KEEP_MS = 7500','KEEP_MS = 1e9');
const mk=()=>new Function(src+'; return SWINGVIZ;')();
function parse(f){const [h,...L]=fs.readFileSync(f,'utf8').trim().split('\n');const H=h.split(',');const ix=n=>H.indexOf(n);
 return L.map(l=>l.split(',')).map(c=>({t:+c[ix('t_epoch_ms')],ms:+c[ix('ms')],phase:c[ix('phase')],set:+c[ix('set')],ax:+c[ix('ax')]/1000,ay:+c[ix('ay')]/1000,az:+c[ix('az')]/1000,gx:+c[ix('gx')],gy:+c[ix('gy')],gz:+c[ix('gz')]}));}
function run(rows,short){const V=mk();V.reset(false);let hi=0,last=-1e9;const reps=[];
 for(const r of rows){const a=Math.hypot(r.ax,r.ay,r.az);if(a>1.5)hi=r.t;V.feed(r.ms,r.ax,r.ay,r.az,r.gx,r.gy,r.gz,r.t);
  if(a<0.55&&r.t-hi<1200&&r.t-last>900){last=r.t;V.rep(r.t,short,reps.length+1);reps.push(r.t);}}
 V.update(rows[rows.length-1].t+1000);const H=V.hist;
 return reps.map(t=>{let m=-1e9;H.forEach(h=>{if(Math.abs(h.t-t-100)<250&&h.th>m)m=h.th;});return Math.round(m);});}
for(const f of process.argv.slice(2)){const rows=parse(f);const sets=[...new Set(rows.filter(r=>r.phase==='work').map(r=>r.set))];
 console.log(f.split('/').pop());for(const s of sets)console.log(' set',s,run(rows.filter(r=>r.phase==='work'&&r.set===s),false).join(' '));}

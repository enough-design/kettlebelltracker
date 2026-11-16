// Time series around presses (offline labels) for designing a real-time press detector.
// node tools/analysis/press_causal.js [file set]   - no args: feature table over every labelled set whose offline press count is right
const { chromium } = require('playwright'); const fs = require('fs');
const T = JSON.parse(fs.readFileSync('tools/tests/truth_all.json', 'utf8'));
function parse(f){const [h,...L]=fs.readFileSync('data/raw/'+f,'utf8').trim().split('\n');const H=h.split(',');const ix=n=>H.indexOf(n);
return L.map(l=>l.split(',')).map(c=>({t:+c[ix('t_epoch_ms')],ms:+c[ix('ms')],phase:c[ix('phase')],set:+c[ix('set')],ax:+c[ix('ax')],ay:+c[ix('ay')],az:+c[ix('az')],gx:+c[ix('gx')],gy:+c[ix('gy')],gz:+c[ix('gz')]}));}
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto('file://'+process.cwd()+'/index.html#dev');
const [F1,S1]=process.argv.slice(2); const out=[];
for(const [f,S] of Object.entries(T)){ if(F1&&f!==F1)continue; if(f.startsWith('kb_raw_2026-11-11-13-05-20'))continue; const rows=parse(f);
 for(const [s,tr] of Object.entries(S)){ if(S1&&s!==S1)continue; if(!F1&&!(tr[1]>0))continue; const work=rows.filter(r=>r.set==+s&&r.phase=='work'); if(!work.length)continue;
  const r=await p.evaluate(({work})=>{raw=work.map(q=>({...q,phase:'work',set:1}));const S=pressSamples(1),L=OHP.labelSet(S),n=S.t.length;
   const tl=j=>Math.abs(S.ax[j])/(Math.hypot(S.ax[j],S.ay[j],S.az[j])||1);
   const ser=k=>{const o=[];for(let j=k-75;j<=k+75;j+=5){if(j<0||j>=n){o.push(null);continue;}o.push([+tl(j).toFixed(2),Math.round(S.gm[j])]);}return o;};
   return {np:L.presses.length,P:L.presses.map(x=>({k:x.k,t:S.t[x.k],ser:ser(x.k)})),C:L.cleans.map(x=>S.t[x.k])};},{work});
  if(!F1&&r.np!==tr[1])continue;
  r.P.forEach(x=>out.push({f:f.slice(7,40),s,...x}));
  if(F1){console.log('cleans',r.C.map(t=>t.toFixed(1)).join(' '));r.P.forEach(x=>console.log('press t',x.t.toFixed(1),'\n  tilt',x.ser.map(v=>v?v[0]:'-').join(' '),'\n  gyro',x.ser.map(v=>v?v[1]:'-').join(' ')));}
 }}
if(!F1){fs.writeFileSync('/tmp/press_ser.json',JSON.stringify(out));console.log('presses',out.length);}
await b.close();})();

// Features for a causal clean detector: every gyro burst >= 350 dps with the clean twist (>= 80 deg about x, >= 210 deg total in +/- 0.5 s),
// labelled clean / not-clean by the offline labeller (81/81 on labelled sets). Run from the repo root: node tools/analysis/clean_causal.js
const { chromium } = require('playwright'); const fs = require('fs');
const T = JSON.parse(fs.readFileSync('tools/tests/truth_all.json', 'utf8'));
function parse(f){const [h,...L]=fs.readFileSync('data/raw/'+f,'utf8').trim().split('\n');const H=h.split(',');const ix=n=>H.indexOf(n);
return L.map(l=>l.split(',')).map(c=>({t:+c[ix('t_epoch_ms')],ms:+c[ix('ms')],phase:c[ix('phase')],set:+c[ix('set')],ax:+c[ix('ax')],ay:+c[ix('ay')],az:+c[ix('az')],gx:+c[ix('gx')],gy:+c[ix('gy')],gz:+c[ix('gz')]}));}
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto('file://'+process.cwd()+'/index.html');const out=[];
for(const [f,S] of Object.entries(T)){ if(f.startsWith('kb_raw_2026-11-11-13-05-20'))continue; const rows=parse(f);
 for(const s of Object.keys(S)){ const work=rows.filter(r=>r.set==+s&&r.phase=='work'); if(!work.length)continue;
  const r=await p.evaluate(({work})=>{raw=work.map(q=>({...q,phase:'work',set:1}));const S=pressSamples(1),L=OHP.labelSet(S),n=S.t.length,FS=50;
   const cl=L.cleans.map(x=>x.k), g=S.gm, gx=S.gx, sum=(a,i,j)=>{let v=0;for(let k=Math.max(0,i);k<Math.min(n,j);k++)v+=a[k];return v;};
   const res=[];
   for(let k=1;k<n-1;k++){ if(g[k]<350||g[k]<g[k-1]||g[k]<g[k+1])continue; if(res.length&&k-res[res.length-1].k<30){if(g[k]>res[res.length-1].pk)res.pop();else continue;}
     const nx=Math.abs(sum(gx,k-25,k+25))/FS, rot=sum(g,k-25,k+25)/FS; if(nx<80||rot<210)continue;
     const f={k,pk:g[k],nx:Math.round(nx),rot:Math.round(rot),clean:cl.some(c=>Math.abs(c-k)<=5)};
     // after the burst: gyro, |a| and the x component of the unit acceleration, over windows ending 0.4 .. 1.2 s after the peak
     for(const [nm,a0,a1] of [['w4',10,20],['w6',15,30],['w8',20,40]]){ let gmax=0,ax=0,dev=0,c=0;
       for(let j=k+a0;j<Math.min(n,k+a1);j++){gmax=Math.max(gmax,g[j]);const m=Math.hypot(S.ax[j],S.ay[j],S.az[j]);ax+=Math.abs(S.ax[j])/m;dev=Math.max(dev,Math.abs(m-1));c++;}
       f[nm]=[Math.round(gmax),+(ax/c).toFixed(2),+dev.toFixed(2)]; }
     // before: same over 1.0-0.5 s before
     { let ax=0,c=0; for(let j=Math.max(0,k-50);j<k-25;j++){const m=Math.hypot(S.ax[j],S.ay[j],S.az[j]);ax+=Math.abs(S.ax[j])/m;c++;} f.axb=+(ax/Math.max(1,c)).toFixed(2); }
     res.push(f);}
   return res;},{work});
  r.forEach(x=>out.push({f:f.slice(7,40),s,...x}));}}
fs.writeFileSync('/tmp/clean_feat.json',JSON.stringify(out));
const C=out.filter(x=>x.clean),D=out.filter(x=>!x.clean);console.log('cleans',C.length,'others',D.length);
const rng=(A,fn)=>{const v=A.map(fn).sort((a,b)=>a-b);return v.length?`${v[0]}..${v[v.length-1]} (10%:${v[Math.floor(v.length*.1)]} 90%:${v[Math.floor(v.length*.9)]})`:'-';};
for(const w of ['w4','w6','w8']) for(const [i,nm] of [[0,'gyro max'],[1,'|ax|'],[2,'| |a|-1 |']]) console.log(w,nm.padEnd(10),'clean',rng(C,x=>x[w][i]).padEnd(36),'other',rng(D,x=>x[w][i]));
console.log('axb before  clean',rng(C,x=>x.axb),' other',rng(D,x=>x.axb));
await b.close();})();

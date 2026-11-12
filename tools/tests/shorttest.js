const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:390,height:900}});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('file://'+process.cwd()+'/index.html');
await pg.fill('#kg','20');await pg.click('#btnStart');
const rows=fs.readFileSync('data/replays/reps_half.csv','utf8').trim().split('\n').map(l=>l.split(',').map(Number));
const out=await pg.evaluate(async rows=>{let n=0;for(const r of rows){n++;addRep({devSet:r[1],devTotal:n,peak:r[4]/1000,devInterval:r[5],gyroPk:r[6]/10,sweep:r[7]/10,gyroLaunch:r[8]/10});}
 render();return {short:$('repsShort').textContent,reps:$('repsInSet').textContent,sets:$('sets').innerText,pow:$('powAvg').textContent};},rows);
console.log(out,errs);await pg.screenshot({path:'short.png',fullPage:true});await b.close();})();

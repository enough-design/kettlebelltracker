const { chromium } = require('playwright'); const fs = require('fs');
const f = process.argv[2], TRUTH = JSON.parse(process.argv[3]);
const [h, ...L] = fs.readFileSync('data/raw/' + f, 'utf8').trim().split('\n'); const H = h.split(','); const ix = n => H.indexOf(n);
const rows = L.map(l => l.split(',')).map(c => ({ t: +c[ix('t_epoch_ms')], ms: +c[ix('ms')], phase: c[ix('phase')], set: +c[ix('set')], ax: +c[ix('ax')], ay: +c[ix('ay')], az: +c[ix('az')], gx: +c[ix('gx')], gy: +c[ix('gy')], gz: +c[ix('gz')] }));
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext()).newPage();
  await page.goto('file://' + process.cwd() + '/index.html');
  for (const [s, truth] of Object.entries(TRUTH)) {
    const work = rows.filter(r => r.set === +s && r.phase === 'work');
    const res = await page.evaluate(({ work }) => {
      reps = []; raw = []; phases = []; setMeta = {}; curSet = 0; phase = 'idle'; pressLive = { set: 0, start: null, n: 0, short: 0 };
      $('move').value = 'press'; setPhase('work'); const seen = [];
      for (let i = 0; i < work.length; i += 25) { work.slice(i, i + 25).forEach(r => raw.push({ ...r, phase: 'work', set: curSet })); updatePressLive(); seen.push(pressLive.n); }
      setPhase('rest');
      const t0 = work[0].t; return { seen, final: pressCount(curSet), reps: setMeta[curSet].press.reps.map(r => [((r.t - t0) / 1000).toFixed(1), Math.round(r.rise * 100), r.short ? 'S' : '']) };
    }, { work });
    // compress live sequence: time(s):count at changes
    const ch = []; res.seen.forEach((v, i) => { if (!i || v !== res.seen[i - 1]) ch.push(`${(i * 0.5).toFixed(1)}s:${v}`); });
    console.log(`set ${s} truth ${truth} final ${res.final}${res.final === truth ? '' : '  <-- MISS'}\n   live changes ${ch.join(' ')}\n   reps ${JSON.stringify(res.reps)}`);
  }
  await b.close();
})();

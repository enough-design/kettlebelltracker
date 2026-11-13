// Replays every capture through the PAGE in Auto-detect mode and compares swings / cleans / presses with the truth table
// (tools/tests/truth_all.json, written from tools/analysis/all_truth.py). Run from the repo root: node tools/tests/autotest.js
const { chromium } = require('playwright'); const fs = require('fs');
const TRUTH = JSON.parse(fs.readFileSync('tools/tests/truth_all.json', 'utf8'));
function parse(f) {
  const [h, ...L] = fs.readFileSync('data/raw/' + f, 'utf8').trim().split('\n'); const H = h.split(','); const ix = n => H.indexOf(n);
  return L.map(l => l.split(',')).map(c => ({ t: +c[ix('t_epoch_ms')], ms: +c[ix('ms')], phase: c[ix('phase')], set: +c[ix('set')],
    ax: +c[ix('ax')], ay: +c[ix('ay')], az: +c[ix('az')], gx: +c[ix('gx')], gy: +c[ix('gy')], gz: +c[ix('gz')] }));
}
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + process.cwd() + '/index.html'); await page.evaluate(() => localStorage.clear()); await page.reload();
  const K = ['swings', 'presses', 'cleans']; const ok = { swings: 0, presses: 0, cleans: 0 }, tot = { swings: 0, presses: 0, cleans: 0 }, liveOk = { swings: 0, presses: 0, cleans: 0 };
  let ahead = 0, drops = 0;
  for (const [f, sets] of Object.entries(TRUTH)) {
    if (f.startsWith('kb_raw_2026-11-11-13-05-20')) continue;   // 28 Hz capture from before batching
    const rows = parse(f);
    for (const [s, tr] of Object.entries(sets)) {
      const work = rows.filter(r => r.set === +s && r.phase === 'work');
      const res = await page.evaluate(({ work }) => {
        reps = []; raw = []; phases = []; setMeta = {}; curSet = 0; phase = 'idle'; autoLive = { set: 0, hist: [], n: { swings: 0, cleans: 0, presses: 0 } };
        $('move').value = 'auto'; setPhase('work'); const seen = [];
        for (let i = 0; i < work.length; i += 25) { work.slice(i, i + 25).forEach(r => raw.push({ ...r, phase: 'work', set: curSet })); updateAutoLive(); seen.push({ ...autoLive.n }); }
        setPhase('rest'); render();
        return { seen, final: autoCounts(curSet), card: $('repsInSet').textContent, note: $('repsShort').textContent, short: autoShort(curSet) };
      }, { work });
      const truth = { swings: tr[0], presses: tr[1], cleans: tr[2] }; const bad = [];
      K.forEach(k => {
        if (truth[k] == null) return; tot[k]++;
        if (res.final[k] === truth[k]) ok[k]++; else bad.push(`${k} ${res.final[k]}/${truth[k]}`);
        const last = res.seen[res.seen.length - 1][k]; if (last === truth[k]) liveOk[k]++;
        if (Math.max(...res.seen.map(x => x[k])) > res.final[k]) ahead++;
        drops += res.seen.filter((x, i) => i && x[k] < res.seen[i - 1][k]).length;
      });
      console.log(`${f.slice(7, -4).padEnd(42)} set ${s}: card "${res.card}"  truth ${tr[0] ?? '?'} / ${tr[2] ?? '?'} / ${tr[1] ?? '?'}  short ${res.short} ${bad.length ? '<-- ' + bad.join(', ') : ''}`);
    }
  }
  console.log(`\nFINAL exact: swings ${ok.swings}/${tot.swings}, cleans ${ok.cleans}/${tot.cleans}, presses ${ok.presses}/${tot.presses}`);
  console.log(`LIVE right when Rest pressed: swings ${liveOk.swings}/${tot.swings}, cleans ${liveOk.cleans}/${tot.cleans}, presses ${liveOk.presses}/${tot.presses}; live ever above final in ${ahead} counts; live drops ${drops}; page errors: ${errs.length ? errs : 'none'}`);
  await b.close();
})();

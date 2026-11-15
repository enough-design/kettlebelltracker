// Auto-detect on labelled swing-only sets (Nano front and back, full and short): swings counted and short flags right.
// First rep of a set is not judged. Run from the repo root: node tools/tests/autoshorttest.js
const { chromium } = require('playwright'); const fs = require('fs');
const CASES = [['kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-16-16.csv', [1, 'F', 'front'], [2, 'S', 'front'], [3, 'S', 'front'], [4, 'F', 'back'], [5, 'S', 'back']],
  ['kb_raw_12kg-swing-trace_2026-11-15-10-59-51.csv', [1, 'F', 'front'], [2, 'F', 'back'], [3, 'F', 'back'], [4, 'F', 'front'], [5, 'F', 'back']],
  ['kb_raw_12kg-swing-trace_2026-11-15-10-39-17.csv', [1, 'F', 'back'], [2, 'F', 'front']], ['kb_raw_12kg-swings_2026-11-13-15-47-38.csv', [1, 'F', 'front']],
  ['kb_raw_2026-11-12-14-56-28_20kg_half-swings-set1.csv', [1, 'S', 'front'], [2, 'F', 'front']],
  ['kb_raw_2026-11-11-14-15-55_20kg_4sets.csv', [1, 'F', 'front'], [2, 'F', 'front'], [3, 'F', 'front'], [4, 'F', 'front']]];
function parse(f) { const [h, ...L] = fs.readFileSync('data/raw/' + f, 'utf8').trim().split('\n'); const H = h.split(','); const ix = n => H.indexOf(n);
  return L.map(l => l.split(',')).map(c => ({ t: +c[ix('t_epoch_ms')], ms: +c[ix('ms')], phase: c[ix('phase')], set: +c[ix('set')], ax: +c[ix('ax')], ay: +c[ix('ay')], az: +c[ix('az')], gx: +c[ix('gx')], gy: +c[ix('gy')], gz: +c[ix('gz')] })); }
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + process.cwd() + '/index.html'); let bad = 0;
  for (const [f, ...sets] of CASES) { const rows = parse(f);
    for (const [s, tr, mount] of sets) {
      const work = rows.filter(r => r.set === s && r.phase === 'work');
      const r = await pg.evaluate(({ work }) => { raw = work.map(q => ({ ...q, phase: 'work', set: 1 })); return OHP.labelSet(pressSamples(1)).swings.map(x => x.short ? 1 : 0); }, { work });
      const judged = r.slice(1), nS = judged.reduce((a, c) => a + c, 0);
      const ok = judged.length >= 8 && (tr === 'F' ? nS === 0 : nS === judged.length); if (!ok) bad++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${f.slice(7, 32).padEnd(25)} set ${s} ${mount.padEnd(5)} ${tr === 'F' ? 'full ' : 'short'}: ${r.length} swings, short ${nS}/${judged.length}`);
    } }
  console.log(bad ? `\n${bad} set(s) FAILED` : '\nall sets right', 'page errors:', errs.length ? errs : 'none'); await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();

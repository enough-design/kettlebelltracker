// Replays labelled swing sets through the page (real firmware rep packets from the harness + the raw stream, with a controlled clock)
// and checks the short flag per set. Needs g++ and playwright. Run from the repo root: node tools/tests/shortflagtest.js
const { chromium } = require('playwright'); const fs = require('fs'); const { execSync } = require('child_process');
execSync('g++ -std=c++17 -I tools/stubs -I firmware/kb_tracker tools/harness2.cpp -o /tmp/kb_harness2', { stdio: 'inherit' });
const LAT = 100;   // ms of BLE latency added to every packet
// file, set, expected: 'full' (no short reps) or 'short' (all reps short except possibly the first of the set)
const CASES = process.env.ONE ? JSON.parse(process.env.ONE) : [
  ['kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-29-57.csv', 1, 'full', 'back?'], ['kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-29-57.csv', 2, 'full', 'back?'], ['kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-29-57.csv', 3, 'full', 'back?'], ['kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-29-57.csv', 4, 'short', 'back?'],
  ['kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-16-16.csv', 1, 'full', 'front'], ['kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-16-16.csv', 2, 'short', 'front'],
  ['kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-16-16.csv', 3, 'short', 'front'], ['kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-16-16.csv', 4, 'full', 'back'],
  ['kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-16-16.csv', 5, 'short', 'back'],
  ['kb_raw_12kg-swing-trace_2026-11-15-10-59-51.csv', 1, 'full', 'front'], ['kb_raw_12kg-swing-trace_2026-11-15-10-59-51.csv', 2, 'full', 'back'],
  ['kb_raw_12kg-swing-trace_2026-11-15-10-59-51.csv', 3, 'full', 'back'], ['kb_raw_12kg-swing-trace_2026-11-15-10-59-51.csv', 4, 'full', 'front'],
  ['kb_raw_12kg-swing-trace_2026-11-15-10-59-51.csv', 5, 'full', 'back'], ['kb_raw_12kg-swing-trace_2026-11-15-10-39-17.csv', 1, 'full', 'back'],
  ['kb_raw_12kg-swing-trace_2026-11-15-10-39-17.csv', 2, 'full', 'front'], ['kb_raw_12kg-swings_2026-11-13-15-47-38.csv', 1, 'full', 'front'],
  ['kb_raw_2026-11-12-14-56-28_20kg_half-swings-set1.csv', 1, 'short', 'front'], ['kb_raw_2026-11-12-14-56-28_20kg_half-swings-set1.csv', 2, 'full', 'front'],
  ['kb_raw_2026-11-11-14-15-55_20kg_4sets.csv', 1, 'full', 'front'], ['kb_raw_2026-11-11-14-15-55_20kg_4sets.csv', 2, 'full', 'front'],
  ['kb_raw_2026-11-11-14-15-55_20kg_4sets.csv', 3, 'full', 'front'], ['kb_raw_2026-11-11-14-15-55_20kg_4sets.csv', 4, 'full', 'front'],
];
function load(f) {
  const [h, ...L] = fs.readFileSync('data/raw/' + f, 'utf8').trim().split('\n'); const H = h.split(','); const ix = n => H.indexOf(n);
  return L.map(l => l.split(',')).map(c => ({ t: +c[ix('t_epoch_ms')], ms: +c[ix('ms')], phase: c[ix('phase')], set: +c[ix('set')], ax: +c[ix('ax')], ay: +c[ix('ay')], az: +c[ix('az')], gx: +c[ix('gx')], gy: +c[ix('gy')], gz: +c[ix('gz')] }));
}
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext()).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + process.cwd() + '/index.html'); let bad = 0, firstBad = 0;
  const cache = {};
  for (const [f, s, want, mount] of CASES) {
    const rows = cache[f] || (cache[f] = load(f)); const work = rows.filter(r => r.set === s && r.phase === 'work');
    execSync(`/tmp/kb_harness2 dumprepsat data/raw/${f} /tmp/kb_reps.csv`, { stdio: 'ignore' });
    const byMs = new Map(rows.map(r => [r.ms, r.t]));
    const reps = fs.readFileSync('/tmp/kb_reps.csv', 'utf8').trim().split('\n').map(l => l.split(',').map(Number)).filter(r => r[1] === s || true)
      .map(r => ({ r, te: byMs.get(r[0]) })).filter(x => x.te != null && x.te >= work[0].t && x.te <= work[work.length - 1].t);
    const res = await page.evaluate(({ work, rp, LAT }) => {
      reps = []; raw = []; phases = []; setMeta = {}; curSet = 0; phase = 'idle'; let clock = work[0].t; Date.now = () => clock;
      $('move').value = 'swing'; $('kg').value = '12'; setPhase('work'); window.setMeta_ = 0;
      const ev = []; work.forEach(q => ev.push([q.t + LAT, 0, q])); rp.forEach(x => ev.push([x.te + LAT, 1, x.r])); ev.sort((a, c) => a[0] - c[0] || a[1] - c[1]);
      const live = [], pk = [];
      let n = 0;
      for (const [t, k, q] of ev) {
        clock = t;
        if (k === 0) raw.push({ t: t, ms: q.ms, phase: 'work', set: curSet, movement: 'swing', bell_kg: 12, ax: q.ax, ay: q.ay, az: q.az, gx: q.gx, gy: q.gy, gz: q.gz });
        else { n++; addRep({ devSet: q[1], devTotal: n, peak: q[4] / 1000, devInterval: q[5], gyroPk: q[6] / 10, sweep: q[7] / 10, gyroLaunch: q[8] / 10 }); const r = reps[reps.length - 1]; r.liveShort = isShort(r); }
      }
      clock += 3000; raw.push({ t: clock, ms: 0, phase: 'rest', set: curSet, ax: 0, ay: 0, az: 1000, gx: 0, gy: 0, gz: 0 });
      const mine = reps.filter(r => r.set === curSet && r.counted);
      return { per: mine.map(r => [r.peak.toFixed(2), r.depth == null ? '-' : r.depth.toFixed(2), isShort(r) ? 'S' : '.', r.liveShort ? 'L' : '.']), n: mine.length, finalShort: mine.map(r => isShort(r) ? 1 : 0), liveShort: mine.map(r => r.liveShort ? 1 : 0) };
    }, { work, rp: reps, LAT });
    const sh = res.finalShort.slice(1), ls = res.liveShort.slice(1);   // interior reps must be exact; the first rep (from a standstill) is reported
    const first = res.finalShort[0] === (want === 'short' ? 1 : 0) ? 'first rep ok' : 'first rep WRONG'; firstBad += first.endsWith('WRONG') ? 1 : 0;
    const nS = sh.reduce((a, c) => a + c, 0), nL = ls.reduce((a, c) => a + c, 0), m = sh.length;
    const ok = m >= 8 && (want === 'full' ? nS === 0 : nS === m);
    if (!ok) bad++;
    if (process.env.ONE) console.log(res.per.map((x, i) => (i + 1) + ':' + x.join('/')).join('  '));
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${f.slice(7, 32).padEnd(25)} set ${s} ${mount.padEnd(5)} ${want.padEnd(5)}: ${res.n} reps, final short ${nS}/${m}, live (peak only) short ${nL}/${m}, ${first}`);
  }
  console.log(bad ? `\n${bad} set(s) FAILED` : '\nall sets classified correctly (interior reps)', `; first reps wrong: ${firstBad}/${CASES.length};`, 'page errors:', errs.length ? errs : 'none');
  await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();

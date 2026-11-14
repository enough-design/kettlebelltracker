// Replays recorded swing sets through the swing-trace angle model (SWINGVIZ, pulled out of index.html) and checks the trace is usable:
// the sign is right after at most one flip, full swings peak high and consistently, the bell comes back down between reps, and a set of
// half swings peaks clearly lower than full swings. Rep times are found like the firmware does (float after a real swing).
// Run from the repo root: node tools/tests/viztest.js
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const src = html.slice(html.indexOf('/* SWINGVIZ-MODEL START */'), html.indexOf('/* SWINGVIZ-MODEL END */'));
const mk = () => new Function(src + '; return SWINGVIZ;')();
function parse(f) {
  const [h, ...L] = fs.readFileSync('data/raw/' + f, 'utf8').trim().split('\n'); const H = h.split(','); const ix = n => H.indexOf(n);
  return L.map(l => l.split(',')).map(c => ({ t: +c[ix('t_epoch_ms')], ms: +c[ix('ms')], phase: c[ix('phase')], set: +c[ix('set')],
    ax: +c[ix('ax')] / 1000, ay: +c[ix('ay')] / 1000, az: +c[ix('az')] / 1000, gx: +c[ix('gx')], gy: +c[ix('gy')], gz: +c[ix('gz')] }));
}
function run(V, rows, short) {
  V.reset(false); const reps = []; let hi = 0, lastRep = -1e9, flips = 0;
  for (const r of rows) {
    const a = Math.hypot(r.ax, r.ay, r.az); if (a > 1.5) hi = r.t;
    V.feed(r.ms, r.ax, r.ay, r.az, r.gx, r.gy, r.gz, r.t);
    if (a < 0.55 && r.t - hi < 1200 && r.t - lastRep > 900) { lastRep = r.t; const o = V.rep(r.t, short, reps.length + 1); if (o.flipped) flips++; reps.push(r.t); }
  }
  V.update(rows[rows.length - 1].t + 1000);
  const peaks = V.marks.map(m => m.th);   // marks are kept for 7.5 s only, so read peaks from the history instead
  const H = V.hist; const pk = [], tr = [];
  reps.forEach((t, i) => { let m = -1e9; H.forEach(h => { if (Math.abs(h.t - t - 100) < 250 && h.th > m) m = h.th; }); if (m > -1e9) pk.push(m);
    if (i) { let lo = 1e9; H.forEach(h => { if (h.t > reps[i - 1] + 300 && h.t < t - 300 && h.th < lo) lo = h.th; }); if (lo < 1e9) tr.push(lo); } });
  return { n: reps.length, flips, pk, tr };
}
// the history only keeps 7.5 s, so replay in a long-history copy
const longSrc = src.replace('KEEP_MS = 7500', 'KEEP_MS = 1e9');
const mkLong = () => new Function(longSrc + '; return SWINGVIZ;')();
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
let fail = 0; const ck = (ok, msg) => { if (!ok) { fail++; console.log('  FAIL: ' + msg); } };
const CASES = [
  ['kb_raw_2026-11-11-14-15-55_20kg_4sets.csv', 1, false, 'full'], ['kb_raw_2026-11-11-14-15-55_20kg_4sets.csv', 2, false, 'full'],
  ['kb_raw_2026-11-11-14-15-55_20kg_4sets.csv', 3, false, 'full'], ['kb_raw_2026-11-11-14-15-55_20kg_4sets.csv', 4, false, 'full'],
  ['kb_raw_2026-11-12-14-56-28_20kg_half-swings-set1.csv', 2, false, 'full'], ['kb_raw_2026-11-12-14-56-28_20kg_half-swings-set1.csv', 1, true, 'half'],
  ['kb_raw_12kg-swings_2026-11-13-15-47-38.csv', 1, false, 'full'],
];
const fullPk = [];
for (const [f, s, short, kind] of CASES) {
  const rows = parse(f).filter(r => r.phase === 'work' && r.set === s);
  const o = run(mkLong(), rows, short);
  console.log(`${f.slice(7, -4).padEnd(40)} set ${s} ${kind}: ${o.n} reps, flips ${o.flips}, peak median ${med(o.pk).toFixed(0)}, trough median ${o.tr.length ? med(o.tr).toFixed(0) : '-'}`);
  ck(o.n >= 9, 'expected about 10 reps'); ck(o.flips <= 1, 'sign flipped more than once');
  if (kind === 'full') { fullPk.push(med(o.pk.slice(2))); ck(med(o.pk.slice(2)) > 95 && med(o.pk.slice(2)) < 135, 'full-swing peak outside 95-135'); ck(med(o.tr.slice(1)) < -30, 'bell does not come back down between reps'); }
  else { ck(med(o.pk) < 105, 'half-swing peak not clearly lower'); o.half = med(o.pk); }
}
const halfRun = run(mkLong(), parse(CASES[5][0]).filter(r => r.phase === 'work' && r.set === 1), true);
ck(med(halfRun.pk) < med(fullPk) - 10, 'half swings should peak at least 10 degrees below full swings');
console.log(fail ? `\n${fail} check(s) FAILED` : '\nall checks passed');
process.exit(fail ? 1 : 0);

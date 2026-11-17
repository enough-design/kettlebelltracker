// Left / right and power for cleans and presses, through the PAGE (raw stream -> detectors -> Rest -> stored reps, balance, CSV).
// Truth: hand per clean from James's notes (16:05: sets 1-2 right, 3-5 left; 16:27: set 1 right, 2-3 left, 4 right then left after 3 reps).
// All other captures are right hand. Run from the repo root: node tools/tests/limbtest.js
const { chromium } = require('playwright'); const fs = require('fs');
function parse(f) {
  const [h, ...L] = fs.readFileSync('data/raw/' + f, 'utf8').trim().split('\n'); const H = h.split(','); const ix = n => H.indexOf(n);
  return L.map(l => l.split(',')).map(c => ({ t: +c[ix('t_epoch_ms')], ms: +c[ix('ms')], phase: c[ix('phase')], set: +c[ix('set')],
    ax: +c[ix('ax')], ay: +c[ix('ay')], az: +c[ix('az')], gx: +c[ix('gx')], gy: +c[ix('gy')], gz: +c[ix('gz')] }));
}
const R = n => 'R'.repeat(n), L = n => 'L'.repeat(n);
const CLEANS = {   // file -> set -> expected hand string, one letter per clean
  'kb_raw_12kg-cleans-RHS-and-LHS-test_2026-11-15-16-05-41.csv': { 1: R(10), 2: R(10), 3: L(10), 4: L(10), 5: L(5) },
  'kb_raw_12kg-cleans-test_2026-11-15-16-27-28.csv': { 1: R(5), 2: L(5), 3: L(5), 4: R(3) + L(3) },
  'kb_raw_12kg-cleans-test_2026-11-15-14-46-32.csv': { 1: R(5), 2: R(5) },
};
const PRESS = {    // file -> kg -> sets (press mode, right hand); [interior mean power from tools analysis, W] for a few sets as a cross-check
  'kb_raw_12kg-ohp-rh_2026-11-12-21-38-28.csv': { kg: 12, sets: [1, 2, 3], P: { 1: 104 } },
  'kb_raw_12kg-ohp-rh_2026-11-12-22-20-49.csv': { kg: 12, sets: [1, 2, 3], P: { 1: 131 } },
  'kb_raw_7-5kg-ohp-rh_2026-11-13-14-38-21.csv': { kg: 7.5, sets: [1, 3, 4], P: { 4: 85 } },
  'kb_raw_20kg-ohp-push-rh_2026-11-13-14-55-29.csv': { kg: 20, sets: [1, 2], P: { 2: 254 } },
  'kb_raw_12kg-ohp_2026-11-13-15-23-02.csv': { kg: 12, sets: [1, 2], P: { 2: 125 } },
  'kb_raw_12kg-press-test_2026-11-16-11-02-22.csv': { kg: 12, sets: [1, 2, 3], P: {} },
};
let pass = 0, fail = 0; const bad = [];
const check = (name, ok, extra) => { if (ok) pass++; else { fail++; bad.push(name + (extra ? ' :: ' + extra : '')); } };
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + process.cwd() + '/index.html#dev'); await page.evaluate(() => localStorage.clear()); await page.reload();
  // run one set through the page, in the given mode; keeps earlier sets (setMeta, curSet) so a whole session can be built up
  const runSet = (work, mode, kg, flip) => page.evaluate(({ work, mode, kg, flip }) => {
    handFlip = !!flip; $('kg').value = String(kg); $('move').value = mode; setPhase('work'); const liveHands = [];
    for (let i = 0; i < work.length; i += 12) {
      work.slice(i, i + 12).forEach(r => raw.push({ ...r, phase: 'work', set: curSet }));
      if (mode === 'clean') updateCleanFast(); else if (mode === 'press') updatePressLive(); else updateAutoLive();
    }
    const live = handLabel(curSet); const s = curSet; setPhase('rest');
    const m = setMeta[s];
    return { s, live, cleanHands: m.auto ? m.auto.cleans.map(c => c.hand || '?').join('') : '', pressHands: m.press ? m.press.reps.map(r => r.hand || '?').join('') : (m.auto ? m.auto.presses.map(r => r.hand || '?').join('') : ''),
      label: handLabel(s), lp: limbReps([s]).map(x => ({ mv: x.mv, P: x.P, E: x.E, T: x.T, hand: x.hand })), nPress: m.press ? m.press.reps.length : (m.auto ? m.auto.presses.length : 0),
      liveClean: moveOf(s) === 'clean' ? (setMeta[s].cleanLive ? setMeta[s].cleanLive.hands.join('') : '') : '' };
  }, { work, mode, kg, flip });

  // ---- 1. hand of every clean, Cleans mode (final and live) ----
  const allClean = {};
  for (const [f, sets] of Object.entries(CLEANS)) {
    const rows = parse(f);
    for (const [s, want] of Object.entries(sets)) {
      const work = rows.filter(r => r.set === +s && r.phase === 'work');
      const r = await runSet(work, 'clean', 12, false);
      allClean[f + '#' + s] = r;
      check(`clean hands ${f.slice(7, 40)} set ${s}`, r.cleanHands === want, `${r.cleanHands} vs ${want}`);
      check(`clean hands (live) ${f.slice(7, 40)} set ${s}`, r.liveClean === want, `${r.liveClean} vs ${want}`);
    }
  }
  // ---- 2. press hands (all right hand) and power in Press mode ----
  const pw = [];
  for (const [f, o] of Object.entries(PRESS)) {
    const rows = parse(f);
    for (const s of o.sets) {
      const work = rows.filter(r => r.set === +s && r.phase === 'work');
      const r = await runSet(work, 'press', o.kg, false);
      check(`press hands ${f.slice(7, 40)} set ${s}`, r.nPress > 0 && r.pressHands === R(r.nPress), r.pressHands);
      check(`press set label ${f.slice(7, 40)} set ${s}`, r.label === 'R', r.label);
      const ps = r.lp.filter(x => x.mv === 'press');
      check(`press power exists, edges left out ${f.slice(7, 40)} set ${s}`, ps.length >= 1 && ps.length <= r.nPress - 2, `${ps.length} of ${r.nPress}`);   // first and last rep and short (half) presses carry no power
      const mp = ps.reduce((a, x) => a + x.P, 0) / (ps.length || 1);
      pw.push([f.slice(7, 30) + ' s' + s, o.kg, r.nPress, ps.length, Math.round(mp)]);
      check(`press power plausible ${f.slice(7, 40)} set ${s}`, mp > 25 && mp < 350, String(mp));
      if (o.P[s] != null) check(`press power matches the analysis script ${f.slice(7, 40)} set ${s}`, Math.abs(mp - o.P[s]) / o.P[s] < 0.12, `${Math.round(mp)} vs ${o.P[s]}`);
    }
  }
  // ---- 3. Auto mode: hands on a mixed capture (12:13, right hand): cleans and presses all R, clean power present, no press power ----
  { const f = 'kb_raw_12kg-auto-test_2026-11-15-12-13-23.csv', rows = parse(f);
    for (const s of [1, 2, 4, 7]) {
      const r = await runSet(rows.filter(q => q.set === s && q.phase === 'work'), 'auto', 12, false);
      check(`auto hands set ${s}`, /^R+$/.test(r.cleanHands) && /^R+$/.test(r.pressHands), r.cleanHands + ' / ' + r.pressHands);
      check(`auto set label set ${s}`, r.label === 'R', r.label);
      check(`auto: clean power yes, press power no, set ${s}`, r.lp.some(x => x.mv === 'clean') && !r.lp.some(x => x.mv === 'press'));
    } }
  // ---- 4. the Swap switch: the same right-hand clean set reads L ----
  { const f = 'kb_raw_12kg-cleans-RHS-and-LHS-test_2026-11-15-16-05-41.csv', rows = parse(f);
    const r = await runSet(rows.filter(q => q.set === 1 && q.phase === 'work'), 'clean', 12, true);
    check('swap switch flips cleans', r.cleanHands === L(10), r.cleanHands);
    const rp = await runSet(parse('kb_raw_12kg-ohp-rh_2026-11-12-21-38-28.csv').filter(q => q.set === 1 && q.phase === 'work'), 'press', 12, true);
    check('swap switch flips presses', rp.pressHands === L(rp.nPress), rp.pressHands);
    await page.evaluate(() => { handFlip = false; }); }
  // ---- 5. clean power values and left / right balance on the 16:05 file (same bell, 20 right-hand and 25 left-hand cleans) ----
  const cp = [], ps = {};
  for (const [k, r] of Object.entries(allClean)) if (k.includes('16-05-41')) { const P = r.lp.map(x => x.P); cp.push([k.slice(-3), Math.round(P.reduce((a, b) => a + b, 0) / P.length), P.length]); }
  cp.forEach(x => check(`clean power plausible set ${x[0]}`, x[1] > 40 && x[1] < 160, String(x[1])));
  // ---- 6. balance + CSV over a whole mixed workout built through the user view's own state ----
  const out = await page.evaluate(() => {
    reps = []; raw = []; phases = []; setMeta = {}; curSet = 0; phase = 'idle'; handFlip = false;
    return null;
  });
  const f16 = 'kb_raw_12kg-cleans-RHS-and-LHS-test_2026-11-15-16-05-41.csv', rows16 = parse(f16);
  const sess = [];
  for (const s of [1, 2, 3, 4, 5]) {
    const r = await runSet(rows16.filter(q => q.set === s && q.phase === 'work'), 'clean', 12, false);
    sess.push(r.s);
  }
  const bal = await page.evaluate(sets => { sets.forEach(s => { setMeta[s].hand = 'A'; setMeta[s].workout = 'w1'; }); const b = balance(limbReps(sets));
    let csv = ''; const dl = download; download = (n, t) => { csv = t; }; $('btnCsv').onclick(); download = dl;
    return { b, csv, labels: sets.map(handLabel) }; }, sess);
  check('balance: one clean group', bal.b.length === 1 && bal.b[0].mv === 'clean' && bal.b[0].kg === 12, JSON.stringify(bal.b));
  const B = bal.b[0];
  check('balance: reps per side', B && B.R.n === 20 && B.L.n === 25, B && `${B.R.n}/${B.L.n}`);
  check('balance: enough reps', B && B.ok);
  check('set labels (Auto)', bal.labels.join() === 'R,R,L,L,L', bal.labels.join());
  const H = bal.csv.split('\n')[0].split(','), col = n => H.indexOf(n);
  check('CSV has new columns', ['power_time_s', 'hand_detected', 'in_balance'].every(n => col(n) >= 0));
  const lines = bal.csv.trim().split('\n').slice(1).map(l => l.split(','));
  check('CSV: hand column follows the detector', lines.every(c => c[col('hand')] === c[col('hand_detected')] && (c[col('hand')] === 'R' || c[col('hand')] === 'L')), 'hand/hand_detected');
  check('CSV: cleans carry power and energy', lines.every(c => +c[col('power_w')] > 0 && +c[col('energy_j')] > 0), '');
  // a clear difference must be reported as such: make the left side 15% slower and rerun the maths
  const syn = await page.evaluate(() => { const mk = (h, P, n) => Array.from({ length: n }, (_, i) => ({ mv: 'clean', kg: 12, hand: h, E: 60, P: P * (1 + 0.04 * Math.sin(i * 2.1)), ref: {} }));
    return { slow: balance(mk('R', 100, 12).concat(mk('L', 85, 12))), even: balance(mk('R', 100, 12).concat(mk('L', 99, 12))), few: balance(mk('R', 100, 4).concat(mk('L', 70, 12))), oneSide: balance(mk('R', 100, 12)) }; });
  check('balance: 15% gap is clear and on the left', syn.slow[0].clear && syn.slow[0].lower === 'L' && Math.abs(syn.slow[0].pct - 15) < 2, JSON.stringify(syn.slow[0]));
  check('balance: 1% gap is within noise', !syn.even[0].clear);
  check('balance: a tiny but consistent gap (3%) is not called', !(await page.evaluate(() => { const mk = (h, P) => Array.from({ length: 40 }, (_, i) => ({ mv: 'clean', kg: 12, hand: h, E: 60, P: P + 0.1 * Math.sin(i), ref: {} })); return balance(mk('R', 100).concat(mk('L', 97)))[0].clear; })));
  check('balance: too few reps is not judged', !syn.few[0].ok && !syn.few[0].clear);
  check('balance: one side only gives nothing', syn.oneSide.length === 0);
  check('no page errors', errs.length === 0, errs.join(' | '));

  console.log('\nclean power (relative W, 12 kg, lift 0.50 m) per set of the 16:05 file:', JSON.stringify(cp));
  console.log('press power per set (capture, kg, presses, with power, mean W):'); pw.forEach(x => console.log('  ', x.join('  ')));
  if (B) console.log('balance on the 16:05 cleans: R', Math.round(B.R.P), 'W (n', B.R.n + ') vs L', Math.round(B.L.P), 'W (n', B.L.n + '):', JSON.stringify({ pct: +B.pct.toFixed(1), clear: B.clear, lower: B.lower }));
  console.log(`\n${pass} passed, ${fail} failed`); bad.forEach(x => console.log('  FAIL', x));
  await b.close(); process.exit(fail ? 1 : 0);
})();

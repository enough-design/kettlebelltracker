// Clean dial through the PAGE: replays every recorded Cleans set (5-sample packets, as from the Nano) through the same path as the
// Bluetooth handler (CLEANVIZ.feed per sample, then the live clean count), and checks that every live clean fired the dial and tone,
// that the needle was in the rack (twist 180-360 deg) when each clean was counted, and that it came back to the hang between cleans.
// Also checks the card shows for Cleans and Swings and hides for Press and Auto. Run from the repo root: node tools/tests/cleanviztest.js [shot.png]
const { chromium } = require('playwright'); const fs = require('fs');
const FILES = fs.readdirSync('data/raw').filter(f => /clean/i.test(f));
function parse(f) {
  const [h, ...L] = fs.readFileSync('data/raw/' + f, 'utf8').trim().split('\n'); const H = h.split(','); const ix = n => H.indexOf(n);
  return L.map(l => l.split(',')).map(c => ({ t: +c[ix('t_epoch_ms')], ms: +c[ix('ms')], phase: c[ix('phase')], set: +c[ix('set')],
    ax: +c[ix('ax')], ay: +c[ix('ay')], az: +c[ix('az')], gx: +c[ix('gx')], gy: +c[ix('gy')], gz: +c[ix('gz')] }));
}
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + process.cwd() + '/index.html'); await page.evaluate(() => localStorage.clear()); await page.reload();
  let fail = 0; const ck = (ok, msg) => { if (!ok) { fail++; console.log('  FAIL: ' + msg); } };
  const vis = () => page.$eval('#vizCard', e => getComputedStyle(e).display !== 'none');
  const title = () => page.$eval('#vizTitle', e => e.textContent);
  for (const [m, want, t] of [['clean', true, 'CLEAN DIAL'], ['press', false], ['auto', false], ['swing', true, 'SWING TRACE'], ['clean', true, 'CLEAN DIAL']]) {
    await page.selectOption('#move', m); const v = await vis(); ck(v === want, `${m}: card ${v ? 'shown' : 'hidden'}`);
    if (t) ck(await title() === t, `${m}: title ${await title()}`);
  }
  const atCount = [], lows = [];
  for (const f of FILES) {
    const rows = parse(f);
    for (const s of [...new Set(rows.filter(r => r.phase === 'work').map(r => r.set))]) {
      const work = rows.filter(r => r.set === s && r.phase === 'work');
      const res = await page.evaluate(({ work }) => {
        reps = []; raw = []; phases = []; setMeta = {}; curSet = 0; phase = 'idle'; autoLive = { set: 0, hist: [], n: { swings: 0, cleans: 0, presses: 0 } };
        $('move').value = 'clean'; setPhase('work');
        const tw = [], between = []; let minSince = 1e9;
        for (let i = 0; i < work.length; i += 5) {
          work.slice(i, i + 5).forEach(r => { raw.push({ ...r, phase: 'work', set: curSet }); CLEANVIZ.feed(r.ms, r.ax / 1000, r.ay / 1000, r.az / 1000, r.gx, r.gy, r.gz, Date.now()); minSince = Math.min(minSince, CLEANVIZ.twist); });
          const before = vizCleanSeen.n;
          if (updateCleanFast()) { vizCleanCount(); render(); }
          if (vizCleanSeen.n > before) { tw.push(Math.round(CLEANVIZ.twist)); if (before > 0) between.push(Math.round(minSince)); minSince = 1e9; }
        }
        return { live: cleanFast.n, fired: vizCleanSeen.n, tw, between };
      }, { work });
      console.log(`${f.slice(7, -4).padEnd(44)} set ${s}: ${res.live} live cleans, dial fired ${res.fired}; twist at count ${res.tw.join(' ')}; lowest between ${res.between.join(' ')}`);
      ck(res.fired === res.live, 'dial/tone did not fire once per live clean');
      atCount.push(...res.tw); lows.push(...res.between);
    }
  }
  const inRack = atCount.filter(x => x >= 180 && x <= 360).length, back = lows.filter(x => x < 60).length;
  console.log(`\nneedle in the rack at the count: ${inRack}/${atCount.length}; back near the hang between cleans: ${back}/${lows.length}`);
  ck(inRack >= atCount.length * 0.95, 'needle not in the rack at the count often enough'); ck(back >= lows.length * 0.95, 'needle does not come back down between cleans');
  // simulator + screenshot
  await page.evaluate(() => { reps = []; raw = []; phases = []; setMeta = {}; curSet = 0; phase = 'idle'; $('move').value = 'clean'; updateButtons(); render(); });
  await page.click('#btnStart'); await page.click('#btnSim'); await page.waitForTimeout(8300);
  const sim = await page.evaluate(() => ({ n: cleanFast.n, card: $('repsInSet').textContent }));
  ck(sim.n >= 2 && sim.card === String(sim.n), `simulator: ${sim.n} cleans, card ${sim.card}`);
  if (process.argv[2]) await page.locator('#vizCard').screenshot({ path: process.argv[2] });
  await page.click('#btnSim');
  console.log(`simulator: ${sim.n} cleans, reps card ${sim.card}; page errors: ${errs.length ? errs : 'none'}`);
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();

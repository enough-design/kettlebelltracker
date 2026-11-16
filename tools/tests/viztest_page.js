// Page smoke test for the swing trace card: shown for Swings only, fed by the simulator, no page errors.
// Run from the repo root: node tools/tests/viztest_page.js [screenshot.png]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto('file://' + process.cwd() + '/index.html#dev'); await page.evaluate(() => localStorage.clear()); await page.reload();
  const vis = () => page.$eval('#vizCard', e => getComputedStyle(e).display !== 'none');
  const out = [];
  out.push(['swings selected: card visible', await vis(), true]);
  await page.selectOption('#move', 'press'); out.push(['press selected: card hidden', await vis(), false]);
  await page.selectOption('#move', 'auto'); out.push(['auto selected: card hidden', await vis(), false]);
  await page.selectOption('#move', 'swing'); out.push(['swings again: card visible', await vis(), true]);
  await page.click('#btnStart'); await page.click('#btnSim'); await page.waitForTimeout(9000);
  const s = await page.evaluate(() => ({ reps: reps.filter(r => r.counted).length, marks: SWINGVIZ.marks.length, hist: SWINGVIZ.hist.length, short: reps.filter(isShort).length, tone: TONE.on }));
  out.push(['simulated reps counted (>=4)', s.reps >= 4, true]); out.push(['trace history filled', s.hist > 100, true]); out.push(['rep dots placed', s.marks >= 3, true]);
  if (process.argv[2]) await page.locator('#vizCard').screenshot({ path: process.argv[2] });
  await page.click('#btnSim'); await page.click('#btnRest');
  await page.selectOption('#move', 'press'); out.push(['press selected after set: card hidden', await vis(), false]);
  let fail = 0; out.forEach(([n, got, want]) => { const ok = got === want; if (!ok) fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n); });
  console.log('sim:', JSON.stringify(s), 'page errors:', errs.length ? errs : 'none');
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();

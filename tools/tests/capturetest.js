// Mixed swing + press session: checks movement/weight per set, press ignores swing counter, your_count, name/description, CSV escaping
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + process.cwd() + '/index.html'); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.evaluate(() => { window.__dl = []; download = (n, t) => window.__dl.push({ n, t }); });
  const reps = JSON.parse(fs.readFileSync('data/replays/reps4_hex.json', 'utf8'));
  const feedRep = a => page.evaluate(h => h.forEach(x => { const u = new Uint8Array(x.match(/../g).map(c => parseInt(c, 16))); onRep(new DataView(u.buffer)); }), a);
  const feedRaw = () => page.evaluate(() => { const u = new Uint8Array(6 + 3 * 13); u[5] = 3; for (let i = 0; i < 3; i++) u[6 + i * 13] = i * 20; onRaw(new DataView(u.buffer)); });
  await page.fill('#sname', 'Mixed Test #1'); await page.fill('#sdesc', 'bell on left, "slow" tempo, 2 sets');
  await page.fill('#kg', '20'); await page.click('#btnStart'); await feedRaw(); await feedRep(reps.slice(0, 10)); await page.click('#btnRest');
  await page.selectOption('#move', 'press'); await page.fill('#kg', '12'); await page.click('#btnStart'); await feedRaw(); await feedRep(reps.slice(10, 14));
  const midDisabled = await page.$eval('#move', e => e.disabled);
  await page.click('#btnStop'); await page.fill('input.mine[data-set="2"]', '8'); await page.fill('input.mine[data-set="1"]', '10'); await page.fill('input.note[data-set="2"]', 'reps 6, 7 half "slow"');
  await page.evaluate(() => render());   // focus-safe table redraw
  const rows = await page.$$eval('#sets tr', trs => trs.map(tr => [...tr.children].map(td => td.querySelector('input') ? 'in=' + td.querySelector('input').value : td.textContent)));
  const total = await page.$eval('#total', e => e.textContent);
  await page.click('#btnCsv'); await page.click('#btnRawCsv');
  const dl = await page.evaluate(() => window.__dl);
  console.log({ midDisabled, total }); rows.forEach(r => console.log(JSON.stringify(r)));
  for (const d of dl) { const L = d.t.split('\n'); console.log('\n' + d.n + '\n' + L[0] + '\n' + L[1] + '\n' + L[L.length - 1]); }
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
})();

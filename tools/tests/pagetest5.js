const { chromium } = require('playwright'); const fs = require('fs'); const S = process.argv[2];
async function run(page, hexfile, sizes, kg) {
  await page.goto('file://'+process.cwd()+'/index.html'); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.fill('#kg', String(kg));
  const reps = JSON.parse(fs.readFileSync(`${S}/${hexfile}`, 'utf8')); let o = 0;
  const feed = a => page.evaluate(h => h.forEach(x => { const u = new Uint8Array(x.match(/../g).map(c => parseInt(c, 16))); onRep(new DataView(u.buffer)); }), a);
  for (let s = 0; s < sizes.length; s++) { await page.click('#btnStart'); await feed(reps.slice(o, o + sizes[s])); o += sizes[s]; if (s < sizes.length - 1) await page.click('#btnRest'); }
  return page.evaluate(() => ({ rows: [...document.querySelectorAll('#sets tr')].map(tr => [...tr.children].map(td => td.textContent).slice(0, 7)),
    hint: document.getElementById('radHint').textContent, note: document.getElementById('pnote').textContent.slice(-150),
    energy: document.getElementById('energy').textContent, powAvg: document.getElementById('powAvg').textContent }));
}
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  for (const [f, sizes, kg, label] of [['reps4_hex.json', [10,10,10,10], 12, '12 kg'], ['reps20_hex.json', [11,10,10,10], 20, '20 kg']]) {
    const r = await run(page, f, sizes, kg);
    console.log(`\n=== ${label} === [set, reps, swing s, peak g, power W, work kJ]`); r.rows.forEach(x => console.log('  ', JSON.stringify(x)));
    console.log('radius hint:', r.hint); console.log('note tail  :', r.note);
  }
  // user changes the radius setting
  await page.click('details.adv summary'); await page.fill('#rad', '0.70'); console.log('\nafter setting radius 0.70 (20 kg run):', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#sets tr')].map(tr => tr.children[4].textContent))));
  const lay = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth })); console.log('scrollWidth', lay.sw, 'vs', lay.iw);
  await page.fill('#rad', ''); await page.screenshot({ path: `${S}/page_phone2.png`, clip: { x: 0, y: 0, width: 390, height: 700 } });
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
})();

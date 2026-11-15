// Cleans mode through the PAGE: every labelled set with a known clean count (clean-only and mixed sets), checking the big count, the
// sets table, the reps CSV (cleans only, set_mode clean) and the total. Run from the repo root: node tools/tests/cleantest.js
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
  let n = 0, ok = 0, okOnly = 0, nOnly = 0, live = 0, uiBad = 0, over = 0; const lat = [];
  for (const [f, sets] of Object.entries(TRUTH)) {
    if (f.startsWith('kb_raw_2026-11-11-13-05-20')) continue;
    const rows = parse(f);
    for (const [s, tr] of Object.entries(sets)) {
      if (tr[2] == null) continue;
      const work = rows.filter(r => r.set === +s && r.phase === 'work'); if (!work.length) continue;
      const res = await page.evaluate(({ work }) => {
        reps = []; raw = []; phases = []; setMeta = {}; curSet = 0; phase = 'idle'; autoLive = { set: 0, hist: [], n: { swings: 0, cleans: 0, presses: 0 } };
        $('move').value = 'clean'; setPhase('work'); let lastLive = 0;
        const inc = []; let shown = 0, maxShown = 0;   // packets of 5 samples (about 10 per second), as from the Nano
        for (let i = 0; i < work.length; i += 5) { work.slice(i, i + 5).forEach(r => raw.push({ ...r, phase: 'work', set: curSet })); if (updateCleanFast()) render();
          if (i % 25 === 0) { updateAutoLive(); render(); }
          const v = +$('repsInSet').textContent || 0; if (v > shown) { for (let c = shown; c < v; c++) inc.push(raw[raw.length - 1].t); shown = v; } maxShown = Math.max(maxShown, v); }
        lastLive = $('repsInSet').textContent;
        setPhase('rest'); render();
        let csv = ''; const dl = download; download = (n, t) => { csv = t; }; $('btnCsv').onclick(); download = dl;
        return { card: $('repsInSet').textContent, live: lastLive, note: $('repsShort').textContent, row: $('sets').querySelector('tr:last-child') ? $('sets').querySelector('tr:last-child').textContent : '',
                 total: $('total').textContent, csv, inc, maxShown, finals: setMeta[curSet].auto.cleans.map(r => r.t) };
      }, { work });
      n++; const want = String(tr[2]); const only = !tr[0] && !tr[1] && tr[2] > 0; if (only) nOnly++;
      if (res.card === want) { ok++; if (only) okOnly++; }
      if (res.live === want) live++;
      if (res.maxShown > tr[2]) over++;
      res.finals.forEach((tf, i) => { if (res.inc[i] != null) lat.push((res.inc[i] - tf) / 1000); });
      const lines = res.csv.trim().split('\n'), H = lines[0].split(','), cm = H.indexOf('movement'), sm = H.indexOf('set_mode');
      const body = lines.slice(1).map(l => l.split(','));
      const csvOk = body.length === tr[2] && body.every(c => c[cm] === 'clean' && c[sm] === 'clean');
      const rowOk = res.row.includes('Clean') && res.row.includes(want) && res.total === want;
      if (!csvOk || !rowOk) uiBad++;
      console.log(`${res.card === want ? 'ok  ' : 'MISS'} ${f.slice(7, -4).padEnd(44)} set ${s}${only ? ' (clean only)' : ''}: ${res.card} for ${want}, live ${res.live}, "${res.note}"${csvOk ? '' : ' CSV BAD'}${rowOk ? '' : ' TABLE/TOTAL BAD'}`);
    }
  }
  lat.sort((a, c) => a - c); const q = x => lat[Math.floor(x * (lat.length - 1))].toFixed(2);
  console.log(`\nfinal exact ${ok}/${n} (clean-only sets ${okOnly}/${nOnly}); live right at Rest ${live}/${n}; live ever above truth in ${over} sets; delay from the pull to the count: median ${q(0.5)} s, 90% ${q(0.9)} s, max ${q(1)} s; UI/CSV problems ${uiBad}; page errors: ${errs.length ? errs : 'none'}`);
  await b.close(); process.exit(ok === n && live === n && !over && !uiBad && !errs.length ? 0 : 1);
})();

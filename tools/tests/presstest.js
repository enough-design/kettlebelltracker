// Replays every labelled overhead-press set from data/raw through the PAGE (raw stream -> live count -> Rest -> final count)
// Usage: node tools/tests/presstest.js   (run from the repo root)
const { chromium } = require('playwright'); const fs = require('fs');
const TRUTH = {   // file: {set: truth}
  'kb_raw_12kg-ohp-rh_2026-11-12-21-38-28.csv': { 1: 8, 2: 8, 3: 8 },
  'kb_raw_12kg-ohp-rh_2026-11-12-21-55-53.csv': { 1: 8, 3: 8 },
  'kb_raw_12kg-ohp-rh_2026-11-12-22-20-49.csv': { 1: 8, 2: 8, 3: 8 },
  'kb_raw_12kg-ohp-rh_2026-11-12-22-34-47.csv': { 1: 8, 2: 8 },
  'kb_raw_12kg-ohp-rh_2026-11-12-22-57-53.csv': { 1: 8, 2: 8, 3: 8, 4: 0 },
  'kb_raw_12kg-ohp-rh_2026-11-13-14-27-50.csv': { 1: 8, 2: 10 },
  'kb_raw_7-5kg-ohp-rh_2026-11-13-14-38-21.csv': { 1: 8, 2: 4, 3: 10, 4: 8 },
  'kb_raw_20kg-ohp-push-rh_2026-11-13-14-55-29.csv': { 1: 8, 2: 8, 3: 4 },
  'kb_raw_12kg-ohp_2026-11-13-15-23-02.csv': { 1: 8, 2: 8, 4: 4, 5: 4 },   // set 3 unscored (4 or 5)
  'kb_raw_12kg-ohp_2026-11-13-15-44-05.csv': { 1: 8, 2: 6, 3: 4, 4: 4 },
  'kb_raw_12kg-press-test_2026-11-16-11-02-22.csv': { 1: 10, 2: 10, 3: 10 },   // varied pace, very slow lowering in sets 2 and 3
};
function parse(f) {
  const [h, ...L] = fs.readFileSync('data/raw/' + f, 'utf8').trim().split('\n'); const H = h.split(',');
  const ix = n => H.indexOf(n);
  return L.map(l => l.split(',')).map(c => ({ t: +c[ix('t_epoch_ms')], ms: +c[ix('ms')], phase: c[ix('phase')], set: +c[ix('set')],
    ax: +c[ix('ax')], ay: +c[ix('ay')], az: +c[ix('az')], gx: +c[ix('gx')], gy: +c[ix('gy')], gz: +c[ix('gz')] }));
}
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + process.cwd() + '/index.html#dev'); await page.evaluate(() => localStorage.clear()); await page.reload();
  let ok = 0, tot = 0, liveOk = 0; const lat = []; let phantom = 0;
  for (const [f, sets] of Object.entries(TRUTH)) {
    const rows = parse(f);
    for (const [s, truth] of Object.entries(sets)) {
      const work = rows.filter(r => r.set === +s && r.phase === 'work');
      for (const OFF of (process.env.OFFS || '0').split(',').map(Number)) {
      const res = await page.evaluate(({ work, OFF }) => {
        reps = []; raw = []; phases = []; setMeta = {}; curSet = 0; phase = 'idle'; pressLive = { set: 0, hist: [], n: 0 };
        $('move').value = 'press'; setPhase('work');
        const seen = [], inc = [];
        for (let i = OFF; i < work.length; i += 12) {           // feed about 0.25 s at a time, like the page's press timer
          work.slice(i === OFF ? 0 : i, i + 12).forEach(r => raw.push({ ...r, phase: 'work', set: curSet }));
          const n0 = pressLive.n; updatePressLive(); seen.push(pressLive.n);
          for (let c = n0; c < pressLive.n; c++) inc.push(raw[raw.length - 1].t);
        }
        const finT = OHP.finalReps(pressSamples(curSet)).map(r => pressSamples(curSet).epoch[r.k]);
        const live = pressLive.n;
        setPhase('rest'); render();
        return { live, seen, lat: finT.map((t, i) => inc[i] != null ? (inc[i] - t) / 1000 : null).filter(v => v != null), over: Math.max(0, ...seen), final: pressCount(curSet), short: pressShort(curSet), card: $('repsInSet').textContent, note: $('repsShort').textContent,
                 row: [...document.querySelectorAll('#sets tr')].map(tr => tr.innerText.replace(/\s+/g, ' ')).pop() };
      }, { work, OFF });
      tot++; ok += res.final === truth; liveOk += res.live === truth; lat.push(...res.lat); if (res.over > truth) phantom++;
      const drops = res.seen.filter((v, i) => i && v < res.seen[i - 1]).length;
      console.log(`${f.slice(7, 40).padEnd(34)} set ${s}: truth ${String(truth).padStart(2)}  live-at-end ${String(res.live).padStart(2)}  final ${String(res.final).padStart(2)} ${res.final === truth ? '' : '<-- MISS'}  short ${res.short}  drops ${drops}  card "${res.card}" "${res.note}"`);
    }
    }
  }
  lat.sort((a, c) => a - c); const q = x => lat[Math.floor(x * (lat.length - 1))].toFixed(2);
  console.log(`\nfinal exact ${ok}/${tot}; live count equal to truth when Rest pressed ${liveOk}/${tot}; live ever above truth in ${phantom} sets; delay from lockout to the live count: median ${q(0.5)} s, 90% ${q(0.9)} s, max ${q(1)} s; page errors: ${errs.length ? errs : 'none'}`);
  await b.close(); process.exit(ok === tot && liveOk === tot && !phantom && !errs.length ? 0 : 1);
})();

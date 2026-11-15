// One capture through the page in Auto mode: counts per set and every labelled rep in time order (S swing, C clean, P press; * = short).
// Run from the repo root: node tools/tests/replay_auto.js <file in data/raw>
const { chromium } = require('playwright'); const fs = require('fs');
const f = process.argv[2];
const [h, ...L] = fs.readFileSync('data/raw/' + f, 'utf8').trim().split('\n'); const H = h.split(','); const ix = n => H.indexOf(n);
const rows = L.map(l => l.split(',')).map(c => ({ t: +c[ix('t_epoch_ms')], ms: +c[ix('ms')], phase: c[ix('phase')], set: +c[ix('set')], ax: +c[ix('ax')], ay: +c[ix('ay')], az: +c[ix('az')], gx: +c[ix('gx')], gy: +c[ix('gy')], gz: +c[ix('gz')] }));
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage(); await pg.goto('file://' + process.cwd() + '/index.html');
  for (const s of [...new Set(rows.filter(r => r.phase === 'work').map(r => r.set))]) {
    const work = rows.filter(r => r.set === s && r.phase === 'work');
    const r = await pg.evaluate(({ work }) => {
      raw = work.map(q => ({ ...q, phase: 'work', set: 1 })); const S = pressSamples(1), L = OHP.labelSet(S);
      const ev = [...L.swings.map(x => [S.t[x.k], 'S' + (x.short ? '*' : ''), 'pk' + x.apk.toFixed(2) + ' d' + x.depth.toFixed(2)]), ...L.cleans.map(x => [S.t[x.k], 'C', '']), ...L.presses.map(x => [S.t[x.k], 'P' + (x.short ? '*' : ''), Math.round(x.rise * 100) + 'cm'])].sort((a, c) => a[0] - c[0]);
      return { n: [L.swings.length, L.cleans.length, L.presses.length], ev: ev.map(e => e[0].toFixed(1) + ' ' + e[1] + (e[2] ? '(' + e[2] + ')' : '')) };
    }, { work });
    console.log(`set ${s}: ${r.n[0]} sw / ${r.n[1]} cl / ${r.n[2]} pr\n   ${r.ev.join('  ')}`);
  }
  await b.close();
})();

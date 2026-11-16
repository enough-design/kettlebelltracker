// User view end to end: a whole free workout through the user-facing screens, on the same page state as the diagnostic view.
// Swings and cleans run on the page's own simulator; a press set and an Auto set replay real captures through the raw-stream path
// (press: capture A set 1, 8 presses; Auto: 12:13 set 1, truth 4 swings / 5 cleans / 4 presses, counting the clean before the presses, Nano on the back).
// Checks: user view is the default and #dev opens the diagnostic view; Start needs a tracker; each in-set screen shows the page's
// own count; Rest shows the finished set and Fix writes "your count"; the summary adds up; the reps CSV carries hand and workout id;
// Home shows the last workout; the view switch moves the trace/dial card both ways. Run from the repo root:
//   node tools/tests/userviewtest.js [screenshot-folder]
const { chromium } = require('playwright'); const fs = require('fs');
const SHOTS = process.argv[2];
function rowsOf(f, set) {
  const [h, ...L] = fs.readFileSync('data/raw/' + f, 'utf8').trim().split('\n'); const H = h.split(','); const ix = n => H.indexOf(n);
  return L.map(l => l.split(',')).map(c => ({ t: +c[ix('t_epoch_ms')], ms: +c[ix('ms')], phase: c[ix('phase')], set: +c[ix('set')],
    ax: +c[ix('ax')], ay: +c[ix('ay')], az: +c[ix('az')], gx: +c[ix('gx')], gy: +c[ix('gy')], gz: +c[ix('gz')] })).filter(r => r.phase === 'work' && r.set === set);
}
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 400, height: 900 }, deviceScaleFactor: 1.5, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  let fail = 0, n = 0; const ck = (ok, msg) => { n++; if (!ok) { fail++; console.log('  FAIL: ' + msg); } else console.log('  ok   ' + msg); };
  const shot = async name => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
  const vis = sel => page.$eval(sel, e => !!(e.offsetWidth || e.offsetHeight));
  const txt = sel => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
  const url = 'file://' + process.cwd() + '/index.html';

  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload();
  ck(await vis('#uHome') && !(await vis('#btnStart')), 'user view is the default, diagnostic view hidden');
  await page.click('#uStart'); ck(await vis('#uHome'), 'Start without a tracker stays on Home');
  await page.evaluate(() => $('btnSim').onclick());   // the page's simulator stands in for the Nano (swings and cleans)
  await page.waitForTimeout(600);
  ck((await txt('#uConnTxt')) === 'Simulator running', 'Home shows the simulator as the tracker');
  await page.click('#uStyle [data-st="comic"]');
  ck(await page.evaluate(() => $('uv').classList.contains('comic') && vizComic && $('uStart').textContent === 'START!' && localStorage.getItem('kbu_style') === '"comic"'), 'Comic look switches on, is remembered and draws comic visuals');
  await shot('1home');

  // ---- set 1: swings, 16 kg, left hand
  await page.click('#uStart'); ck(await vis('#uSetup'), 'Start opens Next set');
  await page.click('#uMv [data-mv="swing"]'); await page.click('#uKg [data-kg="16"]'); await page.click('#uHand [data-h="L"]');
  await page.click('#uGo'); ck(await vis('#uSet'), 'Start set opens the set screen');
  ck(await page.evaluate(() => $('vizCard').parentElement.id === 'uVizSlot' && !!$('vizCard').offsetHeight), 'swing trace card sits in the user view');
  await page.waitForTimeout(8500);
  const sw = await page.evaluate(() => ({ big: +$('uBig').textContent, page: reps.filter(r => r.counted && r.set === curSet).length, kg: setMeta[curSet].kg, hand: setMeta[curSet].hand, mv: setMeta[curSet].movement, hud: $('uSetHud').innerText }));
  ck(sw.big === sw.page && sw.page >= 4, `swing count matches the page (${sw.big})`);
  ck(sw.kg === 16 && sw.hand === 'L' && sw.mv === 'swing', 'set carries movement, 16 kg and hand L');
  ck(await page.evaluate(() => setMeta[curSet].style === 'comic'), 'set records the look it was done in');
  ck(/RPM\s*\d+/.test(sw.hud) && /WATTS\s*\d+/.test(sw.hud) && new RegExp('KG MOVED\\s*' + sw.big * 16).test(sw.hud), 'swing HUD shows RPM, watts and kg moved');
  await shot('2swing');
  await page.click('#uRest'); ck(await vis('#uRestS') && (await page.evaluate(() => phase)) === 'rest', 'Rest opens the rest screen and the page is resting');
  const done1 = await txt('#uDoneHud'); ck(done1.startsWith('REPS ' + sw.big) || done1.includes('REPS ' + sw.page), 'rest shows the finished set: ' + done1);
  await page.click('#uFixOpen'); await page.click('#uFixPlus');
  ck(await page.evaluate(() => setMeta[curSet].trueReps) === sw.page + 1, 'Fix +1 writes your count');
  await shot('3rest');

  // ---- set 2: cleans, 16 kg, right hand
  await page.click('#uChange'); await page.click('#uMv [data-mv="clean"]'); await page.click('#uHand [data-h="R"]'); await page.click('#uGo');
  ck(await page.evaluate(() => $('vizCard').offsetHeight > 0 && $('vizTitle').textContent === 'CLEAN DIAL'), 'clean dial shows for cleans');
  await page.waitForTimeout(7200);
  const cl = await page.evaluate(() => ({ big: +$('uBig').textContent, page: cleanFast.n }));
  ck(cl.big === cl.page && cl.page >= 1, `clean count matches the page (${cl.big})`);
  await shot('4clean');
  await page.click('#uRest');

  // ---- set 3: press, 12 kg (replayed capture A set 1: 8 presses)
  await page.click('#uChange'); await page.click('#uMv [data-mv="press"]'); await page.click('#uKg [data-kg="12"]'); await page.click('#uGo');
  ck(await vis('#uPressCard') && !(await page.evaluate(() => $('vizCard').offsetHeight)), 'press shows press bars, no trace card');
  const pr = await page.evaluate(rows => {
    const shift = Date.now() + 500 - rows[0].t; let maxLive = 0;   // replayed data starts now, after the earlier sets, as it would live
    for (let i = 0; i < rows.length; i += 5) {
      rows.slice(i, i + 5).forEach(r => raw.push({ ...r, t: r.t + shift, phase: 'work', set: curSet }));
      if (i % 25 === 0) { updatePressLive(); __uv.afterTick(); render(); maxLive = Math.max(maxLive, pressLive.n); }
    }
    for (let k = 0; k < 4; k++) { updatePressLive(); __uv.afterTick(); render(); }
    return { live: pressLive.n, big: +$('uBig').textContent, bars: (pressLive.rises || []).length };
  }, rowsOf('kb_raw_12kg-ohp-rh_2026-11-12-21-38-28.csv', 1));
  ck(pr.big === pr.live && pr.live >= 6, `press live count shows on the big number (${pr.big}, bars ${pr.bars})`);
  await shot('5press');
  await page.click('#uRest');
  const prFinal = await page.evaluate(() => setMeta[curSet].press.reps.length);
  ck(prFinal === 8 && (await txt('#uDoneHud')).startsWith('PRESSES 8'), 'press final count at Rest is 8 (truth 8)');

  // ---- set 4: Auto, 12 kg (replayed 12:13 set 1)
  await page.click('#uChange'); await page.click('#uMv [data-mv="auto"]'); await page.click('#uGo');
  ck(await vis('#uAuto') && await vis('#uFlowCard'), 'Auto shows three counts and the flow strip');
  const au = await page.evaluate(rows => {
    const shift = (raw.length ? raw[raw.length - 1].t + 500 : Date.now()) - rows[0].t;
    for (let i = 0; i < rows.length; i += 5) {
      rows.slice(i, i + 5).forEach(r => raw.push({ ...r, t: r.t + shift, phase: 'work', set: curSet }));
      if (i % 25 === 0) { updateAutoLive(); __uv.afterTick(); render(); }
    }
    for (let k = 0; k < 4; k++) { updateAutoLive(); __uv.afterTick(); render(); }
    return { tiles: [$('uASw').textContent, $('uACl').textContent, $('uAPr').textContent].map(Number), live: { ...autoLive.n }, flow: $('uFlow').querySelectorAll('span[class]').length };
  }, rowsOf('kb_raw_12kg-auto-test_2026-11-15-12-13-23.csv', 1));
  ck(au.tiles.join() === [au.live.swings, au.live.cleans, au.live.presses].join() && au.flow === au.tiles.reduce((a, b) => a + b, 0), `Auto tiles match the live labeller and the flow strip (${au.tiles.join(' / ')}, ${au.flow} shapes)`);
  await shot('6auto');
  await page.click('#uRest');
  const auF = await page.evaluate(() => { const a = setMeta[curSet].auto; return [a.swings.length, a.cleans.length, a.presses.length]; });
  ck(auF.join() === '4,5,4', 'Auto final counts at Rest are 4 / 5 / 4 (truth 4 / 5 / 4): ' + auF.join(' / '));

  // ---- end, summary, CSV
  await page.click('#uRestEnd'); if (errs.length) console.log('  page errors so far: ' + errs.join(' | ')); ck(await vis('#uSum') && (await page.evaluate(() => phase)) === 'idle', 'End workout shows the summary and stops the page');
  const sum = await page.evaluate(() => ({ kg: +$('uSumKg').textContent, rows: $('uSumTable').querySelectorAll('tbody tr').length, cards: $('uSumCards').children.length, last: JSON.parse(localStorage.getItem('kbu_last')) }));
  const expKg = (sw.page + 1) * 16 + cl.page * 16 + 8 * 12 + 13 * 12;
  ck(sum.kg === expKg, `total kg ${sum.kg} = (your swing count + cleans) x 16 + 8 presses x 12 + 13 Auto reps x 12 = ${expKg}`);
  ck(sum.rows === 6 && sum.cards === 3, 'summary has 6 table rows (4 sets, Auto split in three) and 3 movement cards');
  ck(await page.evaluate(() => /W AVG/.test($('uSumCards').innerText)), 'swing card shows average watts');
  ck(sum.last && sum.last.sets === 4 && sum.last.kg === expKg, 'last workout saved for Home');
  await page.click('#uFbBtns [data-p="comic"]'); await page.fill('#uFbTxt', 'Love the bursts, rest timer too small'); await page.click('#uSumKg');
  const fb = await page.evaluate(() => ({ p: Object.values(setMeta).filter(m => m.lookPref === 'comic').length, c: Object.values(setMeta).filter(m => /bursts/.test(m.lookComment || '')).length, saved: $('uFbSaved').textContent, list: JSON.parse(localStorage.getItem('kbu_feedback') || '[]') }));
  ck(fb.p === 4 && fb.c === 4 && /saved/i.test(fb.saved) && fb.list.length === 1 && fb.list[0].styles === 'comic', 'feedback saved on all 4 sets and in this browser');
  await shot('7summary');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#uExport')]);
  const csvText = fs.readFileSync(await dl.path(), 'utf8'), head = csvText.split('\n')[0].split(','), lines = csvText.trim().split('\n').slice(1);
  const hi = head.indexOf('hand'), wi = head.indexOf('workout_id'), si = head.indexOf('set');
  ck(hi > 0 && wi > 0, 'reps CSV has hand and workout_id columns');
  ck(lines.some(l => l.split(',')[hi] === 'L') && lines.filter(l => /,w\d{12},/.test(l)).length >= 20, 'CSV rows carry the hand and the workout id');
  ck(head.includes('style') && head.includes('look_pref') && head.includes('look_comment') && /,comic,comic,"?Love the bursts/.test(csvText), 'CSV carries the look and the feedback');
  await page.click('#uDone'); ck(await vis('#uHome') && await vis('#uLast'), 'Done returns Home with the last workout card');
  await shot('8home');

  // ---- view switch and #dev
  await page.click('#uDiag');
  ck(await vis('#btnStart') && !(await vis('#uHome')) && await page.evaluate(() => $('hint').nextElementSibling.id === 'vizCard'), 'Diagnostics opens the original page with the visual card back in place');
  ck(await page.evaluate(() => !vizComic), 'diagnostic view draws in its own style');
  await page.click('#btnUserView'); ck(await vis('#uHome'), 'User view button switches back');
  await page.goto(url + '#dev'); await page.reload(); ck(await vis('#btnStart') && !(await vis('#uHome')), '#dev opens the diagnostic view');
  await page.evaluate(() => $('btnSim').onclick());
  console.log(`\n${n - fail}/${n} checks passed; page errors: ${errs.length ? errs.join(' | ') : 'none'}`);
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();

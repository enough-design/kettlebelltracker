"""Live press counting by fixed-lag smoothing: every STEP seconds re-run the offline pipeline
(ohp_vertical, zero-phase filters) on the set so far and only trust humps older than LAG seconds.
At the end of the set the exact offline rule (reps_v2) gives the final count.
Simulates what the page will do, to check live counts never overshoot and settle on the final count."""
import sys
from ohp_vertical import *

def live_count(w, now_i, lag=1.5, prom=0.3):
    """Reps visible at sample now_i using only data up to now_i."""
    x = w.iloc[:now_i + 1]
    if len(x) < 4 * FS: return 0
    z = height_trace(x); t = x.t.values; g = x.gm.values; tnow = t[-1]
    bp, _ = find_peaks(g, height=CLEAN_BURST, distance=40)
    p, _ = find_peaks(z, prominence=prom, distance=30)
    p = [k for k in p if t[k] < tnow - lag and g[max(0, k - 50):k + 1].max() < CLEAN_BURST]
    if not p: return 0
    # start after the last clean burst that has a press after it
    cl = [t[k] for k in bp if any(t[q] > t[k] + 0.5 for q in p)]
    start = cl[-1] if cl else -1
    return sum(1 for k in p if t[k] > start + 0.5)

if __name__ == '__main__':
    lag = float(sys.argv[1]) if len(sys.argv) > 1 else 1.5
    ok = tot = 0; worst = 0
    for cap, s, n, lab, d in sets():
        if n is None: continue
        w = d[(d.set == s) & (d.phase == 'work')].reset_index(drop=True)
        seq = [live_count(w, i, lag) for i in range(0, len(w), 25)]
        final = len(reps_v2(w)[2])
        over = max(seq) - final; drops = sum(1 for a, b in zip(seq, seq[1:]) if b < a)
        worst = max(worst, over); tot += 1; ok += final == n
        flag = '' if (final == n and over == 0 and drops == 0) else '  <--'
        print(f'{cap}{s} truth {n:2d} final {final:2d} live max {max(seq):2d} last-live {seq[-1]:2d} overshoot {over} drops {drops}{flag}')
    print(f'final exact {ok}/{tot}, worst live overshoot {worst}')

def live_sticky(w, lag=1.5, step=25, prom=0.3):
    """Monotonic live display: a rep, once shown, stays (matched by time, +-0.6 s) unless a clean
    with a press after it resets the count. Returns sequence of shown counts and the shown rep times."""
    shown = []; seg_start = -1; seq = []
    for i in range(0, len(w), step):
        x = w.iloc[:i + 1]
        if len(x) < 4 * FS: seq.append(0); continue
        z = height_trace(x); t = x.t.values; g = x.gm.values; tnow = t[-1]
        bp, _ = find_peaks(g, height=CLEAN_BURST, distance=40)
        p, _ = find_peaks(z, prominence=prom, distance=30)
        p = [t[k] for k in p if t[k] < tnow - lag and g[max(0, k - 50):k + 1].max() < CLEAN_BURST]
        cl = [t[k] for k in bp if any(q > t[k] + 0.5 for q in p)]
        if cl and cl[-1] > seg_start:
            seg_start = cl[-1]; shown = [q for q in shown if q > seg_start + 0.5]
        for q in p:
            if q > seg_start + 0.5 and all(abs(q - r) > 0.6 for r in shown): shown.append(q)
        seq.append(len(shown))
    return seq, shown

def report_sticky(lag=1.5):
    ok = tot = 0
    for cap, s, n, lab, d in sets():
        if n is None: continue
        w = d[(d.set == s) & (d.phase == 'work')].reset_index(drop=True)
        seq, shown = live_sticky(w, lag); final = len(reps_v2(w)[2])
        drops = sum(1 for a, b in zip(seq, seq[1:]) if b < a); tot += 1; ok += seq[-1] == final
        print(f'{cap}{s} truth {n:2d} final {final:2d} live-end {seq[-1]:2d} max {max(seq):2d} drops {drops}' + ('' if seq[-1] == final else '  <-- corrected at Stop'))
    print(f'live count already equal to final at end of set: {ok}/{tot}')

def live_runmax(w, lag=1.5, step=25, prom=0.3):
    """Displayed count = running max of the fixed-lag count, reset when a new clean (with a press after it) starts."""
    disp = 0; seg = None; seq = []
    for i in range(0, len(w), step):
        x = w.iloc[:i + 1]
        if len(x) < 4 * FS: seq.append(0); continue
        z = height_trace(x); t = x.t.values; g = x.gm.values; tnow = t[-1]
        bp, _ = find_peaks(g, height=CLEAN_BURST, distance=40)
        p, _ = find_peaks(z, prominence=prom, distance=30)
        p = [t[k] for k in p if t[k] < tnow - lag and g[max(0, k - 50):k + 1].max() < CLEAN_BURST]
        cl = [t[k] for k in bp if any(q > t[k] + 0.5 for q in p)]
        start = cl[-1] if cl else -1
        cur = sum(1 for q in p if q > start + 0.5)
        if seg is None or (cl and abs(start - seg) > 0.3 and start > seg): disp = cur; seg = start
        else: disp = max(disp, cur)
        seq.append(disp)
    return seq

def report_runmax(lag=1.5):
    ok = tot = 0; rows = []
    for cap, s, n, lab, d in sets():
        if n is None: continue
        w = d[(d.set == s) & (d.phase == 'work')].reset_index(drop=True)
        seq = live_runmax(w, lag); final = len(reps_v2(w)[2])
        tot += 1; ok += seq[-1] == final
        rows.append(f'{cap}{s}:{seq[-1]}/{final}' + ('' if seq[-1] == final else '*'))
    print(f'lag {lag}: live end == final {ok}/{tot}  ', ' '.join(rows))

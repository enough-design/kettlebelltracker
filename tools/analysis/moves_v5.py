"""Prototype (13 Nov): label every rep in a set as swing, clean or press from one raw stream.
Not on the page yet. Run from the repo root:  python3 tools/analysis/moves_v5.py
- swing: height hump with a float (|a| < 0.55 g for >= FLOAT_MIN s around the peak) and rotation >= 100 deg
- clean: gyro burst >= CLEAN_DPS while the bell is rising, not part of a swing
- press: ohp_vertical v4 rules, and a clean must have happened earlier in the set
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from all_truth import T, RAW
from humps_all import load_any, longest_run
from ohp_vertical import *

FLOAT_MIN = 0.29; CLEAN_DPS = 400; UP_WIN = 0.3; CLEAN_ROT = 210   # deg of rotation within +-0.5 s of the burst (cleans 240+, picking the bell up 127-164)

NX_CLEAN = 80   # deg: net rotation about the board's x axis (USB axis, the bell's vertical axis). A clean spins the bell about it
                # (108 to 297 deg); swings barely do (under 40). Same sign with the Nano on the front or back face; abs() covers the other hand.

def label_set(w, clean_dps=350, float_min=FLOAT_MIN, up_win=UP_WIN, prom=0.3, nx_clean=NX_CLEAN, clean_rot=CLEAN_ROT):
    """v6 (after the first blind test of Auto-detect): cleans and swings are told apart by the AXIS of rotation, not by float time."""
    z = height_trace(w); t = w.t.values; g = w.gm.values; a = w.a.values; gx = w.gx.values; n = len(w)
    pk, _ = find_peaks(z, prominence=prom, distance=30)
    fl = np.array([longest_run(a[max(0, k - 50):min(n, k + 38)] < 0.55) / FS for k in pk])
    rot = np.array([g[max(0, k - 38):k + 13].sum() / FS for k in pk])
    pre = np.array([g[max(0, k - 50):k + 1].max() for k in pk])
    mov = np.array([g[max(0, k - 75):max(1, k - 10)].max() for k in pk])
    nxh = np.array([abs(gx[max(0, k - 38):k + 13].sum()) / FS for k in pk])
    swing_like = (fl >= float_min) & (rot >= 100) & (nxh < nx_clean)
    bp, _ = find_peaks(g, height=clean_dps, distance=30)
    u = int(up_win * FS)
    cl_t = np.array([t[k] for k in bp if z[min(n - 1, k + u)] - z[max(0, k - u)] > 0 and abs(gx[max(0, k - 25):k + 25].sum()) / FS >= nx_clean
                     and g[max(0, k - 25):k + 25].sum() / FS >= clean_rot])
    feat = [(ROT_MIN < rot[i] < ROT_MAX) and pre[i] < PRE_MAX and mov[i] >= MOVE_MIN and nxh[i] < nx_clean
            and not any(0 <= t[k] - c < CLEAN_GUARD for c in cl_t) for i, k in enumerate(pk)]
    # walk through the set in time order: a press needs the bell racked, i.e. the last clean is more recent than the last swing
    isp = np.zeros(len(pk), dtype=bool); last_swing = -1e9
    for i, k in enumerate(pk):
        c = cl_t[cl_t < t[k]]
        if feat[i] and len(c) and c[-1] > last_swing: isp[i] = True
        elif swing_like[i]: last_swing = t[k]
    for j in range(len(pk) - 2, -1, -1):     # a press-looking hump right before a swing is the start of the swing run
        if isp[j] and not isp[j + 1] and swing_like[j + 1] and t[pk[j + 1]] - t[pk[j]] <= SWING_GAP: isp[j] = False
    swing = swing_like & ~isp
    return t[pk[swing]], cl_t, t[pk[isp]]

def score(**kw):
    out = []; tot = {'sw': [0, 0], 'cl': [0, 0], 'pr': [0, 0]}
    for f, sets in T.items():
        if f.startswith('kb_raw_2026-11-11-13-05-20'): continue      # 28 Hz capture from before batching
        d = load_any(f)
        for s, (sw, pr, cl) in sets.items():
            w = d[(d.set == s) & (d.phase == 'work')].reset_index(drop=True)
            a, b, c = label_set(w, **kw); got = dict(sw=len(a), cl=len(b), pr=len(c)); tr = dict(sw=sw, cl=cl, pr=pr)
            bad = []
            for k in tot:
                if tr[k] is None: continue
                tot[k][1] += 1; tot[k][0] += got[k] == tr[k]
                if got[k] != tr[k]: bad.append(f'{k} {got[k]}/{tr[k]}')
            if bad: out.append(f'  {f[7:-4]} set {s}: ' + ', '.join(bad))
    return tot, out

if __name__ == '__main__':
    tot, out = score()
    print('swings exact %d/%d   cleans exact %d/%d   presses exact %d/%d' % (*tot['sw'], *tot['cl'], *tot['pr']))
    print('\n'.join(out))

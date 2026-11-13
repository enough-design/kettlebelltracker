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

def label_set(w, clean_dps=CLEAN_DPS, float_min=FLOAT_MIN, up_win=UP_WIN, prom=0.3, clean_rot=CLEAN_ROT):
    z = height_trace(w); t = w.t.values; g = w.gm.values; a = w.a.values; n = len(w)
    pk, _ = find_peaks(z, prominence=prom, distance=30)
    fl = np.array([longest_run(a[max(0, k - 50):min(n, k + 38)] < 0.55) / FS for k in pk])
    rot = np.array([g[max(0, k - 38):k + 13].sum() / FS for k in pk])
    pre = np.array([g[max(0, k - 50):k + 1].max() for k in pk])
    mov = np.array([g[max(0, k - 75):max(1, k - 10)].max() for k in pk])
    swing_like = (fl >= float_min) & (rot >= 100)
    # cleans: strong gyro bursts while the bell is going up, away from swing-like humps
    bp, _ = find_peaks(g, height=clean_dps, distance=30)
    u = int(up_win * FS)
    cl_t = np.array([t[k] for k in bp if z[min(n - 1, k + u)] - z[max(0, k - u)] > 0 and g[max(0, k - 25):k + 25].sum() / FS >= clean_rot and not any(abs(t[k] - s) < 1.0 for s in t[pk[swing_like]])])
    # presses first (they can also float briefly), then swings from what is left
    isp = [(ROT_MIN < rot[i] < ROT_MAX) and pre[i] < PRE_MAX and mov[i] >= MOVE_MIN and any(c < t[k] for c in cl_t)
           and not any(0 <= t[k] - c < CLEAN_GUARD for c in cl_t) for i, k in enumerate(pk)]
    for j in range(len(pk) - 2, -1, -1):    # a press-looking hump right before a swing is the start of the swing run
        if isp[j] and not isp[j + 1] and swing_like[j + 1] and t[pk[j + 1]] - t[pk[j]] <= SWING_GAP: isp[j] = False
    isp = np.array(isp, dtype=bool) if len(pk) else np.array([], dtype=bool)
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

"""Overhead press: estimate vertical bell displacement and count / grade reps.

Vertical acceleration = accel projected on the slowly varying gravity direction (low-pass 0.3 Hz) minus 1 g,
band-passed, integrated twice with high-pass filters to stop drift. The result is a RELATIVE height trace:
one hump per press. Filtering runs over the whole work phase to avoid edge effects; reps are counted between
the clean burst and the lowering burst.
"""
import sys
from ohp_common import *
sos_g = butter(2, 0.3, fs=FS, output='sos')
# 0.1 Hz (was 0.15): the 0.15 Hz filters flattened very slow reps (about 4.6 s per rep, capture E set 1)
sos_b = butter(2, [0.1, 4], btype='band', fs=FS, output='sos')
hp = butter(2, 0.1, btype='high', fs=FS, output='sos')
CLEAN_DPS = 480   # a hump with |gyro| above this within +-1 s is a clean, not a press (cleans 531-632, presses <= 423)

def height_trace(w):
    A = np.c_[w.ax, w.ay, w.az] / 1000.0
    G = np.c_[[sosfiltfilt(sos_g, A[:, i]) for i in range(3)]].T
    gh = G / np.linalg.norm(G, axis=1)[:, None]
    av = (A * gh).sum(1) - 1.0
    avb = sosfiltfilt(sos_b, av) * 9.81
    v = sosfiltfilt(hp, np.cumsum(avb) / FS)
    return sosfiltfilt(hp, np.cumsum(v) / FS)

def reps(w, t0, t1, prom=0.3, lead=0.5, tail=0.0):
    z = height_trace(w); t = w.t.values; g = w.gm.values
    p, pr = find_peaks(z, prominence=prom, distance=30)
    keep = (t[p] > t0 + lead) & (t[p] < t1 - tail)
    keep &= np.array([g[max(0, k - 50):k + 50].max() < CLEAN_DPS for k in p], dtype=bool)
    p = p[keep]
    rise = []
    for i, k in enumerate(p):
        j0 = p[i - 1] if i else max(0, k - int(4 * FS))
        rise.append(z[k] - z[j0:k].min())
    return t, z, p, np.array(rise)

CLEAN_BURST = 450   # dps: a clean (or a fast lowering) twists the bell at least this hard; presses stay below

def reps_v2(w, prom=0.3):
    """Structural version (13 Nov, after capture G).
    - The set ends at the last gyro burst > 250 dps (the lowering).
    - Presses start after the LAST clean-strength burst (>= 450 dps) before that, so anything before the
      final clean (extra cleans, swings) is ignored. Live equivalent: a clean resets the press count.
    - A hump is rejected if a >= 450 dps burst happens in the 1 s BEFORE its peak (a clean). Gyro after the
      peak is allowed, so the last press is kept even when the lowering that follows is fast.
    """
    z = height_trace(w); t = w.t.values; g = w.gm.values
    bp, _ = find_peaks(g, height=250, distance=40)
    if len(bp) < 2: return t, z, np.array([], int), np.array([])
    end = t[bp[-1]]
    cl = [t[k] for k in bp[:-1] if g[k] >= CLEAN_BURST]
    start = cl[-1] if cl else t[bp[0]]
    p, _ = find_peaks(z, prominence=prom, distance=30)
    p = np.array([k for k in p if start + 0.5 < t[k] < end and g[max(0, k - 50):k + 1].max() < CLEAN_BURST], int)
    rise = np.array([z[k] - z[(p[i - 1] if i else max(0, k - int(4 * FS))):k].min() for i, k in enumerate(p)])
    return t, z, p, rise

# v3 (13 Nov, after capture I): judge each hump on its own instead of "presses only after the last clean"
ROT_MIN = 15       # deg: a hump with almost no rotation is a filter artefact in a still period, not a press (presses 27+)
ROT_MAX = 170      # deg: integral of |gyro| from 0.75 s before to 0.25 s after the peak; presses 27-150, cleans 250+, swings 160-215
PRE_MAX = 425      # dps: max |gyro| in the 1 s before the peak; cleans 417+ (12 kg cleans can be as low as 417)
SWING_GAP = 2.25   # s: a press-looking hump followed this closely by a swing-looking hump is the start of a swing run
CLEAN_GUARD = 1.0  # s: ignore humps within this time after a clean-strength burst (the bell settling into the rack)

MOVE_MIN = 35      # dps: a press needs the arm moving in the 1.5 to 0.2 s before its peak (presses 58+); a still bell is not pressing
# v4 (13 Nov, after capture J): also a press needs a clean earlier in the set (the bell has to be racked first)

def hump_features(w, prom=0.3):
    z = height_trace(w); t = w.t.values; g = w.gm.values
    pk, _ = find_peaks(z, prominence=prom, distance=30)
    rot = np.array([g[max(0, k - 38):k + 13].sum() / FS for k in pk])
    pre = np.array([g[max(0, k - 50):k + 1].max() for k in pk])
    return t, z, g, pk, rot, pre

def reps_v3(w, prom=0.3):
    t, z, g, pk, rot, pre = hump_features(w, prom)
    bursts = t[find_peaks(g, height=CLEAN_BURST, distance=40)[0]]
    moving = [g[max(0, k - 75):max(1, k - 10)].max() >= MOVE_MIN for k in pk]
    isp = [(ROT_MIN < r < ROT_MAX) and (q < PRE_MAX) and mv and any(b < t[k] for b in bursts)
           and not any(0 <= t[k] - b < CLEAN_GUARD for b in bursts) for k, r, q, mv in zip(pk, rot, pre, moving)]
    for i in range(len(pk) - 2, -1, -1):        # drop the first swings of a run (they rotate little)
        if isp[i] and not isp[i + 1] and t[pk[i + 1]] - t[pk[i]] <= SWING_GAP and pre[i + 1] < CLEAN_BURST:
            isp[i] = False
    p = pk[np.array(isp, dtype=bool)] if len(pk) else pk
    rise = np.array([z[k] - z[max(p[i - 1] if i else 0, k - int(2 * FS)):k].min() for i, k in enumerate(p)])   # 2 s window: a clean between reps must not inflate the rise
    return t, z, p, rise

if __name__ == '__main__':
    prom = float(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1][0] != '-' else 0.3
    ok = tot = 0
    for cap, s, n, lab, d in sets():
        w = d[(d.set == s) & (d.phase == 'work')].reset_index(drop=True)
        t, z, p, rise = (reps_v3 if '--v2' not in sys.argv else reps_v2)(w, prom)
        if n is not None: tot += 1; ok += len(p) == n
        rel = rise / np.median(rise[:3]) if len(rise) >= 3 else rise
        print(f'{cap}{s} truth {n} {lab or "":8s} -> {len(p):2d}  rise cm {np.round(rise*100).astype(int)}  rel {np.round(rel,2)}')
    print(f'exact counts {ok}/{tot}')

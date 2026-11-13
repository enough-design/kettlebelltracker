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

if __name__ == '__main__':
    prom = float(sys.argv[1]) if len(sys.argv) > 1 else 0.3
    ok = tot = 0
    for cap, s, n, lab, d in sets():
        w = d[(d.set == s) & (d.phase == 'work')].reset_index(drop=True)
        t, z, p, rise = reps_v2(w, prom)
        if n is not None: tot += 1; ok += len(p) == n
        rel = rise / np.median(rise[:3]) if len(rise) >= 3 else rise
        print(f'{cap}{s} truth {n} {lab or "":8s} -> {len(p):2d}  rise cm {np.round(rise*100).astype(int)}  rel {np.round(rel,2)}')
    print(f'exact counts {ok}/{tot}')

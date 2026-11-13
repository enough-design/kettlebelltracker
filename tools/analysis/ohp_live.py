"""SUPERSEDED - kept for the record: this purely causal version did NOT work (4/23 exact; slow ringing after the clean). The page uses fixed-lag re-computation instead (ohp_fixedlag.py, OHP block in index.html).

Causal (live) overhead-press counter: the reference the page implementation must match.

Per sample at 50 Hz: gravity direction = causal low-pass of accel; vertical accel = accel . g_hat - 1 g;
causal band-pass; integrate to velocity and height with causal high-pass after each step.
Reps = hysteresis peaks of the height trace: a peak is confirmed once height has risen >= PROM above the
previous trough AND then dropped >= DROP below the peak. A peak with |gyro| >= CLEAN in the 1 s before it
is a clean, not a press. Every clean-strength burst (|gyro| >= CLEAN) starts a new segment; once a press is
confirmed in a new segment, reps from earlier segments are discarded (swings / extra cleans before the
final clean). A burst with no press after it (the lowering) changes nothing.
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt_zi, sosfilt
from ohp_common import *

class LiveOHP:
    def __init__(self, fs=50.0, prom=0.3, drop=None, clean=450, lp=0.3, band=(0.1, 4.0), hp=0.1):
        self.fs = fs; self.prom = prom; self.drop = drop if drop is not None else prom * 0.5; self.clean = clean
        self.s_lp = butter(2, lp, fs=fs, output='sos'); self.z_lp = [None] * 3
        self.s_bp = butter(2, band, btype='band', fs=fs, output='sos'); self.z_bp = None
        self.s_hp = butter(2, hp, btype='high', fs=fs, output='sos'); self.z_hv = None; self.z_hz = None
        self.v = 0.0; self.h = 0.0
        self.trough = 0.0; self.cand = None   # candidate peak (h, i)
        self.gyro_hist = []; self.i = 0
        self.seg = 0; self.last_burst_i = -10**9
        self.reps = []   # dicts: i, rise, seg
        self.H = []
    def _f(self, sos, zi, x):
        if zi is None: zi = sosfilt_zi(sos) * x
        y, zi = sosfilt(sos, [x], zi=zi); return y[0], zi
    def push(self, ax, ay, az, gm):
        """ax..az in g, gm in dps. Returns a new rep dict when one is confirmed, else None."""
        A = (ax, ay, az); G = []
        for k in range(3):
            y, self.z_lp[k] = self._f(self.s_lp, self.z_lp[k], A[k]); G.append(y)
        n = (G[0]**2 + G[1]**2 + G[2]**2) ** 0.5 or 1.0
        av = (ax * G[0] + ay * G[1] + az * G[2]) / n - 1.0
        if self.z_bp is None:
            self.z_bp = np.zeros((self.s_bp.shape[0], 2)); self.z_hv = np.zeros((self.s_hp.shape[0], 2)); self.z_hz = np.zeros((self.s_hp.shape[0], 2))
            self.Sv = 0.0; self.Sz = 0.0
        ab, self.z_bp = self._f(self.s_bp, self.z_bp, av * 9.81)
        self.Sv += ab / self.fs; self.v, self.z_hv = self._f(self.s_hp, self.z_hv, self.Sv)
        self.Sz += self.v / self.fs; self.h, self.z_hz = self._f(self.s_hp, self.z_hz, self.Sz)
        # NB integrators: v accumulates through the high-pass state, so feed the running sum
        i = self.i; self.i += 1; h = self.h; self.H.append(h)
        self.gyro_hist.append(gm)
        if len(self.gyro_hist) > int(self.fs) + 1: self.gyro_hist.pop(0)
        if gm >= self.clean and i - self.last_burst_i > int(0.4 * self.fs):
            self.seg += 1
        if gm >= self.clean: self.last_burst_i = i
        out = None
        if self.cand is None:
            if h < self.trough: self.trough = h
            if h - self.trough >= self.prom: self.cand = [h, i, max(self.gyro_hist), self.trough]
        else:
            if h > self.cand[0]:
                self.cand = [h, i, max(self.gyro_hist), self.cand[3]]
            elif self.cand[0] - h >= self.drop:
                ph, pi, pre_g, tr = self.cand
                if pre_g < self.clean:
                    rep = dict(i=pi, rise=ph - tr, seg=self.seg if pi > self.last_burst_i or True else self.seg)
                    # segment of the peak = segments started before the peak
                    rep['seg'] = self.seg_at(pi)
                    if self.reps and rep['seg'] > self.reps[-1]['seg']:
                        self.reps = []               # a clean came between: drop swings/cleans before it
                    self.reps.append(rep); out = rep
                self.cand = None; self.trough = h
        return out
    # segment bookkeeping: remember sample index where each segment started
    def seg_at(self, i):
        return sum(1 for s in self.seg_starts if s <= i)

def run(w, **kw):
    det = LiveOHP(**kw); det.seg_starts = []
    g = w.gm.values; A = np.c_[w.ax, w.ay, w.az] / 1000.0
    last = -10**9
    for k in range(len(w)):
        if g[k] >= det.clean and k - last > int(0.4 * det.fs): det.seg_starts.append(k)
        if g[k] >= det.clean: last = k
        det.push(A[k, 0], A[k, 1], A[k, 2], g[k])
    return det

if __name__ == '__main__':
    kw = dict(arg.split('=') for arg in sys.argv[1:]); kw = {k: float(v) for k, v in kw.items()}
    ok = tot = 0
    for cap, s, n, lab, d in sets():
        if n is None: continue
        w = d[(d.set == s) & (d.phase == 'work')].reset_index(drop=True)
        det = run(w, **kw); c = len(det.reps); tot += 1; ok += c == n
        r = np.array([x['rise'] for x in det.reps])
        print(f'{cap}{s} truth {n:2d} {lab or "":10s} live {c:2d} {"" if c == n else "<-- MISS"}  rise {np.round(r*100).astype(int)}')
    print(f'exact {ok}/{tot}')

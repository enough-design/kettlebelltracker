"""Feature table for every height hump in every capture (swings, presses, cleans) - the basis for per-rep movement labels."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from all_truth import T, RAW
from ohp_vertical import *
import pandas as pd

def load_any(f):
    d = pd.read_csv(RAW + f); dm = d.ms.diff().fillna(0).values; de = d.t_epoch_ms.diff().fillna(0).values
    d['t'] = np.cumsum(np.where(dm < 0, de, dm)) / 1000
    d['a'] = np.sqrt(d.ax**2 + d.ay**2 + d.az**2) / 1000; d['gm'] = np.sqrt(d.gx**2 + d.gy**2 + d.gz**2)
    return d

def longest_run(mask):
    best = cur = 0
    for m in mask:
        cur = cur + 1 if m else 0; best = max(best, cur)
    return best

def table(prom=0.2):
    rows = []
    for f, sets in T.items():
        d = load_any(f)
        for s, (sw, pr, cl) in sets.items():
            w = d[(d.set == s) & (d.phase == 'work')].reset_index(drop=True)
            if len(w) < 4 * FS: continue
            z = height_trace(w); t = w.t.values; g = w.gm.values; a = w.a.values
            pk, P = find_peaks(z, prominence=prom, distance=30)
            press = set(reps_v3(w)[2].tolist())
            for i, k in enumerate(pk):
                lo, hi = max(0, k - 50), min(len(a), k + 38)
                rows.append(dict(file=f[7:-4], set=s, t=round(t[k] - t[0], 1), prom=P['prominences'][i], rot=g[max(0, k - 38):k + 13].sum() / FS,
                                 pre=g[max(0, k - 50):k + 1].max(), post=g[k:k + 50].max(), move=g[max(0, k - 75):max(1, k - 10)].max(),
                                 fl=longest_run(a[lo:hi] < 0.55) / FS, amin=a[lo:hi].min(), amax=a[max(0, k - 75):k + 25].max(),
                                 v3press=k in press, n_sw=sw, n_pr=pr, n_cl=cl))
    return pd.DataFrame(rows)

if __name__ == '__main__':
    df = table(); df.to_pickle('/tmp/o/humps_all.pkl'); print(len(df), 'humps')

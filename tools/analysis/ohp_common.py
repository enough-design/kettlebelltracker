"""Shared loading for overhead-press captures."""
import numpy as np, pandas as pd
from scipy.signal import find_peaks, butter, filtfilt, sosfiltfilt
FS = 50.0
RAW = 'data/raw/'
# capture -> file, {set: (truth_count, full/half labels or None)}
CAPS = {
 'A': ('kb_raw_12kg-ohp-rh_2026-11-12-21-38-28.csv', {1: (8, 'F'*8), 2: (8, 'F'*8), 3: (8, 'F'*8)}),
 'B': ('kb_raw_12kg-ohp-rh_2026-11-12-21-55-53.csv', {1: (8, 'F'*8), 2: (None, None), 3: (8, 'FFFFFHHH')}),
 'C': ('kb_raw_12kg-ohp-rh_2026-11-12-22-20-49.csv', {1: (8, 'F'*8), 2: (8, 'F'*8), 3: (8, 'F'*8)}),
 'D': ('kb_raw_12kg-ohp-rh_2026-11-12-22-34-47.csv', {1: (8, 'FHFHFHFH'), 2: (8, 'FFFFHHHH')}),
}
def load(cap):
    d = pd.read_csv(RAW + CAPS[cap][0])
    dm = d.ms.diff().fillna(0).values; de = d.t_epoch_ms.diff().fillna(0).values
    d['t'] = np.cumsum(np.where(dm < 0, de, dm)) / 1000          # survives a board reset
    d['a'] = np.sqrt(d.ax**2 + d.ay**2 + d.az**2) / 1000
    d['gm'] = np.sqrt(d.gx**2 + d.gy**2 + d.gz**2)
    return d
def set_window(d, s, burst=250):
    """Work phase of a set, cropped from the clean burst to the lowering burst."""
    w = d[(d.set == s) & (d.phase == 'work')].reset_index(drop=True)
    gp, _ = find_peaks(w.gm, height=burst, distance=50)
    return w, w.t[gp[0]], w.t[gp[-1]]
def sets():
    for cap, (_, ss) in CAPS.items():
        d = load(cap)
        for s, (n, lab) in ss.items():
            yield cap, s, n, lab, d

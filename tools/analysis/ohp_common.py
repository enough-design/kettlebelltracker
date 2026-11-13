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
 'F': ('kb_raw_12kg-ohp-rh_2026-11-13-14-27-50.csv', {1: (8, 'F'*8), 2: (10, 'FFHHFFHHFF')}),  # 7.5 kg bell (file name says 12kg); set 2 count corrected from 8 to 10 by James
 'G': ('kb_raw_7-5kg-ohp-rh_2026-11-13-14-38-21.csv', {1: (8, 'F'*8), 2: (4, 'F'*4), 3: (10, 'FFHHFFHHFF'), 4: (8, 'F'*8)}),  # 7.5 kg; set 1: 3 extra cleans first; set 2: 4 swings + clean first; set 4 fast
 'H': ('kb_raw_20kg-ohp-push-rh_2026-11-13-14-55-29.csv', {1: (8, 'F'*8), 2: (8, 'F'*8), 3: (4, 'F'*4)}),  # 20 kg PUSH press; set 3: 4 swings first
 'I': ('kb_raw_12kg-ohp_2026-11-13-15-23-02.csv', {1: (8, 'F'*8), 2: (8, 'F'*8), 3: (None, None), 4: (4, 'F'*4), 5: (4, 'F'*4)}),  # first live-page test; sets 3-4 cleans AFTER presses, set 5 cleans between presses; set 3: James logged 4 but says it could have been 5 (data shows 5), so unscored
 'E': ('kb_raw_12kg-ohp-rh_2026-11-12-22-57-53.csv', {1: (8, None), 2: (8, None), 3: (8, None), 4: (0, None)}),  # 4 = 8 cleans, no presses
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

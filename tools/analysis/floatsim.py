import sys
import pandas as pd, numpy as np
from scipy.signal import find_peaks
df = pd.read_csv(sys.argv[1])
df['t'] = (df.ms - df.ms.iloc[0]) / 1000.0
df['mag'] = np.sqrt(df.ax**2 + df.ay**2 + df.az**2) / 1000.0

def run(t, m, LOW=0.5, EXIT=0.9, ARM=1.5, MIN_FLOAT=0.06, GAP=0.9):
    """Streaming replay of the planned firmware logic (no lookahead)."""
    armed = False; counted = False; low_since = None; last = -99; run_peak = 0.0; out = []
    for ti, mi in zip(t, m):
        if mi > ARM: armed = True
        run_peak = max(run_peak, mi)
        if mi < LOW:
            if low_since is None: low_since = ti
            if armed and not counted and ti - low_since >= MIN_FLOAT and low_since - last >= GAP:
                out.append((low_since, run_peak)); last = low_since
                counted = True; armed = False; run_peak = 0.0
        elif mi > EXIT:
            low_since = None; counted = False
    return out

# whole file, phases ignored, to prove idle/handling/put-down don't false-trigger
r = run(df.t.values, df.mag.values)
print('whole file  :', len(r), 'reps at', np.round([x[0] for x in r], 1).tolist())
w = df[df.phase == 'work']
r = run(w.t.values, w.mag.values)
ts = [x[0] for x in r]
print('work phase  :', len(r), 'reps; period s:', np.round(np.diff(ts), 2).tolist())
print('peak g/rep  :', np.round([x[1] for x in r], 2).tolist())

pk, _ = find_peaks(w.mag.values, height=2.0, distance=int(1.2 / 0.036))
print('cross-check : tall peaks >2g spaced >=1.2s =', len(pk))

print('\nsensitivity (reps counted in work phase):')
print('LOW    ' + ''.join(f'GAP={g:<5}' for g in (0.6, 0.9, 1.2)))
for LOW in (0.35, 0.4, 0.5, 0.55, 0.6, 0.7):
    print(f'{LOW:<7}' + ''.join(f'{len(run(w.t.values, w.mag.values, LOW=LOW, GAP=g)):<9}' for g in (0.6, 0.9, 1.2)))
print('\nwith ARM variations (LOW=0.5, GAP=0.9):',
      {a: len(run(w.t.values, w.mag.values, ARM=a)) for a in (1.2, 1.5, 1.8, 2.0)})
print('with MIN_FLOAT variations:',
      {mf: len(run(w.t.values, w.mag.values, MIN_FLOAT=mf)) for mf in (0.0, 0.04, 0.06, 0.1, 0.15)})

print('\n--- grid: LOW x MIN_FLOAT (GAP=0.9, ARM=1.5) | work-phase reps / whole-file reps ---')
print('LOW    ' + ''.join(f'MF={mf:<10}' for mf in (0.0, 0.02, 0.04)))
for LOW in (0.45, 0.5, 0.55, 0.6, 0.65):
    cells = []
    for mf in (0.0, 0.02, 0.04):
        a = len(run(w.t.values, w.mag.values, LOW=LOW, MIN_FLOAT=mf))
        b = len(run(df.t.values, df.mag.values, LOW=LOW, MIN_FLOAT=mf))
        cells.append(f'{a}/{b}'.ljust(13))
    print(f'{LOW:<7}' + ''.join(cells))
r = run(w.t.values, w.mag.values, LOW=0.55, MIN_FLOAT=0.0)
print('\nLOW=0.55 MF=0 periods s:', np.round(np.diff([x[0] for x in r]), 2).tolist())

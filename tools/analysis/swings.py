import sys
import pandas as pd, numpy as np
from scipy.signal import find_peaks
df = pd.read_csv(sys.argv[1])
df['t'] = (df.ms - df.ms.iloc[0]) / 1000
df['mag'] = np.sqrt(df.ax**2 + df.ay**2 + df.az**2) / 1000
w = df[df.phase == 'work'].reset_index(drop=True)
print('work window', round(w.t.iloc[0],2), '->', round(w.t.iloc[-1],2), 's')

pk, _ = find_peaks(w.mag.values, height=1.5, distance=3)
print('peaks >1.5g:', len(pk))
print(' t(s)   mag(g)')
for i in pk: print(f'{w.t[i]:6.2f}  {w.mag[i]:.2f}')

tr, _ = find_peaks(-w.mag.values, height=-0.6, distance=3)
print('dips <0.6g (float candidates):', len(tr))
for i in tr: print(f'{w.t[i]:6.2f}  {w.mag[i]:.2f}')

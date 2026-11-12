import sys
import pandas as pd, numpy as np
df = pd.read_csv(sys.argv[1])
print(df.head(3).to_string())
print(df.phase.value_counts().to_dict(), df.set.value_counts().to_dict())
df['t'] = (df.ms - df.ms.iloc[0]) / 1000
df['mag'] = np.sqrt(df.ax**2 + df.ay**2 + df.az**2) / 1000
dt = np.diff(df.ms)
print('rows', len(df), 'duration s', round(df.t.iloc[-1], 2))
print('dt ms median', np.median(dt), 'p95', np.percentile(dt, 95), 'max', dt.max())
print(df.mag.describe().round(3).to_string())
print('abs max per axis (mg):', df[['ax','ay','az']].abs().max().to_dict())
print('gyro abs max (dps):', df[['gx','gy','gz']].abs().max().to_dict())

import sys
import pandas as pd, numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
df = pd.read_csv(sys.argv[1])
out = sys.argv[2]
df['t'] = (df.ms - df.ms.iloc[0]) / 1000
df['mag'] = np.sqrt(df.ax**2 + df.ay**2 + df.az**2) / 1000
gm = np.sqrt(df.gx**2 + df.gy**2 + df.gz**2)
fig, ax = plt.subplots(3, 1, figsize=(14, 9), sharex=True)
ax[0].plot(df.t, df.mag, lw=1); ax[0].axhline(1, color='grey', lw=.5); ax[0].set_ylabel('|accel| g')
ax[1].plot(df.t, df.ax/1000, lw=.8, label='ax'); ax[1].plot(df.t, df.ay/1000, lw=.8, label='ay'); ax[1].plot(df.t, df.az/1000, lw=.8, label='az')
ax[1].legend(loc='upper right'); ax[1].set_ylabel('axes g')
ax[2].plot(df.t, gm, lw=1, color='tab:red'); ax[2].set_ylabel('|gyro| dps'); ax[2].set_xlabel('s')
for a in ax:
    for ph, c in (('work', '#ff6a2b'), ('rest', '#4aa8ff')):
        s = df[df.phase == ph]
        if len(s): a.axvspan(s.t.min(), s.t.max(), color=c, alpha=.07)
plt.tight_layout(); plt.savefig(out, dpi=80)

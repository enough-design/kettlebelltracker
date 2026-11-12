import sys
import pandas as pd, numpy as np
G = 9.81; M = float(sys.argv[2]) if len(sys.argv) > 2 else 12.0
df = pd.read_csv(sys.argv[1])
df['t'] = (df.ms - df.ms.iloc[0]) / 1000.0
df['a'] = np.sqrt(df.ax**2 + df.ay**2 + df.az**2) / 1000.0
df['w'] = np.sqrt(df.gx**2 + df.gy**2 + df.gz**2)
t, a, w = df.t.values, df.a.values, df.w.values
wr = np.radians(w)

reps=[]; armed=False; counted=False; ls=None; last=-9
for i,(ti,ai) in enumerate(zip(t,a)):
    if ai>1.5: armed=True
    if ai<0.55:
        if ls is None: ls=ti
        if armed and not counted and ti-ls>=0.02 and ls-last>=0.9:
            reps.append(i); last=ls; counted=True; armed=False
    elif ai>0.9: ls=None; counted=False

prev=0; out=[]
for k,i in enumerate(reps):
    j = prev + int(np.argmax(a[prev:i+1]))
    apk = a[j]; wpk = wr[max(0,j-1):j+2].max()
    r = (apk-1)*G/wpk**2
    vpk = wpk*r
    # swing angle swept from accel peak to float start (trapezoid on |w|)
    sweep = np.trapezoid(wr[j:i+1], t[j:i+1])
    wL = wr[i]                      # gyro at float start
    h = r*(1-np.cos(sweep))
    vL = wL*r
    E_pk = 0.5*M*vpk**2
    E_L  = 0.5*M*vL**2 + M*G*h
    T = (t[i]-t[reps[k-1]]) if k>0 else np.nan
    out.append((k+1, apk, vpk, np.degrees(sweep), h, vL, E_pk, E_L, T))
    prev=i
print(' rep  a_pk  v_pk  sweep(deg)  h(m)  v_L   E_pk(J)  E_launch(J)  T(s)  P=E_L/T(W)')
for x in out:
    P = x[7]/x[8] if np.isfinite(x[8]) else float('nan')
    print(' %3d %5.2f %5.2f   %6.1f    %5.2f %5.2f  %6.1f   %6.1f      %4.2f  %6.1f'%(x+(P,)))
A=np.array(out)
print('\nsweep deg mean %.0f sd %.0f | h mean %.2f | E_pk mean %.0f J | E_launch mean %.0f J sd %.0f'%(np.degrees(0)+A[:,3].mean(),A[:,3].std(),A[:,4].mean(),A[:,6].mean(),A[:,7].mean(),A[:,7].std()))

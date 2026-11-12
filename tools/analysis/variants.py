import sys
import numpy as np, pandas as pd
G=9.81; M=12.0
raw=pd.read_csv(sys.argv[1]); ms=raw.ms.values
rp=pd.read_csv(sys.argv[2],header=None,names=['t_ms','devset','inset','total','peak_mg','interval','gpk10','sweep10','gl10','x'])
rp['set']=[int(raw.set.iloc[int(np.argmin(np.abs(ms-t)))]) for t in rp.t_ms]
rp['peak']=rp.peak_mg/1000; rp['gpk']=rp.gpk10/10; rp['sw']=rp.sweep10/10; rp['gl']=rp.gl10/10
# float duration that follows each rep (from raw)
a=np.sqrt(raw.ax**2+raw.ay**2+raw.az**2).values/1000.0; t=ms/1000.0
def float_after(tr):
    i=int(np.argmin(np.abs(ms-tr)))
    j=i
    while j<len(a) and a[j]<0.9: j+=1
    k=i
    while k>0 and a[k-1]<0.9: k-=1
    return t[j]-t[k]
rp['Tf']=[float_after(x) for x in rp.t_ms]
ok=(rp.gpk>0)&(rp.sw>=40)&(rp.sw<=135)&(rp.Tf>0.3)
rp['rad']=(rp.peak-1)*G/np.radians(rp.gpk.replace(0,np.nan))**2
v=rp[ok].copy()
r0=v.rad.median()
print(f'valid reps {len(v)}/{len(rp)}; per-rep radius: median {r0:.2f} m, sd {v.rad.std():.2f}, range {v.rad.min():.2f}-{v.rad.max():.2f}')
th=np.radians(v.sw)
v['E0']=M*(0.5*(np.radians(v.gl)*v.rad)**2+G*v.rad*(1-np.cos(th)))                 # current: per-rep radius
v['E1']=M*(0.5*(np.radians(v.gl)*r0)**2+G*r0*(1-np.cos(th)))                        # fixed radius, gyro launch speed
v['E2']=M*(0.5*(G*v.Tf/2)**2+G*r0*(1-np.cos(th)))                                   # fixed radius, launch speed from float time
v['E3']=M*(0.5*(G*v.Tf/2)**2+G*r0*(1-np.cos(np.radians(85))))                       # float time only, mean sweep angle
rows=[]
for name in ['E0','E1','E2','E3']:
    per=v.groupby('set')[name].agg(['mean','std'])
    rows.append((name, *[f'{per.loc[s,"mean"]:5.0f}±{per.loc[s,"std"]:3.0f}' for s in per.index], f'{v[name].std()/v[name].mean()*100:4.0f}%'))
print('\nenergy per rep, J (mean±sd within set)   [CV = overall spread]')
print('        set1       set2       set3       set4      CV')
for r in rows: print(' ', *r, sep='  ')
print('\nE0 current: per-rep radius   E1 fixed radius+gyro   E2 fixed radius+float-time speed   E3 float time + mean angle')
print('mean power W at 1.5 s/rep:', {n: round(v[n].mean()/1.5) for n in ['E0','E1','E2','E3']})

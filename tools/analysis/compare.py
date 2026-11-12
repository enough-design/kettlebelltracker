import sys, numpy as np, pandas as pd
G=9.81
def load(rawp, repp, kg):
    raw=pd.read_csv(rawp); ms=raw.ms.values
    rp=pd.read_csv(repp,header=None,names=['t_ms','devset','inset','total','peak_mg','interval','gpk10','sweep10','gl10','x'])
    idx=[int(np.argmin(np.abs(ms-t))) for t in rp.t_ms]
    rp['set']=raw.set.values[idx]; rp['peak']=rp.peak_mg/1000; rp['gpk']=rp.gpk10/10; rp['sw']=rp.sweep10/10; rp['gl']=rp.gl10/10
    a=np.sqrt(raw.ax**2+raw.ay**2+raw.az**2).values/1000.0; t=ms/1000.0
    def Tf(tr):
        i=int(np.argmin(np.abs(ms-tr))); j=i; k=i
        while j<len(a) and a[j]<0.9: j+=1
        while k>0 and a[k-1]<0.9: k-=1
        return t[j]-t[k]
    rp['Tf']=[Tf(x) for x in rp.t_ms]
    w=np.radians(rp.gpk.replace(0,np.nan)); rp['rad']=(rp.peak-1)*G/w**2
    ok=(rp.gpk>0)&(rp.sw>=40)&(rp.sw<=135)&rp.rad.between(0.25,1.3)
    r0=rp.rad[ok].median()
    rp['ok']=ok; rp['kg']=kg; rp['r0']=r0
    rp['v']=np.radians(rp.gpk)*r0
    rp['vL']=np.radians(rp.gl)*r0
    rp['h']=r0*(1-np.cos(np.radians(rp.sw)))
    rp['E']=kg*(0.5*rp.vL**2+G*rp.h)
    rp['P']=np.where(rp.interval>=600, rp.E/(rp.interval/1000), np.nan)
    rp.loc[~ok,['E','P','v','vL','h']]=np.nan
    return rp
a12=load(sys.argv[1],sys.argv[2],12.0); a20=load(sys.argv[3],sys.argv[4],20.0)
print(f'session radius: 12 kg run {a12.r0.iloc[0]:.2f} m | 20 kg run {a20.r0.iloc[0]:.2f} m')
def tab(name,d):
    print(f'\n{name}: set reps valid  swing_s  peak_g  gyro_pk dps  sweep deg  speed m/s  floatT s  energy J  power W')
    for s,g in d.groupby('set'):
        iv=g.interval[g.interval>0]
        print(f'   {s}   {len(g):>3}  {int(g.ok.sum()):>3}    {iv.mean()/1000:5.2f}   {g.peak.mean():5.2f}   {g.gpk[g.ok].mean():7.0f}   {g.sw[g.ok].mean():7.0f}    {g.v.mean():6.2f}   {g.Tf.mean():6.2f}   {g.E.mean():7.0f}  {g.P.mean():7.0f}')
    print(f'   all  {len(d):>3}  {int(d.ok.sum()):>3}    {d.interval[d.interval>0].mean()/1000:5.2f}   {d.peak.mean():5.2f}   {d.gpk[d.ok].mean():7.0f}   {d.sw[d.ok].mean():7.0f}    {d.v.mean():6.2f}   {d.Tf.mean():6.2f}   {d.E.mean():7.0f}  {d.P.mean():7.0f}')
tab('12 kg (4x10)',a12); tab('20 kg (4x10, set 1 has 11)',a20)
r=a20.E.mean()/a12.E.mean()
print(f'\nenergy per rep ratio 20kg/12kg = {r:.2f}  (pure mass ratio would be {20/12:.2f})')
print(f'bell speed ratio {a20.v.mean()/a12.v.mean():.2f}, sweep ratio {a20.sw[a20.ok].mean()/a12.sw[a12.ok].mean():.2f}')
# independent flight-time cross-check
for n,d,kg in (('12',a12,12),('20',a20,20)):
    vy=G*d.Tf.mean()/2; print(f'{n} kg: float {d.Tf.mean():.3f} s -> launch speed g*T/2 = {vy:.2f} m/s')
# what the page would have shown if weight was 12 for sets 1-2 (as entered)
print('\nWhat the page showed while 12 was still entered (sets 1-2), energy per rep / power:')
for s in (1,2):
    g=a20[a20.set==s]; print(f'   set {s}: E {g.E.mean()*12/20:.0f} J, P {g.P.mean()*12/20:.0f} W  (vs {g.E.mean():.0f} J, {g.P.mean():.0f} W at 20 kg)')

print('\n=== radius sensitivity: energy per rep (J), mean over valid reps ===')
def E_fixed(d,kg,r):
    v=d[d.ok]; th=np.radians(v.sw)
    return (kg*(0.5*(np.radians(v.gl)*r)**2+G*r*(1-np.cos(th)))).mean()
def E_flight(d,kg,r):
    v=d[d.ok]; th=np.radians(v.sw)
    return (kg*(0.5*(G*v.Tf/2)**2+G*r*(1-np.cos(th)))).mean()
print('radius   gyro-launch model 12kg  20kg  ratio   | flight-time model 12kg  20kg  ratio')
for r in (0.50,0.60,0.70,0.79):
    a,b=E_fixed(a12,12,r),E_fixed(a20,20,r); c,d_=E_flight(a12,12,r),E_flight(a20,20,r)
    print(f' {r:.2f}                    {a:6.0f} {b:6.0f}  {b/a:5.2f}   |                   {c:6.0f} {d_:6.0f}  {d_/c:5.2f}')
print('\n(per-rep radius median used by page: 12 kg 0.60 m, 20 kg 0.79 m)')
# raw numbers behind the radius change
for n,d in (('12',a12),('20',a20)):
    v=d[d.ok]; print(f'{n} kg: a_peak {v.peak.mean():.2f} g, gyro at peak {v.gpk.mean():.0f} dps, gyro at launch {v.gl.mean():.0f} dps, sweep {v.sw.mean():.0f} deg')

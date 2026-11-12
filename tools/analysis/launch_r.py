import sys, numpy as np
sys.argv=[sys.argv[0]]+sys.argv[1:]
exec(open('data/compare.py').read().split("a12=load")[0])
G=9.81
for name,raw,rep in (('12 kg',sys.argv[1],sys.argv[2]),('20 kg',sys.argv[3],sys.argv[4])):
    d=load(raw,rep,12.0); v=d[d.ok]
    r=G*v.Tf/(2*np.radians(v.gl)*np.sin(np.radians(v.sw)))
    r=r[(r>0.2)&(r<1.5)]
    print(f'{name}: launch-geometry radius  median {r.median():.2f} m  sd {r.std():.2f}  IQR {r.quantile(.25):.2f}-{r.quantile(.75):.2f}  (n={len(r)})   [accel-peak method gave {v.rad.median():.2f}]')

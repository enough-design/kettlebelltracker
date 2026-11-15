"""Per-rep features for the short-swing flag, pooled over every labelled swing capture (front/back mounting, full/short).
Run: python3 -I tools/analysis/short_calib.py   (from repo root)"""
import csv, numpy as np
R = 'data/raw/'
# (file, set, mounting, truth)   truth F full / S short
CASES = [
 ('kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-16-16.csv',1,'front','F'),
 ('kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-16-16.csv',2,'front','S'),
 ('kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-16-16.csv',3,'front','S'),
 ('kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-16-16.csv',4,'back','F'),
 ('kb_raw_12kg-swing-halfvfullvbackvfront_2026-11-15-11-16-16.csv',5,'back','S'),
 ('kb_raw_12kg-swing-trace_2026-11-15-10-59-51.csv',1,'front','F'),('kb_raw_12kg-swing-trace_2026-11-15-10-59-51.csv',4,'front','F'),
 ('kb_raw_12kg-swing-trace_2026-11-15-10-59-51.csv',2,'back','F'),('kb_raw_12kg-swing-trace_2026-11-15-10-59-51.csv',3,'back','F'),
 ('kb_raw_12kg-swing-trace_2026-11-15-10-59-51.csv',5,'back','F'),
 ('kb_raw_12kg-swing-trace_2026-11-15-10-39-17.csv',1,'back','F'),('kb_raw_12kg-swing-trace_2026-11-15-10-39-17.csv',2,'front','F'),
 ('kb_raw_12kg-swings_2026-11-13-15-47-38.csv',1,'front','F'),
 ('kb_raw_2026-11-11-14-15-55_20kg_4sets.csv',1,'front','F'),('kb_raw_2026-11-11-14-15-55_20kg_4sets.csv',2,'front','F'),
 ('kb_raw_2026-11-11-14-15-55_20kg_4sets.csv',3,'front','F'),('kb_raw_2026-11-11-14-15-55_20kg_4sets.csv',4,'front','F'),
 ('kb_raw_2026-11-12-14-56-28_20kg_half-swings-set1.csv',1,'front','S'),('kb_raw_2026-11-12-14-56-28_20kg_half-swings-set1.csv',2,'front','F'),
]
def reps(path, setno):
    rows = [r for r in csv.DictReader(open(R+path)) if r['phase']=='work' and int(r['set'])==setno]
    t = np.array([float(r['t_epoch_ms']) for r in rows])/1000
    a = np.array([[float(r['ax']),float(r['ay']),float(r['az'])] for r in rows])/1000
    g = np.array([[float(r['gx']),float(r['gy']),float(r['gz'])] for r in rows])
    m = np.linalg.norm(a,axis=1); gm = np.linalg.norm(g,axis=1)
    out=[]; i=0; n=len(m); armed=False; runpk=0; last=-9; gpk=0
    while i<n:
        if m[i]>runpk: runpk=m[i]; gpk=max(gm[i-1] if i else 0,gm[i])
        if m[i]>1.5: armed=True
        if armed and m[i]<0.55:
            j=i
            while j<n and m[j]<0.9: j+=1
            dur=t[j-1]-t[i]
            if dur>=0.15 and t[i]-last>=0.9:
                out.append(dict(launch=gm[i],depth=m[i:j].min(),dur=dur,peak=runpk,gpk=gpk))
                last=t[i]
            armed=False; runpk=0; gpk=0; i=j; continue
        i+=1
    return out
def dataset():
    D=[]
    for f,s,mt,tr in CASES:
        for k,r in enumerate(reps(f,s)):
            if k==0: continue          # first rep of a set starts from rest: not comparable
            D.append(dict(file=f[7:30],set=s,mount=mt,truth=tr,**r))
    return D
if __name__=='__main__':
    D=dataset()
    for mt in ('front','back'):
        for tr in 'FS':
            X=[d for d in D if d['mount']==mt and d['truth']==tr]
            if not X: continue
            print(mt,tr,len(X),' '.join('%s %.2f-%.2f'%(k,min(x[k] for x in X),max(x[k] for x in X)) for k in ('launch','depth','dur','peak','gpk')))

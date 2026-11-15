import csv,sys,numpy as np
def run(p):
    rows=[r for r in csv.DictReader(open(p)) if r['phase'] in('work',)]
    t=np.array([float(r['t_epoch_ms']) for r in rows])/1000
    a=np.array([[float(r['ax']),float(r['ay']),float(r['az'])] for r in rows])
    m=np.linalg.norm(a,axis=1)
    out=[];i=0;armed=False;n=len(m)
    while i<n:
        if m[i]>1500: armed=True
        if armed and m[i]<550:
            j=i
            while j<n and m[j]<900: j+=1
            dur=t[j-1]-t[i]
            if dur>=0.15: out.append((round(t[i]-t[0],1),round(dur,2),int(m[i:j].min())))
            armed=False;i=j;continue
        i+=1
    return out
for p in sys.argv[1:]:
    print(p.split('/')[-1][:50]);print(' ',[x[2] for x in run(p)])

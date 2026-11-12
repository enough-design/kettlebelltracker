import sys, numpy as np, pandas as pd
G=9.81
def prep(p):
    d=pd.read_csv(p); d=d[d.phase=='work'].reset_index(drop=True)
    t=(d.ms.values-d.ms.values[0])/1000.0
    a=np.sqrt(d.ax**2+d.ay**2+d.az**2).values/1000.0
    w=np.radians(np.sqrt(d.gx**2+d.gy**2+d.gz**2).values)
    # float centres -> rep boundaries
    fl=[];i=0;n=len(a)
    while i<n:
        if a[i]<0.9:
            j=i
            while j<n and a[j]<0.9: j+=1
            if a[i:j].min()<0.55 and (j-i)>=8: fl.append((i,j))
            i=j
        else: i+=1
    return t,a,w,fl
def est(p):
    t,a,w,fl=prep(p)
    A=[];B=[];C=[]
    X=[];Y=[]
    for k in range(1,len(fl)):
        i0=fl[k-1][1]; i1=fl[k][0]            # tension phase between two floats
        seg=slice(i0,i1)
        if i1-i0<10: continue
        ap=a[seg].argmax()+i0
        wm=w[seg].argmax()+i0
        # (B) at accel peak (current page method), (A) at gyro-max instant (tangential accel ~ 0)
        B.append((a[ap]-1)*G/w[ap]**2)
        A.append((a[wm]-1)*G/w[wm]**2)
        X+=list(w[seg]**2); Y+=list(a[seg]*G)
    X=np.array(X);Y=np.array(Y)
    m=X>np.percentile(X,40)                    # use the fast part of the swing only
    slope,icpt=np.polyfit(X[m],Y[m],1)
    return dict(n=len(A),B=np.median(B),Bsd=np.std(B),A=np.median(A),Asd=np.std(A),C=slope,Cint=icpt/G)
for name,p in (('12 kg',sys.argv[1]),('20 kg',sys.argv[2])):
    r=est(p)
    print(f"{name}: reps {r['n']:>2} | at accel peak r={r['B']:.2f} (sd {r['Bsd']:.2f}) | at gyro-max r={r['A']:.2f} (sd {r['Asd']:.2f}) | regression slope r={r['C']:.2f} (intercept {r['Cint']:.2f} g)")

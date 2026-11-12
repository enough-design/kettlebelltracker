import sys
import pandas as pd, numpy as np
def load(p):
    d = pd.read_csv(p); d['t']=(d.ms-d.ms.iloc[0])/1000.0
    d['mag']=np.sqrt(d.ax**2+d.ay**2+d.az**2)/1000.0; return d
def run(t, m, LOW=0.55, EXIT=0.9, ARM=1.5, MINF=0.02, GAP=0.9):
    armed=False; counted=False; ls=None; last=-99; pk=0; out=[]
    for ti, mi in zip(t, m):
        if mi>ARM: armed=True
        pk=max(pk,mi)
        if mi<LOW:
            if ls is None: ls=ti
            if armed and not counted and ti-ls>=MINF and ls-last>=GAP:
                out.append((ls,pk)); last=ls; counted=True; armed=False; pk=0
        elif mi>EXIT: ls=None; counted=False
    return out
bell = load(sys.argv[1]); hand = load(sys.argv[2])
print('bell: depth of each float (min |a| in g):')
r = run(bell.t.values, bell.mag.values)
mins=[]
for ts,_ in r:
    seg = bell[(bell.t>=ts)&(bell.t<=ts+0.6)].mag
    mins.append(seg.min())
print(' ', np.round(mins,2).tolist())
print(f'  deepest {min(mins):.2f}  shallowest {max(mins):.2f}')
# non-float low shoulders: lowest |a| value between floats that is NOT a float, i.e. min over the swing's mid portion
print('\nreps counted by LOW threshold   (bell expected 20 | hand-swing file work phase ~11-13)')
hw = hand[hand.phase=='work']
for LOW in (0.2,0.3,0.4,0.5,0.55,0.6,0.7,0.8,0.9):
    b=len(run(bell.t.values,bell.mag.values,LOW=LOW)); h=len(run(hw.t.values,hw.mag.values,LOW=LOW))
    print(f'  LOW={LOW:<5} bell={b:<3} hand={h}')
print('\nbell, ARM sweep:', {a:len(run(bell.t.values,bell.mag.values,ARM=a)) for a in (1.0,1.2,1.5,1.8,2.0,2.5)})
print('bell, EXIT sweep:', {e:len(run(bell.t.values,bell.mag.values,EXIT=e)) for e in (0.6,0.7,0.9,1.1)})
print('bell, MINF sweep:', {f:len(run(bell.t.values,bell.mag.values,MINF=f)) for f in (0.0,0.02,0.06,0.1,0.2)})
# peak per rep, axis, and float duration stats
pk=[p for _,p in r]
print('\npeak |a| per rep set1:', np.round(pk[:10],2).tolist())
print('peak |a| per rep set2:', np.round(pk[10:],2).tolist())
print('mean peak set1 %.2f set2 %.2f'%(np.mean(pk[:10]),np.mean(pk[10:])))

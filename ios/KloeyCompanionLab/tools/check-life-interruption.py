"""Check measured engine output from the documented life-interrupt replay."""
import re, sys, math
s=open(sys.argv[1]).read()
positions=[tuple(map(float,p.split(', '))) for p in re.findall(r'WorldTransform \{\s+position: \(([^)]+)\)',s)]
assert len(positions)==3,'Use the documented 5.8 / 6.5 / 9 second dump sequence'
distance=lambda a,b:math.dist(a,b)
assert distance(positions[1],positions[2])<.005,'Character moved during listening'
assert distance(positions[0],positions[1])<.25,'Excessive travel around speech onset'
assert all(abs(p[0])<.42 and -1.64<p[2]<1.44 and abs(p[1]+.005)<.01 for p in positions),'Left safe grounded corridor'
states=[(float(t),int(state)) for t,state in re.findall(r'([\d.]+)s\].*calm life: state (\d)',s)]
held=next(t for t,state in states if state==4)
resumed=next(t for t,state in states if state==2 and t>held)
assert resumed-held>8,'Resumed before the simulated speech and quiet interval completed'
assert 'ERROR' not in s and 'error:' not in s,'Engine error in replay'
print(f'Interruption passed: listening drift {distance(positions[1],positions[2]):.3f}m; stayed grounded; resumed {resumed-held:.1f}s after speech onset.')

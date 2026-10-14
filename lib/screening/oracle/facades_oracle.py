# Independent oracle for H3.2: exposed façade per CTE orientation, computed with
# shapely from the raw GML, without the TypeScript parser or the SQL.
import re, sys, json, math
from shapely.geometry import Polygon, MultiPolygon, LineString
from shapely.ops import unary_union
from shapely import make_valid
from shapely.geometry.polygon import orient

def bins(n):  # CTE figura 8 sectors, bearing from north
    a = n % 360
    if a < 22.5 or a >= 337.5: return 'N'
    if a < 60: return 'NE'
    if a < 111: return 'E'
    if a < 162: return 'SE'
    if a < 198: return 'S'
    if a < 249: return 'SO'
    if a < 300: return 'O'
    return 'NO'

path, tol = sys.argv[1], float(sys.argv[2])
s = open(path, encoding='latin-1').read()
B = {}
for blk in re.findall(r'<gml:featureMember>.*?</gml:featureMember>', s, re.S):
    ref = re.search(r'<base:localId>([^<]+)', blk).group(1)
    polys = []
    for patch in re.findall(r'<gml:PolygonPatch>(.*?)</gml:PolygonPatch>', blk, re.S):
        rings = []
        for pl in re.findall(r'<gml:posList[^>]*>([^<]*)</gml:posList>', patch):
            v = list(map(float, pl.split()))
            rings.append(list(zip(v[0::2], v[1::2])))
        polys.append(Polygon(rings[0], rings[1:]))
    B[ref] = unary_union([make_valid(p) for p in polys])
out = {}
for ref, g in B.items():
    nb = [h for r, h in B.items() if r != ref and h.distance(g) <= tol]
    zone = unary_union(nb).buffer(tol) if nb else None
    parts = list(g.geoms) if hasattr(g, 'geoms') else [g]
    street = {k: 0.0 for k in ['N','NE','E','SE','S','SO','O','NO']}
    court = dict(street); per = 0.0; party = 0.0
    for p in parts:
        if p.geom_type != 'Polygon': continue
        p = orient(p, sign=-1.0)  # exterior clockwise, holes counter-clockwise
        for ri, ring in enumerate([p.exterior] + list(p.interiors)):
            c = list(ring.coords)
            for (x1, y1), (x2, y2) in zip(c, c[1:]):
                L = math.hypot(x2 - x1, y2 - y1)
                if L == 0: continue
                az = math.degrees(math.atan2(x2 - x1, y2 - y1)) % 360  # bearing from north
                sh = LineString([(x1, y1), (x2, y2)]).intersection(zone).length if zone is not None else 0.0
                sh = min(sh, L)
                per += L; party += sh
                (street if ri == 0 else court)[bins(az - 90)] += L - sh
    out[ref] = {'perimeter': per, 'party': party, 'street': street, 'courtyard': court}
print(json.dumps(out, indent=1, sort_keys=True))

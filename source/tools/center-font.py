# Unbroken · tools · center-font.py
# An outline font with even, thin strokes (like Dune Rise) → a single-stroke entry for source/engine/fonts.js: each
# glyph drawn at 1 px per font unit, thinned to its middle line (skeleton), spurs shorter than the stroke width
# dropped, traced into strokes and simplified (2 units).
#   python3 center-font.py <font.ttf|otf> "<label>" <out.json>        (needs fonttools, pillow, scikit-image, scipy)
import sys, json, math, numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont
from skimage.morphology import skeletonize
from scipy.ndimage import distance_transform_edt
F, label, out = sys.argv[1], sys.argv[2], sys.argv[3]
tt = TTFont(F); upm = tt['head'].unitsPerEm; cmap = tt.getBestCmap(); hmtx = tt['hmtx']
SZ = upm  # 1 px = 1 font unit
font = ImageFont.truetype(F, SZ)
def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0]), np.array(pts[-1]); d = b - a; n = np.hypot(*d)
    P = np.array(pts)
    dist = np.abs(d[0] * (P[:, 1] - a[1]) - d[1] * (P[:, 0] - a[0])) / n if n > 0 else np.hypot(*(P - a).T)
    i = int(np.argmax(dist))
    if dist[i] > eps: return rdp(pts[:i+1], eps)[:-1] + rdp(pts[i:], eps)
    return [pts[0], pts[-1]]
N8 = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
def trace(sk):
    ys, xs = np.nonzero(sk); S = set(zip(ys.tolist(), xs.tolist()))
    nb = lambda p: [(p[0]+dy, p[1]+dx) for dy, dx in N8 if (p[0]+dy, p[1]+dx) in S]
    deg = {p: len(nb(p)) for p in S}
    nodes = {p for p in S if deg[p] != 2}
    used = set(); paths = []
    key = lambda a, b: (min(a, b), max(a, b))
    for n in nodes:
        for q in nb(n):
            if key(n, q) in used: continue
            path = [n, q]; used.add(key(n, q)); prev, cur = n, q
            while cur not in nodes:
                nxt = [r for r in nb(cur) if r != prev and key(cur, r) not in used]
                if not nxt: break
                used.add(key(cur, nxt[0])); prev, cur = cur, nxt[0]; path.append(cur)
            paths.append(path)
    rest = {p for p in S if all(key(p, q) in used for q in nb(p))}
    for p in S:  # pure cycles (an O)
        if any(key(p, q) not in used for q in nb(p)):
            path = [p]; prev = None; cur = p
            while True:
                nxt = [r for r in nb(cur) if key(cur, r) not in used]
                if not nxt: break
                used.add(key(cur, nxt[0])); prev, cur = cur, nxt[0]; path.append(cur)
                if cur == p: break
            if len(path) > 2: paths.append(path)
    return paths, deg
glyphs = {}; widths = []
for code, name in sorted(cmap.items()):
    ch = chr(code)
    if code > 0x2000 or code < 32: continue
    adv = hmtx[name][0]
    if ch == " ": glyphs[ch] = [adv, ""]; continue
    pad = 50; asc = upm * 1.5
    W, H = int(adv + upm), int(upm * 2.2)
    im = Image.new("L", (W, H), 0); d = ImageDraw.Draw(im)
    d.text((pad, asc), ch, font=font, fill=255, anchor="ls")
    m = np.array(im) > 127
    if not m.any(): glyphs[ch] = [adv, ""]; continue
    dt = distance_transform_edt(m); widths.append(2 * dt.max())
    sk = skeletonize(m)
    paths, deg = trace(sk)
    half = dt.max()
    # drop spurs: a branch from a junction to a free end shorter than the stroke's width
    keep = [p for p in paths if not ((deg[p[0]] == 1) != (deg[p[-1]] == 1) and len(p) < 2.2 * half)]
    strokes = []
    for p in keep:
        pts = [(x - pad, asc - y) for y, x in p]
        pts = rdp(pts, 2.0)
        if len(pts) >= 2: strokes.append(" ".join(f"{round(x)},{round(y)}" for x, y in pts))
    glyphs[ch] = [adv, "|".join(strokes)]
# the cap height of the middle line: an H's strokes, top to bottom (the font's own cap height counts the stroke's
# thickness, so letters would come out short)
hy = [float(q.split(",")[1]) for q in glyphs["H"][1].replace("|", " ").split()] if "H" in glyphs else []
capH = round(max(hy) - min(hy)) if hy else 700
print("cap", capH, "stroke width", round(float(np.median(widths)), 1), "glyphs", len(glyphs))
json.dump({"label": label, "family": tt['name'].getDebugName(1), "cap": capH, "joined": False, "glyphs": glyphs}, open(out, "w"), separators=(",", ":"))

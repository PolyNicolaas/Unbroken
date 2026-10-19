# Unbroken · tools · line-font.py
# A font whose letters are already the line to print (each glyph a hairline: the same closed path drawn once each
# way, enclosing no area, like the Chocolate font made from choc OS's lettering) → an entry for source/engine/fonts.js.
# Each path is kept once (its reversed twin dropped) and flattened to points in font units, y up from the baseline.
#   python3 line-font.py <font.ttf|otf> "<label>" <out.json> [cap height in font units, default 700] [joined: 1|0]
# Then add the JSON to fonts.js under a new key. For an ordinary outline font with even, thin strokes, use
# center-font.py instead (the middle line of each stroke).
import sys, json, math
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen

F, label, out = sys.argv[1], sys.argv[2], sys.argv[3]
cap = int(sys.argv[4]) if len(sys.argv) > 4 else 700
joined = (sys.argv[5] != "0") if len(sys.argv) > 5 else True


class Flat(BasePen):
    def __init__(s, gs):
        super().__init__(gs)
        s.c, s.cur = [], None

    def _moveTo(s, p):
        s.cur = [p]
        s.c.append(s.cur)

    def _lineTo(s, p):
        s.cur.append(p)

    def seg(s, f, n=6):
        p0 = s.cur[-1]
        for i in range(1, n + 1):
            s.cur.append(f(i / n, p0))

    def _curveToOne(s, a, b, c):
        s.seg(lambda t, p0: tuple((1 - t) ** 3 * p0[k] + 3 * (1 - t) ** 2 * t * a[k] + 3 * (1 - t) * t * t * b[k] + t ** 3 * c[k] for k in (0, 1)))

    def _qCurveToOne(s, a, b):
        s.seg(lambda t, p0: tuple((1 - t) ** 2 * p0[k] + 2 * (1 - t) * t * a[k] + t * t * b[k] for k in (0, 1)))

    def _closePath(s):
        pass


tt = TTFont(F)
gs, cmap = tt.getGlyphSet(), tt.getBestCmap()
glyphs = {}
for code, name in sorted(cmap.items()):
    ch = "-" if chr(code) == "–" else chr(code)
    p = Flat(gs)
    gs[name].draw(p)
    kept, seen = [], set()
    for c in p.c:
        if len(c) < 2:
            continue
        xs, ys = [q[0] for q in c], [q[1] for q in c]
        L = sum(math.dist(c[i], c[(i + 1) % len(c)]) for i in range(len(c)))
        key = (round(min(xs) / 4), round(min(ys) / 4), round(max(xs) / 4), round(max(ys) / 4), round(L / 8))
        if key in seen:  # the same path the other way round
            continue
        seen.add(key)
        pts = [c[0]]
        for q in c[1:] + [c[0]]:
            if math.dist(q, pts[-1]) >= 3:
                pts.append(q)
        if math.dist(pts[-1], c[0]) > 0.5:
            pts.append(c[0])  # closed
        kept.append(pts)
    glyphs[ch] = [gs[name].width, "|".join(" ".join(f"{round(x)},{round(y)}" for x, y in pts) for pts in kept)]
glyphs.setdefault(" ", [250, ""])
json.dump({"label": label, "family": tt["name"].getDebugName(1), "cap": cap, "joined": joined, "glyphs": glyphs},
          open(out, "w"), separators=(",", ":"))
print(f"{len(glyphs)} glyphs → {out}")

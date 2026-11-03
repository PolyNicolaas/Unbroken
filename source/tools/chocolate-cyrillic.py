#!/usr/bin/env python3
# Unbroken · tools · chocolate-cyrillic.py
# Cyrillic for the Chocolate font. choc OS's lettering is Quicksand Bold, each letter rescaled on its own (capitals
# to 700 units tall, a small letter's x-height part to 400) and printed as its outline. Quicksand has no Cyrillic, so
# the letters are drawn here in its style: a letter Cyrillic shares with Latin (А В Е К М Н О Р С Т Х, а е о р с у х,
# З from the 3, І і) is Chocolate's own; the rest are built from Quicksand Bold's outlines (И a mirrored N, Я a
# mirrored R, Л a flipped V, Э and Є a C with a bar) and from strokes along centre lines with Quicksand's round-ended
# stroke (125 units in capitals, 120 in small letters; a stroke built this way matches Quicksand's own I within 0.2%),
# then rescaled the way choc OS does and written as closed outlines. Russian, Ukrainian (Є І Ї Ґ) and Belarusian Ў,
# and the punctuation choc OS's lettering lacks: , : ; ' " « ».
#   python3 chocolate-cyrillic.py <Quicksand[wght].ttf or Quicksand-Bold.ttf> <source/engine/fonts.js>
# (needs fonttools, shapely and node; Quicksand: Google Fonts, SIL Open Font License 1.1)
import math, sys, json, subprocess, re
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union
from shapely import affinity
QS = TTFont(sys.argv[1])
if "fvar" in QS:  # the variable Quicksand: its Bold
    from fontTools.varLib.instancer import instantiateVariableFont
    QS = instantiateVariableFont(QS, {"wght": 700})
GS = QS.getGlyphSet(); CM = QS.getBestCmap()
class Flat(BasePen):
    def __init__(s,gs): super().__init__(gs); s.c=[]
    def _moveTo(s,p): s.c.append([p])
    def _lineTo(s,p): s.c[-1].append(p)
    def _curveToOne(s,a,b,c):
        p0=s.c[-1][-1]
        for i in range(1,13):
            t=i/12; s.c[-1].append(tuple((1-t)**3*p0[k]+3*(1-t)**2*t*a[k]+3*(1-t)*t*t*b[k]+t**3*c[k] for k in (0,1)))
    def _qCurveToOne(s,a,b):
        p0=s.c[-1][-1]
        for i in range(1,13):
            t=i/12; s.c[-1].append(tuple((1-t)**2*p0[k]+2*(1-t)*t*a[k]+t*t*b[k] for k in (0,1)))
    def _closePath(s): pass
def G(ch):
    """a Quicksand Bold glyph as a shapely shape (outer contours united, holes cut out)"""
    p=Flat(GS); GS[CM[ord(ch)]].draw(p)
    outer=[];holes=[]
    for c in p.c:
        if len(c)<3: continue
        P=Polygon(c)
        a=sum(c[i][0]*c[(i+1)%len(c)][1]-c[(i+1)%len(c)][0]*c[i][1] for i in range(len(c)))/2
        (outer if a<0 else holes).append(P.buffer(0))   # TrueType: outer contours run clockwise
    g=unary_union(outer)
    for h in holes: g=g.difference(h)
    return g
W_CAP=125.0   # Quicksand Bold's stroke, capitals (I is 75..200)
W_LC=120.0    # lowercase (l is 75..195)
def S(pts,w):
    """a stroke along a centre line, round ends and joins, like Quicksand's"""
    return LineString(pts).buffer(w/2, cap_style="round", join_style="round", quad_segs=16)
def arc(cx,cy,rx,ry,a0,a1,n=40):
    return [(cx+rx*math.cos(math.radians(a0+(a1-a0)*i/n)), cy+ry*math.sin(math.radians(a0+(a1-a0)*i/n))) for i in range(n+1)]
def mirror(g): b=g.bounds; return affinity.scale(g,-1,1,origin=((b[0]+b[2])/2,0))
def flipv(g,cy): return affinity.scale(g,1,-1,origin=(0,cy))
def clip(g,x0=-1e4,y0=-1e4,x1=1e4,y1=1e4): return g.intersection(box(x0,y0,x1,y1))
def mv(g,dx=0,dy=0): return affinity.translate(g,dx,dy)
U=unary_union

FONTS = __import__("os").path.abspath(sys.argv[2])
CH = json.loads(subprocess.run(["node", "-e", f"process.stdout.write(JSON.stringify(require({json.dumps(FONTS)}).chocolate.glyphs))"], capture_output=True, text=True, check=True).stdout)
# ---- capitals: Quicksand units, stroke 125; centre lines from y=62.5 (baseline) to 637.5 (cap)
w = W_CAP; r = w / 2; B, T = r, 700 - r; MID = 350; L = 137.5
def st(*p, ww=w): return S(list(p), ww)
def ring(cx, cy, rx, ry, ww=w): return S(arc(cx, cy, rx, ry, 0, 360, 96), ww)
def dots(cx, y, gap, d):  # two dots (a diaeresis), each d across
    return U([Point(cx - gap / 2, y).buffer(d / 2, quad_segs=16), Point(cx + gap / 2, y).buffer(d / 2, quad_segs=16)])
def breve(cx, y, half, ww):
    return S(arc(cx, y + half * 0.75, half, half * 0.75, 200, 340, 30), ww)
Bq = G("B")
caps = {}
def capbowl(x, right=552.5, bt=367.0):  # Ь's bowl: from the stem along the middle, round, back along the baseline
    a = (bt - B) / 2
    return U([st((x, bt), (x + right - L - a, bt)), S(arc(x + right - L - a, (bt + B) / 2, a, a, 90, -90, 30), w), st((x + right - L - a, B), (x, B))])
caps["Б"] = (U([st((L, B), (L, T), (470, T)), capbowl(L)]), None)
caps["Г"] = (st((L, B), (L, T), (470, T)), None)
caps["Д"] = (U([st((215, T), (520, T), (520, B)), st((215, T), (175, 200), (100, B)), st((30, -85), (30, B), (610, B), (610, -85))]), None)
Ka = clip(G("K"), x0=137.5)
Kw = Ka.bounds[2] - 137.5
caps["Ж"] = (U([mv(Ka, Kw - 137.5 + 75), mv(mirror(Ka), 75 - Ka.bounds[0] + 0), st((Kw + 75, B), (Kw + 75, T))]), None)
N = G("N")
caps["И"] = (mirror(N), None)
caps["Й"] = (mirror(N), breve((N.bounds[0] + N.bounds[2]) / 2, 770, 135, 105))
V = G("V")
caps["Л"] = (flipv(V, 350), None)
caps["П"] = (st((L, B), (L, T), (581.5, T), (581.5, B)), None)
caps["У"] = (U([st((90, T), (330, 250)), st((580, T), (180, B))]), None)
caps["Ф"] = (U([st((360, B - 30), (360, T + 30)), ring(360, 350, 270, 200)]), None)
caps["Ц"] = (U([st((L, T), (L, B), (600, B), (600, -85)), st((520, T), (520, B))]), None)
caps["Ч"] = (U([st((L, T), (L, 400)), S(arc(L + 150, 400, 150, 150, 180, 270, 24) + [(500, 250)], w), st((520, T), (520, B))]), None)
caps["Ш"] = (st((L, T), (L, B), (757.5, B), (757.5, T)), None)
caps["Ш"] = (U([caps["Ш"][0], st((447.5, T), (447.5, B))]), None)
caps["Щ"] = (U([caps["Ш"][0], st((757.5, B), (840, B), (840, -85))]), None)
caps["Ь"] = (U([st((L, B), (L, T)), capbowl(L)]), None)
caps["Ъ"] = (U([mv(caps["Ь"][0], 150), st((40, T), (L + 150, T))]), None)
caps["Ы"] = (U([caps["Ь"][0], st((750, B), (750, T))]), None)
Cq = G("C")
caps["Э"] = (U([mirror(Cq), st((200, 350), (500, 350))]), None)
caps["Є"] = (U([Cq, st((150, 350), (430, 350))]), None)
caps["Ю"] = (U([st((L, B), (L, T)), st((L, 350), (330, 350)), ring(560, 350, 240, 297.5)]), None)
caps["Я"] = (mirror(G("R")), None)
caps["Ґ"] = (st((L, B), (L, T), (470, T), (470, 830)), None)
caps["Ё"] = (G("E"), dots(G("E").centroid.x, 800, 230, 130))
caps["Ї"] = (G("I"), dots(137.5, 800, 230, 130))
caps["Ў"] = (caps["У"][0], breve(335, 770, 135, 105))
# ---- lowercase: Quicksand units, stroke 120; x-height 545: centre lines from 60 to 485
w = W_LC; r = w / 2; B, T = r, 545 - r; l = 125; M = 272.5
def st(*p, ww=w): return S(list(p), ww)
def ring(cx, cy, rx, ry, ww=w): return S(arc(cx, cy, rx, ry, 0, 360, 96), ww)
lc = {}
Oq = G("o")
lc["б"] = (U([Oq, S([(100, 272)] + arc(200, 600, 100, 80, 180, 90, 20)[0:] + [(440, 680)], w)]), None)
def bowls(x, top, mid, bot, wt, wb):  # в-like: two stacked bowls on a stem at x
    a = (top - mid) / 2; b = (mid - bot) / 2
    return U([st((x, top), (x + wt - a, top)), S(arc(x + wt - a, (top + mid) / 2, a, a, 90, -90, 24), w), st((x + wt - a, mid), (x, mid)),
              st((x, mid), (x + wb - b, mid)), S(arc(x + wb - b, (mid + bot) / 2, b, b, 90, -90, 24), w), st((x + wb - b, bot), (x, bot)), st((x, top), (x, bot))])
lc["в"] = (bowls(l, T, 290, B, 260, 290), None)
lc["г"] = (st((l, B), (l, T), (390, T)), None)
lc["д"] = (U([st((200, T), (450, T), (450, B)), st((200, T), (170, 160), (100, B)), st((30, -140), (30, B), (530, B), (530, -140))]), None)
kq = G("k"); ka = clip(G("к") if False else kq, x0=125, y1=545)
lc["ж"] = (U([st((380, B), (380, T)), st((380, M), (640, T)), st((380, M), (650, B)), st((380, M), (120, T)), st((380, M), (110, B))]), None)
lc["з"] = (U([S(arc(225, (T + 285) / 2, (T - 285) / 2 + 20, (T - 285) / 2, 160, -90, 30), w), S(arc(235, (285 + B) / 2, (285 - B) / 2 + 25, (285 - B) / 2, 90, -160, 30), w), st((205, 285), (240, 285))]), None)
lc["и"] = (U([st((l, T), (l, B), (430, T), (430, B))]), None)
lc["й"] = (lc["и"][0], breve(277, 585, 115, 95))
lc["к"] = (U([st((l, B), (l, T)), st((l, M), (420, T)), st((l + 30, M), (430, B))]), None)
v = G("v")
lc["л"] = (flipv(v, (v.bounds[1] + v.bounds[3]) / 2), None)
lc["м"] = (st((l, B), (l, T), (362, 150), (600, T), (600, B)), None)
lc["н"] = (U([st((l, B), (l, T)), st((430, B), (430, T)), st((l, M), (430, M))]), None)
lc["п"] = (st((l, B), (l, T), (430, T), (430, B)), None)
lc["т"] = (U([st((60, T), (440, T)), st((250, T), (250, B))]), None)
lc["ф"] = (U([st((310, -140), (310, 680)), ring(310, M, 230, 212.5)]), None)
lc["ц"] = (U([st((l, T), (l, B), (510, B), (510, -140)), st((430, T), (430, B))]), None)
lc["ч"] = (U([st((l, T), (l, 330)), S(arc(l + 110, 330, 110, 110, 180, 270, 24) + [(430, 220)], w), st((430, T), (430, B))]), None)
lc["ш"] = (U([st((l, T), (l, B), (665, B), (665, T)), st((395, T), (395, B))]), None)
lc["щ"] = (U([lc["ш"][0], st((665, B), (745, B), (745, -140))]), None)
def soft(x):  # ь: stem and a lower bowl
    bt = 300; b = (bt - B) / 2
    return U([st((x, T), (x, B)), st((x, bt), (x + 290 - b, bt)), S(arc(x + 290 - b, (bt + B) / 2, b, b, 90, -90, 24), w), st((x + 290 - b, B), (x, B))])
lc["ь"] = (soft(l), None)
lc["ъ"] = (U([soft(l + 130), st((40, T), (l + 130, T))]), None)
lc["ы"] = (U([soft(l), st((560, B), (560, T))]), None)
cq = G("c")
lc["э"] = (U([mirror(cq), st((160, M), (410, M))]), None)
lc["є"] = (U([cq, st((130, M), (370, M))]), None)
lc["ю"] = (U([st((l, B), (l, T)), st((l, M), (260, M)), ring(445, M, 195, 212.5 + 4)]), None)
def ya(x):
    a = (T - 290) / 2
    return U([st((x, T), (x, B)), st((x, T), (x - 300 + a, T)), S(arc(x - 300 + a, (T + 290) / 2, a, a, 90, 270, 24), w), st((x - 300 + a, 290), (x, 290)), st((x - 150, 290), (x - 330, B))])
lc["я"] = (ya(440), None)
lc["ґ"] = (st((l, B), (l, T), (390, T), (390, 640)), None)
iq = G("i"); i_stem = clip(iq, y1=560)
lc["ї"] = (i_stem, dots(125, 650, 190, 115))
lc["ў"] = (G("y"), breve((G("y").bounds[0] + G("y").bounds[2]) / 2, 585, 115, 95))
lc["ё"] = (G("e"), dots(G("e").centroid.x, 650, 200, 115))
# ---- to Chocolate: choc OS fits each capital to 700 tall and each small letter's x-height part to 400
def out(base, marks, cap):
    g = U([base] + ([marks] if marks is not None else []))
    g = g.buffer(1.5, quad_segs=16).buffer(-1.5, quad_segs=16)  # close hairline slivers where two parts' edges nearly meet
    y0, y1 = base.bounds[1], base.bounds[3]
    yb = y0 if -30 < y0 < 0 else 0.0
    s = 700 / (y1 - yb) if cap else 400 / (min(y1, 555) - yb)  # a small letter: its x-height part (an ascender doesn't count)
    g = affinity.scale(g, s, s, origin=(0, 0))
    g = mv(g, 1 - g.bounds[0], -yb * s)
    rings_ = []
    for p in getattr(g, "geoms", [g]):
        p = p.simplify(0.4)
        for rr in [p.exterior] + list(p.interiors):
            c = list(rr.coords)
            rings_.append(" ".join(f"{round(x)},{round(y)}" for x, y in c))
    return [round(g.bounds[2] + 1), "|".join(rings_)]
G2 = {}
for k, (b, m) in caps.items(): G2[k] = out(b, m, True)
for k, (b, m) in lc.items(): G2[k] = out(b, m, False)
# punctuation choc OS's lettering lacks (it has ! ? ( ) only), at full size like its ! and ?
def punct(g):
    g = mv(g, 1 - g.bounds[0])
    return [round(g.bounds[2] + 1), "|".join(" ".join(f"{round(x)},{round(y)}" for x, y in rr.coords) for p in getattr(g, "geoms", [g]) for rr in [p.simplify(0.4).exterior] + list(p.simplify(0.4).interiors))]
for c in ",:;'\"«»":
    G2[c] = punct(G(c))
# the letters Cyrillic shares with Latin: Chocolate's own
for cy, la in zip("АВЕКМНОРСТХЗІаеорсухі", "ABEKMHOPCTX3Iaeopcyxi"): G2[cy] = CH[la]
# write them into fonts.js: Chocolate's glyphs, any earlier Cyrillic replaced
src = open(FONTS, encoding="utf8").read()
i = src.index("    chocolate: {"); j = src.index("      glyphs: {", i) + len("      glyphs: {\n"); k = src.index("\n      },\n    },", j)
keep = [ln for ln in src[j:k].split("\n") if not any(ln.startswith(f"        {json.dumps(c, ensure_ascii=False)}:") for c in G2)]
new = [f"        {json.dumps(c, ensure_ascii=False)}: [{a}, {json.dumps(p)}]," for c, (a, p) in sorted(G2.items())]
open(FONTS, "w", encoding="utf8").write(src[:j] + "\n".join(keep + new) + src[k:])
print(len(G2), "glyphs written to", FONTS + ":", "".join(sorted(G2)))

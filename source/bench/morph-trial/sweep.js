// which way up is cleaner, and how many characters a morph word can have
const { wordShape } = require("./wordshape.js"), { UNB } = require("./shapes.js");
const fs = require("fs");
const D = 1.34, HOLD = 0.28, MAXW = +(process.env.MAXW || 50);
const shapeXY = (kind, R) => { const x = [], y = []; for (let i = 0; i < 1440; i++) { const t = (2 * Math.PI * i) / 1440; if (kind === "heart") { x.push((16 * Math.sin(t) ** 3 * R) / 17); y.push(((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * R) / 17); } else { x.push(R * Math.cos(t)); y.push(R * Math.sin(t)); } } return kind === "heart" ? { x: x.reverse(), y: y.reverse() } : { x, y }; };
function plan(x, y) { const O = UNB.vaseLineLoop(x, y); return { P: { kind: "drawing", loop: O.loop, round: 0 }, reach: O.reach }; }
function word(t) { let cap = 20, S = wordShape(t, { cap }); const xs = S.loop.map((p) => p[0]), wd = Math.max(...xs) - Math.min(...xs); if (wd > MAXW) { cap = (20 * MAXW) / wd; S = wordShape(t, { cap }); } return { S, cap }; }
function morph(b, t) {
  const V = Object.assign(UNB.vaseDefaults(), { height: 30, profile: [[0, b.reach], [1, t.reach]], move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }, plan: b.P, planTop: t.P });
  const it = UNB.vaseStack(V, { h: 0.3, base: 0, w: 0.84, d: D, overhang: HOLD }); let r; while (!(r = it.next()).done); const R = r.value, m = R.morph;
  const out = R.overhang.worst, inn = R.overhang.inWorst;
  const ok = out <= HOLD + 0.03 && inn <= 0.05 && m.closest >= 0.9 * D && m.moved <= 2 * D;
  return { ok, out: +out.toFixed(2), inn: +inn.toFixed(2), closest: +m.closest.toFixed(2), moved: +m.moved.toFixed(2) };
}
const list = process.argv[2].split(",");
const rows = [];
for (const t of list) {
  const { S, cap } = word(t), wl = plan(S.loop.map((p) => p[0]), S.loop.map((p) => p[1]));
  for (const kind of ["heart", "circle"]) {
    const sh = plan(...Object.values(shapeXY(kind, Math.max(12, wl.reach * 0.85))));
    const up = morph(sh, wl), down = morph(wl, sh);
    const row = { t, n: t.length, cap: +cap.toFixed(1), kind, toWord: up, fromWord: down };
    rows.push(row); console.log(JSON.stringify(row));
  }
}
fs.writeFileSync(process.env.OUT || "out/sweep.json", JSON.stringify(rows));

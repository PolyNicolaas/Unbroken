// is a huge step real, or the step measure losing track after laps are untangled? measure with a global search
const { wordShape } = require("./wordshape.js"), { UNB } = require("./shapes.js");
function plan(x, y) { const O = UNB.vaseLineLoop(x, y); return { P: { kind: "drawing", loop: O.loop, round: 0 }, reach: O.reach }; }
const t = process.argv[2], S = wordShape(t, { cap: 18 }), wl = plan(S.loop.map((p) => p[0]), S.loop.map((p) => p[1]));
const x = [], y = []; for (let i = 0; i < 1440; i++) { const a = (2 * Math.PI * i) / 1440; x.push(wl.reach * 0.85 * Math.cos(a)); y.push(wl.reach * 0.85 * Math.sin(a)); }
const c = plan(x, y);
const V = Object.assign(UNB.vaseDefaults(), { height: 30, profile: [[0, c.reach], [1, wl.reach]], move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }, plan: c.P, planTop: wl.P });
const it = UNB.vaseStack(V, { h: 0.3, base: 0, w: 0.84, d: 1.34, overhang: 0.28 }); let r; while (!(r = it.next()).done); const R = r.value;
let worst = 0, at = -1, n = 0;
for (let k = 1; k < R.walls.length; k++) { const A = R.walls[k - 1], B = R.walls[k], G = new Map(), cell = 2;
  for (let i = 0; i < A.x.length; i++) { const q = Math.floor(A.x[i] / cell) + "," + Math.floor(A.y[i] / cell); (G.get(q) || G.set(q, []).get(q)).push(i); }
  for (let i = 0; i < B.x.length; i += 2) { let b = Infinity; const gx = Math.floor(B.x[i] / cell), gy = Math.floor(B.y[i] / cell); for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (const j of G.get(gx + dx + "," + (gy + dy)) || []) { const jj = (j + 1) % A.x.length; b = Math.min(b, Math.sqrt(UNB._u.segDist2(B.x[i], B.y[i], A.x[j], A.y[j], A.x[jj], A.y[jj]))); } if (b > 0.31) n++; if (b > worst && b < Infinity) { worst = b; at = k; } } }
console.log(t, "engine's step", R.overhang.worst.toFixed(2), "| global nearest step", worst.toFixed(2), "at lap", at, "| points over 0.31 mm:", n, "| closest", R.morph.closest.toFixed(2));

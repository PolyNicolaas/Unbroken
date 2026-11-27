const M = require("./morph.js"), { textLoop, UNB } = require("./shapes.js");
const { createCanvas } = require("/home/claude/Unbroken/source/tests/node_modules/@napi-rs/canvas");
const fs = require("fs");

// ---- shapes ----
const heart = () => { const P = []; for (let i = 0; i < 2000; i++) { const t = (2 * Math.PI * i) / 2000; P.push([16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)]); } return P.reverse(); };
const circle = () => { const P = []; for (let i = 0; i < 720; i++) { const t = (2 * Math.PI * i) / 720; P.push([Math.cos(t), Math.sin(t)]); } return P; };
const star = (k = 5, d = 0.5) => { const P = []; for (let i = 0; i < 2 * k; i++) { const t = Math.PI / 2 + (Math.PI * i) / k, r = i % 2 ? 1 - d : 1; P.push([r * Math.cos(t), r * Math.sin(t)]); } return P; };
const flower = (k = 5, d = 0.3) => { const P = []; for (let i = 0; i < 1440; i++) { const t = (2 * Math.PI * i) / 1440; const r = 1 - d * (1 - Math.abs(Math.cos((k * t) / 2))); P.push([r * Math.cos(t), r * Math.sin(t)]); } return P; };
const traced = (s, wmm) => { const t = textLoop(s, wmm); const O = UNB.vaseLineLoop(t.xs, t.ys) || UNB.vaseOutline(t.xs, t.ys); const P = []; for (let i = 0; i < O.loop.length; i += 2) P.push([O.loop[i], O.loop[i + 1]]); return P; };

// ---- laps ----
function lapAt(mode, A, B, w, melt, k, R, n) {
  const P = [];
  if (mode === "melt") {
    const r = M.meltLoop(melt, k);
    if (!r.loop) return { P: [], count: 0 };
    // even along its length, from nearest +x
    let L = r.loop; if (M.area(L) < 0) L = L.slice().reverse();
    return { P: resample(L.map(([x, y]) => [x * R, y * R]), n), count: r.count };
  }
  for (let i = 0; i < n; i++) {
    const s = i / n;
    let p;
    if (mode === "even") p = lerp(M.at(A, s), M.at(B, s), k);
    else if (mode === "corners") p = lerp(M.at(A, s), M.at(B, M.warpAt(w, s)), k);
    else if (mode === "fixed") p = lerp(M.at(A, s), M.at(B, M.warpAt(w, s)), k);
    else if (mode === "round") { const C = [Math.cos(2 * Math.PI * s), Math.sin(2 * Math.PI * s)]; p = k < 0.5 ? lerp(M.at(A, s), C, 2 * k) : lerp(C, M.at(B, M.warpAt(w, s)), 2 * k - 1); }
    P.push([p[0] * R, p[1] * R]);
  }
  let Q = resample(P, n);
  if (mode === "fixed") Q = repair(Q, 1.34);
  return { P: Q, count: 1 };
}
let repMs = 0, repN = 0;
function repair(P, d) {
  const t0 = Date.now();
  const re = P.map((p) => p[0]), im = P.map((p) => p[1]);
  let u = UNB.uncross(re, im, true, {});
  const sp = UNB.enforceSpacing(u.re, u.im, d * 0.95, 80, true);
  u = UNB.uncross(sp.re, sp.im, true, {});
  repMs += Date.now() - t0; repN++;
  const out = []; for (let i = 0; i < u.re.length; i++) out.push([u.re[i], u.im[i]]);
  return resample(out, P.length);
}
const lerp = (p, q, k) => [p[0] + k * (q[0] - p[0]), p[1] + k * (q[1] - p[1])];
function resample(P, n) {
  const c = [0]; for (let i = 1; i <= P.length; i++) c.push(c[i - 1] + Math.hypot(P[i % P.length][0] - P[i - 1][0], P[i % P.length][1] - P[i - 1][1]));
  const L = c[P.length], out = []; let j = 0;
  for (let i = 0; i < n; i++) { const s = (i / n) * L; while (j < P.length - 1 && c[j + 1] < s) j++; const a = P[j], b = P[(j + 1) % P.length], f = (s - c[j]) / Math.max(1e-12, c[j + 1] - c[j]); out.push([a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])]); }
  return out;
}

// ---- checks ----
function grid(P, cell) { const G = new Map(); P.forEach((p, i) => { const k = Math.floor(p[0] / cell) + "," + Math.floor(p[1] / cell); (G.get(k) || G.set(k, []).get(k)).push(i); }); return G; }
function near(G, cell, x, y, fn) { const a = Math.floor(x / cell), b = Math.floor(y / cell); for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) for (const i of G.get(a + da + "," + (b + db)) || []) fn(i); }
const side = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function crossings(P) {
  const n = P.length, cell = 1, G = grid(P, cell); let c = 0;
  for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; near(G, cell, a[0], a[1], (j) => { if (Math.abs(j - i) < 2 || Math.abs(j - i) > n - 2 || j < i) return; const p = P[j], q = P[(j + 1) % n]; if (side(a, b, p) * side(a, b, q) < 0 && side(p, q, a) * side(p, q, b) < 0) c++; }); }
  return c;
}
function pinch(P, along) {
  const n = P.length, cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const tot = cum[n - 1] + Math.hypot(P[0][0] - P[n - 1][0], P[0][1] - P[n - 1][1]), cell = 2, G = grid(P, cell); let best = Infinity;
  for (let i = 0; i < n; i++) near(G, cell, P[i][0], P[i][1], (j) => { let al = Math.abs(cum[j] - cum[i]); al = Math.min(al, tot - al); if (al > along) best = Math.min(best, Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1])); });
  return best;
}
function step(P, Q) { // worst distance from a point of P to lap Q (below)
  const cell = 1.5, G = grid(Q, cell); let worst = 0;
  for (const p of P) { let b = Infinity; near(G, cell, p[0], p[1], (j) => { const a = Q[j], c = Q[(j + 1) % Q.length]; const dx = c[0] - a[0], dy = c[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0; b = Math.min(b, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)); }); worst = Math.max(worst, b === Infinity ? 9 : b); }
  return worst;
}

// ---- one case ----
function runCase(name, pa, pb, opt) {
  const R = opt.R || 25, H = opt.H || 30, h = 0.3, d = 1.34, hold = 0.28, n = opt.n || 1600;
  const A = M.table(pa), B = M.table(pb);
  const t0 = Date.now(), w = M.warpCorners(A, B, opt.warp || {}), tW = Date.now() - t0;
  const melt = opt.modes.includes("melt") ? M.makeMelt(A, B) : null;
  const res = {};
  for (const mode of opt.modes) {
    const laps = [], rep = { cross: 0, crossAt: [], pinch: Infinity, pinchAt: -1, step: 0, stepAt: -1, split: 0 };
    const T = Math.floor(H / h);
    for (let k = 0; k <= T; k++) {
      const t = k / T, b = opt.blend ? opt.blend(t) : t;
      const L = lapAt(mode, A, B, w, melt, b, R, n);
      laps.push(L.P);
      if (L.count > 1) rep.split++;
      if (k % 2 === 0 || k === T) {
        const c = crossings(L.P); if (c) { rep.cross++; rep.crossAt.push(+(t * 100).toFixed(0)); }
        // pinch only counts parts that weren't already close in the end shapes (tested against d)
        const p = pinch(L.P, 3 * d); if (p < rep.pinch) { rep.pinch = p; rep.pinchAt = t; }
      }
      if (k) { const s = step(L.P, laps[k - 1]); if (s > rep.step) { rep.step = s; rep.stepAt = t; } }
    }
    res[mode] = { laps, rep };
  }
  render(name, res, opt);
  return { name, warpMs: tW, ...Object.fromEntries(Object.entries(res).map(([m, r]) => [m, { cross: r.rep.cross, crossAt: r.rep.crossAt.slice(0, 4), pinch: +r.rep.pinch.toFixed(2), pinchAt: +r.rep.pinchAt.toFixed(2), step: +r.rep.step.toFixed(2), stepAt: +r.rep.stepAt.toFixed(2), split: r.rep.split }])) };
}

function render(name, res, opt) {
  const modes = Object.keys(res), W = 360, Hc = 760, cv = createCanvas(W * modes.length, Hc), g = cv.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
  modes.forEach((mode, mi) => {
    const { laps, rep } = res[mode], ox = mi * W, R = opt.R || 25, sc = (W * 0.42) / (R * 1.1);
    g.fillStyle = "#222"; g.font = "bold 18px sans-serif"; g.fillText(mode, ox + 12, 24);
    g.font = "13px sans-serif";
    g.fillStyle = rep.cross ? "#c00" : "#070"; g.fillText(`crossing laps: ${rep.cross}${rep.cross ? " (at " + rep.crossAt.slice(0, 3).join(", ") + "%)" : ""}`, ox + 12, 44);
    g.fillStyle = rep.pinch < 1.2 ? "#c60" : "#070"; g.fillText(`closest parts: ${rep.pinch.toFixed(2)} mm at ${(rep.pinchAt * 100).toFixed(0)}%`, ox + 12, 60);
    g.fillStyle = rep.step > 0.28 ? "#c60" : "#070"; g.fillText(`worst step: ${rep.step.toFixed(2)} mm   splits: ${rep.split}`, ox + 12, 76);
    // top view: laps at 0, 25, 50, 75, 100%
    const cx = ox + W / 2, cy = 250;
    [0, 0.25, 0.5, 0.75, 1].forEach((f, q) => {
      const L = laps[Math.round(f * (laps.length - 1))]; if (!L.length) return;
      g.strokeStyle = `hsl(${220 - q * 50}, 70%, ${35 + q * 5}%)`; g.lineWidth = q === 2 ? 2 : 1.2; g.beginPath();
      L.forEach(([x, y], i) => (i ? g.lineTo(cx + x * sc, cy - y * sc) : g.moveTo(cx + x * sc, cy - y * sc))); g.closePath(); g.stroke();
    });
    // oblique 3D: every 3rd lap, from the front and a bit above
    const by = 720, zs = 9, tilt = 0.35;
    for (let k = 0; k < laps.length; k += 3) {
      const L = laps[k], z = k * 0.3; if (!L.length) continue;
      g.strokeStyle = `hsla(${220 - (k / laps.length) * 200}, 60%, 40%, 0.55)`; g.lineWidth = 1; g.beginPath();
      L.forEach(([x, y], i) => { const X = cx + x * sc * 0.9, Y = by - z * zs * 0.9 - y * sc * tilt * 0.9; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); g.stroke();
    }
  });
  fs.writeFileSync(`/home/claude/proto/out/${name}.png`, cv.toBuffer("image/png"));
}

fs.mkdirSync("/home/claude/proto/out", { recursive: true });
const modes = (process.argv[3] || "corners,fixed,melt").split(",");
const cases = process.argv[2] ? process.argv[2].split(",") : ["heart-circle", "heart-star", "star-flower", "heart-N", "circle-NV", "heart-NV"];
const S = { heart, circle, star: () => star(5, 0.5), flower: () => flower(5, 0.3), N: () => traced("N", 40), NV: () => traced("NV", 50) };
for (const c of cases) { const [a, b] = c.split("-"); console.log(JSON.stringify(runCase(c, S[a](), S[b](), { modes, warp: { pen: 0.005, smooth: 20 } })), "repair ms/lap", (repMs / Math.max(1, repN)).toFixed(1)); }

// morph by blending signed distance fields: lap(t) = zero contour of (1-t)·A + t·B. Reports per height how many loops,
// the largest step between layers (mm) and the narrowest part (mm)
const { pat, word, shape, UNB } = require("./big.js");
const { createCanvas } = require("../../../tests/node_modules/@napi-rs/canvas");
const G = 0.25, SPAN = +(process.env.SPAN || 110), N = Math.ceil(SPAN / G);
function mask(O) { // a loop (unit loop × reach) → inside mask, centred
  const cv = createCanvas(N, N), g = cv.getContext("2d"); g.fillStyle = "#000"; g.beginPath();
  for (let i = 0; i < O.loop.length; i += 2) { const x = N / 2 + (O.loop[i] * O.reach) / G, y = N / 2 - (O.loop[i + 1] * O.reach) / G; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.fill("evenodd"); const d = g.getImageData(0, 0, N, N).data, m = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) m[i] = d[i * 4 + 3] > 127; return m;
}
function edt1(f, n) { const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1); let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) { let s; do { const p = v[k]; s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k]) k--; else break; } while (k >= 0); k++; v[k] = q; z[k] = s; z[k + 1] = 1e20; }
  k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; } return d; }
function edt(m, val) { const INF = 1e12, a = new Float64Array(N * N); for (let i = 0; i < N * N; i++) a[i] = m[i] === val ? 0 : INF;
  const col = new Float64Array(N); for (let x = 0; x < N; x++) { for (let y = 0; y < N; y++) col[y] = a[y * N + x]; const r = edt1(col, N); for (let y = 0; y < N; y++) a[y * N + x] = r[y]; }
  for (let y = 0; y < N; y++) { const r = edt1(a.subarray(y * N, y * N + N), N); a.set(r, y * N); } return a; }
function sdf(m) { const out = edt(m, 1), inn = edt(m, 0), s = new Float32Array(N * N); for (let i = 0; i < N * N; i++) s[i] = (m[i] ? -Math.sqrt(inn[i]) + 0.5 : Math.sqrt(out[i]) - 0.5) * G; return s; }
function contours(f) { const lab = new Int32Array(N * N), box = { x0: [1], y0: [1], x1: [N - 2], y1: [N - 2] }; const neg = new Float32Array(N * N); for (let i = 0; i < N * N; i++) neg[i] = -f[i]; return UNB._u.isoContours(neg, lab, 0, 0, N, N, box, 0, 0, G); }
// a bar both share, along the bottom of both (letters join along the baseline anyway): the blend can't come apart
function bar(ma, mb, hmm = 2.2) {
  const bb = (m) => { let y0 = N, y1 = 0, x0 = N, x1 = 0; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m[y * N + x]) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); } return { y0, y1, x0, x1 }; };
  const A = bb(ma), B = bb(mb), yb = Math.min(A.y1, B.y1) - Math.round(1.2 / G), th = Math.round(hmm / G), xa = Math.max(A.x0, B.x0) + 4, xb = Math.min(A.x1, B.x1) - 4;
  for (const m of [ma, mb]) for (let y = yb - th; y <= yb; y++) for (let x = xa; x <= xb; x++) m[y * N + x] = 1;
}
function run(name, A, B, H = 125, h = 0.3, o = {}) {
  const ma = mask(A), mb = mask(B);
  if (o.bar) bar(ma, mb);
  const a = sdf(ma), b = sdf(mb), L = Math.round(H / h), f = new Float32Array(N * N);
  let maxLoops = 0, worst = 0, worstAt = 0, splitAt = [], prev = null, narrow = Infinity;
  const cell = (P) => { const M = new Map(); for (const [x, y] of P) { const k = ((x / 2) | 0) + "," + ((y / 2) | 0); (M.get(k) || M.set(k, []).get(k)).push([x, y]); } return M; };
  for (let l = 0; l <= L; l += 1) {
    const t = l / L, s = t * t * (3 - 2 * t); // (eased: slow at both ends)
    for (let i = 0; i < N * N; i++) f[i] = (1 - s) * a[i] + s * b[i] - (o.puff || 0) * 4 * s * (1 - s);
    // narrowest: deepest inside value small → thin; read min over interior ridge = max of -f is half the widest; skip
    const C = contours(f).filter((P) => P.length > 8), n = C.length; if (n > maxLoops) maxLoops = n; if (n > 1 && splitAt.length < 3) splitAt.push(+(t * H).toFixed(0));
    const P = C.flat();
    if (prev) { const M = cell(prev); let mx = 0; for (let i = 0; i < P.length; i += 4) { const [x, y] = P[i]; let best = 1e9; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const q of M.get((((x / 2) | 0) + dx) + "," + (((y / 2) | 0) + dy)) || []) best = Math.min(best, Math.hypot(q[0] - x, q[1] - y)); if (best < 1e9) mx = Math.max(mx, best); } if (mx > worst) { worst = mx; worstAt = +(t * H).toFixed(0); } }
    prev = P;
  }
  console.log(JSON.stringify({ name, H, maxLoops, splitsAt: splitAt, stepWorst: +worst.toFixed(2), at: worstAt, hold: 0.28 }));
  // spread the layers where the outline changes most: the total change, and the largest jump at a very fine step
  const K = 1200; let tot = 0, jump = 0; prev = null;
  for (let l = 0; l <= K; l++) { const t = l / K; for (let i = 0; i < N * N; i++) f[i] = (1 - t) * a[i] + t * b[i] - (o.puff || 0) * 4 * t * (1 - t);
    const P = contours(f).filter((Q) => Q.length > 8).flat(); if (prev) { const M = cell(prev); let mx = 0; for (let i = 0; i < P.length; i += 4) { const [x, y] = P[i]; let best = 1e9; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const q of M.get((((x / 2) | 0) + dx) + "," + (((y / 2) | 0) + dy)) || []) best = Math.min(best, Math.hypot(q[0] - x, q[1] - y)); if (best < 1e9) mx = Math.max(mx, best); } tot += mx; jump = Math.max(jump, mx); } prev = P; }
  console.log(JSON.stringify({ name, spread: true, needH: Math.round((tot / 0.28) * h), biggestJump: +jump.toFixed(2) }));
}
module.exports = { run };
if (require.main === module) {
  const W = (t, c) => word(t, c);
  const C = {
    lovehope: () => run("LOVE→HOPE", W("LOVE", 25), W("HOPE", 25)),
    lovehopebar: () => run("LOVE→HOPE + bar", W("LOVE", 25), W("HOPE", 25), 125, 0.3, { bar: true }),
    momdadbar: () => run("MOM→DAD + bar", W("MOM", 30), W("DAD", 30), 125, 0.3, { bar: true }),
    circlelove: () => run("circle→LOVE", shape("pebble"), W("LOVE", 25)),
    moorelab: () => run("moore3→labyrinth8", pat("moore", { detail: 3 }), pat("labyrinth", { detail: 8 })),
    moore34: () => run("moore3→moore4", pat("moore", { detail: 3 }), pat("moore", { detail: 4 })),
  };
  const P = +(process.env.PUFF || 0);
  Object.assign(C, {
    lh: () => run(`LOVE→HOPE puff ${P}`, W("LOVE", 25), W("HOPE", 25), 125, 0.3, { puff: P }),
    md: () => run(`MOM→DAD puff ${P}`, W("MOM", 30), W("DAD", 30), 125, 0.3, { puff: P }),
    ml: () => run(`moore3→labyrinth8 puff ${P}`, pat("moore", { detail: 3 }), pat("labyrinth", { detail: 8 }), 125, 0.3, { puff: P }),
    cl: () => run(`pebble→LOVE puff ${P}`, shape("pebble"), W("LOVE", 25), 125, 0.3, { puff: P }),
  });
  C[process.argv[2]]();
}

const S = require("../lib/scenes.js"), { trace, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E17", title: "The line is three real series, x(t), y(t) and z(t)",
  guards: "the X/Y/Z series drifting from what is drawn, exported or printed, or Z changing a flat print",
  why: "The engine writes the line as one real Fourier series per axis: x(t) = x₀ + Σ a_k cos(2πkt + φ_k), the same for y, and z(t) = 0 for a flat print (later the climb of a continuous spiral). The terms are worked out with one complex FFT, so this checks the per-axis form is exact: that the formula shown in The math and saved in the coefficients file is the line that is drawn, and that the G-code reads Z from the line without changing a flat print.",
  how: "Traces the leaf, shapes and smiley samples. Rebuilds each path from all its terms and compares with the path; evaluates x(t) and y(t) term by term from the written formula at 64 points and compares with the line the app draws (same N terms); checks the two offsets come first and the rest are ordered by size. Then writes the leaf's G-code with Z = 0 per point and without any Z, and with a 0–1 mm ramp.",
  pass: "All terms rebuild the path within 1e-6 px; the written formula matches the drawn line within 1e-6 px; offsets first, then strongest first; the flat G-code is byte-identical with and without a Z of 0; the ramp G-code climbs to 1 mm above the print height.",
  async run() {
    const checks = [];
    let leaf = null;
    for (const name of ["leaf", "shapes", "smiley"]) {
      const r = trace(S.sample(name), {}), sp = r.sg.sp, ax = sp.ax, n = ax.S;
      const off = UNB.offsetDoubled(r.walk, 0), z = UNB.resample(off.x, off.y, n), all = UNB.synth(ax, sp.order);
      let e1 = 0; for (let i = 0; i < n; i++) e1 = Math.max(e1, Math.hypot(all.re[i] - z.re[i], all.im[i] - z.im[i]));
      const terms = r.fit.codes.map((c) => UNB.termOf(c, ax)); let e2 = 0;
      for (let q = 0; q < 64; q++) {
        const i = Math.floor(q * n / 64), t = i / n; let x = 0, y = 0;
        for (const m of terms) { const v = m.amp * Math.cos(2 * Math.PI * m.k * t + m.phase); if (m.axis === "x") x += v; else y += v; }
        e2 = Math.max(e2, Math.hypot(x - r.fit.curve.re[i], y - r.fit.curve.im[i]));
      }
      const ord = sp.order.map((c) => UNB.termOf(c, ax)), sorted = ord.slice(2).every((m, i, a) => i === 0 || a[i - 1].amp >= m.amp - 1e-12);
      checks.push(check(`${name}: all terms rebuild the path (px)`, e1, "<=", 1e-6, 9));
      checks.push(check(`${name}: written formula vs drawn line, ${r.N} terms (px)`, e2, "<=", 1e-6, 9));
      checks.push(check(`${name}: offsets first, then strongest first`, +(ord[0].k === 0 && ord[1].k === 0 && sorted), "==", 1));
      if (name === "leaf") leaf = r;
    }
    const x = Float64Array.from(leaf.fin.final.re), y = Float64Array.from(leaf.fin.final.im), N = x.length;
    const g = { ox: 10, oy: 10, z: 0.8, lift: 5, feed: 1200, e: 0.05 };
    const plain = UNB.exportGcode([{ x, y }], g), flat = UNB.exportGcode([{ x, y, z: new Float64Array(N) }], g);
    const ramp = UNB.exportGcode([{ x, y, z: Float64Array.from({ length: N }, (_, i) => i / (N - 1)) }], g);
    const zs = [...ramp.matchAll(/^G1 X[^\n]* Z([\d.]+)/gm)].map((m) => +m[1]);
    checks.push(check("flat print: G-code identical with z = 0", +(plain === flat), "==", 1));
    checks.push(check("ramp: highest Z above print height (mm)", zs.length ? Math.max(...zs) - g.z : 0, ">=", 0.99, 3));
    return { checks };
  },
};

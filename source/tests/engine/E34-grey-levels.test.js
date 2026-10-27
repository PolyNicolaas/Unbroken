const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
// a 300 × 200 picture: five flat greys in bands and a disc, with salt-and-pepper specks
function scene(specks) {
  const w = 300, h = 200, g = new Float32Array(w * h), TONES = [30, 90, 150, 200, 245];
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = TONES[4];
      if (y > 140) v = TONES[3];
      if (Math.hypot(x - 90, y - 90) < 50) v = TONES[0];
      if (Math.hypot(x - 210, y - 90) < 40) v = TONES[1];
      if (x > 190 && x < 230 && y > 150 && y < 190) v = TONES[2];
      if (specks && rnd() < 0.01) v = rnd() < 0.5 ? 0 : 255;
      g[y * w + x] = v;
    }
  return { g, w, h, TONES };
}
const rgbaOf = (g) => { const a = new Uint8ClampedArray(g.length * 4); for (let i = 0; i < g.length; i++) { a[4 * i] = a[4 * i + 1] = a[4 * i + 2] = g[i]; a[4 * i + 3] = 255; } return a; };
module.exports = {
  id: "E34", title: "Grey levels: a picture as a few flat greys, their edges as lines, and the background removed from a tap",
  guards: "levels that miss a grey the picture has, specks that survive Smooth blocks, edges drawn where nothing is traced or missing round a traced block, a tapped background that isn't removed, and patterns made for plotting that break the printing limits or take too long",
  why: "The Image prep card can reduce a picture to 2–6 flat greys (UNB.levels) and trace the edges between the greys you pick (UNB.levelEdges); Tap the background floods the background from the point tapped (UNB.prep's bgAt). Patterns made for plotting go up to each setting's plotMax, printing keeps max.",
  how: "Makes a picture of five flat greys (bands, two discs and a square) with and without 1% specks; finds 5 levels, without and with Smooth blocks; traces the edges of every level, of the darkest only, and of none; preps a picture whose grey background is cut off from the border by a frame, with the border flood and with a tap inside; traces the levels picture through the app's stages. Then makes every pattern at its plotting limit and checks the printing limit still clamps.",
  pass: "The five greys are found within 6 of the truth; with Smooth blocks (2 px) no pixel differs from all four neighbours, without it the specks are still there; the darkest disc's edge is a closed ring as long as its circumference (±15%), and no edges come when no grey is traced; the tap turns the framed background white where the border flood can't; the levels picture traces (one walk, from the edges); every pattern at its plotting limit is under 2.5 million points and made in under 3 s, and without plot the setting is clamped to the printing limit.",
  async run() {
    const checks = [];
    const A = scene(false), L = UNB.levels(A.g, A.w, A.h, { count: 5, smooth: 0 });
    const off = Math.max(...A.TONES.map((t, i) => Math.abs(t - L.tones[i])));
    checks.push(check("5 levels: furthest from the picture's greys", off, "<=", 6));
    const B = scene(true), lone = (lab) => { let n = 0; for (let y = 1; y < B.h - 1; y++) for (let x = 1; x < B.w - 1; x++) { const i = y * B.w + x, v = lab[i]; if (lab[i - 1] !== v && lab[i + 1] !== v && lab[i - B.w] !== v && lab[i + B.w] !== v) n++; } return n; };
    const rough = UNB.levels(B.g, B.w, B.h, { count: 5, smooth: 0 }), smooth = UNB.levels(B.g, B.w, B.h, { count: 5, smooth: 2 });
    checks.push(check("specks without Smooth blocks (lone pixels)", lone(rough.lab), ">", 100), check("… with Smooth blocks (2 px)", lone(smooth.lab), "==", 0));
    const darkOnly = UNB.levelEdges(L.lab, A.w, A.h, [true, false, false, false, false]);
    let n = 0; for (const v of darkOnly) n += v;
    checks.push(check("darkest grey traced: edge pixels ÷ the disc's circumference", n / (2 * Math.PI * 50), ">=", 0.85), check("… (not much more)", n / (2 * Math.PI * 50), "<=", 1.15));
    const none = UNB.levelEdges(L.lab, A.w, A.h, [false, false, false, false, false]);
    checks.push(check("no grey traced: edge pixels", none.reduce((a, b) => a + b, 0), "==", 0));
    // the background: a grey field inside a dark frame, so the border flood stops at the frame
    const w = 120, h = 90, rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const frame = x < 6 || y < 6 || x >= w - 6 || y >= h - 6, dot = Math.hypot(x - 60, y - 45) < 15, v = frame ? 20 : dot ? 60 : 170, i = 4 * (y * w + x);
      rgba[i] = rgba[i + 1] = rgba[i + 2] = v; rgba[i + 3] = 255;
    }
    const border = UNB.prep(rgba, w, h, { bgTol: 20 }), tap = UNB.prep(rgba, w, h, { bgTol: 20, bgAt: [20, 20] });
    checks.push(check("framed background, border flood: still grey (gray at 20, 20)", Math.round(border[20 * w + 20]), "==", 170),
      check("… tapped there: white", Math.round(tap[20 * w + 20]), "==", 255), check("… the dot and the frame kept (gray of the dot)", Math.round(tap[45 * w + 60]), "==", 60));
    // through the stages, as the app runs them
    const P = UNB.stagePrep(rgbaOf(A.g), A.w, A.h, { prep: {}, blur: 1, levels: { count: 5, smooth: 2 } });
    const walk = UNB.stageTrace({ blurred: P.blurred, levels: { lab: P.levels.lab, edge: [true, true, true, true, false] }, mode: "centerline", sens: 0 }, A.w, A.h, { minPix: 10, maxJump: 0, open: false }, { blurred: P.blurred, edges: true });
    checks.push(check("levels traced through the stages: a walk over the edges (points)", walk ? walk.px.length : 0, ">", 1000));
    // made for plotting
    const TW = 120, TH = 160, d = new Float32Array(TW * TH);
    for (let i = 0; i < d.length; i++) d[i] = 0.5 + 0.4 * Math.sin(i / 37);
    let slow = [], clamp = 0, ranges = 0;
    for (const [key, S] of Object.entries(UNB.PATTERNS))
      for (const q of S.params) {
        if (!q.plotMax) continue;
        ranges++;
        const t = Date.now(), r = UNB.pattern(key, { [q.key]: q.plotMax, plot: true, tone: S.tone ? { w: TW, h: TH, d } : undefined }), ms = Date.now() - t;
        const pts = r ? r.paths.reduce((a, p) => a + p.length / 2, 0) : 0;
        if (!r || pts > 2.5e6 || ms > 3000) slow.push(`${key} ${q.key} ${q.plotMax}: ${pts} points, ${ms} ms`);
        if (UNB.patternDefaults(key, { [q.key]: q.plotMax })[q.key] === q.max) clamp++;
      }
    checks.push(check("patterns at their plotting limit that are too big or slow", slow.length, "==", 0), check("… printing still clamps them to its limit", clamp, "==", ranges));
    return { checks, notes: slow.join("  \n") || `${ranges} settings go further for plotting` };
  },
};

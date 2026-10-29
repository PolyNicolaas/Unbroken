const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
// white paper, a red disc and a green disc of the same brightness, and a dark blue square
function scene() {
  const w = 240, h = 160, rgba = new Uint8ClampedArray(w * h * 4), part = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let c = [250, 250, 248], k = 0;
    if (Math.hypot(x - 60, y - 80) < 40) (c = [214, 60, 60]), (k = 1); // luma ≈ 106
    else if (Math.hypot(x - 150, y - 80) < 40) (c = [40, 140, 60]), (k = 2); // luma ≈ 101
    else if (x > 200 && x < 230 && y > 20 && y < 50) (c = [20, 30, 110]), (k = 3);
    rgba.set([c[0], c[1], c[2], 255], 4 * i);
    part[i] = k;
  }
  return { rgba, w, h, part };
}
module.exports = {
  id: "E41", title: "Colour levels: a picture as a few flat colours, telling apart colours of the same brightness",
  guards: "a red and a green of the same brightness merged into one block (as greys they are one), colours out of order, a removed background coloured in, and blocks that don't hold their own pixels",
  why: "Grey levels (v105) merge colours that are equally bright; colour levels (v120, Grey levels card: Colours) find the flat colours in Lab, where colours that look different are far apart (UNB.colourLevels), in the same shape as the grey levels, darkest first, so tracing their edges and filling them work the same, with each block's colour for its pen.",
  how: "Draws white paper with a red and a green disc of about the same brightness and a dark blue square; asks for 4 grey levels and for 4 colour levels; then 3 colour levels with the green disc made paper white by the prep (three colours left) (as a removed background is).",
  pass: "Greys: the red and green discs fall in one level (the reason for colours); colours: every disc and the square in a level of its own, each holding at least 98% of its pixels, the levels darkest first (blue first, paper last), each level's colour within 20 of the colour drawn; with the green disc white in the prep, its pixels go with the paper.",
  async run() {
    const checks = [], S = scene(), N = S.w * S.h, gray = UNB.toGray(S.rgba, S.w, S.h);
    const G = UNB.levels(gray, S.w, S.h, { count: 4, smooth: 0 }), C = UNB.colourLevels(S.rgba, S.w, S.h, gray, { count: 4, smooth: 0 });
    const major = (R, k) => { const n = new Array(4).fill(0); let t = 0; for (let i = 0; i < N; i++) if (S.part[i] === k) { n[R.lab[i]]++; t++; } const m = Math.max(...n); return { level: n.indexOf(m), share: m / t }; };
    const gr = major(G, 1), gg = major(G, 2);
    checks.push(check("greys: the red and the green disc in one level", +(gr.level === gg.level), "==", 1));
    const parts = [0, 1, 2, 3].map((k) => major(C, k)), levels = new Set(parts.map((p) => p.level));
    checks.push(check("colours: paper, red, green and blue each in a level of its own", levels.size, "==", 4), check("… each holding its pixels (worst share)", Math.min(...parts.map((p) => p.share)), ">=", 0.98));
    checks.push(check("… darkest first: blue first, paper last", +(parts[3].level === 0 && parts[0].level === 3), "==", 1));
    const want = { 0: [250, 250, 248], 1: [214, 60, 60], 2: [40, 140, 60], 3: [20, 30, 110] };
    const off = Math.max(...[0, 1, 2, 3].map((k) => Math.max(...C.colours[parts[k].level].map((v, c) => Math.abs(v - want[k][c])))));
    checks.push(check("… each level's colour off the colour drawn by", off, "<=", 20));
    const g2 = Float32Array.from(gray); for (let i = 0; i < N; i++) if (S.part[i] === 2) g2[i] = 255;
    const C2 = UNB.colourLevels(S.rgba, S.w, S.h, g2, { count: 3, smooth: 0 }), p2 = (() => { const n = new Array(3).fill(0); for (let i = 0; i < N; i++) if (S.part[i] === 2) n[C2.lab[i]]++; return n.indexOf(Math.max(...n)); })(), paper = (() => { const n = new Array(3).fill(0); for (let i = 0; i < N; i++) if (S.part[i] === 0) n[C2.lab[i]]++; return n.indexOf(Math.max(...n)); })();
    checks.push(check("a disc made white by the prep goes with the paper", +(p2 === paper), "==", 1));
    return { checks, notes: `colours ${JSON.stringify(C.colours)}` };
  },
};

const { UNB } = require("../lib/trace.js"), FONTS = require("../../engine/fonts.js"), { check } = require("../lib/check.js");
// letters as point sets (each glyph's strokes, densified), by laying out the text one more letter at a time
function letters(text, font, opt) {
  const out = []; let prev = 0;
  for (let i = 1; i <= text.length; i++) {
    const lay = UNB.textLayout(text.slice(0, i), font, opt); if (!lay.strokes.length) continue;
    const pts = []; for (const st of lay.strokes.slice(prev)) for (let j = 0; j + 3 < st.length; j += 2) { const n = Math.max(1, Math.ceil(Math.hypot(st[j + 2] - st[j], st[j + 3] - st[j + 1]) / 0.1)); for (let k = 0; k <= n; k++) pts.push([st[j] + (st[j + 2] - st[j]) * k / n, st[j + 1] + (st[j + 3] - st[j + 1]) * k / n]); }
    if (lay.strokes.length > prev && text[i - 1] !== " ") out.push({ ch: text[i - 1], pts }); prev = lay.strokes.length;
  }
  return out;
}
const minDist = (A, B) => { let b = Infinity; for (const p of A) for (const q of B) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < b) b = d; } return b; };
module.exports = {
  id: "E10", title: "Lettering: height, letters never touching, even spacing",
  guards: "letters printed into each other; uneven or wrong-sized lettering",
  why: "Typed text is printed with a needle-wide line, so neighbouring letters closer than the line width merge into a blob, and uneven gaps look sloppy. Letter height is what the customer asks for (\"15 mm letters\").",
  how: "Lays out \"Happy Birthday\" in every bundled font at 15 mm letter height with the app's gap rule (15% of the height, never under 1.2 × a 1 mm line), measures the height of a capital H, and the closest distance between each pair of neighbouring letters within a word in the fonts with separate letters.",
  pass: "Capital H within 3% of 15 mm in every font; no two neighbouring letters closer than 1.2 mm in any separate-letter font; in those fonts the closest gaps vary by under 35% (coefficient of variation).",
  async run() {
    const checks = [], notes = [];
    for (const [key, font] of Object.entries(FONTS)) {
      const cap = 15, gap = Math.max(0.15 * cap, 1.2), opt = { cap, gap, track: 0, word: Math.max(0.5 * cap, 2), lineGap: 1.7, align: "left", spacing: font.joined ? "font" : "even" };
      const H = UNB.textLayout("H", font, opt); let y0 = Infinity, y1 = -Infinity; for (const st of H.strokes) for (let i = 1; i < st.length; i += 2) { y0 = Math.min(y0, st[i]); y1 = Math.max(y1, st[i]); }
      checks.push(check(`${key}: capital H height (mm)`, y1 - y0, ">=", cap * 0.97, 2), check(`${key}: capital H height (mm)`, y1 - y0, "<=", cap * 1.03, 2));
      if (font.joined) { notes.push(`${key}: joined script, letters connect by design`); continue; }
      const gaps = []; for (const word of ["Happy", "Birthday"]) { const L = letters(word, font, opt); for (let i = 1; i < L.length; i++) gaps.push(minDist(L[i - 1].pts, L[i].pts)); }   // within words
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length, cv = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length) / mean;
      checks.push(check(`${key}: closest neighbouring letters (mm)`, Math.min(...gaps), ">=", 1.2, 2), check(`${key}: gap variation`, cv, "<", 0.35, 2));
      notes.push(`${key}: gaps ${gaps.map((g) => g.toFixed(1)).join(" ")} mm`);
    }
    return { checks, notes: notes.join("  \n") };
  },
};

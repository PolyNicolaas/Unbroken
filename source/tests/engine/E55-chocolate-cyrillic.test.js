const { UNB } = require("../lib/trace.js"), FONTS = require("../../engine/fonts.js"), { check } = require("../lib/check.js");
const RU = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя", UA = "ЄєІіЇїҐґ", BY = "Ўў", PUNCT = ",:;'\"«»";
const rings = (g) => g[1].split("|").map((s) => s.split(" ").map((q) => q.split(",").map(Number)));
const box = (g) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const r of rings(g)) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; };
module.exports = {
  id: "E55", title: "Chocolate font: Cyrillic in choc OS's style (Russian, Ukrainian, Belarusian Ў) and its missing punctuation",
  guards: "Cyrillic lettering in the Chocolate font printing as “?”, or new letters that don't sit with choc OS's own",
  why: "choc OS's lettering is Quicksand Bold, each letter rescaled on its own and printed as its outline; Quicksand has no Cyrillic, so source/tools/chocolate-cyrillic.py draws it in that style. The letters must all be there, be closed outlines like the rest, sit at choc OS's heights (capitals 700 units, small letters 400, descenders to about −145), and the letters Cyrillic shares with Latin must be Chocolate's own.",
  how: "Checks every Russian, Ukrainian and Belarusian letter and the added punctuation are in the font; that every outline is closed; the heights of the capitals, small letters, ascenders and descenders; that А, О, Р, а, о, р are Chocolate's A, O, P, a, o, p; and lays out and rasterizes a Russian sentence.",
  pass: "All 76 letters and 7 marks present; every ring closed (first point = last); capitals without marks or descenders 700 tall (±1), x-height letters 400 (±2), descenders to −120…−170, Ё's and Й's marks above the cap; the shared letters identical; the sentence lays out with no “?” and rasterizes.",
  async run() {
    const checks = [], C = FONTS.chocolate, g = C.glyphs;
    const missing = [...RU + UA + BY + PUNCT].filter((c) => !g[c]);
    checks.push(check("letters and marks missing", missing.length, "==", 0), check("Chocolate says it writes Cyrillic", +/Cyrillic/.test(C.scripts), "==", 1));
    let open = 0; for (const c of RU + UA + BY + PUNCT) if (g[c]) for (const r of rings(g[c])) { const a = r[0], b = r[r.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.5) open++; }
    checks.push(check("outlines not closed", open, "==", 0));
    const capsFlat = [..."БГЖИЛПЧШЪЫЬЭЮЯ"], lcFlat = [..."вгжзийклмнпстчшъыьэюя"], desc = [..."ДЦЩдцщф"];
    const off = (list, f) => list.filter((c) => !f(box(g[c])));
    checks.push(
      check("capitals not 700 tall", off(capsFlat, (b) => Math.abs(b.y1 - 700) <= 1 && Math.abs(b.y0) <= 1).length, "==", 0),
      check("small letters not 400 tall", off(lcFlat.filter((c) => c !== "й"), (b) => Math.abs(b.y1 - 400) <= 2 && Math.abs(b.y0) <= 2).length, "==", 0),
      check("descenders out of −170…−120", off(desc, (b) => b.y0 <= -120 && b.y0 >= -170).length, "==", 0),
      check("Ё's dots and Й's breve above the cap", +(box(g["Ё"]).y1 > 730 && box(g["Й"]).y1 > 730), "==", 1),
    );
    const same = [["А", "A"], ["О", "O"], ["Р", "P"], ["а", "a"], ["о", "o"], ["р", "p"]].filter(([cy, la]) => JSON.stringify(g[cy]) === JSON.stringify(g[la])).length;
    checks.push(check("shared letters identical to Chocolate's Latin", same, "==", 6));
    const text = "Ты и красавица, и Зверева,\nно станешь ли ты моей девушкой?";
    const qs = [...text].filter((c) => c.trim() && !g[c]).length, lay = UNB.textLayout(text, C, { cap: 20, gap: 0, word: 6 }), R = UNB.rasterText(lay, 6, 3);
    let ink = 0; for (const v of R.mask) ink += v;
    checks.push(check("letters the sentence lacks", qs, "==", 0), check("sentence strokes", lay.strokes.length, ">", 50), check("sentence rasterized (ink px)", ink, ">", 1000));
    return { checks, notes: [`${Object.keys(g).length} glyphs in Chocolate`] };
  },
};

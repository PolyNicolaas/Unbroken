const T = require("../lib/trace.js"),
  { check } = require("../lib/check.js"),
  UNB = T.UNB,
  FONTS = require("../../engine/fonts.js");
module.exports = {
  id: "E70",
  title: "Big morphs (M1): words of up to 4 letters, 5 over two touching lines, solid letters, the morph's patterns",
  guards:
    "engine/20-morph.js: UNB.morphLetter making a word or two lines as one outline (and refusing too many letters), Solid letters filling every counter, UNB.MORPH_PATTERNS and UNB.morphPattern (closed loops, a minimum width for the channels), and the check passing what the 125 mm trials passed",
  why: "Nicolaas (27 November 2026): the morph on bigger prints, 125 mm tall, pattern to pattern and full words; M1 is the target, with a limited set that works; a word over two lines, the lines touching.",
  how: "Makes LOVE, HAP/PY (solid), MOM (solid) and the five patterns; checks that HAPPY on one line and 6 letters over two are refused; runs the morph check for Moore 3 → Moore 4 and MOM → HAP/PY (solid) at 125 mm.",
  pass: "Every word and pattern is one closed outline; too many letters give null; solid letters have no slits; Moore 3 → Moore 4 and MOM → HAP/PY print at 125 mm.",
  slow: true,
  async run() {
    const F = FONTS.chocolate,
      notes = [];
    const words = { LOVE: { cap: 25 }, "HAP\nPY": { cap: 22, solid: true }, MOM: { cap: 30, solid: true }, "LO\nVE": { cap: 22 } },
      made = {};
    let bad = 0;
    for (const [t, o] of Object.entries(words)) {
      const L = UNB.morphLetter(t, F, o);
      made[t] = L;
      if (!L || L.loops !== 1) bad++;
      notes.push(`${JSON.stringify(t)}: ${L ? `${L.loops} outline, ${L.slits} slits, ${L.filled} filled` : "none"}`);
    }
    const refused = ["HAPPY", "CHE\nERS", "A\nB\nC", ""].filter((t) => UNB.morphLetter(t, F, {}) === null).length;
    let patBad = 0;
    for (const k of Object.keys(UNB.MORPH_PATTERNS)) {
      const P = UNB.morphPattern(k),
        O = P && UNB.vaseLineLoop(P.x, P.y);
      if (!O || !(P.minW >= 40)) patBad++;
      notes.push(`${k}: ${P ? `${P.x.length} points, at least ${P.minW} mm across` : "none"}`);
    }
    const OPT = { h: 0.3, w: 0.84, d: 1.34, overhang: 0.28, budget: 240000 },
      loopOf = (S) => UNB.vaseLineLoop(S.x, S.y),
      morph = (lo, hi, H) =>
        Object.assign(UNB.vaseDefaults(), {
          height: H,
          profile: [
            [0, lo.reach],
            [1, hi.reach],
          ],
          move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 },
          texture: { kind: "none" },
          plan: { kind: "drawing", loop: lo.loop, exact: true, round: 0 },
          planTop: { kind: "drawing", loop: hi.loop, exact: true, round: 0, match: "corners", keepApart: true, turn: 0 },
        }),
      run = (V) => {
        const it = UNB.morphCheck(V, OPT);
        let r;
        while (!(r = it.next()).done);
        return r.value;
      };
    const sc = (S, k) => ({ x: S.x.map((v) => v * k), y: S.y.map((v) => v * k) });
    const mm = run(morph(loopOf(sc(UNB.morphPattern("moore3"), 2)), loopOf(sc(UNB.morphPattern("moore4"), 2)), 125));
    const word = run(morph(loopOf(made.MOM), loopOf(made["HAP\nPY"]), 125));
    notes.push(`Moore 3 → Moore 4, 80 mm, 125 mm tall: ${mm.ok ? "prints" : `about ${mm.needH} mm`}`);
    notes.push(`MOM → HAP/PY solid, 125 mm tall: ${word.ok ? `prints, turned ${word.turn}°` : `about ${word.needH} mm`}`);
    return {
      checks: [
        check("words and two-line words not one outline", bad, "==", 0),
        check("solid letters: slits in MOM and HAP/PY", made.MOM.slits + made["HAP\nPY"].slits, "==", 0),
        check("too many letters (or lines, or none) refused, of 4", refused, "==", 4),
        check("patterns not a closed outline with a width", patBad, "==", 0),
        check("Moore 3 → Moore 4 at 125 mm prints", +mm.ok, "==", 1),
        check("MOM → HAP/PY (solid) at 125 mm prints", +word.ok, "==", 1),
      ],
      notes,
    };
  },
};

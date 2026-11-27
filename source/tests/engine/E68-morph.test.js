const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
const FONTS = require("../../engine/fonts.js");
// a vase from shape `plan` at the bottom to letter ch at the rim: 20 mm tall, the bottom 0.9 of the letter's reach
function morph(ch, plan, extra) {
  const L = UNB.morphLetter(ch, FONTS.chocolate, { cap: 20, d: 1.34 }),
    O = UNB.vaseLineLoop(L.x, L.y);
  return Object.assign(UNB.vaseDefaults(), {
    height: 20,
    profile: [[0, 0.9 * O.reach], [0.5, 0.95 * O.reach], [1, O.reach]],
    move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 },
    texture: { kind: "none" },
    plan,
    planTop: Object.assign({ kind: "drawing", loop: O.loop, round: 0, match: "corners", keepApart: true, turn: 0 }, extra),
  });
}
const run = (g) => { let r; while (!(r = g.next()).done); return r.value; };
const OPT = { h: 0.3, w: 0.84, d: 1.34, overhang: 0.28 };
const SHAPES = { circle: { kind: "circle" }, square: { kind: "polygon", sides: 4, round: 0.25 }, star: { kind: "star", sides: 5, depth: 0.4, round: 0.2 }, flower: { kind: "flower", sides: 5, depth: 0.3 } };
module.exports = {
  id: "E68",
  title: "Morphs: one letter as one outline, paired corner to corner, each lap kept apart, and the check that finds a turn",
  guards: "UNB.morphLetter (20-morph.js) giving more than one outline or none for a capital, ! or ?; the corner pairing or keeping laps apart going back to letting a morph cross itself; UNB.morphCheck not finding a turn, not flagging a morph too short to print, or its height suggestion; a vase without the morph's settings changing",
  why: "Nicolaas (26–27 November 2026): a vase whose shape from above changes into a letter, one character from the Chocolate lettering, checked for which turn prints and how tall it needs to be (docs/MORPH-PLAN.md). The trials found every capital, ! and ? printing out of a circle, square, star, flower and heart on a 20 mm morph, with a turn for a few.",
  how: "Makes every character of UNB.MORPH_CHARS at 20 mm and counts its outlines. Morphs a circle, square, star and flower into A, G, E, N and ? through UNB.morphCheck (each laps' step, inward step and closest parts). Morphs a star into a G with even pairing and no keeping apart, and with corners and kept apart, and compares the closest parts. Makes a 6 mm tall morph and reads the check's verdict and its height. Compares a star-to-circle vase with and without the morph's settings removed.",
  pass: "Every character is exactly one closed outline; all 20 morphs print (some turned); corners and kept apart keep the closest parts at least 0.9 spacings where even pairing doesn't; the 6 mm morph doesn't print and the check asks for more than 6 mm; a vase without match and keepApart is the same lap for lap whether or not this part is loaded (here: the same as before the morph existed).",
  run() {
    const notes = [];
    // every character, one outline
    const loops = [...UNB.MORPH_CHARS].map((c) => { const L = UNB.morphLetter(c, FONTS.chocolate, { cap: 20, d: 1.34 }); return L ? L.loops : 0; });
    const bad = [...UNB.MORPH_CHARS].filter((c, i) => loops[i] !== 1);
    // morphs that print, with the check's turn
    let prints = 0, total = 0;
    const turns = [];
    for (const ch of ["A", "G", "E", "N", "?"])
      for (const [k, P] of Object.entries(SHAPES)) {
        const r = run(UNB.morphCheck(morph(ch, P), OPT));
        total++;
        if (r.ok) prints++;
        if (r.ok && r.turn) turns.push(`${ch}/${k} ${r.turn}°`);
      }
    notes.push(`turned to print: ${turns.join(", ") || "none"}`);
    // corners and kept apart, against even pairing with nothing kept apart
    const stack = (V) => run(UNB.vaseStack(V, Object.assign({ base: 0 }, OPT)));
    const raw = stack(morph("G", SHAPES.star, { match: "even", keepApart: false })),
      kept = stack(morph("G", SHAPES.star, { turn: 45 }));
    const closestRaw = Math.min(...raw.walls.filter((_, i) => i % 2).map((L) => UNB.closestGap(L.x, L.y, 1.34, true)));
    notes.push(`G from a star: closest parts ${closestRaw.toFixed(2)} mm paired evenly, ${kept.morph.closest.toFixed(2)} mm by corners and kept apart`);
    // too short
    const short = run(UNB.morphCheck(Object.assign(morph("G", SHAPES.circle), { height: 6 }), OPT));
    notes.push(`6 mm: ${short.ok ? "prints" : `too short, about ${short.needH} mm would`}`);
    // a vase without the morph's settings: as before (no pairing, nothing moved)
    const plain = Object.assign(UNB.vaseDefaults(), { height: 10, move: { kind: "none", size: 0, count: 1, shift: 0, flip: 0 }, plan: SHAPES.star, planTop: { kind: "circle" } });
    const A = stack(plain), pair = UNB.morphPair, keep = UNB.morphKeepApart;
    UNB.morphPair = UNB.morphKeepApart = undefined;
    const B = stack(plain);
    UNB.morphPair = pair;
    UNB.morphKeepApart = keep;
    let diff = 0;
    A.walls.forEach((L, k) => { for (let i = 0; i < L.x.length; i++) diff = Math.max(diff, Math.hypot(L.x[i] - B.walls[k].x[i], L.y[i] - B.walls[k].y[i])); });
    return {
      checks: [
        check("characters that aren't exactly one outline", bad.length, "==", 0),
        check("letter morphs that print (of 20)", prints, "==", total),
        check("G from a star: closest parts paired evenly, nothing kept apart (mm, under the spacing)", +closestRaw.toFixed(2), "<", 1.2),
        check("… by corners and kept apart, turned 45° (mm)", +kept.morph.closest.toFixed(2), ">=", 0.9 * 1.34),
        check("6 mm tall: doesn't print", +short.ok, "==", 0),
        check("… the check's height (mm)", short.needH, ">", 6),
        check("a vase without the morph's settings: the same with or without this part (mm)", +diff.toFixed(4), "<=", 1e-6),
      ],
      notes,
    };
  },
};

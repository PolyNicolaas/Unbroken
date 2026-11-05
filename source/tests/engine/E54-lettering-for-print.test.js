const { UNB } = require("../lib/trace.js"), FONTS = require("../../engine/fonts.js"), { check } = require("../lib/check.js");
// how many separate pieces a layout's strokes make (strokes touching within `tol` mm are one piece)
function pieces(lay, tol = 0.05) {
  const S = lay.strokes.map((st) => { const p = []; for (let i = 0; i < st.length; i += 2) p.push([st[i], st[i + 1]]); return p; });
  const segD = (q, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy, t = L ? Math.max(0, Math.min(1, ((q[0] - a[0]) * vx + (q[1] - a[1]) * vy) / L)) : 0; return Math.hypot(q[0] - a[0] - t * vx, q[1] - a[1] - t * vy); };
  const touch = (A, B) => A.some((q) => B.some((b, k) => segD(q, b, B[k + 1] || b) < tol)) || B.some((q) => A.some((a, k) => segD(q, a, A[k + 1] || a) < tol));
  const par = S.map((_, i) => i), f = (i) => (par[i] === i ? i : (par[i] = f(par[i])));
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) if (f(i) !== f(j) && touch(S[i], S[j])) par[f(i)] = f(j);
  return new Set(S.map((_, i) => f(i))).size;
}
module.exports = {
  id: "E54", title: "Lettering for a printer: letters joined along the baseline, near-misses closed, i and j dots, the measured smallest height",
  guards: "lettering full of connectors, stroke ends that blob into their letter, dots that run into their stems, letters printed too small to read",
  why: "In chocolate every separate piece of a text needs a connector, and every free stroke end a turn. Joining a word's letters along the baseline makes each word one piece, like handwriting; a stroke end that nearly touches its letter (the font meant it to) prints into it anyway, so closing it saves a turn; an i's dot is a piece of its own. The smallest readable height is measured from the typed letters: the size where none of their holes fills in and no dot runs into its stem. None of this may change a letter: an opening the font leaves (э's) stays open.",
  how: "Lays out words in Sans, Pebble and Bad Script with each option, counts pieces and joins, checks the joins sit on the baseline, finds the near-misses Bad Script's letters close and that э stays open, drops i and j dots but keeps ü's, and measures the smallest height for an o, an e and a dotted i.",
  pass: "Joined, each word is one piece (Sans \"Choco love\": 2, Pebble \"Шоколад ёж\": 2 plus ё's dots) and every join's ends sit in the lowest third of the letters (within 30% of the letter height of the baseline); joining off, more pieces. Bad Script \"dhkqrvxy\" closes near-misses at 12 mm, э closes none at any size; \"jüi\" without i and j dots keeps 2 of its 4 dots (ü's). The measured height: an o is at least 4 stroke widths and at most 8; an i with its dot needs more than without; the measured heights are cached; every font's every basic letter measures in under 45 stroke widths.",
  async run() {
    const checks = [], notes = [];
    const base = { cap: 15, gap: 2.25, word: 7.5 };
    // joins
    for (const [font, text, words, extra] of [["sans", "Choco love", 2, 0], ["pebble", "Шоколад ёж", 2, 2]]) {
      const F = FONTS[font], off = UNB.textLayout(text, F, base), on = UNB.textLayout(text, F, { ...base, join: true });
      const pOn = pieces(on), pOff = pieces(off);
      checks.push(check(`${font} "${text}": pieces, joined`, pOn, "==", words + extra), check(`${font}: pieces without joining`, pOff, ">", pOn), check(`${font}: joins`, on.joins, "==", text.replace(/ /g, "").length - words));
      // the joins are the strokes the off layout doesn't have; each end near its line's baseline
      const bl = on.baselines[0].y, joins = on.joinIdx.map((i) => on.strokes[i]);
      const worst = Math.max(...joins.map((st) => Math.max(Math.abs(st[1] - bl), Math.abs(st[3] - bl))));
      checks.push(check(`${font}: join ends from the baseline (× letter height)`, worst / base.cap, "<=", 0.3, 3));
      notes.push(`${font} "${text}": ${pOff} pieces → ${pOn} joined`);
    }
    // a j joins too (Sans's j stem has no point near the baseline: the join finds where it crosses the band)
    checks.push(check("Sans \"enjoy\": joins", UNB.textLayout("enjoy", FONTS.sans, { ...base, join: true }).joins, "==", 4));
    // near-misses
    const BS = FONTS.badscript;
    const snapped = [..."dhkqrvxy"].filter((c) => UNB.textLayout(c, BS, { cap: 12, snap: 1.68 }).snaps > 0).length;
    checks.push(check("Bad Script dhkqrvxy: letters with a near-miss closed at 12 mm", snapped, ">=", 6));
    for (const cap of [6, 12, 30]) checks.push(check(`Bad Script э at ${cap} mm: near-misses closed (its opening stays)`, UNB.textLayout("э", BS, { cap, snap: cap }).snaps, "==", 0));
    // dots
    const P = FONTS.pebble, dKeep = UNB.textLayout("jüi", P, base), dNone = UNB.textLayout("jüi", P, { ...base, dots: "none" });
    checks.push(check("Pebble jüi: strokes dropped without i and j dots", dKeep.strokes.length - dNone.strokes.length, "==", 2), check("Pebble jüi: dots left out", dNone.dots, "==", 2));
    // measured smallest height (in stroke-plus-gap widths; the app turns it into mm)
    const S = FONTS.sans, o = UNB.glyphShapeMin(S, "o"), iDot = UNB.glyphShapeMin(S, "i", "keep"), iNo = UNB.glyphShapeMin(S, "i", "none");
    checks.push(check("Sans o: measured smallest (× thick)", o, "<=", 8, 2), check("Sans i with its dot needs more than without", +(iDot > iNo), "==", 1));
    const t0 = Date.now(); UNB.glyphShapeMin(S, "o"); checks.push(check("cached: a second measure (ms)", Date.now() - t0, "<", 5));
    let worst = [0, ""];
    for (const [k, F] of Object.entries(FONTS)) {
      if (F.hairline) continue;
      for (const c of "abcdefghijklmnopqrstuvwxyz") if (F.glyphs[c]) { const r = UNB.glyphShapeMin(F, c, "none"); if (r > worst[0]) worst = [r, `${k} ${c}`]; }
    }
    checks.push(check(`every font's letters measure (worst: ${worst[1]}, × thick)`, worst[0], "<", 30, 1));
    notes.push(`Sans o ${o.toFixed(1)}, i ${iDot.toFixed(1)} with its dot, ${iNo.toFixed(1)} without (× stroke + gap)`);
    return { checks, notes };
  },
};

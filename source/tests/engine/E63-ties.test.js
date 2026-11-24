const { trace, workingImage, UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js"), { createCanvas } = require("@napi-rs/canvas");
// a row of blocks a few mm apart and a ring (an O, its hole closed off), traced as outlines at 120 mm with an 18G
// needle: the trace joins them with as few connectors as it can, and ties add more across the gaps
function drawing() {
  const c = createCanvas(1200, 500), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 1200, 500); g.fillStyle = "#000";
  // three blocks 40 px (4 mm) apart, a long bar 40 px under them, and a ring
  g.fillRect(60, 60, 220, 260); g.fillRect(320, 60, 220, 260); g.fillRect(580, 60, 220, 260);
  g.fillRect(60, 360, 740, 80);
  g.beginPath(); g.arc(990, 250, 170, 0, 2 * Math.PI); g.arc(990, 250, 90, 0, 2 * Math.PI, true); g.fill();
  // a U on its own under the ring: its notch 40 px wide, 200 deep (a part's own opening, like a W's V)
  return c;
}
// a U (its notch 40 px wide, 240 deep: a part's own opening, like a W's V) and a block 40 px beside it
function uAndBlock() {
  const c = createCanvas(600, 400), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 600, 400); g.fillStyle = "#000";
  g.fillRect(60, 60, 80, 280); g.fillRect(180, 60, 80, 280); g.fillRect(60, 300, 200, 40); g.fillRect(300, 60, 220, 280);
  return c;
}
// segments of a closed line that cross each other (not next to each other)
function crossings(re, im) {
  const n = re.length, cr = (ax, ay, bx, by) => ax * by - ay * bx;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const a = i, b = (i + 1) % n;
    for (let j = i + 2; j < n; j++) {
      const c = j, d = (j + 1) % n;
      if (d === a) continue;
      const d1 = cr(re[b] - re[a], im[b] - im[a], re[c] - re[a], im[c] - im[a]), d2 = cr(re[b] - re[a], im[b] - im[a], re[d] - re[a], im[d] - im[a]);
      const d3 = cr(re[d] - re[c], im[d] - im[c], re[a] - re[c], im[a] - im[c]), d4 = cr(re[d] - re[c], im[d] - im[c], re[b] - re[c], im[b] - im[c]);
      if (d1 * d2 < 0 && d3 * d4 < 0) k++;
    }
  }
  return k;
}
const lengthOf = (re, im) => { let s = 0; for (let i = 0; i < re.length; i++) { const j = (i + 1) % re.length; s += Math.hypot(re[j] - re[i], im[j] - im[i]); } return s; };
module.exports = {
  id: "E63", title: "Ties: more connectors across the gaps between a drawing's parts, still one line",
  guards: "ties that cross the line or each other, cut across a letter's closed bowl, reach further than asked, bunch up, or break the line into pieces",
  why: "Nicolaas (24 November 2026), after a large logo (Gateway City Big Band, 150 × 210 mm, Outline): its letters, rows and arch were held together only by the trace's few single-strand connectors, which won't hold a tall print. A base was one answer; he chose connectors with no base: short struts across the gaps between parts, the full height of the walls, and asked for them in the app (Ties, in Layers).",
  how: "Draws three blocks 4 mm apart, a bar 4 mm under them and a ring with its hole, traces the outlines at 120 mm (0.84 mm line, 1.34 mm spacing), and adds ties with UNB.ties, the ink from the working image. Then again with the longest tie 3 mm (shorter than every gap). Then a U with a block beside it (60 mm), with and without withinParts, and its notch tie added by a tap (addAt); the first tie taken away (leaveOut); and standing up (stand).",
  pass: "At least 4 ties; none longer than 7 mm; every tie's middle is in the open background outside the ink (none across the ring's hole); no two ties' ends closer than 10 mm; the line with ties doesn't cross itself where the traced line didn't; it is longer by the length the ties report (within 2%), and by 0.75–1.25 × twice the ties' lengths (out and back); with the longest tie 3 mm, no ties and the line as it was; the U gets a tie to the block but none across its own notch, unless withinParts (then at least one); the notch tie is listed as left out, and a tap there adds it (marked tapped); a tie taken away leaves one fewer, none within 10 mm, and is listed as taken away; standing up has at least as many ties up and down. Nicolaas took away ties that closed a letter's own notch on the Gateway logo (W, Y, E, G).",
  run() {
    const c = drawing(), t = trace(c, { mode: "edges", spacingMM: 1.34, lineMM: 0.84, outW: 120, minLen: 0 });
    const { w, h, gray } = workingImage(c, 500), ink = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) ink[i] = gray[i] < 128 ? 1 : 0;
    const re = t.fin.final.re, im = t.fin.final.im, k = t.scale;
    const o = { ink, w, h, mmPerPx: k, closed: !t.open, maxMM: 7, everyMM: 10, spacingMM: 1.34, lineMM: 0.84 };
    const T = UNB.ties(re, im, o), none = UNB.ties(re, im, { ...o, maxMM: 3 });
    // the ring's hole, in working pixels (the drawing is scaled into the working image)
    const s = w / 1200, inHole = ([x0, y0, x1, y1]) => Math.hypot((x0 + x1) / 2 - 990 * s, (y0 + y1) / 2 - 250 * s) < 90 * s;
    const lens = T.ties.map(([x0, y0, x1, y1]) => Math.hypot(x1 - x0, y1 - y0) * k);
    const mids = T.ties.map(([x0, y0, x1, y1]) => ink[Math.round((y0 + y1) / 2) * w + Math.round((x0 + x1) / 2)]);
    let close = 0;
    const ends = T.ties.flatMap(([x0, y0, x1, y1]) => [[x0, y0], [x1, y1]]);
    for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) if ((i >> 1) !== (j >> 1) && Math.hypot(ends[i][0] - ends[j][0], ends[i][1] - ends[j][1]) * k < 10 - 1e-6) close++;
    const before = crossings(re, im), after = crossings(T.re, T.im);
    // the U: no tie across its own notch unless asked (withinParts)
    const cu = uAndBlock(), tu = trace(cu, { mode: "edges", spacingMM: 1.34, lineMM: 0.84, outW: 60, minLen: 0 });
    const wu = workingImage(cu, 500), inkU = new Uint8Array(wu.w * wu.h);
    for (let i = 0; i < inkU.length; i++) inkU[i] = wu.gray[i] < 128 ? 1 : 0;
    const ou = { ink: inkU, w: wu.w, h: wu.h, mmPerPx: tu.scale, closed: !tu.open, maxMM: 7, everyMM: 10, spacingMM: 1.34, lineMM: 0.84 };
    const su = wu.w / 600, inNotch = ([x0, y0, x1, y1]) => { const x = (x0 + x1) / 2 / su, y = (y0 + y1) / 2 / su; return x > 140 && x < 180 && y > 60 && y < 300; };
    const U0 = UNB.ties(tu.fin.final.re, tu.fin.final.im, ou), U1 = UNB.ties(tu.fin.final.re, tu.fin.final.im, { ...ou, withinParts: true });
    // taps: the U's notch tie (left out by the rules, shown as such) added; the first tie taken away (shown, none in its place)
    const notch = U0.skipped.find((k_) => k_.why === "inside a letter"), mid = (q) => [(q[0] + q[2]) / 2, (q[1] + q[3]) / 2];
    const U2 = notch ? UNB.ties(tu.fin.final.re, tu.fin.final.im, { ...ou, addAt: [mid(notch.t)] }) : null;
    const T3 = UNB.ties(re, im, { ...o, leaveOut: [mid(T.ties[0])] });
    const gone = T3.ties.filter((q) => Math.hypot(mid(q)[0] - mid(T.ties[0])[0], mid(q)[1] - mid(T.ties[0])[1]) * k < 10).length;
    // standing up: ties up and down first
    const S = UNB.ties(re, im, { ...o, stand: true }), upDown = (L) => L.filter(([x0, y0, x1, y1]) => Math.abs(y1 - y0) > Math.abs(x1 - x0)).length;
    const grew = (lengthOf(T.re, T.im) - lengthOf(re, im)) * k;
    return { checks: [
      check("ties added", T.count, ">=", 4),
      check("the longest tie (mm)", Math.max(0, ...lens), "<=", 7),
      check("ties whose middle is on ink", mids.filter(Boolean).length, "==", 0),
      check("ties across the ring's hole", T.ties.filter(inHole).length, "==", 0),
      check("tie ends closer than 10 mm", close, "==", 0),
      check("crossings added", after - before, "<=", 0),
      check("line added ÷ what the ties report, off by", Math.abs((T.addedMM > 0 ? grew / T.addedMM : 0) - 1), "<=", 0.02),
      check("line added ÷ twice the ties' lengths (out and back)", T.addedMM / (2 * lens.reduce((a, b) => a + b, 0)), "<=", 1.25),
      check("line added ÷ twice the ties' lengths, at least", T.addedMM / (2 * lens.reduce((a, b) => a + b, 0)), ">=", 0.75),
      check("longest tie 3 mm: ties", none.count, "==", 0),
      check("the U: ties across its own notch", U0.ties.filter(inNotch).length, "==", 0),
      check("the U: ties to the block beside it", U0.count, ">=", 1),
      check("the U, inside a letter too: ties across its notch", U1.ties.filter(inNotch).length, ">=", 1),
      check("the U: its notch tie shown as left out (inside a letter)", +!!notch, "==", 1),
      check("the U: that tie added by a tap: across the notch", U2 ? U2.ties.filter(inNotch).length : 0, "==", 1),
      check("the U: the tapped tie marked", U2 ? U2.tapped.filter(Boolean).length : 0, "==", 1),
      check("a tie taken away: one fewer", T.count - T3.count, "==", 1),
      check("a tie taken away: none within 10 mm of it", gone, "==", 0),
      check("a tie taken away: shown as taken away", T3.skipped.filter((k_) => k_.why === "taken away").length, "==", 1),
      check("standing up: ties up and down, at least as many", upDown(S.ties), ">=", upDown(T.ties)),
      check("longest tie 3 mm: the line as it was (points)", none.re.length, "==", re.length),
    ], notes: [`${T.count} ties, ${lens.map((l) => l.toFixed(1)).join(", ")} mm; +${T.addedMM.toFixed(0)} mm of line (${grew.toFixed(0)} measured); crossings ${before} → ${after}`] };
  },
};

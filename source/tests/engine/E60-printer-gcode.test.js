const { UNB } = require("../lib/trace.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "E60", title: "A printer's own G-code lines: at each layer, and before and after each copy",
  guards: "a printer that needs a line at each layer (a fan, a display, a pause) or around each copy getting no way to say so, and placeholders left unfilled in the file",
  why: "Every printer keeps its own G-code in its settings.js entry, so another printer can be added without touching the code. Besides the start and end lines, some need lines at other moments: at the start of each layer, or before and after each copy on the plate. These are optional and empty for the choc mate 2.",
  how: "Writes G-code for two copies of a 20 mm square, 3 layers each, with layerGcode, copyStartGcode and copyEndGcode set, using the placeholders {layer}, {layers}, {z}, {copy}, {copies} and {needle}. Then writes it again with none of them set.",
  pass: "Each copy has its copy-start line once, after the unretract and before its first layer, and its copy-end line once, after its last move; each layer's line follows that layer's own comment with the right number, count and height; {needle} is filled in; no placeholder is left; and without the hooks the file has none of these lines and is otherwise the same moves.",
  async run() {
    const checks = [], h = 0.3, lap = [[0, 0], [20, 0], [20, 20], [0, 20]], x = [], y = [], z = [], laps = [];
    for (let k = 0; k < 3; k++) { laps.push({ from: x.length, kind: "wall" }); for (let j = 0; j < 4; j++) for (let s = 0; s < 5; s++) {
      const a = lap[j], b = lap[(j + 1) % 4], t = s / 5; x.push(a[0] + (b[0] - a[0]) * t); y.push(a[1] + (b[1] - a[1]) * t); z.push(h * k); } }
    const copy = (dx) => ({ x: Float64Array.from(x, (v) => v + dx), y: Float64Array.from(y), z: Float64Array.from(z), laps });
    const base = { ox: 0, oy: 0, z: 0.3, lift: 5, feed: 1200, e: 0.0005, needle: 0.6, start: ["G28"], end: ["M84"], retract: 0.3, retractSpeed: 0.2, wipeTime: 0, travelSpeed: 120 };
    const hooks = { layer: ["M117 Layer {layer} of {layers} at {z}"], copyStart: ["M117 Copy {copy} of {copies}, {needle} mm"], copyEnd: ["M400 ; copy {copy} done"] };
    const G = UNB.exportGcode([copy(10), copy(50)], { ...base, ...hooks }).trim().split("\n");
    const plain = UNB.exportGcode([copy(10), copy(50)], base).trim().split("\n");
    for (const k of [1, 2]) {
      const at = G.indexOf(`M117 Copy ${k} of 2, 0.6 mm`), first = G.findIndex((l, i) => i > G.findIndex((m) => m.startsWith(`; copy ${k} of`)) && /^; layer 1 of/.test(l));
      const unr = G.findIndex((l, i) => i > G.findIndex((m) => m.startsWith(`; copy ${k} of`)) && / ; unretract$/.test(l));
      checks.push(check(`copy ${k}: its copy-start line once, after the unretract and before layer 1`, +(G.filter((l) => l.startsWith(`M117 Copy ${k} `)).length === 1 && at > unr && at < first), "==", 1));
      const end = G.indexOf(`M400 ; copy ${k} done`), next = k === 1 ? G.findIndex((l) => l.startsWith("; copy 2 of")) : G.indexOf("; printer end");
      checks.push(check(`copy ${k}: its copy-end line once, after its moves and before the next copy`, +(end > first && end < next && G.filter((l) => l === `M400 ; copy ${k} done`).length === 1), "==", 1));
    }
    let good = 0;
    G.forEach((l, i) => { const m = l.match(/^; layer (\d) of 3/); if (m && G[i + 1] === `M117 Layer ${m[1]} of 3 at ${+(0.3 + h * (m[1] - 1)).toFixed(3)}`) good++; });
    checks.push(check("layer lines straight after each layer's comment, with its number, count and height (6 layers in all)", good, "==", 6),
      check("placeholders left unfilled", G.filter((l) => /\{(layer|layers|z|copy|copies|needle)\}/.test(l)).length, "==", 0));
    const moves = (L) => L.filter((l) => /^G[01] /.test(l)).join("\n");
    checks.push(check("without the hooks: none of their lines", plain.filter((l) => /^M117|copy \d done/.test(l)).length, "==", 0),
      check("without the hooks: the same moves", +(moves(plain) === moves(G)), "==", 1));
    return { checks };
  },
};

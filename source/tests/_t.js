const UNB = require("/home/claude/unbroken/source/engine/core.js"); const fs = require("fs");
const r = JSON.parse(fs.readFileSync("/home/claude/gcbb/label-data.json")); const C = JSON.parse(fs.readFileSync("/home/claude/gcbb/ties-choice.json"));
const ink = Uint8Array.from(r.ink, (c) => +c), k = r.k, old = C.numbered, drop = new Set(C.drop);
const mid = (t) => [(t[0] + t[2]) / 2, (t[1] + t[3]) / 2];
const run = (name, extra) => {
  const T = UNB.ties(Float64Array.from(r.x), Float64Array.from(r.y), { ink, w: r.w, h: r.h, mmPerPx: k, closed: true, spacingMM: 1.34, lineMM: 0.84, ...extra });
  const got = T.ties.map(mid), has = (m) => got.some(g => Math.hypot(g[0] - m[0], g[1] - m[1]) * k < 2.5);
  const wk = old.map((t, i) => [i + 1, has(mid(t))]);
  const ex = got.filter(g => !old.some(t => Math.hypot(g[0] - mid(t)[0], g[1] - mid(t)[1]) * k < 2.5)).map(g => g.map(v => Math.round(v * k)));
  const a = wk.filter(([n, h]) => h && drop.has(n)).map(x => x[0]), b = wk.filter(([n, h]) => !h && !drop.has(n)).map(x => x[0]);
  console.log(name, "ties", T.count, "in:", a.join(","), "| out:", b.join(","), "| new:", JSON.stringify(ex), "| skipped", T.skipped.map(s => s.why[0]).join(""), "missed", T.missed);
  return T;
};
run("rules", {});
run("stand", { stand: true });
const outs = [7, 20, 26].map(n => mid(old[n - 1])), adds = [9, 29, 30].map(n => mid(old[n - 1]));
run("taps", { leaveOut: outs, addAt: adds });

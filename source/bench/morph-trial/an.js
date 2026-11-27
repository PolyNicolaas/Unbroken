const fs = require("fs");
const rows = process.argv.slice(2).flatMap((f) => fs.readFileSync(f, "utf8").split("\n").filter((l) => l.startsWith("{")).map(JSON.parse)).filter((r) => !r.err);
const key = (c) => JSON.stringify(c), by = new Map();
for (const r of rows) { const k = key(r.c); if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
const OK = 0.05;
for (const [k, R] of by) {
  const pc = R.filter((r) => r.circle.bad < OK).length, ph = R.filter((r) => r.heart.bad < OK).length, ml = R.filter((r) => r.loops !== 1).map((r) => r.ch).join("");
  const sum = R.reduce((a, r) => a + r.circle.bad + r.heart.bad, 0);
  console.log(k.padEnd(42), `circle ${pc}/${R.length} heart ${ph}/${R.length} total badness ${sum.toFixed(1)}`, ml ? "multi-loop: " + ml : "", "fail:", R.filter((r) => r.circle.bad >= OK || r.heart.bad >= OK).map((r) => r.ch + (r.circle.bad >= OK ? "c" : "") + (r.heart.bad >= OK ? "h" : "")).join(" "));
}

const fs = require("fs"), R = process.argv.slice(2).flatMap((f) => fs.readFileSync(f, "utf8").trim().split("\n").map(JSON.parse)), ok = (b) => b < 0.05;
for (const s of Object.keys(R[0]).filter((k) => k !== "ch")) {
  const straight = R.filter((r) => ok(r[s][0])).length, any = R.filter((r) => r[s].some(ok)).length;
  console.log(s.padEnd(8), `${straight}/${R.length} straight, ${any}/${R.length} with a turn`, "fail:", R.filter((r) => !r[s].some(ok)).map((r) => r.ch).join(""), "| needs a turn:", R.filter((r) => !ok(r[s][0]) && r[s].some(ok)).map((r) => r.ch).join(""));
}

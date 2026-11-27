// try pairing settings on the failing letters
const settings = JSON.parse(process.argv[2]);
for (const T of settings) {
  globalThis.__morphT = T;
  delete require.cache[require.resolve("./tune.js")];
  process.env.GLYPHS = process.argv[3] || "BEFGOPS";
  const out = []; const log = console.log; console.log = (l) => out.push(JSON.parse(l));
  require("./tune.js");
  console.log = log;
  console.log(JSON.stringify(T).padEnd(36), out.map((r) => `${r.ch} c${r.circle.bad.toFixed(2)} h${r.heart.bad.toFixed(2)}`).join("  "));
}

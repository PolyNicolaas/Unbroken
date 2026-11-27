// gather the approved variants by capturing each script's sheet() call
const lib = require("./lib.js");
const real = lib.sheet; let got = {};
lib.sheet = (file, items) => { got[file] = items; };
const pick = { "heart.js": [1], "oval.js": [1], "cloud.js": [1], "gear.js": [2], "diamond.js": [0], "plus.js": [0], "arch.js": [2], "bell.js": [1], "tree.js": [1, 2], "moons.js": [1], "bolt.js": [1], "bubble.js": [1], "star.js": [1] };
const out = [];
for (const [f, idx] of Object.entries(pick)) { got = {}; delete require.cache[require.resolve("./" + f)]; require("./" + f); const items = Object.values(got)[0]; idx.forEach((i) => out.push([f.replace(".js", "") + " " + items[i][0].split("·")[1].trim(), items[i][1]])); }
lib.sheet = real;
const fs = require("fs"); fs.writeFileSync("approved-shapes.json", JSON.stringify(out.map(([n, P]) => [n, P.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)])])));
// sheets of 5 per row
for (let r = 0; r * 5 < out.length; r++) real(`approved-${r + 1}.png`, out.slice(r * 5, r * 5 + 5));
console.log(out.map((o) => o[0] + " " + o[1].length).join("\n"));

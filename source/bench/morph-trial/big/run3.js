const { word, check, UNB } = require("./big.js");
// a shape stretched to the word's box (so the morph mostly has to make the letters, not change the proportions)
function stretched(key, Wd) {
  const S = UNB.morphShape(key), xs = [], ys = [];
  for (let i = 0; i < Wd.loop.length; i += 2) { xs.push(Wd.loop[i] * Wd.reach); ys.push(Wd.loop[i + 1] * Wd.reach); }
  const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys), cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const sw = Math.max(...S.x) - Math.min(...S.x), sh = Math.max(...S.y) - Math.min(...S.y), scx = (Math.max(...S.x) + Math.min(...S.x)) / 2, scy = (Math.max(...S.y) + Math.min(...S.y)) / 2;
  return UNB.vaseLineLoop(S.x.map((x) => cx + ((x - scx) * bw * 1.06) / sw), S.y.map((y) => cy + ((y - scy) * (bh + 6)) / sh));
}
for (const [t, c, k] of [["HAPPY", 22, "pebble"], ["NICOLAAS", 16, "pebble"], ["CHEERS", 20, "pebble"], ["HAPPY", 22, "square"]]) {
  const Wd = word(t, c); try { check(stretched(k, Wd), Wd, `${k} stretched→${t}`); } catch (e) { console.log("ERR", t, String(e).slice(0, 150)); }
}
console.log("done");

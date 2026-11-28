const { pat, word, shape, circle, check } = require("./big.js");
const set = {
  c: [
    () => check(pat("moore", { detail: 2 }), pat("moore", { detail: 3 }), "moore2→moore3 (finer)"),
    () => check(circle(), pat("moore", { detail: 3 }), "circle→moore3"),
    () => check(pat("moore", { detail: 3 }), pat("moore", { detail: 4 }), "moore3→moore4 (finer)"),
    () => check(pat("labyrinth", { detail: 8 }), pat("labyrinth", { detail: 8, twist: 80 }), "labyrinth8 twist30→80"),
    () => check(pat("spiral", {}), pat("spiral", { twist: 80 }), "spiral twist→80"),
  ],
  d: [
    () => check(shape("star"), word("LOVE", 25), "star→LOVE"),
    () => check(shape("pebble"), word("LOVE", 25), "pebble→LOVE"),
    () => check(shape("heart"), word("HAPPY", 22), "heart→HAPPY"),
    () => check(shape("heart"), word("NICOLAAS", 16), "heart→NICOLAAS"),
    () => check(pat("moore", { detail: 3 }), word("LOVE", 25), "moore3→LOVE"),
  ],
};
for (const f of set[process.argv[2]]) { try { f(); } catch (e) { console.log("ERR", String(e).slice(0, 200)); } }
console.log("done");

const { pat, word, shape, circle, check } = require("./big.js");
const set = {
  a: [
    () => check(pat("moore", { detail: 1 }), pat("moore", { detail: 2 }), "moore1→moore2 (finer)"),
    () => check(pat("hilbert", { detail: 2 }), pat("hilbert", { detail: 3 }), "hilbert2→hilbert3"),
    () => check(pat("gosper", { detail: 1 }), pat("gosper", { detail: 2 }), "gosper1→gosper2"),
    () => check(circle(), pat("moore", { detail: 1 }), "circle→moore1"),
    () => check(pat("labyrinth", { detail: 2 }), pat("labyrinth", { detail: 2, seed: 7 }), "labyrinth→labyrinth (other seed)"),
  ],
  b: [
    () => check(circle(), word("LOVE", 25), "circle→LOVE 25mm"),
    () => check(shape("heart"), word("LOVE", 25), "heart→LOVE"),
    () => check(word("LOVE", 25), word("HOPE", 25), "LOVE→HOPE"),
    () => check(word("MOM", 30), word("DAD", 30), "MOM→DAD"),
    () => check(circle(), word("JOY", 30), "circle→JOY"),
  ],
};
(async () => { for (const f of set[process.argv[2]]) { try { f(); } catch (e) { console.log("ERR", String(e).slice(0, 200)); } } console.log("done"); })();

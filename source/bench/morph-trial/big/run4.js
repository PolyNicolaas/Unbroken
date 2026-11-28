const { check, shape, UNB } = require("./big.js");
const { wordShape } = require(__dirname + "/../wordshape.js");
const solid = (t, cap) => { const S = wordShape(t, { font: "chocolate", cap, slit: 1.7, round: 1, minHole: 99 }); return UNB.vaseLineLoop(S.loop.map((p) => p[0]), S.loop.map((p) => p[1])); };
const set = { f: [() => check(shape("pebble"), solid("HAPPY", 22), "pebble→HAPPY solid"), () => check(solid("LOVE", 25), solid("HOPE", 25), "LOVE→HOPE solid")],
  g: [() => check(shape("heart"), solid("NICOLAAS", 16), "heart→NICOLAAS solid"), () => check(solid("MOM", 30), solid("DAD", 30), "MOM→DAD solid")] };
for (const f of set[process.argv[2]]) { try { f(); } catch (e) { console.log("ERR", String(e).slice(0, 200)); } }
console.log("done");

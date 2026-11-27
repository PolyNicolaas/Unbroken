const { smooth, sheet, qb, ln } = require("./lib.js");
// body from nose (right) over the back to the tail joint, tail fin, belly back to the nose
const fish = ({ L = 26, H = 10, tail = 9, fork = 4, back = 0, cx = L / 6 }) => {
  const nose = [L / 2, 0], jt = [-L / 2, 1.5], jb = [-L / 2, -1.5];
  return [
    ...qb(nose, [cx, H * 1.3 + back], jt),
    ...ln(jt, [-L / 2 - tail, tail * 0.9], 40),
    ...qb([-L / 2 - tail, tail * 0.9], [-L / 2 - tail + fork, 0], [-L / 2 - tail, -tail * 0.9]),
    ...ln([-L / 2 - tail, -tail * 0.9], jb, 40),
    ...qb(jb, [cx, -H * 1.2], nose),
  ];
};
const A = smooth(fish({}), 0.8);                                    // simple fish
const B = smooth(fish({ L: 26, H: 12, tail: 8, fork: 5, back: 2, cx: -1 }), 1.0); // round, deep body
const C = smooth(fish({ L: 34, H: 7, tail: 8, fork: 6 }), 0.7);     // long slim
sheet("fish.png", [["A · simple", A], ["B · round", B], ["C · slim", C]]);

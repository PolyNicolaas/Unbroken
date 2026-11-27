// the approved shapes as compact point strings for the engine (simplified to 0.03 of their ~40 units)
const S = Object.fromEntries(JSON.parse(require("fs").readFileSync("approved-shapes.json")));
const pick = [["square", "Square", "square"], ["triangle", "Triangle", "triangle"], ["pentagon", "Pentagon", "pentagon"], ["hexagon", "Hexagon", "hexagon"], ["heart", "Heart", "heart hand-drawn"], ["star", "Star", "star chubby"], ["pebble", "Pebble", "oval pebble"], ["crescent", "Crescent", "moons crescent"], ["cloud", "Cloud", "cloud tall puff"], ["gear", "Gear", "gear 6 soft"], ["gem", "Gem", "diamond gem"], ["plus", "Plus", "plus chunky"], ["rainbow", "Rainbow", "arch rainbow"], ["bell", "Bell", "bell clapper"], ["tree", "Tree", "tree round"], ["fir", "Fir", "tree simple"], ["bolt", "Bolt", "bolt chunky"], ["bubble", "Speech bubble", "bubble box"]];
function rdp(P, eps) { // closed loop: split at the two farthest-apart points
  const one = (Q) => { const keep = new Uint8Array(Q.length); keep[0] = keep[Q.length - 1] = 1; const st = [[0, Q.length - 1]];
    while (st.length) { const [i, j] = st.pop(); let m = -1, dm = eps; const [ax, ay] = Q[i], [bx, by] = Q[j], L = Math.hypot(bx - ax, by - ay) || 1;
      for (let k = i + 1; k < j; k++) { const d = Math.abs((bx - ax) * (ay - Q[k][1]) - (ax - Q[k][0]) * (by - ay)) / L; if (d > dm) { dm = d; m = k; } }
      if (m > 0) { keep[m] = 1; st.push([i, m], [m, j]); } } return Q.filter((_, i) => keep[i]); };
  let far = 0, fd = 0; P.forEach((p, i) => { const d = Math.hypot(p[0] - P[0][0], p[1] - P[0][1]); if (d > fd) { fd = d; far = i; } });
  return [...one(P.slice(0, far + 1)).slice(0, -1), ...one([...P.slice(far), P[0]]).slice(0, -1)];
}
const lines = pick.map(([k, name, src]) => { const P = rdp(S[src], 0.03); return `    ${k}: ["${name}", "${P.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(" ")}"],`; });
require("fs").writeFileSync("ms.txt", lines.join("\n"));
console.log(lines.map((l) => l.length).join(" "), lines.join("").length);

/* Unbroken · engine · 16-molecule.js
   15. Molecules — atoms and bonds (from a SMILES laid out by RDKit, or drawn) → a skeletal formula as lines: bonds as
   strokes (double and triple ones as parallel strokes), carbons implied, the other atoms as letters in a single-stroke
   font with their hydrogens.
   One part of the engine (no DOM), loaded after 15-cutout.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB;

  // the elements by atomic number (enough for organic and most inorganic structures)
  const ELEMENTS =
    "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn".split(
      " "
    );

  // RDKit's JSON (get_json, after set_new_coords) → { atoms: [{ el, x, y, h, q }], bonds: [{ a, b, order }] }; y up as
  // RDKit gives it. Null when it holds no molecule.
  UNB.molFromRDKit = function (json) {
    const J = typeof json === "string" ? JSON.parse(json) : json,
      M = J && J.molecules && J.molecules[0];
    if (!M) return null;
    const ad = (J.defaults && J.defaults.atom) || {},
      bd = (J.defaults && J.defaults.bond) || {},
      conf = M.conformers && M.conformers[0] && M.conformers[0].coords;
    const atoms = M.atoms.map((a, i) => {
      const z = a.z ?? ad.z ?? 6,
        c = (conf && conf[i]) || [0, 0];
      return { el: ELEMENTS[z - 1] || "?", x: c[0], y: c[1], h: a.impHs ?? ad.impHs ?? 0, q: a.chg ?? ad.chg ?? 0 };
    });
    const bonds = (M.bonds || []).map((b) => ({ a: b.atoms[0], b: b.atoms[1], order: b.bo ?? bd.bo ?? 1 }));
    return { atoms, bonds };
  };

  // the smallest ring through a bond (atoms in order), or null: the shortest way round from b back to a without it
  function ringOf(adj, a, b) {
    const prev = new Map([[b, -1]]),
      q = [b];
    for (let i = 0; i < q.length && q.length < 400; i++) {
      const u = q[i];
      for (const v of adj[u]) {
        if ((u === b && v === a) || prev.has(v)) continue;
        prev.set(v, u);
        if (v === a) {
          const ring = [];
          for (let w = a; w !== -1; w = prev.get(w)) ring.push(w);
          return ring.length <= 8 ? ring : null;
        }
        q.push(v);
      }
    }
    return null;
  }
  // the part of segment p→q outside the rectangles (each [x0, y0, x1, y1]), as [t0, t1] (null: none left)
  function segOutside(p, q, rects) {
    let t0 = 0,
      t1 = 1;
    const dx = q[0] - p[0],
      dy = q[1] - p[1];
    const inside = (t, r) => {
      const x = p[0] + dx * t,
        y = p[1] + dy * t;
      return x > r[0] && x < r[2] && y > r[1] && y < r[3];
    };
    for (const r of rects) {
      // where the segment is in r: [a, b] (Liang–Barsky)
      let a = 0,
        b = 1,
        ok = true;
      for (const [pp, qq] of [
        [-dx, p[0] - r[0]],
        [dx, r[2] - p[0]],
        [-dy, p[1] - r[1]],
        [dy, r[3] - p[1]],
      ]) {
        if (Math.abs(pp) < 1e-12) {
          if (qq < 0) ok = false;
        } else {
          const t = qq / pp;
          if (pp < 0) a = Math.max(a, t);
          else b = Math.min(b, t);
        }
      }
      if (!ok || a >= b) continue;
      // the rectangle covers one end (an atom's label): cut that end off
      if (a <= t0 + 1e-9 || inside(t0, r)) t0 = Math.max(t0, b);
      else if (b >= t1 - 1e-9 || inside(t1, r)) t1 = Math.min(t1, a);
    }
    return t1 - t0 > 0.02 ? [t0, t1] : null;
  }

  // Draw a molecule as a skeletal formula. mol: { atoms: [{ el, x, y, h, q }], bonds: [{ a, b, order }] } (any units, y
  // up); o: font (an entry of UNB_FONTS, for the labels), cap (label height ÷ bond length, default 0.5).
  // Returns { paths ([x, y, …] polylines), closed, box [w, h], gap, bond: 1, labels (how many), boxes ([{ atom, el,
  // rect }]: each label's letters), at (each atom's place) } in bond lengths (y down), the
  // shape UNB.patternLayout and the Art step's patterns use.
  UNB.molecule = function (mol, o = {}) {
    const A = mol.atoms,
      B = mol.bonds,
      n = A.length;
    if (!n) return null;
    // to bond lengths, y down
    let len = 0;
    for (const b of B) len += Math.hypot(A[b.a].x - A[b.b].x, A[b.a].y - A[b.b].y);
    const unit = B.length ? len / B.length : 1,
      P = A.map((a) => [a.x / unit, -a.y / unit]);
    const adj = A.map(() => []);
    for (const b of B) {
      adj[b.a].push(b.b);
      adj[b.b].push(b.a);
    }
    const cap = o.cap || 0.5,
      paths = [],
      closed = [],
      rects = new Array(n).fill(null);
    // ---------- the labels: every atom but a carbon with bonds; the hydrogens on the side away from the bonds
    // ----------
    const text = (s, h) => {
      if (!o.font) return null;
      const L = UNB.textLayout(s, o.font, { cap: h, spacing: "font", track: 0.04 * h, word: 0.3 * h, align: "left" });
      return L.strokes.length ? L : null;
    };
    let labels = 0;
    for (let i = 0; i < n; i++) {
      const a = A[i],
        show = a.el !== "C" || !adj[i].length || a.q;
      if (!show) continue;
      labels++;
      // which side the bonds leave from: the hydrogens go on the other (right unless the bonds go right)
      let dx = 0;
      for (const j of adj[i]) dx += P[j][0] - P[i][0];
      const left = adj[i].length && dx > 0.3 * adj[i].length;
      const main = text(a.el, cap);
      const mw = main ? main.width : cap * 0.7 * a.el.length,
        x0 = P[i][0] - mw / 2,
        y0 = P[i][1] - cap / 2;
      const put = (L, x, y) => {
        if (!L) return;
        for (const s of L.strokes) {
          const p = s.slice();
          for (let k = 0; k < p.length; k += 2) {
            p[k] += x;
            p[k + 1] += y;
          }
          paths.push(p);
          closed.push(false);
        }
      };
      put(main, x0, y0);
      let rx0 = x0,
        rx1 = x0 + mw;
      if (a.h > 0) {
        const H = text("H", cap),
          hw = H ? H.width : cap * 0.7,
          sub = a.h > 1 ? text(String(a.h), cap * 0.62) : null,
          sw = sub ? sub.width : 0,
          g = cap * 0.22;
        if (left) {
          // HO, H₂N: the H, then its number, then the element
          const hx = x0 - g - sw - (sub ? g * 0.5 : 0) - hw;
          put(H, hx, y0);
          if (sub) put(sub, hx + hw + g * 0.5, y0 + cap * 0.55);
          rx0 = hx;
        } else {
          put(H, x0 + mw + g, y0);
          if (sub) put(sub, x0 + mw + g + hw + g * 0.5, y0 + cap * 0.55);
          rx1 = x0 + mw + g + hw + (sub ? g * 0.5 + sw : 0);
        }
      }
      if (a.q) {
        const s = text((Math.abs(a.q) > 1 ? Math.abs(a.q) : "") + (a.q > 0 ? "+" : "-"), cap * 0.6);
        if (s) {
          put(s, rx1 + cap * 0.08, y0 - cap * 0.35);
          rx1 += cap * 0.08 + s.width;
        }
      }
      // the label's place: bonds stop short of its letters (the element only: the hydrogens sit away from the bonds)
      const pad = 0.12;
      rects[i] = [x0 - pad, y0 - pad, x0 + mw + pad, y0 + cap + pad];
    }
    // ---------- the bonds ----------
    const seg = (p, q) => {
      const t = segOutside(p, q, rects.filter(Boolean));
      if (!t) return;
      const dx = q[0] - p[0],
        dy = q[1] - p[1];
      paths.push([p[0] + dx * t[0], p[1] + dy * t[0], p[0] + dx * t[1], p[1] + dy * t[1]]);
      closed.push(false);
    };
    const D = 0.17; // the gap between a double bond's strokes, in bond lengths
    for (const b of B) {
      const p = P[b.a],
        q = P[b.b],
        dx = q[0] - p[0],
        dy = q[1] - p[1],
        L = Math.hypot(dx, dy) || 1,
        nx = -dy / L,
        ny = dx / L;
      const off = (s, t0, t1) => [
        [p[0] + dx * t0 + nx * s, p[1] + dy * t0 + ny * s],
        [p[0] + dx * t1 + nx * s, p[1] + dy * t1 + ny * s],
      ];
      if (b.order === 3) {
        seg(p, q);
        seg(...off(D, 0.1, 0.9));
        seg(...off(-D, 0.1, 0.9));
        continue;
      }
      if (b.order !== 2) {
        seg(p, q);
        continue;
      }
      // a double bond: in a ring, its second stroke inside the ring; a C=C in a chain, on the side with more
      // neighbours; to an end atom or a label (C=O), the two strokes either side of the bond
      const ring = ringOf(adj, b.a, b.b);
      let side = 0;
      if (ring) {
        const cx = ring.reduce((s, i) => s + P[i][0], 0) / ring.length,
          cy = ring.reduce((s, i) => s + P[i][1], 0) / ring.length;
        side = (cx - p[0]) * nx + (cy - p[1]) * ny > 0 ? 1 : -1;
      } else if (!rects[b.a] && !rects[b.b] && adj[b.a].length > 1 && adj[b.b].length > 1) {
        let s = 0;
        for (const [i, j] of [
          [b.a, b.b],
          [b.b, b.a],
        ])
          for (const k of adj[i]) if (k !== j) s += (P[k][0] - P[i][0]) * nx + (P[k][1] - P[i][1]) * ny;
        side = s > 0.05 ? 1 : s < -0.05 ? -1 : 0;
      }
      if (side) {
        seg(p, q);
        const t0 = rects[b.a] ? 0 : 0.14,
          t1 = rects[b.b] ? 1 : 0.86;
        seg(...off(side * D, t0, t1));
      } else {
        seg(...off(D / 2, 0, 1));
        seg(...off(-D / 2, 0, 1));
      }
    }
    // to the origin, the box round it all
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const p of paths)
      for (let k = 0; k < p.length; k += 2) {
        x0 = Math.min(x0, p[k]);
        x1 = Math.max(x1, p[k]);
        y0 = Math.min(y0, p[k + 1]);
        y1 = Math.max(y1, p[k + 1]);
      }
    if (!paths.length) return null;
    for (const p of paths)
      for (let k = 0; k < p.length; k += 2) {
        p[k] -= x0;
        p[k + 1] -= y0;
      }
    // each label's place (the element's letters, padded), and each atom's, in the drawing
    const boxes = [];
    rects.forEach(
      (r, i) => r && boxes.push({ atom: i, el: A[i].el, rect: [r[0] - x0, r[1] - y0, r[2] - x0, r[3] - y0] })
    );
    const at = P.map(([x, y]) => [x - x0, y - y0]);
    // (the closest two separate strokes come: a double bond's, or the letters' own)
    return {
      paths,
      closed,
      box: [Math.max(1e-6, x1 - x0), Math.max(1e-6, y1 - y0)],
      gap: Math.min(D, cap * 0.25),
      bond: 1,
      labels,
      boxes,
      at,
      atoms: n,
      bonds: B.length,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);

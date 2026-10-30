/* Unbroken · engine · 16-molecule.js
   15. Molecules — atoms and bonds (from a SMILES laid out by RDKit, or drawn) → a skeletal formula as lines: bonds as
   strokes (double and triple ones as parallel strokes), carbons implied, the other atoms as letters in a single-stroke
   font with their hydrogens.
   One part of the engine (no DOM), loaded after 15-cutout.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB;

  // the elements by atomic number, all 118
  const ELEMENTS = (
    "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb " +
    "Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au " +
    "Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og"
  ).split(" ");

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

  // The side of atom i's label its hydrogens go on: right, left, up or down (y down), the first of those with no bond
  // within 60° of it, else the one farthest from its bonds.
  function molHydrogenSide(P, nbrs, i) {
    const sides = [
      ["right", 1, 0],
      ["left", -1, 0],
      ["up", 0, -1],
      ["down", 0, 1],
    ];
    let best = "right",
      bestCos = Infinity;
    for (const [name, sx, sy] of sides) {
      let worst = -1; // the cosine to its nearest bond (1: along it)
      for (const j of nbrs) {
        const dx = P[j][0] - P[i][0],
          dy = P[j][1] - P[i][1],
          L = Math.hypot(dx, dy) || 1;
        worst = Math.max(worst, (dx * sx + dy * sy) / L);
      }
      if (worst <= 0.5 + 1e-9) return name;
      if (worst < bestCos - 1e-9) ((bestCos = worst), (best = name));
    }
    return best;
  }
  // Draw a molecule as a skeletal formula. mol: { atoms: [{ el, x, y, h, q }], bonds: [{ a, b, order }] } (any units, y
  // up); o: font (an entry of UNB_FONTS, for the labels), cap (label height ÷ bond length, default 0.5).
  // Returns { paths ([x, y, …] polylines), closed, box [w, h], gap, bond: 1, labels (how many), owner (each stroke's:
  // −1 a bond, else its label's atom), boxes ([{ atom, el,
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
      owner = [], // each stroke's: −1 a bond, else the atom whose label it's part of
      rects = new Array(n).fill(null),
      hRects = []; // the hydrogens' places (bonds stop short of them as well)
    // ---------- the labels: every atom but a carbon with bonds; the hydrogens on a side away from the bonds
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
          owner.push(i);
        }
      };
      put(main, x0, y0);
      let rx1 = x0 + mw;
      if (a.h > 0) {
        const H = text("H", cap),
          hw = H ? H.width : cap * 0.7,
          sub = a.h > 1 ? text(String(a.h), cap * 0.62) : null,
          sw = sub ? sub.width : 0,
          g = cap * 0.22,
          side = molHydrogenSide(P, adj[i], i);
        let hx, hy;
        if (side === "left") {
          // HO, H₂N: the H, then its number, then the element
          hx = x0 - g - sw - (sub ? g * 0.5 : 0) - hw;
          hy = y0;
        } else if (side === "right") {
          hx = x0 + mw + g;
          hy = y0;
          rx1 = hx + hw + (sub ? g * 0.5 + sw : 0);
        } else {
          // above or below the element (an NH in a ring), centred on it
          hx = x0 + (mw - hw) / 2;
          hy = side === "up" ? y0 - cap - g : y0 + cap + g;
        }
        put(H, hx, hy);
        if (sub) put(sub, hx + hw + g * 0.5, hy + cap * 0.55);
        // bonds (another atom's, or one at a slant) stop short of the hydrogens too
        hRects.push([hx - 0.06, hy - 0.06, hx + hw + (sub ? g * 0.5 + sw : 0) + 0.06, hy + cap + 0.06]);
      }
      if (a.q) {
        const s = text((Math.abs(a.q) > 1 ? Math.abs(a.q) : "") + (a.q > 0 ? "+" : "-"), cap * 0.6);
        if (s) {
          put(s, rx1 + cap * 0.08, y0 - cap * 0.35);
          rx1 += cap * 0.08 + s.width;
        }
      }
      // the label's place: bonds stop short of its letters (and of its hydrogens: hRects, above)
      const pad = 0.12;
      rects[i] = [x0 - pad, y0 - pad, x0 + mw + pad, y0 + cap + pad];
    }
    // ---------- the bonds ----------
    const seg = (p, q) => {
      const t = segOutside(p, q, rects.filter(Boolean).concat(hRects));
      if (!t) return;
      const dx = q[0] - p[0],
        dy = q[1] - p[1];
      paths.push([p[0] + dx * t[0], p[1] + dy * t[0], p[0] + dx * t[1], p[1] + dy * t[1]]);
      closed.push(false);
      owner.push(-1);
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
      owner,
      atoms: n,
      bonds: B.length,
    };
  };

  // ---------- editing (the structure editor, web-app/js/moleditor.js) ----------
  // Structures are { atoms: [{ el, x, y, h, q }], bonds: [{ a, b, order }] } in RDKit's units (a bond ≈ 1.5, y up).
  // Each edit returns a new structure (the editor keeps the old ones for Undo).
  const molCopy = (m) => ({ atoms: m.atoms.map((a) => ({ ...a })), bonds: m.bonds.map((b) => ({ ...b })) });
  const bondLen = (m) => {
    let s = 0;
    for (const b of m.bonds) s += Math.hypot(m.atoms[b.a].x - m.atoms[b.b].x, m.atoms[b.a].y - m.atoms[b.b].y);
    return m.bonds.length ? s / m.bonds.length : 1.5;
  };
  UNB.molBondLength = bondLen;
  const bondAt = (m, a, b) => m.bonds.findIndex((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  const molNbrs = (m, i) => m.bonds.filter((b) => b.a === i || b.b === i).map((b) => (b.a === i ? b.b : b.a));
  // the usual valences (the smallest that fits the bonds is used), by charge
  const VALENCE = {
    C: [4],
    N: [3, 5],
    O: [2],
    S: [2, 4, 6],
    P: [3, 5],
    B: [3],
    Si: [4],
    F: [1],
    Cl: [1, 3, 5, 7],
    Br: [1],
    I: [1, 3],
    H: [1],
    Se: [2, 4, 6],
  };
  function valences(el, q) {
    const v = VALENCE[el];
    if (!v) return null;
    if (!q) return v;
    // a charged atom takes the valences of the element with as many electrons (N⁺ as C, O⁻ as F, B⁻ as C, C⁻ as N,
    // C⁺ as B, N²⁺ as B), the way RDKit does; a noble gas's none
    const z = ELEMENTS.indexOf(el) + 1 - q,
      iso = z >= 1 ? ELEMENTS[z - 1] : null;
    if (iso && VALENCE[iso]) return VALENCE[iso];
    if (["He", "Ne", "Ar", "Kr", "Xe"].includes(iso)) return [0];
    return v.map((x) => x + (["N", "O", "S", "P"].includes(el) ? q : -Math.abs(q))).filter((x) => x >= 0);
  }
  // The atoms with more bonds than their element (and charge) can have: [{ atom, el, bonds, most }] (bonds: the sum
  // of their orders), so the editor can say which one RDKit won't take.
  UNB.molOverBonded = function (mol) {
    const sum = new Array(mol.atoms.length).fill(0),
      out = [];
    for (const b of mol.bonds) {
      sum[b.a] += b.order;
      sum[b.b] += b.order;
    }
    mol.atoms.forEach((a, i) => {
      const v = valences(a.el, a.q || 0);
      if (v && v.length && sum[i] > Math.max(...v))
        out.push({ atom: i, el: a.el, bonds: sum[i], most: Math.max(...v) });
    });
    return out;
  };
  // Implicit hydrogens from each atom's bonds and charge (an element without usual valences keeps its count)
  UNB.molHydrogens = function (mol) {
    const m = molCopy(mol),
      sum = new Array(m.atoms.length).fill(0);
    for (const b of m.bonds) {
      sum[b.a] += b.order;
      sum[b.b] += b.order;
    }
    m.atoms.forEach((a, i) => {
      const v = valences(a.el, a.q || 0);
      if (!v) return;
      const fit = v.find((x) => x >= sum[i]);
      a.h = fit === undefined ? 0 : fit - sum[i];
    });
    return m;
  };
  // the nearest atom within r, else the nearest bond within r (its middle stretch); null for neither
  UNB.molHit = function (mol, x, y, r) {
    let best = r,
      atom = -1;
    mol.atoms.forEach((a, i) => {
      const d = Math.hypot(a.x - x, a.y - y);
      if (d < best) ((best = d), (atom = i));
    });
    if (atom >= 0) return { atom };
    let bond = -1;
    best = r;
    mol.bonds.forEach((b, j) => {
      const p = mol.atoms[b.a],
        q = mol.atoms[b.b],
        dx = q.x - p.x,
        dy = q.y - p.y,
        t = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy || 1))),
        d = Math.hypot(p.x + dx * t - x, p.y + dy * t - y);
      if (d < best) ((best = d), (bond = j));
    });
    return bond >= 0 ? { bond } : null;
  };
  // the best direction (radians) for a new bond from atom i: away from its bonds and from atoms nearby
  function freeDir(m, i) {
    const a = m.atoms[i],
      L = bondLen(m),
      ns = molNbrs(m, i),
      dirs = ns.map((j) => Math.atan2(m.atoms[j].y - a.y, m.atoms[j].x - a.x));
    let cands;
    if (!ns.length) cands = [Math.PI / 6];
    else if (ns.length === 1) cands = [dirs[0] + (2 * Math.PI) / 3, dirs[0] - (2 * Math.PI) / 3];
    else {
      // the middle of the widest gap between its bonds
      const s = dirs.slice().sort((p, q) => p - q);
      let gap = -1,
        at = 0;
      for (let k = 0; k < s.length; k++) {
        const g = (k + 1 < s.length ? s[k + 1] : s[0] + 2 * Math.PI) - s[k];
        if (g > gap) ((gap = g), (at = s[k] + g / 2));
      }
      cands = [at];
    }
    // of the candidates, the one whose new atom is farthest from the others
    let best = cands[0],
      far = -1;
    for (const t of cands) {
      const x = a.x + L * Math.cos(t),
        y = a.y + L * Math.sin(t);
      let d = Infinity;
      m.atoms.forEach((o, k) => {
        if (k !== i) d = Math.min(d, Math.hypot(o.x - x, o.y - y));
      });
      if (d > far + 1e-6) ((far = d), (best = t));
    }
    return best;
  }
  // an atom at (x, y), or the one already there (within 0.3 bond)
  function atomAt(m, x, y, el) {
    const L = bondLen(m);
    const i = m.atoms.findIndex((a) => Math.hypot(a.x - x, a.y - y) < 0.3 * L);
    if (i >= 0) return i;
    m.atoms.push({ el: el || "C", x, y, h: 0, q: 0 });
    return m.atoms.length - 1;
  }
  const molLink = (m, a, b, order = 1) => {
    if (a === b) return;
    const j = bondAt(m, a, b);
    if (j < 0) m.bonds.push({ a, b, order });
  };
  // A new bond. from: an atom's index, or null (a new atom at `to`); to: [x, y] (snapped to a bond length at 30°
  // steps from `from`; an atom already there is joined), or null (the best free direction). el: the new atom's
  // element. Returns { mol, atom } (the atom at the far end).
  UNB.molGrow = function (mol, from, to, el = "C") {
    const m = molCopy(mol),
      L = bondLen(m);
    if (from == null) {
      const i = atomAt(m, to ? to[0] : 0, to ? to[1] : 0, el);
      return { mol: UNB.molHydrogens(m), atom: i };
    }
    const a = m.atoms[from];
    let x, y;
    if (to) {
      const hit = m.atoms.findIndex((o, k) => k !== from && Math.hypot(o.x - to[0], o.y - to[1]) < 0.35 * L);
      if (hit >= 0) {
        if (bondAt(m, from, hit) < 0) molLink(m, from, hit);
        return { mol: UNB.molHydrogens(m), atom: hit };
      }
      const t = Math.round(Math.atan2(to[1] - a.y, to[0] - a.x) / (Math.PI / 6)) * (Math.PI / 6);
      x = a.x + L * Math.cos(t);
      y = a.y + L * Math.sin(t);
    } else {
      const t = freeDir(m, from);
      x = a.x + L * Math.cos(t);
      y = a.y + L * Math.sin(t);
    }
    const i = atomAt(m, x, y, el);
    molLink(m, from, i);
    return { mol: UNB.molHydrogens(m), atom: i };
  };
  // A ring of n atoms (aromatic: alternate double bonds). where: { atom } (hung off it on a new bond, or round it when
  // it has none), { bond } (fused on that bond, on its emptier side) or { x, y } (centred there). Atoms already where a
  // ring
  // atom falls are used, so rings fuse.
  UNB.molRing = function (mol, where, n = 6, aromatic = false) {
    const m = molCopy(mol),
      L = m.bonds.length ? bondLen(m) : 1.5,
      R = L / (2 * Math.sin(Math.PI / n)),
      step = (2 * Math.PI) / n;
    let cx, cy, start; // the centre, and the angle of the first atom from it
    let ring = [];
    if (where.bond != null) {
      const b = m.bonds[where.bond],
        p = m.atoms[b.a],
        q = m.atoms[b.b],
        mx = (p.x + q.x) / 2,
        my = (p.y + q.y) / 2,
        d = Math.hypot(q.x - p.x, q.y - p.y) || 1,
        nx = -(q.y - p.y) / d,
        ny = (q.x - p.x) / d,
        ap = L / (2 * Math.tan(Math.PI / n));
      // the side with fewer atoms near it
      let s = 0;
      m.atoms.forEach((o, k) => {
        if (k !== b.a && k !== b.b)
          s += Math.sign((o.x - mx) * nx + (o.y - my) * ny) / (1 + Math.hypot(o.x - mx, o.y - my));
      });
      const side = s > 0 ? -1 : 1;
      cx = mx + side * nx * ap;
      cy = my + side * ny * ap;
      // around from p through q
      const ta = Math.atan2(p.y - cy, p.x - cx),
        tb = Math.atan2(q.y - cy, q.x - cx),
        dir = Math.sin(tb - ta) > 0 ? 1 : -1;
      ring = [b.a, b.b];
      for (let k = 2; k < n; k++)
        ring.push(atomAt(m, cx + R * Math.cos(ta + dir * k * step), cy + R * Math.sin(ta + dir * k * step)));
    } else if (where.atom != null) {
      // an atom with bonds: the ring hangs off it on a new bond (a phenyl, a cyclohexyl); a lone atom: it's in the ring
      let at = where.atom;
      if (molNbrs(m, at).length) {
        const t0 = freeDir(m, at),
          o = m.atoms[at];
        const j = atomAt(m, o.x + L * Math.cos(t0), o.y + L * Math.sin(t0));
        molLink(m, at, j);
        at = j;
      }
      const a = m.atoms[at],
        ns = molNbrs(m, at),
        // straight on from its one bond, else the freest way
        t = ns.length === 1 ? Math.atan2(a.y - m.atoms[ns[0]].y, a.x - m.atoms[ns[0]].x) : freeDir(m, at);
      cx = a.x + R * Math.cos(t);
      cy = a.y + R * Math.sin(t);
      start = t + Math.PI;
      ring = [at];
      for (let k = 1; k < n; k++)
        ring.push(atomAt(m, cx + R * Math.cos(start + k * step), cy + R * Math.sin(start + k * step)));
    } else {
      cx = where.x;
      cy = where.y;
      start = -Math.PI / 2 - step / 2; // (a flat side at the bottom)
      for (let k = 0; k < n; k++)
        ring.push(atomAt(m, cx + R * Math.cos(start + k * step), cy + R * Math.sin(start + k * step)));
    }
    // the ring's bonds; an aromatic ring's double bonds go in turn round it wherever neither end has one yet (so a ring
    // fused on another gets the doubles the shared atoms leave room for)
    const hasDouble = (i) => m.bonds.some((x) => (x.a === i || x.b === i) && x.order === 2);
    for (let k = 0; k < n; k++) {
      const a = ring[k],
        b = ring[(k + 1) % n];
      if (bondAt(m, a, b) >= 0) continue;
      molLink(m, a, b, aromatic && !hasDouble(a) && !hasDouble(b) ? 2 : 1);
    }
    return UNB.molHydrogens(m);
  };
  // a bond's order cycled 1 → 2 → 3 → 1
  UNB.molCycleBond = function (mol, j) {
    const m = molCopy(mol);
    m.bonds[j].order = (m.bonds[j].order % 3) + 1;
    return UNB.molHydrogens(m);
  };
  // an atom's element (and charge) set
  UNB.molSetAtom = function (mol, i, el, q) {
    const m = molCopy(mol);
    m.atoms[i].el = el;
    if (q !== undefined) m.atoms[i].q = q;
    return UNB.molHydrogens(m);
  };
  // an atom (with its bonds) or a bond taken away
  UNB.molErase = function (mol, what) {
    const m = molCopy(mol);
    if (what.bond != null) m.bonds.splice(what.bond, 1);
    else if (what.atom != null) {
      const i = what.atom;
      m.atoms.splice(i, 1);
      m.bonds = m.bonds
        .filter((b) => b.a !== i && b.b !== i)
        .map((b) => ({ ...b, a: b.a > i ? b.a - 1 : b.a, b: b.b > i ? b.b - 1 : b.b }));
    }
    return UNB.molHydrogens(m);
  };
  // a structure as a V2000 mol block (for RDKit: Clean up, a SMILES)
  UNB.molBlock = function (mol) {
    const f = (v, w) => v.toFixed(4).padStart(w),
      i3 = (v) => String(v).padStart(3),
      out = ["", "  Unbroken", "", `${i3(mol.atoms.length)}${i3(mol.bonds.length)}  0  0  0  0  0  0  0  0999 V2000`];
    for (const a of mol.atoms)
      out.push(`${f(a.x, 10)}${f(a.y, 10)}${f(0, 10)} ${a.el.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`);
    for (const b of mol.bonds) out.push(`${i3(b.a + 1)}${i3(b.b + 1)}${i3(b.order)}  0`);
    const ch = mol.atoms.map((a, i) => [i + 1, a.q || 0]).filter(([, q]) => q);
    for (let k = 0; k < ch.length; k += 8) {
      const part = ch.slice(k, k + 8);
      out.push(`M  CHG${i3(part.length)}` + part.map(([i, q]) => ` ${i3(i)} ${i3(q)}`).join(""));
    }
    out.push("M  END");
    return out.join("\n");
  };
})(typeof window !== "undefined" ? window : globalThis);

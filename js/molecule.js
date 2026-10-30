// Unbroken · web app · molecule.js
// The Molecule input (Art step, docs/CHEM-PLAN.md): a chemical structure drawn as a skeletal formula (engine
// 16-molecule.js, UNB.molecule). Typed as a SMILES, or as a name looked up on PubChem; RDKit (the chemistry toolkit,
// WebAssembly, ~7 MB) lays it out in 2D, loaded from a CDN the first time it's needed. The examples come laid out
// already, so they work without either.
// st.art.molecule: { query (what was typed), name, smiles, mol ({ atoms, bonds }: UNB.molecule's input) } or null.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const RDKIT_URL = "https://unpkg.com/@rdkit/rdkit@2026.3.6/dist/";
const PUBCHEM = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/";
// laid out by RDKit (atoms: element, hydrogens, charge, x, y; bonds: atom, atom, order)
const MOL_EXAMPLES = [
  {
    key: "theobromine",
    name: "Theobromine",
    what: "chocolate's own molecule",
    smiles: "CN1C=NC2=C1C(=O)NC(=O)N2C",
    atoms: [
      ["C", 3, 0, 2.776, 0],
      ["N", 0, 0, 1.276, 0],
      ["C", 1, 0, 0.394, 1.214],
      ["N", 0, 0, -1.032, 0.75],
      ["C", 0, 0, -1.032, -0.75],
      ["C", 0, 0, 0.394, -1.214],
      ["C", 0, 0, 0.706, -2.681],
      ["O", 0, 0, 2.133, -3.144],
      ["N", 1, 0, -0.409, -3.684],
      ["C", 0, 0, -1.835, -3.221],
      ["O", 0, 0, -2.95, -4.225],
      ["N", 0, 0, -2.147, -1.754],
      ["C", 3, 0, -3.574, -1.29],
    ],
    bonds: [
      [0, 1, 1],
      [1, 2, 1],
      [2, 3, 2],
      [3, 4, 1],
      [4, 5, 2],
      [5, 6, 1],
      [6, 7, 2],
      [6, 8, 1],
      [8, 9, 1],
      [9, 10, 2],
      [9, 11, 1],
      [11, 12, 1],
      [5, 1, 1],
      [11, 4, 1],
    ],
  },
  {
    key: "caffeine",
    name: "Caffeine",
    what: "",
    smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
    atoms: [
      ["C", 3, 0, 2.776, 0],
      ["N", 0, 0, 1.276, 0],
      ["C", 1, 0, 0.394, 1.214],
      ["N", 0, 0, -1.032, 0.75],
      ["C", 0, 0, -1.032, -0.75],
      ["C", 0, 0, 0.394, -1.214],
      ["C", 0, 0, 0.706, -2.681],
      ["O", 0, 0, 2.133, -3.144],
      ["N", 0, 0, -0.409, -3.684],
      ["C", 0, 0, -1.835, -3.221],
      ["O", 0, 0, -2.95, -4.225],
      ["N", 0, 0, -2.147, -1.754],
      ["C", 3, 0, -3.574, -1.29],
      ["C", 3, 0, -0.097, -5.152],
    ],
    bonds: [
      [0, 1, 1],
      [1, 2, 1],
      [2, 3, 2],
      [3, 4, 1],
      [4, 5, 2],
      [5, 6, 1],
      [6, 7, 2],
      [6, 8, 1],
      [8, 9, 1],
      [9, 10, 2],
      [9, 11, 1],
      [11, 12, 1],
      [8, 13, 1],
      [5, 1, 1],
      [11, 4, 1],
    ],
  },
  {
    key: "vanillin",
    name: "Vanillin",
    what: "",
    smiles: "COC1=C(C=CC(=C1)C=O)O",
    atoms: [
      ["C", 3, 0, 3.75, 1.299],
      ["O", 0, 0, 3, 0],
      ["C", 0, 0, 1.5, 0],
      ["C", 0, 0, 0.75, -1.299],
      ["C", 1, 0, -0.75, -1.299],
      ["C", 1, 0, -1.5, 0],
      ["C", 0, 0, -0.75, 1.299],
      ["C", 1, 0, 0.75, 1.299],
      ["C", 1, 0, -1.5, 2.598],
      ["O", 0, 0, -0.75, 3.897],
      ["O", 1, 0, 1.5, -2.598],
    ],
    bonds: [
      [0, 1, 1],
      [1, 2, 1],
      [2, 3, 2],
      [3, 4, 1],
      [4, 5, 2],
      [5, 6, 1],
      [6, 7, 2],
      [6, 8, 1],
      [8, 9, 2],
      [3, 10, 1],
      [7, 2, 1],
    ],
  },
  {
    key: "aspirin",
    name: "Aspirin",
    what: "",
    smiles: "CC(=O)OC1=CC=CC=C1C(=O)O",
    atoms: [
      ["C", 3, 0, 5.25, -1.299],
      ["C", 0, 0, 3.75, -1.299],
      ["O", 0, 0, 3, -2.598],
      ["O", 0, 0, 3, 0],
      ["C", 0, 0, 1.5, 0],
      ["C", 1, 0, 0.75, -1.299],
      ["C", 1, 0, -0.75, -1.299],
      ["C", 1, 0, -1.5, 0],
      ["C", 1, 0, -0.75, 1.299],
      ["C", 0, 0, 0.75, 1.299],
      ["C", 0, 0, 1.5, 2.598],
      ["O", 0, 0, 0.75, 3.897],
      ["O", 1, 0, 3, 2.598],
    ],
    bonds: [
      [0, 1, 1],
      [1, 2, 2],
      [1, 3, 1],
      [3, 4, 1],
      [4, 5, 2],
      [5, 6, 1],
      [6, 7, 2],
      [7, 8, 1],
      [8, 9, 2],
      [9, 10, 1],
      [10, 11, 2],
      [10, 12, 1],
      [9, 4, 1],
    ],
  },
  {
    key: "dopamine",
    name: "Dopamine",
    what: "",
    smiles: "C1=CC(=C(C=C1CCN)O)O",
    atoms: [
      ["C", 1, 0, 1.5, 0],
      ["C", 1, 0, 0.75, -1.299],
      ["C", 0, 0, -0.75, -1.299],
      ["C", 0, 0, -1.5, 0],
      ["C", 1, 0, -0.75, 1.299],
      ["C", 0, 0, 0.75, 1.299],
      ["C", 2, 0, 1.5, 2.598],
      ["C", 2, 0, 3, 2.598],
      ["N", 2, 0, 3.75, 3.897],
      ["O", 1, 0, -3, 0],
      ["O", 1, 0, -1.5, -2.598],
    ],
    bonds: [
      [0, 1, 2],
      [1, 2, 1],
      [2, 3, 2],
      [3, 4, 1],
      [4, 5, 2],
      [5, 6, 1],
      [6, 7, 1],
      [7, 8, 1],
      [3, 9, 1],
      [2, 10, 1],
      [5, 0, 1],
    ],
  },
  {
    key: "serotonin",
    name: "Serotonin",
    what: "",
    smiles: "C1=CC2=C(C=C1O)C(=CN2)CCN",
    atoms: [
      ["C", 1, 0, 1.5, 0],
      ["C", 1, 0, 0.75, -1.299],
      ["C", 0, 0, -0.75, -1.299],
      ["C", 0, 0, -1.5, 0],
      ["C", 1, 0, -0.75, 1.299],
      ["C", 0, 0, 0.75, 1.299],
      ["O", 1, 0, 1.5, 2.598],
      ["C", 0, 0, -2.967, -0.312],
      ["C", 1, 0, -3.124, -1.804],
      ["N", 1, 0, -1.754, -2.414],
      ["C", 2, 0, -4.082, 0.692],
      ["C", 2, 0, -5.509, 0.228],
      ["N", 2, 0, -6.623, 1.232],
    ],
    bonds: [
      [0, 1, 2],
      [1, 2, 1],
      [2, 3, 2],
      [3, 4, 1],
      [4, 5, 2],
      [5, 6, 1],
      [3, 7, 1],
      [7, 8, 2],
      [8, 9, 1],
      [7, 10, 1],
      [10, 11, 1],
      [11, 12, 1],
      [5, 0, 1],
      [9, 2, 1],
    ],
  },
  {
    key: "capsaicin",
    name: "Capsaicin",
    what: "",
    smiles: "CC(C)/C=C/CCCCC(=O)NCC1=CC(=C(C=C1)O)OC",
    atoms: [
      ["C", 3, 0, 14.25, -6.495],
      ["C", 1, 0, 12.75, -6.495],
      ["C", 3, 0, 12, -7.794],
      ["C", 1, 0, 12, -5.196],
      ["C", 1, 0, 10.5, -5.196],
      ["C", 2, 0, 9.75, -3.897],
      ["C", 2, 0, 8.25, -3.897],
      ["C", 2, 0, 7.5, -2.598],
      ["C", 2, 0, 6, -2.598],
      ["C", 0, 0, 5.25, -1.299],
      ["O", 0, 0, 6, 0],
      ["N", 1, 0, 3.75, -1.299],
      ["C", 2, 0, 3, 0],
      ["C", 0, 0, 1.5, 0],
      ["C", 1, 0, 0.75, -1.299],
      ["C", 0, 0, -0.75, -1.299],
      ["C", 0, 0, -1.5, 0],
      ["C", 1, 0, -0.75, 1.299],
      ["C", 1, 0, 0.75, 1.299],
      ["O", 1, 0, -3, 0],
      ["O", 0, 0, -1.5, -2.598],
      ["C", 3, 0, -0.75, -3.897],
    ],
    bonds: [
      [0, 1, 1],
      [1, 2, 1],
      [1, 3, 1],
      [3, 4, 2],
      [4, 5, 1],
      [5, 6, 1],
      [6, 7, 1],
      [7, 8, 1],
      [8, 9, 1],
      [9, 10, 2],
      [9, 11, 1],
      [11, 12, 1],
      [12, 13, 1],
      [13, 14, 2],
      [14, 15, 1],
      [15, 16, 2],
      [16, 17, 1],
      [17, 18, 2],
      [16, 19, 1],
      [15, 20, 1],
      [20, 21, 1],
      [18, 13, 1],
    ],
  },
  {
    key: "benzene",
    name: "Benzene",
    what: "",
    smiles: "c1ccccc1",
    atoms: [
      ["C", 1, 0, 1.5, 0],
      ["C", 1, 0, 0.75, -1.299],
      ["C", 1, 0, -0.75, -1.299],
      ["C", 1, 0, -1.5, 0],
      ["C", 1, 0, -0.75, 1.299],
      ["C", 1, 0, 0.75, 1.299],
    ],
    bonds: [
      [0, 1, 1],
      [1, 2, 2],
      [2, 3, 1],
      [3, 4, 2],
      [4, 5, 1],
      [5, 0, 2],
    ],
  },
];
const molOf = (e) => ({
  atoms: e.atoms.map(([el, h, q, x, y]) => ({ el, h, q, x, y })),
  bonds: e.bonds.map(([a, b, order]) => ({ a, b, order })),
});

// ---------- RDKit, loaded once, when first wanted ----------
let rdkitP = null;
function rdkit() {
  if (window.initRDKitModule && rdkitP) return rdkitP;
  rdkitP =
    rdkitP ||
    new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = RDKIT_URL + "RDKit_minimal.js";
      s.onload = () => window.initRDKitModule({ locateFile: () => RDKIT_URL + "RDKit_minimal.wasm" }).then(res, rej);
      s.onerror = () => rej(new Error("the chemistry toolkit (RDKit) couldn't be loaded: is the internet on?"));
      document.head.appendChild(s);
    }).catch((e) => {
      rdkitP = null; // (try again next time)
      throw e;
    });
  return rdkitP;
}
// a SMILES (or a name: looked up on PubChem) → { smiles, name, mol }
async function moleculeLookup(query) {
  const q = query.trim();
  if (!q) throw new Error("type a name or a SMILES");
  const RD = await rdkit();
  const parse = (s) => {
    let m = null;
    try {
      m = RD.get_mol(s);
    } catch {}
    if (m && !m.is_valid()) {
      m.delete();
      m = null;
    }
    return m;
  };
  let smiles = q,
    name = null,
    m = /\s/.test(q) ? null : parse(q);
  if (!m) {
    let r;
    try {
      r = await fetch(PUBCHEM + encodeURIComponent(q) + "/property/IsomericSMILES/JSON");
    } catch {
      throw new Error("PubChem couldn't be reached to look up the name (a SMILES works offline)");
    }
    if (!r.ok)
      throw new Error(
        `“${q}” isn't a SMILES, and PubChem doesn't know it by that name: try its SMILES (on its Wikipedia page, under Identifiers)`
      );
    const p = ((await r.json()).PropertyTable || {}).Properties || [];
    smiles = p[0] && (p[0].IsomericSMILES || p[0].SMILES);
    if (!smiles) throw new Error(`PubChem has no structure for “${q}”`);
    name = q;
    m = parse(smiles);
    if (!m) throw new Error("PubChem's structure couldn't be read");
  }
  m.set_new_coords();
  const mol = UNB.molFromRDKit(m.get_json());
  m.delete();
  if (!mol || !mol.atoms.length) throw new Error("no atoms in that structure");
  return { smiles, name, mol };
}

// ---------- the drawing (cached), like a pattern's ----------
let molCache = null;
// (turned by the Molecule card's Turn: the atoms move round, the letters stay upright)
function moleculeDrawn() {
  const M = st.art.molecule;
  if (!M || !M.mol) return { r: null, L: null };
  const turn = st.art.molTurn || 0,
    key = M.smiles + "|" + M.mol.atoms.length + "|" + turn;
  if (molCache && molCache.key === key && molCache.mol === M.mol) return molCache;
  const r = UNB.molecule(moleculeTurned(M.mol, turn), { font: UNB_FONTS.sans });
  molCache = { key, mol: M.mol, r, L: r ? UNB.patternLayout(r, ART_LONG) : null };
  return molCache;
}
// a structure turned by deg (anticlockwise), round its own middle
function moleculeTurned(mol, deg) {
  if (!deg) return mol;
  const a = (deg * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return { ...mol, atoms: mol.atoms.map((t) => ({ ...t, x: t.x * c - t.y * s, y: t.x * s + t.y * c })) };
}
// the Molecule card's Turn: the structure turned, its bonds kept the same length (a width set by hand follows the
// new shape)
function moleculeTurn(deg) {
  if (!st.art.molecule) return;
  const before = moleculeDrawn().r;
  artMolTurn((((Math.round(deg) % 360) + 540) % 360) - 180); // art.js
  const after = moleculeDrawn().r;
  if (st.art.molWidth && before && after)
    artMolTurn(st.art.molTurn, st.art.molWidth * (after.box[0] / Math.max(1e-9, before.box[0])));
  moleculeTurnUI();
  artUse("molecule"); // art.js
  recordSoon();
}
function moleculeTurnUI() {
  const t = st.art.molTurn || 0;
  $("molTurn").value = t;
  $("molTurnVal").textContent = `${t > 0 ? "+" : ""}${t}°`;
}
$("molTurn").addEventListener("input", () => moleculeTurn(+$("molTurn").value));
$("molTurnL").addEventListener("click", () => moleculeTurn((st.art.molTurn || 0) + 15));
$("molTurnR").addEventListener("click", () => moleculeTurn((st.art.molTurn || 0) - 15));
// the width (mm) it starts at: bonds long enough that a double bond's two strokes, each printed as a pair, stay the
// line spacing apart (and at least 8 mm)
function moleculeWidth() {
  const { r } = moleculeDrawn();
  if (!r) return null;
  // (every bond is printed as a pair of strands, v126: a double bond's two lines are each a pair, so twice the room)
  const bond = Math.max(8, st.spacing > 0 ? (st.spacing / r.gap) * 1.1 * 2 : 8);
  return r.box[0] * bond;
}
// "13 atoms, 14 bonds" (one atom, one bond)
const molAtomsBonds = (m) =>
  `${m.atoms.length} atom${m.atoms.length === 1 ? "" : "s"}, ${m.bonds.length} bond${m.bonds.length === 1 ? "" : "s"}`;
const moleculeName = () => {
  const M = st.art.molecule;
  return M ? M.name || M.smiles : "";
};

// ---------- the Molecule card ----------
async function moleculeUse(query) {
  $("molMsg").textContent = window.initRDKitModule ? "Laying it out…" : "Loading the chemistry toolkit (once, ~7 MB)…";
  $("molGo").disabled = true;
  try {
    const r = await moleculeLookup(query);
    artUseMolecule({ query, ...r }); // art.js
    $("molMsg").textContent = molAtomsBonds(r.mol) + (r.name ? ` · ${r.smiles}` : "");
    recordSoon();
  } catch (e) {
    $("molMsg").textContent = "Couldn't draw it: " + ((e && e.message) || e);
  } finally {
    $("molGo").disabled = false;
  }
}
function moleculeExample(key) {
  const e = MOL_EXAMPLES.find((x) => x.key === key);
  if (!e) return false;
  $("molIn").value = e.name.toLowerCase();
  moleculeWikiLink();
  artUseMolecule({ query: e.name, name: e.name, smiles: e.smiles, mol: molOf(e) });
  $("molMsg").textContent = `${e.name}${e.what ? `, ${e.what}` : ""}: ${e.atoms.length} atoms`;
  return true;
}
// The Molecule card as the design has it (a design undone, redone or opened: art.js artRestore): what was typed, and
// what it is.
function moleculeUI() {
  const M = st.art.molecule;
  if (!M || !M.mol) {
    $("molMsg").textContent = "";
    return;
  }
  const e = MOL_EXAMPLES.find((x) => x.name === M.name && x.smiles === M.smiles);
  $("molIn").value = e ? e.name.toLowerCase() : M.query && M.query !== "drawn" ? M.query : M.smiles || "";
  moleculeWikiLink();
  $("molMsg").textContent = e
    ? `${e.name}${e.what ? `, ${e.what}` : ""}: ${e.atoms.length} atoms`
    : molAtomsBonds(M.mol) + (M.smiles ? ` · ${M.smiles}` : "");
  moleculeTurnUI();
}
// the tip's Wikipedia link: the page for what's typed (a name), or the search page
function moleculeWikiLink() {
  const q = $("molIn").value.trim(),
    // (a name: lower-case words, not only the letters and signs a SMILES is written in)
    name = !!q && /[a-z]{3}/.test(q) && !/^[BCNOPSFIHKbcnopsilr0-9()=#@+\-[\]\/\\%.]+$/.test(q);
  $("molWiki").href = name
    ? "https://en.wikipedia.org/wiki/Special:Search?search=" + encodeURIComponent(q)
    : "https://en.wikipedia.org/wiki/Special:Search";
  $("molWiki").textContent = name ? `Find ${q} on Wikipedia` : "Find it on Wikipedia";
}
$("molIn").addEventListener("input", moleculeWikiLink);
$("molForm").addEventListener("submit", (e) => {
  e.preventDefault();
  moleculeUse($("molIn").value);
});
for (const e of MOL_EXAMPLES) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip-btn";
  b.dataset.mol = e.key;
  b.textContent = e.name;
  if (e.what) b.title = e.what;
  b.addEventListener("click", () => {
    moleculeExample(e.key);
    recordSoon();
  });
  $("molChips").appendChild(b);
}

// ---------- printing in pieces (pieces.js): the bonds as one piece, each atom's label as a piece of its own ----------
// the molecule prints in pieces: a printer, labels to print apart, and the Plate card says so
function moleculePiecesOn() {
  const { r } = st.art.kind === "molecule" ? moleculeDrawn() : { r: null };
  // (and the line traced: the pieces take its scale, px per mm)
  return !!r && r.labels > 0 && !artForPlot() && $("molPieces").value === "apart" && st.bw > 0 && st.outW > 0;
}
// each piece as a region of the working image W (pipeline.js working): its strokes drawn a little wider than they
// are drawn for the trace, so the line map found there is the piece's own. Bonds first, then the labels in atom order.
function moleculeRegions(W) {
  const { r, L } = moleculeDrawn();
  if (!r) return [];
  const groups = new Map();
  r.owner.forEach((o, i) => {
    if (!groups.has(o)) groups.set(o, []);
    groups.get(o).push(i);
  });
  const { sx, sy, kx, ky } = W.crop,
    lw = Math.max(3, L.lineWidth * kx * 1.6),
    A = st.art.molecule.mol.atoms,
    out = [];
  for (const [o, idx] of [...groups].sort((p, q) => p[0] - q[0])) {
    const c = document.createElement("canvas");
    c.width = W.w;
    c.height = W.h;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.strokeStyle = "#000";
    g.lineWidth = lw;
    g.lineCap = g.lineJoin = "round";
    for (const i of idx) {
      const p = r.paths[i];
      g.beginPath();
      for (let k = 0; k < p.length; k += 2) {
        const x = ((p[k] + L.m) * L.s - sx) * kx,
          y = ((p[k + 1] + L.m) * L.s - sy) * ky;
        k ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    const d = g.getImageData(0, 0, W.w, W.h).data,
      mask = new Uint8Array(W.w * W.h);
    for (let i = 0; i < mask.length; i++) mask[i] = d[4 * i + 3] > 40 ? 1 : 0;
    const a = o >= 0 ? A[o] : null;
    out.push({ name: a ? `${a.el}${a.h ? "H" + (a.h > 1 ? a.h : "") : ""}` : "bonds", mask });
  }
  return out;
}
$("molPieces").addEventListener("change", () => {
  pieceMenuUI(); // pieces.js
  drawPlate();
  drawMini();
  layersSoon(0);
  readyUI();
});

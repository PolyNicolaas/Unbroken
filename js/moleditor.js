// Unbroken · web app · moleditor.js
// The structure editor (the Molecule card's Draw or edit…): a structure drawn by hand, or the one shown changed, on
// the preview (full screen on a phone). Touch first: tap a space for an atom, drag from an atom for a bond, tap a bond
// to make it double or triple; rings tapped onto a space, an atom or a bond; an element (or a charge) tapped onto an
// atom; Erase; Undo; Clean up (RDKit's layout). The chemistry and geometry are the engine's (16-molecule.js).
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const me = {
  mol: null, // the structure being drawn ({ atoms, bonds }, RDKit's units, y up)
  undo: [],
  view: null, // { k (px per unit), ox, oy } in CSS px
  down: null, // the press: { x, y (CSS px), hit, moved }
  name: null, // the name it had when opened (kept while it's unchanged)
  smiles: null,
};
const meTool = () => document.querySelector('input[name="meTool"]:checked').value;
const meEl = () => document.querySelector('input[name="meEl"]:checked').value;
const meEmpty = () => ({ atoms: [], bonds: [] });

// ---------- opening and closing ----------
function molEditOpen() {
  const M = st.art.molecule;
  me.mol = M && M.mol ? UNB.molHydrogens(M.mol) : meEmpty();
  me.name = M ? M.name : null;
  me.smiles = M ? M.smiles : null;
  me.undo = [];
  $("molEd").hidden = false;
  document.body.dataset.moled = "1";
  $("meTbond").checked = true;
  $("meEC").checked = true;
  $("viewArt").checked = true;
  viewChanged();
  // a phone's pinned preview is small to draw on: the big one (scroll.js)
  if (innerWidth < 900 && document.body.dataset.pv !== "big") $("pvSize").click();
  requestAnimationFrame(() => {
    meFit();
    meDraw();
  });
  meSay();
}
function molEditClose() {
  $("molEd").hidden = true;
  document.body.dataset.moled = "";
  me.down = null;
}
function meSay(t) {
  $("meMsg").textContent =
    t ||
    (me.mol.atoms.length
      ? `${me.mol.atoms.length} atoms, ${me.mol.bonds.length} bonds`
      : "Tap to place a carbon; drag from an atom to draw a bond; or pick a ring and tap.");
}

// ---------- the view: world (RDKit's units, y up) ↔ the canvas (CSS px) ----------
function meFit() {
  const c = $("meView"),
    W = c.clientWidth,
    H = c.clientHeight,
    A = me.mol.atoms;
  if (!A.length) {
    me.view = { k: 44, ox: W / 2, oy: H / 2 };
    return;
  }
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const a of A) {
    x0 = Math.min(x0, a.x);
    x1 = Math.max(x1, a.x);
    y0 = Math.min(y0, a.y);
    y1 = Math.max(y1, a.y);
  }
  // a bond at most ~70 px, the whole in the middle 70%
  const k = Math.min(70 / 1.5, (0.7 * W) / Math.max(1e-6, x1 - x0), (0.7 * H) / Math.max(1e-6, y1 - y0));
  me.view = { k, ox: W / 2 - ((x0 + x1) / 2) * k, oy: H / 2 + ((y0 + y1) / 2) * k };
}
const meToScreen = (x, y) => [me.view.ox + x * me.view.k, me.view.oy - y * me.view.k];
const meToWorld = (x, y) => [(x - me.view.ox) / me.view.k, (me.view.oy - y) / me.view.k];
const meXY = (e) => {
  const r = $("meView").getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
};

// ---------- drawing ----------
function meDraw() {
  const c = $("meView"),
    dpr = devicePixelRatio || 1,
    W = c.clientWidth,
    H = c.clientHeight;
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
  }
  const g = c.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const A = me.mol.atoms,
    ink = css("--ink"),
    accent = css("--accent");
  // the skeletal formula, as it will be drawn (UNB.molecule: bond lengths, from its own corner) placed by atom 0
  if (A.length) {
    const r = UNB.molecule(me.mol, { font: UNB_FONTS.sans }),
      unit = me.mol.bonds.length ? UNB.molBondLength(me.mol) : 1;
    if (r) {
      const [ax, ay] = r.at[0],
        wx = (dx) => A[0].x + (dx - ax) * unit,
        wy = (dy) => A[0].y - (dy - ay) * unit;
      g.strokeStyle = ink;
      g.lineWidth = 2;
      g.lineCap = g.lineJoin = "round";
      for (const p of r.paths) {
        g.beginPath();
        for (let i = 0; i < p.length; i += 2) {
          const [x, y] = meToScreen(wx(p[i]), wy(p[i + 1]));
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      }
    }
    // each carbon a faint dot (what a tap or a drag starts from)
    g.fillStyle = accent;
    g.globalAlpha = 0.35;
    for (const a of A)
      if (a.el === "C") {
        const [x, y] = meToScreen(a.x, a.y);
        g.beginPath();
        g.arc(x, y, 3.5, 0, 2 * Math.PI);
        g.fill();
      }
    g.globalAlpha = 1;
  }
  // a bond being dragged out
  const d = me.down;
  if (d && d.moved && d.target) {
    g.strokeStyle = accent;
    g.lineWidth = 2;
    g.setLineDash([6, 4]);
    g.beginPath();
    g.moveTo(...d.from);
    g.lineTo(...d.target);
    g.stroke();
    g.setLineDash([]);
  }
}

// ---------- editing ----------
function meApply(mol, say) {
  me.undo.push(me.mol);
  if (me.undo.length > 200) me.undo.shift();
  me.mol = mol;
  me.name = null; // (changed: no longer the one looked up)
  me.smiles = null;
  // a structure growing past the edges: fitted again
  const W = $("meView").clientWidth,
    H = $("meView").clientHeight;
  if (
    mol.atoms.some((a) => {
      const [x, y] = meToScreen(a.x, a.y);
      return x < 20 || y < 20 || x > W - 20 || y > H - 20;
    })
  )
    meFit();
  meDraw();
  meSay(say);
}
const meReach = (e) => (e.pointerType === "mouse" ? 12 : 22) / me.view.k; // (px → units: what counts as a hit)
$("meView").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  $("meView").setPointerCapture(e.pointerId);
  const [x, y] = meXY(e),
    [wx, wy] = meToWorld(x, y),
    hit = UNB.molHit(me.mol, wx, wy, meReach(e));
  const from = hit && hit.atom != null ? meToScreen(me.mol.atoms[hit.atom].x, me.mol.atoms[hit.atom].y) : [x, y];
  me.down = { x, y, hit, moved: false, from, target: null, id: e.pointerId };
});
$("meView").addEventListener("pointermove", (e) => {
  const d = me.down;
  if (!d || e.pointerId !== d.id) return;
  const [x, y] = meXY(e);
  if (Math.hypot(x - d.x, y - d.y) > 8) d.moved = true;
  if (d.moved && meTool() === "bond") {
    d.target = [x, y];
    meDraw();
  }
});
const meUp = (e) => {
  const d = me.down;
  if (!d || (e && e.pointerId !== d.id)) return;
  me.down = null;
  const tool = meTool(),
    el = meEl(),
    charge = el === "+" ? 1 : el === "-" ? -1 : 0,
    element = charge ? "C" : el,
    [wx, wy] = meToWorld(...(d.target || [d.x, d.y])),
    hit = d.hit;
  const M = me.mol;
  if (tool === "erase") {
    if (hit) meApply(UNB.molErase(M, hit), "Erased");
    else meDraw();
    return;
  }
  if (tool !== "bond") {
    const n = tool === "ring5" ? 5 : 6,
      where = hit ? hit : { x: wx, y: wy };
    meApply(UNB.molRing(M, where, n, tool === "benzene"));
    return;
  }
  // the bond tool
  if (hit && hit.bond != null && !d.moved) return meApply(UNB.molCycleBond(M, hit.bond));
  if (hit && hit.atom != null) {
    const a = M.atoms[hit.atom];
    if (d.moved) return meApply(UNB.molGrow(M, hit.atom, [wx, wy], element).mol);
    if (charge) return meApply(UNB.molSetAtom(M, hit.atom, a.el, (a.q || 0) + charge));
    if (element !== a.el) return meApply(UNB.molSetAtom(M, hit.atom, element));
    return meApply(UNB.molGrow(M, hit.atom, null, "C").mol);
  }
  // a space: an atom there (and, dragged, a bond from it)
  if (charge) return meDraw();
  const [sx, sy] = meToWorld(d.x, d.y);
  let r = UNB.molGrow(M, null, [sx, sy], element);
  if (d.moved) r = UNB.molGrow(r.mol, r.atom, [wx, wy], "C");
  meApply(r.mol);
};
$("meView").addEventListener("pointerup", meUp);
$("meView").addEventListener("pointercancel", () => {
  me.down = null;
  meDraw();
});
// a finger on the editor never scrolls the page
for (const ev of ["touchstart", "touchmove"])
  $("meView").addEventListener(ev, (e) => e.preventDefault(), { passive: false });

// ---------- the buttons ----------
$("meUndo").addEventListener("click", () => {
  if (!me.undo.length) return;
  me.mol = me.undo.pop();
  meDraw();
  meSay();
});
$("meClear").addEventListener("click", () => {
  if (me.mol.atoms.length) meApply(meEmpty(), "Cleared: tap to start again");
});
$("meClean").addEventListener("click", async () => {
  if (!me.mol.atoms.length) return;
  meSay(window.initRDKitModule ? "Tidying…" : "Loading the chemistry toolkit (once, ~7 MB)…");
  try {
    const RD = await rdkit(); // molecule.js
    const m = RD.get_mol(UNB.molBlock(me.mol));
    if (!m || !m.is_valid()) throw new Error("RDKit couldn't read this structure");
    m.set_new_coords();
    const mol = UNB.molFromRDKit(m.get_json()),
      smiles = m.get_smiles();
    m.delete();
    meApply(mol, `Tidied · ${smiles}`);
    me.smiles = smiles;
    meFit();
    meDraw();
  } catch (e) {
    meSay("Couldn't tidy it: " + ((e && e.message) || e));
  }
});
$("meCancel").addEventListener("click", molEditClose);
$("meDone").addEventListener("click", () => {
  if (!me.mol.atoms.length) {
    meSay("Nothing drawn yet: tap to place an atom");
    return;
  }
  const M = st.art.molecule,
    same = M && M.mol && !me.undo.length;
  artUseMolecule({
    query: same ? M.query : "drawn",
    name: same ? M.name : me.name || "your structure",
    smiles: same ? M.smiles : me.smiles,
    mol: me.mol,
  }); // art.js
  $("molMsg").textContent =
    `${me.mol.atoms.length} atoms, ${me.mol.bonds.length} bonds` + (me.smiles ? ` · ${me.smiles}` : "");
  molEditClose();
  recordSoon();
});
$("molEdit").addEventListener("click", molEditOpen);
// (before the page's own keys: Ctrl/⌘ Z here undoes the drawing, not the design)
addEventListener(
  "keydown",
  (e) => {
    if ($("molEd").hidden) return;
    if (e.key === "Escape") molEditClose();
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.stopImmediatePropagation();
      $("meUndo").click();
    }
  },
  true
);
addEventListener("resize", () => {
  if (!$("molEd").hidden) meDraw();
});

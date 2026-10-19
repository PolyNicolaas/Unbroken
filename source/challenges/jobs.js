// Challenges: practical prints taken through the app the way a person would (load, set up, export), to find what
// gets in the way of real prints. Tests check that each feature does what it says; challenges check that the
// features together make a good print. Add new jobs as the app changes, aimed at what changed; keep the old ones,
// so each run is also a regression check of earlier finds.
//
// Each job: name, added (version), why (what it pushes on), file (in art/: an .svg drawing, rendered to a PNG first,
// or an .stl from models.js) or text ({ value, font }: the Text source), and the settings, as [selector, value] pairs:
//   trace  — Trace tab, before sizing (drawings only)
//   width  — the drawing's width in mm (drawings only)
//   choc   — 3D tab (#printHeightMM, #cutTop and #cutBottom are typed; #fillPattern is picked; the rest are set)
// expect (optional): readouts the job must show, as { id: regex }, e.g. { fillVal: /lines/ }.
module.exports = [
  // v84 (October 2026): the first challenge, three drawings and three models
  { name: "cup", added: "v84", why: "separate strokes (three steam wisps) joined into one line; small (50 mm), several copies",
    file: "cup.svg", width: 50, choc: [["#printHeightMM", 0.9], ["#copies", 4]] },
  { name: "mountains", added: "v84", why: "a filled base under a drawing with closed areas and open strokes; tilted to fit two",
    file: "mountains.svg", width: 80, choc: [["#printHeightMM", 1.2], ["#baseLayers", 2], ["#copies", 2]] },
  { name: "bicycle", added: "v84", why: "many junctions (frame, wheels, crank) in one line with no jumps",
    file: "bicycle.svg", width: 80, choc: [["#printHeightMM", 0.9], ["#copies", 2]] },
  { name: "star-vase", added: "v84", why: "a tall twisted model, outside only, open top; layers too short to set in time",
    file: "star-vase.stl", choc: [["#printHeightMM", 30], ["#copies", 1]] },
  { name: "heart", added: "v84", why: "a filled base and a lattice infill in a small model, two copies",
    file: "heart.stl", choc: [["#printHeightMM", 8], ["#baseLayers", 2], ["#fillDensity", 50], ["#copies", 2]], expect: { fillVal: /50% lines/ } },
  { name: "heart-sparse", added: "v84", why: "Lines infill at 25% in a narrow model: a ring and no rows until v92; now rows in both lobes, their ends a line spacing from the ring",
    file: "heart.stl", choc: [["#printHeightMM", 8], ["#baseLayers", 2], ["#fillDensity", 25], ["#copies", 1]] },
  { name: "pawn", added: "v84", why: "a domed top cut off, rings infill, a thin neck",
    file: "pawn.stl", choc: [["#printHeightMM", 30], ["#cutTop", 4], ["#fillDensity", 20], ["#fillPattern", "rings"], ["#copies", 1]], expect: { cutInfo: /prints 26\.0 of 30\.0 mm/ } },
  // v85: support (overhangs held up by the print's own wall, from the plate)
  { name: "pawn-skirt", added: "v85", why: "the pawn's collar and head reach out up to 0.6 mm a layer: a flared skirt under them",
    file: "pawn.stl", choc: [["#printHeightMM", 30], ["#cutTop", 4], ["#support", "skirt"]], expect: { readyList: /Support \(flared skirt\)/ } },
  { name: "mushroom", added: "v85", why: "a wide cap on a thin stem, no support: the ready list must warn",
    file: "mushroom.stl", choc: [["#printHeightMM", 22]], expect: { readyList: /Overhang: a layer steps out/ } },
  { name: "mushroom-skirt", added: "v85", why: "the cap held up by a flared skirt",
    file: "mushroom.stl", choc: [["#printHeightMM", 22], ["#support", "skirt"]] },
  { name: "tee-skirt", added: "v85", why: "a flat arm out from a post: a bridge, the skirt fans out under both sides",
    file: "tee.stl", choc: [["#printHeightMM", 20], ["#support", "skirt"]] },
  // v86: support on one side only (a letter standing up)
  { name: "r", added: "v86", why: "a lowercase r: the arm reaches out 7 mm on one side only, no support (must warn)",
    file: "letter-r.stl", choc: [["#printHeightMM", 16]], expect: { readyList: /Overhang: a layer steps out/ } },
  { name: "r-skirt", added: "v86", why: "the r's arm on a flared skirt: a brace back into the stem at the overhang slope, the arm's full depth",
    file: "letter-r.stl", choc: [["#printHeightMM", 16], ["#support", "skirt"]] },
  { name: "r-flat", added: "v86", why: "the same r lying flat: no overhang, no support needed",
    file: "letter-r-flat.stl", choc: [["#printHeightMM", 5]], expect: { readyList: /No overhang past/ } },
  { name: "r-thin", added: "v88", why: "the r's arm on a thin wall: one narrow loop wide from the plate, into the stem, flaring out under the arm (replaced the straight wall, which made the r a block)",
    file: "letter-r.stl", choc: [["#printHeightMM", 16], ["#support", "thin"]], expect: { readyList: /Support \(thin wall\)/ } },
  { name: "tee-thin", added: "v88", why: "the T's arms on a thin wall each, flaring out under the arms",
    file: "tee.stl", choc: [["#printHeightMM", 20], ["#support", "thin"]] },
  { name: "pawn-thin", added: "v88", why: "the pawn on a thin wall (round: should match the flared skirt)",
    file: "pawn.stl", choc: [["#printHeightMM", 30], ["#cutTop", 4], ["#support", "thin"]] },
  { name: "mushroom-thin", added: "v88", why: "a round cap on a thin wall: the middle is the stem, so it should match the flared skirt",
    file: "mushroom.stl", choc: [["#printHeightMM", 22], ["#support", "thin"]] },
  // v88 set (dealer's choice): lettering, many stroke ends, dense loops, stacked overhangs, a handle, a split, a span
  { name: "birthday", added: "v88", why: "lettering: two lines in the joined script, 70 mm wide, a cake topper",
    text: { value: "Happy\nBirthday", font: "script" }, width: 70, choc: [["#textPieces", "one"], ["#printHeightMM", 0.9], ["#copies", 2]] },
  { name: "birthday-open", added: "v89", why: "the same lettering as an open line: flat layers, the needle stepping up at each end and tracing back",
    text: { value: "Happy\nBirthday", font: "script" }, width: 70, trace: [["#loopOpen", true]], choc: [["#textPieces", "one"], ["#printHeightMM", 0.9], ["#copies", 2]] },
  // v97: a text of several lines as a piece per line (from the Suggestion box)
  { name: "birthday-pieces", added: "v97", why: "the birthday lettering with each line its own piece: Happy and Birthday print apart, two of each",
    text: { value: "Happy\nBirthday", font: "script" }, width: 70, choc: [["#printHeightMM", 0.9], ["#copies", 2]], expect: { readyList: /4 pieces on the plate, one for each line/ } },
  { name: "names", added: "v97", why: "five names of different lengths, a piece each, two sets: ten pieces of different sizes packed on one plate",
    text: { value: "Anna\nBen\nChloe\nDaniel\nEve" }, choc: [["#printHeightMM", 0.6], ["#copies", 2]], expect: { readyList: /10 pieces on the plate, one for each line/ } },
  { name: "snowflake", added: "v88", why: "six-way symmetry, a junction at every branch, 24 stroke ends to loop back from",
    file: "snowflake.svg", width: 60, choc: [["#printHeightMM", 1.2], ["#copies", 3]] },
  { name: "cat", added: "v88", why: "a face with six whiskers (loose ends) off a closed outline, eyes and a nose inside it",
    file: "cat.svg", width: 60, choc: [["#printHeightMM", 0.9], ["#copies", 2]] },
  { name: "mandala", added: "v88", why: "many closed loops (petals, rings, dots) under a filled base: a solid medallion",
    file: "mandala.svg", width: 70, choc: [["#printHeightMM", 1.5], ["#baseLayers", 2], ["#copies", 1]] },
  { name: "tree", added: "v88", why: "three cone tiers, each a wide overhang over the one below, on a thin trunk: a thin wall under each",
    file: "tree.stl", choc: [["#printHeightMM", 35], ["#support", "thin"]] },
  { name: "mug", added: "v88", why: "a cup with a D handle: a loop that leaves the body and comes back (an overhang and a hole)",
    file: "mug.stl", choc: [["#printHeightMM", 30], ["#baseLayers", 2], ["#support", "thin"]] },
  { name: "letter-y", added: "v88", why: "a standing Y: the trunk splits into two arms leaning out each side",
    file: "letter-y.stl", choc: [["#printHeightMM", 18], ["#support", "thin"]] },
  { name: "bridge", added: "v88", why: "a deck spanning 30 mm between two piers: an overhang from both ends meeting in the middle",
    file: "bridge.stl", choc: [["#printHeightMM", 16], ["#support", "thin"]] },
];

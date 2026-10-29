# Chemical structures · plan

## Asked 29 October 2026

Nicolaas (a chemist): "being able to make chemical structures would be really really cool. What if we have an input
which is drawing chemical structures?" Answers to the questions that day:

- **Typed in**: a name ("caffeine", "aspirin") or a SMILES string. **And drawn**: an editor in the app for structures
  that aren't in a database.
- **Drawn as a skeletal formula**: the textbook look. Bonds as lines (double and triple as parallel lines), carbons
  implied, hetero atoms (N, O, S, Cl …) as letters in the single-stroke font.

## How it fits

- A fifth input on the Art step: **Molecule**, beside Picture, Text, Pattern and 3D model. Like text and patterns it
  is exact lines: plotted as drawn (Trace off), or traced into one continuous line for chocolate.
- **SMILES → 2D layout**: RDKit (the standard chemistry toolkit; `@rdkit/rdkit` MinimalLib, WebAssembly, about 7 MB)
  from a CDN, loaded only when the Molecule input is first used. It parses the SMILES, adds 2D coordinates and gives a
  mol block (atoms, coordinates, bonds and their orders).
- **Name → SMILES**: PubChem's PUG REST (`/compound/name/<name>/property/IsomericSMILES/JSON`), which answers
  browsers directly (CORS open). Needs the internet; SMILES works without it once RDKit is cached.
- **The drawing** is the app's own (engine, no DOM): from atoms and bonds to strokes. Bonds shortened where they meet a
  label; a double bond in a ring drawn inside the ring, one outside a ring centred; triple bonds three lines; labels in
  the single-stroke font with their hydrogens (OH, NH₂ as subscripts drawn small); wedge and hash bonds later.
  Bond length is the size dial (mm), so the line spacing rules (needle, pen) apply as for text.
- **The editor** (second phase): touch first. Tap to add a carbon, drag from an atom to draw a bond, tap a bond to cycle
  single / double / triple, ring templates (benzene, cyclohexane, cyclopentane), an element strip (C N O S P F Cl Br I),
  erase; Clean up (RDKit's layout) tidies it. It edits the same structure the SMILES makes.

## Phases

| # | What | Version |
|---|---|---|
| 1 | Molecule input: a name or SMILES, laid out by RDKit, drawn as a skeletal formula; plotted as drawn or traced; a few examples (caffeine, aspirin, benzene, dopamine…) | v116 |
| 2 | The structure editor (atoms, bonds, rings, elements, erase, Clean up) | v117 |
| 3 | Ideas: stereo wedges and hashes, charges, a .mol / .sdf file, reaction arrows | – |

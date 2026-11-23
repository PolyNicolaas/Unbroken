# Picture pieces · plan (23 November 2026, v155)

A picture can be split into pieces, each traced as its own continuous line at the picture's own scale, and each
exported as **its own G-code file**. Found in the agent trial (AGENT-TRIAL.md): the Polimeks logo's mark traced far
better on its own (the thin ring came through whole, 1 connector), but two separate traces with Select area came out
at different scales, so the mark and the word wouldn't match in the same box.

Decided 23 November 2026:
- **Pieces are an option, never automatic.** A picture stays one line unless pieces are picked; the agent offers
  pieces as one of its options and helps choose them.
- **How close parts must be to join is a slider** (Join within, in mm).
- **Printing order doesn't matter.**
- **Each piece is its own G-code file.** No combined file and no "in place" set on one plate; the pieces only need to
  match in scale so they fit together in the box.

## What it does

- **Pieces: One line / Pieces** (a switch on the picture; One line is the default and works as today).
- **Finding the pieces**, two ways:
  - **Parts that don't touch**, grouped by the **Join within** slider (mm): parts closer than that stay one piece, so
    the letters of a word and the dot on an İ stay together while the mark above is another. The preview tags each
    piece (1, 2 …); tapping two tags merges them, tapping a merged piece splits it again.
  - **Drawn**: Select area gets **Add as a piece**; each box or freehand shape becomes a piece. Ink outside every
    shape is left out, as Select area does today.
- **One scale for every piece.** All pieces are traced from the same working image at the same pixels per mm (as text
  pieces already are), so Size sets the whole picture and every piece follows. No piece is resized on its own. A piece
  may still turn on the plate to fit, since it prints on its own.
- **One G-code file per piece**, each with its own copies on the plate: Export gives one zip with a file per piece,
  named after the design and the piece: `polimeks-1_084_1x-gcode`, `polimeks-2_084_1x-gcode` (or the piece's name
  once named, e.g. `polimeks-mark_…`). Copies apply to every piece (12 copies → 12 of each, in each file).

## Where it shows

- **Line step**: pieces in different tints, each with its own readout (terms · error · connectors), since each
  piece's quality differs. A **Piece** picker chooses which one the Print step's views show.
- **Ready list**: one line per piece with a problem (dropped thin parts, too small for the needle, doesn't fit the
  plate).
- **Agent**: "split into pieces" is one of the options it shows side by side, with the Join within value it used;
  `window.unbroken.status()` lists the pieces.

## How it's built

- **Engine** (so the CLI and the hosted worker can use it later, not just the page):
  - `UNB.pictureParts(working, { joinMM, ppm })`: the ink's parts, grouped by distance; returns a mask per piece and its
    bounding box.
  - `UNB.stagePieces(working, masks, settings)`: stageTrace + stagePrint per mask at one ppm; returns the same piece
    list `tracePieces()` builds for text (walk, final, fb, open, N, gap, crossings, name).
  - Export runs the existing one-design path (plate layout, layers, `UNB.exportGcode`) once per piece and zips the
    files together.
- **App**: `features/pieces/pieces.js` learns picture pieces next to a text's lines; the Plate card shows copies per
  piece; the Print step's views follow the Piece picker.
- **Saved design**: the Pieces switch, Join within, merges / splits, and drawn shapes, so a design opens with the same
  pieces.

## Tests

- **Engine**: the test logo (`source/tests/lib/fixtures/mark-and-word.svg`: a mark over a word, an İ-style dot
  included) gives 2 pieces at a middle Join within, more at a small one, 1 at the largest; each piece's line is one
  continuous line.
- **App**: the test logo with Pieces on → Export gives a zip with 2 G-code files; each is one continuous line per
  copy, on the plate; both pieces at the same scale (their sizes in mm match the picture's at that Size); 3 copies → 3
  in each file. Pieces off → one file, as today.

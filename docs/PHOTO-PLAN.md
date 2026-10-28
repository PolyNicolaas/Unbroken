# Take a picture · plan

## Decided 28 October 2026 (after v109)

Nicolaas wants a photo as an input: take a picture of a drawing, or anything else, with an iPad, and have it cleaned up
so it works on the plotter or the printers. Answers to the questions that day:

- **A live camera in the app**, not only the device's camera app: a viewfinder in the preview with a shutter and an
  outline of the page it finds, so the photo can be lined up before it's taken. (The device's camera or photos stay as
  the fallback when there's no live camera.)
- **Everything gets photographed**: drawings on paper, printed images and logos, and objects and people. So the cleanup
  has presets: Drawing, Printed, Object (and As taken).
- **Straightening: auto, with corners to drag.** The page's four corners are found and the photo flattened to a
  rectangle; a corner that's off can be dragged.

## How it fits

- Engine part `14-photo.js` (no DOM): find the page, flatten it, clean it. It runs in its own worker (`PHO`), so a
  photo never waits behind a trace. The live outline runs findPage on a 320 px frame on the page, about 3 times a second.
- The cleaned photo becomes the Picture (art.js `artUsePhoto`), with the photo it came from beside it, so the Photo card
  can clean it again; turning and straightening (the Picture card) apply after. Everything after that (Image prep,
  Grey levels, the trace, separate strokes, fills) is unchanged.
- Not kept in design files: the photo itself (a 12 MP original is too big); the cleaned picture is.

## Phases

| # | What | Version |
|---|---|---|
| 1 | Live camera with the page outlined; corners to drag; Drawing / Printed / Object / As taken; the Photo card; Clean up as a photo; the device's camera as a fallback | v110 ✓ |
| 2 | Ideas: a magnifier under the finger while dragging a corner; auto-take when the page holds still; colour ink kept for multi-pen plots | – |

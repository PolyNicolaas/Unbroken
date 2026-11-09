# The tidy-up

A recurring clean-up, so the code and the docs don't go stale or bloated between features (decided 9 November 2026).
It runs every Monday morning as a scheduled task, and can be run by hand any time ("tidy up Unbroken"). It follows
DESIGN.md's principles: build for the uses we have, one copy of each idea, delete rather than hide.

Last tidied: 9 November 2026 (v139): formatting, the shared segment and loop-start helpers, the web-app README's
file table, the test catalogue.

## 1 · Look

Run `node source/tools/tidy-report.js`. It changes nothing and reports:

- **Formatting**: files Prettier (120 characters, `.prettierrc.json`) would change.
- **Helpers defined twice**: an engine helper in two parts, an app function in two files.
- **Functions nothing calls**: public engine functions (`UNB.x`) and app functions no code, page or test mentions.
- **Long files**: over 1000 lines (a hint, not a rule).
- **Page reads**: `$("…")` per app file (DESIGN.md step 4), to see the trend.
- **Docs behind the code**: DESIGN.md's test counts and engine range, the web-app README's file table, core.js's
  header, the test catalogue, when ROADMAP.md was last sorted, the newest version.

## 2 · Fix (no need to ask: nothing a user sees changes)

- Formatting: `npx prettier@3 --write` on the files listed, then `node source/tools/wrap-comments.js` for the comments.
- Docs: the counts, tables and headers the report lists; the test catalogue (`node source/tests/run.js --doc`).
- A helper repeated in two engine parts: one copy in `00-util.js` (E25 checks the parts only share through it).
- The "Last tidied" line above.

## 3 · Propose (Nicolaas decides)

Listed in the report back, with what each one is for, and done only when he says so:

- Removing a function nothing calls, or a feature nobody uses: if it goes, a line in ROADMAP.md (Maybe later) says
  what use would bring it back.
- Splitting a long file by job; DESIGN.md steps 4 (read the controls once) and 6 (ES modules).
- Sorting the Suggestion box into ROADMAP.md, and closing what's done there (due when the report says so, every
  three weeks or so).

## 4 · Prove and hand over

- `node source/tests/run.js all` passes. A change meant not to change the output is checked with the challenges:
  `node source/challenges/run.js`, then `compare.js` against the run before (identical, file by file).
- Everything goes on a branch, `claude/tidy-<date>`, never straight onto main; Nicolaas merges it.
- The report back: what was fixed, what is proposed, and the test result. Nothing found means a one-line report and
  no branch.

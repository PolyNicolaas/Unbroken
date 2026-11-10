const fs = require("fs"), path = require("path");
const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const JS = path.join(__dirname, "../../../web-app/js");
// The features that should be able to go: the scripts that make each one, and how well the app does without it today.
//   0 the app breaks (no trace) · 1 it runs, with errors · 2 it runs clean (opens, traces, exports) · 3 clean, and
//   nothing of the feature is left on the page
// The record only goes up: when a feature does better than its record the test says so, and the record is raised here.
const FEATURES = {
  vase: { scripts: ["vase.js"], level: 2 },
  "3D model": { scripts: ["model.js", "vase.js"], level: 2 },
  "pen plotter": { scripts: ["plot.js"], level: 1 },
  patterns: { scripts: ["patterns.js"], level: 0 },
  molecule: { scripts: ["molecule.js", "moleditor.js"], level: 1 },
  "text as pieces": { scripts: ["pieces.js"], level: 1 },
  camera: { scripts: ["camera.js"], level: 2 },
  "cut-out": { scripts: ["cutout.js"], level: 0 },
  "grey levels": { scripts: ["levels.js"], level: 0 },
  optimize: { scripts: ["optimize.js"], level: 0 },
  "test print": { scripts: ["testprint.js"], level: 2 },
  "test matrix": { scripts: ["matrix.js"], level: 2 },
  examples: { scripts: ["examples.js", "sample-skull.js"], level: 0 },
};
// the parts of the page only this feature's scripts read: what's left behind when the scripts go
function ownIds(scripts) {
  const ids = (f) => new Set([...fs.readFileSync(path.join(JS, f), "utf8").matchAll(/\$\("([\w-]+)"\)/g)].map((m) => m[1]));
  const mine = new Set(scripts.flatMap((f) => [...ids(f)]));
  for (const f of fs.readdirSync(JS)) if (f.endsWith(".js") && !scripts.includes(f)) for (const id of ids(f)) mine.delete(id);
  return [...mine];
}
module.exports = {
  id: "A61", title: "Features switched off: how well the app does without each one (the modules' scoreboard)",
  guards: "a feature growing new ties to the rest of the app (the app breaking, or throwing errors, without a feature it used to do without), and the record of how modular the app is going stale",
  why: "Nicolaas (10 November 2026) wants the app modular: a feature added or taken out by switching its module on or off, for printers, pen plotters and clay printers. This is the measure of that, taken before the work: each feature's scripts are left out and the app is asked to open, trace and export. The record per feature only goes up.",
  how: "For each feature, opens the leaf with the feature's scripts loading as empty files; notes the page errors, whether the leaf traced, whether the Print step exports G-code, and how many parts of the page only that feature's scripts read are still there. Scores it 0 to 3 and compares with the record in this file.",
  pass: "Every feature scores at least its record (0 breaks · 1 runs with errors · 2 runs clean · 3 clean and nothing left on the page), and none scores above it without the record being raised; the scoreboard is in the notes.",
  slow: true, needs: ["browser"],
  async run(ctx) {
    const checks = [], board = [];
    for (const [name, F] of Object.entries(FEATURES)) {
      const { page, errors, close } = await A.open(ctx, { art: true, without: F.scripts }).catch(() => ({}));
      let traced = false, exported = false, left = 0;
      if (page) {
        await page.waitForTimeout(2500);
        traced = await page.evaluate(() => { try { return !!(st && st.final); } catch (e) { return false; } }).catch(() => false);
        if (traced) exported = await (async () => {
          await page.evaluate(() => { const id = mapShape().spine.at(-1); mapOpen(id); });
          await A.idle(page, 1500);
          const [d] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }), page.evaluate(() => $("gcodeBtn").click())]);
          return fs.readFileSync(await d.path(), "utf8").length > 1000;
        })().catch(() => false);
        left = await page.evaluate((ids) => ids.filter((i) => document.getElementById(i)).length, ownIds(F.scripts)).catch(() => -1);
        await close();
      }
      const n = (errors || []).length, level = !traced ? 0 : n || !exported ? 1 : left ? 2 : 3;
      board.push(`| ${name} | ${level} | ${F.level} | ${n} | ${traced ? "yes" : "no"} | ${exported ? "yes" : "no"} | ${left} |`);
      checks.push(check(`without ${name}: level (0 breaks, 1 errors, 2 clean, 3 nothing left)`, level, ">=", F.level));
      checks.push(check(`without ${name}: the record is up to date (levels above it)`, Math.max(0, level - F.level), "==", 0));
    }
    const total = board.reduce((t, r) => t + +r.split("|")[2], 0);
    return { checks, notes: `Scoreboard: ${total} of ${3 * board.length} (every feature at 3 = fully switchable)\n\n| without | level | record | page errors | traced | exported | its parts left on the page |\n|---|---|---|---|---|---|---|\n${board.join("\n")}` };
  },
};

const fs = require("fs"), path = require("path");
const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const APP = path.join(__dirname, "../../../web-app"), JS = path.join(APP, "js");
// The features (settings.js features, index.html feature(name, file)) and how well the app does without each today.
//   0 the app breaks (no trace) · 1 it runs, with errors · 2 it runs clean (opens, traces, exports) · 3 clean, and
//   nothing of the feature is left on the page
// The record only goes up: when a feature does better than its record the test says so, and the record is raised here.
const RECORD = { plotter: 3, model: 3, vase: 3, patterns: 3, molecule: 3, pieces: 3, camera: 3, cutout: 3, levels: 3, optimize: 3, testprint: 3, matrix: 3 };
// parts of the core's own cards that only one feature's scripts happen to read (it hides a row, renames a label):
// they stay when the feature is off, and aren't the feature's
const CORE_PARTS = ["loopClosed", "copiesLab", "modeRow", "sensRow", "modeOutline"];
// a feature's scripts, from the page
const SCRIPTS = {};
for (const m of fs.readFileSync(path.join(APP, "index.html"), "utf8").matchAll(/feature\("(\w+)", "js\/([\w-]+\.js)"\)/g)) (SCRIPTS[m[1]] ||= []).push(m[2]);
// the parts of the page only this feature's scripts read: what's left behind if they aren't marked as the feature's
function ownIds(scripts) {
  const ids = (f) => new Set([...fs.readFileSync(path.join(JS, f), "utf8").matchAll(/\$\("([\w-]+)"\)/g)].map((m) => m[1]));
  const mine = new Set(scripts.flatMap((f) => [...ids(f)]));
  for (const f of fs.readdirSync(JS)) if (f.endsWith(".js") && !scripts.includes(f)) for (const id of ids(f)) mine.delete(id);
  return [...mine].filter((id) => !CORE_PARTS.includes(id));
}
module.exports = {
  id: "A61", title: "Features switched off: how well the app does without each one (the modules' scoreboard)",
  guards: "a feature growing new ties to the rest of the app (the app breaking, or throwing errors, without a feature it used to do without), and the record of how modular the app is going stale",
  why: "Nicolaas (10 November 2026) wants the app modular: a feature added or taken out by switching its module on or off, for printers, pen plotters and clay printers. This is the measure of that, taken before the work: each feature's scripts are left out and the app is asked to open, trace and export. The record per feature only goes up.",
  how: "For each feature, opens the leaf with the feature switched off (?off=name in the address, as settings.js would); opens every step of the map, notes the page errors, whether the leaf traced, whether the Print step exports G-code, and how many parts of the page only that feature's scripts read are still there. Scores it 0 to 3 and compares with the record in this file.",
  pass: "With every feature off at once the leaf traces with no errors, the map is a printer's, the art a picture or a text, the examples the pictures and the lettering, and none of the features' parts are on the page. Every feature scores at least its record (0 breaks · 1 runs with errors · 2 runs clean · 3 clean and nothing left on the page), and none scores above it without the record being raised; the scoreboard is in the notes.",
  slow: true, needs: ["browser"],
  async run(ctx) {
    const checks = [], board = [];
    checks.push(check("the features in settings.js, the page and this record are the same", Object.keys(SCRIPTS).sort().join(","), "==", Object.keys(RECORD).sort().join(",")));
    for (const [name, record] of Object.entries(RECORD)) {
      const F = { scripts: SCRIPTS[name] || [], level: record };
      const { page, errors, close } = await A.open(ctx, { art: true, url: ctx.url + "?off=" + name }).catch(() => ({}));
      let traced = false, exported = false, left = 0;
      if (page) {
        await page.waitForTimeout(2500);
        traced = await page.evaluate(() => { try { return !!(st && st.final); } catch (e) { return false; } }).catch(() => false);
        // every step and chip of the map opened in turn (a card that reaches for a part that's gone throws here)
        if (traced) for (const id of await page.$$eval("#mapNodes .map-node:not([data-node=examples])", (els) => els.map((e) => e.dataset.node))) { await page.evaluate((id) => mapOpen(id), id); await A.idle(page, 400); }
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
    // the core alone: every feature off at once
    { const { page, errors, close } = await A.open(ctx, { art: true, url: ctx.url + "?off=" + Object.keys(RECORD).join(",") });
      await page.waitForTimeout(2500);
      const traced = await page.evaluate(() => !!(st && st.final)).catch(() => false);
      for (const id of await page.$$eval("#mapNodes .map-node:not([data-node=examples])", (els) => els.map((e) => e.dataset.node))) { await page.evaluate((id) => mapOpen(id), id); await A.idle(page, 400); }
      const shown = await page.evaluate(() => ({ spine: mapShape().spine.join(","), fors: document.querySelectorAll(".map-for").length, forShown: !document.querySelector(".map-top").hidden, kinds: [...document.querySelectorAll('input[name="srcType"]')].map((r) => r.value).join(","), examples: EXAMPLES.map((e) => e.key).join(","), left: document.querySelectorAll("[data-feature]").length }));
      checks.push(check("every feature off: the leaf traces, no errors", +traced * +!errors.length, "==", 1));
      checks.push(check("… the map is a printer's, with no choice of what it's for", shown.spine + "|" + shown.forShown, "==", "material,art,line,size,print|false"));
      checks.push(check("… the art can be a picture or a text", shown.kinds, "==", "picture,text"));
      checks.push(check("… the examples are the pictures and the lettering", shown.examples, "==", "leaf,still,face,shapes,smiley,lettering"));
      checks.push(check("… none of the features' parts on the page", shown.left, "==", 0));
      await close(); }
    const total = board.reduce((t, r) => t + +r.split("|")[2], 0);
    return { checks, notes: `Scoreboard: ${total} of ${3 * board.length} (every feature at 3 = fully switchable)\n\n| without | level | record | page errors | traced | exported | its parts left on the page |\n|---|---|---|---|---|---|---|\n${board.join("\n")}` };
  },
};

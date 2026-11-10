#!/usr/bin/env node
// Unbroken · feature-map.js
// Writes docs/FEATURES.md: for each feature (a module that can be switched off), where it lives and how it joins the
// app, read from the code itself so the page can't go stale. Run after adding or changing a feature:
//   node source/tools/feature-map.js
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../.."), WEB = path.join(ROOT, "web-app");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const html = read("web-app/index.html"), settings = read("web-app/settings.js"), state = read("web-app/js/state.js");
// what a test's file name says it's about, per feature
const TEST_WORDS = {
  plotter: ["plot"], model: ["model", "support", "slope"], vase: ["vase"], patterns: ["pattern", "geometric", "art-tab"],
  molecule: ["molecule"], pieces: ["pieces"], camera: ["camera", "photo"], cutout: ["cutout", "cut-out"],
  levels: ["levels"], optimize: ["optimi", "preset"], testprint: ["test-print", "testprint"], matrix: ["matrix"],
};
const tests = [...fs.readdirSync(path.join(ROOT, "source/tests/engine")), ...fs.readdirSync(path.join(ROOT, "source/tests/app"))].filter((f) => f.endsWith(".test.js"));
const names = Object.keys(JSON.parse("{" + (settings.match(/features: \{([\s\S]*?)\n  \},/)[1].match(/^\s*(\w+): (true|false)/gm) || []).map((l) => l.trim().replace(/^(\w+): (true|false)/, '"$1": $2')).join(",") + "}"));
const what = (n) => (settings.match(new RegExp("^\\s*" + n + ": (?:true|false),\\s*// (.*)$", "m")) || [])[1] || "";
const needs = (n) => (state.match(new RegExp(n + ": \\[([^\\]]*)\\]")) || [, ""])[1].replace(/"/g, "");
let out = `# The features

Written by \`source/tools/feature-map.js\` from the code (run it again after adding or changing a feature; don't edit
this file by hand). How modules work, and how to add one, is in DESIGN.md, Modules.

Each feature is a folder in \`web-app/features/\`, a line in \`web-app/settings.js\` (\`features\`), and the parts of
\`web-app/index.html\` marked \`data-feature="name"\`. To try the app without one, add \`?off=name\` to the address; to
work on one, its folder, its marked parts of the page and its tests are everything it is.

| Feature | What it is | Scripts | Lines | Parts of the page | Tests |
|---|---|---|---|---|---|
`;
const detail = [];
for (const n of names) {
  const dir = path.join(WEB, "features", n), files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".js")) : [];
  const src = files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")), all = src.join("\n");
  const lines = src.reduce((t, s) => t + s.split("\n").length, 0), parts = (html.match(new RegExp('data-feature="' + n + '"', "g")) || []).length;
  const mine = tests.filter((t) => (TEST_WORDS[n] || [n]).some((w) => t.toLowerCase().includes(w))).map((t) => t.slice(0, 3));
  const list = (re) => [...new Set([...all.matchAll(re)].map((m) => m[1]))];
  out += `| **${n}** | ${what(n)} | ${files.map((f) => "`" + f + "`").join(", ")} | ${lines} | ${parts} | ${mine.join(", ") || "A61"} |\n`;
  const joins = [
    ["examples", list(/addExample\(\d+, "([\w-]+)"/g)], ["steps and chips of the map", list(/addMapNode\("([\w-]+)"/g)],
    ["made for", list(/addOutput\("([\w-]+)"/g)], ["kinds of art", list(/addArtKind\("([\w-]+)"/g)],
    ["controls saved with a design", [String((all.match(/addSaved\(([^)]*)\)/g) || []).join(",").split('"').length >> 1)].filter((x) => x !== "0")],
    ["moments it answers", list(/\bon\("([\w:]+)"/g)], ["moments it announces", list(/\b(?:ask|answer)\("([\w:]+)"/g)],
  ].filter(([, v]) => v.length);
  detail.push(`### ${n}\n\n${what(n)}${needs(n) ? ` Needs: ${needs(n)}.` : ""}\n\n` + joins.map(([k, v]) => `- ${k}: ${v.join(", ")}`).join("\n"));
}
out += `\n## How each one joins the app\n\n${detail.join("\n\n")}\n`;
fs.writeFileSync(path.join(ROOT, "docs/FEATURES.md"), out);
console.log(`docs/FEATURES.md written: ${names.length} features`);

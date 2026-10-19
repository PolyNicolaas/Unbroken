const fs = require("fs"), path = require("path"), { check } = require("../lib/check.js");
module.exports = {
  id: "E25", title: "The engine's parts load in the same order everywhere, and share helpers only through 00-util.js",
  guards: "a part missing from the page or the worker, parts loaded in a different order in different places, and a part quietly using another part's private helper (which would break as soon as the files are reordered)",
  why: "The engine is split into one file per stage so problems are easy to find. The page loads the parts itself (index.html), a Web Worker and Node load them through core.js, and the build copies every file in source/engine. All three must agree, and each part must only use its own helpers, the public UNB functions, or the shared ones in 00-util.js.",
  how: "Reads the part list in core.js, the engine <script> tags in web-app/index.html and the files in source/engine. Then, for each part, collects its own top-level helper names and looks for them in every other part.",
  pass: "The three lists hold the same parts in the same order (core.js and index.html), every part file on disk is listed, and no part mentions another part's private helper by name.",
  async run() {
    const dir = path.resolve(__dirname, "../../engine");
    const core = fs.readFileSync(path.join(dir, "core.js"), "utf8"), parts = JSON.parse(core.match(/const PARTS = (\[[^\]]+\])/)[1].replace(/\s+/g, " ").replace(/,\s*\]$/, "]"));   // (a trailing comma, as the formatter writes it)
    const html = fs.readFileSync(path.resolve(__dirname, "../../../web-app/index.html"), "utf8");
    const page = [...html.matchAll(/<script src="\.\.\/source\/engine\/(\d\d-[\w-]+\.js)"><\/script>/g)].map((m) => m[1]);
    const onDisk = fs.readdirSync(dir).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
    // private helpers (a property key like { bbox: … } doesn't count as a use): top-level function / const / let declarations inside each part's wrapper (two-space indent)
    const src = Object.fromEntries(parts.map((p) => [p, fs.readFileSync(path.join(dir, p), "utf8")]));
    const own = Object.fromEntries(parts.map((p) => [p, [...src[p].matchAll(/^  (?:function\*?\s+(\w+)|(?:const|let)\s+(\w+)\s*=)/gm)].map((m) => m[1] || m[2]).filter((n) => !["UNB", "U"].includes(n))]));
    const leaks = [];
    for (const p of parts) for (const name of own[p]) for (const q of parts) {
      if (q === p) continue;
      const code = src[q].replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      const imported = new RegExp(`\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=\\s*UNB\\._u`).test(src[q]);   // taken from the shared helpers on purpose
      if (!imported && new RegExp(`(?<![\\w.])${name}\\b(?!\\s*:)`).test(code) && !new RegExp(`^  (?:function\\*?\\s+${name}\\b|(?:const|let)\\s+${name}\\b)`, "m").test(src[q])) leaks.push(`${name} (${p}) used in ${q}`);
    }
    return { checks: [
      check("index.html loads the parts in core.js's order", +(JSON.stringify(page) === JSON.stringify(parts)), "==", 1),
      check("every part file on disk is listed in core.js", +(JSON.stringify(onDisk) === JSON.stringify([...parts].sort())), "==", 1),
      check("private helpers used by another part", leaks.length, "==", 0),
    ], notes: leaks.length ? leaks.join("  \n") : `${parts.length} parts: ${parts.join(", ")}` };
  },
};

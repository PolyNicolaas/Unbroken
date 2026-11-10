const fs = require("fs");
const { appScripts } = require("../lib/scripts.js"), { check } = require("../lib/check.js");
// names a core script and a feature script both happen to use for their own local things
const LOCALS = ["drag", "pad", "me"];
// a feature may use another's names only when it needs it (state.js FEATURE_NEEDS) or checks it's there first
const MAY_USE = { vase: ["model"], pieces: ["molecule"], molecule: ["pieces"] };
const code = (file) => fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
const names = (file) => [...fs.readFileSync(file, "utf8").matchAll(/^(?:async\s+)?function\s+(\w+)|^(?:const|let|var)\s+(\w+)/gm)].map((m) => m[1] || m[2]);
module.exports = {
  id: "E58", title: "The core doesn't name a feature, and features keep to themselves",
  guards: "a core script calling a feature's function by name (the app would break with that feature off), and one feature leaning on another without saying so",
  why: "A feature is a module (DESIGN.md, Modules): it adds itself to the core's lists and answers the moments the core announces (state.js). The moment a core script calls a feature's function directly, that feature can't be switched off any more; A61 would catch it in a browser, this catches it at once and says where.",
  how: "Reads every script of the app. Lists the top-level names each feature's scripts define; searches the core's scripts (comments and strings left out) for them, and each feature's scripts for another feature's names.",
  pass: "No core script uses a name a feature's script defines; no feature uses another's names except the ones it's allowed (the vase needs the model; a text's pieces and the molecule know of each other).",
  async run() {
    const all = appScripts(), feats = [...new Set(all.filter((x) => x.feature).map((x) => x.feature))], own = {}, bad = [], cross = [];
    for (const f of feats) own[f] = new Set(all.filter((x) => x.feature === f).flatMap((x) => names(x.file)).filter((n) => !LOCALS.includes(n)));
    for (const x of all) {
      const body = code(x.file);
      for (const f of feats) {
        if (f === x.feature) continue;
        for (const n of own[f]) if (new RegExp("\\b" + n + "\\b").test(body)) {
          if (!x.feature) bad.push(`${x.name} uses ${f}'s ${n}`);
          else if (!(MAY_USE[x.feature] || []).includes(f)) cross.push(`${x.feature}/${x.name} uses ${f}'s ${n}`);
        }
      }
    }
    return { checks: [
      check("features found", feats.length, ">=", 12),
      check("core scripts that name a feature", bad.length, "==", 0),
      check("features that use another's names unasked", cross.length, "==", 0),
    ], notes: [...bad, ...cross].join("  \n") };
  },
};

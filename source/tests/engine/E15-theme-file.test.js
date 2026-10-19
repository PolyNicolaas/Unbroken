const fs = require("fs"), path = require("path"), { check } = require("../lib/check.js");
const WEB = path.resolve(__dirname, "../../../web-app");
module.exports = {
  id: "E15", title: "The theme file defines everything the app draws with",
  guards: "a renamed or deleted colour in theme.css leaving parts of the app unstyled",
  why: "theme.css holds every colour, font and the corner / text / spacing dials, and is meant to be edited by hand. If a name the styles or the preview use goes missing, that part silently falls back to black or transparent; if the two dark-mode blocks drift apart, dark mode looks different depending on how it was switched on.",
  how: "Reads theme.css, app.css and the app's scripts; lists every theme name they use (var(--…) in the styles, any \"--…\" name in the scripts) and checks each is defined in theme.css; checks the two dark-mode blocks set the same names to the same values; and checks the three dials are numbers.",
  pass: "Every name used is defined in theme.css; both dark-mode blocks are identical; --corner, --text and --space are plain numbers.",
  async run() {
    const theme = fs.readFileSync(path.join(WEB, "css/theme.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""), app = fs.readFileSync(path.join(WEB, "css/app.css"), "utf8");
    const js = fs.readdirSync(path.join(WEB, "js")).map((f) => fs.readFileSync(path.join(WEB, "js", f), "utf8")).join("\n");
    const defined = new Set([...theme.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const appOwn = new Set([...app.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));            // names app.css defines for itself
    const used = new Set([...[...app.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]), ...[...js.matchAll(/"(--[a-z][\w-]*)"/g)].map((m) => m[1])]);
    const missing = [...used].filter((n) => !defined.has(n) && !appOwn.has(n));
    const blocks = [...theme.matchAll(/:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/g), ...theme.matchAll(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/g)].map((m) => m[1].replace(/\s+/g, " ").trim());
    const dial = (n) => { const m = theme.match(new RegExp(`${n}\\s*:\\s*([^;]+);`)); return m && /^\d+(\.\d+)?$/.test(m[1].trim()); };
    return { checks: [
      check("names used but not defined", missing.length, "==", 0), check("theme names used by the app", used.size, ">", 20),
      check("dark-mode blocks found", blocks.length, "==", 2), check("dark-mode blocks identical", +(blocks.length === 2 && blocks[0] === blocks[1]), "==", 1),
      check("--corner, --text, --space are numbers", +(dial("--corner") && dial("--text") && dial("--space")), "==", 1),
    ], notes: missing.length ? "Not defined: " + missing.join(", ") : `${used.size} names used, all defined` };
  },
};

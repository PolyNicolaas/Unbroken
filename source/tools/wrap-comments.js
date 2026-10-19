// Wraps comments to 120 characters, which the formatter (prettier, .prettierrc.json) leaves alone: a long // comment
// line is split at a word, a long trailing comment moves onto its own line(s) above its code, and long lines of a
// /* */ block are split. Code and strings are never touched.
//   node source/tools/wrap-comments.js file.js …
const fs = require("fs"), MAX = 120;

// where a // comment starts on a line, outside strings (−1: none). Tracks quotes and backticks on the line only.
function commentAt(line, inTemplate) {
  let q = inTemplate ? "`" : null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "/" && line[i + 1] === "/" && (i === 0 || /\s/.test(line[i - 1]))) return i;
    if (c === "/" && line[i + 1] === "*") return -1;
  }
  return -1;
}
// does the line leave a template string open? (counts unescaped backticks outside other quotes)
function opensTemplate(line, inTemplate) {
  let q = inTemplate ? "`" : null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === "/" && line[i + 1] === "/") break;
    if (c === '"' || c === "'" || c === "`") q = c;
  }
  return q === "`";
}
// split text into lines no longer than width (words kept whole; a single long word stays on its own line)
function fill(text, width) {
  const out = []; let cur = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (cur && cur.length + 1 + w.length > width) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
  }
  if (cur) out.push(cur);
  return out;
}

for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, "utf8").split("\n"), out = [];
  let inTemplate = false, inBlock = false, changed = 0;
  for (const line of src) {
    if (inBlock || (!inTemplate && /^\s*\/\*/.test(line))) {          // a /* */ block: wrap its long lines, keeping their indent
      const ends = line.includes("*/");
      if (line.length > MAX && !ends && !/^\s*\/\*/.test(line)) {
        const ind = line.match(/^\s*/)[0];
        for (const l of fill(line.trim(), MAX - ind.length)) out.push(ind + l);
        changed++;
      } else out.push(line);
      inBlock = !ends; continue;
    }
    const at = line.length > MAX ? commentAt(line, inTemplate) : -1;
    if (at >= 0) {
      const code = line.slice(0, at).replace(/\s+$/, ""), text = line.slice(at + 2).trim();
      const ind = (code.trim() ? line : line).match(/^\s*/)[0];
      for (const l of fill(text, MAX - ind.length - 3)) out.push(`${ind}// ${l}`);
      if (code.trim()) out.push(code);
      changed++;
    } else out.push(line);
    inTemplate = opensTemplate(line, inTemplate);
  }
  if (changed) fs.writeFileSync(file, out.join("\n"));
  console.log(`${file}: ${changed} wrapped`);
}

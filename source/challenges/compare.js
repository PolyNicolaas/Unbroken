// Compares two challenge runs file by file: each job's G-code (the file inside the zip) and plotter SVG, by content.
// For changes that shouldn't change what the app makes (restructuring, renaming): every file must be identical.
//   node source/challenges/compare.js <run A> <run B> [--png]      (folders in source/challenges/results, or paths)
// --png also compares the screenshots byte for byte (for changes to how the views are drawn).
const fs = require("fs"), path = require("path"), crypto = require("crypto"), { execSync } = require("child_process");
const dir = (d) => (fs.existsSync(d) ? d : path.join(__dirname, "results", d));
const args = process.argv.slice(2), png = args.includes("--png"), [A, B] = args.filter((a) => a !== "--png").map(dir);
const hash = (f) => {
  if (!fs.existsSync(f)) return null;
  const data = f.endsWith(".zip") ? execSync(`unzip -p "${f}"`, { maxBuffer: 1 << 28 }) : fs.readFileSync(f);
  return crypto.createHash("sha1").update(data).digest("hex").slice(0, 12);
};
const files = new Set([...fs.readdirSync(A), ...fs.readdirSync(B)].filter((f) => (/-gcode\.zip$|\.svg$/.test(f) || (png && /\.png$/.test(f))) && !/-source/.test(f)));
let same = 0, diff = 0;
for (const f of [...files].sort()) {
  const a = hash(path.join(A, f)), b = hash(path.join(B, f));
  if (a && a === b) same++; else { diff++; console.log(`DIFFERS  ${f}  ${a || "missing"} → ${b || "missing"}`); }
}
console.log(`${same} identical, ${diff} different`);
process.exit(diff ? 1 : 0);

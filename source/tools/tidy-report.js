#!/usr/bin/env node
// Unbroken · tidy report: the checks of the recurring tidy-up (docs/TIDY.md), as one Markdown report.
// Usage: node source/tools/tidy-report.js [--json]
// Reads the code and the docs only (it changes nothing): formatting drift, helpers defined twice, functions nothing
// calls, long files, how much logic reads the page, and docs that have fallen behind the code. Each line says what
// it found; what to do about it is in docs/TIDY.md.
"use strict";
const fs = require("fs"),
  path = require("path"),
  { execSync } = require("child_process");
const ROOT = path.resolve(__dirname, "../.."),
  rel = (p) => path.relative(ROOT, p),
  read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8"),
  list = (dir, re) =>
    fs
      .readdirSync(path.join(ROOT, dir))
      .filter((f) => re.test(f))
      .sort()
      .map((f) => `${dir}/${f}`);
const ENGINE = list("source/engine", /^\d\d-.*\.js$/),
  APP = [
    ...list("web-app/js", /\.js$/),
    ...fs.readdirSync(path.join(ROOT, "web-app/features")).flatMap((n) => list(`web-app/features/${n}`, /\.js$/)),
  ],
  TESTS = [...list("source/tests/engine", /\.test\.js$/), ...list("source/tests/app", /\.test\.js$/)],
  noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const R = { date: new Date().toISOString().slice(0, 10), sections: [] };
const section = (title, rows, ok) => R.sections.push({ title, rows, ok });

// 1. formatting: Prettier at 120 (.prettierrc.json), if it can run here
{
  const files = [...ENGINE, "source/engine/core.js", ...APP, "web-app/build.js"];
  let rows = [],
    ok = true;
  try {
    execSync(`npx --yes prettier@3 --check ${files.join(" ")}`, { cwd: ROOT, stdio: "pipe" });
  } catch (e) {
    const out = String(e.stdout || "") + String(e.stderr || "");
    rows = [...out.matchAll(/\[warn\] (\S+\.js)/g)].map((m) => m[1]);
    if (!rows.length) rows = ["(Prettier couldn't run here: " + out.trim().split("\n")[0] + ")"];
    ok = false;
  }
  section("Formatting (Prettier, 120 characters)", rows.length ? rows : ["every file formatted"], ok);
}

// 2. engine: a helper defined in two parts (one copy of each idea); shared ones belong in 00-util.js
{
  const defs = new Map();
  for (const f of ENGINE)
    for (const m of read(f).matchAll(/^  (?:function\*?\s+(\w+)|(?:const|let)\s+(\w+)\s*=)/gm)) {
      const n = m[1] || m[2];
      if (["UNB", "U"].includes(n)) continue;
      defs.set(n, [...(defs.get(n) || []), path.basename(f)]);
    }
  const twice = [...defs].filter(([, fs]) => fs.length > 1).map(([n, fs]) => `${n}: ${fs.join(", ")}`);
  section("Engine helpers defined in more than one part", twice.length ? twice : ["none"], !twice.length);
}

// 3. app: a function defined in two files
{
  const defs = new Map();
  for (const f of APP)
    for (const m of read(f).matchAll(/^(?:async )?function\*?\s+(\w+)/gm))
      defs.set(m[1], [...(defs.get(m[1]) || []), path.basename(f)]);
  const twice = [...defs].filter(([, fs]) => fs.length > 1).map(([n, fs]) => `${n}: ${fs.join(", ")}`);
  section("App functions defined in more than one file", twice.length ? twice : ["none"], !twice.length);
}

// 4. unused: public engine functions (UNB.x) and app functions nothing else mentions (code, page or tests)
{
  const all = [...ENGINE, "source/engine/core.js", "source/engine/worker.js", ...APP, "web-app/index.html", ...TESTS]
    .concat(list("source/challenges", /\.js$/), list("source/bench", /\.js$/))
    .map((f) => [f, noComments(read(f))]);
  const uses = (name, home) => {
    let n = 0;
    for (const [f, code] of all) {
      const hits = (code.match(new RegExp(`(?<![\\w$])${name.replace(/\$/g, "\\$")}(?![\\w$])`, "g")) || []).length;
      n += f === home ? Math.max(0, hits - 1) : hits; // (its own definition doesn't count)
    }
    return n;
  };
  const unused = [];
  for (const f of ENGINE)
    for (const m of read(f).matchAll(/^\s*UNB\.(\w+)\s*=/gm))
      if (!uses(m[1], f)) unused.push(`UNB.${m[1]} (${path.basename(f)})`);
  for (const f of APP)
    for (const m of read(f).matchAll(/^(?:async )?function\*?\s+(\w+)/gm))
      if (!uses(m[1], f)) unused.push(`${m[1]} (${path.basename(f)})`);
  section(
    "Functions nothing calls (dead code, or called only by name from a string)",
    unused.length ? unused : ["none"],
    !unused.length
  );
}

// 5. size: long files are harder to find things in (a hint to split by job, not a rule)
{
  const long = [...ENGINE, ...APP, "web-app/index.html"]
    .map((f) => [f, read(f).split("\n").length])
    .filter(([, n]) => n > 1000)
    .sort((a, b) => b[1] - a[1])
    .map(([f, n]) => `${f}: ${n} lines`);
  section("Files over 1000 lines", long.length ? long : ["none"], true);
}

// 6. logic reading the page (DESIGN.md step 4): $("…") reads per app file, most first
{
  const reads = APP.map((f) => [path.basename(f), (read(f).match(/\$\("/g) || []).length])
    .filter(([, n]) => n >= 20)
    .sort((a, b) => b[1] - a[1])
    .map(([f, n]) => `${f}: ${n}`);
  section("Page reads per file, 20 or more (DESIGN.md step 4)", reads, true);
}

// 7. docs behind the code
{
  const rows = [],
    design = read("DESIGN.md"),
    roadmap = read("ROADMAP.md"),
    webReadme = read("web-app/README.md"),
    testsReadme = read("source/tests/README.md"),
    core = read("source/engine/core.js");
  const nE = TESTS.filter((t) => t.includes("/engine/")).length,
    nA = TESTS.length - nE,
    m = design.match(/\((\d+) engine\s+tests, (\d+) app tests/);
  if (!m || +m[1] !== nE || +m[2] !== nA)
    rows.push(
      `DESIGN.md says ${m ? `${m[1]} engine and ${m[2]} app` : "no count of the"} tests; there are ${nE} and ${nA}`
    );
  const lastEngine = path.basename(ENGINE[ENGINE.length - 1]);
  if (!design.includes(lastEngine)) rows.push(`DESIGN.md's engine range doesn't reach ${lastEngine}`);
  for (const f of APP)
    if (!webReadme.includes("`js/" + path.basename(f) + "`"))
      rows.push(`web-app/README.md's file table misses js/${path.basename(f)}`);
  for (const f of ENGINE)
    if (!core.includes(path.basename(f) + " ")) rows.push(`core.js's header misses ${path.basename(f)}`);
  for (const t of TESTS) {
    const id = path.basename(t).split("-")[0];
    if (!testsReadme.includes(`#### ${id}`))
      rows.push(`source/tests/README.md's catalogue misses ${id} (node source/tests/run.js --doc)`);
  }
  const sorted = roadmap.match(/Last sorted: (\d+ \w+ \d{4})/);
  if (sorted) {
    const days = Math.round((Date.now() - Date.parse(sorted[1])) / 864e5);
    rows.push(`ROADMAP.md last sorted ${sorted[1]} (${days} days ago)${days > 21 ? ": due" : ""}`);
  }
  const top = read("CHANGELOG.md").match(/^## (v[\d.]+) · (\d{4}-\d\d-\d\d)/m);
  if (top) rows.push(`newest version in CHANGELOG.md: ${top[1]} (${top[2]})`);
  section("Docs and the code", rows, !rows.some((r) => !/^ROADMAP.md last sorted .*ago\)$|^newest version/.test(r)));
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(R, null, 2));
  process.exit(0);
}
let md = `# Tidy report · ${R.date}\n\nWhat \`source/tools/tidy-report.js\` found; what to do with it is in docs/TIDY.md.\n`;
for (const s of R.sections)
  md += `\n## ${s.ok ? "✓" : "•"} ${s.title}\n\n` + s.rows.map((r) => `- ${r}`).join("\n") + "\n";
console.log(md);

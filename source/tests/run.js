#!/usr/bin/env node
// Test runner for Unbroken. Usage:
//   node run.js [engine|app|all|fast] [--quick] [--only E01,A03]   run tests (default: engine)
//   fast: the quick engine tests plus three app checks (about a minute): run it after every change, and all before publishing
//   node run.js --doc                                           rewrite the test catalogue in README.md from the tests
// Each test file exports { id, title, why, how, pass, slow, needs, run(ctx) }; run returns
// { checks: [{ name, value, limit, ok }], notes?, skip? }. A test passes when every check is ok.
const fs = require("fs"), path = require("path");
const args = process.argv.slice(2), flag = (f) => args.includes(f);
const area = ["engine", "app", "all", "fast"].find((a) => args.includes(a)) || "engine";
const FAST_APP = ["A01", "A12", "A19"];                         // opens and traces; every control reachable; the suggestion box
const only = (args[args.indexOf("--only") + 1] || "").split(",").filter((s) => args.includes("--only") && s);
const HERE = __dirname, RESULTS = path.join(HERE, "results");

function load(dir) {
  return fs.readdirSync(path.join(HERE, dir)).filter((f) => f.endsWith(".test.js")).sort().map((f) => ({ file: `${dir}/${f}`, ...require(path.join(HERE, dir, f)) }));
}
const ALL = [...load("engine"), ...load("app")];

// ---------- --doc: the catalogue section of README.md is generated from the test files ----------
if (flag("--doc")) {
  const last = fs.existsSync(path.join(RESULTS, "latest.json")) ? JSON.parse(fs.readFileSync(path.join(RESULTS, "latest.json"), "utf8")) : null;
  const time = (id) => { const r = last && last.tests.find((t) => t.id === id); return r && !r.skipped ? `${(r.ms / 1000).toFixed(1)} s` : "–"; };
  let md = "";
  for (const [label, prefix] of [["Engine tests", "E"], ["App tests", "A"]]) {
    md += `### ${label}\n\n| ID | Test | Guards against | Time |\n|---|---|---|---|\n`;
    for (const t of ALL.filter((t) => t.id.startsWith(prefix))) md += `| [${t.id}](#${t.id.toLowerCase()}) | ${t.title} | ${t.guards} | ${time(t.id)} |\n`;
    md += "\n";
  }
  for (const t of ALL) {
    md += `#### ${t.id}\n\n**${t.title}** · \`${t.file}\`${t.slow ? " · slow" : ""}${t.needs ? ` · needs ${t.needs.join(", ")}` : ""}\n\n`;
    md += `- **Why:** ${t.why}\n- **How:** ${t.how}\n- **Pass when:** ${t.pass}\n\n`;
  }
  const readme = path.join(HERE, "README.md"), s = fs.readFileSync(readme, "utf8"), a = "<!-- catalogue:start -->", b = "<!-- catalogue:end -->";
  fs.writeFileSync(readme, s.slice(0, s.indexOf(a) + a.length) + "\n\n" + md + s.slice(s.indexOf(b)));
  console.log(`Catalogue written: ${ALL.length} tests`); process.exit(0);
}

// ---------- run ----------
(async () => {
  let tests = area === "fast" ? ALL.filter((t) => (t.id.startsWith("E") && !t.slow) || FAST_APP.includes(t.id))
    : ALL.filter((t) => area === "all" || t.id.startsWith(area === "engine" ? "E" : "A"));
  if (only.length) tests = ALL.filter((t) => only.includes(t.id));
  if (flag("--quick")) tests = tests.filter((t) => !t.slow);
  const ctx = { quick: flag("--quick") };
  if (tests.some((t) => t.id.startsWith("A"))) {
    const { chromium } = require("playwright");
    const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
    const executablePath = process.env.UNB_CHROMIUM || (fs.existsSync(shell) ? shell : undefined);
    ctx.server = await require("./lib/server.js").start();
    const browser = await chromium.launch(executablePath ? { executablePath } : {}), realNew = browser.newContext.bind(browser), SETTLE = require("./lib/app.js").SETTLE;
    // every context a test opens gets the settle probe, and is closed after the test even when the test throws
    ctx.contexts = new Set();
    ctx.browser = { newContext: async (o) => { const c = await realNew(o); await c.addInitScript(SETTLE); ctx.contexts.add(c); c.on("close", () => ctx.contexts.delete(c)); return c; }, close: () => browser.close() };
    ctx.url = ctx.server.url + "/web-app/index.html";
  }
  const rows = [], started = new Date();
  console.log(`Unbroken tests · ${area}${flag("--quick") ? " (quick)" : ""} · ${tests.length} tests\n`);
  for (const t of tests) {
    const t0 = performance.now(); let res;
    process.stdout.write(`${t.id} ${t.title} … `);
    try { res = await t.run(ctx); } catch (e) { res = { checks: [{ name: "ran without an error", value: String(e && e.stack || e).split("\n").slice(0, 3).join(" | "), limit: "no error", ok: false }] }; }
    finally { if (ctx.contexts) for (const c of [...ctx.contexts]) await c.close().catch(() => {}); }   // nothing left running into the next test
    if (!res.skip && !(res.checks || []).length) res.checks = [{ name: "made at least one check", value: 0, limit: "> 0", ok: false }];   // a test that checks nothing doesn't pass
    const ms = performance.now() - t0, skipped = !!res.skip, ok = skipped || res.checks.every((c) => c.ok);
    rows.push({ id: t.id, title: t.title, ok, skipped, skip: res.skip, ms: Math.round(ms), checks: res.checks || [], notes: res.notes });
    console.log(skipped ? `SKIP (${res.skip})` : ok ? `PASS  ${(ms / 1000).toFixed(1)} s` : `FAIL  ${(ms / 1000).toFixed(1)} s`);
    for (const c of res.checks || []) if (!c.ok || flag("-v")) console.log(`    ${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.value} (limit ${c.limit})`);
  }
  if (ctx.browser) { await ctx.browser.close(); await ctx.server.close(); }
  const failed = rows.filter((r) => !r.ok), skipped = rows.filter((r) => r.skipped);
  console.log(`\n${rows.length - failed.length - skipped.length} passed · ${failed.length} failed · ${skipped.length} skipped · ${((Date.now() - started) / 1000).toFixed(0)} s`);
  // results: latest.json (machine) and latest.md (readable report with every measured value)
  fs.mkdirSync(RESULTS, { recursive: true });
  fs.writeFileSync(path.join(RESULTS, "latest.json"), JSON.stringify({ date: started.toISOString(), area, node: process.version, tests: rows }, null, 1));
  let md = `# Test report\n\n${started.toISOString().slice(0, 16).replace("T", " ")} UTC · ${area}${flag("--quick") ? " (quick)" : ""} · node ${process.version}\n\n` +
    `**${rows.length - failed.length - skipped.length} passed · ${failed.length} failed · ${skipped.length} skipped**\n\n| ID | Test | Result | Time |\n|---|---|---|---|\n`;
  for (const r of rows) md += `| ${r.id} | ${r.title} | ${r.skipped ? "skipped: " + r.skip : r.ok ? "pass" : "**FAIL**"} | ${(r.ms / 1000).toFixed(1)} s |\n`;
  md += "\n## Measured values\n";
  for (const r of rows) { if (r.skipped) continue; md += `\n### ${r.id} ${r.title}\n\n| Check | Value | Limit | |\n|---|---|---|---|\n`; for (const c of r.checks) md += `| ${c.name} | ${c.value} | ${c.limit} | ${c.ok ? "ok" : "**FAIL**"} |\n`; if (r.notes) md += `\n${r.notes}\n`; }
  fs.writeFileSync(path.join(RESULTS, "latest.md"), md);
  process.exit(failed.length ? 1 : 0);
})();

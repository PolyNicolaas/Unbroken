#!/usr/bin/env node
// Unbroken · web app · build.js
// Makes the publishable copy of the web app in web-app/dist/: one flat folder that works on its own
// (the engine files sit next to index.html instead of in ../source/engine/).
//
//   node web-app/build.js              run every test first; build only if they all pass
//   node web-app/build.js --quick      run the quick tests instead of the full suite
//   node web-app/build.js --no-tests   build without testing (marked "untested" in BUILD.txt)
//
// Steps: 1. tests  2. copy + rewrite paths  3. check every file the page loads is there  4. open the built
// copy in a headless browser and check it traces with its background workers  5. write dist/BUILD.txt.
// Stops at the first step that fails and leaves the previous dist/ untouched.
"use strict";
const fs = require("fs"), path = require("path"), http = require("http"), crypto = require("crypto");
const { spawnSync } = require("child_process");

const APP = __dirname, REPO = path.resolve(APP, ".."), ENGINE = path.join(REPO, "source/engine"), TESTS = path.join(REPO, "source/tests");
const DIST = path.join(APP, "dist"), TMP = path.join(APP, "dist.tmp");
const flag = (f) => process.argv.includes(f);
const step = (n, t) => console.log(`\n${n}. ${t}`);
const fail = (msg) => { console.error(`\nBuild stopped: ${msg}`); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(1); };

(async () => {
  // 1 ---------- tests
  let tested = "untested (--no-tests)";
  if (!flag("--no-tests")) {
    const quick = flag("--quick");
    step(1, `Tests (${quick ? "quick" : "full suite"})`);
    const r = spawnSync(process.execPath, ["run.js", "all", ...(quick ? ["--quick"] : [])], { cwd: TESTS, stdio: "inherit" });
    if (r.status !== 0) fail("tests failed. Fix them, or build with --no-tests to try something out.");
    const res = JSON.parse(fs.readFileSync(path.join(TESTS, "results/latest.json"), "utf8"));
    const pass = res.tests.filter((t) => t.ok && !t.skipped).length, skip = res.tests.filter((t) => t.skipped).length;
    tested = `${pass} of ${res.tests.length} tests passed${skip ? `, ${skip} skipped` : ""}${quick ? " (quick run)" : ""}`;
  } else step(1, "Tests skipped (--no-tests)");

  // the version: the newest heading in CHANGELOG.md ("## v65 · 2026-10-15")
  const top = (fs.readFileSync(path.join(REPO, "CHANGELOG.md"), "utf8").match(/^## (v\d+)\b/m) || [])[1];
  if (!top) fail("CHANGELOG.md needs a heading like \"## v65 · 2026-10-15\" at the top for this build's version");

  // 2 ---------- copy, flattening the engine paths
  step(2, "Copy into dist/");
  fs.rmSync(TMP, { recursive: true, force: true });
  const copy = (from, to, rewrite) => {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (!rewrite) return fs.copyFileSync(from, to);
    fs.writeFileSync(to, fs.readFileSync(from, "utf8").split("../source/engine/").join(""));
  };
  copy(path.join(APP, "index.html"), path.join(TMP, "index.html"), true);
  fs.writeFileSync(path.join(TMP, "index.html"), fs.readFileSync(path.join(TMP, "index.html"), "utf8").replace('id="appVersion" title="Version (CHANGELOG.md)">dev<', `id="appVersion" title="Version (CHANGELOG.md)">${top}<`));
  copy(path.join(APP, "settings.js"), path.join(TMP, "settings.js"));
  for (const dir of ["css", "js"]) for (const f of fs.readdirSync(path.join(APP, dir)))
    copy(path.join(APP, dir, f), path.join(TMP, dir, f), dir === "js");
  for (const f of fs.readdirSync(ENGINE).filter((f) => f.endsWith(".js"))) copy(path.join(ENGINE, f), path.join(TMP, f));   // every engine part, core.js, fonts.js, worker.js

  // 3 ---------- every file the page asks for exists, and nothing still points outside dist/
  step(3, "Check the page's files");
  const html = fs.readFileSync(path.join(TMP, "index.html"), "utf8");
  const refs = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https?:/.test(u));
  const missing = refs.filter((u) => !fs.existsSync(path.join(TMP, u)));
  if (missing.length) fail(`index.html loads files that aren't in dist/: ${missing.join(", ")}`);
  const outside = walk(TMP).filter((f) => /\.(html|js|css)$/.test(f) && fs.readFileSync(f, "utf8").includes("../source/"));
  if (outside.length) fail(`still pointing at ../source/: ${outside.map((f) => path.relative(TMP, f)).join(", ")}`);
  console.log(`   ${refs.length} files loaded by the page, all present`);

  // 4 ---------- open the built copy and let it trace
  step(4, "Open the built copy in a headless browser");
  const smoke = await smokeTest(TMP);
  if (smoke.error) fail(smoke.error);
  console.log(`   ${smoke.chip} · background engine ${smoke.worker ? "used" : "NOT used"} · no page errors`);
  if (!smoke.worker) fail("the built page didn't start its background engine (worker.js)");

  // 5 ---------- swap in, and record what was built
  const files = walk(TMP).map((f) => path.relative(TMP, f)).sort();
  const lines = [
    `Unbroken · web app build ${top}`,
    `Built:  ${new Date().toISOString()}`,
    `Tests:  ${tested}`,
    `Check:  opened and traced the sample: ${smoke.chip}`,
    "",
    "Files (sha1, first 12):",
    ...files.map((f) => `  ${crypto.createHash("sha1").update(fs.readFileSync(path.join(TMP, f))).digest("hex").slice(0, 12)}  ${f}`),
  ];
  fs.writeFileSync(path.join(TMP, "BUILD.txt"), lines.join("\n") + "\n");
  fs.rmSync(DIST, { recursive: true, force: true }); fs.renameSync(TMP, DIST);
  step(5, `Done: ${top} in web-app/dist/ (${files.length + 1} files). ${tested}.`);
})().catch((e) => fail(e.stack || String(e)));

function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)])); }

// Serve the folder over http (workers need it), open it in the test suite's headless Chromium, wait for the trace.
async function smokeTest(dir) {
  let chromium;
  try { ({ chromium } = require(require.resolve("playwright", { paths: [TESTS] }))); }
  catch { return { error: "Playwright isn't installed: run npm install in source/tests" }; }
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
  let worker = false;
  const srv = http.createServer((req, rsp) => {
    const p = path.join(dir, decodeURIComponent(req.url.split("?")[0]));
    if (p.endsWith("worker.js")) worker = true;
    if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
    rsp.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(rsp);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const exe = process.env.UNB_CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell") ? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell" : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  try {
    const page = await browser.newPage(), errors = [], missing = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("response", (r) => { if (r.status() === 404) missing.push(r.url()); });
    await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?example=leaf`); // (the app opens empty since v109: start on the leaf)
    let chip = "";
    // wait until the trace is finished: the readout shows terms and the "working" note stays off for 600 ms (max 60 s)
    for (let i = 0, calm = 0; i < 400 && calm < 4; i++) {
      await page.waitForTimeout(150);
      const busy = await page.evaluate(() => document.getElementById("chip").classList.contains("busy") || document.getElementById("box").classList.contains("working"));
      chip = (await page.textContent("#chip")) || "";
      calm = busy || !/\d+ terms/.test(chip) ? 0 : calm + 1;
    }
    if (missing.length) return { error: `the built page asked for files that aren't there: ${missing.join(", ")}` };
    if (errors.length) return { error: `the built page reported errors: ${errors.join(" | ")}` };
    if (!/\d+ terms/.test(chip)) return { error: `the built page didn't finish tracing the sample (shows "${chip}")` };
    return { chip: chip.trim(), worker };
  } finally { await browser.close(); srv.close(); }
}

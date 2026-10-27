// Runs the challenges (jobs.js) through the real app in a browser and writes a report: for each job its readouts,
// the ready list, the G-code read back move by move, screenshots, and the files a person would get.
//   node source/challenges/run.js               all jobs
//   node source/challenges/run.js cup,heart     only these
// Output: source/challenges/results/<date-time>/ (report.md, screenshots, G-code, SVGs). Exit code 1 when a job
// breaks (a page error, a ✗ in the ready list, an expected readout missing, or the G-code breaking a rule below);
// ⚠ lines are findings to look at, not failures.
const path = require("path"), fs = require("fs"), { execSync } = require("child_process");
const T = path.join(__dirname, "..", "tests"), req = (m) => require(path.join(T, "node_modules", m));
const A = require(path.join(T, "lib", "app.js")), { readGcode } = require(path.join(T, "lib", "gcode.js"));
const { chromium } = req("playwright");
const ART = path.join(__dirname, "art"), pick = (process.argv[2] || "").split(",").filter(Boolean);
const jobs = require("./jobs.js").filter((j) => !pick.length || pick.includes(j.name));
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"), OUT = path.join(__dirname, "results", stamp);
fs.mkdirSync(OUT, { recursive: true });

// The G-code rules every print must keep (the same as test A27, for any job)
function checkGcode(text, app) {
  const G = readGcode(text), M = G.moves, bad = [];
  const printing = M.filter((m) => m.section === "copy" && m.de > 0 && m.xy > 0 && !m.wiping), zs = printing.map((m) => m.z);
  let inside = 0; for (const c of G.copies) inside += M.slice(c.from, c.to).filter((m, i) => i > 2 && m.g === "G0").length;
  if (inside) bad.push(`${inside} travel move(s) inside a copy`);
  if (G.copies.length !== app.copies) bad.push(`${G.copies.length} copies in the file, ${app.copies} on the plate`);
  if (Math.abs(Math.min(...zs) - app.z) > 1e-6) bad.push(`first layer at ${Math.min(...zs)} mm, not ${app.z}`);
  let top = 0, low = Infinity; for (const m of M) { if (m.section === "copy" && m.g === "G0" && m.xy > 0) low = Math.min(low, m.z - top); if (m.section === "copy" && m.de > 0) top = Math.max(top, m.z); }
  if (low < app.lift - 1e-6) bad.push(`a travel only ${low.toFixed(2)} mm above the print`);
  const off = printing.filter((m) => m.x < 0 || m.y < 0 || m.x > app.bed[0] || m.y > app.bed[1]).length; if (off) bad.push(`${off} moves off the plate`);
  const fast = printing.filter((m) => m.f > app.feed + 1e-6).length; if (fast) bad.push(`${fast} moves faster than the set speed`);
  const D = printing.reduce((a, m) => a + m.dist, 0), t = M.filter((m) => m.section === "copy" && m.g === "G1").reduce((a, m) => a + m.dist / m.f * 60, 0);
  return { bad, copies: G.copies.length, layers: G.copies.map((c) => c.layers.length), zTop: Math.max(...zs), metres: D / 1000, minutes: t / 60 };
}

(async () => {
  execSync(`node "${path.join(__dirname, "models.js")}"`);                 // the STLs (made, not kept in the repo)
  const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", exe = process.env.UNB_CHROMIUM || (fs.existsSync(shell) ? shell : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {}), server = await require(path.join(T, "lib", "server.js")).start();
  const url = server.url + "/web-app/index.html", results = [];
  for (const j of jobs) {
    const r = { job: j, problems: [], warnings: [] }; results.push(r);
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, acceptDownloads: true }); await ctx.addInitScript(A.SETTLE);
    const page = await ctx.newPage(), errors = []; page.on("pageerror", (e) => errors.push(e.message));
    const shot = (what) => page.locator("#box").screenshot({ path: path.join(OUT, `${j.name}-${what}.png`) });
    const text = (id) => page.textContent("#" + id).catch(() => null);
    try {
      await page.goto(url); await A.idle(page);
      const model = /\.stl$/i.test(j.file || "");
      let file = j.file ? path.join(ART, j.file) : null;
      if (file && /\.svg$/i.test(file)) {                                         // render the drawing to a PNG, as a scan or export would be
        const svg = fs.readFileSync(file, "utf8"), [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/), p = await browser.newPage({ viewport: { width: +w, height: +h } });
        await p.setContent(`<body style="margin:0">${svg}</body>`); file = path.join(OUT, j.name + "-source.png"); await p.screenshot({ path: file }); await p.close();
      }
      if (model) { await A.source(page, "model"); await A.idle(page); }   // the Art tab: a model layer, or the text alone
      if (j.text) {                                          // typed text: the Text source, its words and font
        await A.source(page, "text"); await A.idle(page);
        if (j.text.font) await page.selectOption("#font", j.text.font);
        await page.fill("#textIn", j.text.value); await page.dispatchEvent("#textIn", "input"); await A.idle(page, 1500);
      } else { await page.setInputFiles("#anyFile", file); await A.idle(page, 1500); }
      await page.click("label[for=viewDesign]"); await A.idle(page);   // the tracing settings are on the Trace tab
      for (const [sel, v] of j.trace || []) {                // a radio or checkbox is clicked (by its label), anything else set
        if (await page.$eval(sel, (e) => e.type === "radio" || e.type === "checkbox")) { if (!!(await page.$eval(sel, (e) => e.checked)) !== !!v) await page.click(`label[for=${sel.slice(1)}]`); }
        else await A.setValue(page, sel, v);
        await A.idle(page);
      }
      if (!model && j.width) { await page.fill("#outW", String(j.width)); await page.press("#outW", "Enter"); await A.idle(page); }
      r.read = model ? { model: await text("modelInfo") } : { trace: await text("chip"), size: j.text ? `${await page.inputValue("#outW")} × ${await page.inputValue("#outH")} mm` : await text("sizeInfo"), spacing: await text("spacingHint") };   // (Text mode has no size readout: its boxes)
      await shot(model ? "model" : "trace");
      await page.click("label[for=viewChoc]"); await A.idle(page);
      for (const [sel, v] of j.choc || []) {
        if (/printHeightMM|cutTop|cutBottom/.test(sel)) { await page.fill(sel, String(v)); await page.press(sel, "Tab"); }
        else if (await page.$eval(sel, (e) => e.tagName === "SELECT")) await page.selectOption(sel, String(v));
        else await A.setValue(page, sel, v);
        await A.idle(page);
      }
      await A.idle(page);
      for (const id of ["layerInfo", "cutInfo", "infillVal", "fillVal", "cartHint", "layerHint"]) r.read[id] = await text(id);
      r.ready = await page.$$eval("#readyList li", (l) => l.map((x) => ({ lvl: x.className, text: x.textContent })));
      for (const it of r.ready) { if (it.lvl === "bad") r.problems.push("✗ " + it.text); else if (it.lvl === "warn") r.warnings.push("⚠ " + it.text); }
      for (const [id, re] of Object.entries(j.expect || {})) { const v = id === "readyList" ? r.ready.map((x) => x.text).join(" · ") : await text(id); if (!re.test(v || "")) r.problems.push(`expected #${id} to match ${re}, got "${v}"`); }
      const app = await page.evaluate(() => ({ z: +$("gZ").value, lift: +$("gLift").value, feed: +$("gFeed").value * 60, bed: [CFG.printer.bedWidth, CFG.printer.bedDepth], copies: placements(plateNow()).length }));
      await page.click("label[for=stLayers]"); await A.idle(page); await shot("layers");
      await page.click("label[for=stPlate]"); await A.idle(page); await shot("plate");
      const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#gcodeBtn")]); const zip = path.join(OUT, `${j.name}-gcode.zip`); await dl.saveAs(zip);
      r.g = checkGcode(execSync(`unzip -p "${zip}"`, { maxBuffer: 1 << 28 }).toString(), app); r.problems.push(...r.g.bad.map((b) => "G-code: " + b));
      if (!model) {                                                       // the pen plotter's file too
        await page.click("label[for=view2D]"); await A.idle(page);
        const [sv] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]); await sv.saveAs(path.join(OUT, `${j.name}.svg`)); await shot("page");
      }
    } catch (e) { r.problems.push("stopped: " + String(e.message || e).split("\n")[0]); }
    r.problems.push(...errors.map((e) => "page error: " + e));
    await ctx.close();
    console.log(`${r.problems.length ? "BREAKS" : r.warnings.length ? "WARN  " : "OK    "} ${j.name}${r.problems.length ? " · " + r.problems.join(" · ") : ""}${r.warnings.length ? " · " + r.warnings.join(" · ") : ""}`);
  }
  await browser.close(); await server.close();
  // report
  const ver = (fs.readFileSync(path.join(__dirname, "..", "..", "CHANGELOG.md"), "utf8").match(/^## (v\d+)/m) || [])[1] || "dev";
  let md = `# Challenge run · ${ver} · ${stamp.replace(/-(\d\d)-(\d\d)$/, " $1:$2")} UTC\n\n`;
  md += `| Job | Added | Result | Print |\n|---|---|---|---|\n`;
  for (const r of results) md += `| ${r.job.name} | ${r.job.added} | ${r.problems.length ? "**breaks**" : r.warnings.length ? "⚠ " + r.warnings.length : "ok"} | ${r.read ? r.read.layerInfo || "" : ""} |\n`;
  for (const r of results) {
    md += `\n## ${r.job.name}\n\n${r.job.why}\n\n`;
    if (r.problems.length) md += r.problems.map((p) => `- **${p}**`).join("\n") + "\n";
    if (r.warnings.length) md += r.warnings.map((p) => `- ${p}`).join("\n") + "\n";
    if (r.read) md += "\n" + Object.entries(r.read).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v.trim()}`).join("\n") + "\n";
    if (r.g) md += `- G-code: ${r.g.copies} cop${r.g.copies === 1 ? "y" : "ies"}, ${r.g.layers.join("/")} laps, top at ${r.g.zTop} mm, ${r.g.metres.toFixed(2)} m, ${r.g.minutes.toFixed(1)} min printing\n`;
    md += `\n![layers](${r.job.name}-layers.png)\n`;
  }
  fs.writeFileSync(path.join(OUT, "report.md"), md);
  console.log(`\nreport: ${path.relative(process.cwd(), path.join(OUT, "report.md"))}`);
  process.exit(results.some((r) => r.problems.length) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

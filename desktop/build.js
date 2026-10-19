#!/usr/bin/env node
// Unbroken · desktop · build.js
// Makes the desktop app: Unbroken.app for macOS (Apple silicon by default), zipped, in desktop/out/.
//
//   cd desktop && npm install          once: Electron, the packager and the fonts
//   node build.js                      test and build the web app, then package, sign and zip the Mac app
//   node build.js --quick              the web app's quick tests instead of the full suite
//   node build.js --no-tests           no tests (the web app's BUILD.txt says "untested")
//   node build.js --arch x64           an Intel Mac build instead (arm64 is the default)
//   node build.js --stage-only         only lay out desktop/stage/ (what `npm start` runs, to try it without packaging)
//   node build.js --zips <folder>      use Electron's zips from this folder (electron-v<version>-darwin-arm64.zip …)
//                                      instead of downloading them
//
// Steps: 1. the web app (web-app/build.js → web-app/dist)  2. stage/: main.js, package.json, app/ (the web app,
// with its fonts bundled instead of loaded from Google)  3. the icon (icon.svg → icon.icns)  4. package with
// @electron/packager  5. sign: macOS's codesign on a Mac, else rcodesign (ad hoc: no Apple account, so the first
// launch needs right-click ▸ Open)  6. zip, keeping the app's internal links.
"use strict";
const fs = require("fs"),
  path = require("path"),
  { spawnSync } = require("child_process");

const HERE = __dirname,
  REPO = path.resolve(HERE, ".."),
  WEB = path.join(REPO, "web-app"),
  STAGE = path.join(HERE, "stage"),
  OUT = path.join(HERE, "out");
const args = process.argv.slice(2),
  flag = (f) => args.includes(f),
  opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const arch = opt("--arch", "arm64"),
  platform = opt("--platform", "darwin");
const step = (n, t) => console.log(`\n${n}. ${t}`);
const fail = (msg) => {
  console.error(`\nBuild stopped: ${msg}`);
  process.exit(1);
};
const run = (cmd, a, o = {}) => {
  const r = spawnSync(cmd, a, { stdio: "inherit", ...o });
  if (r.status !== 0) fail(`${cmd} ${a.join(" ")} failed`);
};

(async () => {
  // the version: the newest CHANGELOG heading, v95 → 0.95.0 (beta)
  const v = (fs.readFileSync(path.join(REPO, "CHANGELOG.md"), "utf8").match(/^## v(\d+)\b/m) || [])[1];
  if (!v) fail('CHANGELOG.md needs a heading like "## v95 · 2026-10-18" at the top');
  const version = `0.${v}.0`;

  // 1 ---------- the web app
  step(1, "Web app (web-app/build.js)");
  const webFlags = ["--quick", "--no-tests"].filter(flag);
  run(process.execPath, [path.join(WEB, "build.js"), ...webFlags]);
  const dist = path.join(WEB, "dist");
  if (!fs.existsSync(path.join(dist, "index.html"))) fail("web-app/dist has no index.html");

  // 2 ---------- stage
  step(2, "Stage (desktop/stage)");
  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(STAGE, { recursive: true });
  fs.cpSync(dist, path.join(STAGE, "app"), { recursive: true });
  fs.copyFileSync(path.join(HERE, "main.js"), path.join(STAGE, "main.js"));
  fs.writeFileSync(
    path.join(STAGE, "package.json"),
    JSON.stringify(
      { name: "unbroken", productName: "Unbroken", version, description: "One continuous line", main: "main.js" },
      null,
      2
    )
  );
  // fonts: the page asks Google for them; the app carries its own so it works offline
  const FONTS = [
    [
      "@fontsource-variable/bricolage-grotesque",
      "bricolage-grotesque-latin-opsz-normal.woff2",
      "Bricolage Grotesque",
      "200 800",
    ],
    ["@fontsource/ibm-plex-sans", "ibm-plex-sans-latin-400-normal.woff2", "IBM Plex Sans", "400"],
    ["@fontsource/ibm-plex-sans", "ibm-plex-sans-latin-500-normal.woff2", "IBM Plex Sans", "500"],
    ["@fontsource/ibm-plex-sans", "ibm-plex-sans-latin-600-normal.woff2", "IBM Plex Sans", "600"],
    ["@fontsource/ibm-plex-mono", "ibm-plex-mono-latin-400-normal.woff2", "IBM Plex Mono", "400"],
    ["@fontsource/ibm-plex-mono", "ibm-plex-mono-latin-500-normal.woff2", "IBM Plex Mono", "500"],
  ];
  const fdir = path.join(STAGE, "app", "fonts");
  fs.mkdirSync(fdir, { recursive: true });
  let css = "/* bundled with the desktop app (desktop/build.js); the web page loads the same fonts from Google */\n";
  for (const [pkg, file, family, weight] of FONTS) {
    const src = path.join(HERE, "node_modules", pkg, "files", file);
    if (!fs.existsSync(src)) fail(`font ${file} missing: run npm install in desktop/`);
    fs.copyFileSync(src, path.join(fdir, file));
    css += `@font-face { font-family: "${family}"; font-style: normal; font-weight: ${weight}; font-display: swap; src: url(${file}) format("woff2"); }\n`;
  }
  fs.writeFileSync(path.join(fdir, "fonts.css"), css);
  const idx = path.join(STAGE, "app", "index.html");
  let html = fs.readFileSync(idx, "utf8");
  const before = html;
  html = html
    .replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/, "")
    .replace(
      /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/[^"]*">/,
      '<link rel="stylesheet" href="fonts/fonts.css">'
    );
  if (html === before || /fonts\.googleapis/.test(html)) fail("couldn't swap the Google Fonts link in index.html");
  fs.writeFileSync(idx, html);
  console.log(`   v${v} (${version}), ${FONTS.length} fonts bundled`);
  if (flag("--stage-only")) {
    console.log("\nStaged: desktop/stage. Try it with `npm start`.");
    return;
  }

  // 3 ---------- icon: icon.svg → PNGs (a headless browser, as the web app's build uses) → icon.icns
  step(3, "Icon");
  const icns = path.join(STAGE, "icon.icns");
  fs.writeFileSync(icns, await makeIcns(fs.readFileSync(path.join(HERE, "icon.svg"), "utf8")));
  console.log(`   icon.icns, ${(fs.statSync(icns).size / 1024).toFixed(0)} KB`);

  // 4 ---------- package
  step(4, `Package (${platform}-${arch})`);
  const { packager } = require("@electron/packager");
  fs.rmSync(OUT, { recursive: true, force: true });
  const [dir] = await packager({
    dir: STAGE,
    out: OUT,
    name: "Unbroken",
    platform,
    arch,
    icon: icns,
    appBundleId: "app.unbroken.desktop",
    appCategoryType: "public.app-category.graphics-design",
    appVersion: version,
    buildVersion: version,
    appCopyright: `Unbroken v${v}`,
    asar: true,
    overwrite: true,
    prune: false,
    ...(opt("--zips") ? { electronZipDir: path.resolve(opt("--zips")) } : {}),
  });
  const appPath = path.join(dir, "Unbroken.app");
  if (platform !== "darwin") {
    console.log(`\nDone: ${path.relative(HERE, dir)}`);
    return;
  }

  // 5 ---------- sign (ad hoc)
  step(5, "Sign (ad hoc)");
  if (process.platform === "darwin") run("codesign", ["--force", "--deep", "--sign", "-", appPath]);
  else {
    const rc = process.env.RCODESIGN || "rcodesign";
    if (spawnSync(rc, ["--version"]).status !== 0)
      fail("no rcodesign: install it (github.com/indygreg/apple-platform-rs) or set RCODESIGN to its path");
    const sg = spawnSync(rc, ["sign", appPath]); // quiet unless it fails (it lists every file it signs)
    if (sg.status !== 0) fail(`signing failed:\n${String(sg.stderr).slice(-2000)}`);
    // (rcodesign's own verify expects an Apple certificate, so it fails on ad hoc signatures: read the signature instead)
    const info = spawnSync(rc, ["print-signature-info", path.join(appPath, "Contents", "MacOS", "Unbroken")]);
    const txt = String(info.stdout);
    if (!/ADHOC/.test(txt) || !/identifier: app\.unbroken\.desktop/.test(txt)) fail("the app's signature isn't there");
    console.log("   signed ad hoc as app.unbroken.desktop");
  }

  // 6 ---------- zip (symlinks kept: the frameworks inside need them)
  step(6, "Zip");
  const zip = path.join(OUT, `Unbroken-v${v}-mac-${arch}.zip`);
  if (process.platform === "darwin") run("ditto", ["-c", "-k", "--keepParent", appPath, zip]);
  else run("zip", ["-qry", zip, "Unbroken.app"], { cwd: dir });
  console.log(`\nDone: desktop/out/${path.basename(zip)} (${(fs.statSync(zip).size / 1048576).toFixed(0)} MB)`);
})().catch((e) => fail(e.stack || e.message));

// The Mac icon file: PNGs at every size macOS asks for, in an icns container (a header, then type · length · PNG).
async function makeIcns(svg) {
  let chromium;
  try {
    ({ chromium } = require(path.join(REPO, "source", "tests", "node_modules", "playwright")));
  } catch {
    fail("the icon needs Playwright: run npm install in source/tests");
  }
  const exe = process.env.UNB_CHROMIUM;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const TYPES = [
    ["icp4", 16],
    ["icp5", 32],
    ["ic11", 32],
    ["ic12", 64],
    ["ic07", 128],
    ["ic13", 256],
    ["ic08", 256],
    ["ic14", 512],
    ["ic09", 512],
    ["ic10", 1024],
  ];
  const parts = [];
  for (const [type, px] of TYPES) {
    const page = await browser.newPage({ viewport: { width: px, height: px } });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg.replace(/width="1024" height="1024"/, `width="${px}" height="${px}"`)}</body></html>`
    );
    const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: px, height: px } });
    await page.close();
    const head = Buffer.alloc(8);
    head.write(type, 0, "ascii");
    head.writeUInt32BE(png.length + 8, 4);
    parts.push(head, png);
  }
  await browser.close();
  const body = Buffer.concat(parts),
    top = Buffer.alloc(8);
  top.write("icns", 0, "ascii");
  top.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([top, body]);
}

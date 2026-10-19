// Unbroken · desktop · main.js
// The desktop app: the web app (web-app/dist, copied into ./app by build.js) in its own window. Electron's main
// process; the page itself is unchanged.
// - Pages load from unbroken://app/, a private address that behaves like a website, so the background engines (Web
//   Workers) run as they do online (they can't from file://).
// - settings.js: File ▸ Edit Settings… copies the built-in one to the app's support folder and opens it; while that
//   copy exists it is used instead, so edits survive app updates. File ▸ Use Built-in Settings moves it aside.
// - Exports (G-code, SVG, DXF, designs) ask where to save, starting in the folder used last.
// - The window's size and place, the last save folder, the Suggestion box notes and the folded cards are kept between
//   launches (the notes and cards by the page itself, in the app's own browser storage).
"use strict";
const { app, BrowserWindow, Menu, dialog, net, protocol, session, shell } = require("electron");
const fs = require("fs"),
  path = require("path"),
  { pathToFileURL } = require("url");

const APP_DIR = path.join(__dirname, "app"),
  SCHEME = "unbroken",
  HOME = `${SCHEME}://app/index.html`;
const support = (f) => path.join(app.getPath("userData"), f);
const userSettings = () => support("settings.js");

// ---------- small saved state: window bounds, last save folder ----------
function readState() {
  try {
    return JSON.parse(fs.readFileSync(support("state.json"), "utf8"));
  } catch {
    return {};
  }
}
function writeState(patch) {
  try {
    fs.writeFileSync(support("state.json"), JSON.stringify({ ...readState(), ...patch }, null, 2));
  } catch {}
}

// ---------- unbroken://app/… → the bundled page (and the user's settings.js, when there is one) ----------
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);
function serve(req) {
  const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, "") || "index.html";
  if (rel === "settings.js" && fs.existsSync(userSettings())) return net.fetch(pathToFileURL(userSettings()).href);
  const file = path.normalize(path.join(APP_DIR, rel));
  if (!file.startsWith(APP_DIR + path.sep) || !fs.existsSync(file)) return new Response("Not found", { status: 404 });
  return net.fetch(pathToFileURL(file).href);
}

// ---------- the window ----------
let win = null;
function createWindow() {
  const s = readState().bounds || {};
  win = new BrowserWindow({
    width: s.width || 1440,
    height: s.height || 960,
    x: s.x,
    y: s.y,
    minWidth: 760,
    minHeight: 560,
    title: "Unbroken",
    backgroundColor: "#eef1f4",
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  if (readState().maximized) win.maximize();
  win.once("ready-to-show", () => win.show());
  const keep = () => {
    if (!win.isMaximized() && !win.isMinimized() && !win.isFullScreen()) writeState({ bounds: win.getBounds() });
  };
  win.on("resize", keep);
  win.on("move", keep);
  win.on("close", () => writeState({ maximized: win.isMaximized() }));
  win.on("closed", () => (win = null));
  // links leave the app for the browser; the page itself never navigates away
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(`${SCHEME}://app/`)) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  win.loadURL(HOME);
}

// ---------- saving exports: a Save dialog, starting where the last file went ----------
function handleDownloads(ses) {
  ses.on("will-download", (e, item) => {
    const dir = readState().saveDir || app.getPath("downloads");
    item.setSaveDialogOptions({ title: "Save", defaultPath: path.join(dir, item.getFilename()) });
    item.once("done", (ev, state) => {
      if (state === "completed") writeState({ saveDir: path.dirname(item.getSavePath()) });
    });
  });
}

// ---------- settings.js ----------
async function editSettings() {
  const f = userSettings();
  if (!fs.existsSync(f)) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.copyFileSync(path.join(APP_DIR, "settings.js"), f);
    await dialog.showMessageBox(win, {
      type: "info",
      message: "Your own settings file",
      detail:
        "A copy of the built-in settings.js is now in Unbroken's support folder and opens next. Unbroken uses it " +
        "instead of the built-in one from now on. After saving a change, choose View ▸ Reload to see it.",
    });
  }
  const err = await shell.openPath(f);
  if (err) shell.showItemInFolder(f);
}
async function builtInSettings() {
  const f = userSettings();
  if (!fs.existsSync(f)) {
    dialog.showMessageBox(win, { type: "info", message: "Unbroken is already using its built-in settings." });
    return;
  }
  const kept = support(`settings-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.js`);
  fs.renameSync(f, kept);
  if (win) win.webContents.reload();
  dialog.showMessageBox(win, {
    type: "info",
    message: "Back to the built-in settings",
    detail: `Your settings file was kept as ${path.basename(kept)} in Unbroken's support folder.`,
  });
}

// ---------- menus ----------
function buildMenu() {
  const mac = process.platform === "darwin";
  const template = [
    ...(mac ? [{ role: "appMenu" }] : []),
    {
      label: "File",
      submenu: [
        { label: "Edit Settings…", click: editSettings },
        { label: "Use Built-in Settings", click: builtInSettings },
        { label: "Show Support Folder", click: () => shell.openPath(app.getPath("userData")) },
        { type: "separator" },
        mac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom", label: "Actual Size" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- start ----------
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    protocol.handle(SCHEME, serve);
    handleDownloads(session.defaultSession);
    buildMenu();
    createWindow();
    app.on("activate", () => {
      if (!BrowserWindow.getAllWindows().length) createWindow();
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

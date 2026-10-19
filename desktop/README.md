# Desktop app

Unbroken as an app of its own: the web app in its own window (Electron), with no browser and no internet needed. The
page is the same one the browser runs; `main.js` adds what a desktop app needs around it.

## Installing on a Mac

1. Unzip `Unbroken-v<version>-mac-arm64.zip` (from `desktop/out/`) and drag **Unbroken.app** into Applications.
2. The first time, **right-click Unbroken ▸ Open**, then **Open** again. The app is signed ad hoc (no Apple developer
   account), so macOS asks once. If it only offers to move it to the Bin, open **System Settings ▸ Privacy & Security**
   and click **Open Anyway** next to Unbroken.

Built for Apple silicon (M1 and later); `node build.js --arch x64` makes an Intel build.

## What the app adds

| | |
|---|---|
| Its own window | Remembers its size and place. One copy runs at a time; opening it again brings the window forward. |
| Offline | The fonts are bundled (the web page loads them from Google). |
| Background engines | Pages load from `unbroken://app/`, a private address that behaves like a website, so the Web Workers run (they can't from `file://`). |
| Saving | Every export (G-code, SVG, DXF, design files) asks where to save, starting in the folder used last. |
| Settings | **File ▸ Edit Settings…** copies the built-in `settings.js` to the support folder and opens it; from then on the app uses that copy, so edits survive updates. Save, then **View ▸ Reload**. **File ▸ Use Built-in Settings** puts the copy aside (renamed with the date). |
| Kept between launches | The window, the last save folder, the Suggestion box notes and the folded cards. |

The support folder is `~/Library/Application Support/Unbroken` (**File ▸ Show Support Folder**).

## Building

```
cd desktop
npm install            # once: Electron, the packager and the fonts
npm start              # try it without packaging (lays out desktop/stage, then opens it)
node build.js          # web app tests and build, then Unbroken.app: packaged, signed, zipped in desktop/out/
```

`build.js` options: `--quick` or `--no-tests` (the web app's tests), `--arch x64`, `--stage-only`, and `--zips <folder>`
to use Electron's zips from a folder instead of downloading them. The version comes from the top of CHANGELOG.md
(v95 → 0.95.0). The icon is `icon.svg` (one continuous line, made the way the app makes them), drawn at every size
macOS asks for when building.

Signing: on a Mac the build uses `codesign`; anywhere else it needs
[rcodesign](https://github.com/indygreg/apple-platform-rs) (`RCODESIGN` can point to it). Both sign ad hoc, which is
enough for macOS to run the app on Apple silicon. Signing and notarising with an Apple developer account would remove
the first-launch question.

## Files

| File | What's in it |
|---|---|
| `main.js` | The app around the page: the window, `unbroken://`, Save dialogs, settings, menus. |
| `build.js` | Builds, packages, signs and zips the app. |
| `icon.svg` | The app icon. |
| `package.json` | Electron, the packager and the fonts (development only; nothing is installed on the Mac). |
| `stage/`, `out/` | Made by `build.js`; not kept. |

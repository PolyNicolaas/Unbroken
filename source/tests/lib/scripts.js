// The app's own scripts: the core's (web-app/js) and each feature's (web-app/features/<name>). One list, so a test
// that reads "every script of the app" reads the features too.
const fs = require("fs"), path = require("path");
const WEB = path.resolve(__dirname, "../../../web-app");
function appScripts() {
  const out = fs.readdirSync(path.join(WEB, "js")).filter((f) => f.endsWith(".js")).map((f) => ({ name: f, file: path.join(WEB, "js", f), feature: null }));
  for (const name of fs.readdirSync(path.join(WEB, "features")))
    for (const f of fs.readdirSync(path.join(WEB, "features", name)).filter((f) => f.endsWith(".js")))
      out.push({ name: f, file: path.join(WEB, "features", name, f), feature: name });
  return out;
}
module.exports = { appScripts, WEB };

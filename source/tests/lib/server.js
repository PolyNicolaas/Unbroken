// Minimal static file server for the browser tests: serves the repo root so web-app/index.html can load
// ../source/engine/core.js and start its background workers (workers need http, not file://).
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../../.."), TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".css": "text/css" };
function start() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, "127.0.0.1", () => res({ url: `http://127.0.0.1:${srv.address().port}`, root: ROOT, close: () => new Promise((r) => srv.close(r)) }));
  });
}
module.exports = { start, ROOT };

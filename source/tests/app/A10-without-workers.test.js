const A = require("../lib/app.js"), { check } = require("../lib/check.js"), path = require("path");
module.exports = {
  id: "A10", title: "Works without background workers, with the same result",
  guards: "the app breaking when opened straight from disk",
  why: "Browsers don't allow background workers for pages opened straight from a folder (file://), and some embedding pages block them. The app then runs the same engine calls on the page itself; it must still work and give the same trace.",
  how: "Opens the app over http (workers) and from disk (no workers), lets each trace the sample, and compares the corner labels and crossing counts.",
  pass: "Over http at least one worker runs; from disk none do; both traces show the same terms, error and crossings; no page errors in either.",
  async run(ctx) {
    const http = await A.open(ctx), disk = await A.open(ctx, { url: "file://" + path.join(ctx.server.root, "web-app/index.html") });
    const a = [await A.chip(http.page), await http.page.textContent("#uncrossVal")].join(" | "), b = [await A.chip(disk.page), await disk.page.textContent("#uncrossVal")].join(" | ");
    const checks = [check("http: workers", http.page.workers().length, ">=", 1), check("disk: workers", disk.page.workers().length, "==", 0),
      check("same trace both ways", +(a === b), "==", 1), check("page errors", http.errors.length + disk.errors.length, "==", 0)];
    await http.close(); await disk.close(); return { checks, notes: `http: ${a}  \ndisk: ${b}` };
  },
};

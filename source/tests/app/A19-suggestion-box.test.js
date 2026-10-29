const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A19", title: "Suggestion box: a line typed on any tab is kept as a note",
  guards: "ideas and bugs typed into the page being lost, filed under the wrong kind, or not kept after a reload",
  why: "The suggestion box is where ideas and bugs are written down while using the app, to be sorted into ROADMAP.md later. A note that silently disappears is worse than no box.",
  how: "Opens the app (outside Claude, so notes are kept in the browser), opens the suggestion box from the File menu and closes it, opens it again, types an idea on the Trace tab and a \"bug: …\" line on the 3D tab, ticks the bug as done, reloads the page and reads the list again.",
  pass: "The box is put away until File, Suggestion box… opens it, and Close puts it away; both notes are listed with their kind (idea, bug) and the tab they were written on; the open count is 1 after ticking the bug; after the reload both notes are still there and the bug is still done; no page errors.",
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { folded: true }), checks = [];
    // put away until the File menu's Suggestion box… opens it (v113); Close puts it away again
    const shown = () => page.evaluate(() => !!$("card-h-notes").offsetParent && !$("card-h-notes").classList.contains("collapsed"));
    const hidden0 = !(await shown());
    await page.click("#fileMenu summary"); await page.click("#notesOpen"); await page.waitForTimeout(200);
    const opened = await shown();
    await page.click("#notesClose"); await page.waitForTimeout(100);
    const closed = !(await shown());
    checks.push(check("put away; File, Suggestion box… opens it; Close puts it away", +(hidden0 && opened && closed), "==", 1));
    await page.click("#fileMenu summary"); await page.click("#notesOpen"); await page.waitForTimeout(200);
    const add = async (t) => { await page.fill("#noteIn", t); await page.press("#noteIn", "Enter"); await page.waitForTimeout(200); };
    const list = () => page.$$eval("#noteList li", (L) => L.map((li) => ({ kind: li.querySelector(".tag").textContent, text: li.querySelector(".txt").textContent, when: li.querySelector("small").textContent, done: li.querySelector("input").checked })));
    await add("Try a darker preview colour for white chocolate");
    await A.print(page); await page.waitForTimeout(300);
    await add("bug: copies overlap at 0 mm spacing");

    let L = await list();
    const idea = L.find((n) => /darker preview/.test(n.text)), bug = L.find((n) => /copies overlap/.test(n.text));
    checks.push(check("both notes listed", +!!(idea && bug), "==", 1),
      check("kinds: idea and bug (prefix dropped)", +(idea && idea.kind === "idea" && bug && bug.kind === "bug" && bug.text === "copies overlap at 0 mm spacing"), "==", 1),
      check("tab recorded: Trace and 3D", +(idea && /Trace/.test(idea.when) && bug && /3D/.test(bug.when)), "==", 1));
    await page.locator("#noteList li", { hasText: "copies overlap" }).locator("input").check(); await page.waitForTimeout(200);
    checks.push(check("open count after ticking the bug", +((await page.textContent("#notesCount")).match(/\d+/) || [0])[0], "==", 1));
    await page.reload(); await A.idle(page, 1500);
    L = await list();
    checks.push(check("after a reload: both notes kept, the bug still done", +(L.length === 2 && L.find((n) => /copies overlap/.test(n.text)).done), "==", 1),
      check("page errors", errors.length, "==", 0));
    await close(); return { checks, notes: errors.join(" | ") };
  },
};

const fs = require("fs"), path = require("path"), { check } = require("../lib/check.js");
// Who may set each field of the app's shared state `st` (web-app/js). One owner per field; two files are allowed on
// top of that because it's their job: config.js sets starting values from settings.js, history.js puts a design back
// (undo, redo, open). A field missing from this table, or set from another file, fails the test: add it here on purpose.
const OWNERS = {
  // the trace (pipeline.js runs it and commits each result in one Object.assign)
  N: ["pipeline.js", "controls.js", "optimize.js"], marks: ["pipeline.js"], sweep: ["pipeline.js"], rr: ["pipeline.js", "source.js"],
  wk: ["pipeline.js", "source.js"], autoPending: ["pipeline.js", "controls.js", "optimize.js", "source.js", "tools.js"], mbox: ["controls.js"],
  outW: ["pipeline.js"], sizeUser: ["pipeline.js", "source.js", "tools.js"],
  // the source (source.js), and the model (model.js)
  source: ["source.js"], text: ["source.js"], imageSource: ["source.js", "model.js"], srcLabel: ["source.js", "model.js"], model: ["model.js"],
  // line settings (controls.js)
  spacing: ["controls.js", "source.js"], simplify: ["controls.js"],
  // hand edits (tools.js); a new source clears them (source.js)
  sel: ["tools.js", "source.js"], erase: ["tools.js", "source.js"], edits: ["tools.js", "source.js"], start: ["tools.js", "source.js"], zones: ["pipeline.js", "source.js"],
  zoneVer: ["pipeline.js", "source.js", "tools.js"], zm: ["pipeline.js", "source.js", "tools.js"], tool: ["tools.js"], draft: ["tools.js"],
  pendingSel: ["tools.js"], strokes: ["tools.js"],
  // the views
  playing: ["preview.js"], t: ["preview.js"], epi: ["preview.js"], bgCache: ["preview.js", "main.js"], layers: ["layers.js"], pieces: ["pieces.js"],
  plot: ["plot.js"], pfill: ["plot.js"], penFill: ["plot.js", "source.js"],
};
const ALSO = ["config.js", "history.js"];
module.exports = {
  id: "E27", title: "Each field of the app's shared state is set by its owner",
  guards: "a file quietly changing state another file is responsible for, which is how stale views and \"who changed this?\" bugs start",
  why: "The app's files share one state object (st). When any file can change any field, a wrong value could come from anywhere. Each field has an owner (the table at the top of this test, also in web-app/README.md); only the owner sets it, plus config.js for starting values and history.js when a design is put back.",
  how: "Reads every file in web-app/js and finds each place that sets a field of st (st.x = …, st.x++, st.x.push(…), and nested fields like st.model.yaw). Compares the file with the field's owners.",
  pass: "Every field set anywhere is in the table, and only its owners (or config.js / history.js) set it.",
  async run() {
    const dir = path.resolve(__dirname, "../../../web-app/js"), bad = [], seen = new Set();
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".js"))) {
      const code = fs.readFileSync(path.join(dir, f), "utf8").replace(/\/\/.*$/gm, "");
      for (const m of code.matchAll(/\bst\.([A-Za-z]+)(?:\.[A-Za-z]+)*\s*(?:=(?!=)|\+\+|--|\+=|-=)|\bst\.([A-Za-z]+)(?:\.[A-Za-z]+)*\.(?:push|pop|splice|shift|unshift)\(/g)) {
        const field = m[1] || m[2]; seen.add(field);
        if (ALSO.includes(f)) continue;
        if (!OWNERS[field]) bad.push(`st.${field} (set in ${f}) has no owner in the table`);
        else if (!OWNERS[field].includes(f)) bad.push(`st.${field} set in ${f}; owners: ${OWNERS[field].join(", ")}`);
      }
    }
    return { checks: [check("state fields set outside their owners", bad.length, "==", 0)], notes: bad.length ? bad.join("  \n") : `${seen.size} fields, each set by its owners` };
  },
};

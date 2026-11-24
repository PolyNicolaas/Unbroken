const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A71", title: "Ties: Layers adds struts across the gaps between a drawing's parts, to the print only",
  guards: "ties that don't reach the G-code or the layers' readout, that change the trace itself, that stay after they're switched off, or that are added for a pen plotter",
  why: "Nicolaas (24 November 2026): a large logo held together only by the trace's few connectors needs more to print tall without a base; he asked for it in the app (E63 has the why).",
  how: "Opens blocks-and-ring.svg (three blocks, a bar and a ring, 4 mm gaps at 120 mm) with unbroken.open(), traces the outlines at 120 mm, 10 mm tall, and reads the layers and an exported G-code. Then set({ ties: true }), the same again, and status().ties; then the longest tie at 2 mm; then ties off; then made for a pen plotter with ties on.",
  pass: "With ties: at least 3 ties, the layers' line longer and the G-code longer, the trace (its points) unchanged, the Ties card says how many and the map has a Ties chip; the longest tie at 2 mm: no ties; off: the layers' line as at first; for a pen plotter the card says not for this print; no page errors.",
  async run(ctx) {
    const src = ctx.server.url + "/source/tests/lib/fixtures/blocks-and-ring.svg";
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true });
    const r = await page.evaluate(async (src) => {
      const U = window.unbroken, o = {};
      const metres = (s) => +((s.layers || "").match(/([\d.]+) m\b/) || [0, 0])[1];
      await U.open(src);
      await U.set({ style: "outline", widthMM: 120 });
      await U.view("layers");
      let s = await U.set({ printHeightMM: 10 });
      o.m0 = metres(s); o.n0 = st.final.re.length;
      o.g0 = ((await U.export("gcode", { download: false })).text || "").length;
      s = await U.set({ ties: true });
      o.m1 = metres(s); o.ties = s.ties; o.card = $("tiesVal").textContent; o.n1 = st.final.re.length;
      o.g1 = ((await U.export("gcode", { download: false })).text || "").length;
      o.chip = !!MAP_NODES.ties;
      s = await U.set({ tieMaxMM: 2 });
      o.short = s.ties ? s.ties.count : 0;
      s = await U.set({ tieMaxMM: 7, ties: false });
      o.m2 = metres(s); o.off = s.ties;
      await U.set({ ties: true, madeFor: "plot" });
      o.plot = $("tiesVal").textContent;
      return o;
    }, src);
    const res = {
      checks: [
        check("ties", r.ties ? r.ties.count : 0, ">=", 3),
        check("the layers' line with ties (m) over without", r.m1 - r.m0, ">", 0),
        check("the G-code with ties over without (characters)", r.g1 - r.g0, ">", 0),
        check("the trace's points, unchanged by ties", r.n1, "==", r.n0),
        check("the Ties card says how many", +/^\d+ ties? · \+/.test(r.card), "==", 1),
        check("a Ties chip on the map", +r.chip, "==", 1),
        check("longest tie 2 mm: ties", r.short, "==", 0),
        check("off: the layers' line as at first (m)", r.m2, "==", r.m0),
        check("off: no ties", r.off, "==", null),
        check("a pen plotter: the card", r.plot, "==", "not for this print"),
        check("page errors", errors.length, "==", 0),
      ],
      notes: `${r.m0} m → ${r.m1} m with ${r.ties && r.ties.count} ties (${r.card})${errors.length ? "  \nerrors: " + errors.join(" | ") : ""}`,
    };
    await close();
    return res;
  },
};

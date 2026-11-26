const A = require("../lib/app.js"), { check } = require("../lib/check.js");
const path = require("path");
const FIX = path.join(__dirname, "../lib/fixtures/");
module.exports = {
  id: "A78", title: "The Solid view's light (Front, Raking, Light from, the slope up the wall) and a relief from a picture with a transparent background",
  guards: "a relief's top and bottom edges shading like the wall round them, a raking light that leaves the wall black, the light forgotten on reload, Auto not raking for a relief, a picture's transparent background raised by Swap out and in like white paper, and white art on a transparent background starting with nothing raised",
  why: "Nicolaas (26 November 2026): the Solid view's lighting doesn't show reliefs off well, and a relief should know a transparent background from white in the art (docs: claude/solid-view-lighting-plan.md, review item 21).",
  how: "In the page: beadShade for a bead's side facing you, stepping out (its underside) and stepping back (its top edge), under Front and Raking light from the top and from the bottom (lightVector, the default view); beadOffsets on two laps 0.2 mm apart. Then four PNG badges (a dark ring and letters, white inside the ring): on a transparent background, on white, on blue, and white art on a transparent background; each through Make a relief, reading the relief's source, its swap, and the wall at the picture's corner (outside the ring) with and without Swap out and in; and the Print step's Solid view with Light on Auto, Raking from the top and from the bottom (the drawing's pixels compared), then a reload. Screenshots in results/light-*.png.",
  pass: "Raking from the top: a top edge takes more light than the flat wall, an underside less, and from the bottom the other way round; Raking's top edge against its underside differs more than Front's; the wall facing you isn't black under Raking (at least 0.2); the offsets come out 0.2 mm; a relief puts Auto on Raking, a drawing on Front; Light from 0° and 180° draw different pictures; the light comes back after a reload. The transparent badge keeps its transparency (source.clear) and, swapped, its corner stays the wall while the white badge's corner stands out; white art on a transparent background starts swapped with parts raised; the blue background raises the corner as a panel; no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx, { clean: true, art: true, viewport: { width: 1180, height: 820 } });
    const out = path.join(__dirname, "..", "results");
    const checks = [];
    // the shading itself
    const sh = await page.evaluate(() => {
      const view = [STACK_TURN0.az, STACK_TURN0.el], toward = [-Math.sin(view[0]), -Math.cos(view[0])], l = Math.hypot(...toward),
        n = [toward[0] / l, toward[1] / l], h = 0.3,
        at = (mode, from) => { const L = lightVector({ mode, from }, ...view); return { flat: beadShade(n[0], n[1], 0, h, L), under: beadShade(n[0], n[1], 0.25, h, L), top: beadShade(n[0], n[1], -0.25, h, L) }; };
      // two laps (squares 20 mm, the second 0.2 mm bigger each way), as segments
      const sq = (r, z) => { const p = [[-r, -r], [r, -r], [r, r], [-r, r], [-r, -r]], s = []; for (let i = 0; i < 4; i++) s.push(p[i][0], p[i][1], z, p[i + 1][0], p[i + 1][1], z); return s; };
      const seg = [...sq(10, 0.3), ...sq(10.2, 0.6)], o = beadOffsets(seg, (j) => (j < 4 ? 0 : 1));
      return { rakeTop: at("raking", 0), rakeBottom: at("raking", 180), front: at("front", 0), off: Math.hypot(o[8], o[9]) };
    });
    checks.push(
      check("Raking from the top: a top edge takes more light than the flat wall", sh.rakeTop.top - sh.rakeTop.flat, ">", 0.1),
      check("… an underside less", sh.rakeTop.flat - sh.rakeTop.under, ">", 0.1),
      check("Raking from the bottom: the underside takes more than the top edge", sh.rakeBottom.under - sh.rakeBottom.top, ">", 0.2),
      check("Raking shows the edges more than Front (top − underside)", (sh.rakeTop.top - sh.rakeTop.under) - (sh.front.top - sh.front.under), ">", 0),
      check("Raking: the wall facing you isn't black", sh.rakeTop.flat, ">=", 0.2),
      check("beadOffsets: the second lap 0.2 mm out (mm)", Math.abs(sh.off - 0.2), "<=", 0.01),
    );
    // the badges
    // how far out the wall is at the source picture's own corner (3 % in from its top left), on the engine's grid
    const corner = () => page.evaluate(() => { const G = rlView.G, M = G.map; return Math.abs(UNB.reliefAt(G, M.y0 + M.ih * 0.97, (M.x0 + M.iw * 0.03) / G.face)); });
    const badge = async (name) => {
      await page.evaluate(() => mapOpen("art"));
      await page.setInputFiles("#anyFile", FIX + name + ".png");
      await A.idle(page, 1500);
      await page.evaluate(async () => { await window.unbroken.set({ widthMM: 60 }); mapOpen("art"); });
      await A.idle(page, 800);
      await page.evaluate(() => $("reliefMake").click());
      await A.idle(page, 1500);
      await page.evaluate(() => $("rlInset").scrollIntoView({ block: "center" }));
      await page.waitForTimeout(400);
      const o = await page.evaluate(() => { const T = st.model.vase.texture; return { clear: !!T.source.clear, swapped: !!T.invert, raised: rlView.G.height.parts.filter((p) => p.level > 0 && p.n > 0).length }; });
      o.corner = await corner();
      await page.evaluate(() => $("rlSwap").click()); await A.idle(page, 800);
      await page.evaluate(() => $("rlInset").scrollIntoView({ block: "center" })); await page.waitForTimeout(400);
      o.cornerSwapped = await corner();
      await page.evaluate(() => $("rlSwap").click()); await A.idle(page, 800);
      return o;
    };
    const clear = await badge("badge-clear"), white = await badge("badge-white"), blue = await badge("badge-blue"), light = await badge("badge-white-on-clear");
    checks.push(
      check("transparent badge: its transparency kept", +clear.clear, "==", 1),
      check("white badge: none", +white.clear, "==", 0),
      check("transparent badge, swapped: the corner stays the wall (mm)", clear.cornerSwapped, "<=", 0.05),
      check("white badge, swapped: the corner (white paper) stands out (mm)", white.cornerSwapped, ">=", 1),
      check("white art on a transparent background: starts swapped", +light.swapped, "==", 1),
      check("… with its parts raised", light.raised, ">=", 2),
      check("… and its corner the wall (mm)", light.corner, "<=", 0.05),
      check("blue background: the corner raised as a panel (mm)", blue.corner, ">=", 0.5),
    );
    // the Solid view
    const pixels = () => page.evaluate(() => { const c = $("stackView"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7; return s; });
    await page.evaluate(() => mapOpen("print")); await A.idle(page, 2500);
    const auto = await page.evaluate(() => [$("pvLight").value, lightNow().mode]);
    await page.locator("#stackView").screenshot({ path: path.join(out, "light-auto.png") });
    const setLight = async (mode, from, n) => { await page.evaluate(([m, f]) => { $("pvLight").value = m; $("pvLight").dispatchEvent(new Event("change")); $("pvLightFrom").value = f; $("pvLightFrom").dispatchEvent(new Event("input")); }, [mode, from]); await page.waitForTimeout(400); await page.locator("#stackView").screenshot({ path: path.join(out, `light-${n}.png`) }); return pixels(); };
    const top = await setLight("raking", 0, "raking-top"), bottom = await setLight("raking", 180, "raking-bottom");
    await setLight("front", 90, "front-right");
    await page.reload(); await A.idle(page, 1500);
    const kept = await page.evaluate(() => [$("pvLight").value, +$("pvLightFrom").value]);
    // a drawing: Auto is Front
    await page.evaluate(() => { $("pvLight").value = "auto"; $("pvLight").dispatchEvent(new Event("change")); });
    await page.goto(page.url().split("?")[0] + "?example=leaf"); await A.idle(page, 2500);
    const drawing = await page.evaluate(() => lightNow().mode);
    checks.push(
      check("a relief: Auto is Raking", auto.join(","), "==", "auto,raking"),
      check("Light from 0° and 180°: different pictures", +(top !== bottom), "==", 1),
      check("the light kept through a reload", kept.join(","), "==", "front,90"),
      check("a drawing: Auto is Front", drawing, "==", "front"),
      check("page errors", errors.length, "==", 0),
    );
    await close();
    return { checks, notes: [`shade raking top ${JSON.stringify(sh.rakeTop)}, bottom ${JSON.stringify(sh.rakeBottom)}, front ${JSON.stringify(sh.front)}`, `badges: ${JSON.stringify({ clear, white, blue, light })}`, ...errors] };
  },
};

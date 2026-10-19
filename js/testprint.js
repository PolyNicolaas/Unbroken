// Unbroken · web app · testprint.js
// Test print (3D tab): one G-code of numbered strips with one setting stepped from strip to strip (UNB.testStrips),
// to find the layer height, speed, gap or flow that suits a chocolate; then the best strip's value goes into the
// setting.
// Plain script (not a module) so the app also works opened straight from disk; files share top-level names and load in
// the order listed in index.html.
"use strict";

const TEST_KIND = {
  layerH: {
    unit: "mm",
    digits: 2,
    range: () => {
      const h = +$("layerH").value || 0.3;
      return [Math.max(0.05, h - 0.1), h + 0.1];
    },
  },
  speed: {
    unit: "mm/s",
    digits: 0,
    range: () => {
      const v = feedMMs();
      return [Math.max(1, v / 2), v * 1.5];
    },
  },
  gap: { unit: "mm", digits: 2, range: () => [0, 1] },
  flow: { unit: "%", digits: 0, range: () => [90, 110] },
};
// From / To typed by hand: a change of chocolate, printer or speed leaves them alone; otherwise they follow the setting
let testEdited = false;
function testValues() {
  const n = intIn("testN", 2, 10, 5),
    a = +$("testFrom").value,
    b = +$("testTo").value;
  return Array.from({ length: n }, (_, k) => a + ((b - a) * k) / (n - 1));
}
function testRange() {
  const [a, b] = TEST_KIND[$("testVary").value].range(),
    d = TEST_KIND[$("testVary").value].digits;
  $("testFrom").value = +a.toFixed(d);
  $("testTo").value = +b.toFixed(d);
  testEdited = false;
  testUI();
}
// a setting the range is built round changed (the layer height or speed, e.g. from a new chocolate): the range moves
// with it, unless From / To were typed by hand
function testFollow() {
  const k = $("testVary").value;
  if (!testEdited && (k === "layerH" || k === "speed")) testRange();
  else testUI();
}
function testPlan() {
  const vary = $("testVary").value,
    vals = testValues();
  return UNB.testStrips({
    vary,
    values: vals,
    w: lineWidthMM(),
    gap: Math.max(0, +$("lineGapMM").value || 0),
    h: layerHmm(),
    feed: feedMMmin(),
    layers: intIn("testLayers", 1, 30, 5),
    rows: 6,
    length: 25,
    stripGap: 8,
  });
}
function testUI() {
  const K = TEST_KIND[$("testVary").value],
    vals = testValues(),
    t = testPlan(),
    need = layerTimeS();
  const bad = vals.some(
    (v) =>
      !Number.isFinite(v) ||
      ($("testVary").value === "layerH" && v < 0.05) ||
      ($("testVary").value === "speed" && v <= 0) ||
      v < 0
  );
  $("testVal").textContent =
    `${vals.length} strips · ${$("testVary").selectedOptions[0].textContent.replace(/ \(.*/, "").toLowerCase()}`;
  $("testPick").max = vals.length;
  const info = $("testInfo");
  info.className = bad || t.w > BED.w ? "hint warn" : "hint";
  info.textContent = bad
    ? "Check From and To: every strip needs a value above 0."
    : vals.map((v, k) => `${k + 1}: ${fmt(v, K.digits)}`).join(" · ") +
      ` ${K.unit}. ${fmt(t.w, 0)} × ${fmt(t.h, 0)} mm` +
      (t.w > BED.w
        ? `, wider than the ${BED.w} mm plate: fewer strips.`
        : `; a round of layers takes ${fmt(t.roundSeconds, 0)} s` +
          (t.roundSeconds < need ? ` (under ${need} s: let it set, or add strips).` : "."));
  $("testBtn").disabled = bad || t.w > BED.w;
}
$("testVary").addEventListener("change", testRange);
for (const id of ["testFrom", "testTo"]) $(id).addEventListener("input", () => (testEdited = true));
for (const id of ["testN", "testFrom", "testTo", "testLayers", "lineGapMM", "layerTime"])
  $(id).addEventListener("input", testUI);
$("gFeed").addEventListener("input", testFollow);
onPrintSettings(testFollow); // the printer, chocolate, needle, line width and layer height
$("testBtn").addEventListener("click", async () => {
  const msg = $("testMsg"),
    t = testPlan(),
    g = gcodeSettings(),
    vary = $("testVary").value;
  g.ox = (BED.w - t.w) / 2;
  g.oy = (BED.h - t.h) / 2; // centred on the plate
  const name = `test-${vary}_${needleTag()}`,
    text = UNB.exportGcode(t.paths, g);
  try {
    await saveFile(`${name}-gcode.zip`, UNB.zip(`${name}.gcode`, text));
    setStatus(
      msg,
      "ok",
      `Exported ${name}-gcode.zip · ${t.strips.length} strips, ${fmt(t.w, 0)} × ${fmt(t.h, 0)} mm, ${intIn("testLayers", 1, 30, 5)} layers, for the ${CFG.printer.name}`
    );
  } catch (e) {
    setStatus(msg, "bad", saveError(e, "Export") + ".");
  }
});
$("testUse").addEventListener("click", () => {
  const vary = $("testVary").value,
    vals = testValues(),
    k = intIn("testPick", 1, vals.length, 1),
    v = vals[k - 1],
    K = TEST_KIND[vary];
  const put = (id, x) => {
    $(id).value = x;
    $(id).dispatchEvent(new Event("input", { bubbles: true }));
  };
  // the setting moves to the chosen strip's value, but the strips stay as they were printed
  const keep = testEdited;
  testEdited = true;
  if (vary === "layerH") put("layerH", +v.toFixed(3));
  else if (vary === "speed") put("gFeed", +v.toFixed(1));
  else if (vary === "gap") put("lineGapMM", +v.toFixed(2));
  else {
    testEdited = keep;
    setStatus(
      $("testMsg"),
      "ok",
      `Strip ${k}: set the flow to ${fmt(v, 0)}% on the printer (the app doesn't change the flow).`
    );
    return;
  }
  recordSoon();
  setStatus($("testMsg"), "ok", `Strip ${k}: ${fmt(v, K.digits)} ${K.unit} is now the setting.`);
});
testRange();

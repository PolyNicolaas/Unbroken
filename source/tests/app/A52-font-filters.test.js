const A = require("../lib/app.js"), { check } = require("../lib/check.js");
module.exports = {
  id: "A52", title: "Font picker: fonts that can write the text, style filter, Cyrillic and accents",
  guards: "lettering that silently prints “?” for letters the font doesn't have",
  why: "Most fonts only have the basic Latin letters, so Cyrillic or accented text (ё, ü, é) would print as “?”. The font list sets apart and greys the fonts missing a letter of the typed text, says which letters, and the Style buttons narrow the list, while every font stays pickable for saved designs and presets.",
  how: "Types Cyrillic with Sans picked, reads the menu and the hint, picks Pebble and Bad Script and traces each, tries the Script style, then traces accented Latin.",
  pass: "With Cyrillic, Sans warns and names the missing letters, the Latin-only fonts sit greyed under “Missing letters” while Pebble, Bad Script and Chocolate stay enabled; both trace the Cyrillic with zero crossings; Script puts the script fonts that can write it (Bad Script, Chocolate) at the top and the rest under “Other styles”; accented Latin in Pebble traces with no warning; no page errors.",
  slow: true,
  async run(ctx) {
    const { page, errors, close } = await A.open(ctx), checks = [];
    await A.source(page, "text"); await A.idle(page, 800);
    await page.selectOption("#font", "sans");
    await page.fill("#textIn", "Привет ёж"); await page.dispatchEvent("#textIn", "input"); await A.idle(page, 800);
    const menu = () => page.$$eval("#font option", (os) => Object.fromEntries(os.map((o) => [o.value, {
      disabled: o.disabled, group: o.parentElement.tagName === "OPTGROUP" ? o.parentElement.label : "" }])));
    let m = await menu();
    const hint = await page.textContent("#fontHint"), cls = await page.getAttribute("#fontHint", "class");
    checks.push(
      check("Sans: warning names ё", +(/warn/.test(cls) && hint.includes("ё")), "==", 1),
      check("Sans stays picked and enabled", +(!m.sans.disabled && (await page.inputValue("#font")) === "sans"), "==", 1),
      check("Readability greyed under Missing letters", +(m.readability.disabled && /Missing/.test(m.readability.group)), "==", 1),
      check("Pebble can write it", +(!m.pebble.disabled && !m.pebble.group), "==", 1),
      check("Bad Script can write it", +(!m.badscript.disabled && !m.badscript.group), "==", 1),
      check("Chocolate can write it", +(!m.chocolate.disabled && !m.chocolate.group), "==", 1),
    );
    for (const f of ["pebble", "badscript"]) {
      await page.selectOption("#font", f); await A.idle(page, 1200);
      checks.push(
        check(`${f}: Cyrillic crossings`, +((await page.textContent("#uncrossVal")).split("→").pop()), "==", 0),
        check(`${f}: no warning`, +/warn/.test(await page.getAttribute("#fontHint", "class")), "==", 0),
      );
    }
    await page.click("label[for=fsHand]"); await A.idle(page, 300);
    const first = await page.$eval("#font option", (o) => o.value);
    m = await menu();
    checks.push(check("Script: a script font that writes it first", +["badscript", "chocolate"].includes(first), "==", 1),
      check("Script: Bad Script and Chocolate at the top", +(!m.badscript.group && !m.chocolate.group), "==", 1),
      check("Script: Pebble under Other styles", +/Other/.test(m.pebble.group), "==", 1));
    await page.click("label[for=fsAll]");
    await page.selectOption("#font", "pebble");
    await page.fill("#textIn", "Café Über ñ"); await page.dispatchEvent("#textIn", "input"); await A.idle(page, 1200);
    checks.push(
      check("accents: no warning", +/warn/.test(await page.getAttribute("#fontHint", "class")), "==", 0),
      check("accents: crossings", +((await page.textContent("#uncrossVal")).split("→").pop()), "==", 0),
      check("page errors", errors.length, "==", 0),
    );
    await close(); return { checks };
  },
};

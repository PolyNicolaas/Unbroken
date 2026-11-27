// Display fonts to try as morph fonts (needs, in this folder: npm i @fontsource/lobster @fontsource/playfair-display …).
// node sheet.js lobster playfair → each font as the morph makes it (lobster.png …); node sweep.js lobster → the check.
const { fromFile } = require("./gen2.js");
const fs = (p, w = 400) => `${__dirname}/node_modules/@fontsource/${p}/files/${p}-latin-${w}-normal.woff`;
const F = (name, pkg, w, bold) => () => fromFile({ name, family: name, file: fs(pkg, w), bold });
module.exports = {
  lobster: F("Lobster", "lobster", 400, 25),
  berkshire: F("Berkshire Swash", "berkshire-swash", 400, 25),
  cinzel: F("Cinzel Decorative", "cinzel-decorative", 900, 25),
  playfair: F("Playfair Display", "playfair-display", 900, 35),
  abril: F("Abril Fatface", "abril-fatface", 400, 40),
  rye: F("Rye", "rye", 400, 15),
  pacifico: F("Pacifico", "pacifico", 400, 15),
  yeseva: F("Yeseva One", "yeseva-one", 400, 35),
  fascinate: F("Fascinate", "fascinate", 400, 15),
  sancreek: F("Sancreek", "sancreek", 400, 15),
  lilita: F("Lilita One", "lilita-one", 400, 10),
};

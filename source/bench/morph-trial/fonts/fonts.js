// the trial fonts (font units: cap 700; the thinnest stroke must stay >= ~110, about 2 lines at a 20 mm letter)
const { make } = require("./gen.js");
module.exports = {
  roman: () => make({ name: "Roman", base: "sans", nib: 190, thin: 115, angle: 30, serif: 230, serifT: 110 }),
  italic: () => make({ name: "Italic", base: "sans", nib: 200, thin: 115, angle: 40, slant: 12 }),
  didone: () => make({ name: "Didone", base: "sans", nib: 210, thin: 110, angle: 0, ball: 95, serif: 240, serifT: 110 }),
  script: () => make({ name: "Script", base: "script", nib: 190, thin: 110, angle: 35 }),
};

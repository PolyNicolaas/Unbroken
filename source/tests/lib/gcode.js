// Reads a G-code file the way the printer would, for the tests: every move with where it starts and ends, its E,
// its feed, and the section it is in (start lines, a copy, a wipe, the end lines). Absolute XYZ (G90) and E (M82),
// G92 E resets, G0 / G1 moves; other lines (pauses, host commands) are kept as "other".
function readGcode(text) {
  const moves = [], copies = [], other = [];
  let x = 0, y = 0, z = 0, e = 0, f = 0, section = "start", copy = -1, layer = 0, wiping = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(), code = line.split(";")[0].trim(), note = line.includes(";") ? line.slice(line.indexOf(";") + 1).trim() : "";
    if (!code) {
      let m;
      if ((m = /^copy (\d+) of (\d+)/.exec(note))) { copy = +m[1] - 1; copies[copy] = { from: moves.length, layers: [] }; section = "copy"; wiping = false; layer = 0; }
      else if ((m = /^layer (\d+) of (\d+) \((fill|wall)\)/.exec(note))) {
        if (copy < 0) { copy = 0; copies[0] = { from: moves.length, layers: [] }; section = "copy"; }   // one copy: the file has no "; copy" line
        layer = +m[1]; copies[copy].layers.push({ n: +m[1], of: +m[2], kind: m[3], from: moves.length }); }
      else if (/^wipe/.test(note)) wiping = true;
      else if (/^printer end/.test(note)) section = "end";
      continue;
    }
    const w = code.split(/\s+/), g = w[0], v = {};
    for (const t of w.slice(1)) v[t[0]] = +t.slice(1);
    if (g === "G92") { if ("E" in v) e = v.E; continue; }
    if (g !== "G0" && g !== "G1") { other.push({ line, section, copy }); continue; }
    const from = { x, y, z, e };
    if ("X" in v) x = v.X; if ("Y" in v) y = v.Y; if ("Z" in v) z = v.Z; if ("E" in v) e = v.E; if ("F" in v) f = v.F;
    moves.push({ g, from, x, y, z, e, de: e - from.e, f, dist: Math.hypot(x - from.x, y - from.y, z - from.z), xy: Math.hypot(x - from.x, y - from.y), section, copy, layer, wiping, note });
  }
  for (const c of copies) if (c) c.to = moves.length;
  copies.forEach((c, i) => { if (copies[i + 1]) c.to = copies[i + 1].from; });
  const end = moves.findIndex((m) => m.section === "end"); if (end > 0 && copies.length) copies[copies.length - 1].to = end;
  return { moves, copies, other };
}
module.exports = { readGcode };

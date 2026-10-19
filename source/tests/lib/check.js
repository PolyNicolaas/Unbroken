// check(name, value, op, limit, digits): one pass/fail line for the report
// A NaN value never passes (not even "!="), and an operator it doesn't know is a mistake in the test, not a pass.
const OPS = { "<=": (a, b) => a <= b, ">=": (a, b) => a >= b, "==": (a, b) => a === b, "<": (a, b) => a < b, ">": (a, b) => a > b, "!=": (a, b) => a !== b };
function check(name, value, op, limit, digits = 3) {
  if (!OPS[op]) throw new Error(`check "${name}": unknown operator ${op}`);
  const ok = !(typeof value === "number" && Number.isNaN(value)) && OPS[op](value, limit);
  const f = (v) => (typeof v === "number" && !Number.isInteger(v) ? v.toFixed(digits) : String(v));
  return { name, value: f(value), limit: `${op} ${f(limit)}`, ok };
}
module.exports = { check };

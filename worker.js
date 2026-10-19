/* Unbroken — background engine. Runs UNB functions off the page so the controls stay responsive.
   Message in:  { id, fn, args }   (fn is an UNB function name; crossing areas arrive as { allowMask, allowW, allowH })
   Messages out: { ready } once loaded; { id, progress } for each step of a step-by-step search; { id, result } or { id, error }. */
importScripts("core.js");
onmessage = (e) => {
  const { id, fn, args } = e.data;
  try {
    let r = UNB[fn](...UNB.decodeArgs(args));
    if (r && typeof r.next === "function") {
      let s;
      while (!(s = r.next()).done) postMessage({ id, progress: s.value });
      r = s.value;
    }
    postMessage({ id, result: r });
  } catch (err) {
    postMessage({ id, error: String((err && err.stack) || err) });
  }
};
postMessage({ ready: true });

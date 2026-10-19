/* Unbroken · engine · 01-image.js
   1. Image in — RGBA pixels → a clean grayscale image.
   One part of the engine (no DOM), loaded after 00-util.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { gaussKernel } = UNB._u; // shared helpers (00-util.js)

  // RGBA → gray 0–255 (luma); transparent pixels count as white paper
  UNB.toGray = function (rgba, w, h) {
    const g = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const a = rgba[4 * i + 3] / 255;
      const l = 0.299 * rgba[4 * i] + 0.587 * rgba[4 * i + 1] + 0.114 * rgba[4 * i + 2];
      g[i] = l * a + 255 * (1 - a);
    }
    return g;
  };

  // Gaussian blur, sigma in pixels (separable; edges repeat the border pixel). sigma ≤ 0: a copy.
  UNB.blur = function (src, w, h, sigma) {
    if (sigma <= 0) return Float32Array.from(src);
    const k = gaussKernel(sigma),
      r = (k.length - 1) / 2;
    const tmp = new Float32Array(w * h),
      out = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let a = 0;
        for (let i = -r; i <= r; i++) {
          const xx = Math.min(w - 1, Math.max(0, x + i));
          a += k[i + r] * src[y * w + xx];
        }
        tmp[y * w + x] = a;
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let a = 0;
        for (let i = -r; i <= r; i++) {
          const yy = Math.min(h - 1, Math.max(0, y + i));
          a += k[i + r] * tmp[yy * w + x];
        }
        out[y * w + x] = a;
      }
    return out;
  };

  // fast box blur (3 passes ≈ Gaussian), for lighting correction
  function boxBlur(src, w, h, r) {
    let a = Float32Array.from(src),
      b = new Float32Array(w * h);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) {
        let acc = 0;
        const o = y * w;
        for (let x = -r; x <= r; x++) acc += a[o + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) {
          b[o + x] = acc / (2 * r + 1);
          acc += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)];
        }
      }
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) {
          a[y * w + x] = acc / (2 * r + 1);
          acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
        }
      }
    }
    return a;
  }

  // Image prep, RGBA → grayscale. o: bgTol (0–100: flood a plain background from the border to white), flatten
  // (even out lighting: divide by a wide blur), brightness (−100–100), contrast (−100–100+).
  UNB.prep = function (rgba, w, h, o) {
    const N = w * h,
      g = UNB.toGray(rgba, w, h);
    if (o.bgTol > 0) {
      // flood from the border through colours close to the border colour
      const bx = [];
      for (let x = 0; x < w; x++) bx.push(x, (h - 1) * w + x);
      for (let y = 0; y < h; y++) bx.push(y * w, y * w + w - 1);
      const med = (c) => {
        const v = bx.map((i) => rgba[4 * i + c]).sort((p, q) => p - q);
        return v[v.length >> 1];
      };
      const ref = [med(0), med(1), med(2)],
        tol2 = (o.bgTol * 2.55) ** 2,
        seen = new Uint8Array(N),
        st = [];
      const near = (i) =>
        (rgba[4 * i] - ref[0]) ** 2 + (rgba[4 * i + 1] - ref[1]) ** 2 + (rgba[4 * i + 2] - ref[2]) ** 2 <= tol2 * 3;
      for (const i of bx)
        if (!seen[i] && near(i)) {
          seen[i] = 1;
          st.push(i);
        }
      while (st.length) {
        const p = st.pop();
        g[p] = 255;
        const x = p % w,
          y = (p / w) | 0;
        if (x > 0 && !seen[p - 1] && near(p - 1)) {
          seen[p - 1] = 1;
          st.push(p - 1);
        }
        if (x < w - 1 && !seen[p + 1] && near(p + 1)) {
          seen[p + 1] = 1;
          st.push(p + 1);
        }
        if (y > 0 && !seen[p - w] && near(p - w)) {
          seen[p - w] = 1;
          st.push(p - w);
        }
        if (y < h - 1 && !seen[p + w] && near(p + w)) {
          seen[p + w] = 1;
          st.push(p + w);
        }
      }
    }
    if (o.flatten) {
      const bl = boxBlur(g, w, h, Math.max(4, Math.round(Math.max(w, h) / 24)));
      for (let i = 0; i < N; i++) g[i] = Math.min(255, (g[i] / Math.max(8, bl[i])) * 235);
    }
    if (o.brightness || o.contrast) {
      const c = 1 + (o.contrast || 0) / 100,
        b = (o.brightness || 0) * 1.28;
      for (let i = 0; i < N; i++) g[i] = Math.min(255, Math.max(0, (g[i] - 128) * c + 128 + b));
    }
    return g;
  };

  // Edge strength (central-difference gradient magnitude), spread by a small box blur; used to score traces.
  UNB.gradient = function (g, w, h) {
    const out = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        out[i] = Math.hypot(g[i + 1] - g[i - 1], g[i + w] - g[i - w]);
      }
    // centerlines sit inside strokes, not on their edges: spread the gradient a few px so both modes score fairly
    return boxBlur(out, w, h, 2);
  };
})(typeof window !== "undefined" ? window : globalThis);

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

  // Image prep, RGBA → grayscale. o: bgTol (0–100: flood a plain background from the border to white), bgAt ([x, y]
  // px: flood from there instead, through the colour tapped, and from the border where it has that colour), flatten
  // (even out lighting: divide by a wide blur), brightness (−100–100), contrast (−100–100+).
  UNB.prep = function (rgba, w, h, o) {
    const N = w * h,
      g = UNB.toGray(rgba, w, h);
    if (o.bgTol > 0) {
      // flood from the border through colours close to the border colour; or, with a tapped point (bgAt: [x, y] px),
      // from there through colours close to the colour tapped (the median of the 5 × 5 round it)
      const bx = [];
      for (let x = 0; x < w; x++) bx.push(x, (h - 1) * w + x);
      for (let y = 0; y < h; y++) bx.push(y * w, y * w + w - 1);
      const at = o.bgAt && o.bgAt[0] >= 0 && o.bgAt[1] >= 0 && o.bgAt[0] < w && o.bgAt[1] < h ? o.bgAt : null,
        pick = [];
      if (at)
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const x = Math.round(at[0]) + dx,
              y = Math.round(at[1]) + dy;
            if (x >= 0 && y >= 0 && x < w && y < h) pick.push(y * w + x);
          }
      const from = at ? pick : bx;
      const med = (c) => {
        const v = from.map((i) => rgba[4 * i + c]).sort((p, q) => p - q);
        return v[v.length >> 1];
      };
      const ref = [med(0), med(1), med(2)],
        tol2 = (o.bgTol * 2.55) ** 2,
        seen = new Uint8Array(N),
        st = [];
      const near = (i) =>
        (rgba[4 * i] - ref[0]) ** 2 + (rgba[4 * i + 1] - ref[1]) ** 2 + (rgba[4 * i + 2] - ref[2]) ** 2 <= tol2 * 3;
      for (const i of at ? pick.concat(bx) : bx)
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

  // Grey levels (posterize): the picture as `count` flat greys (2–6). The greys are found by k-means on the picture's
  // histogram (starting spread evenly from its darkest to its lightest greys, so a mostly white picture still gets its
  // darker
  // greys); smooth (0–10 px)
  // then gives every pixel the level most of its neighbours within that radius have (twice), which removes specks and
  // rounds each block's edges. Returns { lab (Uint8Array: level per pixel, 0 = darkest), tones (each level's grey,
  // darkest first), cuts (the greys between levels), count (pixels per level) }.
  UNB.levels = function (gray, w, h, o) {
    const N = w * h,
      K = Math.max(2, Math.min(6, Math.round((o && o.count) || 4))),
      hist = new Float64Array(256);
    for (let i = 0; i < N; i++) hist[Math.max(0, Math.min(255, Math.round(gray[i])))]++;
    // starting greys spread evenly between the darkest and lightest 1% (quantiles would put most of them on the paper)
    const atShare = (f) => {
      let acc = 0;
      for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= f * N) return v;
      return 255;
    };
    const lo = atShare(0.01),
      hi = Math.max(lo + 1, atShare(0.99));
    let c = [];
    for (let j = 0; j < K; j++) c.push(lo + ((hi - lo) * (j + 0.5)) / K);
    for (let it = 0; it < 30; it++) {
      c.sort((a, b) => a - b);
      const sum = new Float64Array(K),
        n = new Float64Array(K);
      let k = 0;
      for (let v = 0; v < 256; v++) {
        while (k < K - 1 && Math.abs(v - c[k + 1]) < Math.abs(v - c[k])) k++;
        sum[k] += v * hist[v];
        n[k] += hist[v];
      }
      let moved = 0;
      for (let j = 0; j < K; j++)
        if (n[j]) {
          const m = sum[j] / n[j];
          moved += Math.abs(m - c[j]);
          c[j] = m;
        }
      if (moved < 0.05) break;
    }
    c.sort((a, b) => a - b);
    // two greys that met (a picture with fewer greys than levels): spread them apart so each level keeps a range
    for (let j = 1; j < K; j++) if (c[j] - c[j - 1] < 1) c[j] = Math.min(255, c[j - 1] + 1);
    const cuts = [];
    for (let j = 0; j + 1 < K; j++) cuts.push((c[j] + c[j + 1]) / 2);
    let lab = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      let j = 0;
      while (j < K - 1 && gray[i] > cuts[j]) j++;
      lab[i] = j;
    }
    const r = Math.max(0, Math.round((o && o.smooth) || 0));
    for (let pass = 0; pass < 2 && r > 0; pass++) {
      // majority within (2r + 1)²: a box sum of each level's indicator, the biggest wins (ties keep the pixel's own)
      const sums = [];
      for (let j = 0; j < K; j++) {
        const ind = new Float32Array(N);
        for (let i = 0; i < N; i++) ind[i] = lab[i] === j ? 1 : 0;
        sums.push(boxSum(ind, w, h, r));
      }
      const out = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        let best = lab[i],
          bv = sums[best][i];
        for (let j = 0; j < K; j++)
          if (sums[j][i] > bv + 1e-6) {
            bv = sums[j][i];
            best = j;
          }
        out[i] = best;
      }
      lab = out;
    }
    const count = new Array(K).fill(0);
    for (let i = 0; i < N; i++) count[lab[i]]++;
    return { lab, tones: c.map((v) => Math.round(v)), cuts, count };
  };
  // one pass of a (2r + 1)² box sum (edges repeat the border)
  function boxSum(src, w, h, r) {
    const tmp = new Float32Array(w * h),
      out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[o + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[o + x] = acc;
        acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc;
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    return out;
  }

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

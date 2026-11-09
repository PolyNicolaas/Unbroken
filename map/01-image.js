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

  // every pixel the level most of its neighbours within r have (twice): specks go, blocks' corners round
  function smoothLabels(lab, w, h, K, r) {
    const N = w * h;
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
    return lab;
  }
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
    lab = smoothLabels(lab, w, h, K, Math.max(0, Math.round((o && o.smooth) || 0)));
    const count = new Array(K).fill(0);
    for (let i = 0; i < N; i++) count[lab[i]]++;
    return { lab, tones: c.map((v) => Math.round(v)), cuts, count };
  };

  // sRGB 0–255 → CIE Lab (D65): colours that look different are far apart
  function toLab(r, g, b) {
    const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const R = lin(r),
      G = lin(g),
      B = lin(b);
    const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
    const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047),
      y = f(0.2126 * R + 0.7152 * G + 0.0722 * B),
      z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  // Colour levels: the picture as `count` flat colours (2–6), found by k-means in Lab (the starts spread out: each the
  // colour farthest from those so far). gray: the prepared picture (UNB.prep): where it's paper white (a removed
  // background, a cut-out) the pixel counts as white. Returns UNB.levels' shape, darkest first, plus colours
  // ([[r, g, b]…] per level): { lab, tones (each level's grey), colours, cuts: null, count }.
  UNB.colourLevels = function (rgba, w, h, gray, o) {
    const N = w * h,
      K = Math.max(2, Math.min(6, Math.round((o && o.count) || 4))),
      L = new Float32Array(N),
      A = new Float32Array(N),
      Bb = new Float32Array(N),
      cache = new Map();
    for (let i = 0; i < N; i++) {
      const white = gray && gray[i] >= 254.5,
        r = white ? 255 : rgba[4 * i],
        g = white ? 255 : rgba[4 * i + 1],
        b = white ? 255 : rgba[4 * i + 2],
        key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
      let v = cache.get(key);
      if (!v) cache.set(key, (v = toLab(r, g, b)));
      L[i] = v[0];
      A[i] = v[1];
      Bb[i] = v[2];
    }
    const step = Math.max(1, Math.floor(N / 20000)),
      S = [];
    for (let i = 0; i < N; i += step) S.push(i);
    const d2 = (i, c) => (L[i] - c[0]) ** 2 + (A[i] - c[1]) ** 2 + (Bb[i] - c[2]) ** 2;
    // starts: the darkest sample, then each the farthest from those so far
    let first = S[0];
    for (const i of S) if (L[i] < L[first]) first = i;
    const cen = [[L[first], A[first], Bb[first]]],
      near = new Float64Array(S.length).fill(Infinity);
    while (cen.length < K) {
      let far = -1,
        at = 0;
      S.forEach((i, j) => {
        near[j] = Math.min(near[j], d2(i, cen[cen.length - 1]));
        if (near[j] > far) ((far = near[j]), (at = i));
      });
      cen.push([L[at], A[at], Bb[at]]);
    }
    for (let it = 0; it < 20; it++) {
      const sum = cen.map(() => [0, 0, 0, 0]);
      for (const i of S) {
        let best = 0,
          bd = Infinity;
        for (let c = 0; c < K; c++) {
          const d = d2(i, cen[c]);
          if (d < bd) ((bd = d), (best = c));
        }
        const q = sum[best];
        q[0] += L[i];
        q[1] += A[i];
        q[2] += Bb[i];
        q[3]++;
      }
      let moved = 0;
      for (let c = 0; c < K; c++)
        if (sum[c][3]) {
          const m = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
          moved += Math.abs(m[0] - cen[c][0]) + Math.abs(m[1] - cen[c][1]) + Math.abs(m[2] - cen[c][2]);
          cen[c] = m;
        }
      if (moved < 0.1) break;
    }
    // every pixel to its nearest colour, the colours darkest first
    const order = cen.map((c, j) => j).sort((p, q) => cen[p][0] - cen[q][0]),
      rank = new Uint8Array(K);
    order.forEach((j, r) => (rank[j] = r));
    let lab = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      let best = 0,
        bd = Infinity;
      for (let c = 0; c < K; c++) {
        const d = d2(i, cen[c]);
        if (d < bd) ((bd = d), (best = c));
      }
      lab[i] = rank[best];
    }
    lab = smoothLabels(lab, w, h, K, Math.max(0, Math.round((o && o.smooth) || 0)));
    // each level's colour: the mean of its pixels; its grey: that colour's luma
    const sum = Array.from({ length: K }, () => [0, 0, 0, 0]);
    for (let i = 0; i < N; i++) {
      const q = sum[lab[i]],
        white = gray && gray[i] >= 254.5;
      q[0] += white ? 255 : rgba[4 * i];
      q[1] += white ? 255 : rgba[4 * i + 1];
      q[2] += white ? 255 : rgba[4 * i + 2];
      q[3]++;
    }
    const colours = sum.map((q) => (q[3] ? [0, 1, 2].map((c) => Math.round(q[c] / q[3])) : [255, 255, 255]));
    const tones = colours.map(([r, g, b]) => Math.round(0.299 * r + 0.587 * g + 0.114 * b)),
      count = sum.map((q) => q[3]);
    return { lab, tones, colours, cuts: null, count };
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

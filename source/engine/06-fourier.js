/* Unbroken · engine · 06-fourier.js
   5. Fourier series — path → evenly spaced samples → one series per axis, x(t) and y(t) → the curve rebuilt from the
   chosen terms.
   One part of the engine (no DOM), loaded after 05-fill.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { cumLength } = UNB._u; // shared helpers (00-util.js)

  // A closed path → S points evenly spaced along it (re, im = x, y), seg[s] = the path segment sample s lies on,
  // length = the path's length (back to the start included).
  UNB.resample = function (x, y, S) {
    const m = x.length,
      cum = cumLength(x, y, true);
    const total = cum[m],
      re = new Float64Array(S),
      im = new Float64Array(S),
      segIdx = new Int32Array(S);
    let k = 0;
    for (let s = 0; s < S; s++) {
      const u = (total * s) / S;
      while (k < m - 1 && cum[k + 1] < u) k++;
      const seg = cum[k + 1] - cum[k],
        t = seg > 0 ? (u - cum[k]) / seg : 0,
        j = (k + 1) % m;
      re[s] = x[k] + t * (x[j] - x[k]);
      im[s] = y[k] + t * (y[j] - y[k]);
      segIdx[s] = k;
    }
    return { re, im, seg: segIdx, length: total };
  };

  // FFT (radix-2, unnormalized; inverse = conjugate kernel)
  UNB.fft = function (re, im, inverse) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = ((inverse ? 2 : -2) * Math.PI) / len,
        wr = Math.cos(ang),
        wi = Math.sin(ang),
        half = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1,
          ci = 0;
        for (let j = 0; j < half; j++) {
          const a = i + j,
            b = a + half;
          const tr = re[b] * cr - im[b] * ci,
            ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
          const nr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = nr;
        }
      }
    }
  };

  // The line as three real series, one per axis (the X/Y/Z engine):
  // x(t) = x₀ + Σ a_k cos(2πkt + φ_k), y(t) = y₀ + Σ b_k cos(2πkt + ψ_k), z(t) comes from the layers (UNB.layerStack),
  // not a series
  // One complex FFT of z = x + iy gives both axes at once: X_k = (Z_k + conj Z₋ₖ) / 2 and Y_k = (Z_k − conj Z₋ₖ) / 2i.
  // A term is one axis at one frequency, coded k·2 + axis (axis 0 = x, 1 = y); its amplitude is 2|X_k| (|X_k| at k = 0
  // and k = S/2) and its phase arg X_k. Terms are ordered strongest first, the two offsets (k = 0) always first.
  UNB.spectrum = function (re, im) {
    const S = re.length,
      cr = Float64Array.from(re),
      ci = Float64Array.from(im);
    UNB.fft(cr, ci, false);
    for (let k = 0; k < S; k++) {
      cr[k] /= S;
      ci[k] /= S;
    }
    const H = S / 2,
      xr = new Float64Array(H + 1),
      xi = new Float64Array(H + 1),
      yr = new Float64Array(H + 1),
      yi = new Float64Array(H + 1);
    for (let k = 0; k <= H; k++) {
      const j = (S - k) % S,
        ar = cr[k],
        ai = ci[k],
        br = cr[j],
        bi = -ci[j]; // Z_k and conj Z₋ₖ
      xr[k] = (ar + br) / 2;
      xi[k] = (ai + bi) / 2;
      yr[k] = (ai - bi) / 2;
      yi[k] = -(ar - br) / 2;
    }
    const ax = { S, xr, xi, yr, yi },
      nT = 2 * (H + 1);
    // each term's size worked out once (the sort used to recompute it on every comparison, 20–50× the FFT's time)
    const amp = new Float64Array(nT),
      order = [];
    for (let c = 0; c < nT; c++) {
      amp[c] = UNB.termOf(c, ax).amp;
      order.push(c);
    }
    order.sort((a, b) => ((a >> 1 === 0) !== (b >> 1 === 0) ? (a >> 1 === 0 ? -1 : 1) : amp[b] - amp[a]));
    return { S, ax, order };
  };
  // one term as { axis: "x" | "y", k (turns per cycle), amp, phase }: that axis gets amp · cos(2πkt + phase)
  UNB.termOf = function (code, ax) {
    const k = code >> 1,
      y = code & 1,
      r = y ? ax.yr[k] : ax.xr[k],
      i = y ? ax.yi[k] : ax.xi[k],
      edge = k === 0 || k === ax.S / 2;
    return { axis: y ? "y" : "x", k, amp: (edge ? 1 : 2) * Math.hypot(r, i), phase: Math.atan2(i, r) };
  };
  // the line from the chosen terms: each axis term goes back into the complex spectrum (X at ±k, iY at ±k), one inverse
  // FFT
  UNB.synth = function (ax, codes) {
    const S = ax.S,
      re = new Float64Array(S),
      im = new Float64Array(S);
    for (const c of codes) {
      const k = c >> 1,
        j = (S - k) % S;
      if (c & 1) {
        const a = ax.yr[k],
          b = ax.yi[k];
        re[k] -= b;
        im[k] += a;
        if (j !== k) {
          re[j] += b;
          im[j] += a;
        }
      } else {
        const a = ax.xr[k],
          b = ax.xi[k];
        re[k] += a;
        im[k] += b;
        if (j !== k) {
          re[j] += a;
          im[j] -= b;
        }
      }
    }
    UNB.fft(re, im, true);
    return { re, im };
  };
})(typeof window !== "undefined" ? window : globalThis);

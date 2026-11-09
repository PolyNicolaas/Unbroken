/* Unbroken · engine · 14-photo.js
   13. Photos — a camera photo → a clean picture: the page found and flattened to a rectangle, the light evened out,
   the paper made white and the ink kept (a drawing or printed art), or an object's colours balanced.
   One part of the engine (no DOM), loaded after 13-patterns.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { labelComponents } = UNB._u; // shared helpers (00-util.js)

  // a small copy for finding the page: each cell's mean luma and how colourful it is (max − min channel), longest
  // side `side` cells
  function photoCells(rgba, w, h, side) {
    const f = Math.max(1, Math.max(w, h) / side),
      sw = Math.max(1, Math.round(w / f)),
      sh = Math.max(1, Math.round(h / f)),
      L = new Float32Array(sw * sh),
      S = new Float32Array(sw * sh),
      n = new Float32Array(sw * sh);
    const step = Math.max(1, Math.floor(f / 3)); // a few samples per cell is plenty
    for (let y = 0; y < h; y += step) {
      const cy = Math.min(sh - 1, (y / f) | 0);
      for (let x = 0; x < w; x += step) {
        const i = 4 * (y * w + x),
          r = rgba[i],
          g = rgba[i + 1],
          b = rgba[i + 2],
          c = cy * sw + Math.min(sw - 1, (x / f) | 0);
        L[c] += 0.299 * r + 0.587 * g + 0.114 * b;
        S[c] += Math.max(r, g, b) - Math.min(r, g, b);
        n[c]++;
      }
    }
    for (let i = 0; i < L.length; i++) {
      L[i] /= n[i] || 1;
      S[i] /= n[i] || 1;
    }
    return { L, S, sw, sh, f: w / sw, fy: h / sh };
  }
  // the convex hull of points [[x, y]…] (monotone chain), anticlockwise in screen terms
  function convexHull(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]),
      lo = [],
      hi = [];
    for (const p of pts) {
      while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
      lo.push(p);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop();
      hi.push(p);
    }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }
  const quadArea = (q) => {
    let a = 0;
    for (let i = 0; i < q.length; i++) {
      const p = q[i],
        r = q[(i + 1) % q.length];
      a += p[0] * r[1] - r[0] * p[1];
    }
    return Math.abs(a) / 2;
  };
  // the four hull points that enclose the most area (the page's corners); hull in order
  function widestQuad(hull) {
    let H = hull;
    if (H.length > 48) H = Array.from({ length: 48 }, (_, i) => hull[Math.floor((i * hull.length) / 48)]);
    const n = H.length;
    if (n < 4) return null;
    const tri = (a, b, c) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
    let best = -1,
      out = null;
    for (let i = 0; i < n; i++)
      for (let k = i + 2; k < n; k++) {
        // the best j between i and k and the best l after k each add a triangle on their side of the diagonal i–k
        let bj = -1,
          aj = -1,
          bl = -1,
          al = -1;
        for (let j = i + 1; j < k; j++) {
          const a = tri(H[i], H[j], H[k]);
          if (a > aj) ((aj = a), (bj = j));
        }
        for (let l = k + 1; l < n + i; l++) {
          const a = tri(H[i], H[k], H[l % n]);
          if (a > al) ((al = a), (bl = l % n));
        }
        if (bj >= 0 && bl >= 0 && aj + al > best) {
          best = aj + al;
          out = [H[i], H[bj], H[k], H[bl]];
        }
      }
    return out;
  }
  // corners as top-left, top-right, bottom-right, bottom-left
  function orderCorners(q) {
    const cx = q.reduce((s, p) => s + p[0], 0) / 4,
      cy = q.reduce((s, p) => s + p[1], 0) / 4;
    const byAngle = q.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
    let s = 0;
    for (let i = 1; i < 4; i++) if (byAngle[i][0] + byAngle[i][1] < byAngle[s][0] + byAngle[s][1]) s = i;
    return [0, 1, 2, 3].map((i) => byAngle[(s + i) % 4]); // (screen y down: increasing angle goes clockwise)
  }

  // Find a page (paper, a card, a screen) in a photo: the largest light, plain area. Returns { corners: [[x, y] × 4]
  // in px (top-left, top-right, bottom-right, bottom-left), share (its area ÷ the photo's), fill (how much of the
  // corners' four-sided shape is that area: near 1 for a page) , found (both look like a page) }, or null.
  UNB.findPage = function (rgba, w, h, o = {}) {
    const C = photoCells(rgba, w, h, o.side || 160),
      { sw, sh } = C,
      N = sw * sh;
    // paper: light and plain (a colourful area counts as darker)
    const v = new Float32Array(N);
    for (let i = 0; i < N; i++) v[i] = C.L[i] - 0.6 * C.S[i];
    // first as it is; if no page shows, with the light divided out (light falling off across the photo can make the
    // page's shaded end darker than the lit table): each cell against the mean of a wide square round it
    let best = pageIn(rgba, w, h, C, v);
    if (!best || !best.found) {
      const R = Math.max(2, Math.round(Math.max(sw, sh) / 4)),
        I = new Float64Array((sw + 1) * (sh + 1));
      for (let y = 0; y < sh; y++)
        for (let x = 0; x < sw; x++)
          I[(y + 1) * (sw + 1) + x + 1] =
            v[y * sw + x] + I[y * (sw + 1) + x + 1] + I[(y + 1) * (sw + 1) + x] - I[y * (sw + 1) + x];
      const rel = new Float32Array(N);
      for (let y = 0; y < sh; y++)
        for (let x = 0; x < sw; x++) {
          const x0 = Math.max(0, x - R),
            y0 = Math.max(0, y - R),
            x1 = Math.min(sw, x + R + 1),
            y1 = Math.min(sh, y + R + 1),
            m =
              (I[y1 * (sw + 1) + x1] - I[y0 * (sw + 1) + x1] - I[y1 * (sw + 1) + x0] + I[y0 * (sw + 1) + x0]) /
              ((x1 - x0) * (y1 - y0));
          rel[y * sw + x] = Math.min(255, (128 * Math.max(0, v[y * sw + x])) / Math.max(8, m));
        }
      const again = pageIn(rgba, w, h, C, rel);
      if (again && (again.found || !best)) best = again;
    }
    return best;
  };
  // the page in one brightness map of the cells (v): the largest area lighter than the photo's split (Otsu)
  function pageIn(rgba, w, h, C, v) {
    const { sw, sh } = C,
      N = sw * sh;
    const t = UNB.otsu(v),
      mask = new Uint8Array(N);
    for (let i = 0; i < N; i++) mask[i] = v[i] > t ? 1 : 0;
    // close the drawing's lines (dark lines on the page would split it): grow 2 cells, then shrink 2
    // grow (any neighbour on) or shrink (every neighbour on; outside the photo counts as on, so an edge stays)
    const grow = (m, on) => {
      const r = new Uint8Array(N);
      for (let y = 0; y < sh; y++)
        for (let x = 0; x < sw; x++) {
          let any = 0,
            all = 1;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const X = x + dx,
                Y = y + dy,
                val = X >= 0 && Y >= 0 && X < sw && Y < sh ? m[Y * sw + X] : on ? 0 : 1;
              any |= val;
              all &= val;
            }
          r[y * sw + x] = on ? any : all;
        }
      return r;
    };
    let m = mask;
    for (let k = 0; k < 2; k++) m = grow(m, true);
    for (let k = 0; k < 2; k++) m = grow(m, false);
    const { lab, n } = labelComponents(m, sw, sh);
    if (!n) return null;
    const area = new Float64Array(n);
    for (let i = 0; i < N; i++) if (lab[i] >= 0) area[lab[i]]++;
    let big = 0;
    for (let k = 1; k < n; k++) if (area[k] > area[big]) big = k;
    // the outline's points (cell corners, so a page edge on the photo's edge reaches it)
    const pts = [];
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        const i = y * sw + x;
        if (lab[i] !== big) continue;
        const edge =
          x === 0 ||
          y === 0 ||
          x === sw - 1 ||
          y === sh - 1 ||
          lab[i - 1] !== big ||
          lab[i + 1] !== big ||
          lab[i - sw] !== big ||
          lab[i + sw] !== big;
        // (cell middles; a cell on the photo's edge reaches the edge)
        if (edge) pts.push([x === 0 ? 0 : x === sw - 1 ? sw : x + 0.5, y === 0 ? 0 : y === sh - 1 ? sh : y + 0.5]);
      }
    const q = widestQuad(convexHull(pts));
    if (!q) return null;
    const qa = quadArea(q),
      share = qa / N,
      fill = Math.min(1, area[big] / Math.max(1, qa));
    let corners = orderCorners(q).map(([x, y]) => [Math.min(w, x * C.f), Math.min(h, y * C.fy)]);
    const sharp = sharpenCorners(rgba, w, h, corners, 1.5 * Math.max(C.f, C.fy));
    if (sharp) corners = sharp;
    // (a page has a sharp edge on every side inside the photo: light falling off across a plain table or paper doesn't)
    return { corners, share, fill, sharp: !!sharp, found: !!sharp && fill > 0.85 && share > 0.08 && share < 0.985 };
  }

  // The corners found on the small copy, made exact on the photo: along each side, the strongest step from light (the
  // page) to dark (outside) within `reach` px either side; a straight line through those steps; the corners where the
  // lines meet. Null when a side has too few steps to trust (a side on the photo's edge keeps its corners).
  function sharpenCorners(rgba, w, h, q, reach) {
    const lum = (x, y) => {
      x = Math.max(0, Math.min(w - 1, Math.round(x)));
      y = Math.max(0, Math.min(h - 1, Math.round(y)));
      const i = 4 * (y * w + x);
      return 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    };
    const cx = q.reduce((s, p) => s + p[0], 0) / 4,
      cy = q.reduce((s, p) => s + p[1], 0) / 4,
      lines = [];
    for (let e = 0; e < 4; e++) {
      const a = q[e],
        b = q[(e + 1) % 4],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      let nx = -(b[1] - a[1]) / len,
        ny = (b[0] - a[0]) / len;
      const mx = (a[0] + b[0]) / 2,
        my = (a[1] + b[1]) / 2;
      if (nx * (cx - mx) + ny * (cy - my) > 0) ((nx = -nx), (ny = -ny)); // the normal points out of the page
      // a side along the photo's edge (both ends on the same edge) has no step to find
      const onEdge = [(p) => p[0] <= 1, (p) => p[1] <= 1, (p) => p[0] >= w - 1, (p) => p[1] >= h - 1].some(
        (f) => f(a) && f(b)
      );
      if (onEdge) {
        lines.push(null);
        continue;
      }
      const hits = [];
      for (let k = 1; k < 24; k++) {
        const t = 0.08 + (0.84 * k) / 24,
          px = a[0] + (b[0] - a[0]) * t,
          py = a[1] + (b[1] - a[1]) * t;
        let best = 0,
          at = 0;
        // (three samples along the side either way of the step, against the grain)
        const across = (x, y) => (lum(x - ny * 1.5, y + nx * 1.5) + lum(x, y) + lum(x + ny * 1.5, y - nx * 1.5)) / 3;
        for (let d = -reach; d <= reach; d += 0.5) {
          const step =
            across(px + nx * (d - 1.5), py + ny * (d - 1.5)) - across(px + nx * (d + 1.5), py + ny * (d + 1.5));
          if (step > best) ((best = step), (at = d));
        }
        if (best > 20) hits.push([px + nx * at, py + ny * at]);
      }
      if (hits.length < 8) return null;
      // the line through the hits (total least squares), after dropping the farthest quarter once
      const fit = (P) => {
        const mx = P.reduce((s, p) => s + p[0], 0) / P.length,
          my = P.reduce((s, p) => s + p[1], 0) / P.length;
        let sxx = 0,
          syy = 0,
          sxy = 0;
        for (const [x, y] of P) ((sxx += (x - mx) ** 2), (syy += (y - my) ** 2), (sxy += (x - mx) * (y - my)));
        const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
        return { mx, my, dx: Math.cos(th), dy: Math.sin(th) };
      };
      let L = fit(hits);
      const off = (p) => Math.abs((p[0] - L.mx) * L.dy - (p[1] - L.my) * L.dx);
      const kept = hits
        .slice()
        .sort((p, r) => off(p) - off(r))
        .slice(0, Math.ceil(hits.length * 0.75));
      lines.push(fit(kept));
    }
    const meet = (A, B) => {
      const den = A.dx * B.dy - A.dy * B.dx;
      if (Math.abs(den) < 1e-6) return null;
      const t = ((B.mx - A.mx) * B.dy - (B.my - A.my) * B.dx) / den;
      return [A.mx + A.dx * t, A.my + A.dy * t];
    };
    const out = q.map((p, i) => {
      const A = lines[(i + 3) % 4],
        B = lines[i]; // the sides before and after corner i
      const m = A && B ? meet(A, B) : null;
      return m && Math.hypot(m[0] - p[0], m[1] - p[1]) < reach * 3
        ? [Math.max(0, Math.min(w, m[0])), Math.max(0, Math.min(h, m[1]))]
        : p;
    });
    return out;
  }

  // the 3 × 3 homography taking the unit square's corners (0,0) (1,0) (1,1) (0,1) to the four points given
  function homography(q) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const dx1 = x1 - x2,
      dx2 = x3 - x2,
      dy1 = y1 - y2,
      dy2 = y3 - y2,
      sx = x0 - x1 + x2 - x3,
      sy = y0 - y1 + y2 - y3,
      den = dx1 * dy2 - dx2 * dy1 || 1e-9;
    const g = (sx * dy2 - dx2 * sy) / den,
      hh = (dx1 * sy - sx * dy1) / den;
    return [x1 - x0 + g * x1, x3 - x0 + hh * x3, x0, y1 - y0 + g * y1, y3 - y0 + hh * y3, y0, g, hh, 1];
  }
  // the page's size as a rectangle: its sides' average lengths, the longest side at most maxSide px
  UNB.pageSize = function (corners, maxSide = 1800) {
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]),
      [a, b, c, e] = corners;
    let W = (d(a, b) + d(e, c)) / 2,
      H = (d(a, e) + d(b, c)) / 2;
    const k = Math.min(1, maxSide / Math.max(W, H, 1));
    return [Math.max(8, Math.round(W * k)), Math.max(8, Math.round(H * k))];
  };
  // The four-sided area inside `corners` flattened to an outW × outH rectangle (perspective undone; bilinear, and a
  // small average when shrinking a lot). Returns RGBA.
  UNB.warpQuad = function (rgba, w, h, corners, outW, outH) {
    const M = homography(corners),
      out = new Uint8ClampedArray(outW * outH * 4);
    const scale = Math.max(1, Math.sqrt(quadArea(corners) / (outW * outH))),
      taps = scale > 1.8 ? 2 : 1; // 2 × 2 samples per pixel when the photo is much bigger than the page made
    const px = (x, y, c) => {
      x = Math.max(0, Math.min(w - 1.001, x));
      y = Math.max(0, Math.min(h - 1.001, y));
      const x0 = x | 0,
        y0 = y | 0,
        a = x - x0,
        b = y - y0,
        i = 4 * (y0 * w + x0);
      return (
        rgba[i + c] * (1 - a) * (1 - b) +
        rgba[i + 4 + c] * a * (1 - b) +
        rgba[i + 4 * w + c] * (1 - a) * b +
        rgba[i + 4 * w + 4 + c] * a * b
      );
    };
    for (let y = 0; y < outH; y++)
      for (let x = 0; x < outW; x++) {
        const acc = [0, 0, 0];
        for (let ty = 0; ty < taps; ty++)
          for (let tx = 0; tx < taps; tx++) {
            const u = (x + (tx + 0.5) / taps) / outW,
              v = (y + (ty + 0.5) / taps) / outH,
              z = M[6] * u + M[7] * v + M[8],
              X = (M[0] * u + M[1] * v + M[2]) / z,
              Y = (M[3] * u + M[4] * v + M[5]) / z;
            for (let c = 0; c < 3; c++) acc[c] += px(X, Y, c);
          }
        const o = 4 * (y * outW + x);
        for (let c = 0; c < 3; c++) out[o + c] = acc[c] / (taps * taps);
        out[o + 3] = 255;
      }
    return out;
  };

  // the paper's light across the picture: in cells, the brightest of each (ink is darker than paper), spread to the
  // neighbouring cells (so a dark area up to `reach` cells wide still sees paper), smoothed, back at full size
  function paperLight(L, w, h, reach) {
    const cell = Math.max(4, Math.round(Math.max(w, h) / 64)),
      cw = Math.ceil(w / cell),
      ch = Math.ceil(h / cell),
      top = new Float32Array(cw * ch);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = ((y / cell) | 0) * cw + ((x / cell) | 0);
        if (L[y * w + x] > top[c]) top[c] = L[y * w + x];
      }
    let a = top;
    for (let k = 0; k < reach; k++) {
      const b = new Float32Array(cw * ch);
      for (let y = 0; y < ch; y++)
        for (let x = 0; x < cw; x++) {
          let m = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const X = x + dx,
                Y = y + dy;
              if (X >= 0 && Y >= 0 && X < cw && Y < ch) m = Math.max(m, a[Y * cw + X]);
            }
          b[y * cw + x] = m;
        }
      a = b;
    }
    // undo the growing's bias a little (a shadow's edge): one pass of the darkest-of-neighbours, then smooth twice
    const sm = (f) => {
      const b = new Float32Array(cw * ch);
      for (let y = 0; y < ch; y++)
        for (let x = 0; x < cw; x++) {
          let s = 0,
            n = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const X = x + dx,
                Y = y + dy;
              if (X >= 0 && Y >= 0 && X < cw && Y < ch) ((s += f[Y * cw + X]), n++);
            }
          b[y * cw + x] = s / n;
        }
      return b;
    };
    a = sm(sm(a));
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const fy = Math.max(0, Math.min(ch - 1.001, (y + 0.5) / cell - 0.5)),
        y0 = fy | 0,
        b = fy - y0;
      for (let x = 0; x < w; x++) {
        const fx = Math.max(0, Math.min(cw - 1.001, (x + 0.5) / cell - 0.5)),
          x0 = fx | 0,
          t = fx - x0,
          i = y0 * cw + x0,
          i2 = Math.min(cw * ch - 1, i + cw);
        out[y * w + x] =
          a[i] * (1 - t) * (1 - b) +
          a[Math.min(i + 1, cw * ch - 1)] * t * (1 - b) +
          a[i2] * (1 - t) * b +
          a[Math.min(i2 + 1, cw * ch - 1)] * t * b;
      }
    }
    return out;
  }
  // the value below which a share p (0–1) of the values lie
  function shareBelow(v, p) {
    const hist = new Float64Array(256);
    for (let i = 0; i < v.length; i++) hist[Math.max(0, Math.min(255, v[i] | 0))]++;
    let acc = 0;
    const want = p * v.length;
    for (let t = 0; t < 256; t++) if ((acc += hist[t]) >= want) return t;
    return 255;
  }

  // the presets: what each kind of photo needs (light: evening out 0–100, ink: how dark faint lines get 0–100,
  // specks: dark bits smaller than this many px removed, colour: kept or grey)
  UNB.PHOTO_KINDS = {
    drawing: { name: "Drawing", light: 100, ink: 50, specks: 3, colour: false },
    print: { name: "Printed art", light: 70, ink: 20, specks: 1, colour: false },
    object: { name: "Object", light: 0, ink: 0, specks: 0, colour: true },
  };

  // Clean a photo. o: kind (drawing | print | object; its settings are the defaults), light, ink, specks, colour.
  // A drawing or printed art: the paper's light divided out (so shadows and a lamp's falloff go), the paper made
  // white, the darkest ink black, faint lines darkened by `ink`; small dark specks removed. An object: each colour
  // stretched between its darkest and lightest (white balance and contrast), nothing flattened. Returns RGBA.
  UNB.photoClean = function (rgba, w, h, o = {}) {
    const K = UNB.PHOTO_KINDS[o.kind] || UNB.PHOTO_KINDS.drawing,
      light = (o.light ?? K.light) / 100,
      ink = (o.ink ?? K.ink) / 100,
      specks = o.specks ?? K.specks,
      colour = o.colour ?? K.colour,
      N = w * h,
      out = new Uint8ClampedArray(N * 4);
    if (colour) {
      // each channel from its 0.5th to its 99.5th percentile; a little evening of the light if asked
      const ch = [0, 1, 2].map((c) => {
        const v = new Float32Array(N);
        for (let i = 0; i < N; i++) v[i] = rgba[4 * i + c];
        return v;
      });
      let gain = null;
      if (light > 0) {
        const L = new Float32Array(N);
        for (let i = 0; i < N; i++) L[i] = 0.299 * ch[0][i] + 0.587 * ch[1][i] + 0.114 * ch[2][i];
        const P = paperLight(L, w, h, 4);
        gain = new Float32Array(N);
        for (let i = 0; i < N; i++) gain[i] = 255 / (255 + light * (Math.max(8, P[i]) - 255));
      }
      for (let c = 0; c < 3; c++) {
        const v = ch[c];
        if (gain) for (let i = 0; i < N; i++) v[i] = Math.min(255, v[i] * gain[i]);
        // (a channel with hardly any spread, e.g. a plain white wall: stretched down from its lightest, so white stays
        // white)
        const hi = Math.max(16, shareBelow(v, 0.995)),
          lo = Math.min(shareBelow(v, 0.005), hi - 16);
        for (let i = 0; i < N; i++) out[4 * i + c] = ((v[i] - lo) / (hi - lo)) * 255;
      }
      for (let i = 0; i < N; i++) out[4 * i + 3] = 255;
      return out;
    }
    const L = UNB.blur(UNB.toGray(rgba, w, h), w, h, 0.6); // (a camera's grain)
    if (light > 0) {
      const P = paperLight(L, w, h, o.kind === "print" ? 4 : 1);
      for (let i = 0; i < N; i++) L[i] = Math.min(255, (L[i] * 255) / (255 + light * (Math.max(8, P[i]) - 255)));
    }
    // paper white, the darkest ink black: the paper is the most common light grey, the ink's black a small share
    const white = Math.max(64, shareBelow(L, o.kind === "print" ? 0.97 : 0.6) * (o.kind === "print" ? 1 : 0.94)),
      black = Math.min(white - 40, shareBelow(L, o.kind === "print" ? 0.01 : 0.002));
    const gamma = 1 + ink * 2;
    const g = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const t = Math.max(0, Math.min(1, (L[i] - black) / (white - black)));
      g[i] = 255 * Math.pow(t, gamma);
    }
    if (specks > 0) {
      // dark bits (below mid grey) smaller than specks² px go white
      const dark = new Uint8Array(N);
      for (let i = 0; i < N; i++) dark[i] = g[i] < 128 ? 1 : 0;
      const { lab, n } = labelComponents(dark, w, h),
        size = new Int32Array(n);
      for (let i = 0; i < N; i++) if (lab[i] >= 0) size[lab[i]]++;
      const min = specks * specks,
        gone = new Uint8Array(n);
      for (let k = 0; k < n; k++) gone[k] = size[k] < min ? 1 : 0;
      // and what's left of the table along the edges: dark bits lying within a thin band along one edge
      const band = Math.max(3, Math.round(Math.min(w, h) * 0.02)),
        box = Array.from({ length: n }, () => [w, h, -1, -1]);
      for (let i = 0; i < N; i++)
        if (lab[i] >= 0) {
          const b = box[lab[i]],
            x = i % w,
            y = (i / w) | 0;
          if (x < b[0]) b[0] = x;
          if (y < b[1]) b[1] = y;
          if (x > b[2]) b[2] = x;
          if (y > b[3]) b[3] = y;
        }
      for (let k = 0; k < n; k++) {
        const [x0, y0, x1, y1] = box[k];
        if (x1 < band || y1 < band || x0 >= w - band || y0 >= h - band) gone[k] = 1;
      }
      for (let i = 0; i < N; i++) if (lab[i] >= 0 && gone[lab[i]]) g[i] = 255;
    }
    for (let i = 0; i < N; i++) {
      out[4 * i] = out[4 * i + 1] = out[4 * i + 2] = g[i];
      out[4 * i + 3] = 255;
    }
    return out;
  };

  // Stage: a photo → the picture to use. o: corners (the page's, px; none: the whole photo), kind and its settings
  // (UNB.photoClean), maxSide (longest side, px). Returns { rgba, w, h }.
  UNB.photoPicture = function (rgba, w, h, o = {}) {
    let src = rgba,
      W = w,
      H = h;
    const max = o.maxSide || 1800;
    if (o.corners) {
      [W, H] = UNB.pageSize(o.corners, max);
      src = UNB.warpQuad(rgba, w, h, o.corners, W, H);
    } else if (Math.max(w, h) > max) {
      const k = max / Math.max(w, h);
      [W, H] = [Math.round(w * k), Math.round(h * k)];
      src = UNB.warpQuad(
        rgba,
        w,
        h,
        [
          [0, 0],
          [w, 0],
          [w, h],
          [0, h],
        ],
        W,
        H
      );
    }
    return { rgba: o.kind === "none" ? src : UNB.photoClean(src, W, H, o), w: W, h: H };
  };
})(typeof window !== "undefined" ? window : globalThis);

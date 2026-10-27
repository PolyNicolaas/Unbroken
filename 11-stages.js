/* Unbroken · engine · 11-stages.js
   10. Pipeline stages — what the app calls, in order; pure data in and out, so each runs in a Web Worker or on the
   page.
   One part of the engine (no DOM), loaded after 10-export.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { bbox } = UNB._u; // shared helpers (00-util.js)

  // RGBA pixels → the working image, as the app does it: prepared gray (UNB.prep, then inverted for light lines on
  // dark), the same blurred for tracing, and a gray RGBA copy for the preview. o: { prep, invert, blur (sigma, px),
  // levels ({ count, smooth }: grey levels, UNB.levels; the picture becomes flat greys, not blurred) }. Returns gray,
  // blurred, preview, levels (UNB.levels' result or null).
  // Runs in a worker so a big image doesn't freeze the page.
  UNB.stagePrep = function (rgba, w, h, o) {
    let gray = UNB.prep(rgba, w, h, o.prep || {});
    const N = w * h,
      preview = new Uint8ClampedArray(4 * N);
    if (o.invert) for (let i = 0; i < N; i++) gray[i] = 255 - gray[i];
    // grey levels: the picture as flat greys from here on (lab: level per pixel, for the line map and the fills)
    const L = o.levels && o.levels.count >= 2 ? UNB.levels(gray, w, h, o.levels) : null;
    if (L) gray = Float32Array.from(L.lab, (j) => L.tones[j]);
    for (let i = 0; i < N; i++) {
      const v = o.invert ? 255 - gray[i] : gray[i];
      preview[4 * i] = preview[4 * i + 1] = preview[4 * i + 2] = v;
      preview[4 * i + 3] = 255;
    }
    return { gray, blurred: L ? gray : UNB.blur(gray, w, h, o.blur || 0), preview, levels: L };
  };

  // image → line map, as the app does it: centerline or edges, then the selection mask and erasing.
  // o: { mode: "centerline"|"edges", sens, split, selMask (Uint8Array or null), erase: [ops], levels ({ lab, edge }:
  // grey levels, their edges instead: UNB.levelEdges) }
  UNB.stageLines = function (blurred, w, h, o) {
    let lines;
    if (o.levels) lines = UNB.levelEdges(o.levels.lab, w, h, o.levels.edge);
    else if (o.mode === "edges") {
      const hi = 150 - o.sens * 1.8;
      lines = UNB.canny(blurred, w, h, hi * 0.4, hi);
      // o.split: packed-stroke splitting (default 0.1)
    } else lines = UNB.centerline(blurred, w, h, o.sens, undefined, undefined, o.split);
    if (o.selMask) for (let i = 0; i < w * h; i++) if (!o.selMask[i]) lines[i] = 0;
    if (o.erase && o.erase.length) UNB.erase(lines, w, h, o.erase);
    return lines;
  };

  // lines → walk → subpixel walk. snap: { blurred, edges } — snaps to the ink's middle (centerline, text) or the edge's
  // peak (outline); null keeps whole pixels.
  UNB.stageWalk = function (lines, w, h, walkOpt, snap) {
    const walk = UNB.buildWalk(lines, w, h, walkOpt);
    if (!walk || !snap || !snap.blurred) return walk;
    let field;
    if (snap.edges) field = UNB.gradient(snap.blurred, w, h);
    else {
      field = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) field[i] = 255 - snap.blurred[i];
    }
    return UNB.snapWalk(walk, field, w, h);
  };

  // the whole first stage in one call: line map (or given lines, for text) → walk → subpixel walk
  UNB.stageTrace = function (src, w, h, walkOpt, snap) {
    const lines = src.lines || UNB.stageLines(src.blurred, w, h, src);
    return UNB.stageWalk(lines, w, h, walkOpt, snap);
  };

  // A walk from one exact path (a pattern drawn as one line) instead of a traced picture: the path's own points, about
  // 1 px apart, single strokes only (no doubling, no connectors). x, y in working px; closed: a loop (the walk repeats
  // its first point at the end, as a traced loop does). Its crossings stay crossings: nothing is joined where it
  // crosses itself (a trace makes a junction there and goes round it twice). opt: startAt ([x, y] px: a loop starts at
  // its nearest point, an open line at its nearer end).
  UNB.stageVector = function (x, y, closed, w, h, opt) {
    const n0 = x.length;
    if (n0 < 2) return null;
    const ox = [],
      oy = [];
    const m = closed ? n0 : n0 - 1;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % n0,
        L = Math.hypot(x[j] - x[i], y[j] - y[i]),
        k = Math.max(1, Math.ceil(L));
      for (let s = 0; s < k; s++) {
        ox.push(x[i] + ((x[j] - x[i]) * s) / k);
        oy.push(y[i] + ((y[j] - y[i]) * s) / k);
      }
    }
    const at = opt && opt.startAt;
    if (at && closed) {
      let best = 0,
        bd = Infinity;
      for (let i = 0; i < ox.length; i++) {
        const dd = (ox[i] - at[0]) ** 2 + (oy[i] - at[1]) ** 2;
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      }
      ox.push(...ox.splice(0, best));
      oy.push(...oy.splice(0, best));
    }
    if (closed) {
      ox.push(ox[0]);
      oy.push(oy[0]);
    } else {
      ox.push(x[n0 - 1]);
      oy.push(y[n0 - 1]);
    }
    if (
      at &&
      !closed &&
      Math.hypot(ox[ox.length - 1] - at[0], oy[oy.length - 1] - at[1]) < Math.hypot(ox[0] - at[0], oy[0] - at[1])
    ) {
      ox.reverse();
      oy.reverse();
    }
    const n = ox.length,
      px = Float64Array.from(ox, (v) => Math.min(w - 1, Math.max(0, v))),
      py = Float64Array.from(oy, (v) => Math.min(h - 1, Math.max(0, v)));
    const mask = new Uint8Array(w * h);
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      mask[Math.round(py[i]) * w + Math.round(px[i])] = 1;
      minX = Math.min(minX, px[i]);
      maxX = Math.max(maxX, px[i]);
      minY = Math.min(minY, py[i]);
      maxY = Math.max(maxY, py[i]);
    }
    let linePix = 0;
    for (let i = 0; i < w * h; i++) linePix += mask[i];
    return {
      px,
      py,
      dbl: new Uint8Array(n),
      jmp: new Uint8Array(n),
      side: new Int8Array(n),
      grp: new Int32Array(n).fill(-1),
      jid: new Int32Array(n).fill(-1),
      jd: new Float32Array(n).fill(Infinity),
      jr: 160,
      tip: new Uint8Array(n),
      open: !closed,
      mask,
      edt: UNB.edt(mask, w, h),
      nParts: 1,
      dropped: 0,
      jumpLen: 0,
      doubledFrac: 0,
      bbox: { minX, minY, maxX, maxY },
      linePix,
      vector: true,
    };
  };

  // Allow overlaps: the line may cross itself where the fitted curve does. At each crossing the two strands that cross
  // may come as close as crossing lines must, along each strand as far as they need to come a spacing apart (d / (2
  // sin(angle / 2)) + d, at most 6 d); any other strand near them is still kept the spacing away, and so is everything
  // elsewhere. Returns allow(x, y) for the crossings themselves (true within d of one, or in a painted crossing area:
  // `allow`), with allow.pair(x1, y1, x2, y2) (these two points may be closer than the spacing: on the two strands of
  // one crossing, or either in a painted area) and allow.zone(x, y) (anywhere round a crossing, for the preview's
  // too-close marks). The given allow when the curve has no crossings.
  UNB.overlapAllow = function (re, im, closed, d, allow) {
    const cr = UNB.findCrossings(re, im, closed);
    if (!cr.length || !(d > 0)) return allow || null;
    const n = re.length,
      Rmax = 6 * d,
      cell = 0.5 * d, // strands are looked up in cells this size, 3 × 3 round a point (so within 0.5–1.5 d)
      cx = cr.map((c) => c[3]),
      cy = cr.map((c) => c[4]),
      rad = cr.map((c) => Math.min(Rmax, d / (2 * Math.sin((Math.max(c[2], 1) * Math.PI) / 360)) + d)),
      C = UNB._u.cellGrid(Rmax),
      cells = new Map(); // cell → the strands through it, each crossing × 2 + strand (0, 1)
    const key = (gx, gy) => gx * 1e6 + gy;
    cr.forEach((c, i) => {
      C.add(cx[i], cy[i], i);
      [c[0], c[1]].forEach((a, k) => {
        // the strand's points out from the crossing both ways, as far as its zone reaches
        for (const dir of [1, -1])
          for (let st = dir > 0 ? 1 : 0, guard = 0; guard < n; st++, guard++) {
            let q = a + dir * st;
            if (closed) q = ((q % n) + n) % n;
            else if (q < 0 || q >= n) break;
            if (Math.hypot(re[q] - cx[i], im[q] - cy[i]) > rad[i]) break;
            const kk = key(Math.floor(re[q] / cell), Math.floor(im[q] / cell));
            let set = cells.get(kk);
            if (!set) cells.set(kk, (set = new Set()));
            set.add(2 * i + k);
          }
      });
    });
    const around = (x, y, fn) => {
      const gx = Math.floor(x / cell),
        gy = Math.floor(y / cell);
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          const set = cells.get(key(gx + ox, gy + oy));
          if (set) for (const t of set) if (fn(t)) return true;
        }
      return false;
    };
    const within = (x, y, r) => {
      let hit = false;
      C.near(x, y, (i) => {
        if (!hit && Math.hypot(x - cx[i], y - cy[i]) <= r(i)) hit = true;
      });
      return hit;
    };
    const f = (x, y) => (allow && allow(x, y)) || within(x, y, () => d);
    // how crowded the crossings are: their zones' total area ÷ the drawing's box (over 1, they'd cover it all)
    const b = bbox(re, im);
    f.crowd = rad.reduce((a, r) => a + Math.PI * r * r, 0) / Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0));
    f.zone = (x, y) => (allow && allow(x, y)) || within(x, y, (i) => rad[i]);
    f.pair = (x1, y1, x2, y2) => {
      if (allow && (allow(x1, y1) || allow(x2, y2))) return true;
      const a = new Set();
      around(x1, y1, (t) => void a.add(t));
      return a.size > 0 && around(x2, y2, (t) => a.has(t ^ 1)); // the other strand of the same crossing
    };
    return f;
  };

  // A crossing-area mask can't be sent to a worker as a function, so stages take { allowMask, allowW, allowH } and
  // rebuild it.
  UNB.allowFromMask = function (m, w, h) {
    if (!m) return null;
    return (x, y) => {
      const xi = Math.round(x),
        yi = Math.round(y);
      return xi >= 0 && yi >= 0 && xi < w && yi < h && m[yi * w + xi] === 1;
    };
  };

  // a worker call's arguments with each { allowMask, allowW, allowH } object given its allow(x, y) function back
  UNB.decodeArgs = function (args) {
    return args.map((a) =>
      a && typeof a === "object" && !ArrayBuffer.isView(a) && !Array.isArray(a) && "allowMask" in a
        ? Object.assign({}, a, { allow: UNB.allowFromMask(a.allowMask, a.allowW, a.allowH) })
        : a
    );
  };

  // walk → spectrum and per-sample tags. d: spacing in px; strokes travelled twice become two strands d apart with a
  // loop at
  // each stroke end (0 = no offset). opt: w (line width px), loop (loop radius ÷ d; see offsetDoubled), round (corner
  // radius, working px; see roundCorners), fill ("rings" | "lines": infill), fillAngle, fillMinArea, fillSpacing (the
  // fill's
  // rows, centre to centre, px; default d; the line width fills solid) (see infill).
  // Returns S (samples), open, sp (spectrum), tagS ({ group, jid, jd } per sample), jumpS (1 on connectors), connRuns,
  // Nmax (most terms worth trying), filled / skipped (infill areas), tooFine (infill grid too big).
  UNB.stageSignal = function (walk, d, w, h, opt) {
    // drawn corners rounded to this radius (working px) first
    if (opt && opt.round > 0) walk = UNB.roundCorners(walk, opt.round);
    let off = UNB.offsetDoubled(walk, d, Object.assign({ loops: true }, opt)),
      open = !!walk.open,
      filled = 0,
      skipped = 0,
      tooFine = false;
    if (opt && opt.fill && d > 0) {
      // fill the enclosed areas, as part of the same line
      const jmp = walk.jmp,
        tip = walk.tip,
        jd = walk.jd;
      const rows = opt.fillSpacing > 0 ? opt.fillSpacing : d;
      off = UNB.infill(off, d * 1.05, {
        // 5% over the spacing, so the series' small wobble doesn't make the spacing step push the fill around
        rows: rows * 1.05,
        bridge: d,
        pattern: opt.fill,
        angle: opt.fillAngle || 0,
        minArea: opt.fillMinArea || 0,
        fixed: (k) => jmp[k] || (k > 0 && jmp[k - 1]) || tip[k] || jd[k] < 2 * d,
      });
      filled = off.areas;
      skipped = off.skipped || 0;
      tooFine = !!off.tooBig;
    }
    const src = open ? UNB.mirror(off.x, off.y) : off; // open: fit the path out-and-back
    let S = 2048;
    while (S < src.x.length * 1.2 && S < (filled ? 65536 : 16384)) S *= 2;
    const z = UNB.resample(src.x, src.y, S),
      sp = UNB.spectrum(z.re, z.im);
    const m = off.x.length,
      // per-point tags, following loop points back to their walk point (infill points: none; their jid is -2)
      pick = (a, T, none) => T.from(off.idx, (k) => (k < 0 ? none : a[k]));
    // the same out-and-back order as UNB.mirror
    const mirror = (a, T) => (open ? T.from({ length: 2 * m - 2 }, (_, j) => a[j < m ? j : 2 * m - 2 - j]) : a);
    const jm = mirror(pick(walk.jmp, Uint8Array, 0), Uint8Array),
      gq = mirror(pick(walk.grp, Int32Array, -1), Int32Array),
      jq = mirror(pick(walk.jid, Int32Array, -2), Int32Array),
      dq = mirror(pick(walk.jd, Float32Array, 1e9), Float32Array);
    const tagS = { group: new Int32Array(S), jid: new Int32Array(S), jd: new Float32Array(S) },
      J = new Uint8Array(S);
    for (let i = 0; i < S; i++) {
      const k = z.seg[i];
      J[i] = jm[k] || 0;
      tagS.group[i] = gq[k] ?? -1;
      tagS.jid[i] = jq[k] ?? -1;
      tagS.jd[i] = dq[k] ?? 1e9;
    }
    const jumpS = new Uint8Array(S);
    for (let i = 0; i < S; i++) if (J[i]) for (let e = -1; e <= 1; e++) jumpS[(i + e + S) % S] = 1;
    let runs = 0;
    for (let i = 0; i < S / (open ? 2 : 1); i++) if (jumpS[i] && !jumpS[(i + S - 1) % S]) runs++;
    // path: the line the series was fitted to (strands, loops, infill), one way round, for the error readout
    // (stageFinal)
    const path = { px: Float32Array.from(off.x), py: Float32Array.from(off.y) };
    return {
      S,
      open,
      sp,
      tagS,
      jumpS,
      connRuns: runs,
      // every term the samples allow (lines are sampled at most 16,384 times; filled areas up to 30,000 terms)
      Nmax: Math.min(sp.order.length, filled ? 30000 : 16384),
      filled,
      skipped,
      tooFine,
      path,
    };
  };

  // For each number of terms in Ns: how far the series strays from the path it was fitted to (sample by sample,
  // subpixel, connectors skipped). e = mean, p95 = 95th percentile, in working px. One step per term count.
  UNB.sweepSteps = function* (ax, order, Ns, jumps, open) {
    const S = ax.S,
      n0 = open ? S / 2 + 1 : S,
      z = UNB.synth(ax, order),
      out = [],
      d = [];
    for (const n of Ns) {
      const c = UNB.synth(ax, order.slice(0, n));
      d.length = 0;
      let sum = 0;
      for (let i = 0; i < n0; i++) {
        if (jumps && jumps[i]) continue;
        const e = Math.hypot(c.re[i] - z.re[i], c.im[i] - z.im[i]);
        d.push(e);
        sum += e;
      }
      d.sort((a, b) => a - b);
      out.push({ n, e: sum / Math.max(1, d.length), p95: d.length ? d[Math.floor(0.95 * (d.length - 1))] : 0 });
      yield out[out.length - 1];
    }
    return out;
  };

  // fewest terms whose 95th-percentile deviation from the path is within tol px
  UNB.pickTerms = function (sweep, tol) {
    return (sweep.find((p) => p.p95 <= tol) || sweep[sweep.length - 1]).n;
  };

  UNB.TERM_TOL = 0.35; // px: the default for pickTerms

  // The automatic term count in one call: sweep term counts from 8 up to Nmax (each `growth` × the last) and pick the
  // fewest within tol. Returns { N, sweep, curve } (curve: the series with N terms).
  UNB.autoTerms = function (ax, order, Nmax, jumps, open, tol, growth) {
    const Ns = [];
    for (let n = 8; n < Nmax; n = Math.max(n + 1, Math.round(n * (growth || 1.35)))) Ns.push(n);
    Ns.push(Nmax);
    const it = UNB.sweepSteps(ax, order, Ns, jumps, open);
    let r = it.next();
    while (!r.done) r = it.next();
    const N = UNB.pickTerms(r.value, tol || UNB.TERM_TOL);
    return { N, sweep: r.value, curve: UNB.synth(ax, order.slice(0, N)) };
  };

  // Fitted series → the drawn line's shape: with unx > 0, remove crossings up to unx degrees (90: all) and keep
  // strands max(d, minGap) apart (minGap only when removing all, so crossings don't stay as touch points); otherwise
  // only push strands d apart. carry / tags move with the points (see UNB.untangle). Returns { re, im, carry, tags,
  // before (crossings before; null when not untangled) }.
  UNB.shapeLine = function (re, im, closed, o) {
    const d = o.d || 0,
      unx = o.unx || 0,
      allow = o.overlaps ? UNB.overlapAllow(re, im, closed, d, o.allow) : o.allow || null;
    if (unx > 0) {
      const u = UNB.untangle(re, im, closed, {
        maxAngle: unx,
        gap: Math.max(d, unx >= 90 ? o.minGap || 0 : 0),
        carry: o.carry,
        allow,
        tags: o.tags,
      });
      return { re: u.re, im: u.im, carry: u.carry, tags: u.tags, before: u.before, allow };
    }
    const sp = d > 0 ? UNB.enforceSpacing(re, im, d, 120, closed, allow) : { re, im };
    return { re: sp.re, im: sp.im, carry: o.carry || [], tags: o.tags || null, before: null, allow };
  };

  // fitted curve → the line that is drawn: untangling / spacing (shapeLine), then every measurement the preview shows.
  // o: closed, d (spacing px), unx, minGap, allow, overlaps (keep the curve's own crossings: UNB.overlapAllow), tags,
  // jumps (connector flags per point), pad (half the line width,
  // for
  // minBox), driftTol, path (stageSignal's: what the series was fitted to, for the error readout; else walk, its centre
  // line). Returns final, jumpF, before / after / inArea (crossings), fb (bounds),
  // mbox, err, gap, gapProbe, problems (crossings, tight, drift, driftShare).
  UNB.stageFinal = function (re, im, o) {
    const closed = o.closed,
      d = o.d || 0;
    const cur = UNB.shapeLine(re, im, closed, {
      d,
      unx: o.unx,
      minGap: o.minGap,
      allow: o.allow || null,
      overlaps: o.overlaps,
      carry: [o.jumps],
      tags: o.tags,
    });
    const allow = cur.allow; // (with Allow overlaps, the zones round the curve's own crossings too)
    const fre = cur.re,
      fim = cur.im,
      jf = cur.carry[0],
      tags = cur.tags;
    const left = UNB.findCrossings(fre, fim, closed),
      inArea = allow ? left.filter((c) => allow(c[3], c[4])).length : 0;
    const before = cur.before === null ? left.length : cur.before,
      { x0, y0, x1, y1 } = bbox(fre, fim);
    const probe = Math.max(d * 1.5, 3);
    const problems = UNB.problemSpots(fre, fim, d, closed);
    if (allow) {
      problems.crossings = problems.crossings.filter(([x, y]) => !allow(x, y));
      problems.tight = problems.tight.filter(([x, y]) => !(allow.zone || allow)(x, y));
    }
    const dr = UNB.drift(re, im, fre, fim, closed, o.driftTol || 0); // where the line was pushed away from the drawing
    problems.drift = dr.spans;
    problems.driftShare = dr.share;
    return {
      final: { re: fre, im: fim },
      jumpF: jf,
      before,
      after: left.length - inArea,
      inArea,
      fb: { x0, y0, x1, y1 },
      mbox: UNB.minBox(fre, fim, o.pad),
      err: UNB.pathError(
        fre,
        fim,
        closed,
        (o.path || o.walk).px,
        (o.path || o.walk).py,
        closed,
        30,
        tags && tags.jid ? Uint8Array.from(tags.jid, (v) => +(v === -2)) : null
      ),
      gap: UNB.closestGap(fre, fim, probe, closed, allow),
      gapProbe: probe,
      problems,
    };
  };

  // A whole print from a walk, start to finish, with the automatic term count: signal, series, final line. For the
  // layer variants (the line without infill for the walls, the base turned 90°) that aren't on screen.
  // opt: as stageSignal (w, loop, round, fill, fillAngle, fillMinArea, fillSpacing) plus termTol, unx, minGap, allow,
  // closed.
  // A fill closer than the spacing (solid) keeps its rows that close: the strands are only pushed that far apart.
  UNB.stagePrint = function (walk, d, w, h, opt) {
    const o = opt || {},
      sg = UNB.stageSignal(walk, d, w, h, o),
      open = sg.open,
      n0 = open ? sg.S / 2 + 1 : sg.S;
    const { N, curve: c } = UNB.autoTerms(sg.sp.ax, sg.sp.order, sg.Nmax, sg.jumpS, open, o.termTol);
    const dKeep = o.fill && sg.filled && o.fillSpacing > 0 ? Math.min(d, o.fillSpacing) : d;
    const fin = UNB.stageFinal(c.re.slice(0, n0), c.im.slice(0, n0), {
      closed: !open,
      d: dKeep,
      unx: o.unx == null ? 90 : o.unx,
      minGap: o.minGap || 0,
      allow: o.allow || null,
      overlaps: o.overlaps,
      tags: { group: null, jid: sg.tagS.jid.slice(0, n0), jd: sg.tagS.jd.slice(0, n0) },
      jumps: sg.jumpS.slice(0, n0),
      pad: 0,
      walk,
      path: sg.path,
    });
    return {
      final: fin.final,
      open,
      N,
      filled: sg.filled || 0,
      skipped: sg.skipped || 0,
      tooFine: !!sg.tooFine,
      after: fin.after,
      gap: fin.gap,
    };
  };

  // Optimize tracing: score one candidate line map (closeness to the reference, crossings, spacing kept); lower is
  // better. o: outW (print width, mm), spacing (mm), lineRatio, loop, roundMM, termTol, unx, minGap, allow, snap, ref
  // (the reference walk, for chamfer). Slow: a whole trace and fit per candidate.
  UNB.scoreLines = function (lines, w, h, walkOpt, o) {
    // a line-map description (see stageLines)
    if (!ArrayBuffer.isView(lines)) lines = lines.lines || UNB.stageLines(lines.blurred, w, h, lines);
    const walk = UNB.stageWalk(lines, w, h, walkOpt, o.snap || null);
    if (!walk) return null;
    const bw = Math.max(1, walk.bbox.maxX - walk.bbox.minX),
      sc = o.outW / bw,
      d = o.spacing > 0 ? o.spacing / sc : 0;
    const open = !!walk.open,
      allow = o.allow || null;
    const sg = UNB.stageSignal(walk, d, w, h, {
        w: d * (o.lineRatio || 0.6),
        loop: o.loop,
        round: (o.roundMM || 0) / sc,
      }),
      S = sg.S,
      sp = sg.sp,
      n0 = open ? S / 2 + 1 : S;
    // coarser steps: many candidates
    const { N, curve: c } = UNB.autoTerms(sp.ax, sp.order, sg.Nmax, sg.jumpS, open, o.termTol, 1.5);
    const cur = UNB.shapeLine(c.re.subarray(0, n0), c.im.subarray(0, n0), !open, {
      d,
      unx: o.unx,
      minGap: o.minGap,
      allow,
    });
    const cross = UNB.findCrossings(cur.re, cur.im, !open).filter((x) => !(allow && allow(x[3], x[4]))).length;
    const gapR = d > 0 ? Math.min(2, UNB.closestGap(cur.re, cur.im, d * 1.5, !open, allow) / d) : 2;
    const fid = UNB.chamfer(cur.re, cur.im, o.ref, w, h, !open).score;
    return { score: (cross ? 10 : 0) + Math.max(0, 1 - gapR) * 5 + fid / Math.max(d, 1), fid, cross, gapR, N };
  };
})(typeof window !== "undefined" ? window : globalThis);

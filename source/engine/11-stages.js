/* Unbroken · engine · 11-stages.js
   10. Pipeline stages — what the app calls, in order; pure data in and out, so each runs in a Web Worker or on the
   page.
   One part of the engine (no DOM), loaded after 10-export.js; core.js lists every part and what's in it. */
(function (root) {
  "use strict";
  const UNB = root.UNB,
    { bbox } = UNB._u; // shared helpers (00-util.js)

  // RGBA pixels → the working image, as the app does it: prepared gray (UNB.prep, then inverted for light lines on
  // dark), the same blurred for tracing, and a gray RGBA copy for the preview. o: { prep, invert, blur (sigma, px) }.
  // Runs in a worker so a big image doesn't freeze the page.
  UNB.stagePrep = function (rgba, w, h, o) {
    const gray = UNB.prep(rgba, w, h, o.prep || {}),
      N = w * h,
      preview = new Uint8ClampedArray(4 * N);
    if (o.invert) for (let i = 0; i < N; i++) gray[i] = 255 - gray[i];
    for (let i = 0; i < N; i++) {
      const v = o.invert ? 255 - gray[i] : gray[i];
      preview[4 * i] = preview[4 * i + 1] = preview[4 * i + 2] = v;
      preview[4 * i + 3] = 255;
    }
    return { gray, blurred: UNB.blur(gray, w, h, o.blur || 0), preview };
  };

  // image → line map, as the app does it: centerline or edges, then the selection mask and erasing.
  // o: { mode: "centerline"|"edges", sens, split, selMask (Uint8Array or null), erase: [ops] }
  UNB.stageLines = function (blurred, w, h, o) {
    let lines;
    if (o.mode === "edges") {
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
      allow = o.allow || null;
    if (unx > 0) {
      const u = UNB.untangle(re, im, closed, {
        maxAngle: unx,
        gap: Math.max(d, unx >= 90 ? o.minGap || 0 : 0),
        carry: o.carry,
        allow,
        tags: o.tags,
      });
      return { re: u.re, im: u.im, carry: u.carry, tags: u.tags, before: u.before };
    }
    const sp = d > 0 ? UNB.enforceSpacing(re, im, d, 120, closed, allow) : { re, im };
    return { re: sp.re, im: sp.im, carry: o.carry || [], tags: o.tags || null, before: null };
  };

  // fitted curve → the line that is drawn: untangling / spacing (shapeLine), then every measurement the preview shows.
  // o: closed, d (spacing px), unx, minGap, allow, tags, jumps (connector flags per point), pad (half the line width,
  // for
  // minBox), driftTol, path (stageSignal's: what the series was fitted to, for the error readout; else walk, its centre
  // line). Returns final, jumpF, before / after / inArea (crossings), fb (bounds),
  // mbox, err, gap, gapProbe, problems (crossings, tight, drift, driftShare).
  UNB.stageFinal = function (re, im, o) {
    const closed = o.closed,
      d = o.d || 0,
      allow = o.allow || null;
    const cur = UNB.shapeLine(re, im, closed, {
      d,
      unx: o.unx,
      minGap: o.minGap,
      allow,
      carry: [o.jumps],
      tags: o.tags,
    });
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
      problems.tight = problems.tight.filter(([x, y]) => !allow(x, y));
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

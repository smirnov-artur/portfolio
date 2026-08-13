/* bend.js — turns typed text into bent glass, then measures the glass.
   Nothing here is decorative: the price on the page is computed from THIS geometry
   (path length, corner arcs, run count), not from a lookup table of sizes. */
(function (root) {
  'use strict';

  var S = root.NeonStrokes;

  /* ---------- demo rates. Real quotes come from the shop; these are ours. ---------- */
  var RATES = {
    currency: 'USD',
    tube: {                                   // per metre of bent tube, glass + phosphor + gas
      8:  { rate: 42, wattsPerM: 4.8, minBendR: 17 },   // minBendR in mm: glass cracks below it
      10: { rate: 48, wattsPerM: 6.0, minBendR: 22 },
      12: { rate: 56, wattsPerM: 7.2, minBendR: 27 }
    },
    bend: 2.40,                               // one heat + one bend on the ribbon burner
    electrodePair: 9.50,                      // every separate tube run is sealed at both ends
    backing: {
      none:  { rate: 0,   label: 'No backing (bare tube on stand-offs)' },
      clear: { rate: 190, label: 'Clear acrylic, 5 mm' },
      black: { rate: 215, label: 'Black acrylic, 5 mm' }
    },
    backingEdge: 6.5,                         // per metre of cut and polished edge
    mount: {
      studs: { price: 24, label: 'Wall stand-offs' },
      chain: { price: 18, label: 'Hanging chain kit' },
      stand: { price: 46, label: 'Free-standing base' }
    },
    psu: [ {w: 30, p: 28}, {w: 60, p: 36}, {w: 100, p: 48}, {w: 150, p: 62}, {w: 200, p: 78}, {w: 300, p: 110} ],
    psuHeadroom: 1.25,
    bench: 60,                                // bench assembly, 24 h burn-in, packing
    tracking: 0.09,                           // letter spacing, em
    lineGap: 1.42,                            // baseline to baseline, em
    backingMargin: 0.22                       // em of acrylic around the tube
  };

  /* ---------- path mini-language -> segment list ---------- */
  function parsePath(d) {
    var t = d.match(/[MLQCE]|-?\d*\.?\d+/g) || [];
    var segs = [], i = 0, cur = null, start = null;
    while (i < t.length) {
      var c = t[i++];
      if (c === 'M') { cur = [+t[i++], +t[i++]]; start = cur; }
      else if (c === 'L') { var p = [+t[i++], +t[i++]]; segs.push({ t: 'L', a: cur, b: p }); cur = p; }
      else if (c === 'Q') { var q1 = [+t[i++], +t[i++]], q2 = [+t[i++], +t[i++]]; segs.push({ t: 'Q', a: cur, c1: q1, b: q2 }); cur = q2; }
      else if (c === 'C') { var b1 = [+t[i++], +t[i++]], b2 = [+t[i++], +t[i++]], b3 = [+t[i++], +t[i++]]; segs.push({ t: 'C', a: cur, c1: b1, c2: b2, b: b3 }); cur = b3; }
      else if (c === 'E') {
        var cx = +t[i++], cy = +t[i++], rx = +t[i++], ry = +t[i++], k = 0.5523;
        var top = [cx, cy + ry], rt = [cx + rx, cy], bt = [cx, cy - ry], lf = [cx - rx, cy];
        segs.push({ t: 'C', a: top, c1: [cx + rx * k, cy + ry], c2: [cx + rx, cy + ry * k], b: rt });
        segs.push({ t: 'C', a: rt,  c1: [cx + rx, cy - ry * k], c2: [cx + rx * k, cy - ry], b: bt });
        segs.push({ t: 'C', a: bt,  c1: [cx - rx * k, cy - ry], c2: [cx - rx, cy - ry * k], b: lf });
        segs.push({ t: 'C', a: lf,  c1: [cx - rx, cy + ry * k], c2: [cx - rx * k, cy + ry], b: top });
        cur = top; start = top;
      }
    }
    return segs;
  }

  function lerp(a, b, u) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; }
  function dist(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }

  function sampleSeg(s, out, step) {
    if (s.t === 'L') {
      var n = Math.max(1, Math.ceil(dist(s.a, s.b) / step));
      for (var i = 1; i <= n; i++) out.push(lerp(s.a, s.b, i / n));
      return;
    }
    var approx = s.t === 'Q' ? dist(s.a, s.c1) + dist(s.c1, s.b)
                             : dist(s.a, s.c1) + dist(s.c1, s.c2) + dist(s.c2, s.b);
    var m = Math.max(4, Math.ceil(approx / step));
    for (var j = 1; j <= m; j++) {
      var u = j / m, v = 1 - u, p;
      if (s.t === 'Q') {
        p = [v * v * s.a[0] + 2 * v * u * s.c1[0] + u * u * s.b[0],
             v * v * s.a[1] + 2 * v * u * s.c1[1] + u * u * s.b[1]];
      } else {
        p = [v*v*v*s.a[0] + 3*v*v*u*s.c1[0] + 3*v*u*u*s.c2[0] + u*u*u*s.b[0],
             v*v*v*s.a[1] + 3*v*v*u*s.c1[1] + 3*v*u*u*s.c2[1] + u*u*u*s.b[1]];
      }
      out.push(p);
    }
  }

  /* Glass will not take a sharp corner: every corner between two straight runs
     becomes an arc of at least the minimum bend radius for that tube diameter. */
  function filletCorners(segs, r) {
    if (r <= 0.0001) return segs;
    var out = [];
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i], nxt = segs[i + 1];
      out.push(s);
      if (!nxt || s.t !== 'L' || nxt.t !== 'L') continue;
      if (dist(s.b, nxt.a) > 1e-6) continue;
      var v1 = [s.a[0] - s.b[0], s.a[1] - s.b[1]], l1 = Math.hypot(v1[0], v1[1]);
      var v2 = [nxt.b[0] - nxt.a[0], nxt.b[1] - nxt.a[1]], l2 = Math.hypot(v2[0], v2[1]);
      if (l1 < 1e-6 || l2 < 1e-6) continue;
      var cosA = (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2);
      if (cosA < -0.985) continue;                       // already straight
      var cut = Math.min(r, l1 * 0.45, l2 * 0.45);
      var p1 = [s.b[0] + v1[0] / l1 * cut, s.b[1] + v1[1] / l1 * cut];
      var p2 = [nxt.a[0] + v2[0] / l2 * cut, nxt.a[1] + v2[1] / l2 * cut];
      out[out.length - 1] = { t: 'L', a: s.a, b: p1 };
      out.push({ t: 'Q', a: p1, c1: s.b.slice(), b: p2 });
      segs[i + 1] = { t: 'L', a: p2, b: nxt.b };
    }
    return out;
  }

  /* One heat = one bend. Walking the finished centre line, we bank turning angle and
     book a bend every time the tube has turned 60 deg, or whenever it reverses. */
  function countBends(pts) {
    var bends = 0, bank = 0, prevDir = null, sign = 0;
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      var len = Math.hypot(dx, dy);
      if (len < 1e-7) continue;
      var dir = Math.atan2(dy, dx);
      if (prevDir !== null) {
        var da = dir - prevDir;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        var s = da > 0 ? 1 : -1;
        if (sign !== 0 && s !== sign && Math.abs(bank) > 0.35) { bends++; bank = 0; }
        sign = s;
        bank += da;
        if (Math.abs(bank) >= 1.047) { bends++; bank = 0; sign = 0; }
      }
      prevDir = dir;
    }
    if (Math.abs(bank) > 0.35) bends++;
    return bends;
  }

  function polyLength(pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
    return L;
  }

  /* ---------- layout: text -> tube runs, in em (1 em = letter height) ---------- */
  function layout(text, styleName, tubeMm, letterMm) {
    var st = S.STYLES[styleName];
    var minR = RATES.tube[tubeMm].minBendR / letterMm;      // mm -> em
    var filletR = Math.max(st.fillet, minR);
    var step = 0.022;

    var lines = String(text).split('\n').slice(0, 3);
    var built = [], maxW = 0, dropped = 0;

    lines.forEach(function (line, li) {
      var x = 0, runs = [], chars = 0;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        var g = S.glyph(styleName, ch);
        if (!g) { if (ch.trim()) dropped++; continue; }
        var adv = g[0] * st.widthScale;
        chars++;
        g[1].forEach(function (d, si) {
          var segs = filletCorners(parsePath(d), filletR);
          var pts = [];
          for (var k = 0; k < segs.length; k++) {
            if (k === 0 || dist(segs[k].a, segs[k - 1].b) > 1e-6) pts.push(segs[k].a);
            sampleSeg(segs[k], pts, step);
          }
          var moved = pts.map(function (p) { return [x + p[0] * st.widthScale, p[1]]; });
          runs.push({ pts: moved, joinable: st.join && si === 0 });
        });
        x += adv + (st.join ? 0 : RATES.tracking);
      }
      var w = x - (st.join ? 0 : RATES.tracking);
      maxW = Math.max(maxW, w);
      built.push({ runs: runs, width: Math.max(w, 0), y: -li * RATES.lineGap, chars: chars });
    });

    // script: neighbouring letters share an endpoint, so they are ONE piece of glass
    var runs = [];
    built.forEach(function (ln) {
      var dx = (maxW - ln.width) / 2, merged = [];
      ln.runs.forEach(function (r) {
        var pts = r.pts.map(function (p) { return [p[0] + dx, p[1] + ln.y]; });
        var last = merged[merged.length - 1];
        if (r.joinable && last && last.joinable && dist(last.pts[last.pts.length - 1], pts[0]) < 0.02) {
          last.pts = last.pts.concat(pts.slice(1));
        } else merged.push({ pts: pts, joinable: r.joinable });
      });
      runs = runs.concat(merged);
    });

    if (st.slant) {
      runs.forEach(function (r) {
        r.pts = r.pts.map(function (p) { return [p[0] + p[1] * st.slant, p[1]]; });
      });
    }

    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, totalLen = 0, totalBends = 0;
    runs.forEach(function (r) {
      r.length = polyLength(r.pts);
      r.bends = countBends(r.pts);
      totalLen += r.length; totalBends += r.bends;
      r.pts.forEach(function (p) {
        if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
      });
    });
    if (!runs.length) { minX = maxX = minY = maxY = 0; }

    return {
      runs: runs, dropped: dropped, lines: built.length,
      bbox: { minX: minX, maxX: maxX, minY: minY, maxY: maxY, w: maxX - minX, h: maxY - minY },
      lengthEm: totalLen, bends: totalBends, electrodePairs: runs.length
    };
  }

  /* ---------- the invoice, every line signed with its own arithmetic ---------- */
  function quote(geo, cfg) {
    var em = (cfg.letterMm != null ? cfg.letterMm / 1000 : cfg.letterCm / 100);   // metres per em
    var tube = RATES.tube[cfg.tube];
    var metres = geo.lengthEm * em;
    var lines = [];
    var round2 = function (v) { return Math.round(v * 100) / 100; };

    var tubeCost = metres * tube.rate;
    lines.push({ key: 'tube', label: 'Bent tube, ' + cfg.tube + ' mm',
      formula: round2(metres) + ' m measured on the curve x $' + tube.rate + '/m', amount: tubeCost });

    var bendCost = geo.bends * RATES.bend;
    lines.push({ key: 'bends', label: 'Bends',
      formula: geo.bends + ' heats x $' + RATES.bend.toFixed(2), amount: bendCost });

    var elCost = geo.electrodePairs * RATES.electrodePair;
    lines.push({ key: 'electrodes', label: 'Electrodes',
      formula: geo.electrodePairs + ' separate run' + (geo.electrodePairs === 1 ? '' : 's') + ' x $' + RATES.electrodePair.toFixed(2) + '/pair',
      amount: elCost });

    var back = RATES.backing[cfg.backing], backCost = 0, area = 0, perim = 0;
    var bw = (geo.bbox.w + RATES.backingMargin * 2) * em;
    var bh = (geo.bbox.h + RATES.backingMargin * 2) * em;
    if (cfg.backing !== 'none' && geo.runs.length) {
      area = bw * bh; perim = 2 * (bw + bh);
      backCost = area * back.rate + perim * RATES.backingEdge;
      lines.push({ key: 'backing', label: back.label,
        formula: round2(bw) + ' x ' + round2(bh) + ' m = ' + round2(area) + ' m2 x $' + back.rate + '/m2  +  ' + round2(perim) + ' m edge x $' + RATES.backingEdge.toFixed(2),
        amount: backCost });
    }

    var watts = metres * tube.wattsPerM;
    var need = watts * RATES.psuHeadroom;
    var psu = RATES.psu[RATES.psu.length - 1];
    for (var i = 0; i < RATES.psu.length; i++) if (RATES.psu[i].w >= need) { psu = RATES.psu[i]; break; }
    lines.push({ key: 'psu', label: 'Power supply ' + psu.w + ' W',
      formula: round2(metres) + ' m x ' + tube.wattsPerM + ' W/m = ' + round2(watts) + ' W, +25% headroom -> ' + psu.w + ' W unit',
      amount: psu.p });

    var mount = RATES.mount[cfg.mount];
    lines.push({ key: 'mount', label: mount.label, formula: 'fixed kit', amount: mount.price });
    lines.push({ key: 'bench', label: 'Bench assembly and 24 h burn-in', formula: 'fixed', amount: RATES.bench });

    var total = lines.reduce(function (a, l) { return a + l.amount; }, 0);
    return {
      lines: lines, total: total, metres: metres, watts: watts, psu: psu,
      widthM: geo.bbox.w * em, heightM: geo.bbox.h * em,
      backingW: bw, backingH: bh, area: area
    };
  }

  root.NeonBend = { RATES: RATES, layout: layout, quote: quote, countBends: countBends };
})(window);

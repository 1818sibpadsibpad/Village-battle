'use strict';
// ===== world: the village meadow — canal on the right, ponds, banana groves, mango & coconut trees, field huts =====

// ---- ponds (same shape maths as the original game) ----
function pondEdge(p, th) { let r = 1; for (const [k, a, ph] of p.harm) r += a * Math.sin(k * th + ph); return r; }
function pondRatio(p, x, y) {
  const c = Math.cos(-p.rot), sn = Math.sin(-p.rot);
  const dx = x - p.x, dy = y - p.y;
  const lx = (dx * c - dy * sn) / p.rx, ly = (dx * sn + dy * c) / p.ry;
  return Math.hypot(lx, ly) / pondEdge(p, Math.atan2(ly, lx));
}
function pondAt(w, x, y, pad = 0) {
  for (const p of w.ponds) if (pondRatio(p, x, y) < 1 + pad / Math.min(p.rx, p.ry)) return p;
  return null;
}
function pondPoint(p, th, f) {
  const r = pondEdge(p, th) * f;
  const lx = Math.cos(th) * r * p.rx, ly = Math.sin(th) * r * p.ry;
  const c = Math.cos(p.rot), sn = Math.sin(p.rot);
  return { x: p.x + lx * c - ly * sn, y: p.y + lx * sn + ly * c };
}
function outOfPond(p, x, y, margin = 0.06) {
  const dx = x - p.x, dy = y - p.y;
  const d = Math.hypot(dx, dy) || 0.001;
  let lo = 0, hi = d + Math.max(p.rx, p.ry) * 2 + 1;
  const ux = d > 0.002 ? dx / d : 1, uy = d > 0.002 ? dy / d : 0;
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (pondRatio(p, p.x + ux * mid, p.y + uy * mid) < 1) lo = mid; else hi = mid; }
  return { x: p.x + ux * (hi + margin), y: p.y + uy * (hi + margin) };
}
// ---- the river all round the field: the land is a wobbly rounded rectangle ----
// how far (x, y) lies inside the land (negative: out in the river)
// ---- the river all round the field: the land is a wobbly rounded rectangle ----
// how far (x, y) lies inside the land (negative: out in the river)
function landDepth(w, x, y) {
  const hx = w.W / 2 - w.mx, hy = w.H / 2 - w.my, rc = 2.4;
  const qx = Math.abs(x - w.W / 2) - (hx - rc), qy = Math.abs(y - w.H / 2) - (hy - rc);
  const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rc;
  const wob = 0.14 * Math.sin(y * 1.1 + 0.5) + 0.07 * Math.sin(y * 2.9 + 1.3) + 0.12 * Math.sin(x * 0.9 + 2.1) + 0.06 * Math.sin(x * 2.3 + 0.4);
  return -sd + wob;
}
// the right-hand bank at height y (the far side of the field)
function bankX(w, y, inset = 0) {
  let lo = w.W / 2, hi = w.W;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (landDepth(w, m, y) > inset) lo = m; else hi = m; }
  return lo;
}
function bankXL(w, y, inset = 0) {
  let lo = 0, hi = w.W / 2;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (landDepth(w, m, y) > inset) hi = m; else lo = m; }
  return hi;
}
// a point on the shore line (inset > 0: that far inland) along the ray from the middle at angle a
function edgePoint(w, a, inset = 0) {
  const cx = w.W / 2, cy = w.H / 2, ux = Math.cos(a), uy = Math.sin(a);
  let lo = 0, hi = Math.hypot(w.W, w.H);
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (landDepth(w, cx + ux * m, cy + uy * m) > inset) lo = m; else hi = m; }
  return { x: cx + ux * lo, y: cy + uy * lo };
}
function onLand(w, x, y) { return landDepth(w, x, y) > 0.05 && !pondAt(w, x, y); }
// back onto dry land, nudged in from the river by the margin
function landIn(w, x, y, margin) {
  const d = landDepth(w, x, y);
  if (d >= margin) return { x, y };
  // step toward the middle until deep enough
  const cx = w.W / 2, cy = w.H / 2;
  let px = x, py = y;
  for (let i = 0; i < 60 && landDepth(w, px, py) < margin; i++) {
    const e = 1e-3, gx = (landDepth(w, px + e, py) - landDepth(w, px - e, py)) / (2 * e), gy = (landDepth(w, px, py + e) - landDepth(w, px, py - e)) / (2 * e);
    const L = Math.hypot(gx, gy);
    const step = Math.max(0.02, margin - landDepth(w, px, py));
    if (L < 1e-4) { const u = Math.hypot(cx - px, cy - py) || 1; px += ((cx - px) / u) * step; py += ((cy - py) / u) * step; }
    else { px += (gx / L) * step; py += (gy / L) * step; }
  }
  return { x: px, y: py };
}
function shoreOut(w, x, y, margin = 0.1) {
  let pt = { x, y };
  for (let i = 0; i < 3; i++) { const p = pondAt(w, pt.x, pt.y, margin * 0.9); if (!p) break; pt = outOfPond(p, pt.x, pt.y, margin); }
  pt = landIn(w, pt.x, pt.y, 0.25);
  return pt;
}
function landPoly(w) {
  if (w._poly) return w._poly;
  const P = [];
  const n = 720;
  for (let i = 0; i < n; i++) P.push(edgePoint(w, (i / n) * TAU));
  w._poly = P;
  return P;
}
function tracePoly(g, P, off = 0, w = null, fresh = true) {
  if (fresh) g.beginPath();
  for (let i = 0; i < P.length; i++) {
    let x = P[i].x, y = P[i].y;
    if (off) { const a = P[(i + 1) % P.length], b = P[(i - 1 + P.length) % P.length]; let nx = a.y - b.y, ny = -(a.x - b.x); const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L; if (nx * (x - w.W / 2) + ny * (y - w.H / 2) < 0) { nx = -nx; ny = -ny; } x += nx * off; y += ny * off; }
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
}
function hutAt(w, x, y, pad = 0) {
  for (const h of w.huts) {
    if (h.collapsed) continue; const dx = (x - h.x) / (0.66 + pad), dy = (y - (h.y - 0.22)) / (0.36 + pad); if (dx * dx + dy * dy < 1) return h; }
  return null;
}
function underMango(w, x, y, pad = 0) {
  for (const m of w.mangoes) { const r = 1.2 * m.sc + pad; const dx = x - m.x, dy = y - m.y; if (dx * dx + (dy > 0 ? dy / 0.55 : dy / 1.1) ** 2 < r * r) return true; }
  return false;
}

// two maps: 'big' is the square three-lane field; 'lane' is a small long strip with one lane, corner to corner,
// and far less forest
function makeWorld(seed = 7303, kind = 'big') {
  const R = mulberry32(seed + (kind === 'lane' ? 911 : 0));
  const small = kind === 'lane';
  const S = 36, W = small ? 40 : S, H = small ? 14 : S;
  const N = small ? { ponds: 2, huts: 1, mango: 5, palmEdge: 9, palmIn: 2, banC: 3, banPer: 4, banS: 3, taro: 6, grass: 60, tufts: 1100 }
    : { ponds: 11, huts: 5, mango: 24, palmEdge: 26, palmIn: 10, banC: 16, banPer: 6, banS: 14, taro: 14, grass: 170, tufts: 2600 };
  const w = { W, H, kind, mx: 1.25, my: 1.25, time: 0, ponds: [], bananas: [], mangoes: [], palms: [], huts: [], jars: [], taros: [], grass: [], dummies: [], tufts: [], puddles: [], proj: [], fx: [], floaters: [], path: [], lanes: [], hutBits: [], spawn: { x: 4.4, y: small ? H - 4.3 : S - 4.4 } };
  w.bank = w.W - w.mx;
  const sp = w.spawn, bp = { x: W - sp.x, y: H - sp.y };
  const deep = (x, y, m) => landDepth(w, x, y) > m;
  // ---- three lanes from base to base, MOBA-style: top (up the left side and along the top), mid (the
  // diagonal), bottom (along the bottom and up the right side). Each wanders a little.
  const lane = (way) => {
    const pts = [];
    for (let i = 0; i < way.length - 1; i++) {
      const A = way[i], B = way[i + 1], n = Math.max(1, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / 1.2));
      for (let k = 0; k < n; k++) { const u = k / n; pts.push({ x: lerp(A[0], B[0], u), y: lerp(A[1], B[1], u) }); }
    }
    pts.push({ x: way[way.length - 1][0], y: way[way.length - 1][1] });
    // a gentle wander, not at the ends
    let off = 0;
    for (let i = 1; i < pts.length - 1; i++) { off = clamp(off + (R() - 0.5) * 0.35, -0.45, 0.45); pts[i].x += off * 0.7; pts[i].y += off * 0.7; }
    // round the corners off
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < pts.length - 1; i++) { pts[i].x = (pts[i - 1].x + pts[i].x * 2 + pts[i + 1].x) / 4; pts[i].y = (pts[i - 1].y + pts[i].y * 2 + pts[i + 1].y) / 4; }
    return pts;
  };
  const L0 = 3.7, L1 = S - 3.7;
  w.lanes = small ? [
    lane([[sp.x + 1.0, sp.y - 0.2], [W * 0.3, H * 0.5 + 1.1], [W * 0.5, H * 0.5], [W * 0.7, H * 0.5 - 1.1], [bp.x - 1.0, bp.y + 0.2]]),
  ] : [
    lane([[sp.x - 0.4, sp.y - 1.2], [L0, S * 0.62], [L0, S * 0.3], [L0 + 0.6, L0 + 0.6], [S * 0.3, L0], [S * 0.62, L0], [bp.x - 1.2, bp.y + 0.4]]),
    lane([[sp.x + 1.0, sp.y - 1.0], [S * 0.36, S * 0.64], [S * 0.5, S * 0.5], [S * 0.64, S * 0.36], [bp.x - 1.0, bp.y + 1.0]]),
    lane([[sp.x + 1.2, sp.y + 0.4], [S * 0.38, L1], [S * 0.7, L1], [L1 - 0.6, L1 - 0.6], [L1, S * 0.7], [L1, S * 0.38], [bp.x + 0.4, bp.y + 1.2]]),
  ];
  w.path = w.lanes[small ? 0 : 1];
  const laneD = (x, y) => { let best = 1e9; for (const P of w.lanes) for (let i = 1; i < P.length; i++) { const A = P[i - 1], B = P[i], dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy || 1, t = clamp(((x - A.x) * dx + (y - A.y) * dy) / L2, 0, 1); best = Math.min(best, Math.hypot(A.x + dx * t - x, A.y + dy * t - y)); } return best; };
  const baseD = (x, y) => Math.min(Math.hypot(x - sp.x, y - sp.y), Math.hypot(x - bp.x, y - bp.y));
  // the jungle: everything off the lanes and away from the camps
  const inner = small ? (x, y, m) => x > 2.4 + m && x < W - 2.4 - m && y > 2.1 + m && y < H - 2.1 - m
    : (x, y, m) => x > L0 + 0.9 + m && x < L1 - 0.9 - m && y > L0 + 0.9 + m && y < L1 - 0.9 - m;
  placeTowers(w);
  const farTower = (x, y, m) => !towerNear(w, x, y, 2.0 + m);
  // the shallow river across the middle, then the old temple walls along the jungle's edges
  makeRiver(w, R);
  makeWalls(w, R, (x, y) => deep(x, y, 0.5) && inner(x, y, 0.2) && laneD(x, y) > 1.35 && !riverAt(w, x, y, 0.9) && baseD(x, y) > 4.6 && farTower(x, y, 0.3));
  const dry = (x, y, m) => !riverAt(w, x, y, m) && !wallAt(w, x, y, m);
  const jungle = (x, y, m) => deep(x, y, 0.4 + m) && inner(x, y, 0) && laneD(x, y) > 1.0 + m && baseD(x, y) > 4.2 + m && farTower(x, y, m) && dry(x, y, 0.55 + m);
  // ---- swamps in the jungle
  for (let tries = 0; tries < 3000 && w.ponds.length < N.ponds; tries++) {
    const big = R();
    const rx = 0.7 + big * big * 1.4, ry = rx * (0.5 + R() * 0.4);
    const x = 2 + R() * (W - 4), y = 2 + R() * (H - 4);
    if (!jungle(x, y, rx + 0.3)) continue;
    if (w.ponds.some((o) => Math.hypot(o.x - x, o.y - y) < Math.max(o.rx, o.ry) + rx + 1.6)) continue;
    const harm = [];
    const style = Math.floor(R() * 5);
    if (style === 1) harm.push([1, 0.12, R() * 6.28], [2, 0.16, R() * 6.28]);
    if (style === 2) harm.push([2, 0.22, R() * 6.28]);
    if (style === 3) harm.push([3, 0.16, R() * 6.28]);
    if (style === 4) for (const k of [2, 3, 5]) harm.push([k, 0.05 + R() * 0.07, R() * 6.28]);
    harm.push([6, 0.03, R() * 6.28]);
    const p = { id: w.ponds.length, x, y, rx, ry, rot: (R() - 0.5) * 0.8, harm, pads: [] };
    const n = 3 + Math.floor(R() * 6);
    for (let i = 0; i < n; i++) { const q = pondPoint(p, R() * TAU, 0.35 + R() * 0.5); p.pads.push({ x: q.x, y: q.y, r: 0.07 + R() * 0.06, a: R() * TAU, flower: R() < 0.35, ph: R() * 6 }); }
    w.ponds.push(p);
  }
  // ---- field huts: in the jungle, by a swamp or a lane
  for (let tries = 0; tries < 3000 && w.huts.length < N.huts; tries++) {
    const x = 3 + R() * (W - 6), y = 3 + R() * (H - 6);
    if (!jungle(x, y, 0.9) || laneD(x, y) > 3.2) continue;
    if (pondAt(w, x, y, 1.1) || pondAt(w, x, y - 0.5, 1.1)) continue;
    if (wallAt(w, x, y, 1.8) || wallAt(w, x, y - 0.9, 1.8) || wallAt(w, x, y + 0.6, 1.4)) continue;
    if (w.huts.some((h) => Math.hypot(h.x - x, h.y - y) < 6)) continue;
    w.huts.push(makeHut(x, y, R() < 0.5, Math.floor(R() * 1e6)));
    const f = R() < 0.5 ? -1 : 1;
    for (let i = 0; i < 2; i++) w.jars.push({ x: x + f * (0.85 + i * 0.26), y: y + 0.12 + i * 0.1, lid: i === 0, state: 'up', t: 0, dir: 0 });
  }
  // ---- mango trees: the jungle canopy
  for (let tries = 0; tries < 12000 && w.mangoes.length < N.mango; tries++) {
    const x = 2 + R() * (W - 4), y = 2 + R() * (H - 4);
    const sc = 0.85 + R() * 0.35, cr = 1.2 * sc;
    if (!jungle(x, y, 0.5)) continue;
    if (pondAt(w, x, y, cr + 0.3) || hutAt(w, x, y, cr + 0.4)) continue;
    if (w.mangoes.some((m) => Math.hypot(m.x - x, m.y - y) < 2.7)) continue;
    w.mangoes.push({ x, y, sc, flip: R() < 0.5, seed: Math.floor(R() * 1e6), phase: R() * 7, rustle: 0, rustleV: 0, lean: 0, leanV: 0 });
  }
  // ---- coconut palms: all round the river bank leaning out over the water, by the swamps, a few in the jungle
  const palmFree = (x, y) => deep(x, y, 0.2) && !pondAt(w, x, y, 0.25) && !hutAt(w, x, y, 0.9) && !underMango(w, x, y, 0.2) && !w.palms.some((c) => Math.hypot(c.x - x, c.y - y) < 1.3) && baseD(x, y) > 4.6 && laneD(x, y) > 0.75 && farTower(x, y, 0.3) && dry(x, y, 0.3);
  const addPalm = (x, y, lean, kind) => { if (!palmFree(x, y)) return false; w.palms.push(makePalm(R, x, y, lean, kind != null ? kind : [0, 2, 3, 0][Math.floor(R() * 4)])); return true; };
  for (let i = 0, t = 0; i < N.palmEdge && t < 800; t++) { const a = R() * TAU, side = Math.abs(Math.cos(a)) > 0.75, q = edgePoint(w, a, 0.45 + R() * 0.3), o = edgePoint(w, a, -0.5); if (addPalm(q.x, q.y, side ? clamp((o.x - q.x) * 1.4, -0.9, 0.9) : (R() - 0.5) * 0.3, side ? (R() < 0.7 ? 1 : R() < 0.5 ? 3 : 0) : (R() < 0.6 ? 0 : 3))) i++; }
  for (const p of w.ponds) for (let i = 0, t = 0; i < 1 + (R() < 0.5 ? 1 : 0) && t < 40; t++) {
    const th = R() * TAU, q = pondPoint(p, th, 1);
    const x = q.x + Math.cos(th) * 0.4, y = q.y + Math.sin(th) * 0.3;
    if (addPalm(x, y, (p.x - x > 0 ? 1 : -1) * (0.3 + R() * 0.4))) i++;
  }
  for (let i = 0, t = 0; i < N.palmIn && t < 400; t++) { const x = 2 + R() * (W - 4), y = 2 + R() * (H - 4); if (jungle(x, y, 0) && addPalm(x, y, (R() - 0.5) * 0.4)) i++; }
  // ---- banana groves through the jungle
  const bFree = (x, y, gap) => jungle(x, y, 0) && !pondAt(w, x, y, 0.35) && !hutAt(w, x, y, 0.4) && !underMango(w, x, y, 0.25) && !w.palms.some((c) => Math.hypot(c.x - x, c.y - y) < 0.55) && !w.bananas.some((b) => Math.hypot(b.x - x, b.y - y) < gap);
  const gauss = () => (R() + R() + R() - 1.5) / 1.5;
  const centres = [];
  for (let t = 0; t < 3000 && centres.length < N.banC; t++) {
    const x = 2 + R() * (W - 4), y = 2 + R() * (H - 4);
    if (!bFree(x, y, 0) || centres.some((c) => Math.hypot(c.x - x, c.y - y) < 3.2)) continue;
    centres.push({ x, y });
  }
  for (const c of centres) for (let i = 0, t = 0; i < N.banPer && t < 200; t++) { const x = c.x + gauss() * 0.8, y = c.y + gauss() * 0.9; if (bFree(x, y, 0.5)) { w.bananas.push(makeBanana(R, x, y)); i++; } }
  for (let i = 0, t = 0; i < N.banS && t < 2000; t++) { const x = 2 + R() * (W - 4), y = 2 + R() * (H - 4); if (bFree(x, y, 1.2)) { w.bananas.push(makeBanana(R, x, y)); i++; } }
  // ---- training dummies at the red camp
  for (const [dx, dy] of small ? [[1.7, 2.0], [0.5, -2.5], [2.3, -1.9]] : [[2.3, -0.6], [0.6, -2.3], [2.0, -2.0]]) {
    const q = shoreOut(w, sp.x + dx, sp.y + dy, 0.3);
    w.dummies.push({ x: q.x, y: q.y, wob: 0, wobV: 0, hitT: 9, total: 0 });
  }
  // ---- taro along the river and round the swamps
  const tFree = (x, y) => deep(x, y, 0.12) && farTower(x, y, -0.5) && dry(x, y, 0.08) && !pondAt(w, x, y, 0.06) && !hutAt(w, x, y, 0.1) && laneD(x, y) > 0.7 && baseD(x, y) > 3 && !w.taros.some((t) => Math.hypot(t.x - x, t.y - y) < 0.16) && !w.bananas.some((b) => Math.hypot(b.x - x, b.y - y) < 0.25) && !w.palms.some((c) => Math.hypot(c.x - x, c.y - y) < 0.25) && !w.dummies.some((d) => Math.hypot(d.x - x, d.y - y) < 0.4);
  const patch = (cx, cy, rx, ry, n) => { for (let i = 0, t = 0; i < n && t < n * 8; t++) { const x = cx + gauss() * rx, y = cy + gauss() * ry; if (tFree(x, y)) { w.taros.push({ x, y, v: R(), sc: 0.8 + R() * 0.4, flip: R() < 0.5, lean: 0, leanV: 0, flat: 0, flatT: 99, flatAng: 0 }); i++; } } };
  for (let i = 0; i < N.taro; i++) { const q = edgePoint(w, R() * TAU, 0.55); patch(q.x, q.y, 0.5, 0.5, 14); }
  for (const p of w.ponds) for (let k = 0; k < 2; k++) { const q = pondPoint(p, R() * TAU, 1); patch(q.x + (q.x - p.x) * 0.25, q.y + (q.y - p.y) * 0.25, 0.45, 0.35, 12); }
  // ---- long grass: round every swamp, along the river, thick through the jungle
  for (const p of w.ponds) {
    const n = Math.round((Math.PI * (p.rx + p.ry)) / 0.16);
    for (let i = 0; i < n; i++) { if (R() < 0.3) continue; const q = pondPoint(p, (i / n) * TAU + R() * 0.05, 1.03 + R() * 0.08); w.grass.push(mkGrass(R, q.x, q.y, 0.8 + R() * 0.5)); }
  }
  { const P = landPoly(w); for (let i = 0; i < P.length; i += 2) if (R() < 0.45) { const q = edgePoint(w, (i / P.length) * TAU, 0.12 + R() * 0.08); if (laneD(q.x, q.y) > 0.6) w.grass.push(mkGrass(R, q.x, q.y, 0.9 + R() * 0.6)); } }
  for (let i = 0, t = 0; i < N.grass && t < 3000; t++) { const x = 1 + R() * (W - 2), y = 1 + R() * (H - 2); if (onLand(w, x, y) && laneD(x, y) > 0.75 && !hutAt(w, x, y, 0.2) && baseD(x, y) > 2.5 && farTower(x, y, -0.6) && dry(x, y, 0.1)) { w.grass.push(mkGrass(R, x, y, 0.6 + R() * 0.6)); i++; } }
  // ---- little still tufts everywhere but on the trodden lanes
  for (let i = 0; i < N.tufts; i++) { const x = 0.5 + R() * (W - 1), y = 0.5 + R() * (H - 1); if (onLand(w, x, y) && laneD(x, y) > 0.45 && dry(x, y, 0)) w.tufts.push({ x, y, s: 0.04 + R() * 0.05, a: R() * 9, c: Math.floor(R() * 3) }); }
  w.tufts.sort((a, b) => a.y - b.y);
  w.spawns = { red: { x: sp.x, y: sp.y }, blue: { x: bp.x, y: bp.y } };
  w.score = { red: 0, blue: 0 };
  w.feed = [];
  w.actors = [];
  w.solids = [];
  for (const m of w.mangoes) w.solids.push({ x: m.x, y: m.y, r: 0.17 });
  for (const c of w.palms) w.solids.push({ x: c.x, y: c.y, r: 0.12 });
  for (const d of w.dummies) w.solids.push({ x: d.x, y: d.y, r: 0.1 });
  for (const t of w.towers) w.solids.push(t.solid);
  return w;
}
function nearPath(w, x, y, r) {
  for (const P of w.lanes && w.lanes.length ? w.lanes : [w.path]) for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i];
    const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / L2, 0, 1);
    if (Math.hypot(a.x + dx * t - x, a.y + dy * t - y) < r) return true;
  }
  return false;
}
function mkGrass(R, x, y, sc) {
  const n = 6 + Math.floor(R() * 5), blades = [];
  for (let i = 0; i < n; i++) blades.push({ a: (i / (n - 1) - 0.5) * 1.3 + (R() - 0.5) * 0.25, l: (0.13 + R() * 0.12) * sc, c: Math.floor(R() * 4), ph: R() * 6 });
  return { x, y, blades, lean: 0, leanV: 0 };
}
// ---------- the world's moving parts ----------
function tickWorld(w, dt, movers) {
  w.time += dt;
  for (const b of w.bananas) tickBanana(b, dt, movers);
  for (const mg of w.mangoes) {
    mg.leanV += (-30 * mg.lean - 4 * mg.leanV) * dt;
    mg.lean = clamp(mg.lean + mg.leanV * dt, -0.25, 0.25);
    mg.rustleV += (-40 * mg.rustle - 3.5 * mg.rustleV) * dt;
    mg.rustle = clamp(mg.rustle + mg.rustleV * dt, -1, 1);
    const cr = 1.2 * mg.sc;
    for (const m of movers) {
      const d = Math.hypot(m.x - mg.x, m.y - mg.y);
      if (d > cr || !m.moving) continue;
      mg.rustleV += (2.5 + 6 * (1 - d / cr)) * dt;
      if (d < 0.3) mg.leanV += (m.x >= mg.x ? 1 : -1) * 2.5 * dt;
    }
  }
  tickFlora(w, dt, movers);
  for (const t of w.taros) {
    for (const m of movers) {
      if (m.air) continue;
      const dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy);
      const outer = 0.2 * t.sc + 0.1;
      if (d > outer || !m.moving) continue;
      t.leanV += (dx >= 0 ? 1 : -1) * 9 * dt * (1 - d / outer) + m.vx * 3 * dt;
      if (d < 0.13 * t.sc + 0.08) { t.flat = Math.max(t.flat, 0.05); t.flatT = 0; t.flatAng = m.vx >= 0 ? 1 : -1; }
    }
    t.leanV += (-38 * t.lean - 3.2 * t.leanV) * dt;
    t.lean = clamp(t.lean + t.leanV * dt, -0.6, 0.6);
    t.flatT += dt;
    const goal = t.flatT < 8 ? 1 : 0;
    if (t.flat > 0 || goal === 0) t.flat = goal ? Math.min(1, t.flat + dt * 7) : Math.max(0, t.flat - dt / 2.2);
  }
  for (const gr of w.grass) {
    for (const m of movers) {
      if (m.air) continue;
      const d = Math.hypot(m.x - gr.x, m.y - gr.y);
      if (d > 0.2 || !m.moving) continue;
      gr.leanV += ((m.vx >= 0 ? 1 : -1) * 30 + (m.x < gr.x ? 1 : -1) * 8) * (1 - d / 0.2) * dt;
    }
    gr.leanV += (-30 * gr.lean - 3.6 * gr.leanV) * dt;
    gr.lean = clamp(gr.lean + gr.leanV * dt, -1.1, 1.1);
  }
  for (const d of w.dummies) {
    d.wobV += (-40 * d.wob - 3 * d.wobV) * dt;
    d.wob = clamp(d.wob + d.wobV * dt, -0.6, 0.6);
    d.hitT += dt;
  }
  for (const j of w.jars) {
    if (j.state !== 'up') { j.t += dt; continue; }
    for (const m of movers) {
      if (m.air || !m.moving || Math.hypot(m.x - j.x, m.y - j.y) > 0.14) continue;
      knockJar(w, j, Math.atan2(m.vy || 0.001, m.vx || 0.001));
      break;
    }
  }
  for (const pd of w.puddles) pd.age += dt;
  w.puddles = w.puddles.filter((pd) => pd.age < 40);
  tickHuts(w, dt, movers);
  tickTowers(w, dt);
}
function knockJar(w, j, dir) {
  if (j.state !== 'up') return;
  j.state = 'down'; j.t = 0; j.dir = dir;
  w.puddles.push({ x: j.x + Math.cos(dir) * 0.16, y: j.y + Math.sin(dir) * 0.1, dir, long: j.lid ? 1.5 : 1.9, age: 0, size: j.lid ? 0.24 : 0.32 });
  addFx(w, { k: 'splash', x: j.x + Math.cos(dir) * 0.14, y: j.y, t: 0, dur: 0.7, power: 0.4, seed: Math.random() * 1e3 });
}

// collision: keep a walker on dry land and off the tree trunks and huts
function resolve(w, o, r) {
  o.y = clamp(o.y, 0.4, w.H - 0.35);
  if (landDepth(w, o.x, o.y) < 0.1 + r) { const q = landIn(w, o.x, o.y, 0.1 + r); o.x = q.x; o.y = q.y; }
  wallResolve(w, o, r);
  for (const p of w.ponds) if (pondRatio(p, o.x, o.y) < 1 + (r + 0.02) / Math.min(p.rx, p.ry)) { const q = outOfPond(p, o.x, o.y, r + 0.03); o.x = q.x; o.y = q.y; }
  for (const s of w.solids) {
    const dx = o.x - s.x, dy = o.y - s.y, d = Math.hypot(dx, dy), m = s.r + r;
    if (d < m && d > 1e-5) { o.x = s.x + (dx / d) * m; o.y = s.y + (dy / d) * m; }
  }
  for (const h of w.huts) {
    if (h.collapsed) continue;
    const cy = h.y - 0.22;
    let nx = (o.x - h.x) / (0.66 + r), ny = (o.y - cy) / (0.36 + r);
    const n = Math.hypot(nx, ny);
    if (n < 1) { nx /= n || 1; ny /= n || 1; o.x = h.x + nx * (0.67 + r); o.y = cy + ny * (0.37 + r); }
  }
}

// ---------- the camera ----------
const cam = { x: 0, y: 0, U: 140, vw: 800, vh: 400 };
function w2s(x, y) { return [(x - cam.x) * cam.U + cam.vw / 2, (y - cam.y) * cam.U * TILT + cam.vh / 2]; }
function s2w(px, py) { return [(px - cam.vw / 2) / cam.U + cam.x, (py - cam.vh / 2) / (cam.U * TILT) + cam.y]; }
function worldTransform(g) { g.setTransform(DPR * cam.U, 0, 0, DPR * cam.U * TILT, DPR * (cam.vw / 2 - cam.x * cam.U), DPR * (cam.vh / 2 - cam.y * cam.U * TILT)); }
function screenTransform(g) { g.setTransform(DPR, 0, 0, DPR, 0, 0); }

// ---------- caches ----------
let grassTile = null, grassPattern = null, featCache = null;
function buildGrassTile(g) {
  const T = 512;
  const c = document.createElement('canvas');
  c.width = c.height = T;
  const t = c.getContext('2d');
  t.fillStyle = '#6a8a38';
  t.fillRect(0, 0, T, T);
  const R = mulberry32(99);
  const blob = (x, y, r, col) => { for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) { const grd = t.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); grd.addColorStop(0, col); grd.addColorStop(1, 'rgba(0,0,0,0)'); t.fillStyle = grd; t.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); } };
  for (let i = 0; i < 18; i++) blob(R() * T, R() * T, 40 + R() * 90, R() < 0.5 ? 'rgba(60,90,30,0.35)' : 'rgba(150,165,80,0.22)');
  const cols = ['#5d7e30', '#7a9a44', '#86a64e', '#4f6f2a', '#94b05a', '#6a8a36', '#a2b864'];
  t.lineCap = 'round';
  for (let i = 0; i < 4200; i++) {
    const x = R() * T, y = R() * T, L = 4 + R() * 9, a = -Math.PI / 2 + (R() - 0.5) * 0.9;
    t.strokeStyle = cols[Math.floor(R() * cols.length)];
    t.lineWidth = 1 + R() * 1.4;
    for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) {
      const xx = x + ox, yy = y + oy;
      if (xx < -12 || yy < -12 || xx > T + 12 || yy > T + 12) continue;
      t.beginPath();
      t.moveTo(xx, yy);
      t.quadraticCurveTo(xx + Math.cos(a) * L * 0.5 + 1, yy + Math.sin(a) * L * 0.5, xx + Math.cos(a) * L, yy + Math.sin(a) * L);
      t.stroke();
    }
  }
  for (let i = 0; i < 26; i++) { const x = R() * T, y = R() * T; t.fillStyle = R() < 0.5 ? '#f4efd6' : '#f2d65a'; t.beginPath(); t.arc(x, y, 1.6 + R() * 1.4, 0, TAU); t.fill(); }
  grassTile = c;
  grassPattern = g.createPattern(c, 'repeat');
}
function pathTrace(t, pts) {
  t.beginPath();
  t.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; t.quadraticCurveTo(pts[i].x, pts[i].y, mx, my); }
  const L = pts[pts.length - 1];
  t.lineTo(L.x, L.y);
}
function pondPath(g, p, k, wob = 0, seed = 0) {
  const c = Math.cos(p.rot), sn = Math.sin(p.rot);
  g.beginPath();
  for (let i = 0; i <= 56; i++) {
    const th = (i / 56) * TAU;
    const r = pondEdge(p, th) * k + (wob ? wob * Math.sin(th * 7 + seed) + wob * 0.6 * Math.sin(th * 13 + seed * 2.3) : 0);
    const lx = Math.cos(th) * r * p.rx, ly = Math.sin(th) * r * p.ry;
    const x = p.x + lx * c - ly * sn, y = p.y + lx * sn + ly * c;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
}
function buildFeatures(w) {
  const P = 48;
  const c = document.createElement('canvas');
  c.width = w.W * P;
  c.height = w.H * P;
  const t = c.getContext('2d');
  t.scale(P, P);
  const R = mulberry32(4242);
  for (let i = 0; i < 70; i++) {
    const x = R() * w.W, y = R() * w.H, r = 0.7 + R() * 1.8;
    const grd = t.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, R() < 0.55 ? 'rgba(40,70,22,0.22)' : 'rgba(176,180,90,0.18)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    t.fillStyle = grd;
    t.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // damp, darker ground round every pond and along the river
  for (const p of w.ponds) for (const [k, a] of [[1.7, 0.07], [1.45, 0.1], [1.25, 0.14]]) { t.fillStyle = `rgba(30,55,24,${a})`; pondPath(t, p, k); t.fill(); }
  { t.lineJoin = 'round'; const P = landPoly(w); for (const [wd, a] of [[3.0, 0.08], [1.8, 0.1], [0.9, 0.14]]) { t.strokeStyle = `rgba(30,55,24,${a})`; t.lineWidth = wd; tracePoly(t, P); t.stroke(); } }
  // the worn dirt path
  t.lineCap = 'round';
  t.lineJoin = 'round';
  const lanesDraw = w.lanes && w.lanes.length ? w.lanes : [w.path];
  // the camps: trodden bare earth
  for (const c of w.spawns ? [w.spawns.red, w.spawns.blue] : []) { const grd = t.createRadialGradient(c.x, c.y, 0, c.x, c.y, 3.2); grd.addColorStop(0, 'rgba(176,146,96,0.55)'); grd.addColorStop(0.6, 'rgba(150,120,72,0.35)'); grd.addColorStop(1, 'rgba(120,100,60,0)'); t.fillStyle = grd; t.beginPath(); t.arc(c.x, c.y, 3.2, 0, TAU); t.fill(); }
  for (const P of lanesDraw) for (const [wd, col] of [[1.7, 'rgba(120,100,60,0.16)'], [1.35, 'rgba(140,114,68,0.32)'], [1.0, 'rgba(158,128,80,0.48)'], [0.62, 'rgba(176,146,96,0.42)'], [0.16, 'rgba(120,96,56,0.25)']]) { t.strokeStyle = col; t.lineWidth = wd; pathTrace(t, P); t.stroke(); }
  for (let i = 0; i < 900; i++) {
    const P = lanesDraw[i % lanesDraw.length];
    const a = P[Math.floor(R() * (P.length - 1))], b = P[Math.min(P.length - 1, P.indexOf(a) + 1)];
    const u = R(), x = lerp(a.x, b.x, u) + (R() - 0.5) * 1.1, y = lerp(a.y, b.y, u) + (R() - 0.5) * 1.1;
    t.fillStyle = R() < 0.5 ? 'rgba(90,72,44,0.5)' : 'rgba(210,190,150,0.5)';
    t.beginPath(); t.ellipse(x, y, 0.025 + R() * 0.03, 0.02, R() * 3, 0, TAU); t.fill();
  }
  drawRiverBed(t, w, R);

  // shade under the trees and huts
  const shade = (x, y, rx, ry, a) => { t.save(); t.translate(x, y); t.scale(1, ry / rx); const grd = t.createRadialGradient(0, 0, 0, 0, 0, rx); grd.addColorStop(0, `rgba(10,28,10,${a})`); grd.addColorStop(0.6, `rgba(10,28,10,${a * 0.6})`); grd.addColorStop(1, 'rgba(10,28,10,0)'); t.fillStyle = grd; t.beginPath(); t.arc(0, 0, rx, 0, TAU); t.fill(); t.restore(); };
  for (const m of w.mangoes) shade(m.x + 0.35 * m.sc, m.y - 0.15, 1.45 * m.sc, 1.1 * m.sc, 0.42);
  for (const c of w.palms) shade(c.x + c.lean * 0.8 + 0.3, c.y - 0.05, 0.9, 0.6, 0.3);
  featCache = c;
}

// ---------- tree / hut sprites, drawn once at the current zoom ----------
function spriteCanvas(wu, hu, res) { const c = document.createElement('canvas'); c.width = Math.ceil(wu * res); c.height = Math.ceil(hu * res); return c; }
function buildMango(m, res) {
  const R = mulberry32(m.seed);
  const sc = m.sc, Rr = 1.15 * sc;
  const W = Rr * 2.6, H = 0.8 + Rr * 1.85 + 0.2;
  const c = spriteCanvas(W, H, res);
  const g = c.getContext('2d');
  const px = W / 2, py = H - 0.12;
  g.scale(res, res);
  g.translate(px, py);
  const cy = -(0.75 + Rr * 0.75), rx = Rr * 1.12, ry = Rr * 0.8;
  // trunk and limbs
  const limbs = [[-0.45, -0.8], [0.0, -1.0], [0.5, -0.75], [-0.2, -0.55]];
  g.lineCap = 'round';
  for (const pass of [0, 1]) {
    g.strokeStyle = pass ? '#6a4a34' : INK;
    for (const [lx, ly] of limbs) { g.lineWidth = (pass ? 0.07 : 0.1) * sc; g.beginPath(); g.moveTo(0, -0.62); g.quadraticCurveTo(lx * 0.4 * Rr, cy + 0.2, lx * Rr * 0.9, cy + ly * ry * 0.6); g.stroke(); }
    g.beginPath();
    g.moveTo(-0.17, 0.02); g.quadraticCurveTo(-0.08, -0.25, -0.09, -0.7); g.lineTo(0.08, -0.7); g.quadraticCurveTo(0.07, -0.25, 0.18, 0.02); g.closePath();
    if (pass) { g.fillStyle = '#5b4030'; g.fill(); } else { g.lineWidth = 0.04; g.stroke(); }
  }
  g.strokeStyle = 'rgba(30,18,10,0.5)';
  g.lineWidth = 0.012;
  for (let i = 0; i < 6; i++) { const x = -0.06 + i * 0.024; g.beginPath(); g.moveTo(x, -0.05); g.lineTo(x + (R() - 0.5) * 0.03, -0.6); g.stroke(); }
  g.fillStyle = 'rgba(160,120,80,0.45)';
  g.fillRect(0.02, -0.65, 0.035, 0.6);
  // the crown: puffy leaf clumps lit from the upper left
  const cl = [];
  for (let i = 0; i < 64; i++) {
    const th = R() * TAU, rr = Math.sqrt(R()) * 0.9;
    cl.push({ x: Math.cos(th) * rx * rr, y: cy + Math.sin(th) * ry * rr, r: (0.2 + R() * 0.14) * Math.sqrt(sc) });
  }
  cl.sort((a, b) => a.y - b.y);
  g.fillStyle = INK;
  for (const k of cl) { g.beginPath(); g.arc(k.x, k.y, k.r + 0.03, 0, TAU); g.fill(); }
  g.fillStyle = '#21451b';
  for (const k of cl) { g.beginPath(); g.arc(k.x, k.y, k.r, 0, TAU); g.fill(); }
  for (const k of cl) {
    const light = clamp(0.5 - (k.y - cy) / ry * 0.35 - k.x / rx * 0.2, 0, 1);
    const grd = g.createRadialGradient(k.x - k.r * 0.35, k.y - k.r * 0.4, k.r * 0.1, k.x, k.y, k.r);
    grd.addColorStop(0, `rgb(${Math.round(84 + 40 * light)},${Math.round(140 + 40 * light)},${Math.round(60 + 20 * light)})`);
    grd.addColorStop(0.6, '#3a7030');
    grd.addColorStop(1, '#24481e');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(k.x, k.y, k.r * 0.95, 0, TAU);
    g.fill();
  }
  for (let i = 0; i < 520; i++) {
    const k = cl[Math.floor(R() * cl.length)];
    const a = R() * TAU, d = R() * k.r * 0.85;
    const x = k.x + Math.cos(a) * d, y = k.y + Math.sin(a) * d;
    const up = y < k.y - k.r * 0.1 && x < k.x + k.r * 0.2;
    g.fillStyle = up ? (R() < 0.5 ? 'rgba(160,210,110,0.55)' : 'rgba(120,180,80,0.5)') : 'rgba(18,40,14,0.45)';
    g.beginPath();
    g.ellipse(x, y, 0.035, 0.014, R() * 3, 0, TAU);
    g.fill();
  }
  // a few mangoes hanging under the crown
  for (let i = 0; i < 7; i++) {
    const x = (R() - 0.5) * rx * 1.3, y = cy + ry * (0.45 + R() * 0.3);
    g.strokeStyle = '#4a3a20'; g.lineWidth = 0.012;
    g.beginPath(); g.moveTo(x, y - 0.06); g.lineTo(x + 0.01, y); g.stroke();
    g.fillStyle = R() < 0.5 ? '#c8c24a' : '#a8b843';
    g.strokeStyle = INK; g.lineWidth = 0.014;
    g.beginPath(); g.ellipse(x + 0.01, y + 0.04, 0.035, 0.055, 0.3, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(230,140,60,0.6)';
    g.beginPath(); g.ellipse(x - 0.003, y + 0.03, 0.014, 0.022, 0.3, 0, TAU); g.fill();
  }
  return { c, px, py, W, H, top: -(H - 0.12), half: rx + 0.3, crownBottom: cy + ry };
}
let sprites = { res: 0, mango: [], palm: [], hut: [] };
function buildSprites(w) {
  const res = Math.round(clamp(cam.U * DPR, 120, 300));
  if (sprites.res === res && sprites.w === w) return;
  sprites = { res, w, mango: w.mangoes.map((m) => buildMango(m, res)), palm: w.palms.map((p) => buildPalmSprites(p, res)), hut: w.huts.map((h) => buildHutPics(h, res)) };
}
function drawSprite(g, sp, x, y, k, shear = 0, squash = 1, alpha = 1) {
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  if (shear || squash !== 1) g.transform(1, 0, -shear, squash, 0, 0);
  g.drawImage(sp.c, -sp.px * k, -sp.py * k, sp.W * k, sp.H * k);
  g.restore();
}

// ---------- ground layer (drawn in world space, squashed by the slant) ----------
function drawGround(g, w) {
  worldTransform(g);
  const [x0, y0] = s2w(0, 0), [x1, y1] = s2w(cam.vw, cam.vh);
  g.fillStyle = '#28401c';
  g.fillRect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
  if (grassPattern) {
    const T = grassTile.width;
    if (grassPattern.setTransform) grassPattern.setTransform(new DOMMatrix().scale(1.4 / T, 1.4 / T));
    g.fillStyle = grassPattern;
    g.fillRect(Math.max(0, x0), Math.max(0, y0), Math.min(w.W, x1) - Math.max(0, x0), Math.min(w.H, y1) - Math.max(0, y0));
  }
  if (featCache) g.drawImage(featCache, 0, 0, w.W, w.H);
  drawRiver(g, w, x0, y0, x1, y1);
  drawRiverWater(g, w);
  for (const p of w.ponds) drawPond(g, w, p);
  if (w.spawns) for (const tm of ['red', 'blue']) {
    const sp = w.spawns[tm], col = tm === 'red' ? '236,110,90' : '110,160,240';
    const pulse = 0.5 + 0.5 * Math.sin(w.time * 2);
    const grd = g.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 1.15);
    grd.addColorStop(0, `rgba(${col},0.0)`); grd.addColorStop(0.75, `rgba(${col},${0.12 + 0.06 * pulse})`); grd.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grd; g.beginPath(); g.arc(sp.x, sp.y, 1.15, 0, TAU); g.fill();
    g.strokeStyle = `rgba(${col},0.55)`; g.lineWidth = 0.03; g.setLineDash([0.12, 0.08]);
    g.beginPath(); g.arc(sp.x, sp.y, 1.1, w.time * 0.2, w.time * 0.2 + TAU); g.stroke(); g.setLineDash([]);
  }
  for (const pd of w.puddles) drawPuddle(g, pd);
}
function drawRiver(g, w, x0, y0, x1, y1) {
  const P = landPoly(w), t = w.time;
  // water everywhere off the land
  g.save();
  g.beginPath(); g.rect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
  tracePoly(g, P, 0, w, false);
  g.fillStyle = 'rgb(34,78,62)';
  g.fill('evenodd');
  g.clip('evenodd');
  // shallows by the bank, deep water further out
  g.lineJoin = 'round';
  for (const [wd, col] of [[1.6, 'rgba(46,92,72,0.8)'], [0.8, 'rgba(62,108,82,0.8)'], [0.35, 'rgba(78,124,90,0.9)']]) { g.strokeStyle = col; g.lineWidth = wd; tracePoly(g, P); g.stroke(); }
  g.strokeStyle = 'rgba(20,36,24,0.35)'; g.lineWidth = 0.25; tracePoly(g, P, 0.12, w); g.stroke();
  // the current running round the field
  g.lineCap = 'round';
  const n = P.length;
  for (let i = 0; i < 260; i++) {
    const fx = (i * 0.618) % 1;
    const idx = ((Math.floor(i * 37.3 + t * (6 + fx * 5)) % n) + n) % n;
    const a = P[idx], b = P[(idx + 6) % n];
    const ox = a.x - w.W / 2, oy = a.y - w.H / 2, L = Math.hypot(ox, oy) || 1;
    const off = 0.25 + fx * 1.1;
    const ax = a.x + (ox / L) * off, ay = a.y + (oy / L) * off, bx = b.x + (ox / L) * off, by = b.y + (oy / L) * off;
    if (ax < x0 - 1 || ax > x1 + 1 || ay < y0 - 1 || ay > y1 + 1) continue;
    g.strokeStyle = i % 3 ? 'rgba(220,240,226,0.22)' : 'rgba(20,50,40,0.35)';
    g.lineWidth = i % 3 ? 0.02 : 0.03;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + (bx - ax) * 0.5, ay + (by - ay) * 0.5); g.stroke();
  }
  // glitter
  for (let i = 0; i < 70; i++) {
    const life = 0.5 + (i % 4) * 0.12, cyc = Math.floor((t + i * 0.37) / life), ph = ((t + i * 0.37) % life) / life;
    const r = mulberry32(cyc * 97 + i * 13);
    const a = P[Math.floor(r() * n)], ox = a.x - w.W / 2, oy = a.y - w.H / 2, L = Math.hypot(ox, oy) || 1, off = 0.2 + r() * 1.1;
    const x = a.x + (ox / L) * off, y = a.y + (oy / L) * off;
    if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) continue;
    g.fillStyle = `rgba(240,252,244,${0.8 * Math.sin(ph * Math.PI)})`;
    g.beginPath(); g.arc(x, y, 0.018, 0, TAU); g.fill();
  }
  g.restore();
  // mud lip along the bank
  g.save();
  g.lineJoin = 'round';
  for (const [wd, col, off] of [[0.16, 'rgb(86,78,50)', 0], [0.06, 'rgb(52,62,40)', 0.05]]) { g.strokeStyle = col; g.lineWidth = wd; tracePoly(g, P, off, w); g.stroke(); }
  g.restore();
}
function drawPond(g, w, p) {
  const t = w.time;
  const R = Math.max(p.rx, p.ry);
  g.fillStyle = 'rgb(86,78,50)'; pondPath(g, p, 1.12, 0.02, p.id); g.fill();
  g.fillStyle = 'rgb(52,62,40)'; pondPath(g, p, 1.05, 0.015, p.id + 1); g.fill();
  pondPath(g, p, 1.0);
  g.save();
  g.clip();
  const grd = g.createRadialGradient(p.x - R * 0.1, p.y - R * 0.15, R * 0.05, p.x, p.y, R * 1.05);
  grd.addColorStop(0, 'rgb(28,66,54)');
  grd.addColorStop(0.55, 'rgb(36,80,64)');
  grd.addColorStop(0.85, 'rgb(58,104,78)');
  grd.addColorStop(1, 'rgb(78,124,90)');
  g.fillStyle = grd;
  g.fillRect(p.x - R * 1.5, p.y - R * 1.5, R * 3, R * 3);
  g.strokeStyle = 'rgba(20,36,24,0.4)';
  g.lineWidth = 0.18;
  g.save(); g.translate(0, 0.08); pondPath(g, p, 1.0); g.stroke(); g.restore();
  // sky glints sliding over the surface
  const rr = mulberry32(p.id * 31 + 5);
  g.strokeStyle = 'rgba(220,240,226,0.25)';
  g.lineCap = 'round';
  g.lineWidth = 0.025;
  for (let i = 0; i < 3 + Math.round(R * 2); i++) {
    const q = pondPoint(p, rr() * 6.28, 0.15 + rr() * 0.6);
    const L = (0.12 + rr() * 0.2) * (0.7 + 0.3 * Math.sin(t * 0.9 + i * 2));
    const x = q.x + Math.sin(t * 0.4 + i) * 0.05;
    g.beginPath(); g.moveTo(x - L, q.y); g.lineTo(x + L, q.y); g.stroke();
  }
  // rings where a fish broke the surface
  for (let i = 0; i < 2; i++) {
    const per = 3.2 + i * 1.3, cyc = Math.floor((t + i * 1.7 + p.id) / per), ph = ((t + i * 1.7 + p.id) % per) / per;
    const r2 = mulberry32(cyc * 31 + p.id * 101 + i);
    const q = pondPoint(p, r2() * 6.28, r2() * 0.7);
    g.strokeStyle = `rgba(226,244,230,${0.45 * (1 - ph)})`;
    g.lineWidth = 0.02;
    g.beginPath(); g.ellipse(q.x, q.y, 0.05 + ph * 0.35, 0.05 + ph * 0.35, 0, 0, TAU); g.stroke();
  }
  for (let i = 0; i < Math.round(R * 6); i++) {
    const life = 0.4 + (i % 5) * 0.08, cyc = Math.floor((t + i * 0.137) / life), ph = ((t + i * 0.137) % life) / life;
    const r3 = mulberry32(cyc * 977 + i * 131 + p.id * 7);
    const q = pondPoint(p, r3() * TAU, Math.sqrt(r3()) * 0.9);
    g.fillStyle = `rgba(240,252,244,${0.8 * Math.sin(ph * Math.PI)})`;
    g.beginPath(); g.arc(q.x, q.y, 0.02, 0, TAU); g.fill();
  }
  g.restore();
  // lily pads and lotus
  for (const pd of p.pads) {
    const bob = Math.sin(t * 1.3 + pd.ph) * 0.01;
    g.save();
    g.translate(pd.x, pd.y + bob);
    g.rotate(pd.a);
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, pd.r, 0.3, TAU - 0.05); g.closePath();
    g.fillStyle = '#4f8a3c'; g.fill();
    g.strokeStyle = 'rgba(20,40,16,0.8)'; g.lineWidth = 0.012; g.stroke();
    g.strokeStyle = 'rgba(140,200,100,0.5)'; g.lineWidth = 0.008;
    for (let k = 0; k < 5; k++) { const a = 0.6 + k * 1.1; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * pd.r * 0.85, Math.sin(a) * pd.r * 0.85); g.stroke(); }
    g.restore();
    if (pd.flower) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + pd.a;
        g.fillStyle = k % 2 ? '#f2a6c0' : '#e57fa4';
        g.beginPath(); g.ellipse(pd.x + Math.cos(a) * 0.035, pd.y + bob - 0.02 + Math.sin(a) * 0.035, 0.035, 0.018, a, 0, TAU); g.fill();
      }
      g.fillStyle = '#f6d25a';
      g.beginPath(); g.arc(pd.x, pd.y + bob - 0.02, 0.018, 0, TAU); g.fill();
    }
  }
}
function drawPuddle(g, pd) {
  const grow = Math.min(1, pd.age / 0.6), a = pd.age < 20 ? 1 : Math.max(0, 1 - (pd.age - 20) / 20);
  g.save();
  g.translate(pd.x, pd.y);
  g.rotate(pd.dir);
  g.fillStyle = `rgba(40,58,44,${0.55 * a})`;
  g.beginPath(); g.ellipse(pd.size * pd.long * 0.35 * grow, 0, pd.size * pd.long * 0.6 * grow, pd.size * 0.45 * grow, 0, 0, TAU); g.fill();
  if (pd.age < 20) { g.fillStyle = `rgba(220,240,236,${0.35 * a})`; g.beginPath(); g.ellipse(pd.size * 0.2, -pd.size * 0.1, pd.size * 0.2 * grow, pd.size * 0.05, 0, 0, TAU); g.fill(); }
  g.restore();
}

// ---------- upright things (screen space, feet at sx, sy; k = px per world unit) ----------
function drawTaro(g, t, sx, sy, k) {
  const n = 3 + Math.floor(t.v * 3);
  const f = t.flat;
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1 || 1) - 0.5) * 1.6 + (t.flip ? 0.2 : -0.2);
    const h = k * (0.13 + ((i * 37 + t.v * 50) % 10) / 100) * t.sc * (1 - f * 0.75);
    const lx = sx + Math.sin(a + t.lean * 0.8 + f * t.flatAng * 0.8) * h * (0.6 + f), ly = sy - Math.cos(a * 0.6) * h;
    g.strokeStyle = f > 0.5 ? '#557a3a' : '#7aa850';
    g.lineWidth = Math.max(0.8, k * 0.012);
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + (lx - sx) * 0.3, sy - h * 0.6, lx, ly); g.stroke();
    const L = k * 0.075 * t.sc;
    g.save();
    g.translate(lx, ly);
    g.rotate(a * 0.7 + t.lean);
    g.scale(1, 1 - f * 0.55);
    g.beginPath();
    g.moveTo(0, -L * 0.15);
    g.bezierCurveTo(-L * 0.9, -L * 0.6, -L * 0.8, L * 0.5, 0, L);
    g.bezierCurveTo(L * 0.8, L * 0.5, L * 0.9, -L * 0.6, 0, -L * 0.15);
    g.fillStyle = f > 0.5 ? '#3a6430' : i % 2 ? '#4e8a3c' : '#5a9a44';
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = Math.max(0.5, k * 0.006);
    g.stroke();
    g.strokeStyle = 'rgba(170,215,130,0.7)';
    g.beginPath(); g.moveTo(0, -L * 0.1); g.lineTo(0, L * 0.85); g.stroke();
    g.restore();
  }
}
function drawGrass(g, gr, sx, sy, k, time) {
  const cols = ['rgb(62,92,54)', 'rgb(100,128,78)', 'rgb(82,116,58)', 'rgb(120,140,80)'];
  g.lineCap = 'round';
  for (const b of gr.blades) {
    const breeze = Math.sin(time * 1.4 + b.ph) * 0.06;
    const a = b.a + gr.lean * (0.6 + Math.abs(b.a) * 0.3) + breeze;
    const L = b.l * k * (1 - Math.min(0.35, Math.abs(gr.lean) * 0.25));
    g.strokeStyle = cols[b.c];
    g.lineWidth = Math.max(0.8, k * 0.014);
    g.beginPath();
    g.moveTo(sx + b.a * k * 0.02, sy);
    g.quadraticCurveTo(sx + Math.sin(a) * L * 0.4, sy - L * 0.6, sx + Math.sin(a) * L, sy - Math.cos(a) * L);
    g.stroke();
  }
}
function drawTufts(g, w) {
  const k = cam.U;
  g.lineCap = 'round';
  const cols = ['rgba(70,100,44,0.9)', 'rgba(110,140,70,0.9)', 'rgba(150,160,90,0.85)'];
  const [, wy0] = s2w(0, -20), [, wy1] = s2w(0, cam.vh + 20);
  for (const t of w.tufts) {
    if (t.y < wy0 || t.y > wy1) continue;
    const [x, y] = w2s(t.x, t.y);
    if (x < -20 || x > cam.vw + 20) continue;
    g.strokeStyle = cols[t.c];
    g.lineWidth = Math.max(0.8, k * 0.009);
    const h = t.s * k;
    g.beginPath();
    for (let i = -1; i <= 1; i++) { g.moveTo(x + i * h * 0.15, y); g.lineTo(x + i * h * 0.5 + Math.sin(w.time + t.a) * h * 0.08, y - h * (1 - Math.abs(i) * 0.25)); }
    g.stroke();
  }
}
function drawJar(g, j, sx, sy, k) {
  const H = k * 0.24, Wd = k * 0.11;
  drawShadow(g, sx, sy, Wd * 1.3, Wd * 0.4, 0.9);
  g.save();
  g.translate(sx, sy);
  if (j.state === 'down') {
    const u = Math.min(1, j.t / 0.28);
    const side = Math.cos(j.dir) >= 0 ? 1 : -1;
    g.translate(side * Wd * 0.6 * u, 0);
    g.rotate(side * (Math.PI / 2) * u * u);
  }
  g.beginPath();
  g.moveTo(-Wd * 0.55, 0);
  g.bezierCurveTo(-Wd * 1.25, -H * 0.2, -Wd * 1.15, -H * 0.85, -Wd * 0.55, -H * 0.95);
  g.lineTo(Wd * 0.55, -H * 0.95);
  g.bezierCurveTo(Wd * 1.15, -H * 0.85, Wd * 1.25, -H * 0.2, Wd * 0.55, 0);
  g.closePath();
  const grd = g.createLinearGradient(-Wd, 0, Wd, 0);
  grd.addColorStop(0, '#4a2616');
  grd.addColorStop(0.35, '#8a4c2c');
  grd.addColorStop(1, '#3a1e10');
  g.fillStyle = grd;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = Math.max(0.8, k * 0.01);
  g.stroke();
  g.strokeStyle = 'rgba(230,190,120,0.55)';
  g.lineWidth = Math.max(0.6, k * 0.006);
  g.beginPath(); g.moveTo(-Wd * 0.9, -H * 0.55); g.quadraticCurveTo(0, -H * 0.45, Wd * 0.9, -H * 0.55); g.stroke();
  g.fillStyle = '#2e180c';
  g.beginPath(); g.ellipse(0, -H * 0.97, Wd * 0.6, Wd * 0.2, 0, 0, TAU); g.fill(); g.stroke();
  if (j.lid && j.state === 'up') { g.fillStyle = '#96703f'; g.beginPath(); g.ellipse(0, -H, Wd * 0.68, Wd * 0.22, 0, 0, TAU); g.fill(); g.stroke(); }
  g.fillStyle = 'rgba(255,240,210,0.35)';
  g.beginPath(); g.ellipse(-Wd * 0.5, -H * 0.6, Wd * 0.12, H * 0.2, 0.2, 0, TAU); g.fill();
  g.restore();
}
function drawDummy(g, d, sx, sy, k, time) {
  drawShadow(g, sx, sy, k * 0.14, k * 0.04, 0.9);
  g.save();
  g.translate(sx, sy);
  g.rotate(d.wob);
  const shake = d.hitT < 0.15 ? Math.sin(time * 90) * k * 0.01 : 0;
  g.translate(shake, 0);
  g.lineCap = 'round';
  limb(g, [[0, 0], [0, -k * 0.5]], k * 0.03, '#7a4a26', k * 0.5);
  limb(g, [[-k * 0.14, -k * 0.38], [k * 0.14, -k * 0.38]], k * 0.022, '#7a4a26', k * 0.5);
  // straw at the arm ends
  g.strokeStyle = '#d9b860';
  g.lineWidth = Math.max(0.6, k * 0.006);
  for (const sgn of [-1, 1]) for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(sgn * k * 0.14, -k * 0.38); g.lineTo(sgn * k * (0.17 + i * 0.006), -k * (0.4 - i * 0.012)); g.stroke(); }
  g.beginPath();
  g.ellipse(0, -k * 0.3, k * 0.085, k * 0.13, 0, 0, TAU);
  g.fillStyle = '#d4b25a';
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = Math.max(0.8, k * 0.01);
  g.stroke();
  g.save(); g.clip();
  g.strokeStyle = 'rgba(150,110,40,0.7)';
  g.lineWidth = Math.max(0.5, k * 0.005);
  for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(i * k * 0.014, -k * 0.44); g.lineTo(i * k * 0.016, -k * 0.16); g.stroke(); }
  g.restore();
  g.fillStyle = '#7a4a26';
  for (const y of [-0.38, -0.22]) g.fillRect(-k * 0.085, -k * (-y) - k * 0.008, k * 0.17, k * 0.016);
  // red cloth target
  g.fillStyle = '#b8342a';
  g.beginPath(); g.arc(0, -k * 0.3, k * 0.035, 0, TAU); g.fill();
  g.strokeStyle = '#f4e6c0'; g.lineWidth = Math.max(0.6, k * 0.006);
  g.beginPath(); g.arc(0, -k * 0.3, k * 0.02, 0, TAU); g.stroke();
  g.beginPath(); g.arc(0, -k * 0.5, k * 0.06, 0, TAU);
  g.fillStyle = '#d9b860'; g.fill(); g.strokeStyle = INK; g.lineWidth = Math.max(0.8, k * 0.01); g.stroke();
  g.fillStyle = '#b8342a'; g.fillRect(-k * 0.06, -k * 0.53, k * 0.12, k * 0.02);
  g.restore();
  if (d.hitT < 0.12) { g.save(); g.globalAlpha = 0.5 * (1 - d.hitT / 0.12); g.drawImage(auraSprite(), sx - k * 0.25, sy - k * 0.55, k * 0.5, k * 0.5); g.restore(); }
}

// the minimap's still picture
function buildMinimap(w, cw, ch) {
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  const sx = cw / w.W, sy = ch / w.H;
  g.fillStyle = '#5e7e34';
  g.fillRect(0, 0, cw, ch);
  if (featCache) g.drawImage(featCache, 0, 0, cw, ch);
  g.scale(sx, sy);
  g.fillStyle = '#2f6050';
  g.beginPath(); g.rect(-1, -1, w.W + 2, w.H + 2); tracePoly(g, landPoly(w), 0, w, false); g.fill('evenodd');
  for (const p of w.ponds) { g.fillStyle = '#356a56'; pondPath(g, p, 1); g.fill(); }
  g.fillStyle = '#2c5a24';
  for (const m of w.mangoes) { g.beginPath(); g.arc(m.x, m.y - 0.6, 0.9 * m.sc, 0, TAU); g.fill(); }
  g.fillStyle = '#4a7a30';
  for (const b of w.bananas) { g.beginPath(); g.arc(b.x, b.y, 0.18, 0, TAU); g.fill(); }
  for (const c2 of w.palms) { g.fillStyle = '#3e6a2a'; g.beginPath(); g.arc(c2.x + c2.lean, c2.y - 0.4, 0.4, 0, TAU); g.fill(); }
  g.fillStyle = '#b08a52';
  for (const h of w.huts) if (!h.collapsed) g.fillRect(h.x - 0.75, h.y - 0.6, 1.5, 0.6);
  g.strokeStyle = '#d8b48a'; g.lineWidth = 0.45; g.lineCap = 'round';
  for (const wl of w.walls || []) { g.beginPath(); g.moveTo(wl.ax, wl.ay); g.lineTo(wl.bx, wl.by); g.stroke(); }
  for (const t of w.towers || []) { if (t.dead) continue; g.fillStyle = '#1a1208'; g.fillRect(t.x - 0.75, t.y - 0.75, 1.5, 1.5); g.fillStyle = t.team === 'red' ? '#e05a46' : '#5a92ee'; g.fillRect(t.x - 0.55, t.y - 0.55, 1.1, 1.1); }
  return c;
}

'use strict';
// ===== the shallow river across the middle, and the old temple walls of the jungle =====

// ---------------- the shallow river ----------------
// Like a MOBA's: from the top-left corner, through the middle of the map, to the bottom-right corner,
// joining the big river round the edge at both ends. Ankle-deep: everyone wades through it (a little slower).
function makeRiver(w, R) {
  const S = w.W;
  const cx = w.W / 2, H = w.H;
  // (the one-lane strip: the stream runs top to bottom across the middle of the lane)
  const way = w.kind === 'lane' ? [[cx + 2.6, 0.4], [cx + 1.9, H * 0.2], [cx + 0.7, H * 0.38], [cx, H * 0.5], [cx - 0.7, H * 0.62], [cx - 1.9, H * 0.8], [cx - 2.6, H - 0.4]]
    : [[0.4, 0.4], [3.2, 3.6], [7.4, 8.2], [12.6, 12.0], [18, 18], [23.4, 24.0], [28.6, 27.8], [32.8, 32.4], [S - 0.4, S - 0.4]];
  const pts = [];
  for (let i = 0; i < way.length - 1; i++) {
    const A = way[i], B = way[i + 1], n = Math.max(1, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / 0.4));
    for (let k = 0; k < n; k++) { const u = k / n; pts.push({ x: lerp(A[0], B[0], u), y: lerp(A[1], B[1], u) }); }
  }
  pts.push({ x: way[way.length - 1][0], y: way[way.length - 1][1] });
  for (let pass = 0; pass < 4; pass++) for (let i = 1; i < pts.length - 1; i++) { pts[i].x = (pts[i - 1].x + pts[i].x * 2 + pts[i + 1].x) / 4; pts[i].y = (pts[i - 1].y + pts[i].y * 2 + pts[i + 1].y) / 4; }
  // its width wanders: wider in the middle of the map, narrower at the lane crossings
  for (let i = 0; i < pts.length; i++) {
    const t = i / (pts.length - 1);
    pts[i].hw = 0.95 + 0.35 * Math.sin(t * Math.PI) + 0.12 * Math.sin(t * 17 + R() * 0.3);
  }
  // the two banks
  const L = [], Rr = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
    pts[i].nx = nx; pts[i].ny = ny; pts[i].tx = dx / d; pts[i].ty = dy / d;
    L.push({ x: pts[i].x + nx * pts[i].hw, y: pts[i].y + ny * pts[i].hw });
    Rr.push({ x: pts[i].x - nx * pts[i].hw, y: pts[i].y - ny * pts[i].hw });
  }
  w.river = { pts, L, R: Rr, poly: L.concat(Rr.slice().reverse()) };
}
// how far inside the river (x, y) is: > 0 in the water
function riverDepth(w, x, y) {
  const P = w.river && w.river.pts;
  if (!P) return -9;
  let best = -9;
  for (let i = 1; i < P.length; i++) {
    const A = P[i - 1], B = P[i];
    if (Math.abs(x - A.x) > 3 || Math.abs(y - A.y) > 3) continue;
    const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy || 1, t = clamp(((x - A.x) * dx + (y - A.y) * dy) / L2, 0, 1);
    const d = Math.hypot(A.x + dx * t - x, A.y + dy * t - y), hw = lerp(A.hw, B.hw, t);
    best = Math.max(best, hw - d);
  }
  return best;
}
const riverAt = (w, x, y, m = 0) => riverDepth(w, x, y) > -m;
function riverPath(g, w) { const P = w.river.poly; g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); }
// the bed and the banks, drawn once into the ground picture
function drawRiverBed(t, w, R) {
  if (!w.river) return;
  t.save();
  t.lineJoin = 'round';
  // wet earth and sand along the banks
  for (const [wd, col] of [[0.9, 'rgba(70,64,36,0.18)'], [0.55, 'rgba(150,130,84,0.4)'], [0.32, 'rgba(186,166,116,0.55)']]) {
    t.strokeStyle = col; t.lineWidth = wd;
    for (const side of [w.river.L, w.river.R]) { t.beginPath(); side.forEach((p, i) => (i ? t.lineTo(p.x, p.y) : t.moveTo(p.x, p.y))); t.stroke(); }
  }
  riverPath(t, w);
  t.fillStyle = '#9a8c5e'; t.fill();
  t.save(); t.clip();
  // the sandy bed, darker in the middle of the stream, pebbles and weed
  const P = w.river.pts;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    t.fillStyle = 'rgba(60,72,46,0.22)'; t.beginPath(); t.arc(p.x, p.y, p.hw * 0.75, 0, TAU); t.fill();
  }
  for (let i = 0; i < 700; i++) {
    const p = P[Math.floor(R() * P.length)], o = (R() * 2 - 1) * p.hw, x = p.x + p.nx * o + (R() - 0.5) * 0.3, y = p.y + p.ny * o + (R() - 0.5) * 0.3;
    t.fillStyle = R() < 0.5 ? 'rgba(200,190,150,0.6)' : 'rgba(90,86,64,0.5)';
    t.beginPath(); t.ellipse(x, y, 0.02 + R() * 0.035, 0.015 + R() * 0.025, R() * 3, 0, TAU); t.fill();
  }
  for (let i = 0; i < 120; i++) {
    const p = P[Math.floor(R() * P.length)], o = (R() * 2 - 1) * p.hw * 0.9, x = p.x + p.nx * o, y = p.y + p.ny * o;
    t.strokeStyle = 'rgba(60,96,44,0.55)'; t.lineWidth = 0.02;
    for (let k = 0; k < 3; k++) { t.beginPath(); t.moveTo(x, y); t.quadraticCurveTo(x + p.tx * 0.08 + (R() - 0.5) * 0.06, y + p.ty * 0.08, x + p.tx * 0.18 + (R() - 0.5) * 0.08, y + p.ty * 0.18 + (R() - 0.5) * 0.05); t.stroke(); }
  }
  t.restore();
  // the water over it: clear, a little green
  riverPath(t, w); t.fillStyle = 'rgba(64,132,138,0.5)'; t.fill();
  t.restore();
}
// the water itself, every frame: a clear tint over the bed (the reflections go in next), then the moving surface
function drawRiverWater(g, w) {
  if (!w.river) return;
  void g; // (the clear water tint is part of the ground picture now)
}
function drawRiverSurface(g, w, x0, y0, x1, y1) {
  if (!w.river) return;
  const t = w.time, P = w.river.pts;
  g.save();
  riverPath(g, w); g.clip();
  g.lineCap = 'round';
  // the current: streaks drifting downstream, and slow light bands rippling across
  for (let i = 0; i < 160; i++) {
    const fx = (i * 0.618) % 1;
    const s = ((i * 7.31 + t * (1.6 + fx * 1.4)) % P.length + P.length) % P.length;
    const k = Math.floor(s), p = P[k];
    const o = ((i * 0.377) % 1) * 2 - 1, x = p.x + p.nx * o * p.hw * 0.9, y = p.y + p.ny * o * p.hw * 0.9;
    if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) continue;
    const L = 0.18 + fx * 0.3, wob = Math.sin(t * 3 + i) * 0.03;
    g.strokeStyle = i % 4 ? 'rgba(230,250,246,0.3)' : 'rgba(30,70,70,0.3)'; g.lineWidth = i % 4 ? 0.016 : 0.024;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + p.tx * L * 0.5 + p.nx * wob, y + p.ty * L * 0.5 + p.ny * wob, x + p.tx * L, y + p.ty * L); g.stroke();
  }
  for (let i = 0; i < P.length; i += 2) {
    const p = P[i];
    if (p.x < x0 - 2 || p.x > x1 + 2 || p.y < y0 - 2 || p.y > y1 + 2) continue;
    const ph = t * 1.4 - i * 0.35, a = 0.06 + 0.06 * Math.sin(ph);
    g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 0.05;
    const bow = Math.sin(ph * 0.7) * 0.12;
    g.beginPath(); g.moveTo(p.x + p.nx * p.hw, p.y + p.ny * p.hw); g.quadraticCurveTo(p.x + p.tx * bow, p.y + p.ty * bow, p.x - p.nx * p.hw, p.y - p.ny * p.hw); g.stroke();
  }
  // glints
  for (let i = 0; i < 60; i++) {
    const life = 0.6 + (i % 4) * 0.15, cyc = Math.floor((t + i * 0.41) / life), ph = ((t + i * 0.41) % life) / life;
    const r = mulberry32(cyc * 131 + i * 7);
    const p = P[Math.floor(r() * P.length)], o = (r() * 2 - 1) * p.hw, x = p.x + p.nx * o, y = p.y + p.ny * o;
    if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) continue;
    g.fillStyle = `rgba(250,255,250,${0.85 * Math.sin(ph * Math.PI)})`;
    g.beginPath(); g.ellipse(x, y, 0.03, 0.012, Math.atan2(p.ty, p.tx), 0, TAU); g.fill();
  }
  g.restore();
  // foam lapping at both banks
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [side, sg] of [[w.river.L, 1], [w.river.R, -1]]) {
    g.strokeStyle = 'rgba(236,246,238,0.5)'; g.lineWidth = 0.035;
    g.beginPath();
    side.forEach((q, i) => { const p = P[i], o = (0.04 + 0.03 * Math.sin(t * 2.2 + i * 0.9)) * sg; const x = q.x - p.nx * o, y = q.y - p.ny * o; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
  }
  g.restore();
}
// reflections: whoever stands in or beside the water, upside down under the surface, wavering
function drawRiverReflections(g, w, k, vis) {
  if (!w.river) return;
  const near = (x, y, m) => riverDepth(w, x, y) > -m;
  g.save();
  // clip to the river on screen
  g.beginPath();
  w.river.poly.forEach((p, i) => { const s = w2s(p.x, p.y); i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); });
  g.closePath(); g.clip();
  const t = w.time;
  const flip = (sx, sy, a, draw) => {
    g.save();
    g.globalAlpha = a;
    g.translate(sx, sy);
    g.transform(1, 0, Math.sin(t * 2.3 + sx * 0.05) * 0.06, 1, 0, 0);
    g.scale(1, -0.82);
    draw();
    g.restore();
  };
  for (const c of w.palms) {
    if (!near(c.x, c.y, 2.4)) continue;
    const s = vis(c.x, c.y, 4, 3); if (!s) continue;
    flip(s[0], s[1], 0.32, () => drawPalm(g, c, 0, 0, k, 1, t));
  }
  for (const tw of w.towers || []) {
    if (tw.dead || !near(tw.x, tw.y, 2.6)) continue;
    const s = vis(tw.x, tw.y, 4, 3); if (!s) continue;
    const S = towerSprite(tw.team, Math.round(k * DPR));
    flip(s[0], s[1], 0.3, () => { g.drawImage(S.lower, -S.ox * k, -S.oy * k, S.W * k, S.H * k); g.drawImage(S.upper, -S.ox * k, -S.oy * k, S.W * k, S.H * k); });
  }
  for (const a of w.actors || []) {
    if (a.dead || !near(a.x, a.y, 0.9)) continue;
    const s = vis(a.x, a.y, 2, 1.5); if (!s) continue;
    const P = poseOf(a);
    flip(s[0], s[1] + (a.air ? 0 : 0), 0.34, () => drawFigure(g, a, 0, 0, k * a.hero.size, P));
  }
  g.restore();
}

// ---------------- old temple walls (Ayutthaya) ----------------
// Red brick gone soft with age, patches of the old whitewash still clinging, moss at the foot, a row of
// pointed bai-sema merlons along the top with a few broken off. They hem the jungle in along the lanes, as
// a MOBA's jungle walls do, with gaps to slip through.
const WALL_T = 0.26;
function makeWalls(w, R, ok) {
  w.walls = [];
  const add = (ax, ay, bx, by) => {
    const L = Math.hypot(bx - ax, by - ay);
    if (L < 1) return;
    // every point along it must be clear
    for (let i = 0; i <= Math.ceil(L / 0.25); i++) { const u = i / Math.ceil(L / 0.25); if (!ok(lerp(ax, bx, u), lerp(ay, by, u))) return; }
    if (w.walls.some((o) => segSegDist(ax, ay, bx, by, o.ax, o.ay, o.bx, o.by) < 1.0)) return;
    w.walls.push({ ax, ay, bx, by, L, h: 0.62 + R() * 0.16, seed: Math.floor(R() * 1e6), ruin: R() < 0.35 ? { at: 0.2 + R() * 0.6, wd: 0.12 + R() * 0.15 } : null });
  };
  // along each lane, on the jungle side, in lengths with gaps between
  for (const lane of w.lanes) {
    let L = 0; const seg = [0];
    for (let i = 1; i < lane.length; i++) { L += Math.hypot(lane[i].x - lane[i - 1].x, lane[i].y - lane[i - 1].y); seg.push(L); }
    for (const side of [-1, 1]) {
      let s = 2 + R() * 1.2;
      while (s < L - 3) {
        const len = 2.6 + R() * 1.4;
        const a = lanePointAt(lane, s / L), b = lanePointAt(lane, Math.min(1, (s + len) / L));
        const off = 1.75 + R() * 0.35;
        const na = [-a.dy * side, a.dx * side], nb = [-b.dy * side, b.dx * side];
        add(a.x + na[0] * off, a.y + na[1] * off, b.x + nb[0] * off, b.y + nb[1] * off);
        s += len + 1.6 + R() * 1.2;
      }
    }
  }
  // and a few short ones out in the jungle, around which the paths go
  for (let i = 0, t = 0; i < 8 && t < 300; t++) {
    const x = 6 + R() * (w.W - 12), y = 6 + R() * (w.H - 12), a = R() < 0.5 ? 0 : Math.PI / 4 * (R() < 0.5 ? 1 : -1), len = 1.6 + R() * 1.4;
    const n0 = w.walls.length;
    add(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
    if (w.walls.length > n0) i++;
  }
}
function segSegDist(ax, ay, bx, by, cx, cy, dx, dy) {
  const pd = (px, py, x0, y0, x1, y1) => { const vx = x1 - x0, vy = y1 - y0, L2 = vx * vx + vy * vy || 1, t = clamp(((px - x0) * vx + (py - y0) * vy) / L2, 0, 1); return Math.hypot(x0 + vx * t - px, y0 + vy * t - py); };
  return Math.min(pd(ax, ay, cx, cy, dx, dy), pd(bx, by, cx, cy, dx, dy), pd(cx, cy, ax, ay, bx, by), pd(dx, dy, ax, ay, bx, by));
}
function wallDist(wl, x, y) {
  const vx = wl.bx - wl.ax, vy = wl.by - wl.ay, L2 = vx * vx + vy * vy || 1, t = clamp(((x - wl.ax) * vx + (y - wl.ay) * vy) / L2, 0, 1);
  return { d: Math.hypot(wl.ax + vx * t - x, wl.ay + vy * t - y), t, px: wl.ax + vx * t, py: wl.ay + vy * t };
}
function wallAt(w, x, y, pad = 0) {
  for (const wl of w.walls || []) {
    if (x < Math.min(wl.ax, wl.bx) - 1 || x > Math.max(wl.ax, wl.bx) + 1 || y < Math.min(wl.ay, wl.by) - 1 || y > Math.max(wl.ay, wl.by) + 1) continue;
    const q = wallDist(wl, x, y);
    if (q.d < WALL_T / 2 + pad && !(wl.ruin && Math.abs(q.t - wl.ruin.at) < wl.ruin.wd * 0.3 && false)) return wl;
  }
  return null;
}
// push a body out of any wall
function wallResolve(w, o, r) {
  for (const wl of w.walls || []) {
    if (o.x < Math.min(wl.ax, wl.bx) - 1 || o.x > Math.max(wl.ax, wl.bx) + 1 || o.y < Math.min(wl.ay, wl.by) - 1 || o.y > Math.max(wl.ay, wl.by) + 1) continue;
    const q = wallDist(wl, o.x, o.y), m = WALL_T / 2 + r;
    if (q.d < m) {
      let nx = o.x - q.px, ny = o.y - q.py, d = Math.hypot(nx, ny);
      if (d < 1e-4) { nx = -(wl.by - wl.ay); ny = wl.bx - wl.ax; d = Math.hypot(nx, ny); }
      o.x = q.px + (nx / d) * m; o.y = q.py + (ny / d) * m;
    }
  }
}

// the wall's picture, drawn once at the current zoom; local origin at its first end, on the ground
function buildWallSprite(wl, res) {
  const R = mulberry32(wl.seed);
  const dx = wl.bx - wl.ax, dy = wl.by - wl.ay, L = wl.L;
  let nx = -dy / L, ny = dx / L;
  if (ny < 0) { nx = -nx; ny = -ny; }   // the face toward the viewer
  const T = WALL_T, H = wl.h, MH = 0.2;
  const S = (x, y, z) => [x - wl.ax, (y - wl.ay) * TILT - z];
  const pts = [];
  for (const [x, y] of [[wl.ax, wl.ay], [wl.bx, wl.by]]) for (const o of [-T / 2, T / 2]) for (const z of [0, H + MH + 0.06]) pts.push(S(x + nx * o, y + ny * o, z));
  const x0 = Math.min(...pts.map((p) => p[0])) - 0.15, x1 = Math.max(...pts.map((p) => p[0])) + 0.15, y0 = Math.min(...pts.map((p) => p[1])) - 0.08, y1 = Math.max(...pts.map((p) => p[1])) + 0.06;
  const c = spriteCanvas(x1 - x0, y1 - y0, res), g = c.getContext('2d');
  g.scale(res, res); g.translate(-x0, -y0);
  g.lineJoin = 'round'; g.lineCap = 'round';
  // the height along the wall: lower where it has crumbled
  const hAt = (u) => (wl.ruin && Math.abs(u - wl.ruin.at) < wl.ruin.wd ? H * (0.45 + 0.55 * Math.pow(Math.abs(u - wl.ruin.at) / wl.ruin.wd, 1.5)) : H);
  const N = Math.max(8, Math.ceil(L / 0.08));
  const Af = [wl.ax + (nx * T) / 2, wl.ay + (ny * T) / 2], Ab = [wl.ax - (nx * T) / 2, wl.ay - (ny * T) / 2];
  const along = (base, u, z) => S(base[0] + dx * u, base[1] + dy * u, z);
  // the top: old plaster and moss
  g.beginPath();
  for (let i = 0; i <= N; i++) { const u = i / N, p = along(Af, u, hAt(u)); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
  for (let i = N; i >= 0; i--) { const u = i / N, p = along(Ab, u, hAt(u)); g.lineTo(p[0], p[1]); }
  g.closePath(); g.fillStyle = '#c49a7a'; g.fill(); g.strokeStyle = '#3a2418'; g.lineWidth = 0.014; g.stroke();
  // the end caps facing us
  for (const [base, out] of [[0, -1], [1, 1]]) {
    if (dy * out * TILT + 0 <= -1e-3 && Math.abs(dx) > Math.abs(dy) * 0.2) continue;
    const pA = along(Af, base, 0), pB = along(Ab, base, 0), hh = hAt(base);
    g.beginPath(); g.moveTo(pA[0], pA[1]); g.lineTo(pB[0], pB[1]); g.lineTo(pB[0], pB[1] - hh); g.lineTo(pA[0], pA[1] - hh); g.closePath();
    g.fillStyle = '#8e4630'; g.fill(); g.strokeStyle = '#3a2418'; g.lineWidth = 0.014; g.stroke();
  }
  // the brick face toward us (when the wall runs across the view)
  const sx = dx, sy = dy * TILT;
  if (Math.abs(sx) > 0.05) {
    g.save();
    const o = along(Af, 0, 0);
    g.transform(sx / L, sy / L, 0, -1, o[0], o[1]);   // face coords: u along the wall (0..L), v up
    g.beginPath(); g.moveTo(0, 0);
    for (let i = 0; i <= N; i++) { const u = i / N; g.lineTo(u * L, hAt(u)); }
    g.lineTo(L, 0); g.closePath();
    g.fillStyle = '#a5523a'; g.fill();
    g.save(); g.clip();
    // brick courses
    const bh = 0.055, bw = 0.13;
    for (let v = 0, row = 0; v < H; v += bh, row++) {
      for (let u = (row % 2) * bw * 0.5 - bw; u < L; u += bw) {
        const sh = R();
        g.fillStyle = sh < 0.25 ? '#b8603f' : sh < 0.5 ? '#9a4a32' : sh < 0.7 ? '#ad5a3c' : '#8c4430';
        g.fillRect(u + 0.004, v + 0.004, bw - 0.008, bh - 0.008);
        if (R() < 0.04) { g.fillStyle = '#4a2418'; g.fillRect(u + 0.01, v + 0.008, bw - 0.02, bh - 0.016); } // a brick gone
      }
    }
    // the old whitewash, peeling in patches
    for (let i = 0; i < Math.ceil(L * 3.2); i++) {
      const cu = R() * L, cv = H * (0.2 + R() * 0.75), rw = 0.05 + R() * 0.14, rh = 0.04 + R() * 0.1;
      g.fillStyle = `rgba(226,216,192,${0.45 + R() * 0.35})`;
      g.beginPath();
      for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU, rr = 0.7 + R() * 0.45; const x = cu + Math.cos(a) * rw * rr, y = cv + Math.sin(a) * rh * rr; k ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(120,100,80,0.5)'; g.lineWidth = 0.006;
      g.beginPath(); g.moveTo(cu - rw * 0.4, cv + rh * 0.2); g.lineTo(cu, cv - rh * 0.1); g.lineTo(cu + rw * 0.3, cv + rh * 0.3); g.stroke();
    }
    // the plinth, damp stains running down, moss at the foot
    g.fillStyle = 'rgba(60,30,20,0.35)'; g.fillRect(0, 0, L, 0.07);
    g.fillStyle = '#8a4430'; g.fillRect(0, 0.07, L, 0.025);
    for (let i = 0; i < Math.ceil(L * 3); i++) { const u = R() * L; g.fillStyle = 'rgba(40,30,20,0.18)'; g.fillRect(u, H * (0.3 + R() * 0.4), 0.02 + R() * 0.04, H); }
    for (let i = 0; i < Math.ceil(L * 10); i++) { const u = R() * L, r = 0.02 + R() * 0.05; g.fillStyle = R() < 0.5 ? 'rgba(76,110,46,0.75)' : 'rgba(104,136,60,0.6)'; g.beginPath(); g.ellipse(u, r * 0.6, r * 1.6, r, 0, 0, TAU); g.fill(); }
    // the coping band along the top
    g.restore();
    g.beginPath(); for (let i = 0; i <= N; i++) { const u = i / N; i ? g.lineTo(u * L, hAt(u)) : g.moveTo(0, hAt(0)); } g.strokeStyle = '#d8ccb4'; g.lineWidth = 0.035; g.stroke();
    g.beginPath(); g.moveTo(0, 0); for (let i = 0; i <= N; i++) { const u = i / N; g.lineTo(u * L, hAt(u)); } g.lineTo(L, 0); g.closePath(); g.strokeStyle = '#3a2418'; g.lineWidth = 0.016; g.stroke();
    g.restore();
  }
  // the bai-sema merlons along the top: pointed like lotus buds, facing us; a few broken off or crumbled
  const step = 0.3, nM = Math.max(1, Math.floor(L / step));
  for (let i = 0; i < nM; i++) {
    const u = (i + 0.5) / nM;
    const h0 = hAt(u);
    if (h0 < H * 0.95) continue;
    const r = R();
    if (r < 0.12) continue;
    const broken = r < 0.24;
    const c0 = S(wl.ax + dx * u, wl.ay + dy * u, h0);
    const mw = 0.075, mh = broken ? MH * 0.45 : MH;
    g.save(); g.translate(c0[0], c0[1]);
    g.beginPath();
    g.moveTo(-mw, 0); g.lineTo(-mw, -mh * 0.45);
    if (broken) { g.lineTo(-mw * 0.3, -mh * 0.8); g.lineTo(mw * 0.2, -mh * 0.55); g.lineTo(mw, -mh * 0.75); }
    else { g.quadraticCurveTo(-mw, -mh * 0.85, 0, -mh); g.quadraticCurveTo(mw, -mh * 0.85, mw, -mh * 0.45); }
    g.lineTo(mw, 0); g.closePath();
    g.fillStyle = R() < 0.55 ? '#d9cfb8' : '#a5523a'; g.fill();
    g.strokeStyle = '#3a2418'; g.lineWidth = 0.014; g.stroke();
    // the brick showing through where the plaster has gone
    g.fillStyle = 'rgba(160,76,52,0.7)'; g.beginPath(); g.ellipse((R() - 0.5) * mw, -mh * (0.25 + R() * 0.3), mw * 0.4, mh * 0.15, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(76,110,46,0.5)'; g.fillRect(-mw, -0.012, mw * 2, 0.012);
    g.restore();
  }
  return { c, x0, y0, w: x1 - x0, h: y1 - y0, nx, ny };
}
let wallSprites = { res: 0, list: [] };
function wallSprite(w, wl, res) {
  if (wallSprites.res !== res) wallSprites = { res, list: new Map() };
  let s = wallSprites.list.get(wl);
  if (!s) { s = buildWallSprite(wl, res); wallSprites.list.set(wl, s); }
  return s;
}
// for the depth order, a wall is cut into short lengths, each drawn with the people near it
function wallPieces(wl) {
  if (wl.pieces) return wl.pieces;
  const n = Math.max(1, Math.ceil(wl.L / 0.45));
  wl.pieces = [];
  for (let i = 0; i < n; i++) wl.pieces.push({ t0: i / n, t1: (i + 1) / n, y: lerp(wl.ay, wl.by, (i + 0.5) / n), x: lerp(wl.ax, wl.bx, (i + 0.5) / n) });
  return wl.pieces;
}
function drawWallPiece(g, w, wl, pc, k, alpha) {
  const res = Math.round(k * DPR);
  const S = wallSprite(w, wl, res);
  const [ox, oy] = w2s(wl.ax, wl.ay);
  const dx = wl.bx - wl.ax, dy = wl.by - wl.ay;
  // the slice of the picture between two upright cuts across the wall
  const cut = (t) => { const x = wl.ax + dx * t, y = wl.ay + dy * t; return [[x + S.nx * 0.7, y + S.ny * 0.7], [x - S.nx * 0.7, y - S.ny * 0.7]]; };
  const [a0, a1] = cut(pc.t0), [b0, b1] = cut(pc.t1);
  const P = [a0, a1, b1, b0];
  const top = (wl.h + 0.4) * k;
  const scr = (p, z) => [ox + (p[0] - wl.ax) * k, oy + (p[1] - wl.ay) * TILT * k - z];
  const hull = [];
  for (const p of P) { hull.push(scr(p, 0)); hull.push(scr(p, top)); }
  // convex hull of the eight corners
  hull.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of hull) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = hull.length - 1; i >= 0; i--) { const p = hull[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  const H = lo.slice(0, -1).concat(hi.slice(0, -1));
  g.save();
  g.globalAlpha *= alpha;
  g.beginPath(); H.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.clip();
  g.drawImage(S.c, ox + S.x0 * k, oy + S.y0 * k, S.w * k, S.h * k);
  g.restore();
}

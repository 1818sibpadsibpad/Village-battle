'use strict';
// ===== watchtowers (หอรบ) on the lanes, MOBA-style =====
// A hardwood tower on four legs with X-braces, a ladder, a plank deck with a railing, a flag and a banner in
// the team's colour, rattan baskets of arrows round its foot. Three archers on the deck shoot down, fast,
// at any enemy inside its ring (4 m). 1000 HP; when it goes it topples over and lies as a heap of timber.
// The picture is drawn from the same 3D sketch as the original design (tower.py), in two layers: the lower
// one under the archers, the front railing, banner and torch over them.

const TOWER_HP = 2000;
const TOWER_R = 4.0;          // its ring: 10 m
const TOWER_SOLID = 0.42;
const TOWER_DMG = 9;
const TOWER_RATE = 0.75;      // each archer, seconds between arrows
const TW = { TH: (14 * Math.PI) / 180, SC: 1.5, U: 165 }; // design px per world unit: a tower about four men tall
const TW_DY = 172;            // deck height (design units)
function TP(x, y, z) {
  const c = Math.cos(TW.TH), s = Math.sin(TW.TH);
  const xr = x * c - z * s, zr = x * s + z * c;
  return [(xr * TW.SC) / TW.U, ((zr * 0.72 - y * 0.7) * TW.SC) / TW.U];
}
const tDepth = (x, y, z) => x * Math.sin(TW.TH) + z * Math.cos(TW.TH);
const TWW = (w) => (w * TW.SC) / TW.U;
const TW_DECK = TP(0, TW_DY, 0)[1];  // the deck's height on screen (world units, negative = up)

const TCOL = {
  INK: '#342416', LOG: [112, 82, 54], LOG_D: [78, 54, 34], LOG_L: [140, 108, 74], PLANK: [160, 122, 76], PLANK_D: [120, 88, 52], PLANK_L: [186, 150, 100],
  RAIL: [134, 98, 60], RAIL_D: [96, 66, 40], GOLD: '#d6aa46', ROPE: '#b09660', RAT: [146, 112, 62], RAT_D: [100, 74, 40], RAT_L: [172, 140, 86],
};
const rgb = (c, f = 1) => `rgb(${Math.round(c[0] * f)},${Math.round(c[1] * f)},${Math.round(c[2] * f)})`;

// the tower's picture: returns {lower, upper} canvases, origin at the foot of the tower
function buildTowerSprite(team, res, seed) {
  const R = mulberry32(seed);
  const TRIM = team === 'red' ? [178, 44, 36] : [40, 84, 170];
  const items = [];
  const shadeBack = (col, d) => (d < -4 && (col === TCOL.LOG || col === TCOL.RAIL || col === TCOL.RAIL_D || col === TCOL.PLANK_D) ? col.map((v) => v * (d < -14 ? 0.72 : 0.84)) : col);
  const line3 = (a, b, col, w, layer, dz = 0, out = true) => {
    const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const cc = shadeBack(col, tDepth(...c));
    items.push({ d: tDepth(...c) + dz, layer, f: (g) => {
      const A = TP(...a), B = TP(...b);
      g.lineCap = 'round';
      if (out) { g.strokeStyle = TCOL.INK; g.lineWidth = TWW(w + 2.4); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); }
      g.strokeStyle = rgb(cc); g.lineWidth = TWW(w); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
    } });
  };
  const poly = (pts, col, layer, dz = 0, out = true, w = 2.2) => {
    const c = [0, 1, 2].map((i) => pts.reduce((s, p) => s + p[i], 0) / pts.length);
    items.push({ d: tDepth(...c) + dz, layer, f: (g) => {
      g.beginPath(); pts.forEach((p, i) => { const q = TP(...p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath();
      g.fillStyle = typeof col === 'string' ? col : rgb(col); g.fill();
      if (out) { g.strokeStyle = TCOL.INK; g.lineWidth = TWW(w); g.lineJoin = 'round'; g.stroke(); }
    } });
  };
  const add = (d, layer, f) => items.push({ d, layer, f });
  const lash = (x, y, z, w, layer, dz) => add(tDepth(x, 0, z) + dz + 0.02, layer, (g) => {
    const c = TP(x, y, z), r = TWW(w) * 0.75;
    g.strokeStyle = TCOL.ROPE; g.lineWidth = TWW(1.3);
    for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(c[0] - r, c[1] + k * TWW(1.6)); g.lineTo(c[0] + r, c[1] + k * TWW(1.6)); g.stroke(); }
  });
  const logPost = (x, z, y0, y1, w, layer, dz) => {
    line3([x, y0, z], [x, y1, z], TCOL.LOG, w, layer, dz);
    add(tDepth(x, 0, z) + dz + 0.01, layer, (g) => {
      let A = TP(x + w * 0.22, y0, z), B = TP(x + w * 0.22, y1, z);
      g.strokeStyle = rgb(TCOL.LOG_D); g.lineWidth = TWW(w * 0.38); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
      A = TP(x - w * 0.3, y0 + 2, z); B = TP(x - w * 0.3, y1 - 2, z);
      g.strokeStyle = rgb(TCOL.LOG_L); g.lineWidth = TWW(w * 0.18); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
    });
  };
  const isFront = (x, z) => tDepth(x, 0, z) > 0;
  const H = 170, LB = 30, LT = 21;
  const legXY = (sx, sz, y) => { const s = LB + (LT - LB) * (y / H); return [sx * s, sz * s]; };
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  // legs
  for (const [sx, sz] of corners) {
    const [x0, z0] = legXY(sx, sz, 0), [x1, z1] = legXY(sx, sz, H + 2);
    line3([x0, 0, z0], [x1, H + 2, z1], TCOL.LOG, 6, 0);
    add(tDepth(x0, 0, z0) + 0.01, 0, (g) => {
      let A = TP(x0 + 1.6, 0, z0), B = TP(x1 + 1.3, H + 2, z1);
      g.strokeStyle = rgb(TCOL.LOG_D); g.lineWidth = TWW(2.6); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
      A = TP(x0 - 2.2, 3, z0); B = TP(x1 - 1.8, H - 2, z1);
      g.strokeStyle = rgb(TCOL.LOG_L); g.lineWidth = TWW(1.3); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
    });
  }
  // beams and X-braces on the four faces, three tiers
  const faces = [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]];
  for (const [a, b] of faces) {
    for (const [ya, yb] of [[14, 66], [66, 118], [118, 160]]) {
      const [ax, az] = legXY(...a, ya), [bx, bz] = legXY(...b, ya), [ax2, az2] = legXY(...a, yb), [bx2, bz2] = legXY(...b, yb);
      const dz = isFront((ax + bx) / 2, (az + bz) / 2) ? 3 : -3;
      line3([ax, ya, az], [bx, ya, bz], TCOL.LOG, 4.6, 0, dz);
      line3([ax, ya, az], [bx2, yb, bz2], TCOL.LOG, 3.8, 0, dz + 0.2);
      line3([bx, ya, bz], [ax2, yb, az2], TCOL.LOG, 3.8, 0, dz + 0.3);
      lash(ax, ya, az, 4.6, 0, dz + 0.4); lash(bx, ya, bz, 4.6, 0, dz + 0.4);
    }
    const [ax, az] = legXY(...a, 160), [bx, bz] = legXY(...b, 160);
    line3([ax, 160, az], [bx, 160, bz], TCOL.LOG, 4.6, 0, isFront((ax + bx) / 2, (az + bz) / 2) ? 3 : -3);
  }
  // the ladder up the front face
  const LW = 6.5, LZb = LB + 16, LZt = LT + 7 + 1.5, LYt = H + 2 + 16, LXC = -6;
  for (const lx of [LXC - LW, LXC + LW]) line3([lx, 0, LZb], [lx, LYt, LZt], TCOL.LOG, 3.4, 0, LZb);
  for (let i = 1; i < 13; i++) { const t = i / 13, y = LYt * t, z = LZb + (LZt - LZb) * t; line3([LXC - LW, y, z], [LXC + LW, y, z], TCOL.RAIL, 2.6, 0, LZb + 0.5); }
  // the deck
  const PO = 7, PX0 = -LT - PO, PX1 = LT + PO, PZ0 = -LT - PO, PZ1 = LT + PO, DY = TW_DY;
  for (const [a, b] of [[[PX0, PZ0], [PX1, PZ0]], [[PX1, PZ0], [PX1, PZ1]], [[PX1, PZ1], [PX0, PZ1]], [[PX0, PZ1], [PX0, PZ0]]])
    line3([a[0], DY - 2, a[1]], [b[0], DY - 2, b[1]], TCOL.PLANK_D, 4.2, 0, isFront((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) ? 2 : -2);
  const NPL = 7;
  for (let i = 0; i < NPL; i++) {
    const z0 = PZ0 + ((PZ1 - PZ0) * i) / NPL, z1 = PZ0 + ((PZ1 - PZ0) * (i + 1)) / NPL;
    poly([[PX0, DY, z0], [PX1, DY, z0], [PX1, DY, z1], [PX0, DY, z1]], i % 2 ? TCOL.PLANK : TCOL.PLANK_L, 0, 5 + i * 0.01, true, 1.6);
  }
  add(5.5, 0, (g) => { g.fillStyle = rgb(TCOL.PLANK_D); for (let i = 0; i < NPL; i++) { const zc = PZ0 + ((PZ1 - PZ0) * (i + 0.5)) / NPL; for (const xx of [PX0 + 6, PX1 - 6]) { const c = TP(xx, DY, zc); g.beginPath(); g.arc(c[0], c[1], TWW(0.9), 0, TAU); g.fill(); } } });
  // the railing: posts with gold caps, two rails, X-braces; the front sides go over the archers
  const RH = 22;
  for (const [a, b] of [[[PX0, PZ0], [PX1, PZ0]], [[PX1, PZ0], [PX1, PZ1]], [[PX1, PZ1], [PX0, PZ1]], [[PX0, PZ1], [PX0, PZ0]]]) {
    const front = isFront((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), layer = front ? 1 : 0, dz = front ? 6 : -6, inset = 2;
    const ax = a[0] - Math.sign(a[0]) * inset, az = a[1] - Math.sign(a[1]) * inset, bx = b[0] - Math.sign(b[0]) * inset, bz = b[1] - Math.sign(b[1]) * inset;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    for (const [p, q] of [[[ax, az], [mx, mz]], [[mx, mz], [bx, bz]]]) {
      line3([p[0], DY + 1, p[1]], [q[0], DY + RH - 1, q[1]], TCOL.RAIL, 2, layer, dz + 0.1);
      line3([q[0], DY + 1, q[1]], [p[0], DY + RH - 1, p[1]], TCOL.RAIL, 2, layer, dz + 0.2);
    }
    line3([ax, DY + RH * 0.5, az], [bx, DY + RH * 0.5, bz], TCOL.RAIL_D, 2.6, layer, dz + 0.4);
    line3([ax, DY + RH, az], [bx, DY + RH, bz], TCOL.LOG, 3.6, layer, dz + 0.5);
    for (const [x, z, hh] of [[ax, az, RH + 7], [mx, mz, RH + 2]]) {
      logPost(x, z, DY, DY + hh, 4.2, layer, dz + 0.8);
      add(tDepth(x, 0, z) + dz + 0.9, layer, (g) => {
        const c = TP(x, DY + hh + 1, z), r = TWW(3);
        g.fillStyle = TCOL.INK; g.beginPath(); g.moveTo(c[0] - r, c[1] + r * 0.5); g.lineTo(c[0] + r, c[1] + r * 0.5); g.lineTo(c[0], c[1] - r * 1.3); g.closePath(); g.fill();
        g.fillStyle = TCOL.GOLD; g.beginPath(); g.moveTo(c[0] - r * 0.7, c[1] + r * 0.32); g.lineTo(c[0] + r * 0.7, c[1] + r * 0.32); g.lineTo(c[0], c[1] - r * 0.85); g.closePath(); g.fill();
      });
    }
  }
  // the flag on its pole at the back corner, in the team's colour
  const FX = PX0 + 2, FZ = PZ0 + 2;
  line3([FX, DY, FZ], [FX, DY + 78, FZ], TCOL.RAIL_D, 2.2, 0, -12);
  poly([[FX, DY + 78, FZ], [FX + 24, DY + 70, FZ], [FX, DY + 62, FZ]], TRIM, 0, -11.8, true, 1.8);
  poly([[FX + 1.5, DY + 74.5, FZ], [FX + 15, DY + 70, FZ], [FX + 1.5, DY + 65.5, FZ]], [240, 234, 220], 0, -11.7, false);
  add(-11.6, 0, (g) => { const c = TP(FX, DY + 79, FZ); g.fillStyle = TCOL.INK; g.beginPath(); g.arc(c[0], c[1], TWW(2.2), 0, TAU); g.fill(); g.fillStyle = TCOL.GOLD; g.beginPath(); g.arc(c[0], c[1], TWW(1.4), 0, TAU); g.fill(); });
  // the torch on the front corner post
  const TX = PX1 - 2, TZ = PZ1 - 2;
  line3([TX, DY + RH + 7, TZ], [TX, DY + RH + 22, TZ], TCOL.RAIL_D, 2.4, 1, 13);
  // the banner hanging off the front rail
  const BW = 15, BL = 62, BXc = 14, BZ = PZ1 + 1.2, by0 = DY + RH, by1 = DY + RH - BL;
  poly([[BXc - BW / 2, by0, BZ], [BXc + BW / 2, by0, BZ], [BXc + BW / 2, by1, BZ], [BXc - BW / 2, by1, BZ]], TRIM, 1, 7, true, 1.8);
  add(7.1, 1, (g) => {
    g.strokeStyle = TCOL.GOLD; g.lineWidth = TWW(1.2);
    for (const sx of [-1, 1]) { const xx = BXc + sx * (BW / 2 - 1.8), A = TP(xx, by0 - 1, BZ), B = TP(xx, by1 + 1, BZ); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); }
    const xs = BXc - BW * 0.18, A = TP(xs, by0 - 2, BZ), B = TP(xs + 1.5, by1 + 2, BZ);
    g.strokeStyle = rgb(TRIM, 0.82); g.lineWidth = TWW(2.2); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
    const c = TP(BXc, by0 - BL * 0.38, BZ);
    g.fillStyle = TCOL.GOLD; g.beginPath(); g.arc(c[0], c[1], TWW(3), 0, TAU); g.fill();
    g.fillStyle = rgb(TRIM); g.beginPath(); g.arc(c[0], c[1], TWW(1.5), 0, TAU); g.fill();
    g.strokeStyle = TCOL.ROPE; g.lineWidth = TWW(1.4);
    for (const sx of [-1, 1]) { const P0 = TP(BXc + sx * (BW / 2 - 1.5), by0 + 1.5, BZ), P1 = TP(BXc + sx * (BW / 2 - 1.5), by0 - 2, BZ); g.beginPath(); g.moveTo(P0[0], P0[1]); g.lineTo(P1[0], P1[1]); g.stroke(); }
  });
  // rattan baskets bristling with arrows: four round the foot, one up on the deck
  const basket = (cx, cy, cz, layer, dz, n) => {
    const r = 5.6, h = 15, dd = tDepth(cx, 0, cz) + dz;
    const ell = (y, rr) => { const pts = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; pts.push(TP(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr)); } return pts; };
    add(dd, layer, (g) => {
      const top = ell(cy + h, r), bot = ell(cy, r * 0.86);
      const L = (pts) => pts.reduce((m, p) => (p[0] < m[0] ? p : m)), Rr = (pts) => pts.reduce((m, p) => (p[0] > m[0] ? p : m));
      const front = (pts) => pts.filter((p) => p[1] >= (L(pts)[1] + Rr(pts)[1]) / 2 - 1e-4).sort((a, b) => a[0] - b[0]);
      const fb = front(bot);
      g.beginPath(); g.moveTo(L(top)[0], L(top)[1]); g.lineTo(fb[0][0], fb[0][1]); for (const p of fb) g.lineTo(p[0], p[1]); g.lineTo(Rr(top)[0], Rr(top)[1]); g.closePath();
      g.fillStyle = rgb(TCOL.RAT); g.fill(); g.strokeStyle = TCOL.INK; g.lineWidth = TWW(1.6); g.stroke();
      for (let j = 1; j < 6; j++) { const yy = cy + (h * j) / 6, rr = r * (0.86 + (0.14 * j) / 6), fa = front(ell(yy, rr)); g.strokeStyle = rgb(j % 2 ? TCOL.RAT_D : TCOL.RAT_L); g.lineWidth = TWW(1); g.beginPath(); fa.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.moveTo(Rr(top)[0], Rr(top)[1]); g.lineTo(Rr(bot)[0], Rr(bot)[1]); const m = TP(cx + r * 0.4, cy, cz + r * 0.6); g.lineTo(m[0], m[1]); const m2 = TP(cx + r * 0.4, cy + h, cz + r * 0.6); g.lineTo(m2[0], m2[1]); g.closePath(); g.fill();
      g.beginPath(); top.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = rgb(TCOL.LOG_D); g.fill(); g.strokeStyle = TCOL.INK; g.lineWidth = TWW(1.4); g.stroke();
      const inner = ell(cy + h, r * 0.78); g.beginPath(); inner.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = '#281c12'; g.fill();
      // the arrows, fanning out of the mouth
      for (let k = 0; k < n; k++) {
        const a = R() * TAU, rr = R() * r * 0.7, ox = Math.cos(a) * rr, oz = Math.sin(a) * rr;
        const lx = (ox / r) * (4 + R() * 5), lz = (oz / r) * (3 + R() * 4), ah = 24 + R() * 10;
        const a0 = TP(cx + ox * 0.5, cy + h - 2, cz + oz * 0.5), a1 = TP(cx + ox + lx, cy + h + ah, cz + oz + lz);
        g.strokeStyle = TCOL.INK; g.lineWidth = TWW(2.6); g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.stroke();
        g.strokeStyle = '#967446'; g.lineWidth = TWW(1.1); g.stroke();
        const vx = a1[0] - a0[0], vy = a1[1] - a0[1], LL = Math.hypot(vx, vy) || 1, ux = vx / LL, uy = vy / LL, nx = -uy, ny = ux;
        const f0 = [a1[0] - ux * TWW(7), a1[1] - uy * TWW(7)], f1 = [a1[0] - ux * TWW(1.5), a1[1] - uy * TWW(1.5)];
        for (const [ww, col] of [[2.4, TCOL.INK], [1.6, '#ecdcb4']]) { const W = TWW(ww); g.fillStyle = col; g.beginPath(); g.moveTo(f0[0] + nx * W * 0.5, f0[1] + ny * W * 0.5); g.lineTo(f1[0] + nx * W, f1[1] + ny * W); g.lineTo(f1[0] - nx * W, f1[1] - ny * W); g.lineTo(f0[0] - nx * W * 0.5, f0[1] - ny * W * 0.5); g.closePath(); g.fill(); }
        g.fillStyle = '#a02e26'; g.beginPath(); g.arc(a1[0], a1[1], TWW(1.2), 0, TAU); g.fill();
      }
    });
  };
  for (const [bx, bz] of [[-52, 14], [-40, 32], [46, 24], [58, 6]]) basket(bx, 0, bz, 0, 0, 12);
  basket(PX1 - 9, DY, PZ0 + 8, 0, 5.6, 10);
  // render the two layers
  const W = 1.7, Hh = 2.3, ox = 0.85, oy = 1.95;
  const mk = (layer) => {
    const c = spriteCanvas(W, Hh, res), g = c.getContext('2d');
    g.scale(res, res); g.translate(ox, oy);
    for (const it of items.slice().sort((a, b) => a.d - b.d)) if (it.layer === layer) it.f(g);
    return c;
  };
  // the deck spots where the three archers stand (design x, z)
  const spots = [[-12, -7], [12, -9], [1, 9]].map(([x, z]) => ({ p: TP(x, DY, z), d: tDepth(x, 0, z) }));
  return { lower: mk(0), upper: mk(1), W, H: Hh, ox, oy, torch: TP(TX, DY + RH + 24, TZ), spots, top: TP(FX, DY + 82, FZ)[1] };
}

// ---------- placing them: one on each lane a third of the way out from each camp, one guarding each camp ----------
function lanePointAt(P, frac) {
  let L = 0; const seg = [];
  for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y); seg.push(d); L += d; }
  let want = L * frac;
  for (let i = 1; i < P.length; i++) {
    if (want <= seg[i - 1]) { const t = want / seg[i - 1]; const a = P[i - 1], b = P[i]; return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), dx: (b.x - a.x) / seg[i - 1], dy: (b.y - a.y) / seg[i - 1] }; }
    want -= seg[i - 1];
  }
  const a = P[P.length - 2], b = P[P.length - 1], d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: b.x, y: b.y, dx: (b.x - a.x) / d, dy: (b.y - a.y) / d };
}
function placeTowers(w) {
  w.towers = [];
  const C = { x: w.W / 2, y: w.H / 2 };
  const put = (team, lane, frac, base) => {
    const P = team === 'red' ? lane : lane.slice().reverse();
    const q = lanePointAt(P, frac);
    // stand just off the lane, on the side toward the middle of the map, so the lane stays open
    let nx = -q.dy, ny = q.dx;
    if (nx * (C.x - q.x) + ny * (C.y - q.y) < 0) { nx = -nx; ny = -ny; }
    mk(team, q.x + nx, q.y + ny, false, [0, 1, 2]);
  };
  // a tower: three archers on a lane tower's deck, one on each of the camp's
  const mk = (team, x, y, base, men) => {
    const t = { team, x, y, hp: TOWER_HP, maxHp: TOWER_HP, dead: false, fallT: 0, fallDir: 1, flash: 0, base, seed: Math.floor(Math.random() * 1e6), target: null, isTower: true, kills: 0, hero: { name: team === 'red' ? 'ป้อมแดง' : 'ป้อมน้ำเงิน' } };
    t.archers = men.map((i) => { const a = makeActor('archer', team, t.x, t.y); a.spot = i; a.cd = 0.08 * i + Math.random() * 0.08; a.face = team === 'red' ? 1 : -1; return a; });
    t.solid = { x: t.x, y: t.y, r: TOWER_SOLID, tower: t };
    w.towers.push(t);
  };
  // the camp: three towers in an arc behind the spawn point, one archer on each
  const camp = (team) => {
    const s = team === 'red' ? w.spawn : { x: w.W - w.spawn.x, y: w.H - w.spawn.y };
    const back = Math.atan2(s.y - C.y, s.x - C.x);
    for (const da of [-1.1, 0, 1.1]) mk(team, s.x + Math.cos(back + da) * 2.15, s.y + Math.sin(back + da) * 2.15, true, [2]);
  };
  // the one-lane map: a lane tower each, and the camp
  if (w.lanes.length === 1) { for (const team of ['red', 'blue']) { put(team, w.lanes[0], 0.3); camp(team); } return; }
  for (const team of ['red', 'blue']) {
    put(team, w.lanes[0], 0.27);
    put(team, w.lanes[1], 0.33);
    put(team, w.lanes[2], 0.27);
    camp(team);
  }
}
function towerNear(w, x, y, r) { for (const t of w.towers || []) if (Math.hypot(t.x - x, t.y - y) < r) return t; return null; }

// ---------- fighting ----------
function towerFoes(w, t) {
  const out = [];
  for (const a of w.actors || []) {
    if (a.dead || a.team === t.team || a.grab) continue;
    if (Math.hypot(a.x - t.x, a.y - t.y) <= TOWER_R) out.push(a);
  }
  return out;
}
function damageTower(w, t, dmg, src) {
  if (!t || t.dead || (src && src.team === t.team)) return false;
  dmg = Math.round(dmg * atkMul(src));
  const dealt = Math.min(dmg, t.hp);
  t.hp -= dmg; t.flash = 0.15;
  awardTower(w, t, src, dealt, t.hp <= 0);
  addFloater(w, t.x + (Math.random() - 0.5) * 0.3, t.y - 1.5, '-' + dmg, src && src.isPlayer ? '#ffe9a8' : '#fff4d6', 0.95);
  sfxAt('wood', t.x, t.y, 0.6, 0.9);
  if (t.hp <= 0) {
    t.hp = 0; t.dead = true; t.fallT = 0; t.fallDir = src && src.x > t.x ? -1 : 1;
    const i = w.solids.indexOf(t.solid); if (i >= 0) w.solids.splice(i, 1);
    addFloater(w, t.x, t.y - 1.9, (t.team === 'red' ? 'ป้อมแดง' : 'ป้อมน้ำเงิน') + 'พัง!', '#ffd08a', 1.4);
    if (w.feed) w.feed.push({ k: src && src.hero ? src.hero.name : '?', kt: src ? src.team : t.team, v: t.hero.name, vt: t.team, kp: !!(src && src.isPlayer), vp: false, t: 0 });
    sfxAt('crack', t.x, t.y, 1);
    w.shake = Math.max(w.shake || 0, 0.35);
    dust(w, t.x, t.y, 14, 2.6);
    if (!w.preview && typeof buildNav === 'function') buildNav(w);
  }
  return true;
}
function tickTowers(w, dt) {
  for (const t of w.towers || []) {
    t.flash = Math.max(0, t.flash - dt);
    if (t.dead) { t.fallT += dt; continue; }
    // the ring: who's inside it now; keep shooting the same man while he stays in
    const foes = towerFoes(w, t);
    if (!t.target || t.target.dead || !foes.includes(t.target)) t.target = foes.sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) + (a.creep ? 0 : 3) - Math.hypot(b.x - t.x, b.y - t.y) - (b.creep ? 0 : 3))[0] || null;
    for (const a of t.archers) {
      a.time += dt;
      if (a.act) { a.act.t += dt; if (a.act.t >= a.act.dur) a.act = null; }
      a.cd -= dt;
      const T = t.target;
      if (!T) { a.aimPose = null; continue; }
      const dir = unit2(T.x - t.x, T.y - t.y);
      a.face = dir[0] >= 0 ? 1 : -1;
      if (!a.act) a.aimPose = { k: 'shoot', dir };
      if (a.cd <= 0) {
        a.cd = TOWER_RATE * (0.85 + Math.random() * 0.3);
        // loosed down from the deck, leading a running man a little
        const d = Math.hypot(T.x - t.x, T.y - t.y), lead = d / 11;
        const tx = T.x + (T.svx || 0) * lead + (Math.random() - 0.5) * 0.12, ty = T.y + (T.svy || 0) * lead + (Math.random() - 0.5) * 0.08;
        const dd = unit2(tx - t.x, ty - t.y), L = Math.max(0.3, Math.hypot(tx - t.x, ty - t.y));
        const src = { x: t.x, y: t.y, team: t.team, isTower: true, hero: t.hero, kills: 0, buffT: 0 };
        spawnProj(src, w, 'arrow', dd, L + 0.6, 11, TOWER_DMG, { drop: { z0: -TW_DECK + 0.45, z1: 0.3, L }, x: t.x, y: t.y, homing: T }); // curls in after its man
        a.act = { k: 'loose', t: 0, prev: 0, dur: 0.14, dir: dd, dist: 0, hits: new Set() };
        a.aimPose = null;
      }
    }
  }
}

// ---------- drawing ----------
let towerSprites = { res: 0, red: null, blue: null };
function towerSprite(team, res) {
  if (towerSprites.res !== res) towerSprites = { res, red: null, blue: null };
  return towerSprites[team] || (towerSprites[team] = buildTowerSprite(team, res, team === 'red' ? 11 : 23));
}
function drawTowerRing(g, w, t, pl, k) {
  if (t.dead) return;
  const [sx, sy] = w2s(t.x, t.y);
  const enemyIn = pl && !pl.dead && pl.team !== t.team && Math.hypot(pl.x - t.x, pl.y - t.y) <= TOWER_R;
  const col = t.team === 'red' ? [226, 80, 64] : [80, 140, 240];
  const now = performance.now() / 1000;
  g.save();
  g.translate(sx, sy); g.scale(1, TILT);
  const R = TOWER_R * k;
  if (enemyIn) { const pulse = 0.5 + 0.5 * Math.sin(now * 10); g.fillStyle = `rgba(255,60,40,${0.1 + 0.08 * pulse})`; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); }
  else { g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.06)`; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); }
  g.setLineDash([k * 0.16, k * 0.1]); g.lineDashOffset = -now * k * 0.2;
  g.strokeStyle = enemyIn ? 'rgba(255,80,60,0.95)' : `rgba(${col[0]},${col[1]},${col[2]},0.6)`;
  g.lineWidth = Math.max(1.5, k * (enemyIn ? 0.03 : 0.02));
  g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
  g.restore();
}
function drawTower(g, w, t, k, alpha) {
  const res = Math.round(k * DPR * 1.0);
  const S = towerSprite(t.team, res);
  const [sx, sy] = w2s(t.x, t.y);
  g.save();
  // the shade at its foot
  if (!t.dead || t.fallT < 1.5) drawShadow(g, sx + k * 0.05, sy, k * 0.55, k * 0.22, 0.5 * (t.dead ? Math.max(0, 1 - t.fallT) : 1));
  if (t.dead) {
    // toppling over, then a heap of timber
    const u = clamp(t.fallT / 1.0, 0, 1), ang = t.fallDir * 1.4 * u * u;
    if (u < 1 || t.fallT < 2.2) {
      g.save();
      g.globalAlpha *= clamp(2.2 - t.fallT, 0, 1);
      g.translate(sx, sy); g.rotate(ang); g.translate(-sx, -sy);
      g.drawImage(S.lower, sx - S.ox * k, sy - S.oy * k, S.W * k, S.H * k);
      g.drawImage(S.upper, sx - S.ox * k, sy - S.oy * k, S.W * k, S.H * k);
      g.restore();
      if (t.fallT > 0.95 && t.fallT < 1.05) dust(w, t.x + t.fallDir * 0.9, t.y, 10, 2);
    }
    if (u >= 0.95) {
      const Rr = mulberry32(t.seed);
      g.save(); g.globalAlpha *= clamp((t.fallT - 0.9) * 3, 0, 1); g.lineCap = 'round';
      for (let i = 0; i < 16; i++) {
        const x = sx + t.fallDir * (Rr() * 1.3 - 0.2) * k, y = sy + (Rr() - 0.5) * 0.45 * k, a = (Rr() - 0.5) * 1.4, L = (0.18 + Rr() * 0.35) * k;
        g.strokeStyle = TCOL.INK; g.lineWidth = k * 0.045; g.beginPath(); g.moveTo(x - Math.cos(a) * L / 2, y - Math.sin(a) * L / 2 * TILT); g.lineTo(x + Math.cos(a) * L / 2, y + Math.sin(a) * L / 2 * TILT); g.stroke();
        g.strokeStyle = rgb(i % 3 ? TCOL.LOG : TCOL.PLANK); g.lineWidth = k * 0.03; g.stroke();
      }
      g.restore();
    }
    g.restore();
    return;
  }
  g.globalAlpha *= alpha;
  const shake = t.flash > 0 ? Math.sin(t.flash * 120) * k * 0.02 : 0;
  g.drawImage(S.lower, sx - S.ox * k + shake, sy - S.oy * k, S.W * k, S.H * k);
  // the archers on the deck, back ones first
  const order = t.archers.map((a) => ({ a, sp: S.spots[a.spot] })).sort((p, q) => p.sp.d - q.sp.d);
  for (const { a, sp } of order) {
    const s = k * a.hero.size * 0.85;
    drawFigure(g, a, sx + sp.p[0] * k + shake, sy + sp.p[1] * k, s, poseOf(a));
  }
  g.drawImage(S.upper, sx - S.ox * k + shake, sy - S.oy * k, S.W * k, S.H * k);
  // the torch's flame
  const fl = 0.5 + 0.5 * Math.sin(performance.now() / 70 + t.seed);
  const tx = sx + S.torch[0] * k, ty = sy + S.torch[1] * k;
  g.fillStyle = TCOL.INK; g.beginPath(); g.ellipse(tx, ty, k * 0.03, k * 0.05, 0, 0, TAU); g.fill();
  g.fillStyle = `rgb(232,${110 + 40 * fl},40)`; g.beginPath(); g.ellipse(tx, ty - k * 0.005, k * 0.023, k * 0.04 + fl * k * 0.006, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgb(250,214,96)'; g.beginPath(); g.ellipse(tx, ty + k * 0.005, k * 0.013, k * 0.022, 0, 0, TAU); g.fill();
  // HP bar over the flag
  const bw = k * 0.9, bh = Math.max(4, k * 0.06), bx = sx - bw / 2, by = sy + S.top * k - bh - 6;
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(16,10,4,0.85)'; g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
  g.fillStyle = t.team === 'red' ? '#d9503e' : '#4a86e8';
  g.fillRect(bx, by, bw * (t.hp / t.maxHp), bh);
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(bx, by, bw * (t.hp / t.maxHp), bh * 0.4);
  g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1;
  for (let i = 1; i < 10; i++) { const x = bx + (bw * i) / 10; g.beginPath(); g.moveTo(x, by); g.lineTo(x, by + bh); g.stroke(); }
  g.font = '700 ' + Math.round(Math.max(10, k * 0.12)) + 'px Kanit, "Noto Sans Thai", sans-serif'; g.textAlign = 'center';
  g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(Math.ceil(t.hp) + '', sx, by - 3); g.fillStyle = '#fff4d6'; g.fillText(Math.ceil(t.hp) + '', sx, by - 3);
  g.restore();
}

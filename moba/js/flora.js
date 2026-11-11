'use strict';
// ===== coconut palms and banana plants =====

// ---------------- coconut palms ----------------
// kinds: 0 tall, 1 leaning out over the water, 2 young (a big crown right off the ground), 3 a pair from one foot.
// The trunk is drawn every frame so it can bend under a blow; the crown rides its top, lagging behind.
function makePalm(R, x, y, lean, kind) {
  const trunks = [];
  if (kind === 2) trunks.push({ lean: lean * 0.3, h: 0.45 + R() * 0.25, wd: 0.11 });
  else if (kind === 3) { trunks.push({ lean: -0.25 - R() * 0.2, h: 2.5 + R() * 0.4, wd: 0.055 }); trunks.push({ lean: 0.45 + R() * 0.3, h: 1.8 + R() * 0.3, wd: 0.05 }); }
  else if (kind === 1) trunks.push({ lean: lean * (1.3 + R() * 0.5), h: 2.3 + R() * 0.5, wd: 0.058 });
  else trunks.push({ lean: lean * 0.4 + (R() - 0.5) * 0.25, h: 2.6 + R() * 0.7, wd: 0.058 });
  return { x, y, kind, lean, h: trunks[0].h, trunks, seed: Math.floor(R() * 1e6), phase: R() * 10, bend: 0, bendV: 0, swing: 0, swingV: 0, drops: 0 };
}
// a point up trunk tr at t (0 foot .. 1 crown): offset from the foot (world x, height up), and the slope there
function palmAt(c, tr, t, sway = 0) {
  const b = c.bend + sway;
  const x = tr.lean * (1 - Math.pow(1 - t, 1.7)) + b * tr.h * Math.pow(t, 1.8);
  const dx = tr.lean * 1.7 * Math.pow(1 - t, 0.7) + b * tr.h * 1.8 * Math.pow(t, 0.8);
  return { x, z: tr.h * t, a: Math.atan2(dx, tr.h) };
}
function palmTop(c) { const tr = c.trunks[0]; const p = palmAt(c, tr, 1); return { x: c.x + p.x, z: p.z }; }

// the crown, drawn once per trunk at the current zoom: fronds arching out and drooping, a cluster of nuts
function buildPalmCrown(c, ti, res) {
  const R = mulberry32(c.seed + ti * 77);
  const young = c.kind === 2;
  const S = young ? 1.05 : ti === 1 ? 0.85 : 1;
  const W = 3.4 * S, H = 3.2 * S, ox = W / 2, oy = 1.1 * S;
  const cv = spriteCanvas(W, H, res);
  const g = cv.getContext('2d');
  g.scale(res, res); g.translate(ox, oy);
  g.lineCap = 'round'; g.lineJoin = 'round';
  // a frond: a long rib that lifts, arches over and droops, hung thick with fine leaflets
  const frond = (a, L, up, droop, dark, dry) => {
    const dx = Math.cos(a), dz = Math.sin(a);
    const cx = dx * L * 0.42, cy = -L * up + dz * L * 0.18;
    const ex = dx * L, ey = L * droop + dz * L * 0.36;
    const pt = (t) => { const u = 1 - t; return { x: 2 * u * t * cx + t * t * ex, y: 2 * u * t * cy + t * t * ey }; };
    const base = dry ? [138, 100, 52] : [52, 92, 34];
    const col = (m) => `rgb(${Math.round(base[0] * dark * m)},${Math.round(base[1] * dark * m)},${Math.round(base[2] * dark * m)})`;
    const n = Math.round(L * 44);
    for (let i = 2; i < n; i++) {
      const t = i / n, q = pt(t), q2 = pt(Math.min(1, t + 0.02));
      const ta = Math.atan2(q2.y - q.y, q2.x - q.x);
      const ll = 0.26 * S * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.03)), 0.55);
      for (const sg of [-1, 1]) {
        // leaflets fall away from the rib, longer toward the middle, hanging under their own weight
        const la = ta + sg * 0.75;
        const hang = ll * (0.18 + 0.2 * t);
        g.strokeStyle = col(sg > 0 ? 1.15 : 0.82);
        g.lineWidth = 0.0085;
        g.beginPath(); g.moveTo(q.x, q.y);
        g.quadraticCurveTo(q.x + Math.cos(la) * ll * 0.45, q.y + Math.sin(la) * ll * 0.45, q.x + Math.cos(la) * ll * 0.8, q.y + Math.sin(la) * ll * 0.8 + hang);
        g.stroke();
      }
    }
    g.strokeStyle = col(0.55); g.lineWidth = 0.02;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
    g.strokeStyle = col(1.5); g.lineWidth = 0.008; g.stroke();
  };
  // the old fronds hanging straight down the trunk, some still green, the oldest gone brown
  const hangN = young ? 1 : 2;
  for (let i = 0; i < hangN; i++) {
    const a = Math.PI / 2 + (i - (hangN - 1) / 2) * 0.32 + (R() - 0.5) * 0.15;
    frond(a, (young ? 0.7 : 0.95) * S, -0.05, 0.9, 0.85, i === 0);
  }
  const fr = [];
  const n = young ? 11 : 16;
  for (let i = 0; i < n; i++) fr.push({ a: (i / n) * TAU + (R() - 0.5) * 0.3, L: (young ? 1.15 : 1.4) * S * (0.85 + R() * 0.25), up: (young ? 0.4 : 0.24) + R() * 0.12, droop: (young ? 0.02 : 0.08) + R() * 0.12 });
  fr.sort((a, b) => Math.sin(a.a) - Math.sin(b.a));
  for (const f of fr) if (Math.sin(f.a) < 0) frond(f.a, f.L, f.up, f.droop, 0.78, false);
  // the heart of the crown: a cluster of green nuts and the new spear leaf standing up
  if (!young) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + R() * 0.3, x = Math.cos(a) * 0.07, y = 0.08 + Math.sin(a) * 0.04;
      g.fillStyle = i % 3 === 0 ? '#9aa83a' : '#6e8a2e'; g.strokeStyle = INK; g.lineWidth = 0.011;
      g.beginPath(); g.ellipse(x, y, 0.055, 0.06, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(240,250,200,0.35)'; g.beginPath(); g.arc(x - 0.018, y - 0.022, 0.014, 0, TAU); g.fill();
    }
  }
  g.strokeStyle = '#7aa040'; g.lineWidth = 0.022; g.beginPath(); g.moveTo(0, 0.02); g.quadraticCurveTo(0.01, -0.12, 0.03, -0.3 * S); g.stroke();
  for (const f of fr) if (Math.sin(f.a) >= 0) frond(f.a, f.L, f.up, f.droop, 1, false);
  return { c: cv, ox, oy, W, H };
}
function buildPalmSprites(c, res) { c.crowns = c.trunks.map((_, i) => buildPalmCrown(c, i, res)); return c.crowns; }
function palmTrunkPath(g, c, tr, sx, sy, k, sway) {
  const N = Math.max(12, Math.round(tr.h * 16)), L = [], Rr = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = palmAt(c, tr, t, sway);
    const wd = (tr.wd * lerp(1, 0.75, t) + (t < 0.06 ? (0.06 - t) * 0.5 : 0)) * k;
    const nx = Math.cos(p.a), ny = Math.sin(p.a);
    const x = sx + p.x * k, y = sy - p.z * k;
    L.push([x - nx * wd, y - ny * wd]); Rr.push([x + nx * wd, y + ny * wd]);
  }
  return { L, Rr };
}
function drawPalm(g, c, sx, sy, k, alpha, time) {
  const sway = 0.018 * Math.sin(time * 0.8 + c.phase) + 0.008 * Math.sin(time * 2.1 + c.phase * 1.7);
  g.save();
  g.globalAlpha *= alpha;
  for (let ti = c.trunks.length - 1; ti >= 0; ti--) {
    const tr = c.trunks[ti];
    const { L, Rr } = palmTrunkPath(g, c, tr, sx, sy, k, sway);
    g.beginPath(); g.moveTo(L[0][0], L[0][1]);
    for (const v of L) g.lineTo(v[0], v[1]);
    for (let i = Rr.length - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]);
    g.closePath();
    const grd = g.createLinearGradient(sx - tr.wd * k, 0, sx + tr.wd * k, 0);
    grd.addColorStop(0, '#a8977a'); grd.addColorStop(0.5, '#8a7b62'); grd.addColorStop(1, '#5e5242');
    g.fillStyle = grd; g.fill();
    g.strokeStyle = INK; g.lineWidth = Math.max(1, k * 0.018); g.stroke();
    // the leaf scars ringing the trunk
    g.strokeStyle = 'rgba(52,44,32,0.7)'; g.lineWidth = Math.max(0.6, k * 0.009);
    for (let i = 1; i < L.length - 1; i++) { g.beginPath(); g.moveTo(L[i][0], L[i][1]); g.quadraticCurveTo((L[i][0] + Rr[i][0]) / 2, (L[i][1] + Rr[i][1]) / 2 + k * 0.012, Rr[i][0], Rr[i][1]); g.stroke(); }
    // the crown on top, swinging behind the trunk's moves
    const top = palmAt(c, tr, 1, sway);
    const cr = c.crowns && c.crowns[ti];
    if (cr) {
      g.save();
      g.translate(sx + top.x * k, sy - top.z * k);
      g.rotate(top.a * 0.5 + c.swing);
      g.drawImage(cr.c, -cr.ox * k, -cr.oy * k, cr.W * k, cr.H * k);
      g.restore();
    }
  }
  g.restore();
}
// struck: the trunk bends and springs back; hit hard, a frond may come down
function palmHit(w, c, power, dir, heavy) {
  c.bendV += dir * 1.2 * power;
  c.swingV -= dir * 1.5 * power;
  const top = palmTop(c);
  addFx(w, { k: 'leafBits', x: top.x, y: c.y, z: top.z, t: 0, dur: 1.6, seed: Math.random() * 1e3, n: 6, col: 'green' });
  if ((heavy || power >= 1.4 || Math.random() < 0.25 * power) && c.drops < 4 && c.kind !== 2) { c.drops++; dropFrond(w, c); }
}
function dropFrond(w, c) {
  const top = palmTop(c);
  const a = Math.random() * TAU, sp = 0.5 + Math.random() * 1.2;
  (w.litter || (w.litter = [])).push({ kind: 'frond', x: top.x + Math.cos(a) * 0.2, y: c.y + Math.sin(a) * 0.15, z: top.z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: 0.6 + Math.random(), rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 6, len: 0.8 + Math.random() * 0.35, age: 0, life: 50, seed: Math.random() * 1e3, dry: Math.random() < 0.3 ? 0.8 : Math.random() * 0.25, hackT: -9, flutter: 1 });
}

// ---------------- banana plants ----------------
// kinds: 0 young (shorter than a man, a rolled new leaf in the middle), 1 tall, 2 bearing a bunch, 3 a clump of three
function makeBanana(R, x, y) {
  const type = Math.floor(R() * 4);
  const offs = type === 3 ? [[-0.11, -0.03, 1.05], [0.1, 0.02, 0.8], [0.0, 0.07, 0.55]] : [[0, 0, type === 0 ? 0.6 : type === 2 ? 1.1 : 1.25]];
  const stems = offs.map(([ox, oy, h]) => {
    const small = h < 0.7;
    const n = small ? 5 : 7;
    const leaves = [];
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, spread = Math.floor((i + 1) / 2) / Math.ceil(n / 2);
      const slits = [];
      const ns = R() < 0.35 ? 0 : 1 + Math.floor(R() * 4);
      for (let s = 0; s < ns; s++) slits.push({ t: 0.25 + R() * 0.65, side: R() < 0.5 ? -1 : 1 });
      leaves.push({ a: -Math.PI / 2 + side * (0.3 + spread * 0.95) + (R() - 0.5) * 0.2, L: (0.55 + R() * 0.2) * (small ? 0.72 : 1), W: 0.13 + R() * 0.025, arch: 0.06 + R() * 0.05, droop: 0.2 + spread * 0.3 + R() * 0.08, sp: 0, v: 0, ph: R() * 6, slits, yellow: spread > 0.8 && R() < 0.5 ? 0.6 : 0 });
    }
    leaves.sort((a, b) => Math.abs(b.a + Math.PI / 2) - Math.abs(a.a + Math.PI / 2));
    const spots = [];
    for (let i = 0; i < 7; i++) spots.push({ t: 0.05 + R() * 0.8, s: R() * 2 - 1, r: 0.012 + R() * 0.02 });
    return { ox, oy, h, r: small ? 0.04 : 0.05, lean: (R() - 0.5) * 0.08, rest: (R() - 0.5) * 0.08, leanV: 0, bob: 0, bobV: 0, sway: 0, swayV: 0, leaves, spots, dead: small ? 0 : 1 + Math.floor(R() * 2), cigar: small || R() < 0.4 };
  });
  return { x, y, type, stems, hp: 5, cut: false, fall: -1, fallDir: 1, grow: 1, regrow: 0, blood: 0, shattered: false };
}
function hitBanana(w, b, fromX, power = 1) {
  if (b.cut) return;
  const dir = b.x >= fromX ? 1 : -1;
  for (const st of b.stems) {
    st.leanV += dir * 3.2 * power; st.bobV -= 4.5 * power; st.swayV -= dir * 2.5 * power;
    for (const L of st.leaves) L.v += (1 + Math.random() * 1.6) * power;
  }
  b.hp -= 1;
  addFx(w, { k: 'spark', x: b.x - dir * 0.05, y: b.y, z: 0.35, t: 0, dur: 0.3, seed: Math.random() * 1e3 });
  addFx(w, { k: 'leafBits', x: b.x, y: b.y, z: 0.9, t: 0, dur: 1.4, seed: Math.random() * 1e3, n: 7, col: 'green' });
  if (b.hp <= 0) {
    b.cut = true; b.fall = 0; b.fallDir = dir; b.regrow = 0; b.shattered = false;
    addFloater(w, b.x, b.y - 0.2, 'ต้นกล้วยหัก!', '#e8f0c0', 1.3);
  }
}
// the fallen top chopped again: four slices of trunk and every leaf come loose and fly
function shatterBanana(w, b) {
  b.shattered = true;
  const L = 0.85;
  const lit = w.litter || (w.litter = []);
  for (let k = 0; k < 4; k++) {
    const t = 0.15 + (k / 3) * 0.6;
    lit.push({ kind: 'slice', x: b.x + b.fallDir * L * t + (Math.random() - 0.5) * 0.06, y: b.y + (Math.random() - 0.5) * 0.1, z: 0.12, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.4, vz: 1 + Math.random(), rot: (Math.random() - 0.5) * 0.6, vr: (Math.random() - 0.5) * 8, age: 0, life: 30, seed: Math.random() * 1e3 });
  }
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * TAU, r = 0.1 + Math.random() * 0.3;
    lit.push({ kind: 'bleaf', x: b.x + b.fallDir * L + Math.cos(a) * r, y: b.y + Math.sin(a) * r * 0.7, z: 0.1, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 0.6, vz: 0.6 + Math.random() * 0.8, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 4, age: 0, life: 30, seed: Math.random() * 1e3, flutter: 1 });
  }
  addFx(w, { k: 'leafBits', x: b.x + b.fallDir * L * 0.5, y: b.y, z: 0.2, t: 0, dur: 1.4, seed: Math.random() * 1e3, n: 12, col: 'green' });
  sfxAt('wood', b.x, b.y, 0.7, 1.2);
}
function tickBanana(b, dt, movers) {
  if (b.cut) {
    b.fall += dt;
    if (b.fall > 7.5) { b.regrow += dt; if (b.regrow > 9) { b.cut = false; b.hp = 5; b.fall = -1; b.grow = 0.05; b.shattered = false; } }
  }
  if (b.grow < 1) b.grow = Math.min(1, b.grow + dt / 2.5);
  for (const st of b.stems) {
    const before = st.leanV;
    st.leanV += (-26 * (st.lean - st.rest) - 4.5 * st.leanV) * dt;
    st.lean = clamp(st.lean + st.leanV * dt, -0.4, 0.4);
    const jolt = Math.abs(st.leanV - before);
    st.bobV += (-60 * st.bob - 1.6 * st.bobV - 9 * st.bob * Math.abs(st.bob)) * dt - jolt * 2.2;
    st.bob = clamp(st.bob + st.bobV * dt, -0.8, 0.8);
    st.swayV += (-48 * st.sway - 2.2 * st.swayV) * dt - (st.leanV - before) * 1.4;
    st.sway = clamp(st.sway + st.swayV * dt, -0.5, 0.5);
    for (let i = 0; i < st.leaves.length; i++) {
      const L = st.leaves[i];
      const kk = 45 + ((i * 37) % 40), gain = 0.7 + ((i * 53) % 10) / 12;
      L.v += (-kk * L.sp - 1.4 * L.v) * dt + jolt * 0.6 * gain;
      L.sp = clamp(L.sp + L.v * dt, -0.45, 0.45);
    }
  }
  if (b.cut) return;
  for (const m of movers) {
    if (m.air) continue;
    for (const st of b.stems) {
      const d = Math.hypot(m.x - (b.x + st.ox), m.y - (b.y + st.oy));
      if (d > st.r + 0.15) continue;
      m.slow = true;
      const dir = b.x + st.ox >= m.x ? 1 : -1;
      st.leanV += dir * 5 * dt; st.bobV -= 6 * dt;
      for (let i = 0; i < st.leaves.length; i++) st.leaves[i].v += (2 + (i % 4)) * dt;
    }
  }
}
// a leaf: stalk, then a long blade arching up and hanging over, split into strips where the wind has torn it
function bananaLeaf(g, L, W, arch, droop, slits, yellow, ripple, phase) {
  const stalk = L * 0.16;
  const yAt = (t) => -arch * Math.sin(t * Math.PI * 0.8) + droop * t * t + ripple * t * Math.sin(t * Math.PI * 1.7 - phase);
  const base = yellow ? [150, 150, 52] : [60, 132, 40];
  g.strokeStyle = yellow ? '#8a8a3a' : '#4e7a2c'; g.lineWidth = Math.max(1, W * 0.22); g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(stalk * 0.6, yAt(0) - arch * 0.2, stalk, yAt(0)); g.stroke();
  const edge = (t, side) => { const wd = W * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.06)), 0.55) * (1 - 0.18 * t); return [stalk + (L - stalk) * t, yAt(t) + side * wd]; };
  for (const side of [-1, 1]) {
    // this half of the blade, cut into strips at its tears; each strip hangs a touch lower than the last
    const cuts = [0].concat(slits.filter((s) => s.side === side).map((s) => s.t).sort(), [1]);
    for (let c = 0; c < cuts.length - 1; c++) {
      const t0 = cuts[c] + (c ? 0.012 : 0), t1 = cuts[c + 1];
      const hang = c * 0.012 * L * side;
      g.beginPath();
      for (let i = 0; i <= 6; i++) { const t = lerp(t0, t1, i / 6); const q = edge(t, side); i ? g.lineTo(q[0], q[1] + hang) : g.moveTo(q[0], q[1]); }
      for (let i = 6; i >= 0; i--) { const t = lerp(t0, t1, i / 6); g.lineTo(stalk + (L - stalk) * t, yAt(t)); }
      g.closePath();
      const m = side < 0 ? 1.18 : 0.88;
      g.fillStyle = `rgb(${Math.round(base[0] * m)},${Math.round(base[1] * m)},${Math.round(base[2] * m)})`;
      g.fill();
      g.strokeStyle = '#1f3216'; g.lineWidth = Math.max(0.5, W * 0.06); g.stroke();
      // veins running out from the rib
      g.strokeStyle = side < 0 ? 'rgba(170,220,110,0.35)' : 'rgba(20,50,16,0.3)'; g.lineWidth = Math.max(0.4, W * 0.035);
      for (let t = t0 + 0.05; t < t1 - 0.02; t += 0.07) { const a = stalk + (L - stalk) * t, q = edge(t + 0.03, side); g.beginPath(); g.moveTo(a, yAt(t)); g.lineTo(q[0], q[1] + hang); g.stroke(); }
    }
  }
  // the midrib
  g.strokeStyle = yellow ? '#d8d090' : '#c4d48c'; g.lineWidth = Math.max(0.6, W * 0.1);
  g.beginPath(); for (let i = 0; i <= 12; i++) { const t = i / 12, x = stalk + (L - stalk) * t, y = yAt(t); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
}
function drawBananaStem(g, b, st, sx, sy, k, grow, alpha, time) {
  const bx = sx + st.ox * k, by = sy + st.oy * k * TILT;
  const h = st.h * k * grow, lean = st.lean;
  const tx = bx + Math.sin(lean) * h, ty = by - Math.cos(lean) * h;
  const r0 = st.r * k * 1.35 * Math.max(0.5, grow), r1 = st.r * k * 0.85 * Math.max(0.5, grow);
  g.save();
  g.globalAlpha *= alpha;
  // the pseudo-stem: sheaths wrapped round each other, blotched brown
  const mx = Math.sin(lean) * h * 0.4;
  g.beginPath();
  g.moveTo(bx - r0, by);
  g.quadraticCurveTo(bx - r0 * 0.9 + mx, by - h * 0.5, tx - r1, ty);
  g.lineTo(tx + r1, ty);
  g.quadraticCurveTo(bx + r0 * 0.9 + mx, by - h * 0.5, bx + r0, by);
  g.closePath();
  const grd = g.createLinearGradient(bx - r0, 0, bx + r0, 0);
  grd.addColorStop(0, '#5e7a34'); grd.addColorStop(0.45, '#a8bf66'); grd.addColorStop(1, '#4e6a2c');
  g.fillStyle = grd; g.fill();
  g.save(); g.clip();
  for (const sp of st.spots) { g.fillStyle = 'rgba(96,58,30,0.55)'; g.beginPath(); g.ellipse(lerp(bx, tx, sp.t) + sp.s * r0 * 0.6, lerp(by, ty, sp.t), sp.r * k, sp.r * k * 2.2, lean, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(60,80,30,0.6)'; g.lineWidth = Math.max(0.6, k * 0.007);
  for (const f of [-0.55, -0.1, 0.3, 0.65]) { g.beginPath(); g.moveTo(bx + f * r0, by); g.quadraticCurveTo(bx + f * r0 * 0.9 + mx, by - h * 0.5, tx + f * r1 * 1.3, ty); g.stroke(); }
  g.restore();
  g.strokeStyle = INK; g.lineWidth = Math.max(0.8, k * 0.012); g.stroke();
  if (b.blood > 0) { g.fillStyle = `rgba(120,10,12,${0.5 * b.blood})`; g.fill(); }
  // old leaves gone brown, hanging down the stem
  for (let i = 0; i < st.dead && grow > 0.8; i++) {
    const sd = i ? 1 : -1;
    g.save();
    g.translate(tx + sd * r1, ty + k * 0.03);
    g.rotate(sd * 0.25 + lean + Math.sin(time * 1.1 + i) * 0.03);
    g.fillStyle = i ? '#8a6a3a' : '#7a5a30'; g.strokeStyle = INK; g.lineWidth = Math.max(0.5, k * 0.006);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(sd * k * 0.06, k * 0.18, sd * k * 0.02, k * 0.42); g.lineTo(-sd * k * 0.03, k * 0.36); g.quadraticCurveTo(-sd * k * 0.01, k * 0.15, 0, 0); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(40,26,10,0.6)'; for (let j = 1; j < 5; j++) { g.beginPath(); g.moveTo(sd * k * 0.012 * j * 0.4, k * 0.08 * j); g.lineTo(-sd * k * 0.02, k * 0.08 * j + k * 0.03); g.stroke(); }
    g.restore();
  }
  // a hanging bunch on its curved stalk: hands of green fingers curling upward, the maroon bud below
  if (b.type === 2 && grow > 0.9) {
    const fx = tx + k * 0.16, fy = ty + k * 0.12;
    g.strokeStyle = INK; g.lineWidth = k * 0.028;
    g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + k * 0.2, ty - k * 0.05, fx + k * 0.04, fy + k * 0.55); g.stroke();
    g.strokeStyle = '#6d7f36'; g.lineWidth = k * 0.014; g.stroke();
    for (let i = 0; i < 5; i++) {
      const yy = fy + k * (0.04 + i * 0.075), xx = fx + k * (0.01 + i * 0.008), nn = 5 - Math.floor(i / 2);
      for (let j = 0; j < nn; j++) {
        const a = -0.9 + (j / Math.max(1, nn - 1)) * 1.8;
        g.save(); g.translate(xx + Math.sin(a) * k * 0.035, yy); g.rotate(a * 0.6);
        g.fillStyle = (i + j) % 2 ? '#8eaa3c' : '#a4bc4a'; g.strokeStyle = 'rgba(40,50,20,0.8)'; g.lineWidth = 0.6;
        g.beginPath(); g.moveTo(0, k * 0.02); g.quadraticCurveTo(-k * 0.022, -k * 0.02, k * 0.004, -k * 0.06); g.quadraticCurveTo(k * 0.02, -k * 0.02, 0, k * 0.02); g.fill(); g.stroke();
        g.restore();
      }
    }
    g.fillStyle = '#6d2a3a'; g.strokeStyle = INK; g.lineWidth = k * 0.008;
    g.beginPath(); g.moveTo(fx + k * 0.03, fy + k * 0.47); g.quadraticCurveTo(fx + k * 0.1, fy + k * 0.55, fx + k * 0.05, fy + k * 0.66); g.quadraticCurveTo(fx - k * 0.02, fy + k * 0.56, fx + k * 0.03, fy + k * 0.47); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(200,120,140,0.5)'; g.beginPath(); g.moveTo(fx + k * 0.045, fy + k * 0.5); g.lineTo(fx + k * 0.05, fy + k * 0.62); g.stroke();
  }
  // the leaves
  const lift = st.bob * k * 0.035;
  for (const L of st.leaves) {
    const a = L.a + lean * 1.2 + st.sway * 0.8 + Math.sin(time * 1.3 + L.ph) * 0.025;
    g.save();
    g.translate(tx, ty + lift * 0.4);
    g.rotate(a);
    const flip = Math.cos(a) < 0;
    if (flip) g.scale(1, -1);
    g.rotate((flip ? -1 : 1) * (L.sp + st.bob * 0.35) * 0.6);
    bananaLeaf(g, L.L * k * grow, L.W * k * grow, L.arch * k * grow, L.droop * k * grow, L.slits, L.yellow, (Math.abs(L.sp) * 0.25 + 0.01) * k * 0.2, time * 4 + L.ph);
    g.restore();
  }
  // the new leaf, still rolled up like a cigar, standing in the middle
  if (st.cigar && grow > 0.5) {
    g.save(); g.translate(tx, ty); g.rotate(lean * 1.2 + st.sway * 0.4);
    g.fillStyle = '#9cc85a'; g.strokeStyle = '#2a4a1c'; g.lineWidth = Math.max(0.5, k * 0.007);
    g.beginPath(); g.moveTo(-k * 0.018, 0); g.quadraticCurveTo(-k * 0.02, -k * 0.2, k * 0.004, -k * 0.32 * grow); g.quadraticCurveTo(k * 0.02, -k * 0.2, k * 0.018, 0); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(230,250,190,0.6)'; g.beginPath(); g.moveTo(-k * 0.005, -k * 0.02); g.quadraticCurveTo(-k * 0.006, -k * 0.16, k * 0.002, -k * 0.28 * grow); g.stroke();
    g.restore();
  }
  g.restore();
}
function drawBanana(g, b, sx, sy, k, alpha, time) {
  drawShadow(g, sx, sy, k * 0.32, k * 0.09, 0.8);
  if (b.cut) {
    const fall = b.fall, fade = clamp(7.5 - fall, 0, 1);
    // the stumps, cut clean: pale faces ringed darker
    for (const st of b.stems) {
      const bx = sx + st.ox * k, by = sy + st.oy * k * TILT, r = st.r * k * 1.3, hh = k * 0.2;
      const grd = g.createLinearGradient(bx - r, 0, bx + r, 0); grd.addColorStop(0, '#5e7a34'); grd.addColorStop(0.5, '#9cb35c'); grd.addColorStop(1, '#4e6a2c');
      g.fillStyle = grd; g.strokeStyle = INK; g.lineWidth = Math.max(0.7, k * 0.01);
      g.beginPath(); g.rect(bx - r, by - hh, r * 2, hh); g.fill(); g.stroke();
      g.fillStyle = '#d6dca8'; g.beginPath(); g.ellipse(bx, by - hh, r, r * 0.4, 0, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(120,140,70,0.8)'; g.lineWidth = 0.8;
      for (const f of [0.7, 0.45]) { g.beginPath(); g.ellipse(bx, by - hh, r * f, r * 0.4 * f, 0, 0, TAU); g.stroke(); }
    }
    if (fade > 0 && !b.shattered) {
      // the top topples over the cut and comes to rest propped on its leaves, with a little rebound
      const tf = Math.min(1, fall / 0.6), after = Math.max(0, fall - 0.6);
      const reb = after > 0 ? 0.07 * Math.exp(-5 * after) * Math.abs(Math.sin(after * 13)) : 0;
      const ang = b.fallDir * (Math.PI / 2) * 0.8 * tf * tf * (1 - reb);
      g.save();
      g.globalAlpha *= 0.4 * fade * tf;
      drawShadow(g, sx + b.fallDir * k * 0.55, sy + 2, k * 0.6, k * 0.12, 1);
      g.restore();
      g.save();
      g.globalAlpha *= fade;
      g.translate(sx, sy - k * 0.2);
      g.rotate(ang);
      for (const st of b.stems) drawBananaStem(g, b, Object.assign({}, st, { h: st.h - 0.2, oy: 0, dead: 0 }), 0, 0, k, 1, 1, time);
      g.restore();
    }
    if (b.regrow > 0) for (const st of b.stems) drawBananaStem(g, b, Object.assign({}, st, { dead: 0 }), sx, sy, k, Math.min(1, b.regrow / 9) * 0.6, 1, time);
    return;
  }
  const order = b.stems.slice().sort((a, c) => a.oy - c.oy);
  for (const st of order) drawBananaStem(g, b, st, sx, sy, k, b.grow, alpha, time);
}

// ---------------- litter: palm fronds, banana slices and leaves lying about ----------------
function tickFlora(w, dt, movers) {
  for (const c of w.palms) {
    const acc = -16 * c.bend - 2.2 * c.bendV;
    c.bendV += acc * dt;
    c.bend = clamp(c.bend + c.bendV * dt, -0.6, 0.6);
    c.swingV += (-26 * c.swing - 2.6 * c.swingV - acc * 0.045) * dt;
    c.swing = clamp(c.swing + c.swingV * dt, -0.6, 0.6);
  }
  const L = w.litter || (w.litter = []);
  const born = [];
  for (const f of L) {
    f.age += dt;
    if (f.z > 0 || f.vz > 0) {
      f.vz -= (f.flutter ? 5 : 9) * dt;
      if (f.flutter && f.vz < -1.4) f.vz = -1.4; // light: the air holds it up
      f.z += f.vz * dt;
      if (f.z <= 0) { f.z = 0; f.vz = 0; f.vr *= 0.3; f.vx *= 0.5; f.vy *= 0.5; }
    } else {
      const fr = Math.exp(-5 * dt);
      f.vx *= fr; f.vy *= fr; f.vr *= Math.exp(-6 * dt);
      // walked into: shoved along the way he's going, swinging round a little
      for (const m of movers) {
        if (m.air || !m.moving) continue;
        const r = (f.len || 0.2) * 0.42 + 0.12, d = Math.hypot(m.x - f.x, m.y - f.y), sp = Math.hypot(m.vx || 0, m.vy || 0);
        if (d > r || sp < 0.15) continue;
        const kk = Math.min(1, dt * 7) * (1 - d / r);
        f.vx += ((m.vx || 0) * 0.9 - f.vx) * kk; f.vy += ((m.vy || 0) * 0.9 - f.vy) * kk;
        f.vr += (m.x < f.x ? 1 : -1) * sp * 2 * kk;
      }
    }
    const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
    if (w.preview || onLand(w, nx, ny)) { f.x = nx; f.y = ny; } else { f.vx = f.vy = 0; }
    f.rot += f.vr * dt;
  }
  if (born.length) L.push(...born);
  if (L.some((f) => f.age > f.life)) w.litter = L.filter((f) => f.age <= f.life);
}
// a blow near the ground: hacks lying fronds in two, chops a fallen banana top, sets litter flying
function floraBlow(w, x, y, r, power) {
  for (const b of w.bananas) {
    if (!b.cut || b.shattered || b.fall < 0.6 || b.fall > 7.4) continue;
    if (Math.hypot(b.x + b.fallDir * 0.55 - x, b.y - y) < r + 0.35) shatterBanana(w, b);
  }
  const L = w.litter || [];
  const add = [];
  for (const f of L) {
    if (f.z > 0.05) continue;
    const d = Math.hypot(f.x - x, (f.y - y) / 0.7);
    if (d > r + (f.len || 0.2) * 0.4) continue;
    if (f.kind === 'frond' && f.len > 0.18 && w.time - f.hackT > 0.3) {
      f.hackT = w.time; f.len *= 0.55;
      const a = Math.random() * TAU;
      add.push(Object.assign({}, f, { x: f.x + Math.cos(a) * f.len * 0.5, y: f.y + Math.sin(a) * f.len * 0.3, vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 0.7, vz: 1.2, z: 0.02, rot: f.rot + 1 + Math.random(), vr: (Math.random() - 0.5) * 12, seed: Math.random() * 1e3 }));
      f.vx -= Math.cos(a) * 1.2; f.vy -= Math.sin(a) * 0.6; f.vz = 0.8; f.z = 0.01;
      addFx(w, { k: 'leafBits', x: f.x, y: f.y, z: 0.05, t: 0, dur: 1.2, seed: Math.random() * 1e3, n: 8, col: 'green' });
    } else {
      const a = Math.atan2(f.y - y, f.x - x);
      f.vx = Math.cos(a) * 1.2 * power; f.vy = Math.sin(a) * 0.6 * power; f.vz = 1 + Math.random() * power; f.z = 0.01; f.vr = (Math.random() - 0.5) * 10;
    }
  }
  if (add.length) L.push(...add);
}
function drawLitter(g, f, k) {
  const [px, py] = w2s(f.x, f.y);
  const a = clamp((f.life - f.age) / 3, 0, 1);
  if (a <= 0) return;
  g.save();
  g.globalAlpha *= a;
  if (f.z > 0.02) drawShadow(g, px, py, k * (f.len || 0.2) * 0.35, k * 0.05, 0.4);
  g.translate(px, py - f.z * k);
  g.scale(1, f.z > 0.02 ? 1 : 0.62); // flat on the ground: seen at the slant
  g.rotate(f.rot);
  if (f.kind === 'frond') {
    const Lp = f.len * k;
    const green = [72 + f.dry * 50, 108 - f.dry * 14, 44 + f.dry * 6];
    const col = (m) => `rgb(${Math.round(green[0] * m)},${Math.round(green[1] * m)},${Math.round(green[2] * m)})`;
    g.lineCap = 'round';
    const n = Math.max(6, Math.round(f.len * 22)), bow = Lp * 0.06;
    for (let i = 1; i < n; i++) {
      const t = i / n, qx = -Lp / 2 + Lp * t, qy = Math.sin(t * Math.PI) * bow;
      const ll = Lp * 0.15 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.6);
      for (const sg of [-1, 1]) {
        const r = ((f.seed * 13 + i * 7 + (sg > 0 ? 3 : 0)) % 10) / 10;
        if (r < 0.06) continue;
        g.strokeStyle = col(sg > 0 ? 1.08 : 0.82); g.lineWidth = Math.max(0.6, k * 0.01);
        g.beginPath(); g.moveTo(qx, qy); g.quadraticCurveTo(qx + ll * 0.25, qy + sg * ll * 0.55, qx + ll * 0.55, qy + sg * ll * (0.9 + r * 0.2)); g.stroke();
      }
    }
    g.strokeStyle = col(0.62); g.lineWidth = Math.max(1, k * 0.02);
    g.beginPath(); g.moveTo(-Lp / 2, 0); g.quadraticCurveTo(0, bow * 2, Lp / 2, 0); g.stroke();
    g.strokeStyle = col(1.25); g.lineWidth = Math.max(0.6, k * 0.008); g.stroke();
  } else if (f.kind === 'slice') {
    const r = k * 0.065;
    g.fillStyle = '#6e8a3c'; g.strokeStyle = INK; g.lineWidth = Math.max(0.6, k * 0.008);
    g.beginPath(); g.ellipse(0, r * 0.25, r, r * 0.55, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#d6dca8'; g.beginPath(); g.ellipse(0, 0, r, r * 0.55, 0, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(120,140,70,0.8)'; g.lineWidth = 0.7;
    for (const s of [0.68, 0.4]) { g.beginPath(); g.ellipse(0, 0, r * s, r * 0.55 * s, 0, 0, TAU); g.stroke(); }
  } else {
    bananaLeaf(g, k * 0.42, k * 0.07, 0, k * 0.02, [{ t: 0.4, side: 1 }, { t: 0.7, side: -1 }], 0, 0, 0);
  }
  g.restore();
}

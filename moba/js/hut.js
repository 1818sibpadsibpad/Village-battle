'use strict';
// ===== field huts that can be wrecked =====
// Every part of a hut is its own piece: six stilts, the body (floor), the woven walls, the two halves of the
// thatched roof, two side awnings on four posts, and the ladder. Posts snap when struck or when somebody is
// thrown into them; an awning that loses one post sags on that corner, with both gone it swings off and falls;
// lose too many stilts and the floor drops and everything on it comes down, each piece in its own time.
// Whatever comes down lies about as a loose piece that people kick along as they walk through it.
// Local units: x across (world units), y screen-down (world units at the screen's scale); (0,0) is the
// front of the hut on the ground. The back row stands D higher on screen (0.5 world units further back).

const HUT_FL = 0.58;            // floor height
const HUT_D = 0.5 * 0.74;       // the back row's offset on screen (0.5 world units back, through the slant)
const HUT_G = 9;                // gravity for falling pieces
const HUT_BIT_LIFE = 60;
const HUT_WY0 = -HUT_FL, HUT_WY1 = HUT_WY0 - 0.2; // the low woven wall and the railing round the veranda
const HUT_EY = -0.88, HUT_RY = -1.95;                // the big thatched roof: its eave hangs low over the veranda

function hutPart(k, i, extra) { return Object.assign({ k, i, state: 'up', t: 0, jig: 0, jigV: 0, drop: 0, dropV: 0, dropTo: 0, release: -1 }, extra); }
function makeHut(x, y, flip, seed) {
  const h = { x, y, flip, seed, sag: 0, sagV: 0, sagTo: 0, sagX: 0, sink: 0, collapsed: false, t: 0 };
  h.stilts = [];
  [-0.66, 0, 0.66].forEach((lx, c) => h.stilts.push(hutPart('stilts', h.stilts.length, { lx, ly: 0, row: 1, col: c - 1, top: -HUT_FL, wd: 0.06 })));
  [-0.56, 0.06, 0.68].forEach((lx, c) => h.stilts.push(hutPart('stilts', h.stilts.length, { lx, ly: -HUT_D, row: 0, col: c - 1, top: -HUT_FL - HUT_D, wd: 0.05 })));
  h.aposts = [];
  for (const side of [-1, 1]) {
    // the corner poles of the roof frame: the back ones stand up past the ridge
    h.aposts.push(hutPart('aposts', h.aposts.length, { side, row: 1, lx: side * 1.04, ly: 0, top: HUT_EY - 0.16, wd: 0.04 }));
    h.aposts.push(hutPart('aposts', h.aposts.length, { side, row: 0, lx: side * 0.98, ly: -HUT_D * 0.9, top: HUT_RY - 0.12, wd: 0.036 }));
  }
  h.awnings = [-1, 1].map((side, i) => hutPart('awnings', i, { side, hx: side * 0.97, hy: -1.3 }));
  h.walls = [0, 1].map((i) => hutPart('walls', i, {}));
  h.mains = [0, 1].map((i) => hutPart('mains', i, {}));
  h.body = hutPart('body', 0, {});
  h.ladder = hutPart('ladder', 0, {});
  // where each post stands on the ground (world)
  const fx = flip ? -1 : 1;
  for (const p of h.stilts.concat(h.aposts)) { p.x = x + p.lx * fx; p.y = y + p.ly / 0.74; }
  return h;
}
function hutParts(h) { return h.stilts.concat(h.aposts, h.awnings, h.walls, h.mains, [h.body, h.ladder]); }

// ---------- the pictures of the parts, drawn once at the current zoom ----------
function hutPic(res, x0, y0, x1, y1, draw) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.ceil((x1 - x0) * res)); c.height = Math.max(2, Math.ceil((y1 - y0) * res));
  const g = c.getContext('2d');
  g.scale(res, res); g.translate(-x0, -y0);
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  return { c, x0, y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
function hutBamboo(g, x0, y0, x1, y1, wd, col) {
  g.strokeStyle = INK; g.lineWidth = wd + 0.025; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.strokeStyle = col; g.lineWidth = wd; g.stroke();
  g.strokeStyle = 'rgba(255,240,200,0.25)'; g.lineWidth = wd * 0.3; g.beginPath(); g.moveTo(x0 - wd * 0.2, y0); g.lineTo(x1 - wd * 0.2, y1); g.stroke();
  g.strokeStyle = 'rgba(40,28,14,0.6)'; g.lineWidth = 0.012;
  for (let t = 0.2; t < 1; t += 0.27) { const x = lerp(x0, x1, t), y = lerp(y0, y1, t); g.beginPath(); g.moveTo(x - wd * 0.55, y); g.lineTo(x + wd * 0.55, y); g.stroke(); }
}
// thatch of fine straw: shingled rows of strands, each row's ragged edge lapping over the one below
const STRAW = ['#c9a868', '#b8955a', '#a6844c', '#8e6e3c', '#d6b97a', '#7a5c32'];
function hutThatch(g, R, poly, rows = 9) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const xa = Math.min(...xs), xb = Math.max(...xs), ya = Math.min(...ys), yb = Math.max(...ys);
  g.save();
  g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  g.fillStyle = '#9a7a46'; g.fill();
  g.clip();
  const rh = (yb - ya) / rows;
  for (let r = 0; r < rows; r++) {
    const y0 = ya + r * rh, y1 = y0 + rh * 1.25;
    g.fillStyle = 'rgba(60,40,18,0.35)'; g.fillRect(xa - 0.2, y0 - 0.01, xb - xa + 0.4, rh * 0.3);
    for (let x = xa - 0.1; x < xb + 0.1; x += 0.0065) {
      const len = rh * (0.75 + R() * 0.55), tilt = (R() - 0.5) * 0.02;
      g.strokeStyle = STRAW[Math.floor(R() * STRAW.length)];
      g.lineWidth = 0.004 + R() * 0.004;
      g.beginPath(); g.moveTo(x, y0 + R() * 0.02); g.lineTo(x + tilt, y0 + len); g.stroke();
    }
    // the ragged lower edge of this row, a few strands longer than the rest
    for (let x = xa; x < xb; x += 0.018) { g.strokeStyle = STRAW[Math.floor(R() * STRAW.length)]; g.lineWidth = 0.004; g.beginPath(); g.moveTo(x, y1 - rh * 0.3); g.lineTo(x + (R() - 0.5) * 0.015, y1 + R() * 0.03); g.stroke(); }
    g.fillStyle = 'rgba(255,240,200,0.08)'; g.fillRect(xa - 0.2, y0 + rh * 0.3, xb - xa + 0.4, rh * 0.2);
  }
  g.restore();
  g.strokeStyle = 'rgba(40,28,12,0.85)'; g.lineWidth = 0.014;
  g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
}
// a fringe of loose straw hanging off an edge
function hutFringe(g, R, x0, x1, y, n, long = 0.08) {
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, i / (n - 1)) + (R() - 0.5) * 0.01;
    g.strokeStyle = STRAW[Math.floor(R() * STRAW.length)]; g.lineWidth = 0.004 + R() * 0.003;
    g.beginPath(); g.moveTo(x, y - 0.03); g.lineTo(x + (R() - 0.5) * 0.025, y + 0.015 + R() * long); g.stroke();
  }
}
function buildHutPics(h, res) {
  const R = mulberry32(h.seed);
  const P = { stilts: [], aposts: [], awnings: [], walls: [], mains: [] };
  for (const s of h.stilts) P.stilts.push(hutPic(res, s.lx - 0.06, s.top - 0.04, s.lx + 0.06, s.ly + 0.02, (g) => hutBamboo(g, s.lx, s.ly, s.lx, s.top, s.wd, s.row ? '#c2a466' : '#8e7444')));
  for (const s of h.aposts) P.aposts.push(hutPic(res, s.lx - 0.06, s.top - 0.04, s.lx + 0.06, s.ly + 0.02, (g) => hutBamboo(g, s.lx, s.ly, s.lx + s.side * 0.03, s.top, s.wd, s.row ? '#c8aa6c' : '#a08452')));
  // the side panels: thatch hanging steeply down off each end of the roof
  for (const a of h.awnings) {
    const sd = a.side;
    const poly = [[sd * 0.95, -1.78], [sd * 0.98, -0.95], [sd * 1.2, -0.42], [sd * 1.16, -1.25]];
    const xs = poly.map((p) => p[0]);
    P.awnings.push(hutPic(res, Math.min(...xs) - 0.06, -1.85, Math.max(...xs) + 0.06, -0.3, (g) => {
      g.save(); g.translate(sd * 1.08, -1.1); g.transform(1, sd * -0.45, 0, 1, 0, 0); g.translate(-sd * 1.08, 1.1);
      hutThatch(g, R, poly.map(([x, y]) => [x, y + sd * 0.45 * (x - sd * 1.08)]), 7);
      g.restore();
      hutFringe(g, R, Math.min(sd * 1.2, sd * 0.98), Math.max(sd * 1.2, sd * 0.98), -0.45, 14, 0.06);
      hutBamboo(g, sd * 0.97, -1.7, sd * 1.18, -0.55, 0.022, '#c8aa6c');
    }));
  }
  // the raised floor: planks, the veranda with a red mat and bowls, X-braces between the stilts below it
  P.body = hutPic(res, -0.86, -HUT_FL - HUT_D - 0.05, 0.9, 0.0, (g) => {
    const FL = HUT_FL, D = HUT_D;
    for (const [a, b] of [[-0.66, 0], [0, 0.66]]) {
      g.strokeStyle = '#8e7444'; g.lineWidth = 0.022;
      g.beginPath(); g.moveTo(a, -FL + 0.04); g.lineTo(b, -0.06); g.moveTo(b, -FL + 0.04); g.lineTo(a, -0.06); g.stroke();
    }
    g.beginPath(); g.moveTo(-0.78, -FL); g.lineTo(0.78, -FL); g.lineTo(0.84, -FL - D); g.lineTo(-0.72, -FL - D); g.closePath();
    g.fillStyle = '#a07a46'; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.02; g.stroke();
    g.strokeStyle = 'rgba(70,48,22,0.6)'; g.lineWidth = 0.008;
    for (let x = -0.72; x < 0.8; x += 0.055) { g.beginPath(); g.moveTo(x, -FL); g.lineTo(x + 0.06, -FL - D); g.stroke(); }
    // the red mat with three bowls on it
    g.fillStyle = '#c0503c'; g.beginPath(); g.moveTo(0.02, -FL - 0.05); g.lineTo(0.48, -FL - 0.05); g.lineTo(0.52, -FL - 0.3); g.lineTo(0.06, -FL - 0.3); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,30,20,0.6)'; g.lineWidth = 0.008; g.stroke();
    for (const [bx, by, c] of [[0.14, -FL - 0.2, '#8ac0a8'], [0.36, -FL - 0.23, '#e090a0'], [0.24, -FL - 0.11, '#f0ece0']]) { g.fillStyle = c; g.strokeStyle = INK; g.lineWidth = 0.008; g.beginPath(); g.ellipse(bx, by, 0.035, 0.018, 0, 0, TAU); g.fill(); g.stroke(); }
    g.fillStyle = '#6e5232'; g.strokeStyle = INK; g.lineWidth = 0.018;
    g.beginPath(); g.rect(-0.8, -FL, 1.6, 0.05); g.fill(); g.stroke();
  });
  // a low woven wall on the left of the veranda, the bamboo railing on the right
  P.walls.push(hutPic(res, -0.84, HUT_WY1 - 0.05, -0.08, HUT_WY0 + 0.02, (g) => {
    g.beginPath(); g.rect(-0.78, HUT_WY1, 0.66, HUT_WY0 - HUT_WY1); g.fillStyle = '#b8955a'; g.fill();
    g.save(); g.clip(); g.strokeStyle = 'rgba(120,88,44,0.8)'; g.lineWidth = 0.012;
    for (let x = -1.3; x < 0; x += 0.04) { g.beginPath(); g.moveTo(x, HUT_WY0); g.lineTo(x + 0.2, HUT_WY1); g.stroke(); g.beginPath(); g.moveTo(x, HUT_WY1); g.lineTo(x + 0.2, HUT_WY0); g.stroke(); }
    g.restore(); g.strokeStyle = INK; g.lineWidth = 0.016; g.strokeRect(-0.78, HUT_WY1, 0.66, HUT_WY0 - HUT_WY1);
  }));
  P.walls.push(hutPic(res, 0.2, HUT_WY1 - 0.06, 0.84, HUT_WY0 + 0.02, (g) => {
    hutBamboo(g, 0.26, HUT_WY1, 0.8, HUT_WY1 - 0.02, 0.022, '#d8bc7c');
    hutBamboo(g, 0.26, HUT_WY1 + 0.1, 0.8, HUT_WY1 + 0.08, 0.016, '#c8aa6c');
    for (let x = 0.26; x <= 0.8; x += 0.09) hutBamboo(g, x, HUT_WY0, x, HUT_WY1 - 0.01, 0.018, '#d0b474');
  }));
  // the big roof of fine thatch in two halves, battens tied across it, rafters under it showing through
  const ex0 = -1.0, ex1 = 1.02, rx0 = -0.9, rx1 = 0.94, mid = 0.01;
  for (const [i, ea, ra, eb, rb] of [[0, ex0, rx0, mid, mid], [1, mid, mid, ex1, rx1]]) {
    P.mains.push(hutPic(res, Math.min(ea, ra) - 0.06, HUT_RY - 0.1, Math.max(eb, rb) + 0.06, HUT_EY + 0.14, (g) => {
      hutThatch(g, R, [[ea, HUT_EY], [eb, HUT_EY], [rb, HUT_RY], [ra, HUT_RY]], 10);
      hutFringe(g, R, ea, eb, HUT_EY, 90, 0.1);
      // the ridge: a bundled roll of straw
      g.strokeStyle = '#7a5c32'; g.lineWidth = 0.05; g.beginPath(); g.moveTo(ra - 0.02, HUT_RY + 0.01); g.lineTo(rb + 0.02, HUT_RY + 0.01); g.stroke();
      hutFringe(g, R, ra, rb, HUT_RY + 0.02, 40, 0.05);
      // battens tied across, and the rafters
      for (const t of [0.34, 0.68]) { const y = lerp(HUT_EY, HUT_RY, t), xa = lerp(ea, ra, t), xb = lerp(eb, rb, t); hutBamboo(g, xa - 0.02, y, xb + 0.02, y - 0.01, 0.022, '#d8bc7c'); }
      for (const t of i === 0 ? [0.12, 0.62] : [0.4, 0.9]) hutBamboo(g, lerp(ea, eb, t), HUT_EY + 0.02, lerp(ra, rb, t), HUT_RY - 0.03, 0.018, '#ccae70');
    }));
  }
  // the ladder up to the veranda
  P.ladder = hutPic(res, -0.25, -HUT_FL - 0.08, 0.3, 0.12, (g) => {
    const lx = -0.12;
    for (const o of [0, 0.2]) hutBamboo(g, lx + o + 0.04, 0.08, lx + o - 0.02, -HUT_FL - 0.02, 0.026, '#c8aa6c');
    for (let i = 1; i < 6; i++) { const t = i / 6; hutBamboo(g, lx + 0.04 - 0.06 * t, 0.08 - (HUT_FL + 0.1) * t, lx + 0.24 - 0.06 * t, 0.08 - (HUT_FL + 0.1) * t, 0.014, '#b8955a'); }
  });
  h.pics = P;
}
function picOf(h, k, i) { return k === 'body' || k === 'ladder' ? h.pics[k] : h.pics[k][i]; }

// ---------- how a standing part sits right now (a 2x3 matrix in local units) ----------
const mMul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const mRot = (a, cx, cy) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]; };
const mApply = (M, x, y) => ({ x: M[0] * x + M[2] * y + M[4], y: M[1] * x + M[3] * y + M[5] });
function sagM(h) { const R = mRot(h.sag, h.sagX, -HUT_FL); R[5] += h.sink; return R; }
function hutPartM(h, p) {
  if (p.k === 'stilts' || p.k === 'aposts') return mRot(p.jig, p.lx, p.ly);
  if (p.k === 'awnings') return mMul(sagM(h), mRot(p.side * p.drop * 0.6 + p.jig, p.hx, p.hy));
  const pic = picOf(h, p.k, p.i);
  return mMul(sagM(h), mRot(p.jig * (p.k === 'body' ? 0.3 : 1), pic.cx, pic.cy));
}

// ---------- coming apart ----------
function strawBurst(w, x, y, n, z = 0.3) {
  addFx(w, { k: 'leafBits', x, y, z, t: 0, dur: 1.4, seed: Math.random() * 1e3, n, col: 'straw' });
}
function kickHut(h, power) {
  for (const p of hutParts(h)) {
    if (p.state === 'gone') continue;
    const wt = p.k === 'body' ? 0.3 : p.k === 'mains' ? 0.6 : 1;
    p.jigV += (Math.random() - 0.5) * 2 * power * wt * (0.6 + Math.random() * 0.8);
  }
}
// a standing part comes loose and falls from where it is now, landing at local (landX) on the ground row landY
function releasePart(w, h, p, landX, landRow, sqTo, rotTo, life = HUT_BIT_LIFE) {
  const pic = picOf(h, p.k, p.i);
  const fx = h.flip ? -1 : 1;
  const M = hutPartM(h, p);
  const now = mApply(M, pic.cx, pic.cy);
  const gy = landRow * HUT_D;            // the ground line it comes down on (local screen y)
  const z0 = Math.max(0.03, gy - now.y);
  const tf = Math.sqrt((2 * z0) / HUT_G);
  const thatch = p.k === 'awnings' || p.k === 'mains';
  p.state = 'gone'; p.t = 0;
  const heavy = p.k === 'body';
  w.hutBits.push({
    hut: h, k: p.k, i: p.i, x: h.x + now.x * fx, y: h.y + gy / 0.74, z: z0,
    vx: ((landX - now.x) * fx) / tf, vy: 0, vz: 0, rot: 0, vr: rotTo / tf, rotTo, sq: 1, sqTo, z0,
    m0: [M[0], M[1], M[2], M[3]], age: 0, life, mass: heavy ? 400 : p.k === 'mains' ? 4 : thatch || p.k === 'walls' ? 2.5 : 1,
    r: heavy ? 0.5 : p.k === 'mains' ? 0.42 : thatch || p.k === 'walls' ? 0.3 : 0.12, thatch, landed: false, hitCD: 0,
  });
  if (thatch) strawBurst(w, h.x + now.x * fx, h.y + gy / 0.74, 8, z0);
}
// a post snaps: the stump stays, the rest topples over the way it was struck
function breakPost(w, h, p, dir) {
  if (p.state === 'gone') return;
  const fx = h.flip ? -1 : 1;
  const ld = (dir >= 0 ? 1 : -1) * fx; // which way it falls, in the hut's own (unflipped) frame
  const pic = picOf(h, p.k, p.i);
  const len = p.ly - p.top;
  p.state = 'gone'; p.t = 0;
  // the broken length topples from the stump
  w.hutBits.push({
    hut: h, k: p.k, i: p.i, x: p.x, y: p.y + 0.01, z: len * 0.5 + 0.06,
    vx: ld * fx * len * 0.9, vy: (Math.random() - 0.5) * 0.4, vz: 0.4, rot: 0, vr: ld * 5, rotTo: ld * Math.PI * 0.47, sq: 1, sqTo: 0.85, z0: len * 0.5,
    m0: null, age: 0, life: HUT_BIT_LIFE, mass: 1, r: 0.14, thatch: false, landed: false, hitCD: 0, post: true, cxOff: pic.cx - p.lx,
  });
  addFx(w, { k: 'spark', x: p.x, y: p.y, z: 0.15, t: 0, dur: 0.3, seed: Math.random() * 1e3 });
  addFx(w, { k: 'leafBits', x: p.x, y: p.y, z: 0.15, t: 0, dur: 1.0, seed: Math.random() * 1e3, n: 5, col: 'straw' });
  sfxAt('wood', p.x, p.y, 0.9, 1.15);
  kickHut(h, 1.2);
  settleHut(w, h);
}
function collapseHut(w, h, side) {
  if (h.collapsed) return;
  h.collapsed = true; h.t = 0;
  const sd = side || (Math.random() < 0.5 ? -1 : 1);
  for (const s of h.stilts) if (s.state !== 'gone') breakPost(w, h, s, sd * (h.flip ? -1 : 1) * (Math.random() < 0.7 ? 1 : -1));
  const lean = sd * (0.06 + Math.random() * 0.08);
  releasePart(w, h, h.body, picOf(h, 'body', 0).cx + sd * 0.05, -0.5, 0.86, lean);
  h.ladder.release = 0.05 + Math.random() * 0.1;
  for (const m of h.mains) { m.release = 0.06 + Math.random() * 0.22; m.landX = picOf(h, 'mains', m.i).cx + sd * (0.05 + Math.random() * 0.12) + (Math.random() - 0.5) * 0.14; m.landRow = m.i === 0 ? -0.8 : -0.4; }
  for (const wl of h.walls) { wl.release = Math.random() * 0.15; wl.landX = picOf(h, 'walls', wl.i).cx + sd * (0.04 + Math.random() * 0.1); wl.landRow = -0.2 - Math.random() * 0.4; }
  for (const a of h.awnings) if (a.state !== 'gone') a.release = a.side === sd ? Math.random() * 0.08 : 0.15 + Math.random() * 0.25;
  addFloater(w, h.x, h.y - 1.4, 'บ้านพัง!', '#ffd08a', 1.3);
  sfxAt('crack', h.x, h.y, 1);
  w.shake = Math.max(w.shake || 0, 0.25);
  // anything stuck in it comes free; the walkways open up
  for (const p of w.proj) if (p.javelin && p.pinHut === h) {
    if (p.victim && !p.victim.dead) { p.victim.pinned = null; p.victim = null; }
    p.state = 'lying'; p.pinHut = null; p.x = p.gx != null ? p.gx : p.x; p.y = p.gy != null ? p.gy : p.y;
  }
  if (!w.preview && typeof buildNav === 'function') buildNav(w);
}
// how the hut stands on what is left of its stilts
function settleHut(w, h) {
  if (h.collapsed) return;
  const n = { l: 0, m: 0, r: 0, f: 0, b: 0, all: 0 };
  for (const s of h.stilts) {
    if (s.state !== 'gone') continue;
    n.all++;
    if (s.col < 0) n.l++; else if (s.col > 0) n.r++; else n.m++;
    if (s.row) n.f++; else n.b++;
  }
  const side = n.l > n.r ? -1 : n.r > n.l ? 1 : 0;
  if (n.all >= 4 || n.l === 2 || n.r === 2 || (n.m === 2 && n.l + n.r > 0) || n.f === 3 || n.b === 3) { collapseHut(w, h, side * (h.flip ? -1 : 1)); return; }
  // a stilt or two gone: it leans over toward them, creaking
  h.sagTo = 0.05 * (n.r - n.l);
  h.sagX = side ? -side * 0.6 : 0;
  h.sink = n.all * 0.025;
}
// a blow lands near a hut (a strike's circle, a thrown body, a weapon flying in)
function hutBlow(w, x, y, r, power, fromX) {
  if (!w.huts) return;
  for (const h of w.huts) {
    if (Math.abs(x - h.x) > 2.2 || Math.abs(y - h.y) > 1.5) continue;
    let hit = false;
    for (const p of h.stilts.concat(h.aposts)) {
      if (p.state === 'gone') continue;
      if (Math.hypot(p.x - x, p.y - y) < r + 0.1) { breakPost(w, h, p, p.x - fromX || 1); hit = true; }
    }
    if (!h.collapsed && Math.hypot(x - h.x, y - (h.y - 0.22)) < 1.1) { kickHut(h, 0.4 + power * 0.3); if (!hit) strawBurst(w, x, y, 3, 0.6); }
  }
  // loose pieces leap
  for (const b of w.hutBits) {
    if (b.z > 0.05 || b.mass >= 100) continue;
    const dx = b.x - x, dy = (b.y - y) / 0.6, d = Math.hypot(dx, dy);
    if (d > b.r + r) continue;
    const u = d > 1e-3 ? [dx / d, dy / d] : [1, 0];
    const sp = (1.4 + Math.random()) * power / Math.sqrt(b.mass);
    b.vx = u[0] * sp; b.vy = u[1] * sp * 0.6; b.vz = 1.2 + Math.random() * 1.2 * power; b.z = 0.02; b.landed = false; b.vr = (Math.random() - 0.5) * 8; b.z0 = 0; b.rotTo = null;
    if (b.thatch) strawBurst(w, b.x, b.y, 6, 0.1);
  }
}
function hutAtLive(w, x, y, pad = 0) {
  for (const h of w.huts) {
    if (h.collapsed) continue;
    const dx = (x - h.x) / (0.66 + pad), dy = (y - (h.y - 0.22)) / (0.36 + pad);
    if (dx * dx + dy * dy < 1) return h;
  }
  return null;
}

// ---------- every frame ----------
function tickHuts(w, dt, movers) {
  if (!w.hutBits) w.hutBits = [];
  for (const h of w.huts) {
    h.t += dt;
    const parts = hutParts(h);
    for (const p of parts) {
      p.t += dt;
      p.jigV += (-60 * p.jig - 6 * p.jigV) * dt;
      p.jig = clamp(p.jig + p.jigV * dt, -0.12, 0.12);
    }
    h.sagV += ((h.sagTo - h.sag) * 40 - 5 * h.sagV) * dt;
    h.sag += h.sagV * dt;
    // bodies thrown into a post snap it
    for (const m of movers) {
      if (!m.hurled) continue;
      for (const p of h.stilts.concat(h.aposts)) if (p.state !== 'gone' && Math.hypot(m.x - p.x, m.y - p.y) < 0.2) breakPost(w, h, p, m.vx || p.x - m.x);
    }
    // the side awnings: one post gone, that corner sags; both gone, it swings off and falls
    for (const a of h.awnings) {
      if (a.state === 'gone') continue;
      const ps = h.aposts.filter((p) => p.side === a.side);
      const goneN = ps.filter((p) => p.state === 'gone').length;
      if (a.state === 'up' && goneN === 1) { a.state = 'lean'; a.t = 0; a.dropTo = 0.18 + Math.random() * 0.1; a.dropV = 0; a.release = Math.random() < 0.55 ? -1 : 0.7 + Math.random() * 0.6; sfxAt('wood', h.x + a.side, h.y, 0.6, 0.8); }
      if (goneN === 2 && a.state !== 'hang' && a.release < 0) { a.state = 'hang'; a.t = 0; a.dropTo = 0.75 + Math.random() * 0.3; a.release = 0.3 + Math.random() * 0.2; }
      if (a.state === 'lean' || a.state === 'hang') {
        a.dropV += (a.state === 'hang' ? 9 : 14) * dt;
        a.drop += a.dropV * dt;
        if (a.drop > a.dropTo) { a.drop = a.dropTo; a.dropV = -a.dropV * 0.3; if (Math.abs(a.dropV) < 0.3) a.dropV = 0; else strawBurst(w, h.x + a.side * 1.2 * (h.flip ? -1 : 1), h.y, 3, 0.8); }
      }
      if (a.release >= 0) { a.release -= dt; if (a.release < 0) releasePart(w, h, a, a.side * 1.6, -0.3, 0.55, a.side * 0.25 + (Math.random() - 0.5) * 0.2); }
    }
    for (const p of h.mains.concat(h.walls)) {
      if (p.state === 'gone' || p.release < 0) continue;
      p.release -= dt;
      if (p.release < 0) releasePart(w, h, p, p.landX, p.landRow, p.k === 'mains' ? 0.62 : 0.6, (Math.random() < 0.5 ? -1 : 1) * (0.1 + Math.random() * 0.3));
    }
    if (h.ladder.state !== 'gone' && h.ladder.release >= 0) { h.ladder.release -= dt; if (h.ladder.release < 0) releasePart(w, h, h.ladder, 1.15, 0.2, 0.9, 1.3); }
  }
  // the loose pieces: falling, lying, kicked about
  for (const b of w.hutBits) {
    b.age += dt;
    b.hitCD = Math.max(0, b.hitCD - dt);
    if (!b.landed) {
      b.vz -= HUT_G * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.z = Math.max(0, b.z + b.vz * dt);
      b.rot += b.vr * dt;
      if (b.rotTo != null && Math.abs(b.rot) > Math.abs(b.rotTo)) { b.rot = b.rotTo; b.vr = 0; }
      const u = b.z0 > 0 ? Math.min(1, b.z / b.z0) : 0;
      b.sq = b.sqTo + (1 - b.sqTo) * u;
      if (b.m0 && u <= 0.001) b.m0 = null;
      if (b.z === 0 && b.vz < 0) {
        if (b.vz < -2.2 && b.mass < 100) { b.vz = -b.vz * 0.22; b.vx *= 0.5; b.vy *= 0.5; b.vr *= 0.4; }
        else {
          b.vz = 0; b.landed = true; b.m0 = null; b.sq = b.sqTo; if (b.rotTo != null) b.rot = b.rotTo; b.vr = 0;
          if (b.mass >= 100) b.vx = b.vy = 0; else { b.vx *= 0.3; b.vy *= 0.3; }
        }
        if (b.thatch) strawBurst(w, b.x, b.y, b.k === 'mains' ? 12 : 6, 0.1);
        dust(w, b.x, b.y, b.mass > 2 ? 4 : 1, b.mass > 2 ? 1.6 : 0.8);
        if (b.mass > 2) { sfxAt('wood', b.x, b.y, 0.7, 0.55); w.shake = Math.max(w.shake || 0, b.mass >= 100 ? 0.18 : 0.06); }
      }
      continue;
    }
    const fr = Math.exp(-5 * dt);
    b.vx *= fr; b.vy *= fr; b.vr *= fr;
    if (Math.abs(b.vx) + Math.abs(b.vy) > 0.002) {
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      if (w.preview || onLand(w, nx, ny)) { b.x = nx; b.y = ny; } else b.vx = b.vy = 0;
    }
    b.rot += b.vr * dt;
  }
  // feet push the lying pieces along (light ones more), each turning a little its own way
  for (const m of movers) {
    if (m.air || !m.moving) continue;
    const sp = Math.hypot(m.vx || 0, m.vy || 0);
    if (sp < 0.05) continue;
    for (const b of w.hutBits) {
      if (!b.landed || b.mass >= 100) continue;
      const dx = b.x - m.x, dy = (b.y - m.y) / 0.6, d = Math.hypot(dx, dy);
      const reach = b.r + 0.07;
      if (d > reach) continue;
      const kk = Math.min(1, (dt * 14) / b.mass);
      b.vx += (m.vx * 1.05 - b.vx) * kk;
      b.vy += (m.vy * 1.05 - b.vy) * kk;
      const push = ((reach - d) / reach) * 0.8 * dt * 6;
      b.vx += ((dx / (d || 1)) * push) / b.mass;
      b.vy += ((dy / (d || 1)) * push * 0.6) / b.mass;
      b.vr += (((dx * m.vy - dy * m.vx) / (d || 1)) * 3 * dt) / b.mass;
      b.age = Math.min(b.age, b.life - 3);
    }
  }
  if (w.hutBits.some((b) => b.age > b.life)) w.hutBits = w.hutBits.filter((b) => b.age <= b.life);
}

// ---------- drawing ----------
function drawHutPart(g, h, p, alpha) {
  const pic = picOf(h, p.k, p.i);
  if (p.state === 'gone') {
    if (p.k !== 'stilts' && p.k !== 'aposts') return;
    // the stump left standing, splintered at the break
    const by = p.ly - (p.ly - p.top) * 0.2;
    g.save();
    g.beginPath(); g.rect(pic.x0 - 0.02, by, pic.w + 0.04, p.ly - by + 0.04); g.clip();
    g.drawImage(pic.c, pic.x0, pic.y0, pic.w, pic.h);
    g.restore();
    g.strokeStyle = '#d8c08a'; g.lineWidth = 0.012;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(p.lx + i * 0.012, by + 0.01); g.lineTo(p.lx + i * 0.016, by - 0.03 - Math.abs(i) * 0.008); g.stroke(); }
    return;
  }
  g.save();
  const M = hutPartM(h, p);
  g.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
  g.drawImage(pic.c, pic.x0, pic.y0, pic.w, pic.h);
  g.restore();
}
function drawHut(g, h, sx, sy, k, alpha) {
  if (!h.pics) return;
  g.save();
  g.translate(sx, sy);
  g.scale(h.flip ? -k : k, k);
  // the shade under it goes as the house comes down
  const sh = h.collapsed ? Math.max(0.15, 1 - h.t * 1.5) : 1;
  g.save(); g.globalAlpha *= 0.42 * sh; g.translate(0.1, -0.18); g.scale(1, 0.55);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 1.25); grd.addColorStop(0, 'rgba(10,28,10,1)'); grd.addColorStop(0.6, 'rgba(10,28,10,0.6)'); grd.addColorStop(1, 'rgba(10,28,10,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 1.25, 0, TAU); g.fill(); g.restore();
  g.globalAlpha *= alpha;
  // the hearth out front: a clay stove with its fire, a thread of smoke
  g.save();
  g.fillStyle = '#9a5a3a'; g.strokeStyle = INK; g.lineWidth = 0.018;
  g.beginPath(); g.rect(-1.12, 0.12, 0.26, 0.16); g.fill(); g.stroke();
  g.fillStyle = '#7a4028'; g.beginPath(); g.moveTo(-1.12, 0.12); g.lineTo(-0.86, 0.12); g.lineTo(-0.9, 0.06); g.lineTo(-1.08, 0.06); g.closePath(); g.fill(); g.stroke();
  const fl = 0.5 + 0.5 * Math.sin(performance.now() / 90);
  g.fillStyle = `rgba(255,${140 + 50 * fl},40,0.9)`; g.beginPath(); g.ellipse(-0.99, 0.24, 0.05, 0.022, 0, 0, TAU); g.fill();
  if (!h.collapsed) {
    const now = performance.now() / 1000;
    for (let i = 0; i < 5; i++) { const u = (now * 0.35 + i / 5) % 1; g.fillStyle = `rgba(220,220,210,${0.22 * (1 - u)})`; g.beginPath(); g.arc(-0.99 + Math.sin(u * 5 + i) * 0.05, 0.05 - u * 0.9, 0.04 + u * 0.08, 0, TAU); g.fill(); }
  }
  g.restore();
  for (const p of h.aposts) if (!p.row) drawHutPart(g, h, p);
  const far = h.flip ? 1 : -1;
  for (const a of h.awnings.slice().sort((a, b) => (a.side === far ? -1 : 0) - (b.side === far ? -1 : 0))) if (a.state !== 'gone') drawHutPart(g, h, a);
  for (const p of h.stilts) if (!p.row) drawHutPart(g, h, p);
  if (h.body.state !== 'gone') {
    // shade under the floor
    g.save(); const M = sagM(h); g.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
    g.fillStyle = 'rgba(20,16,10,0.45)'; g.beginPath(); g.moveTo(-0.72, -HUT_FL); g.lineTo(0.72, -HUT_FL); g.lineTo(0.78, -HUT_FL - HUT_D); g.lineTo(-0.66, -HUT_FL - HUT_D); g.closePath(); g.fill();
    g.restore();
  }
  for (const p of h.stilts) if (p.row) drawHutPart(g, h, p);
  if (h.body.state !== 'gone') drawHutPart(g, h, h.body);
  for (const p of h.walls) if (p.state !== 'gone') drawHutPart(g, h, p);
  for (const p of h.mains) if (p.state !== 'gone') drawHutPart(g, h, p);
  for (const p of h.aposts) if (p.row) drawHutPart(g, h, p);
  if (h.ladder.state !== 'gone') drawHutPart(g, h, h.ladder);
  g.restore();
}
function drawHutBit(g, b, k) {
  const h = b.hut;
  if (!h.pics) return;
  const pic = picOf(h, b.k, b.i);
  const [sx, sy] = w2s(b.x, b.y);
  const fade = b.age > b.life - 3 ? Math.max(0, (b.life - b.age) / 3) : 1;
  if (fade <= 0) return;
  if (b.z > 0.01) drawShadow(g, sx, sy, pic.w * k * 0.35, pic.w * k * 0.1, 0.3 * fade);
  g.save();
  g.globalAlpha *= fade;
  g.translate(sx, sy - b.z * k);
  if (h.flip) g.scale(-1, 1);
  if (b.m0) { const u = b.z0 > 0 ? Math.min(1, b.z / b.z0) : 0; g.transform(1 + (b.m0[0] - 1) * u, b.m0[1] * u, b.m0[2] * u, 1 + (b.m0[3] - 1) * u, 0, 0); }
  g.scale(1, b.sq);
  g.rotate(b.rot);
  g.scale(k, k);
  if (b.post) {
    // a snapped post: the upper four-fifths, pivoting about its middle
    const p = b.k === 'stilts' ? h.stilts[b.i] : h.aposts[b.i];
    const top = p.top, by = p.ly - (p.ly - top) * 0.2, mid = (top + by) / 2;
    g.translate(-p.lx, -mid);
    g.beginPath(); g.rect(pic.x0 - 0.02, pic.y0, pic.w + 0.04, by - pic.y0); g.clip();
  } else g.translate(-pic.cx, -pic.cy);
  g.drawImage(pic.c, pic.x0, pic.y0, pic.w, pic.h);
  g.restore();
}

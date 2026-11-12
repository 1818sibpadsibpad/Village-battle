'use strict';
// ===== art: heroes, weapons, skill icons (drawn with code, in the style of the village-battle sprites) =====

let _shadow = null;
function shadowSprite() {
  if (_shadow) return _shadow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.32)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return (_shadow = c);
}
function drawShadow(g, x, y, rx, ry, a = 1) {
  if (a <= 0.01) return;
  const ga = g.globalAlpha;
  if (GFX[gfx].bit3) {
    // 3-bit: a hard contact shadow underfoot, and a long one thrown back by a low moon
    g.globalAlpha = ga * Math.min(1, a * 1.5);
    g.drawImage(shadowSprite(), x - rx * 0.9, y - ry * 0.9, rx * 1.8, ry * 1.8);
    g.globalAlpha = ga * Math.min(1, a * 1.1);
    g.save(); g.translate(x, y); g.transform(1, 0, -0.9, 1, 0, 0);
    g.drawImage(shadowSprite(), -rx * 0.55, -ry * 3.4, rx * 1.5, ry * 3.6);
    g.restore();
    g.globalAlpha = ga;
    return;
  }
  g.globalAlpha = ga * a;
  g.drawImage(shadowSprite(), x - rx, y - ry, rx * 2, ry * 2);
  g.globalAlpha = ga;
}
let _aura = null;
function auraSprite() {
  if (_aura) return _aura;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,238,190,0.9)');
  grd.addColorStop(0.4, 'rgba(255,220,140,0.35)');
  grd.addColorStop(1, 'rgba(255,220,140,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return (_aura = c);
}

function limb(g, pts, w, col, s) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = INK;
  g.lineWidth = w + s * 0.034;
  g.stroke();
  g.strokeStyle = col;
  g.lineWidth = w;
  g.stroke();
}
function dot(g, x, y, r, col, s) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fillStyle = col;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = s * 0.016;
  g.stroke();
}
// 2-bone reach: returns the elbow (always the lower of the two bends)
function ik(sx, sy, hx, hy, l1, l2) {
  let dx = hx - sx, dy = hy - sy;
  let d = Math.hypot(dx, dy) || 1e-4;
  const max = (l1 + l2) * 0.999;
  if (d > max) { hx = sx + (dx / d) * max; hy = sy + (dy / d) * max; dx = hx - sx; dy = hy - sy; d = max; }
  const a = Math.atan2(dy, dx);
  const b = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const e1 = [sx + Math.cos(a + b) * l1, sy + Math.sin(a + b) * l1];
  const e2 = [sx + Math.cos(a - b) * l1, sy + Math.sin(a - b) * l1];
  return [e1[1] > e2[1] ? e1 : e2, [hx, hy]];
}

// ---------- weapons (s = a man's height in px) ----------
function drawBlade(g, x, y, ang, len, s, knife) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const w = s * (knife ? 0.036 : 0.044);
  g.lineCap = 'round';
  g.strokeStyle = INK;
  g.lineWidth = s * 0.06;
  g.beginPath();
  g.moveTo(-s * 0.1, 0);
  g.lineTo(0, 0);
  g.stroke();
  g.strokeStyle = '#5a3a22';
  g.lineWidth = s * 0.034;
  g.stroke();
  // blade: a slight Thai curve, the tip sweeping up off the back edge
  g.beginPath();
  g.moveTo(s * 0.01, -w * 0.5);
  g.quadraticCurveTo(len * 0.6, -w * 0.7, len, -w * 0.9 - len * 0.05);
  g.quadraticCurveTo(len * 0.72, w * 0.95, s * 0.01, w * 0.55);
  g.closePath();
  g.fillStyle = '#e6e9ef';
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = s * 0.014;
  g.stroke();
  g.strokeStyle = 'rgba(150,158,172,0.9)';
  g.lineWidth = s * 0.01;
  g.beginPath();
  g.moveTo(s * 0.03, -w * 0.15);
  g.quadraticCurveTo(len * 0.6, -w * 0.3, len * 0.92, -w * 0.75 - len * 0.04);
  g.stroke();
  g.fillStyle = '#d9a83c';
  g.strokeStyle = INK;
  g.lineWidth = s * 0.012;
  g.beginPath();
  g.rect(-s * 0.014, -s * 0.05, s * 0.028, s * 0.1);
  g.fill();
  g.stroke();
  g.restore();
}
function drawAxe(g, x, y, ang, s) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.lineCap = 'round';
  g.strokeStyle = INK;
  g.lineWidth = s * 0.058;
  g.beginPath();
  g.moveTo(-s * 0.07, 0);
  g.lineTo(s * 0.34, 0);
  g.stroke();
  g.strokeStyle = '#7a4a26';
  g.lineWidth = s * 0.032;
  g.stroke();
  g.beginPath();
  // the blade on the leading side: it faces forward when the axe is held up, and down when the chop lands
  g.moveTo(s * 0.22, s * 0.015);
  g.lineTo(s * 0.16, s * 0.16);
  g.quadraticCurveTo(s * 0.285, s * 0.225, s * 0.41, s * 0.17);
  g.lineTo(s * 0.34, s * 0.015);
  g.closePath();
  g.fillStyle = '#d6d8de';
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = s * 0.016;
  g.stroke();
  g.strokeStyle = '#ffffff';
  g.lineWidth = s * 0.012;
  g.beginPath();
  g.moveTo(s * 0.185, s * 0.15);
  g.quadraticCurveTo(s * 0.285, s * 0.2, s * 0.385, s * 0.16);
  g.stroke();
  // the poll behind the haft
  g.fillStyle = '#9a9ca4'; g.strokeStyle = INK; g.lineWidth = s * 0.012;
  g.beginPath(); g.rect(s * 0.235, -s * 0.045, s * 0.09, s * 0.035); g.fill(); g.stroke();
  g.restore();
}
function drawSpearShape(g, bx, by, tx, ty, team, size, face) {
  const L = Math.hypot(tx - bx, ty - by) || 1;
  const ux = (tx - bx) / L, uy = (ty - by) / L;
  const sx = tx - ux * L * 0.16, sy = ty - uy * L * 0.16;
  const nx = -uy, ny = ux;
  const w = Math.max(0.7, size * 0.022);
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = INK;
  g.lineWidth = w + Math.max(0.6, size * 0.014);
  g.beginPath();
  g.moveTo(bx, by);
  g.lineTo(sx, sy);
  g.stroke();
  g.strokeStyle = '#7a4a26';
  g.lineWidth = w;
  g.stroke();
  const bw = size * 0.042;
  const curve = size * 0.028 * face;
  g.beginPath();
  g.moveTo(sx + nx * bw * 0.5, sy + ny * bw * 0.5);
  g.quadraticCurveTo((sx + tx) / 2 + nx * (bw + curve), (sy + ty) / 2 + ny * (bw + curve), tx - nx * curve * 0.6, ty - ny * curve * 0.6);
  g.quadraticCurveTo((sx + tx) / 2 - nx * bw * 0.3, (sy + ty) / 2 - ny * bw * 0.3, sx - nx * bw * 0.5, sy - ny * bw * 0.5);
  g.closePath();
  g.fillStyle = '#e6e9ef';
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = Math.max(0.5, size * 0.012);
  g.stroke();
  g.fillStyle = '#d9a83c';
  g.beginPath();
  g.arc(sx, sy, Math.max(0.8, size * 0.026), 0, TAU);
  g.fill();
  g.strokeStyle = TEAM[team].tassel;
  g.lineWidth = Math.max(0.6, size * 0.016);
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx - ux * size * 0.06 + i * size * 0.03, sy - uy * size * 0.06 + size * 0.12);
    g.stroke();
  }
  g.restore();
}
function drawRattanShield(g, cx, cy, s, k = 1, side = 0.82) {
  const rx = s * 0.2 * k * side, ry = s * 0.3 * k;
  g.save();
  g.translate(cx, cy);
  g.fillStyle = INK;
  g.beginPath();
  g.ellipse(0, 0, rx + s * 0.022, ry + s * 0.022, 0, 0, TAU);
  g.fill();
  const grd = g.createRadialGradient(-rx * 0.3, -ry * 0.3, 1, 0, 0, ry);
  grd.addColorStop(0, '#dcb878');
  grd.addColorStop(1, '#b08850');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#8e6834';
  g.lineWidth = Math.max(0.5, s * 0.013);
  for (const f of [0.82, 0.62, 0.42]) {
    g.beginPath();
    g.ellipse(0, 0, rx * f, ry * f, 0, 0, TAU);
    g.stroke();
  }
  g.strokeStyle = 'rgba(142,104,52,0.6)';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    g.beginPath();
    g.moveTo(Math.cos(a) * rx * 0.3, Math.sin(a) * ry * 0.3);
    g.lineTo(Math.cos(a) * rx * 0.92, Math.sin(a) * ry * 0.92);
    g.stroke();
  }
  g.fillStyle = '#a82622';
  g.beginPath();
  g.arc(0, 0, rx * 0.3, 0, TAU);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = s * 0.012;
  g.stroke();
  g.restore();
}
// the rattan shield turned to any heading: full face toward the camera, edge-on to the sides, its woven back when turned away
function drawShieldFacing(g, cx, cy, s, sa, k = 1.15, alpha = 1) {
  const vis = Math.sin(sa);
  const wf = 0.24 + 0.76 * Math.abs(vis);
  const rx = s * 0.2 * k * wf, ry = s * 0.3 * k;
  const depth = Math.cos(sa) * s * 0.045;
  g.save();
  g.globalAlpha *= alpha;
  // the rim's thickness, seen as the shield turns
  g.fillStyle = INK;
  g.beginPath(); g.ellipse(cx - depth, cy, rx + s * 0.024, ry + s * 0.022, 0, 0, TAU); g.fill();
  g.fillStyle = '#7a5428';
  g.beginPath(); g.ellipse(cx - depth, cy, rx + s * 0.004, ry, 0, 0, TAU); g.fill();
  if (vis > -0.12) drawRattanShield(g, cx, cy, s, k, wf);
  else {
    g.fillStyle = INK;
    g.beginPath(); g.ellipse(cx, cy, rx + s * 0.022, ry + s * 0.022, 0, 0, TAU); g.fill();
    const grd = g.createRadialGradient(cx, cy, 1, cx, cy, ry);
    grd.addColorStop(0, '#8a6438'); grd.addColorStop(1, '#6a4a26');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(60,38,16,0.8)'; g.lineWidth = Math.max(0.5, s * 0.012);
    for (const f of [0.8, 0.55, 0.3]) { g.beginPath(); g.ellipse(cx, cy, rx * f, ry * f, 0, 0, TAU); g.stroke(); }
    // leather straps and the wooden grip
    g.fillStyle = '#4a2e18';
    g.fillRect(cx - rx * 0.55, cy - ry * 0.55, rx * 0.16, ry * 1.1);
    g.fillRect(cx + rx * 0.39, cy - ry * 0.55, rx * 0.16, ry * 1.1);
    g.fillStyle = '#9a7040'; g.strokeStyle = INK; g.lineWidth = Math.max(0.5, s * 0.012);
    g.beginPath(); g.rect(cx - rx * 0.6, cy - s * 0.02, rx * 1.2, s * 0.04); g.fill(); g.stroke();
  }
  g.restore();
}
function drawOneArrow(g, x0, y0, ang, L, size, head, fw = 0.09) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const x1 = x0 + dx * L, y1 = y0 + dy * L;
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(42,28,20,0.95)';
  g.lineWidth = Math.max(1.2, size * 0.05);
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.strokeStyle = '#c8aa76';
  g.lineWidth = Math.max(0.7, size * 0.025);
  g.stroke();
  const nx = -dy, ny = dx;
  g.fillStyle = '#f2f2ee';
  g.strokeStyle = 'rgba(42,28,20,0.85)';
  g.lineWidth = Math.max(0.5, size * 0.012);
  for (const sg of [-1, 1]) {
    g.beginPath();
    g.moveTo(x0 + dx * L * 0.3, y0 + dy * L * 0.3);
    g.lineTo(x0 + dx * L * 0.02 + nx * sg * size * fw, y0 + dy * L * 0.02 + ny * sg * size * fw);
    g.lineTo(x0 - dx * L * 0.03, y0 - dy * L * 0.03);
    g.closePath();
    g.fill();
    g.stroke();
  }
  if (head) {
    g.fillStyle = '#4a4e5a';
    g.beginPath();
    g.moveTo(x1 + dx * size * 0.12, y1 + dy * size * 0.12);
    g.lineTo(x1 + nx * size * 0.05, y1 + ny * size * 0.05);
    g.lineTo(x1 - nx * size * 0.05, y1 - ny * size * 0.05);
    g.closePath();
    g.fill();
    g.stroke();
  }
}
function bowGeom(hx, hy, ang, s, draw) {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const R = 0.36 * s;
  const top = [hx + nx * R - dx * s * 0.05, hy + ny * R - dy * s * 0.05];
  const bot = [hx - nx * R - dx * s * 0.05, hy - ny * R - dy * s * 0.05];
  const nock = [hx - dx * s * (0.03 + draw * 0.3), hy - dy * s * (0.03 + draw * 0.3)];
  return { dx, dy, nx, ny, R, top, bot, nock };
}
function drawBow(g, hx, hy, ang, s, draw, arrow, glow, fire = 0) {
  const b = bowGeom(hx, hy, ang, s, draw);
  const R = b.R;
  g.save();
  g.lineCap = 'round';
  // the string
  g.strokeStyle = '#efe6cf';
  g.lineWidth = Math.max(0.6, s * 0.012);
  g.beginPath();
  g.moveTo(b.top[0], b.top[1]);
  g.lineTo(b.nock[0], b.nock[1]);
  g.lineTo(b.bot[0], b.bot[1]);
  g.stroke();
  // the recurve stave
  g.beginPath();
  g.moveTo(b.top[0] + b.dx * s * 0.05, b.top[1] + b.dy * s * 0.05);
  g.quadraticCurveTo(hx + b.dx * s * 0.16 + b.nx * R * 0.55, hy + b.dy * s * 0.16 + b.ny * R * 0.55, hx + b.dx * s * 0.04, hy + b.dy * s * 0.04);
  g.quadraticCurveTo(hx + b.dx * s * 0.16 - b.nx * R * 0.55, hy + b.dy * s * 0.16 - b.ny * R * 0.55, b.bot[0] + b.dx * s * 0.05, b.bot[1] + b.dy * s * 0.05);
  g.strokeStyle = INK;
  g.lineWidth = s * 0.065;
  g.stroke();
  g.strokeStyle = '#6b3f1f';
  g.lineWidth = s * 0.036;
  g.stroke();
  g.strokeStyle = '#d9a83c';
  g.lineWidth = s * 0.02;
  g.beginPath();
  g.moveTo(hx + b.nx * s * 0.04, hy + b.ny * s * 0.04);
  g.lineTo(hx - b.nx * s * 0.04, hy - b.ny * s * 0.04);
  g.stroke();
  if (arrow) {
    drawOneArrow(g, b.nock[0], b.nock[1], ang, s * (0.42 + draw * 0.2), s, true, 0.07);
    if (fire) {
      // a rag of pitch burning on the arrowhead
      const AL = s * (0.42 + draw * 0.2), tx = b.nock[0] + Math.cos(ang) * AL, ty = b.nock[1] + Math.sin(ang) * AL;
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5; g.drawImage(auraSprite(), tx - s * 0.2, ty - s * 0.2, s * 0.4, s * 0.4); g.globalAlpha = 1;
      drawFlame(g, tx, ty + s * 0.02, s * 0.045, s * (0.17 + 0.04 * Math.sin(fire * 17)), fire * 12);
      g.restore();
    }
    if (glow > 0) {
      const tx = b.nock[0] + b.dx * s * (0.62 + draw * 0.2), ty = b.nock[1] + b.dy * s * (0.62 + draw * 0.2);
      g.globalAlpha *= glow;
      g.drawImage(auraSprite(), tx - s * 0.25, ty - s * 0.25, s * 0.5, s * 0.5);
    }
  }
  g.restore();
  return b.nock;
}
function drawQuiver(g, s) {
  g.save();
  g.translate(-s * 0.13, -s * 0.62);
  g.rotate(-0.35);
  for (let i = 0; i < 4; i++) {
    const x = -s * 0.03 + i * s * 0.022;
    drawOneArrow(g, x, -s * 0.2, Math.PI / 2, s * 0.14, s, false, 0.045);
  }
  g.fillStyle = '#7a4a26';
  g.strokeStyle = INK;
  g.lineWidth = s * 0.02;
  g.beginPath();
  g.rect(-s * 0.055, -s * 0.12, s * 0.11, s * 0.32);
  g.fill();
  g.stroke();
  g.fillStyle = '#d9a83c';
  g.fillRect(-s * 0.055, -s * 0.06, s * 0.11, s * 0.025);
  g.restore();
}

// ---------- the man ----------
const SH_F = [0.045, -0.72], SH_B = [-0.035, -0.73];

// the archer dresses as an old Ayutthaya bowman: a maroon long-sleeved shirt under a dark olive vest,
// gold bands at the wrists, dark blue-grey trousers, his team's colour in the scarf and the sash
let OUTFIT = null;
const CLOTH = { red: '#9e2a1e', blue: '#24578f' };
const LEATHER = '#8a5634', LEATHER_D = '#5e3620', LEATHER_L = '#b07a4e';
// the spearman dresses like the soldiers in the old temple murals: a short-sleeved tunic in his colour
// under a gold petal collar, a gold sash with a hanging tail, striped knee breeches, bare feet, and a tall
// pointed helmet with gold bands
const MURAL = { kind: 'mural', trim: '#e0b445', trimD: '#a07a2a', pants: '#c8783c', pantsD: '#94552a', stripe: '#6a3016' };
// the minions: bare-chested and tattooed, a maroon cloth wrapped at the hips, cords round the arms, wrapped hands
const CREEPWEAR = { kind: 'creep', trim: '#c9a046', pants: '#6e2024', pantsD: '#4c1518', ink: 'rgba(24,30,52,0.78)' };
// a band across a limb at p, along the direction (ux, uy)
function limbBand(g, p, ux, uy, half, col, w, s) {
  const L = Math.hypot(ux, uy) || 1, nx = -uy / L, ny = ux / L;
  g.save(); g.lineCap = 'butt';
  g.beginPath(); g.moveTo(p[0] - nx * half, p[1] - ny * half); g.lineTo(p[0] + nx * half, p[1] + ny * half);
  g.strokeStyle = INK; g.lineWidth = w + s * 0.012; g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.stroke();
  g.restore();
}
const lerpP = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
// the spearman: an old Siamese foot soldier: a navy short-sleeved shirt edged gold, the same tooled leather
// breastplate and wide belt as the bowman, a cloth sash in his side's colour, a patterned maroon chong kraben,
// leather bracers on the forearms, sandals, and the bowman's war hat
const SPEARMAN = { sleeve: '#2a2f4e', sleeveD: '#1b1f36', vest: '#2a2f4e', vestD: '#1b1f36', trim: '#c9a046', pants: '#56203a', pantsD: '#3a1426', band: '#1e1a1c', short: true, sandals: true };
const BOWMAN = { sleeve: '#6e2c26', sleeveD: '#4e1e1a', vest: '#4a4c30', vestD: '#34361f', trim: '#c9a046', pants: '#5a2a3a', pantsD: '#3e1c28', band: '#1e1a1c' };
function drawArm(g, s, sh, hand, team, back) {
  const T = TEAM[team];
  const [el, hd] = ik(sh[0] * s, sh[1] * s, hand[0] * s, hand[1] * s, 0.17 * s, 0.17 * s);
  if (OUTFIT && OUTFIT.kind) {
    const sp = [sh[0] * s, sh[1] * s], sk = back ? SKIN_D : SKIN;
    limb(g, [sp, el], s * 0.07, sk, s);
    limb(g, [el, hd], s * 0.058, sk, s);
    const ux = el[0] - sp[0], uy = el[1] - sp[1], fx = hd[0] - el[0], fy = hd[1] - el[1];
    if (OUTFIT.kind === 'mural') {
      // a short puffed sleeve to half the upper arm, a gold armlet below it, a gold band at the wrist
      const m = lerpP(sp, el, 0.5);
      limb(g, [sp, m], s * 0.095, back ? TEAM[team].dark : CLOTH[team] || TEAM[team].main, s);
      limbBand(g, lerpP(sp, el, 0.52), ux, uy, s * 0.05, back ? OUTFIT.trimD : OUTFIT.trim, s * 0.022, s);
      limbBand(g, lerpP(sp, el, 0.72), ux, uy, s * 0.04, back ? OUTFIT.trimD : OUTFIT.trim, s * 0.012, s);
      limbBand(g, lerpP(el, hd, 0.72), fx, fy, s * 0.036, back ? OUTFIT.trimD : OUTFIT.trim, s * 0.018, s);
      dot(g, hd[0], hd[1], s * 0.038, sk, s);
    } else {
      deltoid(g, sp, el, s, 0.066, back);
      // a twisted cord round the upper arm in his side's colour; the hand bound in cloth
      limbBand(g, lerpP(sp, el, 0.45), ux, uy, s * 0.042, '#2a1a12', s * 0.016, s);
      limbBand(g, lerpP(sp, el, 0.56), ux, uy, s * 0.042, TEAM[team].main, s * 0.012, s);
      limbBand(g, lerpP(el, hd, 0.82), fx, fy, s * 0.036, back ? '#a99a80' : '#e6dcc4', s * 0.03, s);
      dot(g, hd[0], hd[1], s * 0.042, back ? '#b0a288' : '#ece2ca', s);
      g.strokeStyle = 'rgba(90,70,40,0.6)'; g.lineWidth = s * 0.006;
      g.beginPath(); g.moveTo(hd[0] - s * 0.03, hd[1] - s * 0.01); g.lineTo(hd[0] + s * 0.03, hd[1] + s * 0.012); g.stroke();
    }
    return;
  }
  if (OUTFIT) {
    const sp0 = [sh[0] * s, sh[1] * s];
    if (OUTFIT.short) {
      // bare forearm under a short sleeve with a gold edge, a leather bracer laced round it
      limb(g, [el, hd], s * 0.058, back ? SKIN_D : SKIN, s);
      const m = lerpP(sp0, el, 0.8);
      limb(g, [sp0, m], s * 0.09, back ? OUTFIT.sleeveD : OUTFIT.sleeve, s);
      limbBand(g, m, el[0] - sp0[0], el[1] - sp0[1], s * 0.05, back ? '#a8832e' : OUTFIT.trim, s * 0.016, s);
      limb(g, [lerpP(el, hd, 0.3), lerpP(el, hd, 0.84)], s * 0.072, back ? LEATHER_D : LEATHER, s);
      g.strokeStyle = 'rgba(50,25,10,0.65)'; g.lineWidth = s * 0.006;
      for (const t of [0.45, 0.6, 0.75]) { const p = lerpP(el, hd, t); g.beginPath(); g.arc(p[0], p[1], s * 0.012, 0, TAU); g.stroke(); }
    } else {
    limb(g, [sp0, el], s * 0.078, back ? OUTFIT.sleeveD : OUTFIT.sleeve, s);
    limb(g, [el, hd], s * 0.062, back ? OUTFIT.sleeveD : OUTFIT.sleeve, s);
    }
    // a leather cap over the shoulder, hanging down the upper arm
    { const ax = sh[0] * s, ay = sh[1] * s, ux = el[0] - ax, uy = el[1] - ay, L = Math.hypot(ux, uy) || 1, a = Math.atan2(uy, ux);
      g.save(); g.translate(ax + (ux / L) * s * 0.03, ay + (uy / L) * s * 0.03); g.rotate(a - Math.PI / 2);
      g.beginPath(); g.moveTo(-s * 0.06, -s * 0.03); g.quadraticCurveTo(0, -s * 0.07, s * 0.06, -s * 0.03); g.lineTo(s * 0.055, s * 0.06); g.quadraticCurveTo(0, s * 0.085, -s * 0.055, s * 0.06); g.closePath();
      g.fillStyle = back ? LEATHER_D : LEATHER; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.014; g.stroke();
      g.strokeStyle = 'rgba(60,30,14,0.7)'; g.lineWidth = s * 0.006; g.beginPath(); g.moveTo(-s * 0.045, s * 0.04); g.quadraticCurveTo(0, s * 0.06, s * 0.045, s * 0.04); g.stroke();
      g.restore(); }
    // a gold band at the wrist
    if (!OUTFIT.short) {
    const ux = hd[0] - el[0], uy = hd[1] - el[1], L = Math.hypot(ux, uy) || 1, bx = hd[0] - (ux / L) * s * 0.045, by = hd[1] - (uy / L) * s * 0.045;
    g.save(); g.lineCap = 'butt'; g.strokeStyle = INK; g.lineWidth = s * 0.03;
    g.beginPath(); g.moveTo(bx - (uy / L) * s * 0.038, by + (ux / L) * s * 0.038); g.lineTo(bx + (uy / L) * s * 0.038, by - (ux / L) * s * 0.038); g.stroke();
    g.strokeStyle = back ? '#a8832e' : OUTFIT.trim; g.lineWidth = s * 0.02; g.stroke(); g.restore();
    }
    dot(g, hd[0], hd[1], s * 0.038, back ? SKIN_D : SKIN, s);
    return;
  }
  if (BARE) {
    // no sleeve: a thick bare arm, the shoulder a big round ball of muscle
    const sp = [sh[0] * s, sh[1] * s], sk = back ? SKIN_D : SKIN;
    limb(g, [sp, el], s * 0.082, sk, s);
    limb(g, [el, hd], s * 0.062, sk, s);
    deltoid(g, sp, el, s, 0.07, back);
    limbBand(g, lerpP(el, hd, 0.8), hd[0] - el[0], hd[1] - el[1], s * 0.04, back ? T.dark : T.main, s * 0.028, s);
    dot(g, hd[0], hd[1], s * 0.04, sk, s);
    return;
  }
  limb(g, [[sh[0] * s, sh[1] * s], el], s * 0.078, back ? T.dark : T.main, s);
  limb(g, [el, hd], s * 0.058, back ? SKIN_D : SKIN, s);
  dot(g, hd[0], hd[1], s * 0.038, back ? SKIN_D : SKIN, s);
}
// the shoulder muscle: a round cap over the joint, a highlight on it, a crease where it meets the arm
function deltoid(g, sp, el, s, r, back) {
  const ux = el[0] - sp[0], uy = el[1] - sp[1], L = Math.hypot(ux, uy) || 1;
  const cx = sp[0] + (ux / L) * s * 0.012, cy = sp[1] + (uy / L) * s * 0.012 - s * 0.006;
  g.beginPath(); g.arc(cx, cy, s * r, 0, TAU); g.fillStyle = back ? SKIN_D : SKIN; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.016; g.stroke();
  if (!back) { g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = s * 0.014; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, s * r * 0.58, Math.PI * 1.1, Math.PI * 1.6); g.stroke(); }
  g.strokeStyle = 'rgba(60,30,12,0.45)'; g.lineWidth = s * 0.009;
  const a = Math.atan2(uy, ux); g.beginPath(); g.arc(cx, cy, s * r * 0.8, a - 0.75, a + 0.75); g.stroke();
}
let BARE = false;
function drawLeg(g, s, ang, knee, front) {
  const hip = [(front ? 0.035 : -0.035) * s, -0.42 * s];
  const k = [hip[0] + Math.sin(ang) * 0.21 * s, hip[1] + Math.cos(ang) * 0.21 * s];
  const fa = ang - knee;
  const f = [k[0] + Math.sin(fa) * 0.21 * s, k[1] + Math.cos(fa) * 0.21 * s];
  if (OUTFIT && OUTFIT.kind) {
    limb(g, [k, f], s * 0.064, front ? SKIN : SKIN_D, s);
    const ux = k[0] - hip[0], uy = k[1] - hip[1];
    if (OUTFIT.kind === 'mural') {
      // striped breeches to just below the knee, a gold hem
      const kk = lerpP(k, f, 0.14);
      limb(g, [hip, kk], s * 0.13, front ? OUTFIT.pants : OUTFIT.pantsD, s);
      for (const t of [0.12, 0.3, 0.48, 0.66, 0.84, 1.02]) limbBand(g, lerpP(hip, kk, t), ux, uy, s * 0.06, front ? OUTFIT.stripe : '#4a200e', s * 0.016, s * 0.0001);
      limbBand(g, kk, f[0] - k[0], f[1] - k[1], s * 0.066, front ? OUTFIT.trim : OUTFIT.trimD, s * 0.02, s);
    } else {
      // the wrapped loincloth, full over the thigh and caught up above the knee
      const kk = lerpP(hip, k, 0.92);
      limb(g, [hip, kk], s * 0.135, front ? OUTFIT.pants : OUTFIT.pantsD, s);
      g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = s * 0.008;
      for (const t of [0.4, 0.7]) { const p = lerpP(hip, kk, t); g.beginPath(); g.moveTo(p[0] - s * 0.05, p[1] - s * 0.01); g.quadraticCurveTo(p[0], p[1] + s * 0.03, p[0] + s * 0.05, p[1] - s * 0.005); g.stroke(); }
    }
  } else {
  limb(g, [hip, k], s * 0.125, OUTFIT ? (front ? OUTFIT.pants : OUTFIT.pantsD) : front ? PANTS : PANTS_D, s);
  if (OUTFIT) {
    // chong kraben: full over the thigh, patterned, gathered below the knee over a dark patterned band
    const m = [k[0] + (f[0] - k[0]) * 0.5, k[1] + (f[1] - k[1]) * 0.5];
    limb(g, [k, f], s * 0.064, front ? SKIN : SKIN_D, s);
    limb(g, [k, m], s * 0.098, OUTFIT.band, s);
    g.save(); g.strokeStyle = front ? '#c9a046' : '#8a6e30'; g.lineWidth = s * 0.008; g.lineCap = 'butt';
    for (const t of [0.12, 0.22, 0.32, 0.42]) { const p = [k[0] + (f[0] - k[0]) * t, k[1] + (f[1] - k[1]) * t], ux = f[0] - k[0], uy = f[1] - k[1], L = Math.hypot(ux, uy) || 1; g.beginPath(); g.moveTo(p[0] - (uy / L) * s * 0.045, p[1] + (ux / L) * s * 0.045); g.lineTo(p[0] + (uy / L) * s * 0.045, p[1] - (ux / L) * s * 0.045); g.stroke(); }
    g.restore();
    limb(g, [hip, [k[0] + (f[0] - k[0]) * 0.12, k[1] + (f[1] - k[1]) * 0.12]], s * 0.135, front ? OUTFIT.pants : OUTFIT.pantsD, s);
    // little woven flowers scattered over the cloth
    g.save();
    for (let i = 0; i < 5; i++) { const t = 0.15 + i * 0.2, x = hip[0] + (k[0] - hip[0]) * t + (i % 2 ? 1 : -1) * s * 0.02, y = hip[1] + (k[1] - hip[1]) * t; dot(g, x, y, s * 0.012, front ? '#c98a5a' : '#8a5a3a', s); }
    g.restore();
  } else limb(g, [k, f], s * 0.064, front ? SKIN : SKIN_D, s);
  }
  g.save();
  g.translate(f[0] + s * 0.03, f[1]);
  g.rotate(fa * 0.4);
  g.beginPath();
  g.ellipse(0, 0, s * 0.058, s * 0.028, 0, 0, TAU);
  g.fillStyle = front ? SKIN : SKIN_D;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = s * 0.016;
  g.stroke();
  if (OUTFIT && OUTFIT.sandals) {
    // a dark sandal: the sole under the foot, a strap over it
    g.beginPath(); g.ellipse(0, s * 0.02, s * 0.066, s * 0.014, 0, 0, TAU); g.fillStyle = '#231a16'; g.fill();
    g.strokeStyle = '#231a16'; g.lineWidth = s * 0.014; g.beginPath(); g.moveTo(-s * 0.01, -s * 0.026); g.lineTo(s * 0.025, s * 0.01); g.moveTo(s * 0.02, -s * 0.024); g.lineTo(-s * 0.01, s * 0.012); g.stroke();
  }
  g.restore();
}
function drawTorso(g, s, H, team) {
  const T = TEAM[team];
  const S = (v) => v * s;
  // neck
  g.fillStyle = SKIN;
  g.fillRect(S(-0.03), S(-0.84), S(0.07), S(0.08));
  g.beginPath();
  g.moveTo(S(-0.115), S(-0.47));
  g.lineTo(S(-0.13), S(-0.71));
  g.quadraticCurveTo(S(-0.115), S(-0.795), S(-0.02), S(-0.795));
  g.lineTo(S(0.06), S(-0.795));
  g.quadraticCurveTo(S(0.135), S(-0.785), S(0.128), S(-0.7));
  g.lineTo(S(0.118), S(-0.47));
  g.closePath();
  if (OUTFIT && OUTFIT.kind === 'mural') { drawMuralTorso(g, s, T, team); return; }
  if (OUTFIT && OUTFIT.kind === 'creep') { drawCreepTorso(g, s, T, team); return; }
  if (OUTFIT) {
    const path = new Path2D();
    path.moveTo(S(-0.082), S(-0.47)); path.quadraticCurveTo(S(-0.1), S(-0.6), S(-0.13), S(-0.71)); path.quadraticCurveTo(S(-0.115), S(-0.795), S(-0.02), S(-0.795)); path.lineTo(S(0.06), S(-0.795)); path.quadraticCurveTo(S(0.135), S(-0.785), S(0.128), S(-0.7)); path.quadraticCurveTo(S(0.1), S(-0.6), S(0.085), S(-0.47)); path.closePath();
    g.fillStyle = OUTFIT.sleeve; g.fill(path);
    g.save(); g.clip(path);
    // the vest: open a little at the front, gold piping down its edge
    g.fillStyle = OUTFIT.vest;
    g.beginPath(); g.moveTo(S(-0.2), S(-0.4)); g.lineTo(S(-0.2), S(-0.82)); g.lineTo(S(0.02), S(-0.82)); g.lineTo(S(0.075), S(-0.62)); g.lineTo(S(0.1), S(-0.4)); g.closePath(); g.fill();
    g.fillStyle = OUTFIT.vestD; g.fillRect(S(-0.2), S(-0.9), S(0.1), S(0.5));
    g.strokeStyle = OUTFIT.trim; g.lineWidth = s * 0.016;
    g.beginPath(); g.moveTo(S(0.02), S(-0.8)); g.lineTo(S(0.075), S(-0.62)); g.lineTo(S(0.1), S(-0.42)); g.stroke();
    g.strokeStyle = 'rgba(20,20,10,0.35)'; g.lineWidth = s * 0.008;
    for (const y of [-0.72, -0.64, -0.56]) { g.beginPath(); g.moveTo(S(-0.12), S(y)); g.lineTo(S(0.04), S(y + 0.01)); g.stroke(); }
    g.restore();
    g.strokeStyle = INK; g.lineWidth = s * 0.03; g.stroke(path);
    // the leather breastplate: from the shoulders down to a point on the chest, tooled, studded gold
    g.beginPath();
    g.moveTo(S(-0.135), S(-0.775)); g.quadraticCurveTo(S(0), S(-0.81), S(0.13), S(-0.775));
    g.lineTo(S(0.125), S(-0.66)); g.quadraticCurveTo(S(0.08), S(-0.6), S(0.01), S(-0.565)); g.quadraticCurveTo(S(-0.07), S(-0.6), S(-0.125), S(-0.66)); g.closePath();
    const lg = g.createLinearGradient(S(-0.13), 0, S(0.13), 0); lg.addColorStop(0, LEATHER_D); lg.addColorStop(0.6, LEATHER_L); lg.addColorStop(1, LEATHER);
    g.fillStyle = lg; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.018; g.stroke();
    g.strokeStyle = 'rgba(60,30,14,0.75)'; g.lineWidth = s * 0.007;
    g.beginPath(); g.moveTo(S(-0.1), S(-0.75)); g.quadraticCurveTo(S(0), S(-0.775), S(0.1), S(-0.75)); g.lineTo(S(0.1), S(-0.67)); g.quadraticCurveTo(S(0.06), S(-0.62), S(0.01), S(-0.6)); g.quadraticCurveTo(S(-0.05), S(-0.62), S(-0.1), S(-0.67)); g.closePath(); g.stroke();
    // a tooled flame-and-leaf pattern in the middle
    g.beginPath(); g.moveTo(S(0.01), S(-0.72)); g.quadraticCurveTo(S(0.05), S(-0.68), S(0.01), S(-0.625)); g.quadraticCurveTo(S(-0.03), S(-0.68), S(0.01), S(-0.72)); g.stroke();
    g.beginPath(); g.moveTo(S(-0.05), S(-0.7)); g.quadraticCurveTo(S(-0.02), S(-0.66), S(0.01), S(-0.66)); g.quadraticCurveTo(S(0.04), S(-0.66), S(0.07), S(-0.7)); g.stroke();
    for (const [x, y] of [[-0.11, -0.765], [0.11, -0.765], [-0.115, -0.675], [0.115, -0.675], [0.01, -0.585]]) dot(g, S(x), S(y), s * 0.008, OUTFIT.trim, s);
    // the scarf knotted at the neck
    g.fillStyle = CLOTH[team] || T.main;
    g.beginPath(); g.moveTo(S(-0.1), S(-0.79)); g.quadraticCurveTo(S(0.0), S(-0.73), S(0.1), S(-0.79)); g.lineTo(S(0.08), S(-0.83)); g.quadraticCurveTo(S(0), S(-0.79), S(-0.08), S(-0.83)); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = s * 0.014; g.stroke();
    g.strokeStyle = OUTFIT.trim; g.lineWidth = s * 0.01; g.beginPath(); g.moveTo(S(-0.08), S(-0.78)); g.quadraticCurveTo(S(0), S(-0.74), S(0.08), S(-0.78)); g.stroke();
    // the shirt's hem below the belt, edged gold, reaching down over the hips
    g.beginPath(); g.moveTo(S(-0.095), S(-0.46)); g.lineTo(S(0.095), S(-0.46)); g.lineTo(S(0.12), S(-0.335)); g.quadraticCurveTo(S(0), S(-0.318), S(-0.122), S(-0.335)); g.closePath();
    g.fillStyle = OUTFIT.vest; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.014; g.stroke();
    g.strokeStyle = OUTFIT.trim; g.lineWidth = s * 0.016; g.beginPath(); g.moveTo(S(0.115), S(-0.34)); g.quadraticCurveTo(S(0), S(-0.325), S(-0.117), S(-0.34)); g.stroke();
    // the cloth sash tied under the belt, its ends hanging at the front
    const cl = CLOTH[team] || T.main;
    g.beginPath(); g.moveTo(S(-0.1), S(-0.455)); g.quadraticCurveTo(S(0), S(-0.43), S(0.1), S(-0.455)); g.lineTo(S(0.1), S(-0.425)); g.quadraticCurveTo(S(0), S(-0.4), S(-0.1), S(-0.425)); g.closePath();
    g.fillStyle = cl; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.012; g.stroke();
    g.beginPath(); g.moveTo(S(0.0), S(-0.425)); g.quadraticCurveTo(S(-0.03), S(-0.36), S(-0.01), S(-0.28)); g.lineTo(S(0.035), S(-0.29)); g.quadraticCurveTo(S(0.03), S(-0.36), S(0.045), S(-0.42)); g.closePath();
    g.fillStyle = cl; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(S(0.03), S(-0.425)); g.quadraticCurveTo(S(0.07), S(-0.37), S(0.08), S(-0.31)); g.lineTo(S(0.11), S(-0.32)); g.quadraticCurveTo(S(0.09), S(-0.38), S(0.06), S(-0.425)); g.closePath();
    g.fillStyle = T.dark; g.fill(); g.stroke();
    // the wide leather belt, a gold lozenge on the front
    g.beginPath(); g.moveTo(S(-0.098), S(-0.535)); g.quadraticCurveTo(S(0), S(-0.525), S(0.098), S(-0.535)); g.lineTo(S(0.102), S(-0.448)); g.quadraticCurveTo(S(0), S(-0.438), S(-0.102), S(-0.448)); g.closePath();
    const bg = g.createLinearGradient(S(-0.1), 0, S(0.1), 0); bg.addColorStop(0, LEATHER_D); bg.addColorStop(0.55, LEATHER_L); bg.addColorStop(1, LEATHER);
    g.fillStyle = bg; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.016; g.stroke();
    g.strokeStyle = 'rgba(60,30,14,0.7)'; g.lineWidth = s * 0.006;
    for (const y of [-0.52, -0.462]) { g.beginPath(); g.moveTo(S(-0.095), S(y)); g.quadraticCurveTo(S(0), S(y + 0.01), S(0.097), S(y)); g.stroke(); }
    g.beginPath(); g.moveTo(S(0.03), S(-0.52)); g.lineTo(S(0.055), S(-0.49)); g.lineTo(S(0.03), S(-0.458)); g.lineTo(S(0.005), S(-0.49)); g.closePath();
    g.fillStyle = OUTFIT.trim; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.008; g.stroke();
    dot(g, S(0.03), S(-0.49), s * 0.009, '#7a2a1e', s);
    return;
  }
  g.fillStyle = T.main;
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(S(-0.2), S(-0.9), S(0.16), S(0.5));
  g.fillStyle = H.head === 'crown' ? '#e2be5c' : T.light;
  g.beginPath();
  g.moveTo(S(-0.14), S(-0.74));
  g.lineTo(S(-0.07), S(-0.81));
  g.lineTo(S(0.15), S(-0.52));
  g.lineTo(S(0.15), S(-0.44));
  g.closePath();
  g.fill();
  if (H.head === 'crown') {
    g.fillStyle = 'rgba(255,240,180,0.5)';
    for (let i = 0; i < 3; i++) g.fillRect(S(-0.1 + i * 0.07), S(-0.7), S(0.025), S(0.02));
  }
  g.restore();
  g.strokeStyle = INK;
  g.lineWidth = s * 0.03;
  g.stroke();
  // sash belt
  g.beginPath();
  g.rect(S(-0.125), S(-0.505), S(0.25), S(0.052));
  g.fillStyle = '#d9a83c';
  g.fill();
  g.lineWidth = s * 0.018;
  g.stroke();
  g.fillStyle = T.dark;
  g.beginPath();
  g.moveTo(S(0.06), S(-0.47));
  g.lineTo(S(0.1), S(-0.37));
  g.lineTo(S(0.04), S(-0.38));
  g.closePath();
  g.fill();
  g.stroke();
}
function drawHips(g, s, team) {
  if (OUTFIT && OUTFIT.kind) {
    g.beginPath();
    g.moveTo(-0.11 * s, -0.48 * s); g.lineTo(0.11 * s, -0.48 * s); g.lineTo(0.15 * s, -0.33 * s); g.quadraticCurveTo(0.02 * s, -0.29 * s, -0.135 * s, -0.33 * s); g.closePath();
    g.fillStyle = OUTFIT.pants; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.026; g.stroke();
    if (OUTFIT.kind === 'creep') {
      // the tail of the wrap hanging down in front, and the knot at the waist in his side's colour
      g.beginPath(); g.moveTo(0.0, -0.42 * s); g.lineTo(0.07 * s, -0.42 * s); g.quadraticCurveTo(0.08 * s, -0.33 * s, 0.065 * s, -0.25 * s); g.lineTo(0.005 * s, -0.26 * s); g.quadraticCurveTo(0.012 * s, -0.34 * s, 0.0, -0.42 * s); g.closePath();
      g.fillStyle = OUTFIT.pantsD; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.016; g.stroke();
    }
    return;
  }
  const wh = OUTFIT ? 0.09 : 0.122;
  g.beginPath();
  g.moveTo(-wh * s, -0.48 * s);
  g.lineTo(wh * s, -0.48 * s);
  g.lineTo(0.15 * s, -0.33 * s);
  g.quadraticCurveTo(0.02 * s, -0.29 * s, -0.135 * s, -0.33 * s);
  g.closePath();
  g.fillStyle = OUTFIT ? OUTFIT.pants : PANTS;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = s * 0.026;
  g.stroke();
  if (OUTFIT) for (const [x, y] of [[-0.06, -0.42], [0.02, -0.4], [0.08, -0.36], [-0.03, -0.35]]) dot(g, x * s, y * s, s * 0.012, '#c98a5a', s);
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.lineWidth = s * 0.012;
  g.beginPath();
  g.moveTo(0.0, -0.46 * s);
  g.lineTo(0.03 * s, -0.32 * s);
  g.stroke();
}
function drawHead(g, s, H, team, time, moving) {
  const T = TEAM[team];
  const cx = 0.02 * s, cy = -0.9 * s, r = 0.115 * s;
  // band tails flutter behind the head
  if (H.head === 'band') {
    const wv = Math.sin(time * (moving ? 12 : 4)) * s * (moving ? 0.04 : 0.015);
    for (const k of [0, 1]) {
      limb(g, [[cx - r * 0.9, cy - s * 0.045], [cx - r * 1.5 - s * 0.03 * k, cy - s * 0.02 + wv * (k ? -1 : 1) + s * 0.02 * k], [cx - r * 2.1 - s * 0.04 * k, cy + s * 0.02 + wv * (k ? 1 : -1.4) + s * 0.04 * k]], s * 0.03, T.main, s);
    }
  }
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.fillStyle = SKIN;
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = HAIR;
  if (H.head === 'mahad') {
    // the Bang Rachan villager's cut: shaved to stubble all round, a cap of hair left on top, parted in the middle
    g.fillStyle = 'rgba(40,28,22,0.42)';
    g.beginPath(); g.ellipse(cx - s * 0.04, cy - s * 0.02, r * 1.0, r * 0.92, 0, 0, TAU); g.fill();
    g.fillStyle = SKIN; g.beginPath(); g.ellipse(cx + s * 0.085, cy + s * 0.012, r * 0.8, r * 0.95, 0, 0, TAU); g.fill();
    g.fillStyle = HAIR;
    g.beginPath(); g.ellipse(cx - s * 0.012, cy - r * 0.98, r * 0.86, r * 0.5, -0.06, 0, TAU); g.fill();
    // the two wings of the parting lifting off the crown
    g.strokeStyle = SKIN_D; g.lineWidth = s * 0.011; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - s * 0.005, cy - r * 1.02); g.quadraticCurveTo(cx + s * 0.02, cy - r * 0.78, cx + s * 0.045, cy - r * 0.6); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = s * 0.008;
    g.beginPath(); g.moveTo(cx - s * 0.07, cy - r * 0.86); g.quadraticCurveTo(cx - s * 0.04, cy - r * 1.0, cx - s * 0.01, cy - r * 0.95); g.stroke();
  } else if (H.head === 'part') {
    // thick hair parted in the middle: a cap over the crown, curtains falling either side of the brow, long at the nape
    g.beginPath(); g.ellipse(cx - s * 0.025, cy - s * 0.058, r * 1.04, r * 0.6, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(cx - s * 0.078, cy + s * 0.0, r * 0.5, r * 0.9, 0, 0, TAU); g.fill();
    // the near curtain, swept down over the temple
    g.beginPath(); g.moveTo(cx + s * 0.01, cy - r * 0.98); g.quadraticCurveTo(cx + s * 0.12, cy - s * 0.09, cx + s * 0.1, cy - s * 0.035);
    g.quadraticCurveTo(cx + s * 0.07, cy - s * 0.06, cx + s * 0.02, cy - s * 0.045); g.closePath(); g.fill();
    // the parting itself, a light line over the crown to the brow
    g.strokeStyle = SKIN_D; g.lineWidth = s * 0.01; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx + s * 0.005, cy - r * 0.92); g.quadraticCurveTo(cx + s * 0.04, cy - r * 0.86, cx + s * 0.06, cy - s * 0.075); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = s * 0.008;
    g.beginPath(); g.moveTo(cx + s * 0.02, cy - r * 0.85); g.quadraticCurveTo(cx + s * 0.08, cy - s * 0.08, cx + s * 0.085, cy - s * 0.05); g.stroke();
  } else {
  g.beginPath();
  g.ellipse(cx - s * 0.035, cy - s * 0.06, r * 1.05, r * 0.72, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(cx - s * 0.08, cy, r * 0.55, r * 0.95, 0, 0, TAU);
  g.fill();
  }
  if (H.head === 'band') {
    g.fillStyle = T.main;
    g.fillRect(cx - r * 1.2, cy - s * 0.07, r * 2.4, s * 0.042);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(cx - r * 1.2, cy - s * 0.07, r * 2.4, s * 0.01);
  }
  g.restore();
  // ear, eye, brow, mouth
  g.fillStyle = H.head === 'hat' || H.head === 'helm' ? 'rgba(0,0,0,0)' : SKIN_D;
  g.beginPath();
  g.ellipse(cx - s * 0.025, cy + s * 0.012, s * 0.024, s * 0.034, 0, 0, TAU);
  g.fill();
  g.fillStyle = INK;
  g.beginPath();
  g.ellipse(cx + s * 0.068, cy - s * 0.004, s * 0.014, s * 0.02, 0, 0, TAU);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = s * 0.014;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx + s * 0.045, cy - s * 0.035);
  g.lineTo(cx + s * 0.09, cy - s * 0.03);
  g.stroke();
  if (H.id === 'lead' || H.id === 'shield') {
    g.lineWidth = s * 0.02;
    g.beginPath();
    g.moveTo(cx + s * 0.06, cy + s * 0.05);
    g.quadraticCurveTo(cx + s * 0.09, cy + s * 0.035, cx + s * 0.115, cy + s * 0.055);
    g.stroke();
  } else {
    g.lineWidth = s * 0.01;
    g.beginPath();
    g.moveTo(cx + s * 0.075, cy + s * 0.055);
    g.lineTo(cx + s * 0.1, cy + s * 0.05);
    g.stroke();
  }
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.lineWidth = s * 0.026;
  g.stroke();
  if (H.head === 'mahad') {
    // the top hair standing a little proud of the skull, either side of the parting
    g.fillStyle = HAIR; g.strokeStyle = INK; g.lineWidth = s * 0.012; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(cx - r * 0.72, cy - r * 0.72); g.quadraticCurveTo(cx - r * 0.5, cy - r * 1.28, cx + s * 0.0, cy - r * 1.12);
    g.quadraticCurveTo(cx + s * 0.012, cy - r * 1.0, cx + s * 0.02, cy - r * 0.93); g.quadraticCurveTo(cx - r * 0.3, cy - r * 1.0, cx - r * 0.72, cy - r * 0.72); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(cx + s * 0.02, cy - r * 0.93); g.quadraticCurveTo(cx + s * 0.03, cy - r * 1.2, cx + r * 0.62, cy - r * 0.98);
    g.quadraticCurveTo(cx + r * 0.72, cy - r * 0.8, cx + r * 0.6, cy - r * 0.72); g.quadraticCurveTo(cx + r * 0.3, cy - r * 0.9, cx + s * 0.02, cy - r * 0.93); g.closePath(); g.fill(); g.stroke();
    // the moustache: thick under the nose, drawn out to a point and curled up
    g.strokeStyle = HAIR; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = s * 0.024;
    g.beginPath(); g.moveTo(cx + s * 0.112, cy + s * 0.036); g.quadraticCurveTo(cx + s * 0.085, cy + s * 0.05, cx + s * 0.055, cy + s * 0.046); g.stroke();
    g.lineWidth = s * 0.015;
    g.beginPath(); g.moveTo(cx + s * 0.058, cy + s * 0.046); g.quadraticCurveTo(cx + s * 0.022, cy + s * 0.052, cx + s * 0.018, cy + s * 0.018); g.stroke();
    g.lineWidth = s * 0.008;
    g.beginPath(); g.moveTo(cx + s * 0.018, cy + s * 0.02); g.quadraticCurveTo(cx + s * 0.016, cy + s * 0.0, cx + s * 0.03, cy - s * 0.004); g.stroke();
    // the near end, curling up in front of the cheek
    g.lineWidth = s * 0.014;
    g.beginPath(); g.moveTo(cx + s * 0.11, cy + s * 0.038); g.quadraticCurveTo(cx + s * 0.145, cy + s * 0.05, cx + s * 0.15, cy + s * 0.02); g.stroke();
    g.lineWidth = s * 0.007;
    g.beginPath(); g.moveTo(cx + s * 0.15, cy + s * 0.022); g.quadraticCurveTo(cx + s * 0.152, cy + s * 0.004, cx + s * 0.138, cy + s * 0.0); g.stroke();
    // a cloth band in his side's colour across the brow
    g.strokeStyle = T.main; g.lineWidth = s * 0.02; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(cx - r * 0.98, cy - s * 0.045); g.quadraticCurveTo(cx, cy - s * 0.075, cx + r * 0.98, cy - s * 0.05); g.stroke();
  } else if (H.head === 'helm') drawMuralHelm(g, s, cx, cy, r, team, time, moving);
  else if (H.head === 'knot') {
    dot(g, cx - s * 0.03, cy - r - s * 0.025, s * 0.048, HAIR, s);
    g.fillStyle = T.main;
    g.fillRect(cx - s * 0.06, cy - r + s * 0.0, s * 0.06, s * 0.022);
    // a strip of cloth tied across the brow, ends hanging
    g.strokeStyle = T.dark;
    g.lineWidth = s * 0.02;
    g.beginPath();
    g.moveTo(cx - r * 0.95, cy - s * 0.02);
    g.lineTo(cx - r * 1.4, cy + s * 0.06);
    g.stroke();
  } else if (H.head === 'crown') {
    const grd = g.createLinearGradient(cx - s * 0.12, 0, cx + s * 0.12, 0);
    grd.addColorStop(0, '#a8792a');
    grd.addColorStop(0.45, '#f2d27a');
    grd.addColorStop(1, '#9a6e24');
    g.beginPath();
    g.moveTo(cx - s * 0.125, cy - s * 0.02);
    g.lineTo(cx - s * 0.105, cy - s * 0.12);
    g.quadraticCurveTo(cx - s * 0.05, cy - s * 0.2, cx, cy - s * 0.43);
    g.quadraticCurveTo(cx + s * 0.05, cy - s * 0.2, cx + s * 0.105, cy - s * 0.12);
    g.lineTo(cx + s * 0.125, cy - s * 0.02);
    g.closePath();
    g.fillStyle = grd;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = s * 0.02;
    g.stroke();
    g.strokeStyle = 'rgba(90,60,20,0.8)';
    g.lineWidth = s * 0.012;
    for (const y of [-0.08, -0.15, -0.22, -0.29]) {
      const half = 0.11 - (Math.abs(y) - 0.08) * 0.42;
      g.beginPath();
      g.moveTo(cx - s * half, cy + s * y);
      g.quadraticCurveTo(cx, cy + s * (y + 0.025), cx + s * half, cy + s * y);
      g.stroke();
    }
    dot(g, cx, cy - s * 0.06, s * 0.026, T.main, s);
    dot(g, cx, cy - s * 0.445, s * 0.018, '#f2d27a', s);
  } else if (H.head === 'ngob') {
    // the farmer's woven cone hat
    g.beginPath();
    g.moveTo(cx - s * 0.22, cy - s * 0.05);
    g.quadraticCurveTo(cx - s * 0.05, cy - s * 0.2, cx + s * 0.01, cy - s * 0.27);
    g.quadraticCurveTo(cx + s * 0.07, cy - s * 0.2, cx + s * 0.24, cy - s * 0.05);
    g.quadraticCurveTo(cx, cy - s * 0.01, cx - s * 0.22, cy - s * 0.05);
    g.closePath();
    g.fillStyle = '#d6b46a'; g.fill();
    g.strokeStyle = INK; g.lineWidth = s * 0.02; g.stroke();
    g.strokeStyle = 'rgba(140,100,40,0.7)'; g.lineWidth = s * 0.01;
    for (let i = 1; i < 4; i++) { const f = i / 4; g.beginPath(); g.moveTo(cx - s * 0.22 * f + s * 0.01, cy - s * 0.27 + s * 0.22 * f); g.lineTo(cx + s * 0.24 * f + s * 0.01, cy - s * 0.27 + s * 0.22 * f); g.stroke(); }
    g.strokeStyle = '#7a4a26'; g.lineWidth = s * 0.012;
    g.beginPath(); g.moveTo(cx - s * 0.06, cy - s * 0.03); g.quadraticCurveTo(cx + s * 0.02, cy + s * 0.12, cx + s * 0.08, cy - s * 0.02); g.stroke();
  } else if (H.head === 'hat') {
    // the sun flap hanging from under the war hat: round the back of the head and forward over the ear,
    // down to the nape, in the team's colour with a gold hem
    const top = cy - s * 0.03, bot = cy + s * 0.11;
    const sway = Math.sin(time * (moving ? 10 : 2.5)) * s * (moving ? 0.015 : 0.005);
    g.beginPath();
    g.moveTo(cx + s * 0.045, top);
    g.lineTo(cx - r * 1.05, top);
    g.quadraticCurveTo(cx - r * 1.3 + sway, (top + bot) / 2, cx - r * 1.42 + sway * 1.6, bot);
    g.quadraticCurveTo(cx - r * 0.5 + sway, bot + s * 0.022, cx + s * 0.03, bot - s * 0.03);
    g.quadraticCurveTo(cx + s * 0.05, (top + bot) / 2, cx + s * 0.045, top);
    g.closePath();
    g.fillStyle = CLOTH[team] || T.main; g.fill();
    g.save(); g.clip();
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(cx - r * 2, top, r * 0.9, bot - top + s * 0.05);
    g.strokeStyle = T.dark; g.lineWidth = s * 0.008;
    for (const f of [0.3, 0.7]) { g.beginPath(); g.moveTo(cx - r * 1.05 * f, top + s * 0.02); g.quadraticCurveTo(cx - r * (1.1 * f + 0.1) + sway, (top + bot) / 2, cx - r * (1.25 * f + 0.05) + sway * 1.4, bot); g.stroke(); }
    g.restore();
    g.strokeStyle = INK; g.lineWidth = s * 0.018; g.stroke();
    g.strokeStyle = '#d6aa46'; g.lineWidth = s * 0.014;
    g.beginPath(); g.moveTo(cx - r * 1.42 + sway * 1.6, bot - s * 0.005); g.quadraticCurveTo(cx - r * 0.5 + sway, bot + s * 0.015, cx + s * 0.03, bot - s * 0.036); g.stroke();
      // an old soldier's war hat: a dark lacquered dome on a wide brim, ringed with gold, a gilt spike on top
    // pulled down low, the brim shading the eyes
    g.save(); g.translate(0, s * 0.065);
    const brimY = cy - s * 0.108;
    g.strokeStyle = INK; g.lineWidth = s * 0.02;
    // brim (the back half first)
    g.beginPath(); g.ellipse(cx + s * 0.005, brimY, s * 0.24, s * 0.05, -0.06, Math.PI, TAU); g.fillStyle = '#241c18'; g.fill(); g.stroke();
    // the dome
    const grd = g.createLinearGradient(cx - s * 0.13, 0, cx + s * 0.13, 0);
    grd.addColorStop(0, '#2a221e'); grd.addColorStop(0.55, '#4a3c34'); grd.addColorStop(1, '#221a16');
    // tall, straight-sided, round-topped: a U upside down
    const ct = cy - s * 0.3;
    g.beginPath();
    g.moveTo(cx - s * 0.118, brimY);
    g.lineTo(cx - s * 0.112, ct + s * 0.08);
    g.quadraticCurveTo(cx - s * 0.11, ct, cx, ct);
    g.quadraticCurveTo(cx + s * 0.11, ct, cx + s * 0.112, ct + s * 0.08);
    g.lineTo(cx + s * 0.118, brimY);
    g.closePath(); g.fillStyle = grd; g.fill(); g.stroke();
    // ribs and the gold bands round it
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = s * 0.008;
    for (const f of [-0.6, -0.2, 0.2, 0.6]) { g.beginPath(); g.moveTo(cx + f * s * 0.115, brimY - s * 0.004); g.lineTo(cx + f * s * 0.108, ct + s * 0.07); g.quadraticCurveTo(cx + f * s * 0.08, ct + s * 0.005, cx, ct); g.stroke(); }
    g.strokeStyle = '#d6aa46'; g.lineWidth = s * 0.022;
    g.beginPath(); g.moveTo(cx - s * 0.122, brimY - s * 0.022); g.quadraticCurveTo(cx, brimY - s * 0.006, cx + s * 0.122, brimY - s * 0.022); g.stroke();
    g.lineWidth = s * 0.012;
    g.beginPath(); g.moveTo(cx - s * 0.113, ct + s * 0.1); g.quadraticCurveTo(cx, ct + s * 0.115, cx + s * 0.113, ct + s * 0.1); g.stroke();
    // the gilt finial
    g.beginPath(); g.moveTo(cx - s * 0.035, ct + s * 0.01); g.quadraticCurveTo(cx - s * 0.02, ct - s * 0.05, cx + s * 0.005, ct - s * 0.13); g.quadraticCurveTo(cx + s * 0.025, ct - s * 0.05, cx + s * 0.04, ct + s * 0.01); g.closePath();
    g.fillStyle = '#d6aa46'; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.014; g.stroke();
    dot(g, cx + s * 0.002, ct + s * 0.002, s * 0.024, '#e8c25a', s);
    // brim (the front half, over the dome's foot)
    g.beginPath(); g.ellipse(cx + s * 0.005, brimY, s * 0.24, s * 0.05, -0.06, 0, Math.PI); g.fillStyle = '#2e2420'; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.02; g.stroke();
    g.strokeStyle = 'rgba(214,170,70,0.85)'; g.lineWidth = s * 0.008; g.beginPath(); g.ellipse(cx + s * 0.005, brimY, s * 0.225, s * 0.042, -0.06, 0.15, Math.PI - 0.15); g.stroke();
    g.restore();
  }
}
function drawMuralTorso(g, s, T, team) {
  const S = (v) => v * s, cl = CLOTH[team] || T.main;
  // the tunic
  g.fillStyle = cl; g.fill();
  g.save(); g.clip();
  g.fillStyle = 'rgba(0,0,0,0.24)'; g.fillRect(S(-0.2), S(-0.9), S(0.1), S(0.5));
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(S(0.04), S(-0.8), S(0.05), S(0.3));
  g.restore();
  g.strokeStyle = INK; g.lineWidth = s * 0.03; g.stroke();
  // the skirt of the tunic below the sash, a gold hem
  g.beginPath(); g.moveTo(S(-0.105), S(-0.47)); g.lineTo(S(0.105), S(-0.47)); g.lineTo(S(0.135), S(-0.335)); g.quadraticCurveTo(S(0), S(-0.315), S(-0.135), S(-0.335)); g.closePath();
  g.fillStyle = cl; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.016; g.stroke();
  g.strokeStyle = MURAL.trim; g.lineWidth = s * 0.016;
  g.beginPath(); g.moveTo(S(0.13), S(-0.342)); g.quadraticCurveTo(S(0), S(-0.324), S(-0.13), S(-0.342)); g.stroke();
  // the gold petal collar over the shoulders and chest
  g.beginPath();
  g.moveTo(S(-0.13), S(-0.785)); g.quadraticCurveTo(S(0), S(-0.82), S(0.13), S(-0.785));
  g.quadraticCurveTo(S(0.1), S(-0.7), S(0.01), S(-0.68)); g.quadraticCurveTo(S(-0.09), S(-0.7), S(-0.13), S(-0.785)); g.closePath();
  const cg = g.createLinearGradient(S(-0.13), 0, S(0.13), 0); cg.addColorStop(0, '#a07a2a'); cg.addColorStop(0.6, '#f2d27a'); cg.addColorStop(1, '#c69a3a');
  g.fillStyle = cg; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.016; g.stroke();
  // its petals along the lower edge
  for (let i = 0; i < 5; i++) {
    const u = (i + 0.5) / 5, px = S(-0.115 + 0.23 * u), py = S(-0.775 + Math.sin(u * Math.PI) * 0.085);
    g.beginPath(); g.moveTo(px - S(0.026), py - S(0.01)); g.quadraticCurveTo(px, py + S(0.05), px + S(0.026), py - S(0.01)); g.closePath();
    g.fillStyle = '#e0b445'; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.01; g.stroke();
    dot(g, px, py + S(0.008), s * 0.007, '#b8321e', s * 0.4);
  }
  g.strokeStyle = 'rgba(120,80,20,0.7)'; g.lineWidth = s * 0.006;
  g.beginPath(); g.moveTo(S(-0.1), S(-0.775)); g.quadraticCurveTo(S(0), S(-0.8), S(0.1), S(-0.775)); g.stroke();
  // the gold sash, its tail hanging at the front
  g.beginPath(); g.moveTo(S(-0.105), S(-0.525)); g.quadraticCurveTo(S(0), S(-0.51), S(0.105), S(-0.525)); g.lineTo(S(0.108), S(-0.455)); g.quadraticCurveTo(S(0), S(-0.44), S(-0.108), S(-0.455)); g.closePath();
  const sg = g.createLinearGradient(0, S(-0.525), 0, S(-0.45)); sg.addColorStop(0, '#f2d27a'); sg.addColorStop(1, '#b8892e');
  g.fillStyle = sg; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.014; g.stroke();
  g.strokeStyle = '#b8321e'; g.lineWidth = s * 0.006;
  g.beginPath(); g.moveTo(S(-0.1), S(-0.49)); g.quadraticCurveTo(S(0), S(-0.476), S(0.1), S(-0.49)); g.stroke();
  g.beginPath(); g.moveTo(S(0.02), S(-0.47)); g.quadraticCurveTo(S(0.0), S(-0.37), S(0.025), S(-0.27)); g.lineTo(S(0.07), S(-0.28)); g.quadraticCurveTo(S(0.05), S(-0.37), S(0.065), S(-0.46)); g.closePath();
  g.fillStyle = '#d9a83c'; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.012; g.stroke();
  g.strokeStyle = '#b8321e'; g.lineWidth = s * 0.008; g.beginPath(); g.moveTo(S(0.025), S(-0.285)); g.lineTo(S(0.07), S(-0.295)); g.stroke();
}
function drawCreepTorso(g, s, T, team) {
  const S = (v) => v * s, ink = CREEPWEAR.ink;
  g.fillStyle = SKIN; g.fill();
  g.save(); g.clip();
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(S(-0.2), S(-0.9), S(0.09), S(0.5));
  // the chest and the belly
  g.strokeStyle = 'rgba(40,20,8,0.45)'; g.lineWidth = s * 0.01;
  g.beginPath(); g.moveTo(S(-0.06), S(-0.66)); g.quadraticCurveTo(S(0.03), S(-0.62), S(0.12), S(-0.67)); g.stroke();
  g.beginPath(); g.moveTo(S(0.04), S(-0.6)); g.lineTo(S(0.045), S(-0.5)); g.stroke();
  // sak yant: rows of script across the chest, a pointed yant in the middle, lines down the belly
  g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = s * 0.007;
  for (const [y0, x0, x1] of [[-0.755, -0.08, 0.1], [-0.725, -0.09, 0.11]]) {
    for (let x = x0; x < x1; x += 0.018) { g.beginPath(); g.arc(S(x), S(y0 + Math.sin(x * 40) * 0.004), s * 0.005, 0, Math.PI); g.stroke(); }
  }
  g.beginPath(); g.moveTo(S(0.02), S(-0.705)); g.lineTo(S(-0.03), S(-0.6)); g.lineTo(S(0.07), S(-0.6)); g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(S(0.02), S(-0.69)); g.lineTo(S(0.02), S(-0.61)); g.moveTo(S(-0.012), S(-0.635)); g.lineTo(S(0.052), S(-0.635)); g.stroke();
  for (let x = -0.02; x < 0.07; x += 0.016) { g.beginPath(); g.arc(S(x), S(-0.585), s * 0.004, 0, TAU); g.fill(); }
  for (const x of [-0.06, 0.09]) { g.beginPath(); g.moveTo(S(x), S(-0.69)); for (let y = -0.69; y < -0.52; y += 0.02) g.lineTo(S(x + (Math.round((y + 1) * 50) % 2 ? 0.008 : -0.008)), S(y)); g.stroke(); }
  g.restore();
  g.strokeStyle = INK; g.lineWidth = s * 0.03; g.stroke();
  // the amulet on a cord
  g.strokeStyle = '#3a2414'; g.lineWidth = s * 0.008;
  g.beginPath(); g.moveTo(S(-0.07), S(-0.79)); g.quadraticCurveTo(S(0.0), S(-0.7), S(0.09), S(-0.79)); g.stroke();
  g.beginPath(); g.ellipse(S(0.022), S(-0.722), s * 0.016, s * 0.022, 0, 0, TAU); g.fillStyle = '#d9a83c'; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.008; g.stroke();
  dot(g, S(0.022), S(-0.722), s * 0.006, '#9a2a1e', s * 0.4);
  // the wrap rolled at the waist, knotted at the front in his side's colour
  g.beginPath(); g.moveTo(S(-0.105), S(-0.515)); g.quadraticCurveTo(S(0), S(-0.5), S(0.105), S(-0.515)); g.lineTo(S(0.11), S(-0.45)); g.quadraticCurveTo(S(0), S(-0.435), S(-0.11), S(-0.45)); g.closePath();
  g.fillStyle = CREEPWEAR.pants; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.014; g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = s * 0.006;
  g.beginPath(); g.moveTo(S(-0.1), S(-0.483)); g.quadraticCurveTo(S(0), S(-0.47), S(0.1), S(-0.483)); g.stroke();
  dot(g, S(0.06), S(-0.483), s * 0.024, T.main, s * 0.8);
  g.beginPath(); g.moveTo(S(0.055), S(-0.465)); g.lineTo(S(0.045), S(-0.4)); g.lineTo(S(0.075), S(-0.405)); g.closePath(); g.fillStyle = T.dark; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.008; g.stroke();
}
// the spearman's tall pointed helmet, flaps over the ears
function drawMuralHelm(g, s, cx, cy, r, team, time, moving) {
  const T = TEAM[team], cl = CLOTH[team] || T.main;
  const sway = Math.sin(time * (moving ? 10 : 2.5)) * s * (moving ? 0.01 : 0.004);
  // the ear flap, from under the brim down past the jaw
  const top = cy - s * 0.06, bot = cy + s * 0.075, fx = cx + s * 0.002;
  g.beginPath(); g.moveTo(fx, top); g.lineTo(cx - r * 1.0, top);
  g.quadraticCurveTo(cx - r * 1.1 + sway, (top + bot) / 2, cx - r * 0.9 + sway, bot);
  g.quadraticCurveTo(cx - s * 0.05, bot + s * 0.016, fx - s * 0.005, bot - s * 0.012);
  g.quadraticCurveTo(fx + s * 0.012, (top + bot) / 2, fx, top); g.closePath();
  g.fillStyle = cl; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.016; g.stroke();
  g.strokeStyle = '#e0b445'; g.lineWidth = s * 0.012;
  g.beginPath(); g.moveTo(cx - r * 0.9 + sway, bot - s * 0.006); g.quadraticCurveTo(cx - s * 0.05, bot + s * 0.008, fx - s * 0.006, bot - s * 0.018); g.quadraticCurveTo(fx + s * 0.008, (top + bot) / 2, fx, top + s * 0.01); g.stroke();
  // the tall cone, its sides drawn in a little toward the point
  const by = cy - s * 0.07, ty = cy - s * 0.46, bw = s * 0.13;
  g.beginPath();
  g.moveTo(cx - bw, by);
  g.quadraticCurveTo(cx - bw * 0.62, cy - s * 0.24, cx - s * 0.012, ty);
  g.lineTo(cx + s * 0.012, ty);
  g.quadraticCurveTo(cx + bw * 0.62, cy - s * 0.24, cx + bw, by);
  g.quadraticCurveTo(cx, by + s * 0.03, cx - bw, by); g.closePath();
  const hg = g.createLinearGradient(cx - bw, 0, cx + bw, 0); hg.addColorStop(0, T.dark); hg.addColorStop(0.55, cl); hg.addColorStop(1, T.dark);
  g.fillStyle = hg; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.018; g.stroke();
  // gold bands up the cone
  g.save(); g.clip();
  const band = (y, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(cx - bw * 1.2, y + s * 0.012); g.quadraticCurveTo(cx, y + s * 0.03, cx + bw * 1.2, y + s * 0.012); g.stroke(); };
  band(by - s * 0.01, s * 0.04, '#e0b445');
  band(by - s * 0.012, s * 0.008, '#b8321e');
  for (const f of [0.3, 0.5, 0.68]) band(by + (ty - by) * f, s * 0.016, '#e0b445');
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(cx + s * 0.015, ty, s * 0.03, by - ty);
  g.restore();
  // the gilt spike
  g.beginPath(); g.moveTo(cx - s * 0.018, ty + s * 0.01); g.lineTo(cx, ty - s * 0.1); g.lineTo(cx + s * 0.018, ty + s * 0.01); g.closePath();
  g.fillStyle = '#e8c25a'; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.01; g.stroke();
  dot(g, cx, ty + s * 0.005, s * 0.02, '#e0b445', s * 0.8);
}
// the little round shield on the back arm: gold, a red rim, a demon's face. For show only
function drawMuralShield(g, x, y, s) {
  const R = s * 0.125;
  g.save(); g.translate(x, y);
  g.beginPath(); g.ellipse(0, 0, R * 0.9, R, 0, 0, TAU);
  g.fillStyle = '#9e2a1e'; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.016; g.stroke();
  g.beginPath(); g.ellipse(0, 0, R * 0.72, R * 0.8, 0, 0, TAU);
  const gg = g.createRadialGradient(-R * 0.2, -R * 0.3, R * 0.1, 0, 0, R); gg.addColorStop(0, '#f6dc8a'); gg.addColorStop(1, '#b8892e');
  g.fillStyle = gg; g.fill(); g.strokeStyle = 'rgba(90,50,10,0.8)'; g.lineWidth = s * 0.006; g.stroke();
  // the face: brows, round eyes, fangs
  g.strokeStyle = '#5a1a0e'; g.lineWidth = s * 0.008; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-R * 0.48, -R * 0.36); g.quadraticCurveTo(-R * 0.25, -R * 0.5, -R * 0.06, -R * 0.26); g.moveTo(R * 0.48, -R * 0.36); g.quadraticCurveTo(R * 0.25, -R * 0.5, R * 0.06, -R * 0.26); g.stroke();
  for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * R * 0.27, -R * 0.12, R * 0.13, 0, TAU); g.fillStyle = '#b8321e'; g.fill(); g.stroke(); dot(g, sx * R * 0.27, -R * 0.12, R * 0.04, '#1a0c06', s * 0.2); }
  g.beginPath(); g.moveTo(-R * 0.36, R * 0.24); g.quadraticCurveTo(0, R * 0.5, R * 0.36, R * 0.24); g.stroke();
  g.fillStyle = '#fff4dc';
  for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * R * 0.24, R * 0.3); g.lineTo(sx * R * 0.17, R * 0.52); g.lineTo(sx * R * 0.1, R * 0.34); g.closePath(); g.fill(); }
  dot(g, 0, R * 0.62, R * 0.07, '#b8321e', s * 0.3);
  g.restore();
}
function drawCape(g, s, team, time, moving) {
  const T = TEAM[team];
  const w1 = Math.sin(time * (moving ? 9 : 3)) * s * (moving ? 0.05 : 0.02);
  const w2 = Math.sin(time * (moving ? 9 : 3) + 1.2) * s * (moving ? 0.06 : 0.02);
  const back = moving ? 0.1 : 0;
  g.beginPath();
  g.moveTo(-0.07 * s, -0.79 * s);
  g.quadraticCurveTo((-0.3 - back) * s + w1, -0.5 * s, (-0.34 - back * 1.8) * s + w2, -0.14 * s);
  g.lineTo((-0.12 - back) * s + w1 * 0.5, -0.12 * s);
  g.quadraticCurveTo(-0.1 * s, -0.5 * s, 0.03 * s, -0.79 * s);
  g.closePath();
  g.fillStyle = T.dark;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = s * 0.024;
  g.stroke();
  g.strokeStyle = '#e2be5c';
  g.lineWidth = s * 0.014;
  g.beginPath();
  g.moveTo((-0.33 - back * 1.8) * s + w2, -0.16 * s);
  g.lineTo((-0.13 - back) * s + w1 * 0.5, -0.14 * s);
  g.stroke();
}
function drawBackFlag(g, s, team, time) {
  const T = TEAM[team];
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = INK;
  g.lineWidth = s * 0.05;
  g.beginPath();
  g.moveTo(-0.1 * s, -0.4 * s);
  g.lineTo(-0.2 * s, -1.55 * s);
  g.stroke();
  g.strokeStyle = '#6b4424';
  g.lineWidth = s * 0.028;
  g.stroke();
  const hx = -0.2 * s, hy = -1.5 * s, len = 0.45 * s, half = 0.12 * s;
  g.beginPath();
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const f = Math.sin(time * 7 + t * 4.4) * half * 0.6 * t;
    if (i) g.lineTo(hx - len * t, hy - half + f + t * half * 0.4);
    else g.moveTo(hx, hy - half);
  }
  for (let i = 8; i >= 0; i--) {
    const t = i / 8;
    const f = Math.sin(time * 7 + 0.7 + t * 4.4) * half * 0.6 * t;
    g.lineTo(hx - len * t, hy + half + f - t * half * 0.4);
  }
  g.closePath();
  g.fillStyle = T.main;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = s * 0.02;
  g.stroke();
  dot(g, hx, hy - half - s * 0.03, s * 0.03, '#e6c56a', s);
  g.restore();
}

// ---------- poses: where the hands, weapons and legs are (in units of the man's height, facing right) ----------
function basePose(a) {
  const H = a.hero;
  const P = { liftS: 0, spin: 0, lean: 0, crouch: 0, bob: 0, legs: null, fh: [0.17, -0.5], fa: -1.15, bh: [-0.1, -0.5], ba: -1.6, spear: null, bowDraw: 0, arrow: false, glow: 0, shieldK: 1, frontBehind: false, backFront: false };
  const ph = Math.sin(a.run * TAU);
  const sw = a.moving ? ph : 0;
  if (a.moving) {
    P.legs = { fa: ph * 0.6, ba: -ph * 0.6, fk: 0.15 + Math.max(0, -ph) * 0.95, bk: 0.15 + Math.max(0, ph) * 0.95 };
    P.bob = -(1 - Math.abs(ph)) * 0.035;
    P.lean = 0.07;
  } else {
    P.legs = { fa: 0.08, ba: -0.07, fk: 0.04, bk: 0.05 };
    P.bob = Math.sin(a.time * 2.6 + a.seed) * 0.006;
  }
  switch (H.weapon) {
    case 'sword': P.fh = [0.17 + 0.05 * sw, -0.5]; P.fa = -1.1 + 0.12 * sw; P.bh = [-0.1 - 0.07 * sw, -0.49]; break;
    case 'twin': P.fh = [0.17 + 0.05 * sw, -0.5]; P.fa = -1.15; P.bh = [-0.04 - 0.06 * sw, -0.52]; P.ba = -1.95; break;
    case 'spear':
      if (a.spearOut) { P.fh = [0.17 + 0.03 * sw, -0.68]; P.bh = [0.07 - 0.03 * sw, -0.72]; P.spear = null; break; } // fists up
      P.fh = [0.15, -0.53]; P.spear = { g: [0.15, -0.53], a: -Math.PI / 2 + 0.18 }; P.bh = [-0.08 - 0.06 * sw, -0.48];
      if (a.readyDir && typeof localAim === 'function') {
        // a target in reach: the spear levels at it, cocked to strike
        spearAt(P, localAim(a.face, a.readyDir), -0.12);
        if (!a.moving) P.legs = { fa: 0.4, ba: -0.4, fk: 0.3, bk: 0.12 };
        P.crouch = 0.06;
      }
      break;
    case 'axe':
      if (a.axeOut >= 2) { P.fh = [0.17 + 0.03 * sw, -0.68]; P.bh = [0.07 - 0.03 * sw, -0.72]; break; } // fists up
      P.fh = [0.18 + 0.05 * sw, -0.52]; P.fa = -1.2 + 0.1 * sw; P.bh = [-0.1 - 0.05 * sw, -0.5]; P.ba = -1.55; break;
    case 'shield': P.fh = [0.18, -0.53]; P.bh = [-0.08 - 0.06 * sw, -0.48]; P.ba = -0.95; break;
    case 'bow': P.fh = [0.19, -0.52]; P.fa = 0.3 + 0.12 * sw; P.bh = [-0.07 - 0.05 * sw, -0.48]; break;
  }
  return P;
}
const RAISED_F = { h: [-0.02, -0.9], a: -2.7 };
const STRUCK_F = { h: [0.27, -0.46], a: 0.95 };
// one swing of a hand-held blade / axe: wind up over the head, cut down in front, ease back
function swing(P, back, q, axe) {
  if (q <= 0) return;
  const h0 = back ? P.bh : P.fh, a0 = back ? P.ba : P.fa;
  const rh = back ? [-0.07, -0.9] : RAISED_F.h, ra = axe ? -2.35 : back ? -2.85 : RAISED_F.a;
  const sh = back ? [0.22, -0.47] : STRUCK_F.h, sa = axe ? 0.7 : back ? 1.05 : STRUCK_F.a;
  let h, a;
  if (q < 0.4) { const k = ease(q / 0.4); h = [lerp(h0[0], rh[0], k), lerp(h0[1], rh[1], k)]; a = lerp(a0, ra, k); P.lean += -0.08 * k; }
  else if (q < 0.62) { const k = ease((q - 0.4) / 0.22); h = [lerp(rh[0], sh[0], k), lerp(rh[1], sh[1], k)]; a = lerp(ra, sa, k); P.lean += lerp(-0.08, 0.18, k); if (back) P.backFront = k > 0.3; }
  else if (q < 1) { const k = ease((q - 0.62) / 0.38); h = [lerp(sh[0], h0[0], k), lerp(sh[1], h0[1], k)]; a = lerp(sa, a0, k); P.lean += 0.18 * (1 - k); if (back) P.backFront = k < 0.5; }
  else return;
  if (back) { P.bh = h; P.ba = a; } else { P.fh = h; P.fa = a; }
  if (q > 0.35 && q < 0.8) P.legs = { fa: 0.45, ba: -0.45, fk: 0.3, bk: 0.12 };
}
function thrustCurve(p, strike) {
  if (p < strike * 0.45) return -0.12 * (p / (strike * 0.45));
  if (p < strike) return -0.12 + 1.12 * ((p - strike * 0.45) / (strike * 0.55));
  return Math.max(0, 1 - (p - strike) / (1 - strike));
}
function spearAt(P, la, ext) {
  const d = [Math.cos(la), Math.sin(la)];
  const g = [0.05 + d[0] * (0.16 + ext * 0.46), -0.62 + d[1] * (0.16 + ext * 0.46)];
  P.spear = { g, a: la };
  P.fh = g;
  P.bh = [g[0] - d[0] * 0.3, g[1] - d[1] * 0.3];
}
function spearGrip(P, ang, g) {
  P.spear = { g, a: ang };
  P.fh = g;
  P.bh = [g[0] - Math.cos(ang) * 0.3, g[1] - Math.sin(ang) * 0.3];
}
function wide(P, k = 1) { P.legs = { fa: 0.55 * k, ba: -0.55 * k, fk: 0.35, bk: 0.12 }; }
function tuck(P) { P.legs = { fa: 1.1, ba: 0.55, fk: 2.0, bk: 2.1 }; }

function poseOf(a) {
  const P = basePose(a);
  const c = a.act;
  if (!c && a.aimPose) {
    const la = localAim(a.face, a.aimPose.dir), d = [Math.cos(la), Math.sin(la)];
    const k = a.aimPose.k;
    if (a.hero.weapon === 'bow') {
      // holding the aim: bow at full draw, the arrow glowing, ready to fly
      P.fa = la; P.fh = [0.05 + d[0] * 0.3, -0.64 + d[1] * 0.3];
      P.bowDraw = 1; P.arrow = true; P.glow = k === 'snipe' ? 0 : 0.6 + 0.4 * Math.sin(a.time * 10);
      if (k === 'snipe') P.fire = a.time + 0.001;
      if (!a.moving) wide(P, 0.7);
    } else if (k === 'sweep') {
      // spear cocked back, pointing behind, ready to swing
      spearGrip(P, la - Math.PI + 0.3, [-0.04, -0.62]);
      P.lean = -0.12; P.crouch = 0.14; if (!a.moving) wide(P, 1.1);
    } else if (k === 'throwSpear') {
      // javelin drawn back over the shoulder, legs braced, sinking a little
      spearGrip(P, la - 0.5, [-0.15, -0.86]);
      P.bh = [0.2, -0.55];
      P.lean = -0.14; P.crouch = 0.16; if (!a.moving) wide(P, 1.15);
      P.glow = 0.5 + 0.5 * Math.sin(a.time * 9);
    } else if (k === 'lungeThrust') {
      spearAt(P, la, -0.15);
      P.lean = 0.16; P.crouch = 0.2; if (!a.moving) wide(P, 1.2);
    } else if (k === 'throwAxe') {
      // the arm drawn right back behind the head, the axe cocked, the other hand out in front for balance
      const br = 0.5 + 0.5 * Math.sin(a.time * 7);
      P.fh = [-0.2 - 0.015 * br, -0.9]; P.fa = -2.75 - 0.06 * br;
      P.bh = [0.24, -0.6]; P.ba = -0.9; P.backFront = true;
      P.lean = -0.2; P.crouch = 0.1; if (!a.moving) wide(P, 1.15);
    } else if (k === 'leap') {
      // sunk on his haunches, arms flung wide, an axe out to either side, head down: about to spring
      const br = 0.5 + 0.5 * Math.sin(a.time * 8);
      P.crouch = 0.42 + 0.06 * br; P.lean = 0.1;
      P.fh = [0.37, -0.56 + 0.02 * br]; P.fa = -0.55;
      P.bh = [-0.36, -0.56 + 0.02 * br]; P.ba = Math.PI + 0.55;
      if (!a.moving) wide(P, 1.3);
    }
    return P;
  }
  if (!c) return P;
  const p = clamp(c.t / c.dur, 0, 1);
  const la = c.la || 0;
  const W = a.hero.weapon;
  switch (c.k) {
    case 'slash': swing(P, false, p); break;
    case 'twin': swing(P, false, p / 0.62); swing(P, true, (p - 0.38) / 0.62); break;
    case 'chop2': swing(P, false, p / 0.6, true); swing(P, true, (p - 0.4) / 0.6, true); break;
    case 'creepCut': {
      const L = (A, B, k) => [lerp(A[0], B[0], k), lerp(A[1], B[1], k)];
      const idleF = [0.17, -0.5], idleB = [-0.04, -0.52];
      if (p < 0.3) {
        // the step in: lead blade up and back over the shoulder, the other held low across the body
        const k = ease(p / 0.3);
        P.fh = L(idleF, [-0.02, -0.96], k); P.fa = lerp(-1.15, -2.45, k);
        P.bh = L(idleB, [0.14, -0.52], k); P.ba = lerp(-1.95, -0.5, k); P.backFront = k > 0.5;
        P.lean = -0.14 * k; P.legs = { fa: 0.5 * k, ba: -0.3 * k, fk: 0.25 * k, bk: 0.1 };
      } else if (p < 0.42) {
        // down across him
        const k = ease((p - 0.3) / 0.12);
        P.fh = L([-0.02, -0.96], [0.36, -0.42], k); P.fa = lerp(-2.45, 0.85, k);
        P.bh = [0.14, -0.52]; P.ba = -0.5; P.backFront = true;
        P.lean = lerp(-0.14, 0.26, k); P.crouch = 0.12 * k; P.legs = { fa: 0.55, ba: -0.45, fk: 0.35, bk: 0.12 };
      } else if (p < 0.6) {
        // the beat: weight forward, the second blade drawn back out wide
        const k = ease((p - 0.42) / 0.18);
        P.fh = L([0.36, -0.42], [0.26, -0.46], k); P.fa = lerp(0.85, 0.5, k);
        P.bh = L([0.14, -0.52], [-0.3, -0.64], k); P.ba = lerp(-0.5, -2.9, k);
        P.lean = lerp(0.26, 0.05, k); P.crouch = 0.12; P.legs = { fa: 0.55, ba: -0.45, fk: 0.35, bk: 0.12 };
      } else if (p < 0.74) {
        // through, level
        const k = ease((p - 0.6) / 0.14);
        P.fh = [0.26, -0.46]; P.fa = 0.5;
        P.bh = L([-0.3, -0.64], [0.38, -0.6], k); P.ba = lerp(-2.9, 0.15, k); P.backFront = k > 0.25;
        P.lean = lerp(0.05, 0.24, k); P.crouch = 0.1; P.legs = { fa: 0.6, ba: -0.5, fk: 0.3, bk: 0.1 };
      } else {
        const k = ease((p - 0.74) / 0.26);
        P.fh = L([0.26, -0.46], idleF, k); P.fa = lerp(0.5, -1.15, k);
        P.bh = L([0.38, -0.6], idleB, k); P.ba = lerp(0.15, -1.95, k); P.backFront = k < 0.5;
        P.lean = 0.24 * (1 - k); P.crouch = 0.1 * (1 - k); P.legs = { fa: 0.6 * (1 - k) + 0.08, ba: -0.5 * (1 - k) - 0.07, fk: 0.3 * (1 - k), bk: 0.1 };
      }
      break;
    }
    case 'chop1': swing(P, false, p / 0.92, true); P.bh = [-0.14, -0.6]; break;
    case 'stab': {
      P.fh = [0.15, -0.6];
      if (p < 0.35) { const k = ease(p / 0.35); P.bh = [lerp(-0.08, -0.16, k), lerp(-0.48, -0.57, k)]; P.ba = lerp(-0.95, -0.25, k); }
      else if (p < 0.55) { const k = ease((p - 0.35) / 0.2); P.bh = [lerp(-0.16, 0.34, k), lerp(-0.57, -0.52, k)]; P.ba = lerp(-0.25, 0, k); P.backFront = true; P.lean = 0.15 * k; P.fh = [0.12, -0.66]; wide(P); }
      else { const k = ease((p - 0.55) / 0.45); P.bh = [lerp(0.34, -0.08, k), lerp(-0.52, -0.48, k)]; P.ba = lerp(0, -0.95, k); P.backFront = k < 0.5; }
      break;
    }
    case 'thrust': spearAt(P, la, thrustCurve(p, 0.18)); P.lean = 0.12; if (p < 0.6) wide(P); break;
    case 'sweep': {
      // a full overhead swing from behind, through the top, down onto the target
      const k = p < 0.34 ? Math.pow(p / 0.34, 1.6) : 1;
      const ang = lerp(la - Math.PI + 0.3, la + 0.35, k);
      const g = [lerp(-0.04, 0.14, k), lerp(-0.62, -0.56, k)];
      spearGrip(P, ang, g);
      P.lean = lerp(-0.12, 0.24, k) * (p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1);
      P.crouch = 0.12;
      wide(P, 1.1);
      break;
    }
    case 'lungeThrust': {
      const rush = c.rush || c.dur * 0.8;
      if (c.combo) {
        const ct = c.t - c.combo.t0;
        if (ct < 0.1) { spearAt(P, la, 0.5); P.lean = 0.26; P.crouch = 0.12; P.legs = { fa: 0.8, ba: -0.75, fk: 0.45, bk: 0.1 }; }
        else if (ct < 0.34) {
          // wheel the skewered man up over the head and round behind
          const q = ease((ct - 0.1) / 0.24), ang = lerp(la, -Math.PI - la, q);
          spearGrip(P, ang, [0.05 - 0.08 * q, -0.66 - 0.16 * Math.sin(q * Math.PI)]);
          P.bh = [P.fh[0] - Math.cos(ang) * 0.26, P.fh[1] - Math.sin(ang) * 0.26];
          P.lean = lerp(0.22, -0.2, q); P.crouch = 0.08; wide(P, 1.2);
        } else {
          // slammed down behind him, the follow-through
          const q = easeOut(clamp((ct - 0.34) / 0.16, 0, 1)), ang = -Math.PI - la - 0.75 * q;
          spearGrip(P, ang, [-0.08, -0.6 + 0.06 * q]);
          P.bh = [P.fh[0] - Math.cos(ang) * 0.26, P.fh[1] - Math.sin(ang) * 0.26];
          P.lean = -0.2 + 0.08 * q; P.crouch = 0.2 * q; wide(P, 1.25);
        }
      } else if (c.t < rush) { spearAt(P, la, 0.45); P.lean = 0.34; P.crouch = 0.1; const run = Math.sin(c.t * 34); P.legs = { fa: 0.8 * run, ba: -0.8 * run, fk: 0.45, bk: 0.3 }; }
      else { const q = clamp((c.t - rush) / Math.max(0.05, c.dur - rush), 0, 1); spearAt(P, la, 0.45 * (1 - q)); P.lean = 0.2; wide(P); }
      break;
    }
    case 'spearKick': {
      // hands locked on the shaft, knee drawn up, then the heel driven out into his chest
      P.fh = [0.36, -0.66]; P.bh = [0.28, -0.68];
      if (p < 0.48) { const q = ease(p / 0.48); P.legs = { fa: 0.95 * q, ba: -0.12 * q, fk: 1.5 * q, bk: 0.1 }; P.lean = -0.12 * q; }
      else { const r = 1 - ease(clamp((p - 0.48) / 0.52, 0, 1)); P.legs = { fa: 0.15 + 1.4 * r, ba: -0.25 * r, fk: 0.05 + 0.3 * (1 - r), bk: 0.15 }; P.lean = -0.32 * r; }
      break;
    }
    case 'punch': {
      const q = p < 0.42 ? ease(p / 0.42) : 1 - ease((p - 0.42) / 0.58);
      P.fh = [lerp(0.17, 0.4, q), lerp(-0.68, -0.66, q)];
      P.lean = 0.16 * q;
      wide(P, 0.9);
      break;
    }
    case 'lowRoll':
      P.spin = p * TAU; P.crouch = 0.5; P.liftS = 0.03; tuck(P);
      P.fh = [0.12, -0.6]; P.bh = [0.04, -0.62];
      break;
    case 'starJump':
      P.liftS = Math.sin(p * Math.PI) * 1.5;
      if (p < 0.85) { P.fh = [0.3, -1.02]; P.bh = [-0.3, -1.0]; P.legs = { fa: 0.78, ba: -0.78, fk: 0.04, bk: 0.04 }; P.lean = -0.04; }
      else { P.crouch = 0.3; wide(P); }
      break;
    case 'slide': {
      // dropping back onto one hip, lead leg out in front, a hand trailing in the dirt
      const down = p < 0.12 ? ease(p / 0.12) : p > 0.84 ? 1 - ease((p - 0.84) / 0.16) : 1;
      P.lean = -0.75 * down; P.crouch = 0.45 * down;
      P.legs = { fa: lerp(0.1, 1.35, down), ba: lerp(-0.1, 0.5, down), fk: lerp(0.1, 0.1, down), bk: lerp(0.1, 1.6, down) };
      P.fh = [lerp(0.17, 0.3, down), lerp(-0.5, -0.72, down)]; P.bh = [lerp(-0.1, -0.32, down), lerp(-0.5, -0.12, down)];
      break;
    }
    case 'prone': {
      const fall = p < 0.075 ? p / 0.075 : p > 0.93 ? (1 - p) / 0.07 : 1;
      P.fall = -fall;
      P.fh = [0.32, -0.8]; P.bh = [0.24, -0.76];
      P.legs = { fa: 0.04, ba: -0.04, fk: 0.02, bk: 0.02 };
      break;
    }
    case 'throwSpear':
      if (p < 0.12) {
        const k = 1;
        const a2 = la - 0.5 * k;
        const g2 = [0.05 - 0.2 * k, -0.62 - 0.24 * k];
        P.spear = { g: g2, a: a2 };
        P.fh = g2;
        P.bh = [0.2, -0.55];
        P.lean = -0.14 * k;
        wide(P, k);
      } else { P.spear = null; P.fh = [0.36, -0.58]; P.bh = [-0.18, -0.5]; P.lean = 0.22; wide(P, 1.15); }
      break;
    case 'dashSlash': case 'twinDash':
      if (p < 0.68) { P.lean = 0.32; P.crouch = 0.14; P.legs = { fa: 0.75, ba: -0.75, fk: 0.45, bk: 0.1 }; P.fh = [0.3, -0.48]; P.fa = 0.3; P.bh = [-0.2, -0.56]; P.ba = W === 'twin' ? -2.6 : -1.6; }
      else { swing(P, false, 0.4 + ((p - 0.68) / 0.32) * 0.6); if (W === 'twin') swing(P, true, 0.4 + ((p - 0.68) / 0.32) * 0.6); }
      break;
    case 'step': P.crouch = 0.28; P.lean = 0.12; wide(P, 1.1); P.fh = [0.24, -0.6]; P.bh = [-0.22, -0.6]; P.fa = -0.6; break;
    case 'spin': case 'twinSpin': {
      const th = c.t * 13;
      P.fh = [0.04 + Math.cos(th) * 0.28, -0.6 + Math.sin(th) * 0.07];
      P.fa = Math.atan2(Math.sin(th) * 0.25, Math.cos(th));
      P.frontBehind = Math.sin(th) < 0;
      if (c.k === 'twinSpin') {
        const t2 = th + Math.PI;
        P.bh = [0.0 + Math.cos(t2) * 0.28, -0.6 + Math.sin(t2) * 0.07];
        P.ba = Math.atan2(Math.sin(t2) * 0.25, Math.cos(t2));
        P.backFront = Math.sin(t2) > 0;
      }
      P.crouch = 0.1;
      if (!a.moving) wide(P, 0.8);
      break;
    }
    case 'roll':
      P.spin = p * TAU;
      P.crouch = 0.3;
      P.liftS = Math.sin(p * Math.PI) * 0.25;
      tuck(P);
      P.fh = [0.12, -0.6]; P.fa = -0.4; P.bh = [0.02, -0.62]; P.ba = -0.7;
      break;
    case 'throwAxe':
      if (p < 0.42) { const k = ease(p / 0.42); P.fh = [lerp(0.17, -0.05, k), lerp(-0.5, -0.93, k)]; P.fa = lerp(-1.35, -2.6, k); P.lean = -0.1 * k; }
      else { const k = ease((p - 0.42) / 0.3); P.fh = [lerp(-0.05, 0.32, k), lerp(-0.93, -0.58, k)]; P.fa = lerp(-2.6, 0.6, k); P.lean = 0.16 * k; wide(P); }
      break;
    case 'leap': {
      if (!c.landed) {
        const q = clamp(c.t / (c.fly || c.dur), 0, 1);
        P.liftS = Math.sin(q * Math.PI) * (c.h || 1.5);
        if (q < 0.12) { const k = q / 0.12; P.crouch = 0.45 * (1 - k); P.lean = 0.2 * (1 - k); P.fh = [0.37, -0.56]; P.fa = -0.55; P.bh = [-0.36, -0.56]; P.ba = Math.PI + 0.55; wide(P, 1.3); }
        else if (q < 0.62) {
          // going up and over: knees tucked, arms still wide, the axes like wings
          const k = ease((q - 0.12) / 0.5);
          tuck(P); P.lean = lerp(-0.1, 0.12, k);
          P.fh = [lerp(0.37, 0.3, k), lerp(-0.56, -0.86, k)]; P.fa = lerp(-0.55, -1.3, k);
          P.bh = [lerp(-0.36, -0.3, k), lerp(-0.56, -0.9, k)]; P.ba = lerp(Math.PI + 0.55, Math.PI + 1.2, k);
        } else {
          // coming down: both axes hauled up over the head, then driven at the ground
          const k = ease((q - 0.62) / 0.38);
          P.lean = lerp(0.12, 0.42, k);
          P.fh = [lerp(0.06, 0.32, k * k), lerp(-1.0, -0.5, k * k)]; P.fa = lerp(-2.5, 0.75, k * k);
          P.bh = [lerp(-0.04, 0.24, k * k), lerp(-0.98, -0.52, k * k)]; P.ba = lerp(-2.75, 0.85, k * k); P.backFront = true;
          P.legs = { fa: 0.5 * k, ba: -0.5 * k, fk: 0.9 - 0.5 * k, bk: 0.9 - 0.3 * k };
        }
        break;
      }
      const ct = c.combo ? c.t - c.combo.t0 : -1;
      if (ct < 0 || c.combo.cut && ct < 0.3) {
        // landed: sunk over the buried axes
        const k = clamp((c.t - (c.landT || 0)) / 0.26, 0, 1);
        P.crouch = 0.4 * (1 - k * 0.6); P.lean = 0.3 * (1 - k); wide(P, 1.2);
        P.fh = [0.3, -0.42]; P.fa = 0.9; P.bh = [0.22, -0.45]; P.ba = 1.0; P.backFront = true;
      } else if (ct < 0.16) {
        // both hands on him, heaving him up
        const k = ease(ct / 0.16);
        P.fh = [0.32, lerp(-0.45, -0.95, k)]; P.bh = [0.24, lerp(-0.45, -0.98, k)]; P.fa = -1.5; P.ba = -1.7; P.backFront = true;
        P.lean = lerp(0.25, -0.15, k); P.crouch = 0.25 * (1 - k); wide(P, 1.2);
      } else if (ct < 0.5) {
        // and down: driven into the ground, held there
        const k = ease(clamp((ct - 0.16) / 0.14, 0, 1));
        P.fh = [0.34, lerp(-0.95, -0.3, k)]; P.bh = [0.26, lerp(-0.98, -0.32, k)]; P.fa = lerp(-1.5, 0.9, k); P.ba = lerp(-1.7, 1.0, k); P.backFront = true;
        P.lean = lerp(-0.15, 0.5, k); P.crouch = 0.45 * k; wide(P, 1.3);
      } else if (ct < 0.8) {
        // heaved up into the air; the axes swing back, wide, waiting for him to come down
        const k = ease((ct - 0.5) / 0.3);
        P.fh = [lerp(0.34, -0.12, k), lerp(-0.3, -0.72, k)]; P.fa = lerp(-0.6, -2.7, k);
        P.bh = [lerp(0.26, -0.26, k), lerp(-0.32, -0.66, k)]; P.ba = lerp(-0.6, -3.0, k);
        P.lean = lerp(0.4, -0.22, k); P.crouch = lerp(0.45, 0.22, k); wide(P, 1.25);
      } else {
        // both axes up through him, crossing
        const k = ease(clamp((ct - 0.8) / 0.17, 0, 1)), r = ct > 1.02 ? ease(clamp((ct - 1.02) / 0.26, 0, 1)) : 0;
        P.fh = [lerp(-0.12, 0.34, k), lerp(-0.72, -0.98, k)]; P.fa = lerp(-2.7, -0.55, k);
        P.bh = [lerp(-0.26, 0.28, k), lerp(-0.66, -0.9, k)]; P.ba = lerp(-3.0, -0.95, k); P.backFront = k > 0.3;
        P.lean = lerp(-0.22, 0.28, k) * (1 - r); P.crouch = 0.22 * (1 - k); wide(P, 1.25);
        if (k >= 1 && !r) P.liftS = 0.08;
      }
      break;
    }
    case 'guard': P.fh = [0.23, -0.58]; P.shieldK = 1.18; P.crouch = 0.1; P.lean = 0.04; if (!a.moving) P.legs = { fa: 0.3, ba: -0.35, fk: 0.25, bk: 0.2 }; break;
    case 'bash': case 'charge': P.fh = [0.3, -0.55]; P.shieldK = 1.1; P.lean = c.k === 'charge' ? 0.3 : 0.22; P.crouch = 0.1; if (c.k === 'bash') wide(P, 1.1); break;
    case 'rally': {
      const k = ease(p / 0.3);
      P.fh = [lerp(P.fh[0], 0.12, k), lerp(P.fh[1], -1.12, k)];
      P.fa = lerp(P.fa, -Math.PI / 2 + 0.1, k);
      if (W === 'twin') { P.bh = [lerp(P.bh[0], -0.04, k), lerp(P.bh[1], -1.08, k)]; P.ba = lerp(P.ba, -Math.PI / 2 - 0.25, k); }
      P.lean = -0.1 * k;
      wide(P, 0.6);
      break;
    }
    case 'backflip':
      P.spin = -p * TAU;
      P.liftS = Math.sin(p * Math.PI) * 1.2;
      tuck(P);
      P.fh = [0.15, -0.65]; P.fa = -1.2;
      break;
    case 'loose': {
      const d = [Math.cos(la), Math.sin(la)];
      P.fa = la; P.fh = [0.05 + d[0] * 0.3, -0.64 + d[1] * 0.3];
      P.bh = [-0.08 - 0.06 * (1 - p), -0.7]; P.lean = -0.05;
      break;
    }
    case 'shoot': case 'snipe': {
      const rel = c.k === 'snipe' ? 0 : 0.55;
      if (c.k === 'snipe') P.lean = -0.16 * (1 - p);
      const d = [Math.cos(la), Math.sin(la)];
      P.fa = la;
      P.fh = [0.05 + d[0] * 0.3, -0.64 + d[1] * 0.3];
      if (p < rel) { P.bowDraw = ease(p / rel); P.arrow = true; if (c.k === 'snipe') P.glow = P.bowDraw; }
      else { P.bh = [-0.08, -0.7]; P.lean = -0.05; }
      wide(P, 0.7);
      break;
    }
    case 'volley': {
      const d = [Math.cos(c.aimNow ?? la), Math.sin(c.aimNow ?? la)];
      P.fa = c.aimNow ?? la;
      P.fh = [0.05 + d[0] * 0.3, -0.64 + d[1] * 0.3];
      const q = (p * 4.6) % 1;
      if (q < 0.65) { P.bowDraw = ease(q / 0.65); P.arrow = p < 0.86; }
      else P.bh = [-0.08, -0.7];
      wide(P, 0.7);
      break;
    }
  }
  return P;
}

// ---------- draw one man, feet at (x, y) ----------
function drawFigure(g, a, x, y, s, P, alpha = 1) {
  const H = a.hero, team = a.team, W = H.weapon;
  OUTFIT = H.id === 'archer' ? BOWMAN : H.id === 'spear' ? SPEARMAN : H.id === 'creep' ? CREEPWEAR : null;
  if (H.id === 'creep') { SKIN = CREEP_SKIN; SKIN_D = CREEP_SKIN_D; }
  BARE = H.id === 'axe';
  // axes in hand: both; one thrown, the other moves to the leading hand; (mid-throw the hand that threw is empty)
  const axN = 2 - (a.axeOut || 0), axThrown = a.act && a.act.k === 'throwAxe' && a.act.t / a.act.dur >= 0.5;
  const shieldOn = false; // the spearman no longer carries the little mural shield
  g.save();
  g.globalAlpha *= alpha;
  const lift = P.liftS * s;
  const air = clamp(lift / (s * 1.5), 0, 1);
  drawShadow(g, x, y, s * 0.26 * (1 - air * 0.4), s * 0.075 * (1 - air * 0.4), 1 - air * 0.5);
  if (a.buffT > 0) {
    const pulse = 0.75 + 0.25 * Math.sin(a.time * 6);
    g.globalAlpha *= 0.7 * pulse;
    g.drawImage(auraSprite(), x - s * 0.6, y - lift - s * 1.1, s * 1.2, s * 1.2);
    g.globalAlpha /= 0.7 * pulse;
  }
  g.translate(x, y - lift);
  g.scale(a.face, 1);
  if (P.spin) { g.translate(0, -0.45 * s); g.rotate(P.spin); g.translate(0, 0.45 * s); }
  if (P.fall) g.rotate(-P.fall * Math.PI / 2 * 0.95);
  if (P.lean) g.rotate(P.lean);
  if (P.crouch) g.scale(1 + 0.08 * P.crouch, 1 - 0.28 * P.crouch);
  if (P.bob) g.translate(0, P.bob * s);
  const t = a.time;
  if (H.head === 'crown') drawCape(g, s, team, t, a.moving);
  if (W === 'bow') drawQuiver(g, s);
  if (a.buffT > 0) drawBackFlag(g, s, team, t);

  const frontItem = () => {
    if (W === 'sword' || W === 'twin') drawBlade(g, P.fh[0] * s, P.fh[1] * s, P.fa, s * 0.5, s);
    else if (W === 'axe' && (axThrown ? false : axN >= 1)) drawAxe(g, P.fh[0] * s, P.fh[1] * s, P.fa, s);
    else if (W === 'spear' && P.spear && !a.spearOut) {
      const L = 1.75 * s, d = [Math.cos(P.spear.a), Math.sin(P.spear.a)];
      const gx = P.spear.g[0] * s, gy = P.spear.g[1] * s;
      drawSpearShape(g, gx - d[0] * L * 0.36, gy - d[1] * L * 0.36, gx + d[0] * L * 0.64, gy + d[1] * L * 0.64, team, s, 1);
      if (P.glow > 0) { g.save(); g.globalAlpha *= P.glow * 0.8; g.drawImage(auraSprite(), gx + d[0] * L * 0.6 - s * 0.22, gy + d[1] * L * 0.6 - s * 0.22, s * 0.44, s * 0.44); g.restore(); }
    }
  };
  const backItem = () => {
    if (W === 'twin') drawBlade(g, P.bh[0] * s, P.bh[1] * s, P.ba, s * 0.48, s);
    else if (W === 'axe' && (axThrown ? axN >= 1 : axN >= 2)) drawAxe(g, P.bh[0] * s, P.bh[1] * s, P.ba, s);
    else if (W === 'shield') drawBlade(g, P.bh[0] * s, P.bh[1] * s, P.ba, s * 0.24, s, true);
  };
  // the bow sets where the drawing hand goes
  let nock = null;
  if (W === 'bow' && (P.arrow || P.bowDraw > 0)) {
    const b = bowGeom(P.fh[0] * s, P.fh[1] * s, P.fa, s, P.bowDraw);
    nock = b.nock;
    P.bh = [nock[0] / s, nock[1] / s];
  }
  // behind the body
  if (P.frontBehind) { frontItem(); drawArm(g, s, SH_F, P.fh, team, true); }
  if (!P.backFront) { backItem(); drawArm(g, s, SH_B, P.bh, team, true); if (shieldOn) drawMuralShield(g, P.bh[0] * s - s * 0.06, P.bh[1] * s + s * 0.01, s); }
  drawLeg(g, s, P.legs.ba, P.legs.bk, false);
  drawLeg(g, s, P.legs.fa, P.legs.fk, true);
  drawHips(g, s, team);
  drawTorso(g, s, H, team);
  if (H.id === 'creep') { g.save(); g.translate(0.02 * s, -0.8 * s); g.scale(1.3, 1.3); g.translate(-0.02 * s, 0.8 * s); drawHead(g, s, H, team, t, a.moving); g.restore(); } // a minion's head: a size too big
  else drawHead(g, s, H, team, t, a.moving);
  if (P.backFront) { backItem(); drawArm(g, s, SH_B, P.bh, team, false); if (shieldOn) drawMuralShield(g, P.bh[0] * s - s * 0.06, P.bh[1] * s + s * 0.01, s); }
  if (!P.frontBehind) {
    if (W === 'shield') {
      drawArm(g, s, SH_F, P.fh, team, false);
      if (!P.noShield && !a.shieldBroken) drawRattanShield(g, (P.fh[0] + 0.04) * s, P.fh[1] * s, s, P.shieldK);
    } else if (W === 'bow') {
      drawArm(g, s, SH_F, P.fh, team, false);
      drawBow(g, P.fh[0] * s, P.fh[1] * s, P.fa, s, P.bowDraw, P.arrow, P.glow, P.fire || 0);
      if (nock) dot(g, nock[0], nock[1], s * 0.038, SKIN, s);
    } else {
      frontItem();
      drawArm(g, s, SH_F, P.fh, team, false);
    }
  }
  g.restore();
  OUTFIT = null; BARE = false;
  SKIN = SKIN0; SKIN_D = SKIN0_D;
}

// ---------- skill icons ----------
function iconArc(g, cx, cy, r, a0, a1, w, col, head = true) {
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = col;
  g.lineWidth = w;
  g.beginPath();
  g.arc(cx, cy, r, a0, a1, a1 < a0);
  g.stroke();
  if (head) {
    const ex = cx + Math.cos(a1) * r, ey = cy + Math.sin(a1) * r;
    const tang = a1 + (a1 < a0 ? -Math.PI / 2 : Math.PI / 2);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(ex + Math.cos(tang) * w * 1.6, ey + Math.sin(tang) * w * 1.6);
    g.lineTo(ex + Math.cos(tang + 2.4) * w * 1.6, ey + Math.sin(tang + 2.4) * w * 1.6);
    g.lineTo(ex + Math.cos(tang - 2.4) * w * 1.6, ey + Math.sin(tang - 2.4) * w * 1.6);
    g.closePath();
    g.fill();
  }
  g.restore();
}
function speedLines(g, x, y, len, n, gap, w) {
  g.save();
  g.strokeStyle = 'rgba(255,240,200,0.75)';
  g.lineCap = 'round';
  g.lineWidth = w;
  for (let i = 0; i < n; i++) {
    const yy = y + (i - (n - 1) / 2) * gap;
    g.beginPath();
    g.moveTo(x - len * (0.6 + 0.4 * (i % 2)), yy);
    g.lineTo(x, yy);
    g.stroke();
  }
  g.restore();
}
function drawIcon(cv, type, team) {
  const n = cv.width;
  const g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, n, n);
  const bg = g.createRadialGradient(n * 0.4, n * 0.35, n * 0.05, n / 2, n / 2, n * 0.6);
  bg.addColorStop(0, '#5a4430');
  bg.addColorStop(1, '#1c130c');
  g.fillStyle = bg;
  g.beginPath();
  g.arc(n / 2, n / 2, n / 2, 0, TAU);
  g.fill();
  const c = n / 2, s = n * 0.62, lw = n * 0.045;
  const gold = '#f2d27a';
  switch (type) {
    case 'slash': iconArc(g, c, c, n * 0.3, -2.6, 0.5, lw, gold); drawBlade(g, c - n * 0.16, c + n * 0.16, -0.8, s * 0.55, s); break;
    case 'tower': {
      // a little watchtower: four legs, a railed deck, a peaked roof
      g.save(); g.strokeStyle = gold; g.fillStyle = gold; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(c - n * 0.2, c + n * 0.32); g.lineTo(c - n * 0.13, c - n * 0.04); g.moveTo(c + n * 0.2, c + n * 0.32); g.lineTo(c + n * 0.13, c - n * 0.04);
      g.moveTo(c - n * 0.18, c + n * 0.2); g.lineTo(c + n * 0.18, c + n * 0.06); g.moveTo(c + n * 0.18, c + n * 0.2); g.lineTo(c - n * 0.18, c + n * 0.06); g.stroke();
      g.fillRect(c - n * 0.22, c - n * 0.08, n * 0.44, n * 0.07);
      g.lineWidth = lw * 0.7; g.beginPath(); for (let i = 0; i < 5; i++) { const x = c - n * 0.19 + i * n * 0.095; g.moveTo(x, c - n * 0.08); g.lineTo(x, c - n * 0.17); } g.moveTo(c - n * 0.2, c - n * 0.17); g.lineTo(c + n * 0.2, c - n * 0.17); g.stroke();
      g.beginPath(); g.moveTo(c - n * 0.27, c - n * 0.2); g.lineTo(c, c - n * 0.38); g.lineTo(c + n * 0.27, c - n * 0.2); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(c, c - n * 0.38); g.lineTo(c, c - n * 0.44); g.stroke();
      g.restore(); break;
    }
    case 'twin': drawBlade(g, c - n * 0.2, c + n * 0.2, -0.8, s * 0.55, s); g.save(); g.translate(n, 0); g.scale(-1, 1); drawBlade(g, c - n * 0.2, c + n * 0.2, -0.8, s * 0.55, s); g.restore(); break;
    case 'dash': speedLines(g, c - n * 0.15, c, n * 0.3, 3, n * 0.12, lw * 0.8); drawBlade(g, c - n * 0.12, c + n * 0.02, -0.15, s * 0.55, s); break;
    case 'step':
      g.save(); g.strokeStyle = gold; g.lineWidth = lw * 1.2; g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 0; i < 3; i++) { const x = c - n * 0.2 + i * n * 0.15; g.globalAlpha = 0.45 + i * 0.27; g.beginPath(); g.moveTo(x, c - n * 0.15); g.lineTo(x + n * 0.1, c); g.lineTo(x, c + n * 0.15); g.stroke(); }
      g.restore(); break;
    case 'spin': iconArc(g, c, c, n * 0.32, 0.3, 5.4, lw, gold); drawBlade(g, c - n * 0.05, c + n * 0.05, -0.7, s * 0.5, s); break;
    case 'thrust': drawSpearShape(g, c - n * 0.36, c + n * 0.3, c + n * 0.34, c - n * 0.3, team, s, 1); break;
    case 'sweep': iconArc(g, c, c + n * 0.1, n * 0.32, -2.8, -0.3, lw, gold); drawSpearShape(g, c - n * 0.4, c + n * 0.15, c + n * 0.38, c - n * 0.05, team, s, 1); break;
    case 'lunge': speedLines(g, c - n * 0.2, c + n * 0.05, n * 0.28, 3, n * 0.1, lw * 0.8); drawSpearShape(g, c - n * 0.3, c + n * 0.08, c + n * 0.4, c - n * 0.05, team, s, 1); break;
    case 'throwSpear': speedLines(g, c - n * 0.1, c + n * 0.15, n * 0.3, 2, n * 0.12, lw * 0.7); drawSpearShape(g, c - n * 0.3, c + n * 0.3, c + n * 0.36, c - n * 0.28, team, s, 1); break;
    case 'chop': iconArc(g, c, c, n * 0.3, -2.4, 0.2, lw, gold); drawAxe(g, c - n * 0.14, c + n * 0.16, -0.9, s * 1.1); break;
    case 'roll': iconArc(g, c, c, n * 0.26, -1.2, 4.2, lw * 1.3, gold); break;
    case 'lowRoll':
      iconArc(g, c, c - n * 0.04, n * 0.2, -1.2, 4.2, lw * 1.2, gold);
      g.save(); g.strokeStyle = 'rgba(255,240,200,0.8)'; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(c - n * 0.34, c + n * 0.27); g.lineTo(c + n * 0.34, c + n * 0.27); g.stroke(); g.restore(); break;
    case 'punch': {
      speedLines(g, c - n * 0.06, c, n * 0.26, 3, n * 0.12, lw * 0.8);
      g.save(); g.fillStyle = SKIN; g.strokeStyle = INK; g.lineWidth = n * 0.03;
      g.beginPath(); g.ellipse(c + n * 0.08, c, n * 0.16, n * 0.13, 0, 0, TAU); g.fill(); g.stroke();
      g.lineWidth = n * 0.018; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(c + n * 0.16, c + i * n * 0.055); g.lineTo(c + n * 0.24, c + i * n * 0.055); g.stroke(); }
      g.restore(); break;
    }
    case 'starJump': {
      g.save(); g.strokeStyle = gold; g.lineWidth = lw * 1.2; g.lineCap = 'round';
      const hy = c - n * 0.18;
      g.beginPath(); g.arc(c, hy, n * 0.07, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(c, hy + n * 0.07); g.lineTo(c, c + n * 0.1);
      g.moveTo(c - n * 0.25, hy - n * 0.08); g.lineTo(c, hy + n * 0.14); g.lineTo(c + n * 0.25, hy - n * 0.08);
      g.moveTo(c - n * 0.2, c + n * 0.32); g.lineTo(c, c + n * 0.1); g.lineTo(c + n * 0.2, c + n * 0.32); g.stroke();
      g.restore(); break;
    }
    case 'slide': {
      g.save(); g.strokeStyle = gold; g.lineWidth = lw * 1.2; g.lineCap = 'round';
      g.beginPath(); g.arc(c - n * 0.18, c - n * 0.06, n * 0.08, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(c - n * 0.14, c + n * 0.04); g.lineTo(c + n * 0.08, c + n * 0.18); g.lineTo(c + n * 0.36, c + n * 0.2); g.stroke();
      g.beginPath(); g.moveTo(c + n * 0.08, c + n * 0.18); g.lineTo(c + n * 0.2, c + n * 0.06); g.stroke();
      g.fillStyle = 'rgba(220,200,150,0.7)';
      for (const [dx, r] of [[-0.36, 0.09], [-0.22, 0.07], [-0.08, 0.05]]) { g.beginPath(); g.arc(c + n * dx, c + n * 0.26, n * r, 0, TAU); g.fill(); }
      g.restore(); break;
    }
    case 'prone': {
      g.save(); g.strokeStyle = gold; g.lineWidth = lw * 1.2; g.lineCap = 'round';
      g.beginPath(); g.arc(c + n * 0.26, c + n * 0.12, n * 0.07, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(c - n * 0.32, c + n * 0.16); g.lineTo(c + n * 0.18, c + n * 0.16); g.stroke();
      g.strokeStyle = 'rgba(255,240,200,0.8)'; g.lineWidth = lw;
      g.beginPath(); g.moveTo(c - n * 0.36, c + n * 0.28); g.lineTo(c + n * 0.36, c + n * 0.28); g.stroke();
      g.beginPath(); g.moveTo(c, c - n * 0.32); g.lineTo(c, c - n * 0.04); g.moveTo(c - n * 0.09, c - n * 0.13); g.lineTo(c, c - n * 0.03); g.lineTo(c + n * 0.09, c - n * 0.13); g.stroke();
      g.restore(); break;
    }
    case 'throwAxe': iconArc(g, c, c, n * 0.34, -2.2, -0.6, lw * 0.8, 'rgba(242,210,122,0.8)', false); iconArc(g, c, c, n * 0.34, 0.9, 2.5, lw * 0.8, 'rgba(242,210,122,0.8)', false); drawAxe(g, c - n * 0.1, c + n * 0.08, -0.5, s * 1.05); break;
    case 'leap':
      g.save(); g.setLineDash([lw * 1.2, lw]); iconArc(g, c, c + n * 0.25, n * 0.34, Math.PI + 0.15, -0.15, lw, gold); g.restore();
      drawAxe(g, c - n * 0.06, c - n * 0.02, -1.9, s * 0.9); break;
    case 'stab': drawBlade(g, c - n * 0.22, c + n * 0.2, -0.7, s * 0.6, s, true); speedLines(g, c - n * 0.18, c + n * 0.22, n * 0.18, 2, n * 0.08, lw * 0.6); break;
    case 'guard': drawRattanShield(g, c, c, n * 1.05, 1, 1); break;
    case 'bash':
      drawRattanShield(g, c - n * 0.06, c, n * 0.9, 1, 1);
      g.save(); g.strokeStyle = gold; g.lineWidth = lw; g.lineCap = 'round';
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(c + n * 0.2, c + i * n * 0.14); g.lineTo(c + n * 0.36, c + i * n * 0.2); g.stroke(); }
      g.restore(); break;
    case 'charge': speedLines(g, c - n * 0.1, c, n * 0.3, 3, n * 0.14, lw * 0.8); drawRattanShield(g, c + n * 0.1, c, n * 0.8, 1, 0.8); break;
    case 'rally': {
      g.save(); g.translate(c + n * 0.1, c + n * 0.42);
      drawBackFlag(g, n * 0.6, team, 0.6);
      g.restore(); break;
    }
    case 'shoot': drawOneArrow(g, c - n * 0.3, c + n * 0.25, -0.7, n * 0.62, n * 0.5, true); break;
    case 'backflip': iconArc(g, c, c, n * 0.27, 0.6, -3.6, lw * 1.2, gold); break;
    case 'snipe':
      g.save(); g.strokeStyle = 'rgba(255,240,200,0.7)'; g.lineWidth = lw * 0.7;
      g.beginPath(); g.arc(c, c, n * 0.3, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(c - n * 0.4, c); g.lineTo(c + n * 0.4, c); g.moveTo(c, c - n * 0.4); g.lineTo(c, c + n * 0.4); g.stroke(); g.restore();
      drawOneArrow(g, c - n * 0.3, c + n * 0.1, -0.3, n * 0.6, n * 0.5, true); break;
    case 'volley':
      for (const k of [-1, 0, 1]) drawOneArrow(g, c - n * 0.25, c + n * 0.28, -0.75 + k * 0.4, n * 0.55, n * 0.42, true);
      break;
  }
}

'use strict';
// ===== levels 1-15: XP from kills, assists, minions and towers; one upgrade to pick at every level =====
const MAX_LVL = 15, UP_STEP = 0.4, SPD_STEP = 0.05, UP_PCT = '+' + Math.round(UP_STEP * 100) + '%', SPD_PCT = '+' + Math.round(SPD_STEP * 100) + '%';
const xpNeed = (L) => 100 + 40 * (L - 1);       // XP to go from level L to L+1
const killXp = (L) => 60 + 24 * (L - 1);        // a hero kill: 60% of what the fallen man's level costs
const CREEP_XP = 30, TOWER_XP_PER_DMG = 0.15, TOWER_KILL_XP = 150;
const ASSIST_SHARE = 0.5, ASSIST_T = 10, XP_RANGE = 4; // helpers split half a kill's XP; 10 s to count; 10 m to share minion XP
const UPS = [
  { id: 'hp', pct: UP_PCT, name: 'พลังชีวิต', note: 'พลังชีวิตสูงสุด ' + UP_PCT, key: 'Z' },
  { id: 'atk', pct: UP_PCT, name: 'พลังโจมตี', note: 'ดาเมจทุกท่า ' + UP_PCT, key: 'X' },
  { id: 'spd', pct: SPD_PCT, name: 'วิ่งเร็ว', note: 'ความเร็วการวิ่ง ' + SPD_PCT, key: 'C' },
  { id: 'as', pct: UP_PCT, name: 'โจมตีเร็ว', note: 'โจมตีปกติเร็วขึ้น ' + UP_PCT, key: 'V' },
];
const BOT_UP = {
  shield: { hp: 4, atk: 2, spd: 1, as: 1 }, archer: { hp: 1, atk: 3, spd: 2, as: 3 },
  spear: { hp: 2, atk: 3, spd: 2, as: 2 }, axe: { hp: 3, atk: 3, spd: 1, as: 2 },
};
function initLevel(a) {
  a.lvl = 1; a.xp = 0; a.up = { hp: 0, atk: 0, spd: 0, as: 0 }; a.pend = 0; a.assists = 0; a.cs = 0;
  a.baseHp = a.maxHp; a.baseShield = a.shieldMax; a.hitBy = new Map();
  return a;
}
const isHero = (w, a) => !!(a && a.up && !a.creep && w.actors && w.actors.includes(a));
const atkMul = (a) => (a && a.up ? 1 + UP_STEP * a.up.atk : 1);
const spdMul = (a) => (a && a.up ? 1 + SPD_STEP * a.up.spd : 1); // running speed: only 5% a pick
const asMul = (a) => (a && a.up ? 1 + UP_STEP * a.up.as : 1);

function grantXp(w, a, n, show) {
  if (!isHero(w, a) || a.lvl >= MAX_LVL || !(n > 0)) return;
  a.xp += n;
  if (show && a.isPlayer) addFloater(w, a.x + 0.25, a.y - 0.95, '+' + Math.round(n) + ' XP', '#cdbcff', 0.8);
  while (a.lvl < MAX_LVL && a.xp >= xpNeed(a.lvl)) {
    a.xp -= xpNeed(a.lvl); a.lvl++;
    addFloater(w, a.x, a.y - 1.25, 'เลเวล ' + a.lvl + '!', '#ffe27a', 1.3);
    addFx(w, { k: 'ring', x: a.x, y: a.y, t: 0, dur: 0.7, r: 0.9, col: '255,220,110' });
    if (a.isPlayer) { a.pend++; haptic([20, 30, 40]); }
    else applyUp(w, a, botPick(a));
  }
  if (a.lvl >= MAX_LVL) a.xp = 0;
}
function botPick(a) {
  const W = BOT_UP[a.hero.id] || { hp: 2, atk: 2, spd: 1, as: 2 };
  let r = Math.random() * (W.hp + W.atk + W.spd + W.as);
  for (const u of UPS) { r -= W[u.id]; if (r <= 0) return u.id; }
  return 'atk';
}
function applyUp(w, a, id) {
  if (!a.up || !(id in a.up)) return false;
  a.up[id]++;
  if (id === 'hp') {
    const m = 1 + UP_STEP * a.up.hp, old = a.maxHp;
    a.maxHp = Math.round(a.baseHp * m);
    if (!a.dead) a.hp = Math.min(a.maxHp, a.hp + (a.maxHp - old));
    if (a.baseShield) { const os = a.shieldMax; a.shieldMax = Math.round(a.baseShield * m); if (!a.shieldBroken) a.shieldHp = Math.min(a.shieldMax, a.shieldHp + (a.shieldMax - os)); }
  }
  return true;
}
// the player picks one of his waiting upgrades
function pickUp(w, a, id) {
  if (!a || !(a.pend > 0)) return false;
  if (!applyUp(w, a, id)) return false;
  a.pend--;
  const u = UPS.find((x) => x.id === id);
  addFloater(w, a.x, a.y - 1.1, u.name + ' ' + u.pct, '#a8f0a0', 1.05);
  return true;
}
// who hurt him lately: for assists
function noteHit(w, t, src) {
  if (!t.hitBy || !src || src === t || !src.up || src.creep || t.creep || src.team === t.team) return;
  t.hitBy.set(src, w.time);
}
function awardKill(w, t, src) {
  const xp = killXp(t.lvl || 1);
  const killer = isHero(w, src) && src.team !== t.team ? src : null;
  const help = [];
  if (t.hitBy) { for (const [h, tm] of t.hitBy) if (h !== killer && w.time - tm <= ASSIST_T && isHero(w, h) && h.team !== t.team) help.push(h); t.hitBy.clear(); }
  for (const h of help) h.assists++;
  if (killer) { grantXp(w, killer, xp, true); for (const h of help) grantXp(w, h, (xp * ASSIST_SHARE) / help.length, true); }
  else for (const h of help) grantXp(w, h, xp / help.length, true); // a tower or a minion finished him: those who wounded him split it
}
function awardCreep(w, t, src) {
  const killer = isHero(w, src) && src.team !== t.team ? src : null;
  if (killer) killer.cs++;
  const near = w.actors.filter((h) => h.up && !h.creep && !h.dead && h.team !== t.team && (h === killer || Math.hypot(h.x - t.x, h.y - t.y) <= XP_RANGE));
  if (killer && !near.includes(killer)) near.push(killer);
  const each = near.length <= 1 ? CREEP_XP : (CREEP_XP * 1.3) / near.length;
  for (const h of near) grantXp(w, h, each, true);
}
function awardTower(w, t, src, dealt, fell) {
  if (isHero(w, src)) grantXp(w, src, dealt * TOWER_XP_PER_DMG, false);
  if (fell) for (const h of w.actors) if (h.up && !h.creep && h.team !== t.team) grantXp(w, h, TOWER_KILL_XP, true);
}

// ---- the four upgrade badges ----
function drawUpIcon(cv, id) {
  const n = cv.width, g = cv.getContext('2d'), c = n / 2;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, n, n);
  const bg = g.createRadialGradient(n * 0.4, n * 0.35, n * 0.05, c, c, n * 0.6);
  const tint = { hp: ['#6a2a2a', '#200c0c'], atk: ['#6a4a22', '#1e1408'], spd: ['#245a5e', '#0a1c20'], as: ['#3c3a72', '#100f26'] }[id];
  bg.addColorStop(0, tint[0]); bg.addColorStop(1, tint[1]);
  g.fillStyle = bg; g.beginPath(); g.arc(c, c, c, 0, TAU); g.fill();
  g.lineCap = 'round'; g.lineJoin = 'round';
  const ink = 'rgba(20,10,4,0.9)';
  if (id === 'hp') {
    // a heart, a plus beside it
    const hx = c - n * 0.05, hy = c + n * 0.02, r = n * 0.3;
    g.beginPath(); g.moveTo(hx, hy + r * 0.95);
    g.bezierCurveTo(hx - r * 1.5, hy + r * 0.05, hx - r * 0.95, hy - r * 1.05, hx, hy - r * 0.35);
    g.bezierCurveTo(hx + r * 0.95, hy - r * 1.05, hx + r * 1.5, hy + r * 0.05, hx, hy + r * 0.95); g.closePath();
    const hg = g.createLinearGradient(0, hy - r, 0, hy + r); hg.addColorStop(0, '#ff6a5a'); hg.addColorStop(1, '#b81e22');
    g.fillStyle = hg; g.fill(); g.strokeStyle = ink; g.lineWidth = n * 0.035; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = n * 0.03; g.beginPath(); g.arc(hx - r * 0.42, hy - r * 0.28, r * 0.24, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    const px = c + n * 0.25, py = c - n * 0.22, pl = n * 0.11;
    g.strokeStyle = ink; g.lineWidth = n * 0.11; g.beginPath(); g.moveTo(px - pl, py); g.lineTo(px + pl, py); g.moveTo(px, py - pl); g.lineTo(px, py + pl); g.stroke();
    g.strokeStyle = '#8df07a'; g.lineWidth = n * 0.06; g.stroke();
  } else if (id === 'atk') {
    // a sword driven in, the burst of the blow at its point
    const bx = c + n * 0.2, by = c - n * 0.2;
    g.fillStyle = '#ffd35a'; g.strokeStyle = ink; g.lineWidth = n * 0.03;
    g.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + 0.2, rr = i % 2 ? n * 0.11 : n * 0.25; g.lineTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(bx, by, n * 0.07, 0, TAU); g.fill();
    drawBlade(g, c - n * 0.3, c + n * 0.3, -Math.PI / 4, n * 0.58, n * 0.72);
  } else if (id === 'spd') {
    // a foot with a wing at the ankle
    const fx = c - n * 0.02, fy = c + n * 0.16;
    g.beginPath();
    g.moveTo(fx - n * 0.2, fy - n * 0.32); g.lineTo(fx - n * 0.04, fy - n * 0.32);
    g.quadraticCurveTo(fx - n * 0.02, fy - n * 0.1, fx + n * 0.12, fy - n * 0.04);
    g.quadraticCurveTo(fx + n * 0.33, fy + n * 0.02, fx + n * 0.3, fy + n * 0.12);
    g.lineTo(fx - n * 0.2, fy + n * 0.12); g.quadraticCurveTo(fx - n * 0.27, fy + n * 0.02, fx - n * 0.2, fy - n * 0.32); g.closePath();
    g.fillStyle = '#e2a876'; g.fill(); g.strokeStyle = ink; g.lineWidth = n * 0.035; g.stroke();
    g.strokeStyle = 'rgba(90,50,20,0.7)'; g.lineWidth = n * 0.018;
    for (let i = 0; i < 3; i++) { const x = fx + n * (0.14 + i * 0.05); g.beginPath(); g.moveTo(x, fy + n * 0.02 + i * n * 0.012); g.lineTo(x + n * 0.01, fy + n * 0.1); g.stroke(); }
    // the wing, three feathers sweeping back
    const wx = fx - n * 0.14, wy = fy - n * 0.18;
    for (let i = 2; i >= 0; i--) {
      const L = n * (0.34 - i * 0.07), a = Math.PI + 0.5 - i * 0.34;
      g.beginPath(); g.moveTo(wx, wy);
      g.quadraticCurveTo(wx + Math.cos(a - 0.5) * L * 0.6, wy + Math.sin(a - 0.5) * L * 0.6, wx + Math.cos(a) * L, wy + Math.sin(a) * L);
      g.quadraticCurveTo(wx + Math.cos(a + 0.45) * L * 0.55, wy + Math.sin(a + 0.45) * L * 0.55, wx, wy + n * 0.05); g.closePath();
      g.fillStyle = i === 0 ? '#ffffff' : i === 1 ? '#dff4ff' : '#b8e2f4'; g.fill(); g.strokeStyle = ink; g.lineWidth = n * 0.025; g.stroke();
    }
    g.strokeStyle = 'rgba(190,240,255,0.8)'; g.lineWidth = n * 0.025;
    for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(c - n * 0.38, c + n * (0.2 + i * 0.1)); g.lineTo(c - n * (0.26 - i * 0.04), c + n * (0.2 + i * 0.1)); g.stroke(); }
  } else {
    // a sword swung so fast it shows three times over
    const px = c - n * 0.24, py = c + n * 0.28;
    g.strokeStyle = 'rgba(210,220,255,0.85)'; g.lineWidth = n * 0.035;
    g.beginPath(); g.arc(px, py, n * 0.56, -1.2, -0.05); g.stroke();
    g.beginPath(); g.arc(px, py, n * 0.4, -0.9, 0.0); g.stroke();
    [[-0.2, 0.42], [-0.6, 0.7], [-1.0, 1]].forEach(([a, al]) => { g.save(); g.globalAlpha = al; drawBlade(g, px, py, a, n * 0.52, n * 0.66); g.restore(); });
  }
}

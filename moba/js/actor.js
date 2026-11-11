'use strict';
// ===== actor: moving, skills, projectiles, effects =====

let ACTOR_ID = 0;
const maxHpOf = (H) => 360 + H.stats.hp * 55;
function makeActor(heroId, team, x, y) {
  const H = heroById(heroId);
  const sh = H.weapon === 'shield' ? maxHpOf(H) : 0;
  return initLevel({ shieldMax: sh, shieldHp: sh, shieldBroken: false, delivery: null, id: ++ACTOR_ID, hero: H, team, x, y, hp: maxHpOf(H), maxHp: maxHpOf(H), dead: false, deathT: 0, respawnT: 0, stun: 0, kick: null, flash: 0, spawnShield: 0, kills: 0, deaths: 0, svx: 0, svy: 0, face: 1, run: 0, time: 0, seed: Math.random() * 10, moving: false, vx: 0, vy: 0, act: null, cds: [0, 0, 0, 0], buffT: 0, spearOut: false, axeOut: false, ghosts: [], ghostT: 0, stepT: 0, lastDir: [1, 0], air: false, slow: false });
}
function addFx(w, f) { if (w.fx.length < 400) w.fx.push(f); }
function addFloater(w, x, y, text, col, size = 1) { w.floaters.push({ x, y, text, col, t: 0, dur: 1.1, size }); }

function localAim(face, dir) {
  const sa = Math.atan2(dir[1] * TILT, dir[0]);
  let la = face > 0 ? sa : Math.PI - sa;
  while (la > Math.PI) la -= TAU;
  while (la < -Math.PI) la += TAU;
  return la;
}
// the basic attack locks onto the nearest dummy in reach, otherwise strikes the way he faces
function autoAim(a, w, reach) {
  let foe = null, fd = reach + 0.35;
  for (const t of w.actors || []) { if (t.dead || t.team === a.team) continue; const dd = Math.hypot(t.x - a.x, t.y - a.y); if (dd < fd) { fd = dd; foe = t; } }
  if (foe) return unit2(foe.x - a.x, foe.y - a.y);
  // an enemy tower in reach
  let tw = null, td = reach + 0.6;
  for (const t of w.towers || []) { if (t.dead || t.team === a.team) continue; const dd = Math.hypot(t.x - a.x, t.y - a.y); if (dd < td) { td = dd; tw = t; } }
  if (tw) return unit2(tw.x - a.x, tw.y - a.y);
  let best = null, bd = reach;
  for (const d of w.dummies) { const dd = Math.hypot(d.x - a.x, d.y - a.y); if (dd < bd) { bd = dd; best = d; } }
  if (best) { const dx = best.x - a.x, dy = best.y - a.y, L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; }
  return a.moving ? a.lastDir.slice() : [a.face, 0];
}
const unit2 = (x, y) => { const L = Math.hypot(x, y) || 1; return [x / L, y / L]; };
function haptic(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
// a volley arrow: thrown up off his feet a little, down on his back and sliding; the next one does it again
function volleyKnock(w, t, dx, dy) {
  if (t.dead || t.pinned || t.grab) return;
  const L = Math.hypot(dx, dy) || 1, fl = 0.16;
  dx /= L; dy /= L;
  t.act = null; t.stun = 0;
  t.down = fl + 0.4 + 0.45; t.downDur = t.down; t.downHit = false; t.downAir = fl;
  t.face = dx > 0 ? -1 : 1;
  t.kick = { dx, dy, d: VOLLEY_PUSH * 0.6, t: 0, dur: fl, air: 0.13, skid: VOLLEY_PUSH * 0.4, sd: 0.4 }; // the hop and the slide together: 1.2 m
  if (t.bot) t.bot.path = null;
  addFx(w, { k: 'impact', x: t.x, y: t.y, z: 0.32, t: 0, dur: 0.28, seed: Math.random() * 1e3, big: true });
  addFx(w, { k: 'ring', x: t.x, y: t.y, t: 0, dur: 0.35, r: 0.42, col: '255,236,170' });
  addFx(w, { k: 'airRing', x: t.x, y: t.y, z: 0.3, t: 0, dur: 0.25, dx, dy, big: true });
  dust(w, t.x, t.y, 4, 1.3);
  if (!(t.volleyMsgT > w.time)) { addFloater(w, t.x, t.y - 1.0, 'ล้ม!', '#ffb070', 1.05); t.volleyMsgT = w.time + 0.6; }
  if (t.isPlayer) haptic(40);
}
function knockDown(w, t, dx, dy, dist = 1.2, stunAfter = 0.8) {
  if (t.dead || t.pinned) return;
  t.act = null; t.stun = 0;
  t.down = 0.5 + stunAfter; t.downDur = t.down; t.downHit = false; t.downAir = 0;
  t.face = dx > 0 ? -1 : 1; // facing the blow, so he goes over on his back
  t.kick = { dx, dy, d: dist, t: 0, dur: 0.5, slide: true };
  if (t.bot) t.bot.path = null;
  addFloater(w, t.x, t.y - 0.95, 'ล้ม!', '#ffb070', 1.1);
}
function skillReady(a, i) {
  const sk = skillsOf(a)[i];
  if (a.dead || a.stun > 0 || a.down > 0) return false;
  if (sk.act === 'guard' && a.shieldBroken) return false;
  if (a.pinned) return false;
  if (cdsOf(a)[i] > 0) return false;
  if (a.act && (ACTS[a.act.k].lock || (i === 0 && a.act.k !== 'guard'))) return false;
  if (a.spearOut && (sk.act === 'throwSpear' || sk.act === 'thrust' || sk.act === 'lungeThrust' || sk.act === 'sweep')) return false;
  if (sk.act === 'leap' && a.axeOut) return false; // the leap needs both axes
  if (a.axeOut >= 2 && (sk.act === 'throwAxe' || sk.act === 'chop2')) return false;
  return true;
}
function cast(a, w, i, dir, frac = 1) {
  if (!skillReady(a, i)) return false;
  // spear in someone, and you're at his side within 3 s: grab the shaft and kick him off it
  if (i === 0 && a.hero.weapon === 'spear' && a.spearOut && !a._towerOnly) { const v = kickTarget(a, w); if (v) return startSpearKick(a, w, v); }
  a.spawnShield = 0;
  const sk = skillsOf(a)[i];
  const cds = cdsOf(a);
  if (a._towerOnly && dir) { /* the tower button: aimed at the tower, no one else */ }
  else if (sk.aim === 'auto' || !dir) dir = sk.aim === 'auto' ? autoAim(a, w, a.hero.weapon === 'bow' ? ARROW_RANGE : a.hero.weapon === 'spear' ? 1.1 : 0.9) : a.moving ? a.lastDir.slice() : [a.face, 0];
  const L = Math.hypot(dir[0], dir[1]) || 1;
  dir = [dir[0] / L, dir[1] / L];
  if (sk.act === 'backflip') { if (Math.abs(dir[0]) > 0.05) a.face = dir[0] > 0 ? -1 : 1; }
  else if (Math.abs(dir[0]) > 0.05) a.face = dir[0] > 0 ? 1 : -1;
  if (a.act) endAct(a, w);
  // one axe left: a single, slower chop
  const actK = sk.act === 'chop2' && a.axeOut === 1 ? 'chop1' : sk.act;
  const def = ACTS[actK];
  // the javelin always flies the full lane you aimed; a player's rush always runs its full 10 m
  if (sk.act === 'throwSpear' || sk.act === 'volley' || (sk.act === 'lungeThrust' && a.isPlayer)) frac = 1;
  const c = { k: actK, t: 0, prev: 0, dur: i === 0 ? def.dur / asMul(a) : def.dur, dir, dist: (sk.range || 1) * clamp(frac, 0.15, 1), la: localAim(a.face, dir), hits: new Set(), x0: a.x, y0: a.y, done: 0, towerOnly: !!a._towerOnly };
  if (sk.act === 'leap') {
    let tx = a.x + dir[0] * c.dist, ty = a.y + dir[1] * c.dist;
    if (!w.preview) { tx = clamp(tx, 0.4, w.W - 0.4); ty = clamp(ty, 0.45, w.H - 0.4); const q = shoreOut(w, tx, ty, 0.2); tx = q.x; ty = q.y; }
    c.tx = tx; c.ty = ty;
    const d = Math.hypot(tx - a.x, ty - a.y);
    // a high jump: up, over, and down onto the mark
    c.fly = 0.62 + d * 0.09;
    c.dur = c.fly + 0.24;
    c.h = 1.9 + d * 0.3;
  }
  if (def.start) def.start(a, c, w);
  a.act = c;
  cds[i] = i === 0 ? (sk.cd / asMul(a)) * (actK === 'chop1' ? 2 : 1) : sk.cd; // attack speed quickens the basic attack
  return true;
}
function endAct(a, w) { const c = a.act; if (!c) return; const def = ACTS[c.k]; if (def.end) def.end(a, c, w); a.act = null; }

// ---- helpers used by the skills ----
const crossed = (c, f) => c.prev < f * c.dur && c.t >= f * c.dur;
function moveSpan(a, c, w, from, to, dist, curve = easeOut) {
  const f0 = curve(clamp((c.prev / c.dur - from) / (to - from), 0, 1));
  const f1 = curve(clamp((c.t / c.dur - from) / (to - from), 0, 1));
  const d = (f1 - f0) * dist;
  if (d <= 0) return 0;
  a.x += c.dir[0] * d;
  a.y += c.dir[1] * d;
  if (!w.preview) resolve(w, a, 0.12);
  return d;
}
function hitArea(a, c, w, x, y, r, dmg, power = 1, kind = 'blade') {
  let n = 0;
  const dirX = c ? c.dir[0] : a.face;
  for (const d of w.dummies) {
    if (c && c.hits.has(d)) continue;
    if (Math.hypot(d.x - x, d.y - y) > r + 0.1) continue;
    if (c) c.hits.add(d);
    const dmgN = Math.round(dmg * (0.9 + Math.random() * 0.2));
    d.wobV += (d.x >= a.x ? 1 : -1) * 6 * power;
    d.hitT = 0;
    d.total += dmgN;
    addFloater(w, d.x + (Math.random() - 0.5) * 0.15, d.y - 0.62, '-' + dmgN, dmg >= 100 ? '#ffd35a' : '#fff4d6', dmg >= 100 ? 1.35 : 1);
    addFx(w, { k: 'spark', x: d.x - (d.x >= a.x ? 0.06 : -0.06), y: d.y, z: 0.32, t: 0, dur: 0.3, seed: Math.random() * 1e3, big: power > 1.2 });
    addFx(w, { k: 'leafBits', x: d.x, y: d.y, z: 0.35, t: 0, dur: 1.2, seed: Math.random() * 1e3, n: 8, col: 'straw' });
    if (kind === 'blade') addFx(w, { k: 'blood', x: d.x, y: d.y, z: 0.3, t: 0, dur: 0.3, dir: d.x >= a.x ? 1 : -1 });
    n++;
  }
  for (const t of (c && c.towerOnly ? [] : w.actors || [])) {
    if (t === a || t.dead || t.team === a.team || (c && c.hits.has(t))) continue;
    if (Math.hypot(t.x - x, t.y - y) > r + 0.12) continue;
    if (t.act && ((t.act.k === 'leap' && t.act.t / t.act.dur < 0.85) || t.act.k === 'starJump')) continue;
    if (c) c.hits.add(t);
    const res = damage(w, t, dmg, a, power);
    if (res === true && (kind === 'slam' || (kind === 'blunt' && power >= 2))) t.stun = Math.max(t.stun, kind === 'slam' ? 0.65 : 0.3);
    if (res === true && !t.dead && !t.pinned) {
      const u = unit2(t.x - a.x, t.y - a.y);
      if (kind === 'nudge') t.kick = { dx: u[0], dy: u[1], d: 0.15, t: 0, dur: 0.12 };
      if (kind === 'shove') { t.kick = { dx: u[0], dy: u[1], d: 0.8, t: 0, dur: 0.24, slide: true }; dust(w, t.x, t.y, 3, 1.1); } // the spear's butt-shove: 2 m
      if (kind === 'sweep') knockDown(w, t, u[0], u[1], 1.6, 1.0);
    }
    n++;
  }
  for (const b of w.bananas) {
    if (b.cut || (c && c.hits.has(b))) continue;
    if (!b.stems.some((st) => Math.hypot(b.x + st.ox - x, b.y + st.oy - y) < r + st.r + 0.04)) continue;
    if (c) c.hits.add(b);
    hitBanana(w, b, a.x, power);
    n++;
  }
  for (const j of w.jars) if (j.state === 'up' && Math.hypot(j.x - x, j.y - y) < r + 0.1) knockJar(w, j, Math.atan2(j.y - a.y, j.x - a.x));
  for (const p of w.palms) if (Math.hypot(p.x - x, p.y - y) < r + 0.14 && !(c && c.hits.has(p))) { if (c) c.hits.add(p); palmHit(w, p, power, p.x >= a.x ? 1 : -1, false); }
  for (const m of w.mangoes) if (Math.hypot(m.x - x, m.y - y) < r + 0.2) { m.rustleV += 8 * power; m.leanV += (m.x >= a.x ? 1 : -1) * 2 * power; }
  for (const t of w.taros) if (Math.hypot(t.x - x, t.y - y) < r) { t.flat = Math.max(t.flat, 0.2); t.flatT = 0; t.leanV += (t.x >= a.x ? 1 : -1) * 4; }
  for (const gr of w.grass) if (Math.hypot(gr.x - x, gr.y - y) < r + 0.1) gr.leanV += (gr.x >= a.x ? 1 : -1) * 9 * power;
  if (w.huts && w.hutBits) hutBlow(w, x, y, r, power, a.x);
  for (const t of w.towers || []) if (!t.dead && t.team !== a.team && !(c && c.hits.has(t)) && Math.hypot(t.x - x, t.y - y) < r + 0.42) { if (c) c.hits.add(t); damageTower(w, t, dmg, a); }
  if (w.litter) floraBlow(w, x, y, r, power);
  void dirX;
  return n;
}
function damage(w, t, dmg, src, power = 1, fx = null, fy = null) {
  if (t.dead || t.spawnShield > 0) return false;
  const c = t.act;
  if (c && INVULN[c.k]) { addFloater(w, t.x, t.y - 0.75, 'หลบ!', '#bfe6ff', 0.85); return false; }
  if (fx == null) { fx = src ? src.x : t.x; fy = src ? src.y : t.y; }
  dmg *= atkMul(src);
  noteHit(w, t, src);
  let blocked = false;
  t.lastBlocked = false;
  if (c && c.k === 'guard' && !t.shieldBroken && t.shieldHp > 0) {
    const L = Math.hypot(fx - t.x, fy - t.y) || 1;
    if (((fx - t.x) / L) * c.gdir[0] + ((fy - t.y) / L) * c.gdir[1] > 0.26) return blockHit(w, t, dmg, src, power, c.gdir);
  }
  t.lastBlocked = blocked;
  if (src && src.buffT > 0) dmg *= 1.15;
  dmg = Math.max(1, Math.round(dmg * (0.9 + Math.random() * 0.2)));
  t.hp -= dmg;
  t.flash = 0.16;
  addFloater(w, t.x + (Math.random() - 0.5) * 0.15, t.y - 0.7, (blocked ? 'กัน ' : '-') + dmg, t.isPlayer ? '#ff8a7a' : blocked ? '#e0d2a8' : src && src.isPlayer ? '#ffe9a8' : '#fff4d6', dmg >= 100 ? 1.25 : 0.95);
  if (!blocked) addFx(w, { k: 'blood', x: t.x, y: t.y, z: 0.3, t: 0, dur: 0.3, dir: t.x >= fx ? 1 : -1 });
  if (power >= 1.6 && !blocked && !t.pinned) {
    const d = unit2(t.x - fx, t.y - fy);
    t.kick = { dx: d[0], dy: d[1], d: 0.13 * power, t: 0, dur: 0.18 };
    if (c && ACTS[c.k].lock && c.k !== 'leap' && power >= 2) t.act = null;
  }
  if (t.hp <= 0) killActor(w, t, src);
  return true;
}
// the blow lands on the shield: the shield soaks all of it and the attacker is thrown back off it
function blockHit(w, t, dmg, src, power, gd) {
  dmg = Math.max(1, Math.round(dmg * (0.9 + Math.random() * 0.2)));
  t.shieldHp -= dmg;
  t.lastBlocked = true;
  const bx = t.x + gd[0] * 0.16, by = t.y + gd[1] * 0.16;
  addFx(w, { k: 'block', x: bx, y: by, z: 0.2, t: 0, dur: 0.5, seed: Math.random() * 1e3, ang: Math.atan2(gd[1] * TILT, gd[0]) });
  addFloater(w, t.x + (Math.random() - 0.5) * 0.1, t.y - 0.72, 'กัน ' + dmg, '#ffd85a', 0.95);
  sfxAt('wood', t.x, t.y, 1, dmg > 90 ? 0.8 : 1);
  if (t.isPlayer) haptic(25);
  if (src && src.hero && !src.isTower && !src.dead && Math.hypot(src.x - t.x, src.y - t.y) < 1.5) {
    const d = unit2(src.x - t.x, src.y - t.y);
    src.kick = { dx: d[0], dy: d[1], d: 0.4 + 0.12 * power, t: 0, dur: 0.22 };
    if (src.act && (ACTS[src.act.k].lock || src.act.k === 'spin' || src.act.k === 'twinSpin') && src.act.k !== 'leap') src.act = null;
    src.flash = Math.max(src.flash, 0.08);
  }
  if (t.shieldHp <= 0) breakShield(w, t);
  return 'block';
}
function breakShield(w, t) {
  t.shieldHp = 0;
  t.shieldBroken = true;
  if (t.act && t.act.k === 'guard') t.act = null;
  addFx(w, { k: 'shieldBreak', x: t.x + t.face * 0.15, y: t.y, z: 0.22, t: 0, dur: 1.3, seed: Math.random() * 1e3 });
  addFloater(w, t.x, t.y - 1.0, t.isPlayer ? 'โล่แตก! กลับฐานเพื่อรับโล่ใหม่' : 'โล่แตก!', '#ffb070', 1.05);
  sfxAt('crack', t.x, t.y, 1);
  if (t.isPlayer) haptic([60, 40, 120]);
  w.shake = Math.max(w.shake || 0, 0.12);
}
// held skills (the shield): press to raise, drag to turn it, release to lower
function startHold(a, w, i, dir) {
  if (a.act && a.act.k === 'guard') return true;
  if (!cast(a, w, i, dir || [a.face, 0])) return false;
  cdsOf(a)[i] = 0;
  return true;
}
function setHoldDir(a, dir) {
  if (!dir || !a.act || a.act.k !== 'guard') return;
  const L = Math.hypot(dir[0], dir[1]);
  if (L < 1e-3) return;
  a.act.gdir = [dir[0] / L, dir[1] / L];
}
function endHold(a, i) {
  if (a.act && a.act.k === 'guard' && a.act.demo == null) { a.act = null; cdsOf(a)[i] = skillsOf(a)[i].cd; }
}
function killActor(w, t, src) {
  if (t.delivery) { t.delivery.v.state = 'out'; t.delivery = null; }
  if (t.act && t.act.k === 'guard') t.act = null;
  t.hp = 0; t.dead = true; t.deathT = 0; t.respawnT = t.creep ? 1.6 : 6; t.act = null; t.kick = null; t.stun = 0; t.buffT = 0; t.deaths++;
  if (t.creep) { addFx(w, { k: 'ring', x: t.x, y: t.y, t: 0, dur: 0.4, r: 0.35, col: '200,40,30' }); awardCreep(w, t, src); return; }
  awardKill(w, t, src);
  if (src && src.team !== t.team) { src.kills++; if (w.score) w.score[src.team]++; }
  if (w.feed) w.feed.push({ k: src ? src.hero.name : '?', kt: src ? src.team : t.team, v: t.hero.name, vt: t.team, kp: !!(src && src.isPlayer), vp: !!t.isPlayer, t: 0 });
  addFx(w, { k: 'ring', x: t.x, y: t.y, t: 0, dur: 0.5, r: 0.6, col: '200,40,30' });
}
function respawnActor(w, a) {
  const sp = w.spawns[a.team];
  a.x = sp.x + (Math.random() - 0.5) * 0.4; a.y = sp.y + (Math.random() - 0.5) * 0.4;
  if (a.pinned) { a.pinned.p.victim = null; a.pinned = null; }
  if (a.hero.weapon === 'spear') for (const p of w.proj) if (p.owner === a && p.javelin && !p.dead) { if (p.victim && !p.victim.dead) p.victim.pinned = null; p.dead = true; }
  a.hp = a.maxHp; a.dead = false; a.spawnShield = 1.5;
  if (a.shieldMax && !a.shieldBroken) a.shieldHp = a.shieldMax; a.act = null; a.spearOut = false; a.axeOut = 0; for (const p of w.proj || []) if (p.owner === a && p.k === 'axe') p.dead = true; a.cds = [0, 0, 0, 0]; a.ghosts = [];
  if (a.bot) { a.bot.retreat = false; a.bot.path = null; }
  addFx(w, { k: 'ring', x: a.x, y: a.y, t: 0, dur: 0.6, r: 0.8, col: a.team === 'red' ? '255,120,100' : '120,170,255' });
}
function strike(a, c, w, reach, r, dmg, power, fx = 'slash') {
  const x = a.x + c.dir[0] * reach, y = a.y + c.dir[1] * reach;
  hitArea(a, c, w, x, y, r, dmg, power);
  if (fx) addFx(w, { k: fx, x: a.x, y: a.y, t: 0, dur: 0.22, ang: Math.atan2(c.dir[1] * TILT, c.dir[0]), face: a.face, r: reach + r * 0.6, big: power > 1.1 });
}
function ghostTrail(a, dt, every = 0.035) {
  a.ghostT -= dt;
  if (a.ghostT > 0) return;
  a.ghostT = every;
  a.ghosts.push({ x: a.x, y: a.y, t: 0, snap: { hero: a.hero, team: a.team, face: a.face, time: a.time, moving: a.moving, buffT: 0, run: a.run, seed: a.seed, spearOut: a.spearOut, axeOut: a.axeOut }, P: poseOf(a) });
}
function dust(w, x, y, n = 1, big = 1) {
  for (let i = 0; i < n; i++) addFx(w, { k: 'dust', x: x + (Math.random() - 0.5) * 0.12 * big, y: y + (Math.random() - 0.5) * 0.06 * big, t: 0, dur: 0.5 + Math.random() * 0.3, r: (0.05 + Math.random() * 0.05) * big, vx: (Math.random() - 0.5) * 0.4 * big, vy: (Math.random() - 0.5) * 0.15 });
}
function spawnProj(a, w, k, dir, range, speed, dmg, opt = {}) {
  w.proj.push(Object.assign({ k, owner: a, team: a.team, x: a.x + dir[0] * 0.15, y: a.y + dir[1] * 0.15, dx: dir[0], dy: dir[1], speed, range, went: 0, z: k === 'axe' ? 0.32 : 0.28, state: 'fly', dmg, hits: new Set(), t: 0, spin: 0 }, opt));
}

// ---- every skill and attack ----
const ACTS = {
  slash: { dur: 0.42, lock: true, tick(a, c, w) { moveSpan(a, c, w, 0.35, 0.55, 0.1); if (crossed(c, 0.47)) strike(a, c, w, 0.28, 0.3, 62, 1); } },
  twin: { dur: 0.62, lock: true, tick(a, c, w) { const d = a.creep ? CREEP_DMG : 48, rr = a.creep ? 0.26 : 0.32, rch = a.creep ? 0.24 : 0.3; moveSpan(a, c, w, 0.25, 0.75, a.creep ? 0.05 : 0.12); if (crossed(c, 0.32)) strike(a, c, w, rch, rr, d, a.creep ? 0.6 : 1); if (crossed(c, 0.63)) { c.hits.clear(); strike(a, c, w, rch, rr, d, a.creep ? 0.6 : 1); } } },
  chop2: { dur: 0.7, lock: true, tick(a, c, w) { moveSpan(a, c, w, 0.25, 0.75, 0.1); if (crossed(c, 0.36)) strike(a, c, w, 0.25, 0.3, 55, 1.1); if (crossed(c, 0.72)) { c.hits.clear(); strike(a, c, w, 0.25, 0.3, 55, 1.1); } } },
  // a minion's attack: step in, the lead blade down across him, a beat, the other blade through level. The edge
  // that cuts is the last hand's breadth of the blade
  creepCut: { dur: 0.95, lock: true, tick(a, c, w) { moveSpan(a, c, w, 0.08, 0.3, 0.04); if (crossed(c, 0.36)) strike(a, c, w, 0.24, 0.13, CREEP_DMG, 0.6); if (crossed(c, 0.68)) { c.hits.clear(); strike(a, c, w, 0.24, 0.13, CREEP_DMG, 0.6); } } },
  chop1: { dur: 0.6, lock: true, tick(a, c, w) { moveSpan(a, c, w, 0.3, 0.7, 0.08); if (crossed(c, 0.52)) strike(a, c, w, 0.25, 0.3, 55, 1.1); } },
  stab: { dur: 0.38, lock: true, tick(a, c, w) { moveSpan(a, c, w, 0.35, 0.55, 0.08); if (crossed(c, 0.5)) strike(a, c, w, 0.3, 0.22, 40, 0.8, 'poke'); } },
  // basic: the spear is already levelled at whoever is in reach, so the thrust lands almost at once
  thrust: {
    dur: 0.42, lock: true,
    tick(a, c, w) {
      if (crossed(c, 0.18)) { hitArea(a, c, w, a.x + c.dir[0] * 0.62, a.y + c.dir[1] * 0.62, 0.26, 70, 1.2, 'shove'); addFx(w, { k: 'poke', x: a.x, y: a.y, t: 0, dur: 0.2, ang: Math.atan2(c.dir[1] * TILT, c.dir[0]), face: a.face, r: 0.72 }); }
    },
  },
  // skill 1: swing from behind, over the top, full force down the drawn arc; whoever it catches flies 4 m and lands on his back
  sweep: {
    dur: 0.55, lock: true,
    tick(a, c, w) {
      parryProjectiles(a, c, w);
      if (crossed(c, 0.04)) sfxAt('whoosh', a.x, a.y, 1, 0.8);
      if (crossed(c, 0.3)) {
        const cx = a.x + c.dir[0] * 0.5, cy = a.y + c.dir[1] * 0.5;
        const n = hitArea(a, c, w, cx, cy, 0.58, 80, 1.0, 'sweep');
        const ang = Math.atan2(c.dir[1], c.dir[0]);
        // the shaft hammers the air flat: a crescent of wind on the ground and a spray of dust along it
        addFx(w, { k: 'groundArc', x: a.x, y: a.y, t: 0, dur: 0.42, ang, r: 0.95 });
        for (let i = 0; i < 9; i++) {
          const q = ang + (i / 8 - 0.5) * 2.2, r = 0.75 + Math.random() * 0.25;
          addFx(w, { k: 'dust', x: a.x + Math.cos(q) * r, y: a.y + Math.sin(q) * r, t: 0, dur: 0.5 + Math.random() * 0.3, r: 0.07 + Math.random() * 0.05, vx: Math.cos(q) * 0.9, vy: Math.sin(q) * 0.5 });
        }
        if (n) { sfxAt('wood', cx, cy, 1, 0.62); w.shake = Math.max(w.shake || 0, 0.2); w.hitStop = Math.max(w.hitStop || 0, 0.07); if (a.isPlayer) haptic(40); }
      }
    },
  },
  // skill 2: the whole body behind the spear, 10 m; whoever it runs through is wheeled overhead and hurled 7 m back the way he came
  lungeThrust: {
    dur: 0.6, lock: true,
    start(a, c) { c.rush = 0.1 + c.dist * 0.085; c.dur = c.rush + 0.2; },
    tick(a, c, w, dt) {
      if (c.combo) return lungeCombo(a, c, w, dt);
      if (crossed(c, 0.0001)) { sfxAt('whoosh', a.x, a.y, 0.9, 1.2); dust(w, a.x - c.dir[0] * 0.1, a.y - c.dir[1] * 0.1, 5, 1.4); }
      if (c.stopped || c.prev >= c.rush) return;
      const f0 = clamp(c.prev / c.rush, 0, 1), f1 = clamp(c.t / c.rush, 0, 1);
      const cur = (f) => (f < 0.15 ? (f * f) / 0.3 : f - 0.075) / 0.925;
      const d = (cur(f1) - cur(f0)) * c.dist;
      const n = Math.max(1, Math.ceil(Math.abs(d) / 0.08));
      for (let i = 0; i < n && !c.stopped; i++) {
        a.x += (c.dir[0] * d) / n; a.y += (c.dir[1] * d) / n;
        if (!w.preview) resolve(w, a, 0.12);
        if (lungeHit(a, c, w)) return;
      }
      ghostTrail(a, dt, 0.028);
      if (Math.random() < 0.7) dust(w, a.x - c.dir[0] * 0.1, a.y);
      if (Math.random() < 0.8) addFx(w, { k: 'streak', x: a.x + (Math.random() - 0.5) * 0.2, y: a.y + (Math.random() - 0.5) * 0.1, z: 0.15 + Math.random() * 0.45, t: 0, dur: 0.22, dx: c.dir[0], dy: c.dir[1], len: 0.5 + Math.random() * 0.4 });
    },
    end(a, c) { const v = c.combo && c.combo.v; if (v && v.grab && v.grab.by === a) v.grab = null; },
  },
  // the spear stuck in a man: both hands on the shaft, the foot in his chest, wrench it free and send him flying
  spearKick: {
    dur: 0.62, lock: true,
    tick(a, c, w) {
      const v = c.v, p = c.p;
      if (c.t < 0.3 && !v.dead) { const u = unit2(v.x - a.x, v.y - a.y); c.dir = u; if (Math.abs(u[0]) > 0.05) a.face = u[0] > 0 ? 1 : -1; }
      if (!crossed(c, 0.48)) return;
      if (p.dead || p.victim !== v || v.dead || !v.pinned) return;
      const u = Math.hypot(v.x - a.x, v.y - a.y) > 0.02 ? unit2(v.x - a.x, v.y - a.y) : c.dir;
      v.pinned = null; p.victim = null; p.dead = true;
      a.spearOut = false; a.cds[3] = a.hero.skills[3].cd;
      damage(w, v, 70 * 3, a, 1.2);
      if (!v.dead) launchBack(w, v, u[0], u[1], 1.2, 0.5, 0.6);
      a.kick = { dx: -u[0], dy: -u[1], d: 0.8, t: 0, dur: 0.3, slide: true };
      addFx(w, { k: 'impact', x: v.x, y: v.y, z: 0.3, t: 0, dur: 0.3 });
      addFx(w, { k: 'airRing', x: (a.x + v.x) / 2, y: (a.y + v.y) / 2, z: 0.3, t: 0, dur: 0.35, dx: u[0], dy: u[1], big: true });
      dust(w, a.x, a.y, 6, 1.4); dust(w, v.x, v.y, 6, 1.4);
      addFloater(w, a.x, a.y - 1.05, 'ถีบ!', '#ffd08a', 1.3);
      sfxAt('wood', v.x, v.y, 1, 0.5);
      w.shake = Math.max(w.shake || 0, 0.25); w.hitStop = Math.max(w.hitStop || 0, 0.09);
      if (a.isPlayer) haptic([30, 20, 90]);
      if (v.isPlayer) haptic(120);
    },
  },
  // skill 3: the javelin
  throwSpear: {
    dur: 0.42, lock: true,
    tick(a, c, w) {
      if (crossed(c, 0.12)) {
        a.spearOut = true;
        a.cds[3] = 0;
        spawnProj(a, w, 'spear', c.dir, c.dist, JAV_SPEED, 70 * 3, { javelin: true, z: 0.34, ring: 0 });
        // released at full force: a burst of air at the hand, dust kicked back off the planted feet
        addFx(w, { k: 'airRing', x: a.x + c.dir[0] * 0.3, y: a.y + c.dir[1] * 0.3, z: 0.34, t: 0, dur: 0.35, dx: c.dir[0], dy: c.dir[1], big: true });
        dust(w, a.x - c.dir[0] * 0.12, a.y - c.dir[1] * 0.06, 5, 1.3);
        sfxAt('whoosh', a.x, a.y, 1, 1.5);
        w.shake = Math.max(w.shake || 0, 0.08);
        if (a.isPlayer) addFloater(w, a.x, a.y - 1.0, 'วิ่งไปเก็บหอก!', '#f2d27a', 0.95);
      }
    },
  },
  // ----- with the spear gone: the stopgap moves (none of them can be hurt)
  punch: {
    dur: 0.32, lock: true,
    tick(a, c, w) { moveSpan(a, c, w, 0.25, 0.5, 0.06); if (crossed(c, 0.42)) punchHit(a, c, w); },
  },
  lowRoll: { dur: 0.5, lock: true, tick(a, c, w, dt) { moveSpan(a, c, w, 0, 1, c.dist, ease); ghostTrail(a, dt, 0.04); if (Math.random() < 0.6) dust(w, a.x, a.y, 1, 0.8); } },
  starJump: {
    dur: 0.62, lock: true,
    tick(a, c, w, dt) { a.air = c.t / c.dur < 0.9; moveSpan(a, c, w, 0, 1, c.dist, (t) => t); ghostTrail(a, dt, 0.05); },
    end(a, c, w) { a.air = false; dust(w, a.x, a.y, 4); },
  },
  // a feet-first slide along the ground, 3 m, kicking up a wake of dust
  slide: {
    dur: 0.62, lock: true,
    start(a, c, w) { dust(w, a.x, a.y, 6, 1.4); sfxAt('whoosh', a.x, a.y, 0.6, 0.55); },
    tick(a, c, w, dt) {
      const d = moveSpan(a, c, w, 0, 0.82, c.dist, easeOut);
      ghostTrail(a, dt, 0.05);
      if (d > 0) {
        dust(w, a.x + c.dir[0] * 0.12, a.y + c.dir[1] * 0.04, 2, 1.5);
        for (let i = 0; i < 2; i++) addFx(w, { k: 'dust', x: a.x + (Math.random() - 0.5) * 0.15, y: a.y + (Math.random() - 0.5) * 0.06, t: 0, dur: 0.8 + Math.random() * 0.4, r: 0.1 + Math.random() * 0.08, vx: -c.dir[0] * 0.6 + (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.25 });
      }
    },
  },
  prone: { dur: 2.0, lock: true, start(a, c, w) { dust(w, a.x, a.y, 5, 1.2); }, tick(a, c, w) { moveSpan(a, c, w, 0, 0.06, 0.18); } },
  dashSlash: {
    dur: 0.42, lock: true,
    tick(a, c, w, dt) {
      const d = moveSpan(a, c, w, 0, 0.65, c.dist);
      if (d > 0) { ghostTrail(a, dt); hitArea(a, c, w, a.x, a.y, 0.28, 70, 1.2); if (Math.random() < 0.6) dust(w, a.x, a.y); }
      if (crossed(c, 0.8)) { c.hits.clear(); strike(a, c, w, 0.3, 0.32, 40, 1.2); }
    },
  },
  twinDash: {
    dur: 0.46, lock: true,
    tick(a, c, w, dt) {
      const d = moveSpan(a, c, w, 0, 0.65, c.dist);
      if (d > 0) { ghostTrail(a, dt); hitArea(a, c, w, a.x, a.y, 0.32, 60, 1.2); if (Math.random() < 0.6) dust(w, a.x, a.y, 1, 1.3); }
      if (crossed(c, 0.8)) { c.hits.clear(); strike(a, c, w, 0.32, 0.34, 50, 1.3); }
    },
  },
  step: { dur: 0.22, lock: true, tick(a, c, w, dt) { moveSpan(a, c, w, 0, 1, c.dist); ghostTrail(a, dt, 0.03); }, start(a, c, w) { dust(w, a.x, a.y, 3); } },
  spin: {
    dur: 2.2, lock: false, slow: 0.6,
    tick(a, c, w) {
      const pulse = Math.floor(c.t / 0.25);
      if (pulse !== c.done) { c.done = pulse; c.hits.clear(); hitArea(a, c, w, a.x, a.y, 0.48, 30, 0.9); }
    },
  },
  twinSpin: {
    dur: 2.0, lock: false, slow: 0.6,
    tick(a, c, w) {
      const pulse = Math.floor(c.t / 0.22);
      if (pulse !== c.done) { c.done = pulse; c.hits.clear(); hitArea(a, c, w, a.x, a.y, 0.58, 34, 1); }
    },
  },
  roll: { dur: 0.45, lock: true, tick(a, c, w, dt) { moveSpan(a, c, w, 0, 1, c.dist, ease); ghostTrail(a, dt, 0.045); if (Math.random() < 0.5) dust(w, a.x, a.y); } },
  // the axe goes all the way to the end of the aim; 80% of the time it finds his head
  throwAxe: { dur: 0.6, lock: true, tick(a, c, w) { if (crossed(c, 0.5)) { a.axeOut = (a.axeOut || 0) + 1; const sk = a.hero.skills.find((k) => k.act === 'throwAxe'); spawnProj(a, w, 'axe', c.dir, sk ? sk.range : c.dist, 8, AXE_THROW_DMG, { crit: 0.8 }); sfxAt('whoosh', a.x, a.y, 0.8, 0.9); } } },
  // skill 3: crouch, spring high, come down on the mark. Everyone in the 2.5 m ring is blown out of it;
  // whoever stands in the small ring at the centre is seized, smashed face down, tossed up and cut out of the air
  leap: {
    dur: 0.9, lock: true,
    start(a, c, w) { dust(w, a.x, a.y, 6, 1.6); sfxAt('whoosh', a.x, a.y, 0.9, 0.7); },
    tick(a, c, w, dt) {
      if (!c.landed) {
        const p = clamp(c.t / c.fly, 0, 1);
        a.air = p < 0.97;
        a.x = lerp(c.x0, c.tx, p * (0.4 + 0.6 * p) * 0.4 + ease(p) * 0.6);
        a.y = lerp(c.y0, c.ty, p * (0.4 + 0.6 * p) * 0.4 + ease(p) * 0.6);
        ghostTrail(a, dt, 0.05);
        if (p >= 1) leapLand(a, c, w);
      } else if (c.combo) axeCombo(a, c, w);
    },
    end(a, c, w) {
      if (!c.landed) leapLand(a, c, w);
      const v = c.combo && c.combo.v;
      if (v && v.grab && v.grab.by === a) v.grab = null;
      a.air = false;
    },
  },
  guard: {
    dur: 1e9, lock: false, slow: 0.5,
    start(a, c, w) { c.gdir = c.dir.slice(); c.ga = Math.atan2(c.gdir[1], c.gdir[0]); sfxAt('wood', a.x, a.y, 0.35, 1.5); },
    tick(a, c, w, dt) {
      if (a.shieldBroken) { a.act = null; return; }
      if (c.demo != null) { c.demo -= dt; const an = c.t * 2.6; c.gdir = [Math.cos(an), Math.sin(an)]; if (c.demo <= 0) { a.act = null; return; } }
      // the shield swings round smoothly toward where it's pointed
      const want = Math.atan2(c.gdir[1], c.gdir[0]);
      c.ga += angDiff(want, c.ga) * (1 - Math.exp(-dt * 18));
      if (Math.abs(Math.cos(c.ga)) > 0.12) a.face = Math.cos(c.ga) > 0 ? 1 : -1;
    },
  },
  // tap: 3 m dash behind the shield; the first man it meets is shoved off his feet, lands and skids 4 m, then 2 s of stars
  bash: {
    dur: 0.5, lock: true,
    start(a, c) { c.rush = 0.1 + c.dist * 0.1; c.dur = c.rush + 0.22; },
    tick(a, c, w, dt) {
      if (c.hit || c.prev >= c.rush) return;
      const f0 = clamp(c.prev / c.rush, 0, 1), f1 = clamp(c.t / c.rush, 0, 1);
      const d = (easeOut(f1) - easeOut(f0)) * c.dist;
      const n = Math.max(1, Math.ceil(d / 0.08));
      for (let k = 0; k < n && !c.hit; k++) {
        a.x += (c.dir[0] * d) / n; a.y += (c.dir[1] * d) / n;
        if (!w.preview) resolve(w, a, 0.12);
        bashHit(a, c, w);
      }
      ghostTrail(a, dt, 0.04);
      if (Math.random() < 0.7) dust(w, a.x, a.y, 1, 1.1);
      if (!c.hit && c.t >= c.rush) hitArea(a, c, w, a.x + c.dir[0] * 0.3, a.y + c.dir[1] * 0.3, 0.3, 40, 1.2, 'blunt');
    },
  },
  charge: {
    dur: 0.95, lock: true,
    tick(a, c, w, dt) {
      const d = moveSpan(a, c, w, 0, 0.92, c.dist, (t) => t);
      a.run += dt * 3.2;
      if (d > 0) { ghostTrail(a, dt, 0.06); hitArea(a, c, w, a.x + c.dir[0] * 0.2, a.y + c.dir[1] * 0.2, 0.32, 45, 2.2, 'blunt'); if (Math.random() < 0.7) dust(w, a.x, a.y, 1, 1.2); }
    },
  },
  rally: {
    dur: 0.7, lock: true,
    tick(a, c, w) {
      if (crossed(c, 0.3)) {
        a.buffT = 5;
        addFx(w, { k: 'ring', x: a.x, y: a.y, t: 0, dur: 0.6, r: 1.1, col: '242,210,122' });
        addFloater(w, a.x, a.y - 0.9, 'ฮึกเหิม!', '#f2d27a', 1.3);
      }
    },
  },
  backflip: {
    dur: 0.55, lock: true,
    tick(a, c, w, dt) { a.air = true; moveSpan(a, c, w, 0, 1, c.dist, ease); ghostTrail(a, dt, 0.05); },
    end(a, c, w) { a.air = false; dust(w, a.x, a.y, 4); },
  },
  // bots' bow shot (half the old damage, loosed twice as often); the player draws and looses by hand (looseArrow)
  shoot: { dur: 0.3, lock: true, tick(a, c, w) { if (crossed(c, 0.55)) spawnProj(a, w, 'arrow', c.dir, ARROW_RANGE, 12, ARROW_DMG); } },
  // the string just let go: the bow arm still out, the drawing hand flung back
  loose: { dur: 0.14, lock: false },
  snipe: {
    dur: 0.38, lock: true,
    start(a, c, w) {
      // no draw-back: the arrow leaves the string the moment the finger lifts (3x a normal shot)
      spawnProj(a, w, 'arrow', c.dir, 7, 18, 45 * 3, { pierce: true, big: true, knockdown: true, fire: true, boom: true });
      sfxAt('whoosh', a.x, a.y, 0.8, 0.9);
      addFx(w, { k: 'embers', x: a.x + c.dir[0] * 0.25, y: a.y + c.dir[1] * 0.25, z: 0.42, t: 0, dur: 0.35, seed: Math.random() * 1e3, n: 9, dir: Math.atan2(c.dir[1] * TILT, c.dir[0]), small: true });
      w.shake = Math.max(w.shake || 0, 0.08);
    },
  },
  volley: {
    dur: 0.95, lock: true,
    start(a, c, w) {
      // the fan touches someone: he's marked, and four arrows hunt him down one after another
      c.lockT = volleyTarget(a, w, c.dir, (skillsOf(a).find((k) => k.act === 'volley') || { range: 5 }).range);
      if (c.lockT) {
        c.dur = 0.08 + VOLLEY_GAP * 3 + 0.3;
        c.targets = volleyPack(a, w, c.lockT);
        c.half = !!c.lockT.creep;
        for (const t of c.targets) addFloater(w, t.x, t.y - 0.95, 'ล็อคเป้า!', '#ff6a5a', t === c.lockT ? 1 : 0.85);
        if (a.isPlayer) haptic(20);
      }
    },
    tick(a, c, w) {
      const T = c.lockT;
      const offs = [-0.2, -0.07, 0.07, 0.2], spread = [-0.55, 0.42, -0.3, 0.6];
      [0, 1, 2, 3].forEach((i) => {
        if (!crossed(c, (0.08 + i * VOLLEY_GAP) / c.dur)) return;
        if (!T) {
          const base = Math.atan2(c.dir[1], c.dir[0]) + offs[i] * 0.6, d = [Math.cos(base), Math.sin(base)];
          c.aimNow = localAim(a.face, d);
          spawnProj(a, w, 'arrow', d, c.dist, 11, VOLLEY_DMG, { volley: true, from: [a.x, a.y], lob: { H: 0.9 + 0.1 * i, L: c.dist }, z: 0.45 });
          sfxAt('whoosh', a.x, a.y, 0.3, 2.4);
          return;
        }
        c.targets.forEach((t, j) => {
          if (t.dead && j > 0) return;
          // loosed slightly wide so each one curls in on him from its own side
          let base = Math.atan2(c.dir[1], c.dir[0]);
          if (!t.dead) base = Math.atan2(t.y - a.y, t.x - a.x);
          if (j === 0 && !t.dead && Math.abs(t.x - a.x) > 0.05) a.face = t.x > a.x ? 1 : -1;
          base += spread[(i + j) % 4];
          const d = [Math.cos(base), Math.sin(base)];
          if (j === 0) c.aimNow = localAim(a.face, d);
          // shot high: they climb, turn over and come down on him
          spawnProj(a, w, 'arrow', d, 9, 14, c.half ? VOLLEY_DMG * 0.5 : VOLLEY_DMG, { homing: t, volley: true, from: [a.x, a.y], lob: { H: 0.95 + 0.08 * ((i + j) % 4), L: Math.max(0.6, Math.hypot(t.x - a.x, t.y - a.y)) } });
        });
        sfxAt('whoosh', a.x, a.y, 0.35, 2.2);
      });
    },
  },
};

function updateActor(a, dt, w, move) {
  a.time += dt;
  for (let i = 0; i < 4; i++) a.cds[i] = Math.max(0, a.cds[i] - dt);
  if (a.cdsAlt) for (let i = 0; i < 4; i++) a.cdsAlt[i] = Math.max(0, a.cdsAlt[i] - dt);
  if (a.spearOut && a.hero.weapon === 'spear') a.cds[3] = 0; // the reload only starts once the spear is back in hand
  a.buffT = Math.max(0, a.buffT - dt);
  a.flash = Math.max(0, a.flash - dt);
  a.spawnShield = Math.max(0, a.spawnShield - dt);
  if (a.towerCd) a.towerCd = Math.max(0, a.towerCd - dt);
  for (const gh of a.ghosts) gh.t += dt;
  a.ghosts = a.ghosts.filter((gh) => gh.t < 0.26);
  if (a.dead) { a.burn = null; a.deathT += dt; a.respawnT -= dt; a.moving = false; if (a.respawnT <= 0 && w.spawns) { if (a.creep) a.gone = true; else respawnActor(w, a); } return; }
  // on fire: 3 s of burning, a bite every half second; wading into water puts it out
  if (a.burn) {
    const b = a.burn;
    b.t -= dt; b.tick -= dt;
    if (Math.random() < 0.5) addFx(w, { k: 'embers', x: a.x + (Math.random() - 0.5) * 0.15, y: a.y, z: 0.3 + Math.random() * 0.4, t: 0, dur: 0.5, seed: Math.random() * 1e3, n: 2, dir: -Math.PI / 2, small: true });
    if ((w.river && riverDepth(w, a.x, a.y) > 0.05) || pondAt(w, a.x, a.y, 0)) { b.t = 0; addFx(w, { k: 'ring', x: a.x, y: a.y, t: 0, dur: 0.6, r: 0.5, col: '220,235,240' }); }
    if (b.tick <= 0 && b.t > 0) { b.tick = 0.5; damage(w, a, 6, b.src, 0); }
    if (b.t <= 0) a.burn = null;
  }
  if (w.spawns) {
    const sp = w.spawns[a.team];
    if (Math.hypot(a.x - sp.x, a.y - sp.y) < 1.15 && a.hp < a.maxHp) { a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.16 * dt); a.healing = true; } else a.healing = false;
    if (a.shieldMax && !a.shieldBroken && Math.hypot(a.x - sp.x, a.y - sp.y) < 1.15) a.shieldHp = Math.min(a.shieldMax, a.shieldHp + a.shieldMax * 0.16 * dt);
    // the enemy camp burns intruders
    const ep = w.spawns[a.team === 'red' ? 'blue' : 'red'];
    if (Math.hypot(a.x - ep.x, a.y - ep.y) < 1.15 && a.spawnShield <= 0) {
      const d = a.maxHp * 0.14 * dt;
      a.hp -= d; a.burn = (a.burn || 0) + d; a.flash = Math.max(a.flash, 0.05);
      if (a.burn > 40) { addFloater(w, a.x, a.y - 0.7, '-' + Math.round(a.burn), '#ffb070', 0.9); a.burn = 0; }
      if (a.hp <= 0) killActor(w, a, null);
      if (a.dead) return;
    }
  }
  if (a.pinned) {
    const pn = a.pinned;
    a.moving = false; a.act = null; a.vx = a.vy = 0; a.kick = null; a.down = 0; a.stun = 0;
    if (pn.p.state === 'fly') return; // being carried on the spear
    pn.t += dt;
    if (pn.t >= pn.stun + pn.pull) releasePin(w, a);
    else return;
  }
  if (a.grab) {
    const gb = a.grab, by = gb.by;
    gb.t += dt;
    if (gb.t > 0.7 || by.dead || !by.act || (by.act.k !== 'lungeThrust' && by.act.k !== 'leap') || !by.act.combo) a.grab = null;
    else { a.moving = false; a.act = null; a.vx = a.vy = 0; a.kick = null; a.down = 0; a.stun = 0; return; }
  }
  if (a.kick) {
    const k = a.kick; const t0 = k.t; k.t += dt;
    const st = k.slide ? (easeOut(k.t / k.dur) - easeOut(t0 / k.dur)) * k.d : (k.d / k.dur) * dt;
    a.x += k.dx * st; a.y += k.dy * st;
    if (k.slide && k.t > 0.12 && Math.random() < 0.8) dust(w, a.x + k.dx * 0.1, a.y + k.dy * 0.05, 1, 1.2);
    if (!w.preview) resolve(w, a, 0.12);
    if (k.tumble && Math.random() < 0.55) dust(w, a.x - k.dx * 0.1, a.y - k.dy * 0.05, 1, 1.5);
    if (k.t >= k.dur && k.hops && k.hops.length) {
      // he hits the ground and is thrown up off it again, still turning over
      const h = k.hops[0];
      a.kick = { dx: k.dx, dy: k.dy, d: h.d, t: 0, dur: h.dur, air: h.h, hops: k.hops.slice(1), skid: k.skid, sd: k.sd, tumble: true, turn0: k.turn0 + k.turns, turns: 1 };
      dust(w, a.x, a.y, 12, 2.4);
      for (let i = 0; i < 5; i++) dust(w, a.x + (Math.random() - 0.5) * 0.4, a.y + (Math.random() - 0.5) * 0.3, 2, 1.8);
      addFx(w, { k: 'ring', x: a.x, y: a.y, t: 0, dur: 0.35, r: 0.35 + h.h * 0.5, col: '230,205,160' });
      addFx(w, { k: 'impact', x: a.x, y: a.y, z: 0.05, t: 0, dur: 0.25, seed: Math.random() * 1e3 });
      sfxAt('wood', a.x, a.y, 0.5 + h.h, 0.5 + (0.5 - h.h) * 0.6);
      w.shake = Math.max(w.shake || 0, 0.08 + h.h * 0.25);
      if (a.isPlayer) haptic(40);
    } else
    if (k.t >= k.dur) a.kick = k.air ? { dx: k.dx, dy: k.dy, d: k.skid != null ? k.skid : 0.4, t: 0, dur: k.sd || 0.32, slide: true } : null;
  }
  if (a.down > 0) {
    const el = a.downDur - a.down;
    if (!a.downHit && el > (a.downAir || 0.13)) {
      if (a.downAir) { sfxAt('wood', a.x, a.y, 0.9, 0.5); dust(w, a.x, a.y, 8, 2.2); w.hitStop = Math.max(w.hitStop || 0, 0.04); } a.downHit = true; dust(w, a.x, a.y, 9, 1.8); addFx(w, { k: 'ring', x: a.x, y: a.y, t: 0, dur: 0.35, r: 0.45, col: '220,200,160' }); w.shake = Math.max(w.shake || 0, 0.16); }
    a.down -= dt; a.moving = false; a.act = null; a.vx = a.vy = 0;
    return;
  }
  if (a.stun > 0) { a.stun -= dt; a.moving = false; a.act = null; a.vx = a.vy = 0; return; }
  let speed = BASE_SPEED * a.hero.speed * spdMul(a) * (a.buffT > 0 ? 1.4 : 1) * (a.slow ? 0.9 : 1);
  a.slow = false;
  let canMove = true;
  const c = a.act;
  const ox = a.x, oy = a.y;
  if (c) {
    const def = ACTS[c.k];
    c.prev = c.t;
    c.t += dt;
    if (def.lock) canMove = false;
    else speed *= def.slow || 1;
    if (def.tick) def.tick(a, c, w, dt);
    if (c.t >= c.dur && a.act === c) endAct(a, w);
  }
  const mag = Math.hypot(move[0], move[1]);
  a.moving = false;
  if (canMove && mag > 0.15) {
    let k = Math.min(1, mag * 1.15) * (1 + Math.abs(move[1] / mag)); // up/down runs twice as fast as sideways
    // wading the shallow river: a touch slower, rings spreading from every step
    if (w.river && riverDepth(w, a.x, a.y) > 0) {
      k *= 0.85;
      a.rip = (a.rip || 0) - dt;
      if (a.rip <= 0) { a.rip = 0.2; addFx(w, { k: 'ripple', x: a.x, y: a.y, t: 0, dur: 0.9, r: 0.38 }); }
    }
    a.x += (move[0] / mag) * speed * k * dt;
    a.y += (move[1] / mag) * speed * k * dt;
    if (Math.abs(move[0]) > 0.12 * mag && !(a.act && a.act.k === 'guard')) a.face = move[0] > 0 ? 1 : -1;
    a.moving = true;
    a.lastDir = [move[0] / mag, move[1] / mag];
    if (!w.preview) resolve(w, a, 0.12);
  }
  if (a.act && a.act.k === 'charge') a.moving = true;
  if (a.hero.weapon === 'spear') spearUpkeep(a, w);
  if (a.hero.weapon === 'axe') axeUpkeep(a, w);
  a.vx = (a.x - ox) / Math.max(dt, 1e-4);
  a.vy = (a.y - oy) / Math.max(dt, 1e-4);
  const sk = 1 - Math.exp(-dt * 10);
  a.svx += (clamp(a.vx, -6, 6) - a.svx) * sk;
  a.svy += (clamp(a.vy, -6, 6) - a.svy) * sk;
  if (a.moving && !(a.act && a.act.k === 'charge')) a.run += dt * speed * 1.25;
  if (a.moving && !a.air) {
    a.stepT -= dt;
    if (a.stepT <= 0) { a.stepT = 0.3 / (speed / BASE_SPEED); if (Math.random() < 0.7) dust(w, a.x - a.face * 0.05, a.y, 1, 0.7); }
  }
}

function flyStep(w, p, dt) {
  if (p.homing) steerHoming(p, dt);
  if (p.fire && Math.random() < 0.6) addFx(w, { k: 'embers', x: p.x - p.dx * 0.1, y: p.y - p.dy * 0.1, z: p.z, t: 0, dur: 0.4, seed: Math.random() * 1e3, n: 2, dir: Math.atan2(-p.dy * TILT, -p.dx), small: true });
  if (p.lob) {
    // up in a high arc and down onto the mark (wherever he has got to)
    if (p.lob.z0 == null) p.lob.z0 = p.z;
    if (p.homing && !p.homing.dead) p.lob.L = Math.max(p.went + 0.05, p.went + Math.hypot(p.homing.x - p.x, p.homing.y - p.y));
    const u = clamp(p.went / p.lob.L, 0, 1);
    p.lob.u = u;
    p.z = lerp(p.lob.z0, 0.3, u) + 4 * p.lob.H * u * (1 - u);
  }
  if (p.drop) {
    // a homing arrow from a tower: it comes down onto him wherever he has run to
    if (p.homing && !p.homing.dead) p.drop.L = Math.max(p.went + 0.05, p.went + Math.hypot(p.homing.x - p.x, p.homing.y - p.y));
    p.z = lerp(p.drop.z0, p.drop.z1, clamp(p.went / p.drop.L, 0, 1));
  }
  const step = Math.min(p.speed * dt, p.range - p.went);
  p.x += p.dx * step;
  p.y += p.dy * step;
  p.went += step;
  p.spin += dt * 16;
  if (p.big && Math.random() < 0.35) addFx(w, { k: 'trail', x: p.x, y: p.y, z: p.z, t: 0, dur: 0.22 });
  const fake = { x: p.x - p.dx, y: p.y - p.dy, face: p.dx >= 0 ? 1 : -1 };
  for (const t of p.towerOnly ? [] : w.actors || []) {
    if (t.dead || t.team === p.team || p.hits.has(t) || Math.hypot(t.x - p.x, t.y - p.y) > (p.homing === t ? 0.24 : 0.2)) continue;
    if (p.lob && (p.lob.u || 0) < 0.78) continue; // high overhead: it passes over
    if (p.homing && p.homing !== t) continue;
    if (t.act && t.act.k === 'leap' && t.act.t / t.act.dur < 0.85) continue;
    if (t.grab || t.pinned) { if (p.homing === t) p.homing = null; continue; }
    p.hits.add(t);
    if (p.homing === t) p.homing = null;
    const crit = !!p.crit && Math.random() < p.crit;
    const ok = damage(w, t, p.dmg * (crit ? CRIT_MUL : 1), p.owner, p.k === 'arrow' ? (p.big ? 1.2 : 1) : 1.7, p.x - p.dx, p.y - p.dy);
    if (ok && crit) { addFloater(w, t.x, t.y - 1.3, 'โดนหัว! คริติคอล', '#ffe14a', 1.25); addFx(w, { k: 'impact', x: t.x, y: t.y, z: 0.62, t: 0, dur: 0.3, seed: Math.random() * 1e3, big: true }); w.hitStop = Math.max(w.hitStop || 0, 0.07); if (ok === true && !t.dead) t.stun = Math.max(t.stun, 0.5); }
    if (ok === 'block') {
      const ang = Math.atan2(-p.dy, -p.dx) + (Math.random() - 0.5) * 1.3;
      p.state = 'bounce'; p.t = 0; p.bdx = Math.cos(ang); p.bdy = Math.sin(ang); p.bz = p.z;
      return;
    }
    if (ok) addFx(w, { k: 'spark', x: t.x, y: t.y, z: 0.3, t: 0, dur: 0.25, seed: Math.random() * 1e3 });
    // a volley arrow drives him back a step (1 m)
    if (ok === true && p.volley) volleyKnock(w, t, p.from ? t.x - p.from[0] : p.dx, p.from ? t.y - p.from[1] : p.dy); // straight away from the archer, whichever side the arrow curled in from
    if (ok === true && p.push && !t.dead && !t.pinned && !(t.down > 0) && !t.grab) { t.kick = { dx: p.dx, dy: p.dy, d: p.push, t: 0, dur: 0.16, slide: true }; dust(w, t.x, t.y, 2, 1); }
    // a fire arrow sets him alight
    if (ok === true && p.fire && !t.dead) { t.burn = { t: FIRE_BURN_T, tick: 0.5, src: p.owner }; addFx(w, { k: 'embers', x: t.x, y: t.y, z: 0.45, t: 0, dur: 0.6, seed: Math.random() * 1e3, n: 18, dir: Math.atan2(p.dy * TILT, p.dx) }); addFloater(w, t.x, t.y - 1.05, 'ติดไฟ!', '#ffa040', 1.1); }
    if (ok === true && p.knockdown) {
      addFx(w, { k: 'embers', x: t.x, y: t.y, z: 0.32, t: 0, dur: 0.75, seed: Math.random() * 1e3, n: 26, dir: Math.atan2(p.dy * TILT, p.dx) });
      if (!t.lastBlocked && !t.dead) knockDown(w, t, p.dx, p.dy);
      if (p.owner && p.owner.isPlayer) haptic([35, 25, 90]);
      if (t.isPlayer) haptic(120);
    }
    if (ok && !p.pierce) { land(w, p, p.k === 'arrow' ? 'gone' : 'ground'); break; }
  }
  if (p.state !== 'fly') return;
  // dummies
  for (const d of w.dummies) {
    if (p.hits.has(d) || Math.hypot(d.x - p.x, d.y - p.y) > 0.17 || (p.lob && (p.lob.u || 0) < 0.78)) continue;
    if (p.homing && p.homing !== d) continue;
    p.hits.add(d);
    if (p.homing === d) p.homing = null;
    if (p.knockdown) { d.wobV += (p.dx >= 0 ? 1 : -1) * 14; addFx(w, { k: 'embers', x: d.x, y: d.y, z: 0.32, t: 0, dur: 0.75, seed: Math.random() * 1e3, n: 24, dir: Math.atan2(p.dy * TILT, p.dx) }); if (p.owner && p.owner.isPlayer) haptic([35, 25, 90]); }
    hitArea(fake, null, { ...w, huts: null, litter: null, actors: [], bananas: [], jars: [], palms: [], mangoes: [], taros: [], grass: [], dummies: [d] }, p.x, p.y, 0.05, p.dmg, p.k === 'arrow' ? 1 : 1.6);
    if (!p.pierce) { land(w, p, p.k === 'arrow' ? 'gone' : 'ground'); break; }
  }
  if (p.state !== 'fly') return;
  // a tower: anything the other side throws or shoots at it lands in its timbers
  if (p.state === 'fly' && !p.drop && !p.lob) for (const t of w.towers || []) {
    if (t.dead || t.team === p.team || Math.hypot(t.x - p.x, t.y - p.y) > 0.4) continue;
    damageTower(w, t, p.dmg, p.owner);
    addFx(w, { k: 'spark', x: p.x, y: p.y, z: 0.6, t: 0, dur: 0.3, seed: Math.random() * 1e3 });
    if (p.javelin) javelinRest(w, p); else land(w, p, p.k === 'arrow' ? 'stuck' : 'ground');
    p.sz = 0.9;
    return;
  }
  if (p.lob && !p.homing && p.went >= p.lob.L - 1e-3) { land(w, p, 'ground'); return; } // a lobbed arrow without a mark comes down at the end of its arc
  if (p.homing || p.drop || p.lob) { if (p.went >= p.range - 1e-4) land(w, p, 'ground'); return; } // a hunting arrow (or one plunging from a tower) threads past everything else
  for (const b of w.bananas) {
    if (b.cut || p.hits.has(b)) continue;
    if (!b.stems.some((st) => Math.hypot(b.x + st.ox - p.x, b.y + st.oy - p.y) < st.r + 0.06)) continue;
    p.hits.add(b);
    hitBanana(w, b, fake.x, 1);
    if (!p.pierce) { if (p.k === 'arrow') { p.state = 'stuck'; p.t = 0; p.sz = 0.3; } else land(w, p, 'ground'); break; }
  }
  if (p.state !== 'fly') return;
  for (const c of w.palms.concat(w.mangoes)) {
    if (Math.hypot(c.x - p.x, c.y - p.y) > 0.16) continue;
    if (c.bendV !== undefined && c.lean !== undefined && c.h) c.bendV += p.dx * 1.2;
    else { c.rustleV += 6; }
    p.state = 'stuck'; p.t = 0; p.x = c.x - p.dx * 0.1; p.y = c.y + 0.02; p.sz = c.h ? 0.45 + Math.random() * 0.4 : 0.3;
    addFx(w, { k: 'spark', x: p.x, y: p.y, z: p.sz, t: 0, dur: 0.25, seed: Math.random() * 1e3 });
    break;
  }
  if (p.state !== 'fly') return;
  if (wallAt(w, p.x, p.y)) { addFx(w, { k: 'spark', x: p.x, y: p.y, z: 0.4, t: 0, dur: 0.3, seed: Math.random() * 1e3 }); sfxAt('wood', p.x, p.y, 0.5, 1.4); land(w, p, p.k === 'arrow' ? 'stuck' : 'ground'); p.sz = 0.4; return; }
  if (hutAt(w, p.x, p.y)) { hutBlow(w, p.x, p.y, 0.08, p.big ? 1.5 : 0.8, p.x - p.dx); land(w, p, p.k === 'arrow' ? 'stuck' : 'ground'); p.sz = 0.4; return; }
  if (p.went >= p.range - 1e-4) land(w, p, 'ground');
}
const FIRE_LIGHT_T = 10, FIRE_BURN_T = 4.5, BOOM_R = 1.1, BOOM_PUSH = 0.8, BOOM_DMG = 35;
// the fire arrow bursts where it comes to rest: everyone round it (of the other side) blown 2 m away, the brush shaken
function fireBoom(w, p) {
  p.boomed = true;
  const team = p.team, x = p.x, y = p.y;
  addFx(w, { k: 'blast', x, y, t: 0, dur: 0.7, r: BOOM_R, seed: Math.random() * 1e3 });
  addFx(w, { k: 'ring', x, y, t: 0, dur: 0.5, r: BOOM_R * 1.15, col: '255,170,70' });
  addFx(w, { k: 'impact', x, y, z: 0.25, t: 0, dur: 0.4, seed: Math.random() * 1e3, big: true });
  addFx(w, { k: 'embers', x, y, z: 0.2, t: 0, dur: 0.9, seed: Math.random() * 1e3, n: 34, dir: -Math.PI / 2 });
  dust(w, x, y, 10, 1.8);
  for (const t of w.actors || []) {
    if (t.dead || t.team === team || t.pinned || t.grab) continue;
    const d = Math.hypot(t.x - x, t.y - y);
    if (d > BOOM_R) continue;
    const u = d > 0.03 ? [(t.x - x) / d, (t.y - y) / d] : [p.dx, p.dy];
    const ok = damage(w, t, BOOM_DMG, p.owner, 1.4, x, y);
    if (ok === true && !t.dead) launchBack(w, t, u[0], u[1], BOOM_PUSH, 0.32, 0.25, 0.3);
  }
  for (const tw of w.towers || []) if (!tw.dead && tw.team !== team && Math.hypot(tw.x - x, tw.y - y) < BOOM_R + 0.3) damageTower(w, tw, BOOM_DMG, p.owner);
  for (const b of w.bananas || []) if (!b.cut && Math.hypot(b.x - x, b.y - y) < BOOM_R) hitBanana(w, b, x, 1.6);
  for (const c of (w.palms || []).concat(w.mangoes || [])) if (Math.hypot(c.x - x, c.y - y) < BOOM_R + 0.4) { if (c.bendV !== undefined && c.h) c.bendV += (c.x >= x ? 1 : -1) * 2.5; else c.rustleV = (c.rustleV || 0) + 10; }
  hutBlow(w, x, y, BOOM_R, 1.6, x);
  floraBlow(w, x, y, BOOM_R, 1.6);
  sfxAt('wood', x, y, 1, 0.45);
  w.shake = Math.max(w.shake || 0, 0.3); w.hitStop = Math.max(w.hitStop || 0, 0.05);
  if (p.owner && p.owner.isPlayer) haptic([40, 30, 110]);
}
function updateProj(w, dt) {
  // the fire arrows' lights on the ground
  if (w.lights) { for (const l of w.lights) l.t += dt; w.lights = w.lights.filter((l) => l.t < l.dur); }
  for (const p of w.proj) {
    p.t += dt;
    if (p.boom && !p.boomed && p.state !== 'fly') fireBoom(w, p);
    // a fire arrow come to rest burns where it stands for ten seconds, lighting the ground round it
    if (p.fire && !p.lit && p.state !== 'fly' && p.state !== 'bounce') {
      p.lit = true;
      if (!p.hidden) { (w.lights || (w.lights = [])).push({ x: p.x, y: p.y, t: 0, dur: FIRE_LIGHT_T, team: p.owner ? p.owner.team : null, seed: Math.random() * 10 }); p.t = 0; }
    }
    if (p.state === 'fly') {
      const sub = Math.max(1, Math.ceil((p.speed * dt) / 0.1));
      for (let i = 0; i < sub && p.state === 'fly'; i++) (p.javelin ? flyJavelin : flyStep)(w, p, dt / sub);
    } else if (p.javelin && p.state !== 'bounce') {
      // waits where it lies until its thrower comes for it
    } else if (p.state === 'bounce') {
      const u = p.t / 0.5;
      const sp = 3.2 * (1 - u);
      p.x += p.bdx * sp * dt; p.y += p.bdy * sp * dt;
      p.spin += dt * 22;
      p.bz = Math.max(0, p.z + Math.sin(u * Math.PI) * 0.3 - u * p.z);
      if (u >= 1) land(w, p, 'ground');
    } else {
      const life = p.k === 'arrow' ? (p.lit && !p.hidden ? FIRE_LIGHT_T : 6) : 1.1;
      if (p.k === 'axe' && !p.hidden) { /* lies where it fell until its thrower comes for it (axeUpkeep) */ }
      else if (p.t > life) {
        p.dead = true;
        if (p.k === 'spear') { p.owner.spearOut = false; addFx(w, { k: 'puff', x: p.owner.x, y: p.owner.y, z: 0.25, t: 0, dur: 0.4 }); }
        if (p.k === 'axe') { p.owner.axeOut = Math.max(0, (p.owner.axeOut || 0) - 1); addFx(w, { k: 'puff', x: p.owner.x, y: p.owner.y, z: 0.25, t: 0, dur: 0.4 }); }
      }
    }
  }
  w.proj = w.proj.filter((p) => !p.dead);
}
function land(w, p, state) {
  p.t = 0;
  if (p.javelin) { javelinRest(w, p); return; }
  if (state === 'gone') { p.state = 'ground'; p.t = 99; return; }
  if (!w.preview && !onLand(w, p.x, p.y)) {
    addFx(w, { k: 'splash', x: p.x, y: p.y, t: 0, dur: 0.8, power: p.k === 'arrow' ? 0.4 : 0.8, seed: Math.random() * 1e3 });
    addFx(w, { k: 'ring', x: p.x, y: p.y, t: 0, dur: 0.9, r: 0.4, col: '232,248,236' });
    p.state = 'ground';
    p.t = p.k === 'arrow' ? 99 : 0.6;
    p.hidden = true;
    return;
  }
  p.state = state;
  if (p.k !== 'arrow') dust(w, p.x, p.y, 2);
}

function updateFx(w, dt) {
  for (const f of w.fx) {
    f.t += dt;
    if (f.k === 'dust') { f.x += f.vx * dt; f.y += f.vy * dt; }
  }
  w.fx = w.fx.filter((f) => f.t < f.dur);
  for (const f of w.floaters) f.t += dt;
  w.floaters = w.floaters.filter((f) => f.t < f.dur);
}

// ---------- drawing projectiles, effects, the man himself ----------
function drawProj(g, p, k) {
  if (p.hidden) return;
  if (p.javelin) return drawJavelin(g, p, k);
  const [sx, sy] = w2s(p.x, p.y);
  const s = k * 0.36;
  const sa = p.lob && p.state === 'fly' ? Math.atan2(p.dy * TILT - ((0.3 - p.lob.z0) + 4 * p.lob.H * (1 - 2 * (p.lob.u || 0))) / p.lob.L, p.dx)
    : p.drop && p.state === 'fly' ? Math.atan2(p.dy * TILT + (p.drop.z0 - p.drop.z1) / p.drop.L, p.dx) : Math.atan2(p.dy * TILT, p.dx);
  const fade = p.k === 'arrow' && p.state !== 'fly' ? clamp((p.lit ? FIRE_LIGHT_T : 6) - p.t, 0, 1) : p.state !== 'fly' ? clamp((1.1 - p.t) / 0.3, 0, 1) : 1;
  g.save();
  g.globalAlpha *= fade;
  if (p.state === 'fly') {
    drawShadow(g, sx, sy, k * 0.12, k * 0.03, 0.4);
    const y = sy - p.z * k;
    if (p.k === 'arrow') {
      const L = k * (p.big ? 0.38 : 0.3);
      if (p.big) { g.globalAlpha *= 0.6; g.drawImage(auraSprite(), sx - L * 0.3, y - L * 0.3, L * 0.6, L * 0.6); g.globalAlpha /= 0.6; }
      drawOneArrow(g, sx - Math.cos(sa) * L * 0.6, y - Math.sin(sa) * L * 0.6, sa, L, s * (p.big ? 1.25 : 1), true);
      if (p.fire && (p.state === 'fly' || p.t < (p.lit ? FIRE_LIGHT_T : 2.5))) {
        // the arrowhead ablaze, the flame streaming back along the shaft
        const tx = sx + Math.cos(sa) * L * 0.36, ty = y + Math.sin(sa) * L * 0.36, f = p.state === 'fly' ? 1 : p.lit ? clamp((FIRE_LIGHT_T - p.t) / 1.5, 0, 1) : clamp(1 - p.t / 2.5, 0, 1);
        g.save(); g.globalCompositeOperation = 'lighter'; g.translate(tx, ty); g.rotate(p.state === 'fly' ? sa - Math.PI / 2 : -Math.PI / 2 + Math.sin(p.t * 3) * 0.2);
        drawFlame(g, 0, 0, k * 0.035 * f, k * (p.state === 'fly' ? 0.2 : 0.1) * f * (0.85 + 0.15 * Math.sin(p.t * 40)), p.t * 30);
        g.restore();
      }
      g.strokeStyle = 'rgba(255,250,230,0.35)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(sx - Math.cos(sa) * L * 1.6, y - Math.sin(sa) * L * 1.6); g.lineTo(sx - Math.cos(sa) * L * 0.6, y - Math.sin(sa) * L * 0.6); g.stroke();
    } else if (p.k === 'spear') {
      const L = 1.75 * s, h = Math.sin((p.went / p.range) * Math.PI) * k * 0.18;
      drawSpearShape(g, sx - Math.cos(sa) * L * 0.6, y - h - Math.sin(sa) * L * 0.6, sx + Math.cos(sa) * L * 0.4, y - h + Math.sin(sa) * L * 0.4, p.team, s, p.dx >= 0 ? 1 : -1);
    } else {
      drawAxe(g, sx - Math.cos(p.spin) * s * 0.15, y - Math.sin(p.spin) * s * 0.15, p.spin * (p.dx >= 0 ? 1 : -1), s);
    }
  } else if (p.state === 'bounce') {
    drawShadow(g, sx, sy, k * 0.1, k * 0.03, 0.4);
    const y = sy - p.bz * k, a2 = p.spin * (p.bdx >= 0 ? 1 : -1);
    if (p.k === 'arrow') drawOneArrow(g, sx - Math.cos(a2) * k * 0.15, y - Math.sin(a2) * k * 0.15, a2, k * 0.3, s, true);
    else if (p.k === 'spear') { const L = 1.75 * s; drawSpearShape(g, sx - Math.cos(a2) * L * 0.5, y - Math.sin(a2) * L * 0.5, sx + Math.cos(a2) * L * 0.5, y + Math.sin(a2) * L * 0.5, p.team, s, 1); }
    else drawAxe(g, sx, y, a2, s);
  } else if (p.state === 'stuck') {
    const y = sy - (p.sz || 0.3) * k;
    if (p.k === 'arrow') drawOneArrow(g, sx - Math.cos(sa) * k * 0.22, y - Math.sin(sa) * k * 0.22, sa, k * 0.22, s, false);
    else drawSpearShape(g, sx - Math.cos(sa) * s * 1.2, y - Math.sin(sa) * s * 1.2, sx + Math.cos(sa) * s * 0.1, y + Math.sin(sa) * s * 0.1, p.team, s, 1);
  } else {
    if (p.k === 'arrow') {
      const ang = Math.atan2(Math.sin(sa) * 0.5 + 0.75, Math.cos(sa));
      drawOneArrow(g, sx - Math.cos(ang) * k * 0.2, sy - Math.sin(ang) * k * 0.2, ang, k * 0.2, s, false);
    } else if (p.k === 'spear') {
      const L = 1.75 * s;
      drawShadow(g, sx - Math.cos(sa) * L * 0.25, sy, L * 0.3, s * 0.05, 0.7);
      const bx = sx - Math.cos(sa) * L * 0.6, by = sy - L * 0.55, n = Math.hypot(sx - bx, sy - by) || 1;
      drawSpearShape(g, bx, by, bx + ((sx - bx) / n) * L, by + ((sy - by) / n) * L, p.team, s, p.dx >= 0 ? 1 : -1);
    } else {
      drawShadow(g, sx, sy, s * 0.2, s * 0.05, 0.7);
      drawAxe(g, sx - s * 0.15, sy - s * 0.04, p.dx >= 0 ? 0.25 : Math.PI - 0.25, s);
    }
  }
  // the fire arrow burning where it came to rest
  if (p.lit && p.state !== 'fly' && p.t < FIRE_LIGHT_T) {
    const fy = p.state === 'stuck' ? sy - (p.sz || 0.3) * k : sy, f = clamp((FIRE_LIGHT_T - p.t) / 1.5, 0, 1);
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(sx, fy); g.rotate(-Math.PI / 2 + Math.sin(p.t * 3) * 0.15);
    drawFlame(g, 0, 0, k * 0.045 * f, k * 0.15 * f * (0.85 + 0.15 * Math.sin(p.t * 40)), p.t * 30);
    g.restore();
  }
  g.restore();
}
function drawGroundFx(g, w, k) {
  for (const f of w.fx) {
    const u = f.t / f.dur;
    if (f.k === 'dust') {
      const [x, y] = w2s(f.x, f.y);
      const r = f.r * k * (0.6 + u * 1.2);
      g.fillStyle = `rgba(176,156,112,${0.38 * (1 - u)})`;
      g.beginPath(); g.ellipse(x, y - r * 0.4 - u * k * 0.05, r, r * 0.7, 0, 0, TAU); g.fill();
    } else if (f.k === 'crack') {
      // the ground split open: jagged cracks out from the middle, a dark scorch, fading slowly
      const [x, y] = w2s(f.x, f.y);
      const al = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3, grow = easeOut(Math.min(1, (f.t / 0.14))), R = k * f.r * grow;
      const r = mulberry32(Math.floor(f.seed));
      g.save(); g.translate(x, y); g.scale(1, TILT);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.9);
      gr.addColorStop(0, `rgba(40,26,14,${0.45 * al})`); gr.addColorStop(1, 'rgba(40,26,14,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.9, 0, TAU); g.fill();
      g.lineCap = 'round'; g.lineJoin = 'round';
      const n = 9;
      for (let i = 0; i < n; i++) {
        let a = (i / n) * TAU + (r() - 0.5) * 0.5, px = 0, py = 0;
        const L = R * (0.6 + r() * 0.4), segs = 4;
        const pts = [[0, 0]];
        for (let j = 1; j <= segs; j++) { a += (r() - 0.5) * 0.7; px += Math.cos(a) * L / segs; py += Math.sin(a) * L / segs; pts.push([px, py]); if (j === 2 && r() < 0.7) { const b = a + (r() < 0.5 ? 0.9 : -0.9); pts.push([px + Math.cos(b) * L * 0.25, py + Math.sin(b) * L * 0.25], [px, py]); } }
        g.beginPath(); pts.forEach((p, j) => (j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.strokeStyle = `rgba(24,14,6,${0.85 * al})`; g.lineWidth = Math.max(1.2, k * 0.028); g.stroke();
        g.strokeStyle = `rgba(210,180,130,${0.35 * al})`; g.lineWidth = Math.max(0.6, k * 0.008); g.stroke();
      }
      // lifted slabs round the rim
      for (let i = 0; i < 7; i++) { const a = r() * TAU, d = R * (0.55 + r() * 0.4), w2 = k * (0.05 + r() * 0.05); g.fillStyle = `rgba(92,70,44,${0.8 * al})`; g.beginPath(); g.moveTo(Math.cos(a) * d - w2, Math.sin(a) * d); g.lineTo(Math.cos(a) * d, Math.sin(a) * d - w2 * 1.3); g.lineTo(Math.cos(a) * d + w2, Math.sin(a) * d); g.closePath(); g.fill(); }
      g.restore();
    } else if (f.k === 'groundArc') {
      const [x, y] = w2s(f.x, f.y);
      const R = f.r * k * (0.8 + 0.4 * easeOut(u));
      g.save();
      g.translate(x, y); g.scale(1, TILT);
      g.beginPath(); g.arc(0, 0, R, f.ang - 1.15, f.ang + 1.15); g.arc(0, 0, R * 0.8, f.ang + 1.0, f.ang - 1.0, true); g.closePath();
      g.fillStyle = `rgba(255,240,205,${0.5 * (1 - u)})`; g.fill();
      g.beginPath(); g.arc(0, 0, R, f.ang - 1.15, f.ang + 1.15);
      g.strokeStyle = `rgba(255,252,236,${0.85 * (1 - u)})`; g.lineWidth = Math.max(1.5, k * 0.03 * (1 - u)); g.stroke();
      g.restore();
    } else if (f.k === 'ripple') {
      const [x, y] = w2s(f.x, f.y);
      for (const [m, a] of [[1, 0.55], [0.6, 0.35]]) {
        const r = f.r * k * (0.25 + easeOut(u) * 0.75) * m;
        g.strokeStyle = `rgba(236,250,246,${a * (1 - u)})`;
        g.lineWidth = Math.max(1, k * 0.014 * (1 - u * 0.5));
        g.beginPath(); g.ellipse(x, y, r, r * TILT * 0.8, 0, 0, TAU); g.stroke();
      }
    } else if (f.k === 'ring') {
      const [x, y] = w2s(f.x, f.y);
      const r = f.r * k * easeOut(u);
      g.strokeStyle = `rgba(${f.col},${0.7 * (1 - u)})`;
      g.lineWidth = Math.max(1.5, k * 0.04 * (1 - u));
      g.beginPath(); g.ellipse(x, y, r, r * TILT, 0, 0, TAU); g.stroke();
    }
  }
}
function drawAirFx(g, w, k) {
  for (const f of w.fx) {
    const u = f.t / f.dur;
    if (f.k === 'slash' || f.k === 'poke' || f.k === 'sweep') {
      const [x, y0] = w2s(f.x, f.y);
      const y = y0 - k * 0.2;
      g.save();
      g.translate(x, y);
      g.rotate(f.ang);
      const a = 1 - u;
      if (f.k === 'poke') {
        const L = f.r * k;
        const grd = g.createLinearGradient(L * 0.2, 0, L * 1.05, 0);
        grd.addColorStop(0, 'rgba(255,250,230,0)');
        grd.addColorStop(1, `rgba(255,250,230,${0.85 * a})`);
        g.fillStyle = grd;
        g.beginPath(); g.moveTo(L * 0.2, -k * 0.025); g.lineTo(L * 1.08, 0); g.lineTo(L * 0.2, k * 0.025); g.closePath(); g.fill();
      } else {
        const R = f.r * k * (0.9 + u * 0.2);
        const span = f.k === 'sweep' ? 1.5 : 1.15;
        g.scale(1, f.k === 'sweep' ? 0.45 : 0.75);
        const flip = Math.cos(f.ang) < 0 ? -1 : 1;
        g.beginPath();
        g.arc(0, 0, R, -span * flip, span * flip, flip < 0);
        g.arc(0, R * 0.18, R * 0.72, span * flip * 0.9, -span * flip * 0.9, flip > 0);
        g.closePath();
        g.fillStyle = `rgba(255,248,226,${0.75 * a})`;
        g.fill();
        if (f.big) { g.strokeStyle = `rgba(242,210,122,${0.8 * a})`; g.lineWidth = 2; g.stroke(); }
      }
      g.restore();
    } else if (f.k === 'streak') {
      const [x, y0] = w2s(f.x, f.y);
      const y = y0 - f.z * k;
      const sa = Math.atan2(f.dy * TILT, f.dx), L = f.len * k * (1 - u * 0.4);
      const off = u * k * 0.25;
      const x1 = x - Math.cos(sa) * off, y1 = y - Math.sin(sa) * off;
      g.save();
      g.strokeStyle = `rgba(255,250,232,${0.55 * (1 - u)})`;
      g.lineWidth = Math.max(1, k * 0.012);
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - Math.cos(sa) * L, y1 - Math.sin(sa) * L); g.stroke();
      g.restore();
    } else if (f.k === 'blast') {
      // the fireball: a white-hot core swelling into orange, a dark smoky rim, flame tongues thrown out
      const [x, y] = w2s(f.x, f.y);
      const e = easeOut(Math.min(1, u * 1.6)), R = k * f.r * (0.35 + 0.75 * e), al = 1 - u;
      g.save(); g.translate(x, y - k * 0.12 * e); g.scale(1, 0.78);
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
      gr.addColorStop(0, `rgba(255,250,220,${al})`); gr.addColorStop(0.3, `rgba(255,200,90,${al * 0.95})`); gr.addColorStop(0.65, `rgba(240,110,30,${al * 0.7})`); gr.addColorStop(1, 'rgba(160,40,10,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
      const r = mulberry32(Math.floor(f.seed));
      for (let i = 0; i < 12; i++) {
        const a = r() * TAU, L = R * (0.75 + r() * 0.6);
        g.strokeStyle = `rgba(255,${150 + r() * 80},60,${al * 0.9})`; g.lineWidth = Math.max(1.5, k * 0.03 * (1 - u)); g.lineCap = 'round';
        g.beginPath(); g.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      if (u > 0.25) { g.fillStyle = `rgba(40,30,24,${0.35 * (1 - u)})`; g.beginPath(); g.arc(0, -R * 0.4 * u, R * (0.6 + u * 0.5), 0, TAU); g.fill(); }
      g.restore();
    } else if (f.k === 'airRing') {
      // a ring of shocked air standing across the flight line
      const [x, y0] = w2s(f.x, f.y);
      const y = y0 - f.z * k;
      const sa = Math.atan2(f.dy * TILT, f.dx);
      const R = k * (f.big ? 0.16 : 0.1) * (0.6 + easeOut(u) * 1.2);
      g.save();
      g.translate(x, y); g.rotate(sa);
      g.strokeStyle = `rgba(255,248,228,${(f.big ? 0.85 : 0.6) * (1 - u)})`;
      g.lineWidth = Math.max(1, k * (f.big ? 0.022 : 0.014) * (1 - u * 0.5));
      g.beginPath(); g.ellipse(-u * k * 0.1, 0, R * 0.32, R, 0, 0, TAU); g.stroke();
      g.restore();
    } else if (f.k === 'spark' || f.k === 'impact') {
      const [x, y0] = w2s(f.x, f.y);
      const y = y0 - (f.z || 0.25) * k;
      const r = mulberry32(Math.floor((f.seed || 7) * 13));
      g.save();
      g.lineCap = 'round';
      const n = f.k === 'impact' ? 10 : 7;
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, L = k * (0.06 + r() * 0.1) * (f.big || f.k === 'impact' ? 1.6 : 1);
        const d0 = L * u * 0.8, d1 = d0 + L * (1 - u);
        g.strokeStyle = i % 2 ? `rgba(255,236,150,${1 - u})` : `rgba(255,255,255,${1 - u})`;
        g.lineWidth = Math.max(1, k * 0.012);
        g.beginPath(); g.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0); g.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1); g.stroke();
      }
      g.restore();
    } else if (f.k === 'blood') {
      const [x, y0] = w2s(f.x, f.y);
      const y = y0 - f.z * k;
      g.fillStyle = `rgba(139,10,10,${1 - u})`;
      for (const [dx, dy, rr] of [[0.08, -0.1, 0.05], [0.16, -0.16, 0.035], [0.2, -0.03, 0.04], [0.12, 0.06, 0.03]]) {
        g.beginPath(); g.arc(x + f.dir * (dx + u * 0.1) * k * 0.5, y + (dy + u * 0.08) * k * 0.5, rr * k * 0.4, 0, TAU); g.fill();
      }
    } else if (f.k === 'leafBits') {
      const r = mulberry32(Math.floor(f.seed));
      for (let i = 0; i < f.n; i++) {
        const a = r() * TAU, sp = 0.3 + r() * 0.7, vz = 1 + r() * 1.4;
        const t = f.t;
        const z = f.z + vz * t - 3 * t * t;
        const [x, y0] = w2s(f.x + Math.cos(a) * sp * t, f.y + Math.sin(a) * sp * 0.6 * t);
        if (z < 0) continue;
        g.save();
        g.globalAlpha = 1 - u;
        g.translate(x, y0 - z * k);
        g.rotate(r() * 6 + t * 9);
        g.fillStyle = f.col === 'straw' ? (i % 2 ? '#d9b860' : '#b8923e') : i % 2 ? '#5a9a44' : '#3f7a32';
        g.fillRect(-k * 0.025, -k * 0.006, k * 0.05, k * 0.012);
        g.restore();
      }
    } else if (f.k === 'splash') {
      const [x, y] = w2s(f.x, f.y);
      const r = mulberry32(Math.floor(f.seed));
      const crown = Math.sin(Math.min(1, u * 2.2) * Math.PI);
      g.fillStyle = `rgba(232,248,240,${0.6 * crown})`;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU, rx = k * 0.18 * f.power * (0.6 + u);
        const bx = x + Math.cos(a) * rx, by = y + Math.sin(a) * rx * 0.45, h = k * 0.2 * f.power * crown * (0.7 + 0.5 * r());
        g.beginPath(); g.moveTo(bx - k * 0.025, by); g.quadraticCurveTo(bx, by - h * 1.2, bx + k * 0.025, by); g.fill();
      }
      g.fillStyle = `rgba(236,250,244,${0.9 * (1 - u)})`;
      for (let i = 0; i < 16; i++) {
        const a = r() * TAU, sp = (0.4 + r() * 0.9) * f.power, up = (1.2 + r() * 1.6) * f.power, t = f.t * (0.8 + r() * 0.4);
        const z = (up * t - 4.5 * t * t) * k * 0.5;
        if (z < 0) continue;
        g.beginPath(); g.arc(x + Math.cos(a) * sp * t * k * 0.9, y + Math.sin(a) * sp * t * k * 0.45 - z, Math.max(1, k * 0.012), 0, TAU); g.fill();
      }
    } else if (f.k === 'embers') {
      const [x, y0] = w2s(f.x, f.y);
      const y = y0 - (f.z || 0.3) * k;
      const r = mulberry32(Math.floor(f.seed));
      const sz = f.small ? 0.55 : 1;
      g.save();
      g.globalCompositeOperation = 'lighter';
      if (u < 0.4) {
        const fa = 1 - u / 0.4, R = k * 0.38 * sz * (0.5 + u * 1.5);
        const grd = g.createRadialGradient(x, y, 0, x, y, R);
        grd.addColorStop(0, `rgba(255,244,190,${0.95 * fa})`);
        grd.addColorStop(0.35, `rgba(255,160,50,${0.65 * fa})`);
        grd.addColorStop(1, 'rgba(255,80,20,0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
      }
      if (!f.small && u < 0.5) {
        g.strokeStyle = `rgba(255,190,90,${0.8 * (1 - u / 0.5)})`;
        g.lineWidth = Math.max(1.5, k * 0.025 * (1 - u));
        const R2 = k * 0.6 * easeOut(u / 0.5);
        g.beginPath(); g.ellipse(x, y0, R2, R2 * TILT, 0, 0, TAU); g.stroke();
      }
      g.lineCap = 'round';
      for (let i = 0; i < f.n; i++) {
        const a = f.dir != null ? f.dir + (r() - 0.5) * 2.4 : r() * TAU;
        const sp = (1.3 + r() * 2.8) * sz, vz = 0.5 + r() * 1.8, life = 0.45 + r() * 0.55;
        const t = f.t;
        if (t > life * f.dur) { r(); continue; }
        const al = 1 - t / (life * f.dur);
        const px = x + Math.cos(a) * sp * t * k * 0.55, py = y + Math.sin(a) * sp * t * k * 0.32 - (vz * t - 2.4 * t * t) * k * 0.6;
        const col = i % 3 === 0 ? '255,244,180' : i % 3 === 1 ? '255,170,60' : '255,96,30';
        g.strokeStyle = `rgba(${col},${al})`;
        g.lineWidth = Math.max(1.2, k * 0.014 * sz);
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - Math.cos(a) * k * 0.05 * sz, py - Math.sin(a) * k * 0.03 * sz + k * 0.012); g.stroke();
      }
      g.restore();
    } else if (f.k === 'block' || f.k === 'shieldBreak') {
      const [x, y0] = w2s(f.x, f.y);
      const y = y0 - f.z * k;
      const r = mulberry32(Math.floor(f.seed));
      const big = f.k === 'shieldBreak';
      g.save();
      if (u < 0.3) {
        const fa = 1 - u / 0.3, R = k * (big ? 0.5 : 0.28) * (0.5 + u * 1.8);
        g.globalCompositeOperation = 'lighter';
        const grd = g.createRadialGradient(x, y, 0, x, y, R);
        grd.addColorStop(0, `rgba(255,250,220,${0.9 * fa})`); grd.addColorStop(0.5, `rgba(255,220,140,${0.4 * fa})`); grd.addColorStop(1, 'rgba(255,200,120,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
        g.globalCompositeOperation = 'source-over';
        g.strokeStyle = `rgba(255,240,190,${fa})`; g.lineWidth = Math.max(1.5, k * 0.016); g.lineCap = 'round';
        for (let i = 0; i < 8; i++) { const a = (f.ang || 0) + (i / 8 - 0.5) * 2.6, d0 = k * 0.08, d1 = k * (0.2 + 0.14 * (i % 2)) * (0.6 + u * 1.5); g.beginPath(); g.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0 * 0.8); g.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1 * 0.8); g.stroke(); }
      }
      // splinters of rattan and wood
      const n = big ? 22 : 9;
      const cols = ['#d9b878', '#a87a3e', '#f0e0b0', '#7a5428'];
      for (let i = 0; i < n; i++) {
        const a = big ? r() * TAU : (f.ang || 0) + (r() - 0.5) * 2.4;
        const sp = (0.6 + r() * 1.4) * (big ? 1.3 : 1), vz = 1 + r() * 1.8, t = f.t;
        const z = vz * t - 3.2 * t * t;
        const life = (0.5 + r() * 0.5) * f.dur;
        const rot = r() * 6, len = k * (big ? 0.06 + r() * 0.08 : 0.03 + r() * 0.03);
        if (t > life) continue;
        const px = x + Math.cos(a) * sp * t * k * 0.5, py = y + Math.sin(a) * sp * t * k * 0.3 - Math.max(-0.2, z) * k * 0.5;
        g.globalAlpha = 1 - t / life;
        g.save(); g.translate(px, py); g.rotate(rot + t * 12 * (i % 2 ? 1 : -1));
        g.lineWidth = 0.8;
        g.beginPath();
        if (big && i % 3 === 0) { g.arc(0, 0, len, 0, 1.6); g.lineWidth = Math.max(1.5, k * 0.012); g.strokeStyle = '#b08850'; g.stroke(); }
        else { g.fillStyle = cols[i % 4]; g.strokeStyle = INK; g.rect(-len / 2, -len * 0.12, len, len * 0.24); g.fill(); g.stroke(); }
        g.restore();
      }
      g.restore();
    } else if (f.k === 'trail') {
      const [x, y0] = w2s(f.x, f.y);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(255,170,60,${0.7 * (1 - u)})`;
      g.beginPath(); g.arc(x, y0 - f.z * k, Math.max(1, k * 0.025 * (1 - u)), 0, TAU); g.fill();
      g.restore();
    } else if (f.k === 'puff') {
      const [x, y0] = w2s(f.x, f.y);
      g.save();
      g.globalAlpha = 1 - u;
      g.drawImage(auraSprite(), x - k * 0.3, y0 - k * 0.55, k * 0.6, k * 0.6);
      g.restore();
    }
  }
}
function drawSpinWhirl(g, a, x, y, k) {
  const c = a.act;
  if (!c || (c.k !== 'spin' && c.k !== 'twinSpin')) return;
  const R = (c.k === 'twinSpin' ? 0.6 : 0.5) * k;
  const th = c.t * 13;
  const fade = Math.min(1, (c.dur - c.t) / 0.3, c.t / 0.15);
  g.save();
  g.translate(x, y - k * 0.2);
  g.scale(1, 0.32);
  for (let i = 0; i < 2; i++) {
    const a0 = th + i * Math.PI;
    g.beginPath();
    g.arc(0, 0, R, a0 - 1.4, a0);
    g.arc(0, 0, R * 0.78, a0, a0 - 1.4, true);
    g.closePath();
    g.fillStyle = `rgba(255,248,226,${0.55 * fade})`;
    g.fill();
  }
  g.restore();
}
function drawActor(g, a, k) {
  const [x, y] = w2s(a.x, a.y);
  const s = k * a.hero.size;
  if (a.pinned) return drawPinned(g, a, x, y, s, k);
  if (a.dead) {
    const P = basePose({ ...a, moving: false });
    P.fall = Math.min(1, a.deathT / 0.3);
    const fade = a.respawnT < 1 ? Math.max(0, a.respawnT) : 1;
    g.save();
    g.globalAlpha = 0.6 * fade * Math.min(1, a.deathT / 0.6);
    g.fillStyle = '#4a0404';
    g.beginPath(); g.ellipse(x - a.face * s * 0.35, y + s * 0.02, s * 0.45, s * 0.12, 0, 0, TAU); g.fill();
    g.restore();
    drawFigure(g, a, x, y, s, P, fade * 0.95);
    return null;
  }
  for (const gh of a.ghosts) {
    const [gx, gy] = w2s(gh.x, gh.y);
    drawFigure(g, gh.snap, gx, gy, s, gh.P, 0.32 * (1 - gh.t / 0.26));
  }
  const P = a.creep ? creepPose(a) : poseOf(a);
  const c = a.act;
  if (c && (c.k === 'spin' || c.k === 'twinSpin') && Math.sin(c.t * 13) < 0) drawSpinWhirl(g, a, x, y, k);
  if (a.grab && a.grab.k === 'axe') {
    // in the axeman's hands: hauled up, smashed face down, thrown into the air
    const gb = a.grab, P = basePose({ ...a, moving: false, readyDir: null });
    P.fall = gb.fall; P.liftS = gb.lift; P.spin = gb.spin;
    P.fh = [0.28, -0.9]; P.bh = [-0.2, -0.95];
    P.legs = gb.spin ? { fa: 0.7, ba: -0.5, fk: 0.9, bk: 0.6 } : { fa: 0.15, ba: -0.2, fk: 0.2, bk: 0.3 };
    drawFigure(g, a, x, y, s, P);
    if (!gb.lift && gb.fall <= -0.99) drawStunStars(g, x + a.face * s * 0.5, y + s * 0.62, s * 0.8, a.time);
    return { x, y: y - gb.lift * s * 0.6 + (gb.lift < 0.2 ? s * 0.5 : 0), s };
  }
  if (a.grab) {
    // skewered on the spear, wheeled through the air
    const P = basePose({ ...a, moving: false, readyDir: null });
    P.fall = 0.5 + 0.5 * Math.min(1, a.grab.spin / 1.2);
    P.liftS = a.grab.lift;
    P.fh = [0.26, -0.95]; P.bh = [-0.2, -1.0];
    P.legs = { fa: 0.7, ba: -0.45, fk: 0.9, bk: 0.6 };
    drawShadow(g, x, y, s * 0.2, s * 0.05, 0.5);
    drawFigure(g, a, x, y, s, P);
    return { x, y: y - a.grab.lift * s * 0.6, s };
  }
  if (a.down > 0) {
    const el = a.downDur - a.down;
    const lie = Math.min(1, el / 0.13, a.down / 0.3);
    const P = basePose({ ...a, moving: false });
    P.fall = lie;
    const inAir = a.kick && a.kick.air;
    if (inAir) {
      // hurled: a high arc, turning over once on the way
      const u = clamp(a.kick.t / a.kick.dur, 0, 1);
      P.liftS = Math.sin(u * Math.PI) * a.kick.air + (1 - u) * (a.kick.z0 != null ? a.kick.z0 : 0.3);
      P.spin = a.kick.tumble ? -(a.kick.turn0 + u * a.kick.turns) * TAU : -u * TAU * 0.85; // (cut out of the air: over and over, bounce after bounce)
      P.legs = { fa: 0.6, ba: -0.3, fk: 0.7, bk: 0.5 };
      P.fh = [0.25, -0.9]; P.bh = [-0.22, -0.92];
      // a dust streak in his wake
      g.save(); g.globalAlpha = 0.35 * (1 - u);
      drawShadow(g, x, y, s * 0.22 * (1 - u * 0.3), s * 0.06, 0.6);
      g.restore();
    } else P.liftS = el < 0.13 ? Math.sin((el / 0.13) * Math.PI) * 0.22 : 0;
    drawFigure(g, a, x, y, s, P);
    if (lie > 0.8 && !inAir) drawStunStars(g, x - a.face * s * 0.55, y + s * 0.62, s * 0.8, a.time);
    return { x, y: y + s * 0.6 * lie, s };
  }
  if (a.spawnShield > 0) { g.save(); g.globalAlpha = 0.5 + 0.3 * Math.sin(a.time * 12); g.strokeStyle = 'rgba(255,240,200,0.9)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y - s * 0.5, s * 0.45, s * 0.62, 0, 0, TAU); g.stroke(); g.restore(); }
  const shake = a.flash > 0 ? Math.sin(a.time * 90) * s * 0.03 : 0;
  const gc = c && c.k === 'guard' && !a.shieldBroken ? c : null;
  let shieldNow = null;
  if (gc) {
    const ga = gc.ga, sa = Math.atan2(Math.sin(ga) * TILT, Math.cos(ga));
    // the arc the shield covers, on the ground
    const sf = clamp(a.shieldHp / a.shieldMax, 0, 1);
    g.save();
    g.translate(x, y); g.scale(1, TILT);
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, k * 0.55, ga - 1.3, ga + 1.3); g.closePath();
    g.fillStyle = `rgba(255,${Math.round(140 + 80 * sf)},90,0.16)`; g.fill();
    g.strokeStyle = `rgba(255,${Math.round(140 + 80 * sf)},110,0.55)`; g.lineWidth = 1.5; g.stroke();
    g.restore();
    P.noShield = true;
    const lx = Math.cos(sa) * 0.3 * a.face, ly = -0.54 + Math.sin(sa) * 0.13;
    P.fh = [clamp(lx, -0.2, 0.3), ly];
    P.crouch = 0.1;
    shieldNow = { x: x + shake + Math.cos(sa) * s * 0.3, y: y - P.liftS * s - s * 0.54 + Math.sin(sa) * s * 0.13, sa };
    if (Math.sin(sa) < -0.2) drawShieldFacing(g, shieldNow.x, shieldNow.y, s, sa);
  }
  drawFigure(g, a, x + shake, y, s, P);
  if (a.hero.weapon === 'spear') drawSpearTrail(g, a, x + shake, y, s, P);
  if (a.burn) drawBurning(g, a, x + shake, y, s);
  if (shieldNow && Math.sin(shieldNow.sa) >= -0.2) drawShieldFacing(g, shieldNow.x, shieldNow.y, s, shieldNow.sa);

  if (a.flash > 0) {
    g.save();
    g.globalAlpha = a.flash / 0.16 * 0.55;
    const grd = g.createRadialGradient(x, y - s * 0.55, 0, x, y - s * 0.55, s * 0.6);
    grd.addColorStop(0, 'rgba(255,90,70,0.9)'); grd.addColorStop(1, 'rgba(255,90,70,0)');
    g.fillStyle = grd; g.fillRect(x - s * 0.6, y - s * 1.15, s * 1.2, s * 1.2);
    g.restore();
  }
  if (a.stun > 0) drawStunStars(g, x, y - P.liftS * s, s, a.time);
  if (c && (c.k === 'spin' || c.k === 'twinSpin')) drawSpinWhirl(g, a, x, y, k);
  return { x, y: y - P.liftS * s, s };
}
// minions move on a few held frames: six to a stride, ten a second in a fight. The pose is only worked out
// when the frame changes
function creepPose(a) {
  const c = a.act;
  const key = (c ? c.k + Math.floor(c.t * 10) : a.moving ? 'r' + Math.floor(a.run * 6) : 'i' + Math.floor(a.time * 3)) + (a.face > 0 ? 'R' : 'L');
  if (a._pk === key && a._P) return a._P;
  const o = Object.create(a);
  o.run = (Math.floor(a.run * 6) + 0.5) / 6;
  o.time = Math.floor(a.time * 3) / 3;
  if (c) { o.act = Object.create(c); o.act.t = Math.min(c.dur, (Math.floor(c.t * 10) + 0.5) / 10); }
  a._pk = key;
  return (a._P = poseOf(o));
}
function drawStunStars(g, x, y, size, t) {
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + (i * TAU) / 3, sx = x + Math.cos(a) * size * 0.32, sy = y - size * 1.08 + Math.sin(a) * size * 0.1, r = size * 0.08;
    g.fillStyle = '#ffe066'; g.strokeStyle = 'rgba(60,40,10,0.8)'; g.lineWidth = Math.max(0.6, size * 0.02);
    g.beginPath();
    for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.45 : r, aa = (k * Math.PI) / 5 - Math.PI / 2 + t * 3; g.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr); }
    g.closePath(); g.fill(); g.stroke();
  }
}
function drawNameplate(g, a, x, top, team, label) {
  const T = TEAM[team];
  const w = 74, h = 7;
  const frac = clamp(a.hp / a.maxHp, 0, 1);
  if (a.shieldMax) {
    // the yellow shield bar sits on top of the HP bar
    const sb = top - 14 - 6;
    g.save();
    g.fillStyle = 'rgba(10,6,2,0.8)';
    g.fillRect(x - w / 2 - 2, sb - 1, w + 4, 6);
    if (a.shieldBroken) {
      const prog = a.delivery ? clamp(a.delivery.t / 7, 0, 1) : 0;
      g.fillStyle = 'rgba(170,130,50,0.9)';
      g.fillRect(x - w / 2, sb, w * prog, 4);
      g.font = '600 10px Kanit, "Noto Sans Thai", sans-serif';
      g.textAlign = 'center';
      g.lineWidth = 3; g.strokeStyle = 'rgba(10,6,2,0.9)';
      const txt = a.delivery ? 'รับโล่ ' + Math.max(0, 7 - a.delivery.t).toFixed(1) : 'โล่แตก';
      g.strokeText(txt, x, sb + 3); g.fillStyle = '#ffb070'; g.fillText(txt, x, sb + 3);
    } else {
      const sf = clamp(a.shieldHp / a.shieldMax, 0, 1);
      g.fillStyle = '#f2c84a';
      g.fillRect(x - w / 2, sb, w * sf, 4);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(x - w / 2, sb, w * sf, 1);
    }
    g.restore();
    top -= 7;
  }

  const y = top - 14;
  g.save();
  g.font = GFX[gfx].pixel ? '700 20px Kanit, "Noto Sans Thai", sans-serif' : '600 12px Kanit, "Noto Sans Thai", sans-serif';
  g.textAlign = 'center';
  g.lineWidth = GFX[gfx].pixel ? 4 : 3;
  g.strokeStyle = 'rgba(10,6,2,0.85)';
  g.strokeText(label, x, y - 6);
  g.fillStyle = '#fff4d6';
  g.fillText(label, x, y - 6);
  g.fillStyle = 'rgba(10,6,2,0.8)';
  g.fillRect(x - w / 2 - 2, y - 1, w + 4, h + 4);
  g.fillStyle = 'rgba(60,40,30,0.9)';
  g.fillRect(x - w / 2, y + 1, w, h);
  g.fillStyle = a.isPlayer ? '#5fcf4a' : T.main;
  g.fillRect(x - w / 2, y + 1, w * frac, h);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(x - w / 2, y + 1, w * frac, 2);
  g.fillStyle = 'rgba(10,6,2,0.7)';
  const tick = a.maxHp > 1500 ? 500 : 100;
  for (let hp = tick; hp < a.maxHp; hp += tick) g.fillRect(x - w / 2 + (w * hp) / a.maxHp, y + 1, 1, h);
  if (a.lvl) {
    // the level, in a little disc at the head of the bar
    const bx = x - w / 2 - 10, by = y + 1 + h / 2;
    g.beginPath(); g.arc(bx, by, 8.5, 0, TAU); g.fillStyle = 'rgba(14,9,4,0.92)'; g.fill();
    g.strokeStyle = a.lvl >= MAX_LVL ? '#ffd35a' : '#c9a55a'; g.lineWidth = 1.5; g.stroke();
    g.font = '700 10.5px Kanit, "Noto Sans Thai", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffe9a8'; g.fillText(String(a.lvl), bx, by + 0.5);
  }
  g.restore();
}
function drawFloaters(g, w, k) {
  g.save();
  g.textAlign = 'center';
  for (const f of w.floaters) {
    const u = f.t / f.dur;
    const [x, y0] = w2s(f.x, f.y);
    const y = y0 - u * k * 0.35;
    const pop = u < 0.12 ? 1 + (1 - u / 0.12) * 0.5 : 1;
    const fs = Math.round(15 * f.size * pop * (GFX[gfx].pixel ? 1.6 : 1)); // micro-pixel: bigger letters, or they're mush
    g.font = `800 ${fs}px Kanit, "Noto Sans Thai", sans-serif`;
    g.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
    g.lineWidth = 3.5;
    g.strokeStyle = 'rgba(30,14,6,0.9)';
    g.strokeText(f.text, x, y);
    g.fillStyle = f.col;
    g.fillText(f.text, x, y);
  }
  g.restore();
}

// ---------- the villager soldier who brings a fresh shield ----------
let VILLAGER_HERO = null;
function villagerGate(w, team) {
  const sp = w.spawns[team];
  // beyond the nearest dry map edge, so he walks in from out of frame
  const opts = [{ x: -0.8, y: sp.y, d: sp.x }, { x: sp.x, y: -0.8, d: sp.y }, { x: sp.x, y: w.H + 0.8, d: w.H - sp.y }];
  opts.sort((a, b) => a.d - b.d);
  return opts[0];
}
function updateDeliveries(w, dt) {
  if (!w.spawns) return;
  if (!VILLAGER_HERO) VILLAGER_HERO = Object.assign({}, heroById('shield'), { id: 'villager', name: 'ทหารชาวบ้าน', size: 0.33, head: 'ngob' });
  w.villagers = w.villagers || [];
  for (const a of w.actors) {
    if (!a.shieldMax) continue;
    const sp = w.spawns[a.team];
    const inBase = !a.dead && Math.hypot(a.x - sp.x, a.y - sp.y) < 1.15;
    if (a.shieldBroken && inBase && !a.delivery) {
      const gate = villagerGate(w, a.team);
      const v = { hero: VILLAGER_HERO, team: a.team, x: gate.x, y: gate.y, gate, face: 1, time: 0, run: 0, seed: Math.random() * 9, moving: true, buffT: 0, act: null, spearOut: false, axeOut: false, shieldBroken: false, state: 'in', give: 0 };
      w.villagers.push(v);
      a.delivery = { v, t: 0 };
      if (a.isPlayer) addFloater(w, a.x, a.y - 1.0, 'ทหารกำลังนำโล่มาให้...', '#f2d27a', 0.9);
    }
    const D = a.delivery;
    if (!D) continue;
    if (!inBase || !a.shieldBroken) { D.v.state = 'out'; a.delivery = null; continue; }
    D.t += dt;
    const v = D.v;
    const side = v.x <= a.x ? -1 : 1;
    const gx = a.x + side * 0.3, gy = a.y + 0.02;
    if (D.t < 5.3) {
      const dx = gx - v.x, dy = gy - v.y, d = Math.hypot(dx, dy);
      const sp2 = Math.min(2.4, d / Math.max(0.25, 5.3 - D.t));
      if (d > 0.03) { v.x += (dx / d) * sp2 * dt; v.y += (dy / d) * sp2 * dt; v.moving = true; v.run += dt * sp2 * 1.4; v.face = dx >= 0 ? 1 : -1; }
      else v.moving = false;
    } else {
      v.state = 'give'; v.moving = false;
      v.x += (gx - v.x) * 0.2; v.y += (gy - v.y) * 0.2;
      v.face = a.x >= v.x ? 1 : -1;
      v.give = clamp((D.t - 5.3) / 0.5, 0, 1);
    }
    if (D.t >= 7) {
      a.shieldBroken = false; a.shieldHp = a.shieldMax;
      v.state = 'out'; v.shieldBroken = true;
      a.delivery = null;
      addFx(w, { k: 'ring', x: a.x, y: a.y, t: 0, dur: 0.6, r: 0.7, col: '242,210,122' });
      addFx(w, { k: 'puff', x: a.x + a.face * 0.12, y: a.y, z: 0.2, t: 0, dur: 0.5 });
      addFloater(w, a.x, a.y - 1.0, 'ได้โล่ใหม่!', '#f2d27a', 1.15);
      sfxAt('wood', a.x, a.y, 0.8, 1.25);
      if (a.isPlayer) haptic(40);
    }
  }
  for (const v of w.villagers) {
    v.time += dt;
    if (v.state !== 'out') continue;
    const dx = v.gate.x - v.x, dy = v.gate.y - v.y, d = Math.hypot(dx, dy);
    if (d < 0.05) { v.gone = true; continue; }
    v.x += (dx / d) * 1.5 * dt; v.y += (dy / d) * 1.5 * dt;
    v.moving = true; v.run += dt * 2.1; v.face = dx >= 0 ? 1 : -1;
  }
  w.villagers = w.villagers.filter((v) => !v.gone);
}
function drawVillager(g, v, k) {
  const [x, y] = w2s(v.x, v.y);
  const s = k * v.hero.size;
  const P = basePose(v);
  if (v.state === 'give') { P.fh = [lerp(0.18, 0.34, v.give), lerp(-0.53, -0.7, v.give)]; P.lean = 0.08 * v.give; }
  drawFigure(g, v, x, y, s, P);
}

// ================= the javelin: impale, carry, pin, pull out, pick up =================
function punchHit(a, c, w) {
  const x = a.x + c.dir[0] * 0.28, y = a.y + c.dir[1] * 0.28;
  addFx(w, { k: 'impact', x, y, z: 0.25, t: 0, dur: 0.22 });
  for (const t of w.actors || []) {
    if (t === a || t.dead || t.team === a.team || c.hits.has(t) || t.pinned) continue;
    if (Math.hypot(t.x - x, t.y - y) > 0.36) continue;
    c.hits.add(t);
    if (t.act && INVULN[t.act.k]) { addFloater(w, t.x, t.y - 0.75, 'หลบ!', '#bfe6ff', 0.85); continue; }
    const u = unit2(t.x - a.x, t.y - a.y);
    t.kick = { dx: u[0], dy: u[1], d: 0.4, t: 0, dur: 0.18 };
    t.stun = Math.max(t.stun, 1);
    t.act = null;
    t.flash = 0.12;
    addFloater(w, t.x, t.y - 0.8, 'มึน!', '#ffe066', 1);
    sfxAt('wood', t.x, t.y, 0.6, 0.55);
    if (a.isPlayer) haptic(30);
  }
  for (const d of w.dummies) if (Math.hypot(d.x - x, d.y - y) < 0.3) { d.wobV += (d.x >= a.x ? 1 : -1) * 6; d.hitT = 0; }
}
function kickTarget(a, w) {
  const p = myJavelin(w, a);
  if (!p || p.state === 'fly' || p.state === 'bounce') return null;
  const v = p.victim;
  if (!v || v.dead || !v.pinned || v.pinned.p !== p || v.pinned.t > 3) return null;
  return Math.hypot(v.x - a.x, v.y - a.y) < 0.85 ? v : null;
}
function startSpearKick(a, w, v) {
  a.spawnShield = 0;
  const dir = unit2(v.x - a.x, v.y - a.y);
  if (Math.abs(dir[0]) > 0.05) a.face = dir[0] > 0 ? 1 : -1;
  if (a.act) endAct(a, w);
  a.act = { k: 'spearKick', t: 0, prev: 0, dur: ACTS.spearKick.dur, dir, dist: 0, la: localAim(a.face, dir), hits: new Set(), v, p: myJavelin(w, a) };
  cdsOf(a)[0] = 0.6;
  return true;
}
// the tower button: a basic attack at the nearest enemy tower in reach, never at a man
function towerReach(a) { return a.hero.weapon === 'bow' ? ARROW_RANGE : a.hero.weapon === 'spear' ? 1.25 : 0.95; }
function nearestEnemyTower(a, w) { let best = null, bd = 1e9; for (const t of w.towers || []) { if (t.dead || t.team === a.team) continue; const d = Math.hypot(t.x - a.x, t.y - a.y); if (d < bd) { bd = d; best = t; } } return best ? { t: best, d: bd } : null; }
function towerStrike(a, w) {
  if (a.dead || a.stun > 0 || a.down > 0 || a.pinned || a.grab) return false;
  const nt = nearestEnemyTower(a, w);
  if (!nt || nt.d > towerReach(a) + 0.3) return false;
  const dir = unit2(nt.t.x - a.x, nt.t.y - a.y);
  if (a.hero.weapon === 'bow') {
    if (a.act && ACTS[a.act.k].lock) return false;
    if ((a.towerCd || 0) > 0) return false;
    a.towerCd = 0.28 / asMul(a);
    if (Math.abs(dir[0]) > 0.05) a.face = dir[0] > 0 ? 1 : -1;
    a.act = { k: 'loose', t: 0, prev: 0, dur: ACTS.loose.dur, dir, dist: 0, hits: new Set() };
    spawnProj(a, w, 'arrow', dir, Math.min(ARROW_RANGE, nt.d + 0.2), 12 * asMul(a), ARROW_DMG, { towerOnly: true });
    sfxAt('whoosh', a.x, a.y, 0.3, 2.4);
    return true;
  }
  if (unarmed(a) && a.hero.weapon === 'spear') return false; // bare fists do nothing to timber
  a._towerOnly = true;
  const ok = cast(a, w, 0, dir, 1);
  a._towerOnly = false;
  return ok;
}
function myJavelin(w, a) { for (const p of w.proj) if (p.owner === a && p.javelin && !p.dead) return p; return null; }
function spearUpkeep(a, w) {
  // the spear lowers at whoever is in reach, ready to thrust
  a.readyDir = null;
  if (!a.spearOut && !a.act) {
    let best = null, bd = 1.12;
    for (const t of w.actors || []) { if (t.dead || t.team === a.team) continue; const d = Math.hypot(t.x - a.x, t.y - a.y); if (d < bd) { bd = d; best = t; } }
    if (!best) for (const d of w.dummies) { const dd = Math.hypot(d.x - a.x, d.y - a.y); if (dd < bd) { bd = dd; best = d; } }
    if (best) { a.readyDir = unit2(best.x - a.x, best.y - a.y); if (Math.abs(a.readyDir[0]) > 0.08) a.face = a.readyDir[0] > 0 ? 1 : -1; }
  }
  if (!a.spearOut) return;
  const p = myJavelin(w, a);
  if (!p) { a.spearOut = false; return; }
  if (p.state === 'fly' || p.state === 'bounce') return;
  if (p.victim && !p.victim.dead) return; // still stuck in someone who's alive
  const gx = p.gx != null ? p.gx : p.x, gy = p.gy != null ? p.gy : p.y;
  if (Math.hypot(a.x - gx, a.y - gy) < 0.5 && !a.air) pickUpSpear(w, a, p);
  // failsafe: if it somehow ended up where no one can reach, it comes home by itself
  else if (!w.preview && p.t > 20 && !(p.victim && !p.victim.dead)) { pickUpSpear(w, a, p); addFloater(w, a.x, a.y - 1.2, 'ได้หอกคืน', '#f2d27a', 0.9); }
}
function pickUpSpear(w, a, p) {
  if (p.victim) { p.victim.pinned = null; p.victim = null; }
  p.dead = true;
  a.spearOut = false;
  a.cds[3] = a.hero.skills[3].cd; // the 10 s reload starts now
  addFx(w, { k: 'ring', x: a.x, y: a.y, t: 0, dur: 0.45, r: 0.5, col: '242,210,122' });
  addFx(w, { k: 'puff', x: a.x, y: a.y, z: 0.3, t: 0, dur: 0.4 });
  addFloater(w, a.x, a.y - 0.95, 'เก็บหอกแล้ว!', '#f2d27a', 1);
  sfxAt('wood', a.x, a.y, 0.6, 1.3);
  if (a.isPlayer) haptic(30);
}
function javelinObstacle(w, x, y) {
  for (const c of w.palms) if (Math.hypot(c.x - x, c.y - y) < 0.15) return { kind: 'tree', o: c };
  for (const m of w.mangoes) if (Math.hypot(m.x - x, m.y - y) < 0.2) return { kind: 'tree', o: m };
  for (const b of w.bananas) if (!b.cut && b.stems.some((st) => Math.hypot(b.x + st.ox - x, b.y + st.oy - y) < st.r + 0.05)) return { kind: 'banana', o: b };
  for (const d of w.dummies) if (Math.hypot(d.x - x, d.y - y) < 0.14) return { kind: 'dummy', o: d };
  if (hutAt(w, x, y)) return { kind: 'hut' };
  if (wallAt(w, x, y)) return { kind: 'wall' };
  return null;
}
function flyJavelin(w, p, dt) {
  const step = Math.min(p.speed * dt, p.range - p.went);
  const nx = p.x + p.dx * step, ny = p.y + p.dy * step;
  const ob = javelinObstacle(w, nx, ny);
  if (ob) { pinObstacle(w, p, ob); return; }
  const out = !w.preview && (nx < 0.35 || ny < 0.4 || nx > w.W - 0.35 || ny > w.H - 0.35);
  if (out) { if (p.victim) pinGround(w, p); else javelinRest(w, p); return; } // never past the edge of the field
  if (p.victim && !w.preview && !onLand(w, nx, ny)) { pinGround(w, p); return; }
  p.x = nx; p.y = ny; p.went += step;
  // rings of torn air every few strides, and wind streaks peeling off the shaft
  p.ring += step;
  if (p.ring > 0.55) { p.ring = 0; addFx(w, { k: 'airRing', x: p.x - p.dx * 0.2, y: p.y - p.dy * 0.2, z: p.z, t: 0, dur: 0.3, dx: p.dx, dy: p.dy }); }
  if (Math.random() < 0.35) addFx(w, { k: 'streak', x: p.x - p.dx * 0.25, y: p.y - p.dy * 0.25 + (Math.random() - 0.5) * 0.04, z: p.z + (Math.random() - 0.5) * 0.08, t: 0, dur: 0.2, dx: p.dx, dy: p.dy, len: 0.45 + Math.random() * 0.4 });
  if (p.victim) { p.victim.x = p.x - p.dx * 0.04; p.victim.y = p.y - p.dy * 0.04; }
  else {
    for (const t of w.actors || []) {
      if (t.dead || t.team === p.team || p.hits.has(t) || t.pinned || t.grab || Math.hypot(t.x - p.x, t.y - p.y) > 0.2) continue;
      if (t.act && ((t.act.k === 'leap' && t.act.t / t.act.dur < 0.85) || t.act.k === 'starJump')) continue;
      p.hits.add(t);
      const res = damage(w, t, p.dmg, p.owner, 1.0, p.x - p.dx, p.y - p.dy);
      if (res === 'block') { const ang = Math.atan2(-p.dy, -p.dx) + (Math.random() - 0.5) * 1.3; p.state = 'bounce'; p.t = 0; p.bdx = Math.cos(ang); p.bdy = Math.sin(ang); p.bz = p.z; return; }
      if (res === true) impale(w, p, t);
      break;
    }
  }
  if (p.went >= p.range - 1e-4) { if (p.victim) pinGround(w, p); else javelinRest(w, p); }
}
function impale(w, p, t) {
  p.victim = t;
  t.pinned = { p, t: 0, stun: 1, pull: 3, dir: [p.dx, p.dy], kind: null };
  t.act = null; t.kick = null; t.down = 0; t.stun = 0;
  if (t.delivery) { t.delivery.v.state = 'out'; t.delivery = null; }
  t.face = p.dx > 0 ? -1 : 1;
  addFx(w, { k: 'blood', x: t.x, y: t.y, z: 0.25, t: 0, dur: 0.4, dir: p.dx >= 0 ? 1 : -1 });
  addFx(w, { k: 'spark', x: t.x, y: t.y, z: 0.25, t: 0, dur: 0.3, seed: Math.random() * 1e3, big: true });
  addFloater(w, t.x, t.y - 1.0, 'ถูกเสียบ!', '#ff9a80', 1.1);
  sfxAt('wood', t.x, t.y, 0.9, 0.6);
  w.shake = Math.max(w.shake || 0, 0.15);
  if (p.owner && p.owner.isPlayer) haptic([30, 20, 70]);
  if (t.isPlayer) haptic(150);
}
function pinGround(w, p) {
  p.state = 'stuck'; p.pinKind = 'ground'; p.t = 0;
  p.gx = p.x; p.gy = p.y;
  const t = p.victim;
  if (t) {
    t.pinned.kind = 'ground';
    t.x = p.x - p.dx * 0.22; t.y = p.y - p.dy * 0.22;
    addFx(w, { k: 'ring', x: p.x, y: p.y, t: 0, dur: 0.4, r: 0.5, col: '220,200,160' });
    dust(w, p.x, p.y, 10, 1.8);
    sfxAt('wood', p.x, p.y, 0.9, 0.5);
    w.shake = Math.max(w.shake || 0, 0.2);
  } else dust(w, p.x, p.y, 3);
  settleSpear(w, p);
}
function pinObstacle(w, p, ob) {
  p.state = 'stuck'; p.pinKind = 'obstacle'; p.t = 0;
  p.sz = 0.2;
  p.gx = p.x - p.dx * 0.28; p.gy = p.y - p.dy * 0.28;
  if (ob.kind === 'banana') hitBanana(w, ob.o, p.x - p.dx, 1.5);
  else if (ob.kind === 'tree') { if (ob.o.trunks) palmHit(w, ob.o, 1.3, p.dx >= 0 ? 1 : -1, true); else { ob.o.rustleV += 8; ob.o.leanV += p.dx * 1.5; } }
  else if (ob.kind === 'dummy') { ob.o.wobV += p.dx * 8; ob.o.hitT = 0; if (!p.victim) { ob.o.total += p.dmg; addFloater(w, ob.o.x, ob.o.y - 0.62, '-' + p.dmg, '#ffd35a', 1.3); } }
  addFx(w, { k: 'spark', x: p.x, y: p.y, z: p.sz, t: 0, dur: 0.3, seed: Math.random() * 1e3, big: true });
  sfxAt('wood', p.x, p.y, 1, 0.8);
  w.shake = Math.max(w.shake || 0, 0.16);
  const t = p.victim;
  if (t) { t.pinned.kind = 'obstacle'; t.x = p.x - p.dx * 0.12; t.y = p.y - p.dy * 0.12; }
  settleSpear(w, p);
  if (ob.kind === 'hut') { p.pinHut = hutAt(w, p.x, p.y) || hutAt(w, p.x - p.dx * 0.2, p.y - p.dy * 0.2); hutBlow(w, p.x, p.y, 0.18, 1.6, p.x - p.dx); }
}
// a javelin that hit nothing alive: planted in the ground, or lying on the bank if the water would take it
function javelinRest(w, p) {
  if (!w.preview && !onLand(w, p.x, p.y)) {
    addFx(w, { k: 'splash', x: p.x, y: p.y, t: 0, dur: 0.8, power: 0.7, seed: Math.random() * 1e3 });
    const q = shoreOut(w, p.x, p.y, 0.25);
    p.x = q.x; p.y = q.y;
    p.state = 'lying'; p.gx = p.x; p.gy = p.y; p.t = 0;
    settleSpear(w, p);
    return;
  }
  if (p.state === 'bounce') { p.state = 'lying'; p.gx = p.x; p.gy = p.y; p.t = 0; settleSpear(w, p); return; }
  p.state = 'stuck'; p.pinKind = 'ground'; p.gx = p.x; p.gy = p.y; p.t = 0;
  dust(w, p.x, p.y, 3);
  settleSpear(w, p);
}
// the victim works the spear loose and drops it at his feet
function releasePin(w, a) {
  const pn = a.pinned, p = pn.p;
  a.pinned = null;
  p.victim = null;
  if (pn.kind === 'obstacle') { a.x -= pn.dir[0] * 0.1; a.y -= pn.dir[1] * 0.1; if (!w.preview) resolve(w, a, 0.12); }
  p.state = 'lying';
  p.x = a.x + pn.dir[0] * 0.12; p.y = a.y + 0.05;
  p.gx = p.x; p.gy = p.y;
  settleSpear(w, p);
  addFloater(w, a.x, a.y - 0.9, 'ดึงหอกออก!', '#e8d8b0', 0.95);
  dust(w, a.x, a.y, 4);
  sfxAt('wood', a.x, a.y, 0.6, 0.9);
}
function drawJavelin(g, p, k) {
  const [sx, sy] = w2s(p.x, p.y);
  const s = k * 0.36, L = 1.75 * s;
  const sa = Math.atan2(p.dy * TILT, p.dx);
  const ca = Math.cos(sa), sn = Math.sin(sa);
  if (p.state === 'fly') {
    drawShadow(g, sx, sy, L * 0.35, k * 0.03, 0.45);
    const y = sy - p.z * k;
    g.save();
    // motion blur: a long tapering wake behind the shaft, white-hot at the head
    const TL = L * 2.6, hx = sx + ca * L * 0.5, hy = y + sn * L * 0.5, tx = sx - ca * TL, ty = y - sn * TL;
    const grd = g.createLinearGradient(tx, ty, hx, hy);
    grd.addColorStop(0, 'rgba(255,240,200,0)');
    grd.addColorStop(0.7, 'rgba(255,236,180,0.32)');
    grd.addColorStop(1, 'rgba(255,255,240,0.6)');
    const nx = -sn, ny = ca, wd = s * 0.07;
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(sx - ca * L * 0.4 + nx * wd, y - sn * L * 0.4 + ny * wd); g.lineTo(hx, hy); g.lineTo(sx - ca * L * 0.4 - nx * wd, y - sn * L * 0.4 - ny * wd); g.closePath(); g.fill();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.75;
    g.drawImage(auraSprite(), hx - s * 0.28, hy - s * 0.28, s * 0.56, s * 0.56);
    g.restore();
    drawSpearShape(g, sx - ca * L * 0.5, y - sn * L * 0.5, sx + ca * L * 0.5, y + sn * L * 0.5, p.team, s, p.dx >= 0 ? 1 : -1);
  } else if (p.state === 'bounce') {
    const y = sy - p.bz * k, a2 = p.spin * (p.bdx >= 0 ? 1 : -1);
    drawShadow(g, sx, sy, k * 0.1, k * 0.03, 0.4);
    drawSpearShape(g, sx - Math.cos(a2) * L * 0.5, y - Math.sin(a2) * L * 0.5, sx + Math.cos(a2) * L * 0.5, y + Math.sin(a2) * L * 0.5, p.team, s, 1);
  } else if (p.state === 'stuck' && p.pinKind === 'obstacle') {
    // sticking straight out of the trunk / wall, back toward the thrower
    const y = sy - p.sz * k;
    drawSpearShape(g, sx - ca * L * 0.85, y - sn * L * 0.85, sx + ca * s * 0.12, y + sn * s * 0.12, p.team, s, 1);
  } else if (p.state === 'stuck') {
    // planted: the blade in the earth, the shaft leaning back toward the thrower
    const bx = sx - ca * L * 0.45, by = sy - L * 0.62;
    const n = Math.hypot(sx - bx, sy - by) || 1;
    drawShadow(g, sx - ca * L * 0.3, sy, L * 0.3, s * 0.05, 0.6);
    drawSpearShape(g, bx, by, bx + ((sx - bx) / n) * L * 0.92, by + ((sy - by) / n) * L * 0.92, p.team, s, p.dx >= 0 ? 1 : -1);
  } else {
    // lying flat on the ground
    drawShadow(g, sx, sy + s * 0.02, L * 0.5, s * 0.05, 0.6);
    drawSpearShape(g, sx - ca * L * 0.5, sy - s * 0.03, sx + ca * L * 0.5, sy, p.team, s, p.dx >= 0 ? 1 : -1);
  }
  // a beacon over the spear for whoever has to fetch it
  if (p.state !== 'fly' && p.state !== 'bounce' && p.owner && p.owner.isPlayer && !(p.victim && !p.victim.dead)) {
    const bob = Math.sin(performance.now() / 180) * 4;
    const bx = sx, by = (p.state === 'stuck' && p.pinKind === 'ground' ? sy - L * 0.7 : sy - s * 0.9) + bob;
    g.save();
    g.fillStyle = '#f2d27a'; g.strokeStyle = INK; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(bx - 7, by - 10); g.lineTo(bx + 7, by - 10); g.lineTo(bx, by); g.closePath(); g.fill(); g.stroke();
    g.font = '700 11px Kanit, "Noto Sans Thai", sans-serif'; g.textAlign = 'center';
    g.lineWidth = 3; g.strokeStyle = 'rgba(10,6,2,0.85)'; g.strokeText('เก็บหอก', bx, by - 14); g.fillStyle = '#ffe9a8'; g.fillText('เก็บหอก', bx, by - 14);
    g.restore();
  }
}
// impaled: carried on the spear, pinned to the earth flat on his back, or nailed to a trunk or wall
function drawPinned(g, a, x, y, s, k) {
  const pn = a.pinned, p = pn.p;
  const P = basePose({ ...a, moving: false, readyDir: null });
  P.noShield = false;
  const alive = !a.dead;
  const pulling = alive && pn.t > pn.stun && p.state !== 'fly';
  const rock = pulling ? Math.sin(a.time * 13) : 0;
  let shake = pulling ? rock * s * 0.02 : 0;
  if (p.state === 'fly') {
    P.fall = 0.3; P.liftS = 0.3;
    P.fh = [0.24, -0.52]; P.bh = [-0.22, -0.95];
    P.legs = { fa: 0.5, ba: -0.25, fk: 0.7, bk: 0.9 };
  } else if (pn.kind === 'ground') {
    P.fall = pulling ? 0.72 + 0.08 * rock : 1;
    P.fh = pulling ? [0.3, -0.6] : [0.12, -0.35];
    P.bh = pulling ? [0.24, -0.66] : [-0.15, -0.4];
    P.legs = alive ? { fa: 0.25, ba: -0.1, fk: 0.5 + 0.2 * rock, bk: 0.3 } : { fa: 0.1, ba: -0.05, fk: 0.05, bk: 0.05 };
  } else {
    P.lean = alive ? -0.1 + 0.05 * rock : -0.22;
    P.fh = alive ? [0.2, -0.58] : [0.06, -0.33];
    P.bh = alive ? [0.14, -0.62] : [-0.06, -0.34];
    P.legs = alive ? { fa: 0.15 + 0.1 * rock, ba: -0.12, fk: 0.2, bk: 0.15 } : { fa: 0.25, ba: 0.05, fk: 0.5, bk: 0.4 };
    P.crouch = alive ? 0 : 0.12;
  }
  if (a.dead) { g.save(); g.globalAlpha = 0.55 * Math.min(1, a.deathT / 0.6); g.fillStyle = '#4a0404'; g.beginPath(); g.ellipse(x + (pn.kind === 'ground' ? pn.dir[0] * s * 0.5 : 0), y + s * 0.02, s * 0.4, s * 0.1, 0, 0, TAU); g.fill(); g.restore(); }
  drawFigure(g, a, x + shake, y, s, P, a.dead && a.respawnT < 1 ? Math.max(0, a.respawnT) : 1);
  if (!alive) return null;
  if (p.state !== 'fly' && pn.t < pn.stun) drawStunStars(g, x, y - (pn.kind === 'ground' ? -s * 0.75 : 0), s * (pn.kind === 'ground' ? 0.7 : 1), a.time);
  if (pulling) {
    const prog = clamp((pn.t - pn.stun) / pn.pull, 0, 1);
    const bx = x, by = y - s * (pn.kind === 'ground' ? 0.75 : 1.25) - 24;
    g.save();
    g.fillStyle = 'rgba(10,6,2,0.85)'; g.fillRect(bx - 31, by - 1, 62, 8);
    g.fillStyle = '#e8d8b0'; g.fillRect(bx - 30, by, 60 * prog, 6);
    g.font = '600 10.5px Kanit, "Noto Sans Thai", sans-serif'; g.textAlign = 'center';
    g.lineWidth = 3; g.strokeStyle = 'rgba(10,6,2,0.9)'; g.strokeText('ดึงหอกออก', bx, by - 4); g.fillStyle = '#fff4d6'; g.fillText('ดึงหอกออก', bx, by - 4);
    g.restore();
  }
  return { x, y: y + (pn.kind === 'ground' ? s * 0.6 : 0), s };
}

// ================= skill 2 combo: skewer, wheel him overhead, hurl him back the way you came =================
const JAV_SPEED = 20;
function startLungeCombo(a, c, w, v) {
  c.stopped = true;
  c.combo = { v, t0: c.t, flung: false, dummy: !v.hero };
  c.dur = c.t + 0.66;
  if (v.hero) {
    v.grab = { by: a, t: 0, lift: 0.1, spin: 0 };
    v.act = null; v.kick = null; v.down = 0; v.stun = 0;
    if (v.delivery) { v.delivery.v.state = 'out'; v.delivery = null; }
    v.face = c.dir[0] > 0 ? -1 : 1;
    if (v.bot) v.bot.path = null;
  }
  addFx(w, { k: 'blood', x: v.x, y: v.y, z: 0.3, t: 0, dur: 0.35, dir: c.dir[0] >= 0 ? 1 : -1 });
}
function lungeCombo(a, c, w) {
  const cb = c.combo, v = cb.v, ct = c.t - cb.t0;
  const R = 0.44;
  // 0 - 0.1: skewered and held; 0.1 - 0.34: wheeled over the top; 0.34: slammed off the spear backwards
  const phi = ct < 0.1 ? 0 : Math.PI * ease(clamp((ct - 0.1) / 0.24, 0, 1));
  if (ct >= 0.1 && c.prev - cb.t0 < 0.1) sfxAt('whoosh', a.x, a.y, 1, 0.7);
  if (!cb.flung) {
    if (cb.dummy) { if (ct > 0.34) { cb.flung = true; v.wobV += -c.dir[0] * 9; v.hitT = 0; } return; }
    if (!v.grab || v.dead) { cb.flung = true; return; }
    v.x = a.x + c.dir[0] * Math.cos(phi) * R;
    v.y = a.y + c.dir[1] * Math.cos(phi) * R + 0.001;
    v.grab.lift = 0.1 + Math.sin(phi) * 1.15;
    v.grab.spin = phi;
    v.grab.t = 0;
    if (ct >= 0.34) {
      cb.flung = true;
      v.grab = null;
      v.x = a.x - c.dir[0] * 0.3; v.y = a.y - c.dir[1] * 0.3;
      if (!w.preview) resolve(w, v, 0.12);
      const res = damage(w, v, 60, a, 1.0);
      addFx(w, { k: 'impact', x: v.x, y: v.y, z: 0.5, t: 0, dur: 0.35 });
      addFx(w, { k: 'groundArc', x: a.x, y: a.y, t: 0, dur: 0.4, ang: Math.atan2(-c.dir[1], -c.dir[0]), r: 0.7 });
      sfxAt('wood', v.x, v.y, 1, 0.55);
      w.shake = Math.max(w.shake || 0, 0.22);
      w.hitStop = Math.max(w.hitStop || 0, 0.09);
      if (a.isPlayer) haptic([30, 20, 90]);
      if (v.isPlayer) haptic(120);
      if (res && !v.dead) launchBack(w, v, -c.dir[0], -c.dir[1], 2.4, 1.0, 1.0);
    }
  }
}
// thrown through the air: a long arc, a hard landing on his back, then the stars
const AXE_THROW_DMG = 100, LEAP_R = 1.0, LEAP_CORE = 0.36, LEAP_DMG = 100, CRIT_MUL = 1.5;
// things that aren't people, shaken by a blow to the ground
function shockObjects(w, x, y, R, power, src, dmg) {
  for (const tw of w.towers || []) if (!tw.dead && src && tw.team !== src.team && Math.hypot(tw.x - x, tw.y - y) < R + 0.3) damageTower(w, tw, dmg, src);
  for (const d of w.dummies || []) { const dd = Math.hypot(d.x - x, d.y - y); if (dd < R) { d.wobV = (d.wobV || 0) + (d.x >= x ? 1 : -1) * 9; d.hitT = 0; addFloater(w, d.x, d.y - 0.9, '-' + Math.round(dmg * (1 - 0.7 * dd / R)), '#fff2c8', 1); } }
  for (const b of w.bananas || []) if (!b.cut && Math.hypot(b.x - x, b.y - y) < R) hitBanana(w, b, x, power);
  for (const c of (w.palms || []).concat(w.mangoes || [])) if (Math.hypot(c.x - x, c.y - y) < R + 0.4) { if (c.bendV !== undefined && c.h) c.bendV += (c.x >= x ? 1 : -1) * 2.5; else c.rustleV = (c.rustleV || 0) + 10; }
  if (!w.preview) { hutBlow(w, x, y, R, power, x); floraBlow(w, x, y, R, power); }
}
function leapLand(a, c, w) {
  c.landed = true; c.landT = c.t;
  a.x = c.tx; a.y = c.ty; a.air = false;
  if (!w.preview) resolve(w, a, 0.12);
  c.dir = c.dir || [a.face, 0];
  const x = a.x, y = a.y, R = LEAP_R;
  // the ground gives way: cracks, a wall of dust, the shock ring
  addFx(w, { k: 'crack', x, y, t: 0, dur: 3.2, r: R, seed: Math.random() * 1e3 });
  addFx(w, { k: 'ring', x, y, t: 0, dur: 0.5, r: R * 1.1, col: '255,236,190' });
  addFx(w, { k: 'ring', x, y, t: 0, dur: 0.32, r: R * 0.55, col: '255,250,230' });
  addFx(w, { k: 'impact', x, y, z: 0.1, t: 0, dur: 0.4, seed: Math.random() * 1e3, big: true });
  dust(w, x, y, 22, 2.6);
  for (let i = 0; i < 10; i++) { const an = (i / 10) * TAU; dust(w, x + Math.cos(an) * R * 0.75, y + Math.sin(an) * R * 0.75, 2, 1.9); }
  sfxAt('wood', x, y, 1, 0.38);
  w.shake = Math.max(w.shake || 0, 0.42); w.hitStop = Math.max(w.hitStop || 0, 0.07);
  if (a.isPlayer) haptic([40, 20, 120]);
  // the seized man: the nearest in the small ring
  let G = null, gd = LEAP_CORE;
  const foes = [];
  for (const t of w.actors || []) {
    if (t === a || t.dead || t.team === a.team || t.pinned || t.grab) continue;
    if (t.act && ((t.act.k === 'leap' && !t.act.landed) || t.act.k === 'starJump')) continue;
    const d = Math.hypot(t.x - x, t.y - y);
    if (d > R + 0.06) continue;
    foes.push([t, d]);
    if (d <= gd) { gd = d; G = t; }
  }
  for (const [t, d] of foes) {
    const f = 1 - 0.7 * clamp(d / R, 0, 1); // 100 at the centre, 30% at the rim
    const crit = Math.random() < 0.3;
    const res = damage(w, t, LEAP_DMG * f * (crit ? CRIT_MUL : 1), a, 1.9, x, y);
    if (res && crit) addFloater(w, t.x, t.y - 1.3, 'คริติคอล!', '#ffe14a', 1.25);
    if (t.isPlayer) haptic(130);
    if (res !== true || t.dead) { if (t === G) G = null; continue; }
    if (t === G) continue;
    // out of the ring, wherever he stood, and 2 m more on his back
    const u = d > 0.04 ? [(t.x - x) / d, (t.y - y) / d] : [Math.cos(t.id * 2.4), Math.sin(t.id * 2.4)];
    launchBack(w, t, u[0], u[1], Math.max(0.15, R - d) + 0.1, 0.45, 0.55, 0.8);
  }
  shockObjects(w, x, y, R, 1.8, a, LEAP_DMG);
  if (G && G.hero) startAxeCombo(a, c, w, G);
  else c.dur = c.t + 0.26;
}
function startAxeCombo(a, c, w, v) {
  c.combo = { v, t0: c.t, slam: false, cut: false };
  c.dur = c.t + 1.3;
  if (Math.hypot(v.x - a.x, v.y - a.y) > 0.05) c.dir = unit2(v.x - a.x, v.y - a.y);
  if (Math.abs(c.dir[0]) > 0.05) a.face = c.dir[0] > 0 ? 1 : -1;
  v.grab = { by: a, t: 0, k: 'axe', lift: 0.05, fall: 0, spin: 0 };
  v.act = null; v.kick = null; v.down = 0; v.stun = 0;
  if (v.delivery) { v.delivery.v.state = 'out'; v.delivery = null; }
  v.face = c.dir[0] > 0 ? -1 : 1;
  if (v.bot) v.bot.path = null;
  addFloater(w, v.x, v.y - 1.15, 'จับได้!', '#ffd08a', 1.2);
}
// 0-0.16 hauled up · 0.16-0.3 smashed face down · 0.3 the ground · 0.5-0.95 thrown up, the world slowing ·
// 0.95 both axes through him: 3 m away on his back, half the blow again
function axeCombo(a, c, w) {
  const cb = c.combo, v = cb.v, ct = c.t - cb.t0;
  if (cb.cut) return;
  if (!v.grab || v.grab.by !== a || v.dead) { cb.cut = true; c.dur = Math.min(c.dur, c.t + 0.15); return; }
  const gb = v.grab;
  gb.t = 0;
  v.x = a.x + c.dir[0] * 0.36; v.y = a.y + c.dir[1] * 0.36 + 0.001;
  if (ct < 0.16) { const u = ease(ct / 0.16); gb.lift = 0.05 + 0.6 * u; gb.fall = -0.35 * u; gb.spin = 0; }
  else if (ct < 0.3) { const u = (ct - 0.16) / 0.14; gb.lift = 0.65 * (1 - u * u); gb.fall = -0.35 - 0.65 * u; }
  else if (ct < 0.5) { gb.lift = 0; gb.fall = -1; }
  else { const u = clamp((ct - 0.5) / 0.45, 0, 1); gb.lift = 1.55 * Math.sin(u * Math.PI * 0.62); gb.fall = -1; gb.spin = -u * Math.PI * 1.5; }
  if (!cb.slam && ct >= 0.3) {
    cb.slam = true;
    addFx(w, { k: 'crack', x: v.x, y: v.y, t: 0, dur: 2.6, r: 0.5, seed: Math.random() * 1e3 });
    addFx(w, { k: 'impact', x: v.x, y: v.y, z: 0.05, t: 0, dur: 0.35, seed: Math.random() * 1e3, big: true });
    addFx(w, { k: 'ring', x: v.x, y: v.y, t: 0, dur: 0.4, r: 0.6, col: '255,236,190' });
    dust(w, v.x, v.y, 14, 2.2);
    addFloater(w, v.x, v.y - 0.8, 'ทุบ!', '#ffb070', 1.3);
    sfxAt('wood', v.x, v.y, 1, 0.45);
    w.shake = Math.max(w.shake || 0, 0.35); w.hitStop = Math.max(w.hitStop || 0, 0.09);
    if (a.isPlayer) haptic([30, 20, 100]);
    if (v.isPlayer) haptic(150);
  }
  // he hangs in the air and the world slows (when it's you doing it, or you it's done to)
  if (ct > 0.6 && ct < 0.84 && (a.isPlayer || v.isPlayer)) w.slowT = 0.06; // (it lets go as the axes start their swing: the blow lands at full speed)
  if (ct >= 0.5 && c.prev - cb.t0 < 0.5) sfxAt('whoosh', a.x, a.y, 1, 0.6);
  if (ct >= 0.95) {
    cb.cut = true;
    v.grab = null;
    const lift = gb.lift;
    const res = damage(w, v, LEAP_DMG * 0.5, a, 1.9);
    const d = c.dir, z = 0.3 + lift * 0.3;
    // the blow: a burst where the axes meet him, rings of air thrown down the line he leaves by, the ground flayed
    addFx(w, { k: 'impact', x: v.x, y: v.y, z, t: 0, dur: 0.45, seed: Math.random() * 1e3, big: true });
    addFx(w, { k: 'impact', x: v.x + d[0] * 0.12, y: v.y + d[1] * 0.12, z: z + 0.1, t: 0, dur: 0.3, seed: Math.random() * 1e3, big: true });
    for (let i = 0; i < 3; i++) addFx(w, { k: 'airRing', x: v.x + d[0] * (0.1 + i * 0.3), y: v.y + d[1] * (0.1 + i * 0.3), z: z * (1 - i * 0.25), t: 0, dur: 0.3 + i * 0.1, dx: d[0], dy: d[1], big: i === 0 });
    addFx(w, { k: 'blood', x: v.x, y: v.y, z, t: 0, dur: 0.4, dir: d[0] >= 0 ? 1 : -1 });
    addFx(w, { k: 'spark', x: v.x, y: v.y, z, t: 0, dur: 0.3, seed: Math.random() * 1e3 });
    addFx(w, { k: 'groundArc', x: a.x, y: a.y, t: 0, dur: 0.45, ang: Math.atan2(d[1], d[0]), r: 0.85 });
    addFx(w, { k: 'ring', x: a.x, y: a.y, t: 0, dur: 0.4, r: 0.7, col: '255,240,200' });
    for (let i = 1; i <= 5; i++) dust(w, a.x + d[0] * i * 0.22, a.y + d[1] * i * 0.22, 3, 1.8);
    addFloater(w, v.x, v.y - 1.35 - lift * 0.3, 'ฟาด!', '#ffe14a', 1.35);
    sfxAt('wood', v.x, v.y, 1, 0.6); sfxAt('whoosh', a.x, a.y, 1, 1.4);
    w.shake = Math.max(w.shake || 0, 0.45); w.hitStop = Math.max(w.hitStop || 0, 0.1);
    // and the world slows again to watch him go
    if (a.isPlayer || v.isPlayer) w.slowT = 0.55;
    if (a.isPlayer) haptic([30, 20, 130]);
    if (v.isPlayer) haptic(160);
    if (!v.dead) tumbleAway(w, v, d[0], d[1], lift);
  }
}
// cut out of the air: a flat, fast 3 m, then three bounces along the ground, turning over all the way, and a skid
function tumbleAway(w, t, dx, dy, z0, stunAfter = 0.7) {
  if (t.dead || t.pinned) return;
  const hops = [{ d: 1.2, dur: 0.34, h: 0.2 }, { d: 0.46, dur: 0.3, h: 0.5 }, { d: 0.3, dur: 0.24, h: 0.32 }, { d: 0.18, dur: 0.18, h: 0.17 }];
  const total = hops.reduce((n, h) => n + h.dur, 0), sd = 0.3;
  t.act = null; t.stun = 0; t.grab = null;
  t.down = total + sd + stunAfter; t.downDur = t.down; t.downHit = false; t.downAir = total;
  t.face = dx > 0 ? -1 : 1;
  t.kick = { dx, dy, d: hops[0].d, t: 0, dur: hops[0].dur, air: hops[0].h, z0, hops: hops.slice(1), skid: 0.16, sd, tumble: true, turn0: 0, turns: 1 };
  if (t.bot) t.bot.path = null;
  addFloater(w, t.x, t.y - 1.1, 'กระเด็น!', '#ffb070', 1.25);
}
// axes thrown and lying: walk over one to take it back
function myAxes(w, a) { return w.proj.filter((p) => p.owner === a && p.k === 'axe' && !p.dead); }
function lostWeapon(w, a) {
  if (a.hero.weapon !== 'axe') return myJavelin(w, a);
  let best = null, bd = 1e9;
  for (const p of myAxes(w, a)) { if (p.hidden) continue; const d = Math.hypot(p.x - a.x, p.y - a.y); if (d < bd) { bd = d; best = p; } }
  return best;
}
function axeUpkeep(a, w) {
  if (!a.axeOut) return;
  const mine = myAxes(w, a);
  if (!mine.length) { a.axeOut = 0; return; }
  if (mine.length < a.axeOut) a.axeOut = mine.length;
  for (const p of mine) {
    if (p.state === 'fly' || p.state === 'bounce' || p.hidden) continue;
    const near = Math.hypot(a.x - p.x, a.y - p.y) < 0.5 && !a.air && !a.dead;
    // (the menu's demo, and an axe no one could reach: it comes back by itself)
    const home = w.preview ? p.t > 1.1 : p.t > 25;
    if (!near && !home) continue;
    p.dead = true;
    a.axeOut = Math.max(0, a.axeOut - 1);
    a.cdsAlt = null;
    addFx(w, { k: 'ring', x: a.x, y: a.y, t: 0, dur: 0.45, r: 0.5, col: '242,210,122' });
    addFx(w, { k: 'puff', x: a.x, y: a.y, z: 0.3, t: 0, dur: 0.4 });
    if (!w.preview) addFloater(w, a.x, a.y - 0.95, a.axeOut ? 'เก็บขวานแล้ว! (เหลืออีก 1)' : 'เก็บขวานแล้ว!', '#f2d27a', 1);
    sfxAt('wood', a.x, a.y, 0.6, 1.3);
    if (a.isPlayer) haptic(30);
  }
}
function launchBack(w, t, dx, dy, dist, h, stunAfter, skid = 0.4) {
  if (t.dead || t.pinned) return;
  const fl = 0.3 + dist * 0.12, sd = 0.32 + skid * 0.3;
  t.act = null; t.stun = 0; t.grab = null;
  t.down = fl + sd + stunAfter; t.downDur = t.down; t.downHit = false; t.downAir = fl;
  t.face = dx > 0 ? -1 : 1;
  t.kick = { dx, dy, d: dist, t: 0, dur: fl, air: h, skid, sd };
  if (t.bot) t.bot.path = null;
  addFloater(w, t.x, t.y - 1.1, 'กระเด็น!', '#ffb070', 1.15);
}
// the spear's swing, smeared across the air behind its tip
function drawSpearTrail(g, a, x, y, s, P) {
  const c = a.act;
  const live = c && P.spear && !a.spearOut && (c.k === 'sweep' || (c.k === 'lungeThrust' && c.combo && c.t - c.combo.t0 > 0.06));
  const H = a.trail || (a.trail = []);
  if (live && (!H.length || H[H.length - 1].t !== a.time)) H.push({ t: a.time, ang: P.spear.a, g: P.spear.g.slice(), lean: P.lean || 0, cr: P.crouch || 0, face: a.face });
  const life = 0.15;
  while (H.length && a.time - H[0].t > life) H.shift();
  if (H.length < 2) return;
  const pt = (m, r) => {
    let lx = m.g[0] + Math.cos(m.ang) * r, ly = m.g[1] + Math.sin(m.ang) * r;
    lx *= 1 + 0.08 * m.cr; ly *= 1 - 0.28 * m.cr;
    const cs = Math.cos(m.lean), sn = Math.sin(m.lean);
    const rx = lx * cs - ly * sn, ry = lx * sn + ly * cs;
    return [x + rx * m.face * s, y + ry * s];
  };
  const S = [];
  for (let i = 1; i < H.length; i++) {
    const A = H[i - 1], B = H[i];
    for (let j = 0; j < 5; j++) {
      const f = j / 5;
      S.push({ t: lerp(A.t, B.t, f), ang: lerp(A.ang, B.ang, f), g: [lerp(A.g[0], B.g[0], f), lerp(A.g[1], B.g[1], f)], lean: lerp(A.lean, B.lean, f), cr: lerp(A.cr, B.cr, f), face: B.face });
    }
  }
  S.push(H[H.length - 1]);
  const L = 1.75;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 1; i < S.length; i++) {
    const A = S[i - 1], B = S[i];
    const al = Math.pow(clamp(1 - (a.time - B.t) / life, 0, 1), 1.4);
    if (al <= 0.01) continue;
    const quad = (r0, r1, col) => {
      const p0 = pt(A, r0), p1 = pt(A, r1), p2 = pt(B, r1), p3 = pt(B, r0);
      g.fillStyle = col;
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.lineTo(p3[0], p3[1]); g.closePath(); g.fill();
    };
    quad(L * 0.18, L * 0.68, `rgba(255,236,190,${0.16 * al})`);
    quad(L * 0.46, L * 0.68, `rgba(255,226,150,${0.28 * al})`);
    quad(L * 0.6, L * 0.69, `rgba(255,255,240,${0.6 * al})`);
  }
  g.restore();
  // a crisp leading edge where the blade cuts the air
  g.save();
  g.lineCap = 'round';
  for (let i = 1; i < S.length; i++) {
    const A = S[i - 1], B = S[i];
    const al = Math.pow(clamp(1 - (a.time - B.t) / life, 0, 1), 1.4);
    if (al <= 0.01) continue;
    const p0 = pt(A, L * 0.685), p1 = pt(B, L * 0.685);
    g.strokeStyle = `rgba(255,252,236,${0.9 * al})`;
    g.lineWidth = Math.max(1.2, s * 0.035 * al);
    g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
  }
  g.restore();
}


// the spear point of the rush: whoever it meets first is run through
function lungeHit(a, c, w) {
  const tx = a.x + c.dir[0] * 0.48, ty = a.y + c.dir[1] * 0.48;
  for (const t of w.actors || []) {
    if (t === a || t.dead || t.team === a.team || c.hits.has(t) || t.pinned || t.grab) continue;
    if (Math.hypot(t.x - tx, t.y - ty) > 0.36) continue;
    if (t.act && ((t.act.k === 'leap' && t.act.t / t.act.dur < 0.85) || t.act.k === 'starJump')) continue;
    c.hits.add(t);
    const res = damage(w, t, 150, a, 1.0);
    if (!res) continue; // slipped it: keep running
    if (res === 'block') { c.stopped = true; c.dur = c.t + 0.15; return true; }
    addFx(w, { k: 'impact', x: t.x, y: t.y, z: 0.3, t: 0, dur: 0.3 });
    sfxAt('wood', t.x, t.y, 1, 0.7);
    w.shake = Math.max(w.shake || 0, 0.16);
    w.hitStop = Math.max(w.hitStop || 0, 0.08);
    if (a.isPlayer) haptic([25, 15, 50]);
    if (t.dead) { c.stopped = true; c.dur = c.t + 0.2; return true; }
    startLungeCombo(a, c, w, t);
    return true;
  }
  for (const dm of w.dummies) {
    if (c.hits.has(dm) || Math.hypot(dm.x - tx, dm.y - ty) > 0.26) continue;
    c.hits.add(dm);
    hitArea(a, null, w, dm.x, dm.y, 0.05, 150, 1.3);
    startLungeCombo(a, c, w, dm);
    return true;
  }
  hitArea(a, c, w, tx, ty, 0.2, 150, 1.0); // banana stems and the like: cut straight through
  return false;
}

// ================= archer skill 3: lock-on =================
// who the volley's fan touches: the enemy nearest its centre line (a training dummy if no one else)
const VOLLEY_DMG = 40, VOLLEY_PUSH = 0.48, VOLLEY_PACK = 2.4, VOLLEY_GAP = 0.045; // 1.2 m a hit; the pack: within 6 m of the marked minion; arrows 3x as close together
// locked on a minion: the volley rains on the pack: up to four of them (any hero standing among them too),
// four arrows each, at half strength. Locked on a hero: him alone
function volleyPack(a, w, L) {
  if (!L || !L.creep) return L ? [L] : [];
  const near = (w.actors || []).filter((t) => t !== L && !t.dead && t.team !== a.team && !t.pinned && !t.grab && Math.hypot(t.x - L.x, t.y - L.y) <= VOLLEY_PACK)
    .sort((p, q) => Math.hypot(p.x - L.x, p.y - L.y) - Math.hypot(q.x - L.x, q.y - L.y));
  return [L, ...near.slice(0, 3)];
}
function volleyTarget(a, w, dir, range) {
  const ang = Math.atan2(dir[1], dir[0]);
  let best = null, bs = 1e9;
  const test = (t, prio) => {
    const d = Math.hypot(t.x - a.x, t.y - a.y);
    if (d > range + 0.2 || d < 0.05) return;
    let da = Math.abs(Math.atan2(t.y - a.y, t.x - a.x) - ang);
    if (da > Math.PI) da = TAU - da;
    if (da > 0.24 + Math.asin(Math.min(1, 0.2 / d))) return;
    const sc = da * 3 + d * 0.1 + prio;
    if (sc < bs) { bs = sc; best = t; }
  };
  for (const t of w.actors || []) if (!t.dead && t.team !== a.team && !t.pinned) test(t, t.creep ? 0.12 : 0); // a hero in the fan beside a minion: the hero
  for (const d of w.dummies || []) test(d, 100);
  return best;
}
function steerHoming(p, dt) {
  const T = p.homing;
  if (!T || T.dead) { p.homing = null; return; }
  const dx = T.x - p.x, dy = T.y - p.y, d = Math.hypot(dx, dy);
  const ang = Math.atan2(p.dy, p.dx), want = Math.atan2(dy, dx);
  let da = want - ang;
  while (da > Math.PI) da -= TAU;
  while (da < -Math.PI) da += TAU;
  // turns harder the closer it gets, so it can't circle round him
  const turn = d < 0.5 ? 1e3 : (9 + 30 * clamp(1 - d / 2, 0, 1)) * dt;
  const na = ang + clamp(da, -turn, turn);
  p.dx = Math.cos(na); p.dy = Math.sin(na);
  p.range = Math.min(12, Math.max(p.range, p.went + d + 0.4));
}

// keep a resting spear on the field and its pick-up spot on ground someone can walk to
function settleSpear(w, p) {
  if (w.preview) return;
  p.x = clamp(p.x, 0.35, w.W - 0.35); p.y = clamp(p.y, 0.4, w.H - 0.35);
  let gx = clamp(p.gx != null ? p.gx : p.x, 0.35, w.W - 0.35), gy = clamp(p.gy != null ? p.gy : p.y, 0.4, w.H - 0.35);
  if (typeof navOk === 'function' && !navOk(gx, gy)) { const q = navNearest(gx, gy); gx = q.x; gy = q.y; }
  p.gx = gx; p.gy = gy;
}
// spear skill 1: the swing bats away anything flying at him from the front
function parryProjectiles(a, c, w) {
  const ang = Math.atan2(c.dir[1], c.dir[0]);
  for (const p of w.proj) {
    if (p.state !== 'fly' || p.team === a.team || p.parried) continue;
    const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
    if (d > 1.1) continue;
    let da = Math.abs(Math.atan2(dy, dx) - ang);
    if (da > Math.PI) da = TAU - da;
    if (da > 1.5 && d > 0.3) continue;
    if (p.dx * dx + p.dy * dy > 0 && d > 0.3) continue; // already past him, flying away
    p.parried = true;
    if (p.victim) continue;
    p.homing = null;
    const out = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.9;
    p.state = 'bounce'; p.t = 0; p.bdx = Math.cos(out); p.bdy = Math.sin(out); p.bz = p.z;
    addFx(w, { k: 'impact', x: p.x, y: p.y, z: p.z, t: 0, dur: 0.28 });
    addFx(w, { k: 'spark', x: p.x, y: p.y, z: p.z, t: 0, dur: 0.3, seed: Math.random() * 1e3, big: true });
    addFloater(w, p.x, p.y - 0.6, 'ปัด!', '#f2d27a', 0.95);
    sfxAt('wood', p.x, p.y, 0.8, 1.25);
    if (a.isPlayer) haptic(25);
  }
}
// shield skill 2: whoever the shield meets first
function bashHit(a, c, w) {
  const tx = a.x + c.dir[0] * 0.3, ty = a.y + c.dir[1] * 0.3;
  for (const t of w.actors || []) {
    if (t === a || t.dead || t.team === a.team || c.hits.has(t) || t.pinned || t.grab) continue;
    if (Math.hypot(t.x - tx, t.y - ty) > 0.36) continue;
    if (t.act && ((t.act.k === 'leap' && t.act.t / t.act.dur < 0.85) || t.act.k === 'starJump')) continue;
    c.hits.add(t);
    const res = damage(w, t, 70, a, 1.0);
    if (!res) continue;
    c.hit = true; c.dur = c.t + 0.25;
    addFx(w, { k: 'impact', x: tx, y: ty, z: 0.3, t: 0, dur: 0.3 });
    addFx(w, { k: 'ring', x: tx, y: ty, t: 0, dur: 0.35, r: 0.5, col: '242,210,122' });
    sfxAt('wood', tx, ty, 1, 0.6);
    w.shake = Math.max(w.shake || 0, 0.18);
    w.hitStop = Math.max(w.hitStop || 0, 0.07);
    if (a.isPlayer) haptic([25, 15, 60]);
    if (res === true && !t.dead) { launchBack(w, t, c.dir[0], c.dir[1], 0.8, 0.85, 2.0, 0.8); if (t.isPlayer) haptic(100); }
    return;
  }
  for (const d of w.dummies) {
    if (c.hits.has(d) || Math.hypot(d.x - tx, d.y - ty) > 0.3) continue;
    c.hits.add(d);
    hitArea(a, null, w, d.x, d.y, 0.05, 70, 2);
    d.wobV += c.dir[0] * 12;
    c.hit = true; c.dur = c.t + 0.25;
    addFx(w, { k: 'impact', x: tx, y: ty, z: 0.3, t: 0, dur: 0.3 });
    sfxAt('wood', tx, ty, 1, 0.6);
    return;
  }
}

// ================= the archer's hand-drawn shot =================
const ARROW_DMG = 23;
const ARROW_RANGE = 2.8; // the archer's ordinary shot: 7 m
// what the drawn bow turns to: the nearest enemy in reach, else the nearest thing worth an arrow (a dummy, a hut, a tree)
function drawTarget(a, w, reach = ARROW_RANGE) {
  let best = null, bd = reach + 0.35;
  for (const t of w.actors || []) { if (t.dead || t.team === a.team) continue; const d = Math.hypot(t.x - a.x, t.y - a.y); if (d < bd) { bd = d; best = { x: t.x, y: t.y, foe: t }; } }
  if (best) return best;
  for (const t of w.towers || []) { if (t.dead || t.team === a.team) continue; const d = Math.hypot(t.x - a.x, t.y - a.y); if (d < bd) { bd = d; best = { x: t.x, y: t.y, o: t }; } }
  if (best) return best;
  bd = reach;
  const consider = (x, y, o) => { const d = Math.hypot(x - a.x, y - a.y); if (d < bd && d > 0.25) { bd = d; best = { x, y, o }; } };
  for (const d of w.dummies) consider(d.x, d.y, d);
  for (const h of w.huts) if (!h.collapsed) consider(h.x, h.y - 0.22, h);
  for (const p of w.palms) consider(p.x, p.y, p);
  for (const m of w.mangoes) consider(m.x, m.y, m);
  for (const b of w.bananas) if (!b.cut) consider(b.x, b.y, b);
  for (const j of w.jars) if (j.state === 'up') consider(j.x, j.y, j);
  return best;
}
function drawDir(a, w) {
  const T = drawTarget(a, w);
  if (!T) return a.moving ? a.lastDir.slice() : [a.face, 0];
  let tx = T.x, ty = T.y;
  if (T.foe && T.foe.svx !== undefined) { const lead = Math.hypot(tx - a.x, ty - a.y) / 12; tx += (T.foe.svx || 0) * lead; ty += (T.foe.svy || 0) * lead; }
  return unit2(tx - a.x, ty - a.y);
}
const BOW_FULL = 0.3, BOW_FULL_DMG = ARROW_DMG * 2; // a full draw: the old full arrow (the halving was for the free-fire bow)
const bowCharge = (a) => clamp((a.drawT || 0) / (BOW_FULL / asMul(a)), 0, 1);
function looseArrow(a, w) {
  if (a.dead || a.stun > 0 || a.down > 0 || a.pinned || a.grab) return false;
  if (a.act && a.act.k !== 'loose' && ACTS[a.act.k].lock) return false;
  const d = a.drawDir || drawDir(a, w);
  if (Math.abs(d[0]) > 0.05) a.face = d[0] > 0 ? 1 : -1;
  a.act = { k: 'loose', t: 0, prev: 0, dur: ACTS.loose.dur, dir: d, dist: 0, hits: new Set() };
  // a snatched shot does 10%; held to full draw, the whole of it. It curls in on the man it was drawn at
  const f = bowCharge(a), T = drawTarget(a, w);
  const foe = T && T.hero && !T.dead && T.team !== a.team ? T : null;
  spawnProj(a, w, 'arrow', d, ARROW_RANGE + (foe ? 0.6 : 0), 12, BOW_FULL_DMG * (0.1 + 0.9 * f), foe ? { homing: foe } : {});
  a.drawT = 0;
  if (f >= 1) addFx(w, { k: 'airRing', x: a.x + d[0] * 0.3, y: a.y + d[1] * 0.3, z: 0.42, t: 0, dur: 0.22, dx: d[0], dy: d[1] });
  sfxAt('whoosh', a.x, a.y, 0.3, 2.4);
  return true;
}

// flames licking up a burning man
function drawBurning(g, a, x, y, s) {
  const t = a.time, fade = clamp(a.burn.t / 0.5, 0, 1);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.85 * fade;
  for (let i = 0; i < 5; i++) {
    const ox = (i - 2) * s * 0.07 + Math.sin(t * 7 + i * 2) * s * 0.02, oy = -s * (0.25 + (i % 3) * 0.17);
    const h = s * (0.16 + 0.07 * Math.sin(t * 13 + i * 1.7)), wd = s * 0.05;
    drawFlame(g, x + ox, y + oy, wd, h, t * 11 + i);
  }
  g.restore();
}
function drawFlame(g, x, y, wd, h, ph) {
  const lean = Math.sin(ph) * wd * 0.4;
  for (const [k, col] of [[1, 'rgba(255,96,24,0.75)'], [0.62, 'rgba(255,190,60,0.9)'], [0.3, 'rgba(255,250,200,0.95)']]) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x - wd * k, y);
    g.quadraticCurveTo(x - wd * k, y - h * k * 0.6, x + lean * k, y - h * k);
    g.quadraticCurveTo(x + wd * k, y - h * k * 0.6, x + wd * k, y);
    g.quadraticCurveTo(x, y + wd * k * 0.6, x - wd * k, y);
    g.fill();
  }
}

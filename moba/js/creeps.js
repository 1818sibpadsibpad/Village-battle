'use strict';
// ===== สมุน: the lane minions. Waves of three per lane per side, walking the lane in single file,
// cutting down whatever enemy gets in the way: other minions first, then heroes, then towers =====
const WAVE_FIRST = 11, WAVE_EVERY = 35, WAVE_N = 3, WAVE_GAP = 1.5;
const CREEP_AGGRO = 2.2, CREEP_LEASH = 3.2, CREEP_DMG = 22;

function resetCreeps(w) {
  w.waveT = WAVE_FIRST; w.wave = 0; w.creepQ = [];
}
function laneFor(w, team, i) { return team === 'red' ? w.lanes[i] : w.lanes[i].slice().reverse(); }
function spawnWave(w) {
  w.wave++;
  for (const team of ['red', 'blue']) for (let li = 0; li < w.lanes.length; li++) for (let k = 0; k < WAVE_N; k++) w.creepQ.push({ t: k * WAVE_GAP, team, li });
  if (w.feed) addFloater(w, w.spawns.red.x, w.spawns.red.y - 1.2, 'สมุนเวฟ ' + w.wave, '#f2d27a', 1.05), addFloater(w, w.spawns.blue.x, w.spawns.blue.y - 1.2, 'สมุนเวฟ ' + w.wave, '#f2d27a', 1.05);
}
function makeCreep(w, team, li) {
  const P = laneFor(w, team, li);
  const a = makeActor('creep', team, P[0].x + (Math.random() - 0.5) * 0.05, P[0].y + (Math.random() - 0.5) * 0.05);
  a.maxHp *= 2; a.hp = a.maxHp; // twice a hero's life
  a.creep = { P, idx: 1, target: null, think: 0, tol: 0.05, path: null, pathGoal: null, pathT: 0 };
  a.face = P[1].x >= P[0].x ? 1 : -1;
  a.spawnShield = 0.4;
  addFx(w, { k: 'ring', x: a.x, y: a.y, t: 0, dur: 0.4, r: 0.35, col: team === 'red' ? '255,120,100' : '120,170,255' });
  return a;
}
function tickCreeps(w, dt) {
  if (w.waveT == null) resetCreeps(w);
  w.waveT -= dt;
  if (w.waveT <= 0) { w.waveT += WAVE_EVERY; spawnWave(w); }
  for (const q of w.creepQ) q.t -= dt;
  while (w.creepQ.length && w.creepQ[0].t <= 0) { const q = w.creepQ.shift(); w.actors.push(makeCreep(w, q.team, q.li)); }
  // keep the queue in time order (sides and lanes interleave)
  w.creepQ.sort((a, b) => a.t - b.t);
  for (let i = w.actors.length - 1; i >= 0; i--) if (w.actors[i].gone) w.actors.splice(i, 1);
}
// who to fight: the nearest enemy minion, else the nearest enemy hero, else a tower
function creepTarget(a, w) {
  let best = null, bs = 1e9;
  for (const e of w.actors) {
    if (e.dead || e.team === a.team || e.grab || e.pinned) continue;
    const d = Math.hypot(e.x - a.x, e.y - a.y);
    if (d > CREEP_AGGRO) continue;
    const s = d + (e.creep ? 0 : 1.2);
    if (s < bs) { bs = s; best = e; }
  }
  if (best) return best;
  for (const t of w.towers || []) {
    if (t.dead || t.team === a.team) continue;
    const d = Math.hypot(t.x - a.x, t.y - a.y);
    if (d < CREEP_AGGRO + 0.4 && d < bs) { bs = d; best = t; }
  }
  return best;
}
// walks the lane, stops to fight; returns the move vector for updateActor
function creepThink(a, w, dt) {
  const C = a.creep;
  if (a.dead || a.stun > 0 || a.down > 0 || a.pinned || a.grab) return [0, 0];
  C.think -= dt;
  // the lane point he's walking toward; skip ahead past any he's already level with
  while (C.idx < C.P.length - 1 && Math.hypot(C.P[C.idx].x - a.x, C.P[C.idx].y - a.y) < 0.45) C.idx++;
  const wp = C.P[C.idx];
  if (C.think <= 0) {
    C.think = 0.2 + Math.random() * 0.08;
    const T = C.target;
    const atEnd = C.idx >= C.P.length - 1;
    const keep = T && !T.dead && !(T.team === a.team) && Math.hypot(T.x - a.x, T.y - a.y) < CREEP_AGGRO + 0.6 + (atEnd && T.isTower ? 9 : 0) && Math.hypot(wp.x - a.x, wp.y - a.y) < CREEP_LEASH + (atEnd ? 3 : 0);
    if (!keep) C.target = creepTarget(a, w);
    // a minion would rather fight a minion that comes into reach than keep chasing a hero
    else if (!T.creep) { const n = creepTarget(a, w); if (n && n.creep) C.target = n; }
  }
  const T = C.target;
  if (T) {
    const isTower = !!T.isTower;
    const reach = isTower ? 0.72 : 0.38; // near enough for the blade's tip
    const d = Math.hypot(T.x - a.x, T.y - a.y);
    if (d <= reach) {
      if (Math.abs(T.x - a.x) > 0.03) a.face = T.x > a.x ? 1 : -1;
      if (!a.act && skillReady(a, 0)) cast(a, w, 0, unit(T.x - a.x, T.y - a.y));
      return spread(a, w, [0, 0]);
    }
    if (isTower) { const u = unit(a.x - T.x, a.y - T.y); return spread(a, w, steerTo(a, T.x + u[0] * 0.6, T.y + u[1] * 0.6, dt)); }
    return spread(a, w, steerTo(a, T.x, T.y, dt));
  }
  // the end of the lane: their camp. Whatever towers still stand there come down
  if (C.idx >= C.P.length - 1 && Math.hypot(wp.x - a.x, wp.y - a.y) < 1.2) {
    let best = null, bd = 9;
    for (const t of w.towers || []) { if (t.dead || t.team === a.team) continue; const d = Math.hypot(t.x - a.x, t.y - a.y); if (d < bd) { bd = d; best = t; } }
    if (best) { C.target = best; const u = unit(a.x - best.x, a.y - best.y); return spread(a, w, steerTo(a, best.x + u[0] * 0.6, best.y + u[1] * 0.6, dt)); }
  }
  // nothing in sight: down the lane, in line
  let mv = steerTo(a, wp.x, wp.y, dt);
  // hold back a step behind the man ahead in the file
  for (const o of w.actors) {
    if (o === a || o.dead || !o.creep || o.team !== a.team || o.creep.P !== C.P) continue;
    const dx = o.x - a.x, dy = o.y - a.y, d = Math.hypot(dx, dy);
    if (d < 0.5 && dx * mv[0] + dy * mv[1] > 0 && o.creep.idx >= C.idx && (o.moving === false || d < 0.32)) { mv = [mv[0] * 0.3, mv[1] * 0.3]; break; }
  }
  return spread(a, w, mv);
}
function spread(a, w, mv) {
  mv = mv.slice();
  for (const o of w.actors) {
    if (o === a || o.dead || o.team !== a.team || !o.creep) continue;
    const dx = a.x - o.x, dy = a.y - o.y, d = Math.hypot(dx, dy);
    if (d < 0.3 && d > 1e-3) { mv[0] += (dx / d) * (0.3 - d) * 2.5; mv[1] += (dy / d) * (0.3 - d) * 2.5; }
  }
  const L = Math.hypot(mv[0], mv[1]);
  return L > 1 ? [mv[0] / L, mv[1] / L] : mv;
}
// the little HP bar over a minion's head
function drawCreepBar(g, a, x, top) {
  const w = 34, h = 4, y = top - 6;
  const frac = clamp(a.hp / a.maxHp, 0, 1);
  g.save();
  g.fillStyle = 'rgba(10,6,2,0.8)'; g.fillRect(x - w / 2 - 1.5, y - 1.5, w + 3, h + 3);
  g.fillStyle = TEAM[a.team].main; g.fillRect(x - w / 2, y, w * frac, h);
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x - w / 2, y, w * frac, 1);
  g.restore();
}

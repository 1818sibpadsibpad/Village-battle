'use strict';
// ===== bots: a navigation grid, prediction and tactics =====
// Every bot re-thinks ~15 times a second: it reads incoming arrows / spears / axes and enemy wind-ups and
// side-steps or uses an evasive skill, picks the target worth killing (low HP, already focused by allies,
// stunned, squishy), spaces itself just outside the enemy's reach while its own attack recharges,
// circles toward the enemy's back, leads its shots by the target's velocity, checks the line of fire is
// clear of trunks and huts, kites when it is a ranged hero, retreats to heal at base when losing and
// comes back to finish low targets.

const NAV = { cs: 0.25, cols: 0, rows: 0, grid: null };
let navG, navCame, navClosed, navHeap, navF;
function buildNav(w) {
  NAV.cols = Math.ceil(w.W / NAV.cs);
  NAV.rows = Math.ceil(w.H / NAV.cs);
  const N = NAV.cols * NAV.rows;
  NAV.grid = new Uint8Array(N);
  for (let r = 0; r < NAV.rows; r++) for (let c = 0; c < NAV.cols; c++) {
    const x = (c + 0.5) * NAV.cs, y = (r + 0.5) * NAV.cs;
    let ok = x > 0.3 && y > 0.35 && x < w.W - 0.3 && y < w.H - 0.3 && landDepth(w, x, y) > 0.25 && !pondAt(w, x, y, 0.14) && !hutAt(w, x, y, 0.14) && !wallAt(w, x, y, 0.14);
    if (ok) for (const s of w.solids) if (Math.hypot(s.x - x, s.y - y) < s.r + 0.13) { ok = false; break; }
    NAV.grid[r * NAV.cols + c] = ok ? 1 : 0;
  }
  navG = new Float32Array(N); navCame = new Int32Array(N); navClosed = new Uint8Array(N); navHeap = new Int32Array(N * 8); navF = new Float32Array(N);
}
function navOk(x, y) {
  const c = Math.floor(x / NAV.cs), r = Math.floor(y / NAV.cs);
  if (c < 0 || r < 0 || c >= NAV.cols || r >= NAV.rows) return false;
  return NAV.grid[r * NAV.cols + c] === 1;
}
function navLine(x0, y0, x1, y1, step = 0.12) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / step));
  for (let i = 1; i <= n; i++) { const t = i / n; if (!navOk(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
  return true;
}
function navNearest(x, y) {
  if (navOk(x, y)) return { x, y };
  for (let r = 0.25; r < 3; r += 0.25) for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (navOk(px, py)) return { x: px, y: py }; }
  return { x, y };
}
function findPath(x0, y0, x1, y1) {
  const { cols, rows, cs, grid } = NAV;
  const s = navNearest(x0, y0), e = navNearest(x1, y1);
  const sc = clamp(Math.floor(s.x / cs), 0, cols - 1), sr = clamp(Math.floor(s.y / cs), 0, rows - 1);
  const ec = clamp(Math.floor(e.x / cs), 0, cols - 1), er = clamp(Math.floor(e.y / cs), 0, rows - 1);
  const si = sr * cols + sc, ei = er * cols + ec;
  navG.fill(1e9); navCame.fill(-1); navClosed.fill(0);
  const h = (i) => { const dx = Math.abs((i % cols) - ec), dy = Math.abs(((i / cols) | 0) - er); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  let hn = 0;
  const push = (i) => { navHeap[hn] = i; let k = hn++; while (k > 0) { const p = (k - 1) >> 1; if (navF[navHeap[p]] <= navF[navHeap[k]]) break; const t = navHeap[p]; navHeap[p] = navHeap[k]; navHeap[k] = t; k = p; } };
  const pop = () => { const top = navHeap[0]; navHeap[0] = navHeap[--hn]; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < hn && navF[navHeap[l]] < navF[navHeap[m]]) m = l; if (r < hn && navF[navHeap[r]] < navF[navHeap[m]]) m = r; if (m === k) break; const t = navHeap[m]; navHeap[m] = navHeap[k]; navHeap[k] = t; k = m; } return top; };
  navG[si] = 0; navF[si] = h(si); push(si);
  let found = false, iter = 0;
  while (hn > 0 && iter++ < 6000) {
    const cur = pop();
    if (navClosed[cur]) continue;
    navClosed[cur] = 1;
    if (cur === ei) { found = true; break; }
    const cc = cur % cols, cr = (cur / cols) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nc = cc + dx, nr = cr + dy;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (!grid[ni] || navClosed[ni]) continue;
      if (dx && dy && (!grid[cr * cols + nc] || !grid[nr * cols + cc])) continue;
      const g = navG[cur] + (dx && dy ? 1.414 : 1);
      if (g < navG[ni]) { navG[ni] = g; navCame[ni] = cur; navF[ni] = g + h(ni); push(ni); }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let i = ei; i !== -1 && i !== si; i = navCame[i]) cells.push({ x: ((i % cols) + 0.5) * cs, y: (((i / cols) | 0) + 0.5) * cs });
  cells.reverse();
  cells.push({ x: e.x, y: e.y });
  // pull the string tight: skip every waypoint that can be seen past
  const out = [];
  let from = { x: x0, y: y0 }, i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !navLine(from.x, from.y, cells[j].x, cells[j].y)) j--;
    out.push(cells[j]);
    from = cells[j];
    i = j + 1;
  }
  return out;
}

// ---------- what each hero wants ----------
const ROLE = {
  sword: { reach: 0.64, pref: 0.42 },
  spear: { reach: 0.94, pref: 0.74, min: 0.34 },
  axe: { reach: 0.6, pref: 0.4 },
  shield: { reach: 0.56, pref: 0.4 },
  lead: { reach: 0.68, pref: 0.45 },
  archer: { reach: 2.7, pref: 2.3, min: 1.4, ranged: true },
  creep: { reach: 0.5, pref: 0.4 },
};
const ORDER = { sword: [3, 1, 0, 2], spear: [3, 2, 1, 0], axe: [3, 2, 0, 1], shield: [2, 3, 0, 1], lead: [1, 3, 2, 0], archer: [2, 3, 0, 1] };
const EVADE = { roll: 1, step: 1, backflip: 1, lowRoll: 1, starJump: 1, slide: 1 };
const MOVERS = { leap: 1, dashSlash: 1, twinDash: 1, charge: 1, lungeThrust: 1, roll: 1, bash: 1 };
const ESCAPE = ['lowRoll', 'starJump', 'slide', 'roll', 'step', 'backflip', 'charge', 'leap', 'twinDash', 'dashSlash', 'lungeThrust'];
const PROJ_SPEED = { shoot: 12, snipe: 18, volley: 12, throwSpear: 20, throwAxe: 7 };
const RELEASE = { shoot: 0.55, snipe: 0.02, volley: 0.2, throwSpear: 0.12, throwAxe: 0.5 };
// how long a bot holds its aim before letting go (what the warning ring gives you to react); easier levels dither far longer
function aimTime(k) { const L = LEVELS[BOT_LEVEL]; return L && L.aim ? L.aim[0] + Math.random() * (L.aim[1] - L.aim[0]) : TELE[k] || 0.3; }
const TELE = { snipe: 0.5, throwSpear: 0.45, volley: 0.4, throwAxe: 0.35, leap: 0.35, lungeThrust: 0.32, sweep: 0.3 };
const STRIKES = {
  slash: { at: [0.47], reach: 0.28, r: 0.44 }, twin: { at: [0.32, 0.63], reach: 0.3, r: 0.46 }, chop2: { at: [0.36, 0.72], reach: 0.25, r: 0.44 },
  stab: { at: [0.5], reach: 0.3, r: 0.36 }, thrust: { at: [0.18], reach: 0.62, r: 0.38 }, sweep: { at: [0.3], reach: 0.5, r: 0.7 }, punch: { at: [0.42], reach: 0.28, r: 0.36 },
  bash: { at: [0.62], reach: 0.3, r: 0.48 },
};

function makeBot(heroId, team, x, y) {
  const a = makeActor(heroId, team, x, y);
  a.bot = { t: Math.random() * 0.1, react: 0.055 + Math.random() * 0.02, goal: null, tol: 0.05, path: null, pathGoal: null, pathT: 0, orbit: Math.random() < 0.5 ? 1 : -1, orbitT: 1 + Math.random() * 2, dodge: null, dodgeT: 0, retreat: false, target: null, stuck: 0, lx: x, ly: y };
  return a;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (x, y) => { const L = Math.hypot(x, y) || 1; return [x / L, y / L]; };
const aimAt = (a, p) => unit(p.x - a.x, p.y - a.y);
function untouchable(t) { const c = t.act; return t.dead || t.spawnShield > 0 || (c && (INVULN[c.k] || (c.k === 'leap' && c.t / c.dur < 0.85))); }
function predict(t, s) {
  let x = t.x + t.svx * s, y = t.y + t.svy * s;
  if (t.act && t.act.k === 'leap') { x = t.act.tx; y = t.act.ty; }
  if (!navOk(x, y)) { const q = navNearest(x, y); x = q.x; y = q.y; }
  return { x, y };
}
function clearShot(w, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 0.1);
  for (let i = 2; i < n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    for (const s of w.solids) if (!s.tower && Math.hypot(s.x - x, s.y - y) < s.r + 0.03) return false;
    for (const b of w.bananas) if (!b.cut && Math.hypot(b.x - x, b.y - y) < 0.16) return false;
    if (hutAt(w, x, y) || wallAt(w, x, y)) return false;
  }
  return true;
}

// ---------- reading danger ----------
function threatOf(e, a) {
  const c = e.act;
  if (!c) return null;
  const p = c.t / c.dur;
  const st = STRIKES[c.k];
  if (st) {
    const nxt = st.at.find((f) => f > p);
    if (nxt === undefined) return null;
    let cx, cy;
    if (st.reach < 0) { cx = c.x0 + c.dir[0] * (c.dist + 0.62); cy = c.y0 + c.dir[1] * (c.dist + 0.62); }
    else { cx = e.x + c.dir[0] * st.reach; cy = e.y + c.dir[1] * st.reach; }
    return { x: cx, y: cy, r: st.r, t: (nxt - p) * c.dur };
  }
  if (c.k === 'leap') return { x: c.tx, y: c.ty, r: 0.7, t: (1 - p) * c.dur };
  if (c.k === 'spin' || c.k === 'twinSpin') return { x: e.x, y: e.y, r: c.k === 'twinSpin' ? 0.72 : 0.62, t: 0.1 };
  if (c.k === 'dashSlash' || c.k === 'twinDash' || c.k === 'charge' || c.k === 'lungeThrust') {
    const ex = c.x0 + c.dir[0] * c.dist, ey = c.y0 + c.dir[1] * c.dist;
    return { line: [e.x, e.y, ex, ey], r: 0.42, t: 0.15 };
  }
  if (RELEASE[c.k] !== undefined) {
    if (p > RELEASE[c.k] && c.k !== 'volley') return null;
    const sp = PROJ_SPEED[c.k], L = c.k === 'shoot' ? ARROW_RANGE : c.dist;
    const de = dist(a, e);
    const t = Math.max(0, RELEASE[c.k] - p) * c.dur + de / sp;
    return { line: [e.x, e.y, e.x + c.dir[0] * L, e.y + c.dir[1] * L], r: c.k === 'volley' ? 0.55 : 0.32, t, proj: true };
  }
  return null;
}
function segClosest(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x0) * dx + (py - y0) * dy) / L2, 0, 1);
  return { x: x0 + dx * t, y: y0 + dy * t };
}
function sideStep(a, n) {
  // the side that keeps him on dry ground
  if (navOk(a.x + n[0] * 0.45, a.y + n[1] * 0.45)) return n;
  if (navOk(a.x - n[0] * 0.45, a.y - n[1] * 0.45)) return [-n[0], -n[1]];
  return n;
}
function danger(a, w, en) {
  let vx = 0, vy = 0, u = 0, heavy = false, src = null;
  for (const p of w.proj) {
    if (p.state !== 'fly' || p.team === a.team) continue;
    const rx = a.x - p.x, ry = a.y - p.y;
    const along = rx * p.dx + ry * p.dy;
    if (along < -0.15 || along > p.range - p.went + 0.25) continue;
    const t = along / p.speed;
    if (t > 0.85) continue;
    const perp = rx * p.dy - ry * p.dx;
    if (Math.abs(perp) > 0.36) continue;
    const s = perp > 0 ? -1 : 1;
    const d = sideStep(a, [-p.dy * s, p.dx * s]);
    const uu = 1 - t / 0.85;
    vx += d[0] * uu; vy += d[1] * uu;
    if (uu > u) { u = uu; src = p.owner; }
    if (p.dmg >= 90) heavy = true;
  }
  for (const e of en) {
    const th = threatOf(e, a);
    if (!th || th.t > 0.5) continue;
    let cx, cy;
    if (th.line) { const q = segClosest(a.x, a.y, ...th.line); cx = q.x; cy = q.y; }
    else { cx = th.x; cy = th.y; }
    const d = Math.hypot(a.x - cx, a.y - cy);
    if (d > th.r + 0.18) continue;
    let dir;
    if (th.line) { const L = unit(th.line[2] - th.line[0], th.line[3] - th.line[1]); const s = (a.x - th.line[0]) * -L[1] + (a.y - th.line[1]) * L[0] >= 0 ? 1 : -1; dir = sideStep(a, [-L[1] * s, L[0] * s]); }
    else dir = d > 0.02 ? unit(a.x - cx, a.y - cy) : sideStep(a, [-e.act.dir[1], e.act.dir[0]]);
    const uu = Math.max(0.35, 1 - th.t / 0.5);
    vx += dir[0] * uu; vy += dir[1] * uu;
    if (uu > u) { u = uu; src = e; }
    if (e.act.k === 'leap' || e.act.k === 'snipe' || e.act.k === 'lungeThrust' || e.act.k === 'charge' || e.act.k === 'throwSpear') heavy = true;
  }
  return { dir: u > 0 ? unit(vx, vy) : null, u, heavy, src };
}
function bestEscape(a, w, en, home, len = 1.4) {
  let best = null, bs = -1e9;
  const hv = home ? unit(home.x - a.x, home.y - a.y) : [0, 0];
  for (let k = 0; k < 20; k++) {
    const ang = (k / 20) * TAU, d = [Math.cos(ang), Math.sin(ang)];
    const px = a.x + d[0] * len, py = a.y + d[1] * len;
    if (!navLine(a.x, a.y, px, py)) continue;
    let m = 9;
    for (const e of en) m = Math.min(m, Math.hypot(e.x - px, e.y - py));
    let room = 0;
    for (let j = 1; j <= 3; j++) if (navOk(px + d[0] * 0.5 * j, py + d[1] * 0.5 * j)) room++;
    const sc = m * 1.2 + (d[0] * hv[0] + d[1] * hv[1]) * 0.8 + room * 0.25;
    if (sc > bs) { bs = sc; best = d; }
  }
  if (!best && en.length) { const n = en.reduce((p, e) => (dist(a, e) < dist(a, p) ? e : p)); best = unit(a.x - n.x, a.y - n.y); }
  return best || [-a.face, 0];
}

// ---------- the skill plans ----------
const SAI = {
  slash: (a, w, T, c) => (c.d < 0.66 && c.vul ? { dir: aimAt(a, c.pred(0.18)) } : null),
  twin: (a, w, T, c) => (c.d < 0.7 && c.vul ? { dir: aimAt(a, c.pred(0.2)) } : null),
  chop2: (a, w, T, c) => (c.d < 0.62 && c.vul ? { dir: aimAt(a, c.pred(0.22)) } : null),
  stab: (a, w, T, c) => (c.d < 0.58 && c.vul ? { dir: aimAt(a, c.pred(0.18)) } : null),
  thrust: (a, w, T, c) => (c.d > 0.26 && c.d < 0.98 && c.vul ? { dir: aimAt(a, c.pred(0.23)) } : null),
  shoot: (a, w, T, c) => { if (c.d > 5.4 || !c.vul || c.nearest < 0.9) return null; const p = c.pred(0.27 + c.d / 12); return clearShot(w, a.x, a.y, p.x, p.y) ? { dir: aimAt(a, p) } : null; },
  dashSlash: (a, w, T, c) => (c.d > 0.75 && c.d < 1.95 && c.vul && !c.spinning && navLine(a.x, a.y, T.x, T.y) ? { dir: aimAt(a, c.pred(0.15)), frac: clamp((c.d + 0.15) / 1.8, 0.3, 1) } : null),
  twinDash: (a, w, T, c) => (c.d > 0.8 && c.d < 2.15 && c.vul && !c.spinning && navLine(a.x, a.y, T.x, T.y) ? { dir: aimAt(a, c.pred(0.15)), frac: clamp((c.d + 0.15) / 2, 0.3, 1) } : null),
  step: () => null,
  spin: (a, w, T, c) => ((c.d < 0.5 || c.near(0.62) >= 2) && c.vul ? { dir: null } : null),
  twinSpin: (a, w, T, c) => ((c.d < 0.58 || c.near(0.72) >= 2) && c.vul ? { dir: null } : null),
  // a 4 m knock-down: peel off anyone who closes in, or send a low target flying
  sweep: (a, w, T, c) => (c.d < 1.0 && c.vul && !T.pinned && (c.d < 0.55 || c.near(1.0) >= 2 || T.hp / T.maxHp < 0.35 || a.hp / a.maxHp < 0.5) ? { dir: aimAt(a, c.pred(0.15)) } : null),
  // a 10 m charge: run him through and hurl him back over your shoulder; best when it throws him toward your own side
  lungeThrust: (a, w, T, c) => {
    if (c.d < 0.6 || c.d > 1.85 || !c.vul || T.pinned || T.grab || !navLine(a.x, a.y, T.x, T.y)) return null;
    const home = w.spawns[T.team];
    if (Math.hypot(T.x - home.x, T.y - home.y) < 1.8) return null;
    const p = c.pred(0.1 + c.d * 0.085);
    return { dir: aimAt(a, p), frac: clamp((dist(a, p) + 0.5) / 2, 0.3, 1) };
  },
  // throwing leaves him spearless until he fetches it: only when the shot is good and the coast is clear
  throwSpear: (a, w, T, c) => {
    if (c.d < 1.5 || c.d > 4.9 || !c.vul || T.pinned || a.hp / a.maxHp < 0.4 || c.near(1.5) > 0) return null;
    const home = w.spawns[T.team];
    if (Math.hypot(T.x - home.x, T.y - home.y) < 2) return null;
    const p = c.pred(0.05 + c.d / 20);
    return clearShot(w, a.x, a.y, p.x, p.y) ? { dir: aimAt(a, p), frac: clamp((dist(a, p) + 0.8) / 5, 0.3, 1) } : null;
  },
  punch: () => null, lowRoll: () => null, starJump: () => null, slide: () => null,
  roll: (a, w, T, c) => (T.hero.weapon === 'bow' && c.d > 1.4 && c.d < 2.1 && navLine(a.x, a.y, T.x, T.y) ? { dir: aimAt(a, T), frac: 1 } : null),
  throwAxe: (a, w, T, c) => { if (c.d < 1.25 || c.d > 4.1 || !c.vul) return null; const p = c.pred(0.3 + c.d / 7); return clearShot(w, a.x, a.y, p.x, p.y) ? { dir: aimAt(a, p) } : null; },
  leap: (a, w, T, c) => { if (a.axeOut || c.d < 0.9 || c.d > 3.1) return null; const p = c.pred(0.75); const dd = dist(a, p); return dd < 3 && dd > 0.5 ? { dir: aimAt(a, p), frac: dd / 3 } : null; },
  guard: () => null,
  bash: (a, w, T, c) => (c.d < 1.35 && c.vul && navLine(a.x, a.y, T.x, T.y) ? { dir: aimAt(a, c.pred(0.15)) } : null),
  charge: (a, w, T, c) => (c.d > 1.4 && c.d < 3.1 && c.vul && navLine(a.x, a.y, T.x, T.y) ? { dir: aimAt(a, c.pred(0.4)), frac: clamp((c.d + 0.35) / 3, 0.4, 1) } : null),
  rally: (a, w, T, c) => (c.d < 2.6 ? { dir: null } : null),
  backflip: () => null,
  // instant and knocks flat: peel off a melee diver, or punish anyone at range
  snipe: (a, w, T, c) => { if (c.d > 6.9 || !c.vul || T.down > 0) return null; const p = c.pred(c.d / 18); return clearShot(w, a.x, a.y, p.x, p.y) ? { dir: aimAt(a, p) } : null; },
  volley: (a, w, T, c) => { if (c.d < 1.6 || c.d > 5 || c.nearest < 1.4) return null; const p = c.pred(0.45 + c.d / 12); return clearShot(w, a.x, a.y, p.x, p.y) ? { dir: aimAt(a, p) } : null; },
};

function tryEvade(a, w, dz) {
  const H = a.hero;
  for (let i = 1; i < 4; i++) {
    const sk = skillsOf(a)[i];
    if (!EVADE[sk.act] || !skillReady(a, i)) continue;
    return cast(a, w, i, dz.dir, 1);
  }
  return false;
}
function tryEscape(a, w, en, home) {
  const dir = bestEscape(a, w, en, home, 1.6);
  for (const k of ESCAPE) {
    const i = skillsOf(a).findIndex((s) => s.act === k);
    if (i < 1 || !skillReady(a, i)) continue;
    if (k === 'leap') { const sk = skillsOf(a)[i]; let L = sk.range; while (L > 0.8 && !navOk(a.x + dir[0] * L, a.y + dir[1] * L)) L -= 0.2; return cast(a, w, i, dir, L / sk.range); }
    return cast(a, w, i, dir, 1);
  }
  return false;
}
function pickTarget(a, w, en, al) {
  const home = w.spawns[a.team === 'red' ? 'blue' : 'red'];
  let best = null, bs = 1e9;
  for (const e of en) {
    let s = dist(a, e) + (e.hp / e.maxHp) * 1.8 + (e.creep ? 1.6 : 0);
    for (const o of al) if (o.bot && o.bot.target === e) s -= 0.5;
    if (e.stun > 0 || e.down > 0) s -= 0.8;
    if (e.pinned) s -= 1.4; // stuck on a spear: free kill
    if (e.hero.weapon === 'bow') s -= 0.3;
    if (Math.hypot(e.x - home.x, e.y - home.y) < 1.4) s += 2.5; // healing at their base: leave him
    if (a.bot.target === e) s -= 0.7;
    if (e.spawnShield > 0) s += 1;
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}
function decide(a, w) {
  const B = a.bot, H = a.hero, R = ROLE[H.id];
  const en = w.actors.filter((o) => !o.dead && o.team !== a.team);
  const al = w.actors.filter((o) => !o.dead && o.team === a.team && o !== a);
  const hpF = a.hp / a.maxHp;
  const home = w.spawns[a.team];
  B.tol = 0.06;
  // 1) get out of the way of whatever is coming
  const dz = danger(a, w, en);
  const gi = skillsOf(a).findIndex((s) => s.act === 'guard');
  const guarding = !!(a.act && a.act.k === 'guard');
  if (gi > 0 && !a.shieldBroken) {
    // raise the shield toward whatever is coming; keep it there while the pressure lasts
    let tdir = null;
    if (dz.u > 0 && dz.src) tdir = unit(dz.src.x - a.x, dz.src.y - a.y);
    else {
      let best = null, bd = 9;
      for (const e of en) {
        const d = dist(a, e);
        const shooting = e.hero.weapon === 'bow' && d < 6 && d > 1.1;
        const winding = e.act && ACTS[e.act.k].lock && d < 1.4;
        if ((shooting || winding) && d < bd) { bd = d; best = e; }
      }
      if (best) tdir = unit(best.x - a.x, best.y - a.y);
    }
    if (tdir) { if (!guarding && !a.act) startHold(a, w, gi, tdir); else setHoldDir(a, tdir); B.guardT = 0.45; }
    else if (guarding) { B.guardT = (B.guardT || 0) - B.react; if (B.guardT <= 0) endHold(a, gi); }
  }
  if (guarding && dz.u > 0) dz.u = 0; // the shield is up: stand and take it on the shield
  // easier bots simply fail to react to some attacks (decided once per attack, not every tick)
  const miss = (LEVELS[BOT_LEVEL] || {}).miss || 0;
  if (dz.u > 0 && miss > 0) {
    if (B.seen !== dz.src || w.time - (B.seenT || 0) > 0.9) { B.seen = dz.src; B.seenT = w.time; B.blind = Math.random() < miss; }
    if (B.blind) dz.u = 0;
  }
  // the spearman bats incoming shots away with a swing
  if (a.hero.weapon === 'spear' && !a.spearOut && !a.act) {
    const si = skillsOf(a).findIndex((k) => k.act === 'sweep');
    const pj = si > 0 && skillReady(a, si) ? incomingShot(a, w) : null;
    if (pj && B.pjSeen !== pj) { B.pjSeen = pj; B.pjOk = Math.random() >= miss; }
    if (pj && B.pjOk) { B.aiming = null; a.aimPose = null; cast(a, w, si, unit(pj.x - a.x, pj.y - a.y)); return; }
  }
  if (dz.u > 0) {
    if ((dz.heavy && dz.u > 0.35) || (dz.u > 0.7 && hpF < 0.6)) { if (tryEvade(a, w, dz)) return; }
    if (dz.heavy && dz.u > 0.6 && !a.act) { const pi = skillsOf(a).findIndex((k) => k.act === 'slide'); if (pi > 0 && skillReady(a, pi) && cast(a, w, pi, dz.dir)) return; }
    B.dodge = dz.dir;
    B.dodgeT = 0.14;
  }
  // nobody of theirs close: push the lane and knock down their towers
  const foeNear = en.some((e) => dist(a, e) < 4.5);
  if (!foeNear && hpF > 0.45 && !B.retreat && siege(a, w)) return;
  if (!en.length) {
    B.target = null;
    const lead = w.actors.find((o) => !o.bot && !o.creep && !o.dead && o.team === a.team);
    if (lead && hpF > 0.9) { B.goal = { x: lead.x - lead.face * 0.6, y: lead.y + (a.id % 3 - 1) * 0.35 }; B.tol = 0.4; }
    else { B.goal = home; B.tol = 0.4; }
    return;
  }
  const T = pickTarget(a, w, en, al);
  B.target = T;
  const d = dist(a, T);
  const nearest = Math.min(...en.map((e) => dist(a, e)));
  const near = (r) => en.filter((e) => dist(a, e) < r).length;
  // 2) losing? go home and heal, but finish a target that is about to drop
  const finishing = T.hp < 140 && d < 1.3;
  if (a.shieldBroken && !finishing) {
    B.goal = home; B.tol = 0.25;
    if (nearest < 1.2 && !a.act) tryEscape(a, w, en, home);
    if (!a.act && d < 0.55 && skillReady(a, 0)) cast(a, w, 0, aimAt(a, T));
    return;
  }
  if (!B.retreat && hpF < 0.3 && nearest < 3.4 && !finishing) B.retreat = true;
  if (B.retreat && (hpF > 0.88 || (nearest > 4 && hpF > 0.6))) B.retreat = false;
  // hurt and standing under their tower: get out of its ring
  const tw = enemyTowerOver(a, w);
  if (tw && hpF < 0.5 && !finishing) { const u = unit(a.x - tw.x, a.y - tw.y); B.goal = { x: tw.x + u[0] * (TOWER_R + 0.6), y: tw.y + u[1] * (TOWER_R + 0.6) }; B.tol = 0.2; return; }
  if (B.retreat) {
    B.goal = home; B.tol = 0.25;
    if (nearest < 1.6 && !a.act) tryEscape(a, w, en, home);
    if (R.ranged && !a.act && nearest > 1.5 && skillReady(a, 0) && d < 5) { const p = predict(T, 0.27 + d / 12); if (clearShot(w, a.x, a.y, p.x, p.y)) cast(a, w, 0, aimAt(a, p)); }
    return;
  }
  if (H.weapon === 'spear' && a.spearOut) { spearless(a, w, T, en, dz, home); return; }
  // an axe thrown: both gone, go and get one; one gone, fetch it when nobody is close
  if (H.weapon === 'axe' && a.axeOut && lostWeapon(w, a) && (a.axeOut >= 2 || !en.some((e) => dist(a, e) < 2.4))) { spearless(a, w, T, en, dz, home); return; }
  // 3) use the skills that pay off right now
  const shielded = !!(T.act && T.act.k === 'guard' && !T.shieldBroken && (() => { const u = unit(a.x - T.x, a.y - T.y); return u[0] * T.act.gdir[0] + u[1] * T.act.gdir[1] > 0.2; })());
  const c = { d, nearest, near, shielded, vul: !untouchable(T), spinning: !!(T.act && (T.act.k === 'spin' || T.act.k === 'twinSpin')), pred: (s) => predict(T, s) };
  const guardUp = !!(a.act && a.act.k === 'guard');
  if (guardUp && gi > 0 && skillReady(a, 0) && d < R.reach * 0.95 && !shielded && dz.u <= 0 && !(ROLE[T.hero.id].ranged && d > 1)) endHold(a, gi);
  if (!a.act && !B.aiming) {
    for (const i of ORDER[H.id]) {
      if (!skillReady(a, i)) continue;
      if (skillsOf(a)[i].act === 'guard') continue;
      if (shielded && skillsOf(a)[i].act !== 'rally') continue; // don't feed the shield; go round it
      const plan = SAI[skillsOf(a)[i].act](a, w, T, c);
      if (plan && plan.dir && MOVERS[skillsOf(a)[i].act]) {
        // never dash or jump into the enemy camp
        const ep = w.spawns[a.team === 'red' ? 'blue' : 'red'], L = (skillsOf(a)[i].range || 1) * (plan.frac == null ? 1 : plan.frac);
        if (Math.hypot(a.x + plan.dir[0] * L - ep.x, a.y + plan.dir[1] * L - ep.y) < 1.35) continue;
      }
      if (plan) {
        const sk = skillsOf(a)[i];
        // aimed skills: hold the aim a moment first (the bot's own radar), so the one in its sights gets a warning
        if (plan.dir && (sk.aim === 'dir' || sk.aim === 'point') && !w.preview) B.aiming = { i, T, k: sk.act, sk, dir: plan.dir.slice(), frac: plan.frac == null ? 1 : plan.frac, t: 0, dur: aimTime(sk.act) };
        else cast(a, w, i, plan.dir, plan.frac == null ? 1 : plan.frac);
        break;
      }
    }
  }
  // 4) footwork
  B.orbitT -= B.react;
  if (B.orbitT <= 0) { B.orbitT = 1.2 + Math.random() * 2; B.orbit *= -1; }
  if (Math.hypot(a.x - B.lx, a.y - B.ly) < 0.01 && !a.act) { B.stuck += B.react; if (B.stuck > 0.5) { B.orbit *= -1; B.stuck = 0; B.path = null; } } else B.stuck = 0;
  B.lx = a.x; B.ly = a.y;
  const toMe = d > 0.01 ? unit(a.x - T.x, a.y - T.y) : [-1, 0];
  const ring = (r, turn) => { const ang = Math.atan2(toMe[1], toMe[0]) + turn; let x = T.x + Math.cos(ang) * r, y = T.y + Math.sin(ang) * r; if (!navOk(x, y)) { B.orbit *= -1; const q = navNearest(x, y); x = q.x; y = q.y; } return { x, y }; };
  if (R.ranged) {
    if (nearest < R.min) { const e = bestEscape(a, w, en, home, 1.4); B.goal = { x: a.x + e[0] * 1.4, y: a.y + e[1] * 1.4 }; }
    else if (d > R.pref + 1) B.goal = predict(T, 0.4);
    else {
      let g = ring(R.pref, B.orbit * 0.45);
      if (!clearShot(w, g.x, g.y, T.x, T.y)) { B.orbit *= -1; g = ring(R.pref, B.orbit * 0.7); }
      B.goal = g;
    }
    return;
  }
  const eR = ROLE[T.hero.id];
  const ready = a.cds[0] < 0.15;
  if (shielded) {
    // he hides behind his shield: go round to his back
    B.goal = ring(0.45, B.orbit * 1.2);
  } else if (c.spinning) {
    B.goal = ring(0.95, B.orbit * 0.6);
  } else if (eR.ranged || T.stun > 0 || (T.act && ACTS[T.act.k].lock && T.act.dur - T.act.t > 0.3)) {
    B.goal = predict(T, 0.25); B.tol = R.pref * 0.7;
  } else if (ready) {
    // step in to land the blow, a touch to his back side
    const back = (a.x - T.x) * T.face < 0 ? 0 : B.orbit * 0.35;
    B.goal = ring(R.pref, back);
  } else {
    // spacing: just outside his reach while my own swing recharges (or inside mine if I out-reach him)
    const r = R.reach > eR.reach + 0.1 ? R.reach * 0.88 : Math.min(1.2, eR.reach + 0.16);
    B.goal = ring(r, B.orbit * 0.4);
  }
}

function steerTo(a, gx, gy, dt) {
  const B = a.bot || a.creep;
  // never step into the enemy camp
  if (W_REF) { const ep = W_REF.spawns[a.team === 'red' ? 'blue' : 'red']; const d = Math.hypot(gx - ep.x, gy - ep.y); if (d < 1.45) { const u = d > 0.01 ? [(gx - ep.x) / d, (gy - ep.y) / d] : unit(a.x - ep.x, a.y - ep.y); gx = ep.x + u[0] * 1.45; gy = ep.y + u[1] * 1.45; } }
  const dd = Math.hypot(gx - a.x, gy - a.y);
  if (dd < B.tol) return [0, 0];
  if (navLine(a.x, a.y, gx, gy)) { B.path = null; return unit(gx - a.x, gy - a.y); }
  B.pathT -= dt;
  if (!B.path || !B.path.length || B.pathT <= 0 || !B.pathGoal || Math.hypot(B.pathGoal.x - gx, B.pathGoal.y - gy) > 0.6) {
    B.path = findPath(a.x, a.y, gx, gy);
    B.pathGoal = { x: gx, y: gy };
    B.pathT = 0.5;
  }
  if (!B.path) return unit(gx - a.x, gy - a.y);
  while (B.path.length > 1 && (Math.hypot(B.path[0].x - a.x, B.path[0].y - a.y) < 0.15 || navLine(a.x, a.y, B.path[1].x, B.path[1].y))) B.path.shift();
  const wp = B.path[0] || { x: gx, y: gy };
  return unit(wp.x - a.x, wp.y - a.y);
}
let W_REF = null;
function botThink(a, w, dt) {
  W_REF = w;
  const B = a.bot;
  if (a.dead || a.stun > 0 || a.down > 0 || a.pinned || a.grab) { B.aiming = null; a.aimPose = null; return [0, 0]; }
  B.t -= dt;
  B.dodgeT -= dt;
  if (B.t <= 0) { B.t = B.react; decide(a, w); }
  let mv = [0, 0];
  if (B.dodgeT > 0 && B.dodge) mv = B.dodge.slice();
  else if (B.goal) mv = steerTo(a, B.goal.x, B.goal.y, dt);
  const am = B.aiming;
  if (am) {
    if (a.act || !skillReady(a, am.i) || am.T.dead || am.T.pinned) { B.aiming = null; a.aimPose = null; }
    else {
      am.t += dt;
      // tracks him for most of the aim, then the aim is set: the last beat is the moment to get out of the line
      if (am.t < am.dur * 0.6) {
        const lead = PROJ_SPEED[am.k] ? 0.05 + dist(a, am.T) / PROJ_SPEED[am.k] : 0.2;
        const q = predict(am.T, lead);
        am.dir = aimAt(a, q);
        if (am.sk.aim === 'point' || am.k === 'lungeThrust') am.frac = clamp((dist(a, q) + (am.k === 'lungeThrust' ? 0.5 : 0)) / am.sk.range, 0.3, 1);
      }
      a.aimPose = { k: am.k, dir: am.dir };
      if (Math.abs(am.dir[0]) > 0.05) a.face = am.dir[0] > 0 ? 1 : -1;
      if (am.t >= am.dur) { B.aiming = null; a.aimPose = null; cast(a, w, am.i, am.dir, am.frac); }
      mv = [mv[0] * 0.25, mv[1] * 0.25];
    }
  }
  for (const o of w.actors) {
    if (o === a || o.dead || o.team !== a.team) continue;
    const dx = a.x - o.x, dy = a.y - o.y, d = Math.hypot(dx, dy);
    if (d < 0.45 && d > 1e-3) { mv[0] += (dx / d) * (0.45 - d) * 2; mv[1] += (dy / d) * (0.45 - d) * 2; }
  }
  const L = Math.hypot(mv[0], mv[1]);
  if (L > 1) mv = [mv[0] / L, mv[1] / L];
  // face the target while spacing so the blade is ready
  return mv;
}

// spear thrown: fetch it, roll/jump to it, punch anyone who gets in the way, drop flat if something big is coming
function spearless(a, w, T, en, dz, home) {
  const B = a.bot;
  const p = lostWeapon(w, a);
  const K = skillsOf(a);
  if (!p) return;
  let gx = p.gx != null ? p.gx : p.x, gy = p.gy != null ? p.gy : p.y;
  const busy = p.victim && !p.victim.dead; // still in someone: stand over him
  if (p.state === 'fly') { gx = a.x + p.dx * 0.3; gy = a.y + p.dy * 0.3; }
  const q = navNearest(gx, gy);
  B.goal = q; B.tol = busy ? 0.35 : 0.05;
  if (a.act) return;
  const d = Math.hypot(q.x - a.x, q.y - a.y);
  const near = en.filter((e) => dist(a, e) < 0.5 && !e.pinned && !untouchable(e));
  if (near.length && skillReady(a, 0)) { cast(a, w, 0, aimAt(a, near[0])); return; }
  if (d > 1.0 && navLine(a.x, a.y, q.x, q.y)) {
    for (const k of ['starJump', 'lowRoll']) {
      const i = K.findIndex((s) => s.act === k);
      if (i > 0 && skillReady(a, i)) { cast(a, w, i, unit(q.x - a.x, q.y - a.y), clamp(d / 1.2, 0.3, 1)); return; }
    }
  }
}

// ---------- the lock-on warning: every enemy aim, swing, wind-up or arrow that has you in it ----------
function aimCovers(e, me) {
  const am = e.bot && e.bot.aiming;
  if (!am) return false;
  const sk = am.sk, d = dist(e, me), body = 0.2;
  const ang = Math.atan2(am.dir[1], am.dir[0]);
  let da = Math.abs(Math.atan2(me.y - e.y, me.x - e.x) - ang);
  if (da > Math.PI) da = TAU - da;
  if (sk.aim === 'point') { const L = sk.range * am.frac; return Math.hypot(e.x + am.dir[0] * L - me.x, e.y + am.dir[1] * L - me.y) < 0.42 + body; }
  if (am.k === 'volley') return d < sk.range + body && da < 0.24 + Math.asin(Math.min(1, body / Math.max(d, body)));
  if (am.k === 'sweep') return d < 0.95 + body && da < 1.3;
  const L = (am.k === 'throwSpear' || am.k === 'lungeThrust') ? sk.range : sk.range * am.frac;
  const q = segClosest(me.x, me.y, e.x, e.y, e.x + am.dir[0] * L, e.y + am.dir[1] * L);
  return Math.hypot(me.x - q.x, me.y - q.y) < 0.15 + body;
}
function aimThreats(w, me) {
  const out = [];
  if (!me || me.dead) return out;
  // a tower whose archers have picked you
  for (const t of w.towers || []) if (!t.dead && t.team !== me.team && t.target === me) out.push({ x: t.x, y: t.y });
  for (const e of w.actors) {
    if (e.dead || e.team === me.team) continue;
    if (aimCovers(e, me)) { out.push({ x: e.x, y: e.y }); continue; }
    const th = threatOf(e, me);
    if (!th || th.t > 0.9) continue;
    let cx, cy;
    if (th.line) { const q = segClosest(me.x, me.y, ...th.line); cx = q.x; cy = q.y; } else { cx = th.x; cy = th.y; }
    if (Math.hypot(me.x - cx, me.y - cy) < th.r + 0.12) out.push({ x: e.x, y: e.y });
  }
  for (const p of w.proj) {
    if (p.state !== 'fly' || p.team === me.team) continue;
    if (p.homing === me) { out.push({ x: p.x, y: p.y }); continue; }
    const rx = me.x - p.x, ry = me.y - p.y, along = rx * p.dx + ry * p.dy;
    if (along < -0.1 || along > p.range - p.went + 0.2 || along / p.speed > 0.9) continue;
    if (Math.abs(rx * p.dy - ry * p.dx) < 0.32) out.push({ x: p.x, y: p.y });
  }
  return out;
}

function incomingShot(a, w) {
  let best = null, bt = 0.3;
  for (const p of w.proj) {
    if (p.state !== 'fly' || p.team === a.team || p.parried) continue;
    const rx = a.x - p.x, ry = a.y - p.y, along = rx * p.dx + ry * p.dy;
    if (along < 0 || Math.abs(rx * p.dy - ry * p.dx) > 0.35) continue;
    const t = along / p.speed;
    if (t < bt && along < 1.6) { bt = t; best = p; }
  }
  return best;
}

// ---------- towers ----------
function enemyTowerOver(a, w) { for (const t of w.towers || []) if (!t.dead && t.team !== a.team && Math.hypot(a.x - t.x, a.y - t.y) < TOWER_R + 0.15) return t; return null; }
// walk to the nearest enemy tower and take it down: archers from outside its ring, the rest up against its legs
function siege(a, w) {
  const B = a.bot, R = ROLE[a.hero.id];
  let best = null, bd = 1e9;
  for (const t of w.towers || []) { if (t.dead || t.team === a.team) continue; const d = dist(a, t); if (d < bd) { bd = d; best = t; } }
  if (!best || (a.hero.weapon === 'spear' && a.spearOut)) return false;
  B.target = null;
  const stand = R.ranged ? ARROW_RANGE - 0.25 : TOWER_SOLID + 0.35;
  const u = unit(a.x - best.x, a.y - best.y);
  B.goal = { x: best.x + u[0] * stand, y: best.y + u[1] * stand }; B.tol = 0.15;
  const reach = R.ranged ? ARROW_RANGE + 0.3 : (a.hero.weapon === 'spear' ? 1.1 : 0.9) + 0.45;
  if (!a.act && bd < reach + 0.1 && skillReady(a, 0) && (!R.ranged || clearShot(w, a.x, a.y, best.x, best.y))) cast(a, w, 0, aimAt(a, best));
  return true;
}

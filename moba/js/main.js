'use strict';
// ===== main: character select, MOBA controls, the game loop =====
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const pv = document.getElementById('pv');
const pg = pv.getContext('2d');
const mini = document.getElementById('mini');
const mg = mini.getContext('2d');
const $ = (id) => document.getElementById(id);

let state = 'menu';
let selHero = 'spear', selTeam = 'red';
try { selHero = localStorage.getItem('sb_hero') || selHero; selTeam = localStorage.getItem('sb_team') || selTeam; } catch (e) {}
if (!HEROES.some((h) => h.id === selHero)) selHero = 'spear';
if (!TEAM[selTeam]) selTeam = 'red';
let botsCfg = [{ hero: 'axe', side: 'enemy' }];
try { const b = JSON.parse(localStorage.getItem('sb_bots') || 'null'); if (Array.isArray(b)) botsCfg = b.filter((x) => x && HEROES.some((h) => h.id === x.hero) && (x.side === 'enemy' || x.side === 'ally')).slice(0, 9); } catch (e) {}
const MAX_BOTS = 9;
const otherTeam = (t) => (t === 'red' ? 'blue' : 'red');

let mapKind = 'big';
try { if (localStorage.getItem('sb_map') === 'lane') mapKind = 'lane'; } catch (e) { /* no storage */ }
const MAPS = { big: 'ใหญ่ 3 เลน', lane: 'เล็ก เลนเดียว' };
const world = makeWorld(7303, mapKind);
buildNav(world);
// swap the field for the other map (menu only): same world object, new contents, every cache rebuilt
function setMap(kind) {
  if (state !== 'menu') return;
  mapKind = kind;
  try { localStorage.setItem('sb_map', kind); } catch (e) { /* no storage */ }
  const nw = makeWorld(7303, kind);
  for (const k of Object.keys(world)) delete world[k];
  Object.assign(world, nw);
  featCache = null; sprites.res = 0; wallSprites.res = 0; fogCv = tinyCv = null;
  buildNav(world);
  resize();
  showMap();
}
function showMap() { const b = $('mapB'); if (b) b.innerHTML = '<i>◈</i> แผนที่: ' + MAPS[mapKind]; }
let player = null;
let miniBg = null, miniW = 0, miniH = 0;
let pvPattern = null;

// ---------- sizing ----------
function resize() {
  cam.vw = window.innerWidth;
  cam.vh = window.innerHeight;
  const Q = GFX[gfx], dev = window.devicePixelRatio || 1;
  // micro-pixel: the whole field drawn about 200 pixels tall and blown up in hard squares
  DPR = Q.pixel ? clamp(200 / Math.min(cam.vw, cam.vh), 0.3, 0.6) : Math.min(dev, Q.dpr);
  MINI_DPR = Q.pixel ? 1 : Math.max(1, DPR);
  cv.style.imageRendering = Q.pixel ? 'pixelated' : '';
  $('pv').style.imageRendering = Q.pixel ? 'pixelated' : '';
  cv.width = Math.round(cam.vw * DPR);
  cv.height = Math.round(cam.vh * DPR);
  const m = Math.min(cam.vw, cam.vh);
  cam.baseU = clamp(m * (cam.vw < cam.vh ? 0.36 : 0.42), 115, 250) * 0.85; // pulled back 15%
  cam.U = cam.baseU;
  if (!grassTile) buildGrassTile(ctx);
  else grassPattern = ctx.createPattern(grassTile, 'repeat');
  if (!featCache) buildFeatures(world);
  buildSprites(world);
  // the field is tall and narrow: size the minimap by its height
  // a quarter of the area it had: about a quarter of the screen's short side across
  miniH = Math.round(clamp(Math.min(cam.vw, cam.vh) * 0.26, 76, 110));
  miniW = Math.max(36, Math.round((miniH * world.W) / world.H));
  // (the long one-lane strip: sized by its width instead)
  if (world.W > world.H * 1.3) { miniW = Math.round(clamp(Math.min(cam.vw, cam.vh) * 0.44, 130, 180)); miniH = Math.round((miniW * world.H) / world.W); }
  mini.width = miniW * MINI_DPR;
  mini.height = miniH * MINI_DPR;
  mini.style.imageRendering = Q.pixel ? 'pixelated' : '';
  mini.style.width = miniW + 'px';
  mini.style.height = miniH + 'px';
  miniBg = buildMinimap(world, mini.width, mini.height);
  layoutButtons();
  resetJoy();
}
window.addEventListener('resize', resize);
function showGfx() { for (const b of document.querySelectorAll('.gfxb')) b.innerHTML = '<i>▦</i> ' + (b.id === 'gfxH' ? GFX[gfx].short : 'กราฟิก: ' + GFX[gfx].name); }
function cycleGfx(e) {
  e.preventDefault(); e.stopPropagation();
  gfx = (gfx + 1) % GFX.length;
  try { localStorage.setItem('sb_gfx', gfx); } catch (err) { /* no storage */ }
  fogCv = tinyCv = null;
  resize(); showGfx();
  if (state === 'game' && player) addFloater(world, player.x, player.y - 1.2, 'กราฟิก: ' + GFX[gfx].name, '#f2d27a', 1.05);
}
for (const b of document.querySelectorAll('.gfxb')) b.addEventListener('pointerdown', cycleGfx);

showGfx();

// ---------- character select ----------
function actorLite(heroId, team) { return { hero: heroById(heroId), team, face: 1, time: 0.4, moving: false, buffT: 0, run: 0, seed: 0, act: null, spearOut: false, axeOut: false }; }
function portrait(c, heroId, team) {
  const g = c.getContext('2d');
  const w = c.width, h = c.height;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  const T = TEAM[team];
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, T.dark);
  bg.addColorStop(1, '#140d07');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.6;
  g.drawImage(auraSprite(), w * 0.05, h * 0.05, w * 0.9, w * 0.9);
  g.globalAlpha = 1;
  const a = actorLite(heroId, team);
  const s = h * (a.hero.head === 'crown' ? 1.0 : a.hero.head === 'hat' ? 1.15 : 1.25);
  drawFigure(g, a, w * 0.5, h + s * 0.38, s, basePose(a));
}
function buildMenu() {
  const cards = $('cards');
  cards.innerHTML = '';
  for (const H of HEROES) {
    const b = document.createElement('button');
    b.className = 'card' + (H.id === selHero ? ' on' : '');
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    b.appendChild(c);
    const sp = document.createElement('span');
    sp.textContent = H.name;
    b.appendChild(sp);
    b.onclick = () => { selHero = H.id; save(); refreshMenu(); };
    b.dataset.id = H.id;
    cards.appendChild(b);
  }
  document.querySelectorAll('.teams button').forEach((b) => {
    b.onclick = () => { selTeam = b.dataset.team; save(); refreshMenu(); };
  });
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll('.tabs button').forEach((o) => o.classList.toggle('on', o === b));
      $('tabHero').classList.toggle('hidden', b.dataset.tab !== 'hero');
      $('tabBots').classList.toggle('hidden', b.dataset.tab !== 'bots');
    };
  });
  $('addEnemy').onclick = () => addBot('enemy');
  $('addAlly').onclick = () => addBot('ally');
  refreshMenu();
}
function save() { try { localStorage.setItem('sb_hero', selHero); localStorage.setItem('sb_team', selTeam); localStorage.setItem('sb_bots', JSON.stringify(botsCfg)); } catch (e) {} }
function renderBots() {
  const list = $('botList');
  list.innerHTML = '';
  $('botCount').textContent = botsCfg.length;
  const nE = botsCfg.filter((b) => b.side === 'enemy').length, nA = botsCfg.length - nE;
  $('addEnemy').className = 'addb ' + (otherTeam(selTeam) === 'red' ? 'en' : 'al');
  $('addAlly').className = 'addb ' + (selTeam === 'red' ? 'en' : 'al');
  $('addEnemy').disabled = botsCfg.length >= MAX_BOTS || nE >= 5;
  $('addAlly').disabled = botsCfg.length >= MAX_BOTS || nA >= 4;
  // difficulty
  const lv = document.createElement('div');
  lv.className = 'lvl';
  for (let n = 1; n <= 3; n++) {
    const bt = document.createElement('button');
    bt.className = 'lv' + n + (BOT_LEVEL === n ? ' on' : '');
    bt.innerHTML = '<i>ระดับ ' + n + '</i>' + LEVELS[n].name;
    bt.onclick = () => { BOT_LEVEL = n; try { localStorage.setItem('sb_lvl', String(n)); } catch (e) {} renderBots(); };
    lv.appendChild(bt);
  }
  list.appendChild(lv);
  const ln = document.createElement('p');
  ln.className = 'botnote'; ln.style.margin = '2px 0 8px'; ln.textContent = 'ความยาก: ' + LEVELS[BOT_LEVEL].note;
  list.appendChild(ln);
  if (!botsCfg.length) list.insertAdjacentHTML('beforeend', '<p class="botnote" style="text-align:center">ยังไม่มีบอท กดปุ่มด้านบนเพื่อเพิ่ม</p>');
  botsCfg.forEach((b, idx) => {
    const team = b.side === 'ally' ? selTeam : otherTeam(selTeam);
    const row = document.createElement('div');
    row.className = 'bot';
    const side = document.createElement('button');
    side.className = 'bside ' + (team === 'red' ? 'en' : 'al');
    side.textContent = b.side === 'ally' ? 'ฝ่ายเรา' : 'ศัตรู';
    side.onclick = () => { b.side = b.side === 'ally' ? 'enemy' : 'ally'; save(); renderBots(); };
    row.appendChild(side);
    const pick = document.createElement('div');
    pick.className = 'bpick';
    for (const H of HEROES) {
      const pb = document.createElement('button');
      pb.className = H.id === b.hero ? 'on' : '';
      pb.title = H.name;
      const c = document.createElement('canvas');
      c.width = c.height = 72;
      portrait(c, H.id, team);
      pb.appendChild(c);
      pb.onclick = () => { b.hero = H.id; save(); renderBots(); };
      pick.appendChild(pb);
    }
    row.appendChild(pick);
    const del = document.createElement('button');
    del.className = 'bdel';
    del.textContent = '✕';
    del.onclick = () => { botsCfg.splice(idx, 1); save(); renderBots(); };
    row.appendChild(del);
    list.appendChild(row);
  });
  $('go').textContent = botsCfg.length ? `ลงสนาม ▸ (${botsCfg.filter((b) => b.side === 'ally').length + 1} vs ${botsCfg.filter((b) => b.side === 'enemy').length})` : 'ลงสนาม ▸';
}
function addBot(side) {
  if (botsCfg.length >= MAX_BOTS) return;
  const used = botsCfg.map((b) => b.hero);
  const free = HEROES.filter((h) => !used.includes(h.id) && h.id !== selHero);
  const pool = free.length ? free : HEROES;
  botsCfg.push({ hero: pool[Math.floor(Math.random() * pool.length)].id, side });
  save();
  renderBots();
  const last = $('botList').lastElementChild;
  if (last) last.scrollIntoView({ block: 'nearest' });
}
const STAT_NAMES = { hp: 'พลังชีวิต', spd: 'ความเร็ว', rng: 'ระยะโจมตี', dif: 'ความยาก' };
function refreshMenu() {
  const H = heroById(selHero);
  document.querySelectorAll('.card').forEach((b) => { b.classList.toggle('on', b.dataset.id === selHero); portrait(b.querySelector('canvas'), b.dataset.id, selTeam); });
  document.querySelectorAll('.teams button').forEach((b) => b.classList.toggle('on', b.dataset.team === selTeam));
  $('hName').textContent = H.name;
  $('hTitle').textContent = H.title;
  $('roles').innerHTML = H.role.map((r) => `<span>${r}</span>`).join('');
  $('hDesc').textContent = H.desc;
  $('stats').innerHTML = Object.entries(H.stats).map(([k, v]) => `<span>${STAT_NAMES[k]}</span><div class="bar">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</div>`).join('');
  const skl = $('skl');
  skl.innerHTML = '';
  H.skills.forEach((sk, i) => {
    const row = document.createElement('div');
    row.className = 'sk';
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    drawIcon(c, sk.icon, selTeam);
    row.appendChild(c);
    const d = document.createElement('div');
    d.innerHTML = `<b>${sk.name}</b><em>${i === 0 ? 'โจมตีปกติ' : 'สกิล ' + i + ' · ' + sk.cd + ' วิ'}</em><small>${i === 0 ? 'ล็อกเป้าที่ใกล้ที่สุดให้อัตโนมัติ กดค้างเพื่อตีต่อเนื่อง' : sk.desc}</small>`;
    row.appendChild(d);
    row.onclick = () => previewCast(i);
    skl.appendChild(row);
  });
  if (H.weapon === 'spear' || H.weapon === 'shield' || H.weapon === 'axe') {
    const hd = document.createElement('p');
    hd.className = 'desc';
    hd.style.margin = '8px 0 2px';
    hd.innerHTML = H.weapon === 'axe' ? '<b style="color:#f2d27a">ขว้างขวานหมดทั้งสองเล่ม</b> ปุ่มทั้งหมดเปลี่ยนเป็นท่าเหล่านี้จนกว่าจะเก็บขวานคืน (3 ท่าหลังไม่โดนดาเมจ)' : H.weapon === 'spear' ? '<b style="color:#f2d27a">ระหว่างหอกไม่อยู่ในมือ</b> ปุ่มทั้งหมดเปลี่ยนเป็นท่าเหล่านี้ (3 ท่าหลังไม่โดนดาเมจ)' : '<b style="color:#f2d27a">ระหว่างโล่แตก</b> ปุ่มสกิลเปลี่ยนเป็นท่าหลบเหล่านี้ (ไม่โดนดาเมจ) ปุ่มใหญ่ยังแทงมีดได้';
    skl.appendChild(hd);
    (H.weapon === 'shield' ? SPEAR_ALT.slice(1) : SPEAR_ALT).forEach((sk) => {
      const row = document.createElement('div');
      row.className = 'sk';
      const c = document.createElement('canvas');
      c.width = c.height = 96;
      drawIcon(c, sk.icon, selTeam);
      row.appendChild(c);
      const d = document.createElement('div');
      d.innerHTML = `<b>${sk.name}</b><small>${sk.desc}</small>`;
      row.appendChild(d);
      skl.appendChild(row);
    });
  }
  renderBots();
  resetPreview();
}

// ---------- the hero preview on the select screen ----------
function makePreviewWorld() {
  return { preview: true, W: 99, H: 99, bank: 999, time: 0, ponds: [], bananas: [], mangoes: [], palms: [], huts: [], jars: [], taros: [], grass: [], tufts: [], puddles: [], proj: [], fx: [], floaters: [], path: [], solids: [], actors: [], dummies: [{ x: 1.05, y: 0, wob: 0, wobV: 0, hitT: 9, total: 0 }] };
}
let pvw = makePreviewWorld(), pa = null, pvScript = { i: 0, wait: 0.8 };
const HOME = [-0.5, 0];
function resetPreview() {
  pvw = makePreviewWorld();
  pa = makeActor(selHero, selTeam, HOME[0], HOME[1]);
  pvScript = { i: 0, wait: 0.7, forced: -1 };
}
function previewCast(i) { pvScript.forced = i; pvScript.wait = 0; }
function castPreview(i) {
  const sk = skillsOf(pa)[i];
  cdsOf(pa)[i] = 0;
  pa.face = 1;
  let dir = [1, 0], frac = 1;
  if (sk.act === 'backflip' || sk.act === 'step') { dir = [-1, 0]; frac = 0.6 / sk.range; }
  else if (sk.act === 'leap') frac = 1.15 / sk.range;
  else if (sk.aim === 'dir' && sk.range < 4) frac = Math.min(1, 1.0 / sk.range);
  if (sk.aim === 'auto') dir = null;
  if (!cast(pa, pvw, i, dir, frac)) return false;
  if (sk.act === 'guard') { pa.act.demo = 2.6; pa.cds[i] = 0; }
  return true;
}
function updatePreview(dt) {
  let move = [0, 0];
  if (pa.spearOut && !pa.act) {
    const p = myJavelin(pvw, pa);
    if (p && p.state !== 'fly') { const dx = p.x - pa.x, dy = p.y - pa.y, d = Math.hypot(dx, dy); if (d > 0.05) move = [dx / d, dy / d]; }
    updateActor(pa, dt, pvw, move); tickWorld(pvw, dt, []); updateProj(pvw, dt); updateFx(pvw, dt);
    return;
  }
  if (!pa.act) {
    const dx = HOME[0] - pa.x, dy = HOME[1] - pa.y, d = Math.hypot(dx, dy);
    if (d > 0.05) move = [dx / d, dy / d];
    else {
      pa.face = 1;
      pvScript.wait -= dt;
      if (pvScript.wait <= 0) {
        const order = [0, 1, 0, 2, 0, 3];
        const i = pvScript.forced >= 0 ? pvScript.forced : order[pvScript.i++ % order.length];
        pvScript.forced = -1;
        castPreview(i);
        pvScript.wait = 1.0;
      }
    }
  }
  updateActor(pa, dt, pvw, move);
  tickWorld(pvw, dt, []);
  updateProj(pvw, dt);
  updateFx(pvw, dt);
  pvw.dummies[0].x = 1.05;
}
function renderPreview() {
  const r = pv.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  const W = Math.round(r.width * DPR), H = Math.round(r.height * DPR);
  if (pv.width !== W || pv.height !== H) { pv.width = W; pv.height = H; pvPattern = null; }
  if (!pvPattern && grassTile) pvPattern = pg.createPattern(grassTile, 'repeat');
  pg.setTransform(1, 0, 0, 1, 0, 0);
  pg.clearRect(0, 0, W, H);
  const keep = { x: cam.x, y: cam.y, U: cam.U, vw: cam.vw, vh: cam.vh };
  const k = Math.min(r.width / 3.5, r.height / 1.45);
  cam.U = k; cam.vw = r.width; cam.vh = r.height; cam.x = 0.25;
  cam.y = -(r.height * 0.74 - r.height / 2) / (k * TILT);
  screenTransform(pg);
  const [cx, cy] = w2s(0.25, 0.05);
  const rx = r.width * 0.47, ry = Math.min(r.height * 0.22, rx * 0.3);
  pg.save();
  pg.beginPath();
  pg.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  pg.clip();
  if (pvPattern) {
    const T = grassTile.width;
    if (pvPattern.setTransform) pvPattern.setTransform(new DOMMatrix().translate(cx, cy).scale((1.4 * k) / T, (1.4 * k * TILT) / T));
    pg.fillStyle = pvPattern;
    pg.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  }
  const vg = pg.createRadialGradient(cx, cy, ry * 0.2, cx, cy, rx);
  vg.addColorStop(0, 'rgba(255,240,190,0.12)');
  vg.addColorStop(0.55, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10,6,2,0.85)');
  pg.fillStyle = vg;
  pg.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  pg.restore();
  drawGroundFx(pg, pvw, k);
  const items = [];
  for (const d of pvw.dummies) items.push({ y: d.y, f: () => { const [x, y] = w2s(d.x, d.y); drawDummy(pg, d, x, y, k, pvw.time); } });
  for (const p of pvw.proj) items.push({ y: p.y + 0.01, f: () => drawProj(pg, p, k) });
  items.push({ y: pa.y, f: () => drawActor(pg, pa, k) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.f();
  drawAirFx(pg, pvw, k);
  drawFloaters(pg, pvw, k);
  Object.assign(cam, keep);
}

// ---------- in-game controls ----------
const input = { joy: { id: null, bx: 0, by: 0, dx: 0, dy: 0 }, keys: new Set(), atkHold: false, aim: null, mouse: { x: 0, y: 0, has: false } };
const joyEl = $('joy'), knob = $('joyKnob'), cancelEl = $('cancel');
let joyRest = [0, 0];
const JOY_R = 52;
function resetJoy() {
  joyRest = [cam.vw * 0.14 + 30, cam.vh * 0.7];
  if (input.joy.id === null) { joyEl.style.left = joyRest[0] + 'px'; joyEl.style.top = joyRest[1] + 'px'; knob.style.transform = ''; }
}
const zone = $('joyZone');
zone.addEventListener('pointerdown', (e) => {
  if (input.joy.id !== null) return;
  e.preventDefault();
  zone.setPointerCapture(e.pointerId);
  input.joy.id = e.pointerId;
  input.joy.bx = clamp(e.clientX, 70, cam.vw * 0.46);
  input.joy.by = clamp(e.clientY, cam.vh * 0.3, cam.vh - 64);
  joyEl.style.left = input.joy.bx + 'px';
  joyEl.style.top = input.joy.by + 'px';
  joyEl.classList.add('active');
  joyMove(e);
  hideTip();
});
function joyMove(e) {
  if (e.pointerId !== input.joy.id) return;
  let dx = e.clientX - input.joy.bx, dy = e.clientY - input.joy.by;
  const d = Math.hypot(dx, dy);
  if (d > JOY_R) { dx = (dx / d) * JOY_R; dy = (dy / d) * JOY_R; }
  input.joy.dx = dx / JOY_R;
  input.joy.dy = dy / JOY_R;
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
}
zone.addEventListener('pointermove', joyMove);
const joyEnd = (e) => {
  if (e.pointerId !== input.joy.id) return;
  input.joy.id = null; input.joy.dx = 0; input.joy.dy = 0;
  joyEl.classList.remove('active');
  resetJoy();
};
zone.addEventListener('pointerup', joyEnd);
zone.addEventListener('pointercancel', joyEnd);

const btns = [];
let towerBtn = null;
function towerTap() {
  if (!player || player.dead || state !== 'game') return;
  if (towerStrike(player, world)) return;
  const nt = nearestEnemyTower(player, world);
  if ((!nt || nt.d > 3.2) && !(player.towerMsgT > 0)) { addFloater(world, player.x, player.y - 1.0, 'ไม่มีป้อมศัตรูใกล้ ๆ', '#e8d8b0', 0.9); player.towerMsgT = 1.2; }
}
function buildButtons() {
  for (const b of btns) b.el.remove();
  btns.length = 0;
  // the tower button: basic attacks at the nearest enemy tower only
  if (towerBtn) towerBtn.remove();
  towerBtn = document.createElement('div');
  towerBtn.className = 'sb tw';
  { const c = document.createElement('canvas'); c.width = c.height = 160; drawIcon(c, 'tower', player.team); towerBtn.appendChild(c); }
  towerBtn.insertAdjacentHTML('beforeend', '<div class="ring"></div><div class="lbl">ตีป้อม</div><div class="key">T</div>');
  $('hud').appendChild(towerBtn);
  towerBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); towerBtn.setPointerCapture(e.pointerId); towerBtn.classList.add('press'); hideTip(); input.towerHold = true; towerTap(); });
  const tUp = () => { towerBtn.classList.remove('press'); input.towerHold = false; };
  towerBtn.addEventListener('pointerup', tUp); towerBtn.addEventListener('pointercancel', tUp);
  const H = player.hero;
  const keys = ['J', 'Q', 'E', 'R'];
  H.skills.forEach((sk, i) => {
    const el = document.createElement('div');
    el.className = 'sb' + (i === 0 ? ' atk' : '');
    const c = document.createElement('canvas');
    c.width = c.height = 200;
    drawIcon(c, sk.icon, player.team);
    el.innerHTML = '';
    el.appendChild(c);
    el.insertAdjacentHTML('beforeend', `<div class="cdo"></div><div class="ring"></div><div class="cdt"></div><div class="lbl">${sk.name}</div><div class="key">${keys[i]}</div>`);
    $('hud').appendChild(el);
    const b = { el, cdo: el.querySelector('.cdo'), cdt: el.querySelector('.cdt'), last: -1, lastTxt: '', lastCool: null };
    btns.push(b);
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('press');
      hideTip();
      clearTimeout(tipTimer);
      // (the archer holds his attack to draw the bow: no note popping up over it)
      if (!(i === 0 && player && player.hero.weapon === 'bow')) tipTimer = setTimeout(() => showSkillTip(i, el), 450);
      if (i === 0) { if (player.hero.weapon === 'bow') { input.bowDraw = true; player.drawT = 0; return; } input.atkHold = true; cast(player, world, 0, null); return; }
      const sk = skillsOf(player)[i];
      if (sk.aim === 'hold') {
        input.hold = { i, id: e.pointerId, sx: e.clientX, sy: e.clientY, dir: null };
        const f = nearestFoe(1.2);
        startHold(player, world, i, f ? [f.x - player.x, f.y - player.y] : player.moving ? player.lastDir.slice() : [player.face, 0]);
        return;
      }
      input.aim = { i, id: e.pointerId, sx: e.clientX, sy: e.clientY, dir: null, frac: 1, moved: false, hot: false };
      if (sk.aim !== 'none') cancelEl.classList.add('show');
    });
    el.addEventListener('pointermove', (e) => {
      const h = input.hold;
      if (h && h.id === e.pointerId) {
        const dx = e.clientX - h.sx, dy = e.clientY - h.sy;
        if (Math.hypot(dx, dy) > 10) h.dir = [dx, dy / TILT];
        return;
      }
      const a = input.aim;
      if (!a || a.id !== e.pointerId) return;
      const sk = skillsOf(player)[i];
      const dx = e.clientX - a.sx, dy = e.clientY - a.sy, d = Math.hypot(dx, dy);
      if (d > 12) a.moved = true;
      if (a.moved && d > 4) { const wx = dx, wy = dy / TILT, L = Math.hypot(wx, wy); a.dir = [wx / L, wy / L]; a.frac = clamp(d / (cam.vh * 0.22), 0, 1); }
      const cr = cancelEl.getBoundingClientRect();
      a.hot = e.clientX > cr.left - 6 && e.clientX < cr.right + 6 && e.clientY > cr.top - 6 && e.clientY < cr.bottom + 6;
      cancelEl.classList.toggle('hot', a.hot);
    });
    const up = (e) => {
      el.classList.remove('press');
      clearTimeout(tipTimer); hideSkillTip();
      if (i === 0) { input.atkHold = false; if (input.bowDraw) { input.bowDraw = false; looseArrow(player, world); } return; }
      if (input.hold && input.hold.id === e.pointerId) { input.hold = null; endHold(player, i); return; }
      const a = input.aim;
      if (!a || a.id !== e.pointerId) return;
      input.aim = null;
      cancelEl.classList.remove('show', 'hot');
      if (a.hot || e.type === 'pointercancel') return;
      fireSkill(i, a.moved ? a.dir : null, a.moved ? a.frac : null);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
  layoutButtons();
}
// a tap with an enemy within 3 m: the skill goes straight at the nearest one (dodges still follow your walk)
const DODGES = { lowRoll: 1, starJump: 1, slide: 1, backflip: 1, step: 1, roll: 1, prone: 1 };
function nearestFoe(r) {
  let best = null, bd = r;
  for (const t of world.actors) { if (t.dead || t.team === player.team) continue; const d = Math.hypot(t.x - player.x, t.y - player.y); if (d < bd) { bd = d; best = t; } }
  if (!best) for (const t of world.dummies) { const d = Math.hypot(t.x - player.x, t.y - player.y); if (d < bd) { bd = d; best = t; } }
  return best;
}
// hold a skill button: a little note on what it does
let tipTimer = 0;
function showSkillTip(i, el) {
  if (!player) return;
  const sk = skillsOf(player)[i];
  const t = $('skTip');
  const bits = [];
  if (i > 0 && sk.cd) bits.push('คูลดาวน์ ' + sk.cd + ' วิ');
  if (sk.range && i > 0) bits.push('ระยะ ' + Math.round(sk.range / 0.4) + ' เมตร');
  const desc = sk.desc || (i === 0 ? 'โจมตีปกติ เล็งศัตรูที่ใกล้ที่สุดให้เอง กดค้างเพื่อโจมตีต่อเนื่อง' : '');
  t.innerHTML = '<b>' + sk.name + '</b>' + (bits.length ? '<i>' + bits.join(' · ') + '</i>' : '') + '<span>' + desc + '</span>';
  t.classList.add('show');
  const r = el.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
  t.style.left = clamp(r.left + r.width / 2 - tw - 10, 8, cam.vw - tw - 8) + 'px';
  t.style.top = clamp(r.top - th - 8, 8, cam.vh - th - 8) + 'px';
}
function hideSkillTip() { const t = $('skTip'); if (t) t.classList.remove('show'); }
function fireSkill(i, dir, frac) {
  const sk = skillsOf(player)[i];
  if (!dir && !DODGES[sk.act]) {
    const f = nearestFoe(1.2);
    if (f) {
      const d = Math.hypot(f.x - player.x, f.y - player.y);
      dir = [f.x - player.x, f.y - player.y];
      frac = clamp((d + (sk.aim === 'point' ? -0.1 : 0.25)) / (sk.range || 1), 0.2, 1);
    }
  }
  if (!dir && sk.aim === 'point') {
    // a tap: jump on the nearest dummy in range, otherwise as far as it goes the way you're heading
    let best = null, bd = sk.range;
    for (const d of world.dummies) { const dd = Math.hypot(d.x - player.x, d.y - player.y); if (dd < bd && dd > 0.3) { bd = dd; best = d; } }
    if (best) { dir = [best.x - player.x, best.y - player.y]; frac = (bd - 0.25) / sk.range; }
  }
  cast(player, world, i, dir, frac == null ? 1 : frac);
}
function layoutButtons() {
  if (!btns.length) return;
  const A = clamp(cam.vh * 0.2, 68, 98), S = Math.round(A * 0.68);
  const sar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sar')) || 0;
  const sab = Math.max(0, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0);
  // the skill cluster sits a little up and to the left, leaving the corner for the tower button
  const T = Math.round(S * 0.84);
  const cx = cam.vw - sar - 22 - A / 2 - S * 0.62, cy = cam.vh - 24 - A / 2 - sab - S * 0.4;
  if (towerBtn) Object.assign(towerBtn.style, { width: T + 'px', height: T + 'px', left: cam.vw - sar - 12 - T + 'px', top: cam.vh - sab - 14 - T + 'px' });
  const R = A / 2 + S / 2 + 24;
  const angs = [180, 229, 276];
  btns.forEach((b, i) => {
    const size = i === 0 ? A : S;
    let x = cx, y = cy;
    if (i) { const a = (angs[i - 1] * Math.PI) / 180; x = cx + Math.cos(a) * R; y = cy + Math.sin(a) * R; }
    Object.assign(b.el.style, { width: size + 'px', height: size + 'px', left: x - size / 2 + 'px', top: y - size / 2 + 'px' });
  });
  const cs = 78;
  Object.assign(cancelEl.style, { left: cx - R * 0.15 - cs / 2 + 'px', top: Math.max(60, cy - R - S - 34) - cs / 2 + 'px' });
}
function updateButtons() {
  btns.forEach((b, i) => {
    const sk = skillsOf(player)[i];
    if (b.sk !== sk) {
      if (b.sk) { drawIcon(b.el.querySelector('canvas'), sk.icon, player.team); b.el.querySelector('.lbl').textContent = sk.name; }
      b.el.classList.toggle('alt', SPEAR_ALT.includes(sk) && i > 0);
      b.sk = sk;
    }
    const cd = cdsOf(player)[i];
    const p = cd > 0 ? cd / sk.cd : 0;
    const blocked = !skillReady(player, i) && cd <= 0 && !(player.act && i === 0);
    const q = Math.round(p * 100) / 100;
    if (q !== b.last) { b.cdo.style.setProperty('--p', q); b.last = q; }
    let txt = cd > 0 && i > 0 ? (cd < 1 ? cd.toFixed(1) : String(Math.ceil(cd))) : '';
    if (sk.act === 'throwSpear' && player.spearOut) txt = 'เก็บ';
    if (sk.act === 'leap' && player.axeOut && cd <= 0) txt = 'เก็บ';
    if (sk.act === 'guard' && player.shieldBroken) txt = player.delivery ? String(Math.max(1, Math.ceil(7 - player.delivery.t))) : 'ฐาน';
    if (txt !== b.lastTxt) { b.cdt.textContent = txt; b.lastTxt = txt; }
    const cool = cd > 0 || blocked;
    if (cool !== b.lastCool) { b.el.classList.toggle('cool', cool); b.lastCool = cool; }
  });
}

// keyboard and mouse (desktop)
const KEYMAP = { j: 0, ' ': 0, q: 1, u: 1, 1: 1, e: 2, i: 2, 2: 2, r: 3, o: 3, 3: 3 };
window.addEventListener('pointerdown', () => SFX.unlock(), true);
window.addEventListener('keydown', (e) => {
  SFX.unlock();
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (state !== 'game') {
    const open = !$('mapPick').classList.contains('hidden'), gopen = !$('gfxPick').classList.contains('hidden');
    if (gopen) { if (e.key === 'Enter') pickGfx(gfx); else if (e.key === 'Escape') { $('gfxPick').classList.add('hidden'); openMapPick(); } else if (e.key >= '1' && e.key <= '4') pickGfx(+e.key - 1); return; }
    if (e.key === 'Enter') { if (open) pickMap(mapKind); else openMapPick(); }
    else if (open && e.key === 'Escape') closeMapPick();
    else if (open && (e.key === '1' || e.key === '3')) pickMap(e.key === '3' ? 'big' : 'lane');
    return;
  }
  document.body.classList.add('kb');
  if (!tipKb) setTip(true);
  input.keys.add(k);
  if (!e.repeat && player.pend > 0) { const u = UPS.find((x) => x.key.toLowerCase() === k); if (u) chooseUp(u.id); }
  if (e.key === 'Tab') { e.preventDefault(); if (!e.repeat) toggleStats(); }
  if (k === 't' && !e.repeat) { input.towerHold = true; towerTap(); }
  if (k in KEYMAP && !e.repeat) {
    const i = KEYMAP[k];
    if (i === 0) { if (player.hero.weapon === 'bow') { input.bowDraw = true; player.drawT = 0; } else { input.atkHold = true; cast(player, world, 0, null); } }
    else {
      const sk = skillsOf(player)[i];
      if (sk.aim === 'hold') { input.hold = { i, id: 'key:' + k, key: k, dir: null, mouse: input.mouse.has }; startHold(player, world, i, [player.face, 0]); }
      else if (sk.aim === 'none' || !input.mouse.has) fireSkill(i, null, null);
      else if (!input.aim) { input.aim = { i, id: 'key:' + k, key: k, dir: null, frac: 1, moved: true, hot: false, mouse: true }; mouseAim(); }
    }
  }
  if (e.key === 'Escape') backToMenu();
  if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  input.keys.delete(k);
  if (k === 't') input.towerHold = false;
  if (KEYMAP[k] === 0) { input.atkHold = false; if (input.bowDraw && state === 'game') { input.bowDraw = false; looseArrow(player, world); } }
  if (input.hold && input.hold.key === k && state === 'game') { endHold(player, input.hold.i); input.hold = null; }
  const a = input.aim;
  if (a && a.key === k && state === 'game') { mouseAim(); input.aim = null; fireSkill(a.i, a.dir, a.frac); }
});
window.addEventListener('blur', () => { input.keys.clear(); input.atkHold = false; });
cv.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { input.mouse.x = e.clientX; input.mouse.y = e.clientY; input.mouse.has = true; } });
document.addEventListener('contextmenu', (e) => e.preventDefault());

function mouseAim() {
  const a = input.aim;
  if (!a || !a.mouse || !player) return;
  const sk = skillsOf(player)[a.i];
  const [mx, my] = s2w(input.mouse.x, input.mouse.y);
  const dx = mx - player.x, dy = my - player.y, L = Math.hypot(dx, dy) || 1;
  a.dir = [dx / L, dy / L];
  a.frac = clamp(L / (sk.range || 1), 0, 1);
}
function moveVector() {
  let x = 0, y = 0;
  const K = input.keys;
  if (K.has('a') || K.has('ArrowLeft')) x -= 1;
  if (K.has('d') || K.has('ArrowRight')) x += 1;
  if (K.has('w') || K.has('ArrowUp')) y -= 1;
  if (K.has('s') || K.has('ArrowDown')) y += 1;
  if (!x && !y) { x = input.joy.dx; y = input.joy.dy; }
  const mag = Math.min(1, Math.hypot(x, y));
  if (mag < 0.01) return [0, 0];
  const wx = x, wy = y / TILT, L = Math.hypot(wx, wy);
  return [(wx / L) * mag, (wy / L) * mag];
}

// ---------- tips ----------
let tipT = 0, tipKb = false;
function setTip(kb) {
  tipKb = kb;
  $('tip').innerHTML = kb ? 'WASD / ลูกศร = เดิน · J หรือ Space = โจมตี · Q E R = สกิล (เล็งตามเมาส์) · Esc = กลับ' : 'ลากด้านซ้ายเพื่อเดิน · ปุ่มใหญ่ = โจมตี (กดค้างได้) · ลากปุ่มสกิลเพื่อเล็ง ปล่อยที่ "ยกเลิก" เพื่อยกเลิก';
  $('tip').style.opacity = 1;
  tipT = 7;
}
function hideTip() { tipT = Math.min(tipT, 1.2); }

// ---------- start / back ----------
function startGame() {
  state = 'game';
  world.proj = []; world.fx = []; world.floaters = [];
  world.score = { red: 0, blue: 0 };
  world.feed = [];
  world.villagers = [];
  const sp = world.spawns[selTeam];
  player = makeActor(selHero, selTeam, sp.x, sp.y);
  player.isPlayer = true;
  player.face = selTeam === 'red' ? 1 : -1;
  world.actors = [player];
  world.lights = [];
  world.clock = 0; lastClock = -1; lastChip = ''; lvlKey = ''; statsOpen = false; input.mapLook = null;
  $('statsP').classList.add('hidden'); closePack(); lvlHold = 0; $('sparkle').innerHTML = ''; $('score').classList.remove('on');
  resetCreeps(world);
  const counts = { red: 0, blue: 0 };
  for (const b of botsCfg) {
    const team = b.side === 'ally' ? selTeam : otherTeam(selTeam);
    const n = ++counts[team], base = world.spawns[team];
    const ang = n * 2.1;
    const q = navNearest(base.x + Math.cos(ang) * 0.55, base.y + Math.sin(ang) * 0.45);
    const bot = makeBot(b.hero, team, q.x, q.y);
    bot.face = team === 'red' ? 1 : -1;
    bot.spawnShield = 1.5;
    world.actors.push(bot);
  }
  feedEls.length = 0; $('feed').innerHTML = '';
  cam.x = player.x; cam.y = player.y; cam.U = cam.baseU;
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('chipN').textContent = player.hero.name;
  $('chipT').textContent = TEAM[selTeam].name;
  portrait($('chipC'), selHero, selTeam);
  buildButtons();
  setTip(document.body.classList.contains('kb'));
  addFloater(world, player.x, player.y - 0.7, 'ลงสนาม!', '#f2d27a', 1.3);
  addFx(world, { k: 'ring', x: player.x, y: player.y, t: 0, dur: 0.6, r: 0.8, col: TEAM[selTeam].main === '#c23a2a' ? '255,120,100' : '120,170,255' });
}
function backToMenu() {
  state = 'menu';
  player = null;
  input.hold = null;
  world.villagers = [];
  world.actors = [];
  world.proj = [];
  cam.U = cam.baseU;
  $('dead').classList.add('hidden');
  toggleStats(false); closePack(); lvlKey = ''; input.mapLook = null; input.towerHold = false;
  input.aim = null; input.atkHold = false; input.bowDraw = false; input.joy.id = null; input.joy.dx = input.joy.dy = 0;
  cancelEl.classList.remove('show', 'hot');
  $('hud').classList.add('hidden');
  $('menu').classList.remove('hidden');
  resetPreview();
}
$('go').onclick = openMapPick;
// "ลงสนาม" asks first: the big three-lane field or the small one-lane strip
const mapThumbs = {};
function drawMapThumb(kind) {
  if (mapThumbs[kind]) return mapThumbs[kind];
  const other = kind !== mapKind, w = other ? makeWorld(7303, kind) : world;
  const cw = 520, ch = Math.round((cw * w.H) / w.W);
  // (the minimap is painted from the ground cache, which belongs to the map in play: paint the other map's for a moment)
  const keep = featCache;
  if (other || !featCache) buildFeatures(w);
  const c = buildMinimap(w, cw, ch), g = c.getContext('2d'), sx = cw / w.W, sy = ch / w.H;
  featCache = keep;
  for (const t of w.towers) { g.fillStyle = '#1a1208'; g.fillRect(t.x * sx - 8, t.y * sy - 8, 16, 16); g.fillStyle = t.team === 'red' ? '#e05a46' : '#5a92ee'; g.fillRect(t.x * sx - 5.5, t.y * sy - 5.5, 11, 11); }
  for (const team of ['red', 'blue']) { const s = w.spawns[team]; g.beginPath(); g.arc(s.x * sx, s.y * sy, 11, 0, TAU); g.fillStyle = team === 'red' ? '#e05a46' : '#5a92ee'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#fff'; g.stroke(); }
  return (mapThumbs[kind] = c);
}
function openMapPick() {
  if (state !== 'menu') return;
  const el = $('mapPick');
  el.classList.remove('hidden');
  el.querySelectorAll('.mp').forEach((b) => {
    b.classList.toggle('last', b.dataset.map === mapKind);
    const cv2 = b.querySelector('canvas');
    if (!cv2.width || cv2.dataset.done !== '1') { const t = drawMapThumb(b.dataset.map); cv2.width = t.width; cv2.height = t.height; cv2.getContext('2d').drawImage(t, 0, 0); cv2.dataset.done = '1'; }
  });
}
function closeMapPick() { $('mapPick').classList.add('hidden'); }
function pickMap(kind) {
  if (state !== 'menu') return;
  closeMapPick();
  if (kind !== mapKind) setMap(kind);
  openGfxPick();
}
// then the graphics, four big buttons, each with a line or two on what it costs
function gfxIcon(cv2, i) {
  const g = cv2.getContext('2d'), n = cv2.width;
  g.clearRect(0, 0, n, n);
  // a little landscape: sky, sun, hill, a palm; drawn coarser the lower the setting
  const cell = [1, 2, 4, 12][i], m = n / cell;
  const t = document.createElement('canvas'); t.width = t.height = Math.round(m); const q = t.getContext('2d'); q.scale(m / n, m / n);
  const sky = q.createLinearGradient(0, 0, 0, n); sky.addColorStop(0, '#5aa0d8'); sky.addColorStop(1, '#cfe6f0');
  q.fillStyle = sky; q.fillRect(0, 0, n, n);
  q.fillStyle = '#ffd35a'; q.beginPath(); q.arc(n * 0.72, n * 0.3, n * 0.13, 0, TAU); q.fill();
  q.fillStyle = '#5a8a3a'; q.beginPath(); q.moveTo(0, n * 0.75); q.quadraticCurveTo(n * 0.4, n * 0.48, n, n * 0.7); q.lineTo(n, n); q.lineTo(0, n); q.fill();
  q.fillStyle = '#3e6a2a'; q.fillRect(0, n * 0.86, n, n * 0.14);
  q.strokeStyle = '#7a5530'; q.lineWidth = n * 0.04; q.beginPath(); q.moveTo(n * 0.3, n * 0.86); q.quadraticCurveTo(n * 0.33, n * 0.6, n * 0.28, n * 0.38); q.stroke();
  q.strokeStyle = '#2f7a2a'; q.lineWidth = n * 0.035; q.lineCap = 'round';
  for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.55; q.beginPath(); q.moveTo(n * 0.28, n * 0.38); q.quadraticCurveTo(n * 0.28 + Math.cos(a) * n * 0.16, n * 0.38 + Math.sin(a) * n * 0.1, n * 0.28 + Math.cos(a) * n * 0.24, n * 0.38 + Math.sin(a) * n * 0.05 + n * 0.08); q.stroke(); }
  g.imageSmoothingEnabled = i < 3; g.drawImage(t, 0, 0, n, n);
  g.save(); g.globalCompositeOperation = 'destination-in'; g.beginPath(); g.arc(n / 2, n / 2, n / 2 - 1, 0, TAU); g.fill(); g.restore();
}
function openGfxPick() {
  const el = $('gfxPick');
  el.classList.remove('hidden');
  el.querySelectorAll('.mp').forEach((b) => { const i = +b.dataset.g; b.classList.toggle('last', i === gfx); gfxIcon(b.querySelector('canvas'), i); });
}
function pickGfx(i) {
  if (state !== 'menu') return;
  $('gfxPick').classList.add('hidden');
  if (i !== gfx) { gfx = i; try { localStorage.setItem('sb_gfx', gfx); } catch (e) { /* no storage */ } fogCv = tinyCv = null; resize(); showGfx(); }
  startGame();
}
$('gfxPick').querySelectorAll('.mp').forEach((b) => { b.onclick = () => pickGfx(+b.dataset.g); });
$('gfxPick').querySelector('.cancel').onclick = () => { $('gfxPick').classList.add('hidden'); openMapPick(); };
$('ver').textContent = 'เวอร์ชัน ' + GAME_VERSION;
$('mapPick').querySelectorAll('.mp').forEach((b) => { b.onclick = () => pickMap(b.dataset.map); });
$('mapPick').querySelector('.cancel').onclick = closeMapPick;
$('back').onclick = backToMenu;

// ---------- rendering the field ----------
function drawAim(g) {
  const a = input.aim;
  if (!a || !player) return;
  const sk = skillsOf(player)[a.i];
  worldTransform(g);
  const x = player.x, y = player.y;
  let dir = a.dir;
  if (!dir) dir = sk.aim === 'point' ? null : player.moving ? player.lastDir : [player.face, 0];
  g.lineWidth = 0.025;
  const ring = (r, fillA) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = `rgba(255,236,190,${fillA})`; g.fill(); g.strokeStyle = 'rgba(255,236,190,0.55)'; g.stroke(); };
  if (sk.aim === 'dir') {
    ring(sk.range, 0.05);
    const ang = Math.atan2(dir[1], dir[0]);
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    if (sk.act === 'sweep') {
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 0.95, -1.3, 1.3); g.closePath();
      g.fillStyle = 'rgba(255,220,150,0.28)'; g.fill(); g.strokeStyle = 'rgba(255,236,190,0.8)'; g.stroke();
    } else {
      const L = sk.range, wd = sk.act === 'volley' ? 0 : 0.3;
      if (sk.act === 'volley') {
        const hot = !!volleyTarget(player, world, dir, sk.range);
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, L, -0.24, 0.24); g.closePath();
        g.fillStyle = hot ? 'rgba(255,90,70,0.3)' : 'rgba(255,220,150,0.25)'; g.fill(); g.strokeStyle = hot ? 'rgba(255,120,100,0.95)' : 'rgba(255,236,190,0.8)'; g.stroke();
      } else {
        const grd = g.createLinearGradient(0, 0, L, 0);
        grd.addColorStop(0, 'rgba(255,220,150,0.35)');
        grd.addColorStop(1, 'rgba(255,220,150,0.12)');
        g.fillStyle = grd;
        g.fillRect(0.1, -wd / 2, L - 0.3, wd);
        g.strokeStyle = 'rgba(255,236,190,0.8)';
        g.strokeRect(0.1, -wd / 2, L - 0.3, wd);
        g.beginPath(); g.moveTo(L - 0.3, -wd * 0.95); g.lineTo(L, 0); g.lineTo(L - 0.3, wd * 0.95); g.closePath();
        g.fillStyle = 'rgba(255,236,190,0.7)'; g.fill();
      }
    }
    g.restore();
  } else if (sk.aim === 'point') {
    ring(sk.range, 0.06);
    let tx, ty;
    if (dir) { tx = x + dir[0] * sk.range * a.frac; ty = y + dir[1] * sk.range * a.frac; }
    else { tx = x + player.face * sk.range * 0.8; ty = y; }
    if (sk.act === 'leap') {
      // the blast ring (2.5 m) and, inside it, the small ring where a man is seized
      const hot = world.actors.some((t) => !t.dead && t.team !== player.team && Math.hypot(t.x - tx, t.y - ty) <= LEAP_CORE);
      const grd = g.createRadialGradient(tx, ty, 0, tx, ty, LEAP_R);
      grd.addColorStop(0, 'rgba(255,150,70,0.42)'); grd.addColorStop(1, 'rgba(255,190,110,0.1)');
      g.beginPath(); g.arc(tx, ty, LEAP_R, 0, TAU); g.fillStyle = grd; g.fill(); g.strokeStyle = 'rgba(255,236,190,0.95)'; g.lineWidth = 0.035; g.stroke();
      g.beginPath(); g.arc(tx, ty, LEAP_CORE, 0, TAU); g.fillStyle = hot ? 'rgba(255,70,50,0.5)' : 'rgba(255,120,70,0.28)'; g.fill();
      g.strokeStyle = hot ? 'rgba(255,90,70,1)' : 'rgba(255,200,150,0.95)'; g.lineWidth = 0.03; g.stroke();
      g.beginPath(); g.moveTo(tx - 0.12, ty); g.lineTo(tx + 0.12, ty); g.moveTo(tx, ty - 0.12); g.lineTo(tx, ty + 0.12); g.stroke();
      g.lineWidth = 0.025; g.strokeStyle = 'rgba(255,236,190,0.55)';
    } else {
    g.beginPath(); g.arc(tx, ty, 0.42, 0, TAU);
    g.fillStyle = 'rgba(255,190,110,0.3)'; g.fill(); g.strokeStyle = 'rgba(255,236,190,0.9)'; g.stroke();
    }
    g.setLineDash([0.08, 0.06]);
    g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.stroke();
    g.setLineDash([]);
  } else {
    ring(sk.range || 0.5, 0.14);
  }
}
let miniTick = 0;
function drawMini() {
  const DPR = MINI_DPR; // the minimap keeps at least one pixel per point, whatever the field is drawn at
  if (!miniBg || !player) return;
  if ((miniTick = (miniTick + 1) % 2)) return;
  const g = mg, sx = mini.width / world.W, sy = mini.height / world.H;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(miniBg, 0, 0);
  g.strokeStyle = 'rgba(255,240,200,0.75)';
  g.lineWidth = DPR;
  const vw = cam.vw / cam.U, vh = cam.vh / (cam.U * TILT);
  g.strokeRect((cam.x - vw / 2) * sx, (cam.y - vh / 2) * sy, vw * sx, vh * sy);
  g.fillStyle = '#e8d090';
  for (const d of world.dummies) { g.beginPath(); g.arc(d.x * sx, d.y * sy, 2 * DPR, 0, TAU); g.fill(); }
  for (const tm of ['red', 'blue']) { const s2 = world.spawns[tm]; g.strokeStyle = tm === 'red' ? 'rgba(255,130,110,0.8)' : 'rgba(130,170,255,0.8)'; g.lineWidth = 1.2 * DPR; g.beginPath(); g.arc(s2.x * sx, s2.y * sy, 1.1 * sx, 0, TAU); g.stroke(); }
  if (player.axeOut) for (const p of myAxes(world, player)) { if (p.hidden) continue; g.fillStyle = '#ffd94a'; g.strokeStyle = INK; g.lineWidth = DPR; g.beginPath(); g.moveTo(p.x * sx, p.y * sy - 5 * DPR); g.lineTo(p.x * sx + 4 * DPR, p.y * sy); g.lineTo(p.x * sx, p.y * sy + 5 * DPR); g.lineTo(p.x * sx - 4 * DPR, p.y * sy); g.closePath(); g.fill(); g.stroke(); }
  if (player.spearOut) { const p = myJavelin(world, player); if (p) { g.fillStyle = '#f2d27a'; g.strokeStyle = INK; g.lineWidth = DPR; g.beginPath(); g.moveTo(p.x * sx, p.y * sy - 5 * DPR); g.lineTo(p.x * sx + 4 * DPR, p.y * sy); g.lineTo(p.x * sx, p.y * sy + 5 * DPR); g.lineTo(p.x * sx - 4 * DPR, p.y * sy); g.closePath(); g.fill(); g.stroke(); } }
  const VSm = visionSources(world, player);
  for (const l of world.lights || []) { const f = clamp((l.dur - l.t) / 1.5, 0, 1); g.fillStyle = `rgba(255,170,60,${0.3 * f})`; g.beginPath(); g.arc(l.x * sx, l.y * sy, LIGHT_R * sx, 0, TAU); g.fill(); g.fillStyle = `rgba(255,220,120,${f})`; g.beginPath(); g.arc(l.x * sx, l.y * sy, 1.6 * DPR, 0, TAU); g.fill(); }
  for (const a of world.actors.slice().sort((p, q) => (q.creep ? 1 : 0) - (p.creep ? 1 : 0))) {
    if (a.dead) continue;
    if (a.team !== player.team && seenAmt(VSm, a.x, a.y) < 0.5) continue;
    g.fillStyle = TEAM[a.team].main;
    g.strokeStyle = a.isPlayer ? '#fff' : 'rgba(10,6,2,0.9)';
    g.lineWidth = (a.isPlayer ? 1.6 : a.creep ? 0.6 : 1) * DPR;
    g.beginPath(); g.arc(a.x * sx, a.y * sy, (a.isPlayer ? 4 : a.creep ? 1.6 : 3.2) * DPR, 0, TAU); g.fill(); g.stroke();
  }
}
function renderField(w, pl) {
  const g = ctx;
  const k = cam.U;
  drawGround(g, w);
  const vis = (x, y, up = 3.2, side = 1.6) => { const [sx, sy] = w2s(x, y); return sx > -side * k && sx < cam.vw + side * k && sy > -0.4 * k && sy < cam.vh + up * k * TILT + up * k ? [sx, sy] : null; };
  // the river: what stands by it, mirrored under the surface, then the moving surface over that
  screenTransform(g);
  if (GFX[gfx].refl) drawRiverReflections(g, w, k, vis);
  worldTransform(g);
  { const [x0, y0] = s2w(0, 0), [x1, y1] = s2w(cam.vw, cam.vh); drawRiverSurface(g, w, x0, y0, x1, y1); }
  if (pl) drawAim(g);
  screenTransform(g);
  drawTufts(g, w);
  drawGroundFx(g, w, k);
  if (pl) drawLockGround(g, pl, k);
  const items = [];
  for (const t of w.towers || []) if (vis(t.x, t.y, 5, 4.5)) drawTowerRing(g, w, t, pl, k);
  const pp = pl ? w2s(pl.x, pl.y) : null;
  const ps = pl ? k * pl.hero.size : 0;
  const t = w.time;
  for (const b of w.bananas) {
    const s = vis(b.x, b.y, 2); if (!s) continue;
    const hide = pl && pl.y < b.y - 0.02 && Math.abs(pp[0] - s[0]) < 0.6 * k && pp[1] > s[1] - 1.4 * k ? 0.5 : 1;
    items.push({ y: b.y, f: () => drawBanana(g, b, s[0], s[1], k, hide, t) });
  }
  w.mangoes.forEach((m, i) => {
    const s = vis(m.x, m.y, 3.5, 2.2); if (!s) return;
    const sp = sprites.mango[i];
    const hide = pl && pl.y < m.y - 0.05 && Math.abs(pp[0] - s[0]) < sp.half * k && pp[1] > s[1] + sp.top * k && pp[1] - ps < s[1] + sp.crownBottom * k ? 0.45 : 1;
    const tremble = m.rustle * 0.035 * Math.sin(t * 38 + m.phase);
    const breeze = 0.006 * Math.sin(t * 0.9 + m.phase) + 0.004 * Math.sin(t * 2.3 + m.phase * 1.7);
    items.push({ y: m.y, f: () => drawSprite(g, sp, s[0], s[1], k, m.lean * 0.6 + breeze + tremble, 1 + m.rustle * 0.02 * Math.sin(t * 31 + m.phase), hide) });
  });
  w.palms.forEach((c) => {
    const s = vis(c.x, c.y, 3.6, 2.2); if (!s) return;
    const tp = palmTop(c), tx = s[0] + (tp.x - c.x) * k, ty = s[1] - tp.z * k;
    const hide = pl && pl.y < c.y && Math.abs(pp[0] - tx) < 1.1 * k && pp[1] < ty + 1.0 * k && pp[1] > ty - 0.3 * k ? 0.5 : 1;
    items.push({ y: c.y, f: () => drawPalm(g, c, s[0], s[1], k, hide, t) });
  });
  for (const t of w.towers || []) {
    const s = vis(t.x, t.y, 2.5, 4.5); if (!s) continue;
    const hide = !t.dead && pl && pl.y < t.y && Math.abs(pp[0] - s[0]) < 0.6 * k && pp[1] > s[1] - 2.0 * k ? 0.45 : 1;
    items.push({ y: t.y, f: () => drawTower(g, w, t, k, hide) });
  }
  // the old temple walls, length by length so people stand in front of and behind them properly
  for (const wl of w.walls || []) for (const pc of wallPieces(wl)) {
    const s = vis(pc.x, pc.y, 1.6, 1.2); if (!s) continue;
    const hide = pl && pl.y < pc.y + 0.05 && pl.y > pc.y - 1.4 && Math.abs(pp[0] - s[0]) < 0.45 * k && pp[1] > s[1] - (wl.h + 0.3) * k * 1.4 ? 0.5 : 1;
    items.push({ y: pc.y + 0.12, f: () => drawWallPiece(g, w, wl, pc, k, hide) });
  }
  w.huts.forEach((h) => {
    const s = vis(h.x, h.y, 2.5, 2); if (!s) return;
    const hide = !h.collapsed && pl && pl.y < h.y - 0.1 && Math.abs(pp[0] - s[0]) < 1.3 * k && pp[1] > s[1] - 1.9 * k ? 0.45 : 1;
    items.push({ y: h.y, f: () => drawHut(g, h, s[0], s[1], k, hide) });
  });
  for (const b of w.hutBits || []) { const s = vis(b.x, b.y, 1.5, 1.5); if (s) items.push({ y: b.y - (b.k === 'body' ? 0.4 : b.landed ? 0.15 : 0), f: () => drawHutBit(g, b, k) }); }
  for (const f of w.litter || []) { const s = vis(f.x, f.y, 1, 1); if (s) items.push({ y: f.y - (f.z > 0.02 ? 0 : 0.2), f: () => drawLitter(g, f, k) }); }
  for (const j of w.jars) { const s = vis(j.x, j.y, 0.5); if (s) items.push({ y: j.y, f: () => drawJar(g, j, s[0], s[1], k) }); }
  for (const tr of w.taros) { const s = vis(tr.x, tr.y, 0.4, 0.4); if (s) items.push({ y: tr.y, f: () => drawTaro(g, tr, s[0], s[1], k) }); }
  for (const gr of w.grass) { const s = vis(gr.x, gr.y, 0.4, 0.4); if (s) items.push({ y: gr.y, f: () => drawGrass(g, gr, s[0], s[1], k, t) }); }
  for (const d of w.dummies) { const s = vis(d.x, d.y, 0.8); if (s) items.push({ y: d.y, f: () => drawDummy(g, d, s[0], s[1], k, t) }); }
  for (const p of w.proj) items.push({ y: p.state === 'stuck' ? p.y + 0.03 : p.y, f: () => drawProj(g, p, k) });
  for (const v of w.villagers || []) { const s = vis(v.x, v.y, 1, 2.5); if (s) items.push({ y: v.y, f: () => drawVillager(g, v, k) }); }
  const heads = [];
  const VS = pl ? visionSources(w, pl) : null;
  for (const a of w.actors) {
    const s = vis(a.x, a.y, 1); if (!s) continue;
    // an enemy out of sight isn't drawn; at the edge of sight he fades in
    const seen = VS && a.team !== pl.team ? seenAmt(VS, a.x, a.y) : 1;
    if (seen <= 0.02) continue;
    items.push({ y: a.y - (a.dead ? 0.02 : 0), f: () => {
      if (a.isPlayer && !a.dead) { g.save(); g.strokeStyle = 'rgba(120,255,110,0.7)'; g.lineWidth = 2; g.beginPath(); g.ellipse(s[0], s[1], k * 0.17, k * 0.17 * TILT, 0, 0, TAU); g.stroke(); g.restore(); }
      if (seen < 1) { g.save(); g.globalAlpha *= seen; }
      const h = drawActor(g, a, k); if (h && seen > 0.5) heads.push([a, h]);
      if (seen < 1) g.restore();
    } });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.f();
  drawAirFx(g, w, k);
  if (pl) { drawVision(g, w, pl, k, VS); screenTransform(g); }
  // how far the bow is drawn: a yellow bar over the archer's head
  if (pl && input.bowDraw && !pl.dead && heads.some(([a]) => a === pl)) {
    const h = heads.find(([a]) => a === pl)[1], f = bowCharge(pl);
    const bw = 46, bh = 5, bx = h.x - bw / 2, by = h.y - h.s * 1.2 - 34;
    g.save();
    g.fillStyle = 'rgba(12,8,3,0.85)'; g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    g.fillStyle = f >= 1 ? `rgba(255,236,120,${0.85 + 0.15 * Math.sin(w.time * 18)})` : '#e8b830'; g.fillRect(bx, by, bw * f, bh);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(bx, by, bw * f, 1.5);
    if (f >= 1) { g.strokeStyle = 'rgba(255,240,170,0.9)'; g.lineWidth = 1.5; g.strokeRect(bx - 2, by - 2, bw + 4, bh + 4); }
    g.restore();
  }
  for (const [a, h] of heads) if (a.creep) drawCreepBar(g, a, h.x, h.y - h.s * 1.1); else drawNameplate(g, a, h.x, h.y - h.s * (a.hero.head === 'crown' ? 1.62 : a.hero.head === 'hat' ? 1.2 : a.hero.head === 'helm' ? 1.5 : 1.12), a.team, a.isPlayer ? a.hero.name : (a.team === (pl ? pl.team : 'red') ? 'เพื่อน · ' : 'ศัตรู · ') + a.hero.name);
  if (pl) drawLockTop(g, w, pl, k);
  drawFloaters(g, w, k);
  // axes thrown: a see-through yellow compass needle round your feet, pointing at each one
  if (pl && pl.axeOut && !pl.dead) {
    const [px, py] = w2s(pl.x, pl.y);
    for (const p of myAxes(w, pl)) {
      if (p.hidden) continue;
      const [ax, ay] = w2s(p.x, p.y);
      const ang = Math.atan2(ay - py, ax - px), far = Math.hypot(ax - px, ay - py);
      if (far < 34) continue;
      const R = Math.min(52, far - 18), bob = Math.sin(w.time * 5) * 2;
      g.save(); g.translate(px + Math.cos(ang) * (R + bob), py + Math.sin(ang) * (R + bob) * 0.8); g.rotate(ang);
      g.globalAlpha = 0.5;
      g.fillStyle = '#ffdc3c'; g.strokeStyle = 'rgba(60,40,0,0.9)'; g.lineWidth = 1.5; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(22, 0); g.lineTo(0, -9); g.lineTo(5, 0); g.lineTo(0, 9); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-14, 0); g.lineTo(0, -5); g.lineTo(3, 0); g.lineTo(0, 5); g.closePath(); g.fillStyle = '#fff3b0'; g.fill(); g.stroke();
      g.restore();
      // and a ring on the axe itself
      g.save(); g.globalAlpha = 0.5; g.strokeStyle = '#ffdc3c'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(ax, ay, 15 + bob, (15 + bob) * TILT, 0, 0, TAU); g.stroke(); g.restore();
    }
  }
  if (pl && pl.spearOut && pl.hero.weapon === 'spear') {
    const p = myJavelin(w, pl);
    if (p && p.state !== 'fly') {
      const [sx, sy] = w2s(p.x, p.y);
      const m = 40;
      if (sx < m || sy < m || sx > cam.vw - m || sy > cam.vh - m) {
        const [px, py] = w2s(pl.x, pl.y);
        const ang = Math.atan2(sy - py, sx - px);
        const ex = clamp(sx, m, cam.vw - m), ey = clamp(sy, m + 40, cam.vh - m);
        g.save(); g.translate(ex, ey); g.rotate(ang);
        g.fillStyle = '#f2d27a'; g.strokeStyle = INK; g.lineWidth = 2;
        g.beginPath(); g.moveTo(16, 0); g.lineTo(-8, -11); g.lineTo(-3, 0); g.lineTo(-8, 11); g.closePath(); g.fill(); g.stroke();
        g.restore();
        g.save(); g.font = '700 11px Kanit, "Noto Sans Thai", sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(10,6,2,0.85)';
        g.strokeText('หอก', ex - Math.cos(ang) * 24, ey - Math.sin(ang) * 24 + 4); g.fillStyle = '#ffe9a8'; g.fillText('หอก', ex - Math.cos(ang) * 24, ey - Math.sin(ang) * 24 + 4); g.restore();
      }
    }
  }
}

// ---------- sight: 10 m round you (and round your side's heroes), and wherever a fire arrow burns ----------
const VISION = 3.2, LIGHT_R = 3.2; // 8 m of sight
function visionSources(w, pl) {
  const out = [{ x: pl.x, y: pl.y, r: VISION }];
  for (const a of w.actors) if (a !== pl && !a.dead && !a.creep && a.team === pl.team) out.push({ x: a.x, y: a.y, r: VISION });
  for (const l of w.lights || []) out.push({ x: l.x, y: l.y, r: LIGHT_R * clamp(Math.min(l.t / 0.25, (l.dur - l.t) / 1.5), 0, 1), light: l });
  return out;
}
function seenAmt(src, x, y) {
  let best = 0;
  for (const s of src) { if (s.r <= 0) continue; const d = Math.hypot(x - s.x, y - s.y); const v = clamp(1 - (d - s.r) / (s.r * 0.25), 0, 1); if (v > best) { best = v; if (v >= 1) break; } }
  return best;
}
// beyond sight: the field goes soft and dark, a night-blue shadow and a thin mist over it
let fogCv = null, fogG = null, tinyCv = null, tinyG = null;
let fogTick = 0, fogFresh = true;
function drawVision(g, w, pl, k, VS) {
  const W = cv.width, H = cv.height;
  // the whole screen inside your own sight: no fog to draw, only the fire glow
  const [cx0, cy0] = s2w(0, 0), [cx1, cy1] = s2w(cam.vw, cam.vh);
  const R0 = VISION;
  const allIn = [[cx0, cy0], [cx1, cy0], [cx0, cy1], [cx1, cy1]].every(([x, y]) => Math.hypot(x - pl.x, y - pl.y) < R0);
  if (allIn) { drawFireGlow(g, k, VS, w.time); return; }
  const fw = Math.ceil(W / 3), fh = Math.ceil(H / 3), tw = Math.max(8, Math.ceil(W / 9)), th = Math.max(8, Math.ceil(H / 9));
  if (!fogCv || fogCv.width !== fw || fogCv.height !== fh) { fogCv = document.createElement('canvas'); fogCv.width = fw; fogCv.height = fh; fogG = fogCv.getContext('2d'); }
  if (!tinyCv || tinyCv.width !== tw || tinyCv.height !== th) { fogFresh = true; tinyCv = document.createElement('canvas'); tinyCv.width = tw; tinyCv.height = th; tinyG = tinyCv.getContext('2d'); }
  const blur = GFX[gfx].blur;
  // (the blurred copy of the field is the dear part: 'normal' refreshes it every other frame)
  fogTick++;
  if (blur && (gfx === 0 || fogTick % 2 === 0 || fogFresh)) { tinyG.imageSmoothingEnabled = true; tinyG.imageSmoothingQuality = 'medium'; tinyG.drawImage(cv, 0, 0, tw, th); fogFresh = false; }
  const f = fogG;
  f.setTransform(1, 0, 0, 1, 0, 0);
  f.globalCompositeOperation = 'source-over';
  f.imageSmoothingEnabled = true; f.imageSmoothingQuality = 'low';
  if (blur) f.drawImage(tinyCv, 0, 0, fw, fh); else f.clearRect(0, 0, fw, fh);
  // night
  f.fillStyle = blur ? 'rgba(10,16,38,0.6)' : 'rgba(8,13,32,0.7)'; f.fillRect(0, 0, fw, fh);
  // thin drifting mist, anchored to the ground so it slides as you walk
  const t = w.time, sc = (DPR * k) / 3;
  f.globalCompositeOperation = 'screen';
  for (let i = 0; i < 7; i++) {
    const wx = ((i * 7.3 + t * 0.12 * (1 + (i % 3) * 0.4)) % (w.W + 8)) - 4, wy = (i * 5.9 + Math.sin(t * 0.05 + i) * 2) % w.H;
    const sx = (cam.vw / 2 + (wx - cam.x) * k) * DPR / 3, sy = (cam.vh / 2 + (wy - cam.y) * k * TILT) * DPR / 3, R = (5 + (i % 3) * 2) * sc;
    const gr = f.createRadialGradient(sx, sy, 0, sx, sy, R); gr.addColorStop(0, 'rgba(120,132,160,0.22)'); gr.addColorStop(1, 'rgba(120,132,160,0)');
    f.fillStyle = gr; f.fillRect(sx - R, sy - R, R * 2, R * 2);
  }
  f.fillStyle = 'rgba(70,80,104,0.12)'; f.fillRect(0, 0, fw, fh);
  // cut the sight holes: clear inside, fading out past the edge
  f.globalCompositeOperation = 'destination-out';
  for (const s of VS) {
    if (s.r <= 0) continue;
    const sx = (cam.vw / 2 + (s.x - cam.x) * k) * DPR / 3, sy = (cam.vh / 2 + (s.y - cam.y) * k * TILT) * DPR / 3;
    const flick = s.light ? 1 + 0.03 * Math.sin(t * 13 + s.light.seed) + 0.02 * Math.sin(t * 29 + s.light.seed * 2) : 1;
    const R = s.r * 1.4 * sc * flick;
    if (sx < -R || sy < -R * TILT || sx > fw + R || sy > fh + R * TILT) continue;
    f.save(); f.translate(sx, sy); f.scale(1, TILT);
    const gr = f.createRadialGradient(0, 0, 0, 0, 0, R);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1 / 1.4, 'rgba(0,0,0,1)'); gr.addColorStop(0.86, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = gr; f.beginPath(); f.arc(0, 0, R, 0, TAU); f.fill();
    f.restore();
  }
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(fogCv, 0, 0, W, H);
  g.restore();
  drawFireGlow(g, k, VS, t);
}
// the fire arrows' warm glow on the ground
function drawFireGlow(g, k, VS, t) {
  if (!VS.some((s) => s.light)) return;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'lighter';
  for (const s of VS) {
    if (!s.light || s.r <= 0) continue;
    const sx = (cam.vw / 2 + (s.x - cam.x) * k) * DPR, sy = (cam.vh / 2 + (s.y - cam.y) * k * TILT) * DPR, R = s.r * k * DPR;
    g.save(); g.translate(sx, sy); g.scale(1, TILT);
    const a = 0.16 + 0.03 * Math.sin(t * 17 + s.light.seed);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
    gr.addColorStop(0, `rgba(255,150,60,${a * 1.6})`); gr.addColorStop(0.35, `rgba(255,120,40,${a})`); gr.addColorStop(1, 'rgba(255,100,30,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.restore();
  }
  g.restore();
}

// ---------- lock-on marks ----------
// on the ground round your feet: a red ring that tightens and spins, with a tick toward each threat
function drawLockGround(g, pl, k) {
  const A = pl.warnA || 0;
  if (A <= 0 || pl.dead) return;
  const [x, y] = w2s(pl.x, pl.y);
  const t = performance.now() / 1000;
  const pulse = 0.5 + 0.5 * Math.sin(t * 16);
  const R = k * (0.34 + (1 - A) * 0.2 + 0.015 * pulse);
  g.save();
  g.translate(x, y); g.scale(1, TILT);
  g.globalAlpha = A;
  const grd = g.createRadialGradient(0, 0, R * 0.3, 0, 0, R * 1.1);
  grd.addColorStop(0, 'rgba(255,40,30,0)'); grd.addColorStop(0.75, `rgba(255,40,30,${0.12 + 0.1 * pulse})`); grd.addColorStop(1, 'rgba(255,40,30,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(0, 0, R * 1.1, 0, TAU); g.fill();
  g.strokeStyle = `rgba(255,${60 + 50 * pulse},50,0.95)`;
  g.lineWidth = Math.max(2, k * 0.028);
  for (let i = 0; i < 4; i++) { const a0 = t * 2.4 + (i * TAU) / 4; g.beginPath(); g.arc(0, 0, R, a0, a0 + 1.05); g.stroke(); }
  g.lineWidth = Math.max(1, k * 0.012);
  g.strokeStyle = 'rgba(255,90,70,0.7)';
  g.beginPath(); g.arc(0, 0, R * 0.78, 0, TAU); g.stroke();
  // a chevron on the ring pointing at whatever has you
  g.fillStyle = 'rgba(255,70,50,0.95)';
  for (const src of pl.warnSrc || []) {
    const ang = Math.atan2(src.y - pl.y, src.x - pl.x);
    g.save(); g.rotate(ang); g.translate(R * 1.18, 0);
    g.beginPath(); g.moveTo(k * 0.09, 0); g.lineTo(-k * 0.03, -k * 0.07); g.lineTo(0, 0); g.lineTo(-k * 0.03, k * 0.07); g.closePath(); g.fill();
    g.restore();
  }
  g.restore();
}
function lockBrackets(g, x, y, w, h, col, lw, spin = 0) {
  const c = Math.min(w, h) * 0.32;
  g.save(); g.translate(x, y); if (spin) g.rotate(spin);
  g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round';
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    g.beginPath(); g.moveTo(sx * w / 2, sy * h / 2 - sy * c); g.lineTo(sx * w / 2, sy * h / 2); g.lineTo(sx * w / 2 - sx * c, sy * h / 2); g.stroke();
  }
  g.restore();
}
function drawLockTop(g, w, pl, k) {
  const now = performance.now() / 1000;
  // you're locked: red brackets close in round your body
  const A = pl.warnA || 0;
  if (A > 0 && !pl.dead) {
    const [x, y] = w2s(pl.x, pl.y);
    const s = k * pl.hero.size, sq = 1 + (1 - A) * 0.6;
    g.save(); g.globalAlpha = A;
    lockBrackets(g, x, y - s * 0.55, s * 1.25 * sq, s * 1.45 * sq, 'rgba(255,60,45,0.95)', Math.max(2, k * 0.022));
    g.font = '800 ' + Math.round(Math.max(13, k * 0.16)) + 'px Kanit, "Noto Sans Thai", sans-serif'; g.textAlign = 'center';
    const ty = y - s * 1.45 - 26;
    g.lineWidth = 3; g.strokeStyle = 'rgba(30,0,0,0.85)'; g.strokeText('!', x + s * 0.7, ty + 18);
    g.fillStyle = `rgba(255,${80 + 80 * (0.5 + 0.5 * Math.sin(now * 16))},60,1)`; g.fillText('!', x + s * 0.7, ty + 18);
    g.restore();
  }
  // the archer's volley: the mark on whoever the fan has touched (while you aim, and while the arrows fly)
  let T = null, live = false;
  const am = input.aim;
  if (am && !pl.dead) { const sk = skillsOf(pl)[am.i]; if (sk.act === 'volley') T = volleyTarget(pl, w, am.dir || (pl.moving ? pl.lastDir : [pl.face, 0]), sk.range); }
  if (pl.act && pl.act.k === 'volley' && pl.act.lockT && !pl.act.lockT.dead) { T = pl.act.lockT; live = true; }
  const marks = !T ? [] : live ? pl.act.targets.filter((t) => !t.dead) : volleyPack(pl, w, T);
  for (const T of marks) {
    const [x, y] = w2s(T.x, T.y);
    const s = k * (T.hero ? T.hero.size : 0.34);
    const cy = y - s * 0.55;
    g.save();
    lockBrackets(g, x, cy, s * 1.2, s * 1.2, live ? 'rgba(255,70,50,1)' : 'rgba(255,220,120,0.95)', Math.max(2, k * 0.022), now * (live ? 4 : 1.5));
    g.strokeStyle = live ? 'rgba(255,70,50,0.9)' : 'rgba(255,220,120,0.8)'; g.lineWidth = Math.max(1.5, k * 0.012);
    g.beginPath(); g.arc(x, cy, s * 0.32, 0, TAU); g.stroke();
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; g.beginPath(); g.moveTo(x + Math.cos(a) * s * 0.18, cy + Math.sin(a) * s * 0.18); g.lineTo(x + Math.cos(a) * s * 0.46, cy + Math.sin(a) * s * 0.46); g.stroke(); }
    g.restore();
  }
}

// ---------- score, kill feed, death ----------
const feedEls = [];
const camLook = [0, 0];
const camHold = { t: 0, U: 0, lx: 0, ly: 0 };
let lastScore = '';
function updateHud(dt) {
  const sc = world.score.red + ':' + world.score.blue;
  if (sc !== lastScore) { $('scR').textContent = world.score.red; $('scB').textContent = world.score.blue; lastScore = sc; }
  while (world.feed.length) {
    const f = world.feed.shift();
    const el = document.createElement('div');
    el.innerHTML = `<span class="${f.kt === 'red' ? 'r' : 'b'}${f.kp ? ' me' : ''}">${f.kp ? 'คุณ' : f.k}</span> ⚔ <span class="${f.vt === 'red' ? 'r' : 'b'}${f.vp ? ' me' : ''}">${f.vp ? 'คุณ' : f.v}</span>`;
    $('feed').appendChild(el);
    feedEls.push({ el, t: 0 });
  }
  for (const f of feedEls) { f.t += dt; if (f.t > 3.5) f.el.style.opacity = 0; }
  while (feedEls.length && (feedEls[0].t > 4 || feedEls.length > 4)) feedEls.shift().el.remove();
  const pin = player.pinned && !player.dead ? player.pinned : null;
  $('dead').classList.toggle('hidden', !player.dead && !pin);
  if (pin) { $('dead').firstChild.textContent = 'ถูกหอกปัก!'; $('deadT').textContent = pin.p.state === 'fly' ? '' : pin.t < pin.stun ? 'มึน...' : 'กำลังดึงหอกออก ' + Math.max(0, pin.stun + pin.pull - pin.t).toFixed(1) + ' วิ'; }
  else if (player.dead) $('dead').firstChild.textContent = 'คุณถูกล้ม!';
  if (player.dead) $('deadT').textContent = 'เกิดใหม่ใน ' + Math.max(1, Math.ceil(player.respawnT)) + ' วินาที';
  $('chipHp').firstChild.style.width = (100 * player.hp) / player.maxHp + '%';
  // the clock, the level, the XP bar
  const sec = Math.floor(world.clock);
  if (sec !== lastClock) {
    lastClock = sec;
    $('clock').textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    if (statsOpen) renderStats();
  }
  const ck = player.lvl + ':' + Math.round((player.xp / xpNeed(player.lvl)) * 50);
  if (ck !== lastChip) {
    lastChip = ck;
    $('chipT').textContent = TEAM[player.team].name + ' · เลเวล ' + player.lvl;
    $('chipXp').firstChild.style.width = (player.lvl >= MAX_LVL ? 100 : (100 * player.xp) / xpNeed(player.lvl)) + '%';
  }
  // a level gained: the pack opens on the four upgrades to choose from
  const lk = player.pend > 0 ? player.pend + ':' + player.lvl : '';
  if (lk !== lvlKey && performance.now() >= lvlHold) {
    const first = !lvlKey;
    lvlKey = lk;
    if (lk) openPack(!first); else closePack();
  }
}
let lvlTimers = [], lvlReady = false, lvlHold = 0;
function closePack() { lvlTimers.forEach(clearTimeout); lvlTimers = []; lvlReady = false; $('lvlUp').className = 'hidden'; }
function buildPack() {
  const el = $('lvlUp');
  if (el.firstChild) return;
  el.innerHTML = '<b></b><div class="stg"><div class="pack"><i class="pt"></i><i class="pb">✦</i></div><div class="flash"></div><div class="cds">' +
    UPS.map((u, i) => `<button class="cd" data-up="${u.id}" style="--dx:${(1.5 - i) * 72}px;--rot:${(i - 1.5) * 4}deg;--dy:${Math.abs(i - 1.5) > 1 ? 5 : 0}px;--dl:${i * 0.05}s"><div class="tw"><div class="in"><div class="bk">❖</div><div class="f"><canvas width="112" height="112"></canvas><span>${u.name}</span><em>${u.pct}</em></div></div></div><kbd>${u.key}</kbd></button>`).join('') + '</div></div>';
  el.querySelectorAll('.cd').forEach((b) => {
    drawUpIcon(b.querySelector('canvas'), b.dataset.up);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); chooseUp(b.dataset.up); });
  });
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!lvlReady) skipPack(); });
}
// 1 shake and glow, 2 tear with a flash, 3 the cards fan out face down and one trembles, 4 they turn over,
// the trembling one last with a gold sweep, then gold rains down the screen. (A pick still waiting: straight to the fan.)
function openPack(quick) {
  buildPack();
  const el = $('lvlUp'), cards = [...el.querySelectorAll('.cd')];
  lvlTimers.forEach(clearTimeout); lvlTimers = []; lvlReady = false;
  const rare = Math.floor(Math.random() * cards.length);
  cards.forEach((c, i) => { c.classList.remove('fl', 'gold', 'tr', 'picked'); c.classList.toggle('rare', i === rare); });
  el.firstChild.textContent = 'เลเวล ' + (player.lvl - player.pend + 1) + ' · เลือกอัปเกรด' + (player.pend > 1 ? ' (เหลือ ' + player.pend + ')' : '');
  const at = (ms, f) => lvlTimers.push(setTimeout(f, ms));
  let t = 30;
  el.className = quick ? 'p-wait' : 'p-shake';
  if (!quick) { t = 560; at(t, () => { el.className = 'p-tear'; }); t += 130; }
  at(t, () => { el.className = 'p-fan'; }); t += quick ? 380 : 520;
  at(t, () => cards[rare].classList.add('tr')); t += quick ? 260 : 420;
  at(t, () => { el.className = 'p-flip'; });
  let n = 0;
  cards.forEach((c, i) => { if (i !== rare) at(t + 80 * n++, () => c.classList.add('fl')); });
  t += 80 * n + 120;
  at(t, () => { cards[rare].classList.remove('tr'); cards[rare].classList.add('fl', 'gold'); }); t += 330;
  at(t, () => { el.className = 'p-ready'; lvlReady = true; sparkleRain(quick ? 22 : 46); });
}
function skipPack() {
  const el = $('lvlUp');
  lvlTimers.forEach(clearTimeout); lvlTimers = [];
  el.querySelectorAll('.cd').forEach((c) => { c.classList.remove('tr'); c.classList.add('fl'); });
  el.className = 'p-ready'; lvlReady = true;
}
function chooseUp(id) {
  if (!player || !(player.pend > 0) || performance.now() < lvlHold) return;
  if (!lvlReady) { skipPack(); return; }
  if (!pickUp(world, player, id)) return;
  const el = $('lvlUp'), c = el.querySelector(`.cd[data-up="${id}"]`);
  c.classList.remove('gold'); void c.offsetWidth; c.classList.add('gold', 'picked');
  el.classList.add('chosen');
  lvlReady = false; lvlHold = performance.now() + 420;
}
function sparkleRain(n) {
  const box = $('sparkle');
  box.innerHTML = '';
  let h = '';
  for (let i = 0; i < n; i++) h += `<i style="left:${(Math.random() * 100).toFixed(1)}%;--s:${(7 + Math.random() * 11).toFixed(0)}px;--d:${(0.9 + Math.random() * 0.8).toFixed(2)}s;--dl:${(Math.random() * 0.55).toFixed(2)}s;--sw:${((Math.random() - 0.5) * 60).toFixed(0)}px"></i>`;
  box.innerHTML = h;
  clearTimeout(sparkleRain.t);
  sparkleRain.t = setTimeout(() => { box.innerHTML = ''; }, 2400);
}
let lastClock = -1, lastChip = '', lvlKey = '', statsOpen = false;
// tap the score: who killed, died, helped
function renderStats() {
  const rows = world.actors.filter((a) => !a.creep).sort((a, b) => (a.team === player.team ? 0 : 1) - (b.team === player.team ? 0 : 1) || b.kills - a.kills);
  let h = '<h3><span>สถิติการรบ</span><small>แตะเพื่อปิด</small></h3><table><tr><th>นักรบ</th><th>เลเวล</th><th>ฆ่า</th><th>ตาย</th><th>ช่วย</th><th>สมุน</th></tr>';
  let lastTeam = null;
  for (const a of rows) {
    if (lastTeam && lastTeam !== a.team) h += '<tr class="sep"><td colspan="6"></td></tr>';
    lastTeam = a.team;
    h += `<tr class="${a.team === 'red' ? 'r' : 'b'}${a.isPlayer ? ' me' : ''}"><td>${a.hero.name}${a.isPlayer ? ' (คุณ)' : ''}</td><td>${a.lvl}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.assists}</td><td>${a.cs}</td></tr>`;
  }
  $('statsP').innerHTML = h + '</table>';
}
function toggleStats(on) {
  statsOpen = on == null ? !statsOpen : on;
  $('statsP').classList.toggle('hidden', !statsOpen);
  $('score').classList.toggle('on', statsOpen);
  if (statsOpen) renderStats();
}
$('score').addEventListener('pointerdown', (e) => { e.preventDefault(); if (state === 'game') toggleStats(); });
$('statsP').addEventListener('pointerdown', (e) => { e.preventDefault(); toggleStats(false); });
// hold the minimap: the view jumps to where you press, and slides as you drag
function mapLookAt(e) {
  const r = mini.getBoundingClientRect();
  input.mapLook = { x: clamp((e.clientX - r.left) / r.width, 0, 1) * world.W, y: clamp((e.clientY - r.top) / r.height, 0, 1) * world.H, id: e.pointerId };
}
mini.addEventListener('pointerdown', (e) => { if (state !== 'game') return; e.preventDefault(); mini.setPointerCapture(e.pointerId); hideTip(); mapLookAt(e); });
mini.addEventListener('pointermove', (e) => { if (input.mapLook && input.mapLook.id === e.pointerId) mapLookAt(e); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) mini.addEventListener(ev, (e) => { if (input.mapLook && input.mapLook.id === e.pointerId) input.mapLook = null; });

// ---------- the loop ----------
let last = performance.now(), menuT = 0;
// one bad frame must never stop the game: the error is noted, the frame skipped, the loop goes on
let frameErrs = 0;
function frame(now) {
  try { frameBody(now); }
  catch (err) {
    frameErrs++;
    if (frameErrs < 4) console.error(err);
    last = now;
    requestAnimationFrame(frame);
  }
}
function frameBody(now) {
  // the lower settings draw 30 frames a second
  if (GFX[gfx].fps < 60 && now - last < 1000 / GFX[gfx].fps - 5) { requestAnimationFrame(frame); return; }
  let dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  // hit-stop: a heartbeat of slow motion when a heavy blow lands
  if (state !== 'menu' && world && world.hitStop > 0) { world.hitStop -= dt; dt *= 0.15; }
  else if (state !== 'menu' && world && world.slowT > 0) { world.slowT -= dt; dt *= 0.28; } // slow motion (the axeman's toss)
  if (state === 'menu') {
    menuT += dt;
    cam.x = clamp(world.W * 0.45 + Math.sin(menuT * 0.05) * 3.5, cam.vw / 2 / cam.U, world.W - cam.vw / 2 / cam.U);
    cam.y = clamp(world.H * 0.5 + Math.sin(menuT * 0.03 + 1) * world.H * 0.4, cam.vh / 2 / (cam.U * TILT), world.H - cam.vh / 2 / (cam.U * TILT));
    tickWorld(world, dt, []);
    updateFx(world, dt);
    renderField(world, null);
    updatePreview(dt);
    renderPreview();
  } else {
    if (input.atkHold && !player.act && !player.dead) cast(player, world, 0, null);
    if (player.dead && input.aim) { input.aim = null; cancelEl.classList.remove('show', 'hot'); }
    mouseAim();
    // the archer draws his bow while you hold the aim, turning to face it
    const am0 = input.aim;
    const sk0 = am0 ? skillsOf(player)[am0.i] : null;
    const winds = sk0 && (sk0.act === 'throwAxe' || sk0.act === 'leap') ? true : sk0 && sk0.aim === 'dir' && (player.hero.weapon === 'bow' || (player.hero.weapon === 'spear' && !player.spearOut && (sk0.act === 'sweep' || sk0.act === 'throwSpear' || sk0.act === 'lungeThrust')));
    if (winds && !player.act && !player.dead && !player.pinned) {
      const d = am0.dir || [player.face, 0];
      player.aimPose = { k: sk0.act, dir: d };
      if (Math.abs(d[0]) > 0.05) player.face = d[0] > 0 ? 1 : -1;
    } else player.aimPose = null;
    // the tower button held: keep hitting the tower, walking up to it if it's a few steps off
    let towerWalk = null;
    player.towerMsgT = Math.max(0, (player.towerMsgT || 0) - dt);
    if (input.towerHold && !player.dead) {
      if (!player.act || !ACTS[player.act.k].lock) towerStrike(player, world);
      const nt = nearestEnemyTower(player, world);
      if (nt && nt.d > towerReach(player) && nt.d < 3.2) towerWalk = unit2(nt.t.x - player.x, nt.t.y - player.y);
    }
    let mv0 = player.dead ? [0, 0] : moveVector();
    if (towerWalk && Math.hypot(mv0[0], mv0[1]) < 0.2) mv0 = towerWalk;
    // walking with the bow drawn: a little slower
    const mv = input.bowDraw ? [mv0[0] * 0.75, mv0[1] * 0.75] : mv0;
    if (input.hold && !player.dead) {
      // the shield turns with the drag on its button, else with the mouse, else the way you walk
      const h = input.hold;
      let d = h.dir;
      if (!d && h.mouse && input.mouse.has) { const [mx, my] = s2w(input.mouse.x, input.mouse.y); d = [mx - player.x, my - player.y]; }
      if (!d && Math.hypot(mv[0], mv[1]) > 0.2) d = mv;
      setHoldDir(player, d);
    }
    world.clock += dt;
    tickCreeps(world, dt);
    for (const a of world.actors) if (a.bot) updateActor(a, dt, world, botThink(a, world, dt)); else if (a.creep) updateActor(a, dt, world, creepThink(a, world, dt));
    updateActor(player, dt, world, mv);
    // the drawn bow: turned to the nearest target, at full draw, ready to loose the moment the finger lifts
    if (input.bowDraw && !player.dead && !player.pinned && !(player.act && ACTS[player.act.k].lock)) {
      const d = drawDir(player, world);
      player.drawDir = d;
      // the draw builds while the finger stays down: full strength at 0.3 s (sooner with attack speed)
      player.drawT = Math.min(BOW_FULL / asMul(player), (player.drawT || 0) + dt);
      if (!player.act) player.aimPose = { k: 'shoot', dir: d };
      if (Math.abs(d[0]) > 0.05) player.face = d[0] > 0 ? 1 : -1;
    } else player.drawDir = null;
    // something has you in its sights: the red lock-on ring (only you see it)
    const th = aimThreats(world, player);
    if (th.length && !player.warn) haptic(18);
    player.warn = th.length ? th : null;
    player.warnA = clamp((player.warnA || 0) + (th.length ? dt * 9 : -dt * 5), 0, 1);
    if (th.length) player.warnSrc = th;
    // bodies push each other apart
    const live = world.actors.filter((a) => !a.dead && !a.air && !a.pinned && !a.grab && !(a.kick && a.kick.air));
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const A = live[i], B = live[j], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
      if (d < 0.22 && d > 1e-4) { const p = (0.22 - d) / 2; A.x -= (dx / d) * p; A.y -= (dy / d) * p; B.x += (dx / d) * p; B.y += (dy / d) * p; resolve(world, A, 0.12); resolve(world, B, 0.12); }
    }
    tickWorld(world, dt, world.actors.filter((a) => !a.dead).map((a) => ({ x: a.x, y: a.y, vx: a.vx, vy: a.vy, moving: a.moving || !!a.act, air: a.air, hurled: !!(a.kick && (a.kick.air || (a.kick.slide && a.kick.d > 0.5))), set slow(v) { if (v) a.slow = true; } })));
    updateProj(world, dt);
    updateDeliveries(world, dt);
    updateFx(world, dt);
    // aiming a long reach: pull the camera back until the whole reach fits, leaning toward the aim
    let zoomU = cam.baseU, lookX = 0, lookY = 0;
    const am = input.aim;
    camHold.t -= dt;
    if (!am && camHold.t > 0 && !player.dead) { zoomU = camHold.U; lookX = camHold.lx; lookY = camHold.ly; }
    if (am && !player.dead) {
      const sk = skillsOf(player)[am.i];
      const R = sk.range || 0;
      if (R >= 1.2) {
        const d = am.dir || (player.moving ? player.lastDir : [player.face, 0]);
        // fit the whole lane with room to spare; up and down get extra room (the slant squashes them,
        // and the buttons cover the bottom of the screen)
        const ex = Math.abs(d[0]) * R * 0.5 + 1.3, ey = Math.abs(d[1]) * R * 0.62 + 1.25;
        zoomU = Math.min(cam.baseU, (cam.vw * 0.5) / ex, (cam.vh * 0.5) / (ey * TILT));
        lookX = d[0] * R * 0.42; lookY = d[1] * R * (d[1] > 0 ? 0.5 : 0.4);
        // after the release, hold this view a moment to watch the hit land
        camHold.U = zoomU; camHold.lx = lookX; camHold.ly = lookY; camHold.t = sk.act === 'throwSpear' ? 1.6 : 0.85;
      }
    }
    const zf = 1 - Math.exp(-7 * dt);
    cam.U += (zoomU - cam.U) * zf;
    camLook[0] += (lookX - camLook[0]) * zf;
    camLook[1] += (lookY - camLook[1]) * zf;
    // camera follows with a little look-ahead
    const look = player.moving ? 0.35 : 0;
    const tx = player.x + player.lastDir[0] * look + camLook[0], ty = player.y + player.lastDir[1] * look * 0.6 + camLook[1];
    const f = 1 - Math.exp(-6 * dt);
    if (input.mapLook) { const fm = 1 - Math.exp(-22 * dt); cam.x += (input.mapLook.x - cam.x) * fm; cam.y += (input.mapLook.y - cam.y) * fm; }
    else { cam.x += (tx - cam.x) * f; cam.y += (ty - cam.y) * f; }
    const hx = cam.vw / 2 / cam.U, hy = cam.vh / 2 / (cam.U * TILT);
    cam.x = world.W > hx * 2 ? clamp(cam.x, hx, world.W - hx) : world.W / 2;
    cam.y = world.H > hy * 2 ? clamp(cam.y, hy, world.H - hy) : world.H / 2;
    const shake = world.shake || 0;
    const kx = cam.x, ky = cam.y;
    if (shake > 0) { cam.x += (Math.random() - 0.5) * shake * 0.12; cam.y += (Math.random() - 0.5) * shake * 0.12; world.shake = Math.max(0, shake - dt); }
    renderField(world, player);
    cam.x = kx; cam.y = ky;
    updateButtons();
    drawMini();
    updateHud(dt);
    if (tipT > 0) { tipT -= dt; if (tipT <= 0) $('tip').style.opacity = 0; }
  }
  requestAnimationFrame(frame);
}

resize();
buildMenu();
requestAnimationFrame(frame);

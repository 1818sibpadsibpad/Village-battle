'use strict';
// shown on the menu; raised with every update
const GAME_VERSION = '1.42';
// ===== ศึกหมู่บ้าน MOBA — core: utilities, constants, heroes =====
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }

const TILT = 0.74;         // the camera looks down at a slant: ground depth is squashed on screen
const INK = '#2a1c14';     // the outline colour used on every drawing
const BASE_SPEED = 1.35;   // world units per second
let DPR = Math.min(window.devicePixelRatio || 1, 2);
// graphics quality: how many pixels are drawn, how often, and which full-screen effects run
const GFX = [
  { id: 'high', name: 'คมชัดสูง', short: 'สูง', dpr: 3, fps: 60, refl: true, blur: true },
  { id: 'mid', name: 'ปกติ', short: 'ปกติ', dpr: 2, fps: 60, refl: true, blur: true },
  { id: 'eco', name: 'ประหยัดแบต', short: 'ประหยัด', dpr: 1.25, fps: 30, refl: false, blur: false },
  { id: 'px', name: 'ไมโครพิกเซล', short: 'พิกเซล', pixel: true, fps: 30, refl: false, blur: false },
];
let gfx = 1;
try { const v = parseInt(localStorage.getItem('sb_gfx'), 10); if (v >= 0 && v < GFX.length) gfx = v; } catch (e) { /* no storage */ }
let MINI_DPR = DPR;

const TEAM = {
  red:  { main: '#c23a2a', dark: '#7e2216', light: '#ef8a6e', name: 'ฝ่ายแดง', tassel: '#d8382a' },
  blue: { main: '#2e6db4', dark: '#1b3e6c', light: '#86b8ea', name: 'ฝ่ายน้ำเงิน', tassel: '#2f7fd8' },
};
let SKIN = '#d39a6a', SKIN_D = '#a8693f';
const SKIN0 = SKIN, SKIN0_D = SKIN_D, CREEP_SKIN = '#86532f', CREEP_SKIN_D = '#5a3519';
const HAIR = '#1d1612', PANTS = '#3f2d22', PANTS_D = '#2c1f17';

// aim: 'auto' (basic attack, locks onto the nearest target), 'dir' (drag a direction), 'point' (drag a spot), 'none'
const ALL_HEROES = [
  {
    id: 'sword', hidden: true, name: 'ขุนดาบ', title: 'นักดาบประจำหมู่บ้าน', role: ['นักสู้', 'คล่องตัว'], size: 0.36, speed: 1.0,
    weapon: 'sword', head: 'band', stats: { hp: 6, spd: 7, rng: 3, dif: 3 },
    desc: 'ดาบไทยเล่มเดียว ฟันเร็ว พุ่งเข้าหาแล้วหลบออกทันที',
    skills: [
      { name: 'ฟันดาบ', icon: 'slash', cd: 0.55, aim: 'auto', act: 'slash' },
      { name: 'ฟันพุ่ง', icon: 'dash', cd: 5, aim: 'dir', range: 1.8, act: 'dashSlash', desc: 'พุ่งไปข้างหน้าแล้วฟันปิดท้าย' },
      { name: 'ก้าวหลบ', icon: 'step', cd: 3.5, aim: 'dir', range: 1.1, act: 'step', desc: 'ก้าวพริ้วหลบไปทิศที่เลือก' },
      { name: 'พายุดาบ', icon: 'spin', cd: 9, aim: 'none', range: 0.5, act: 'spin', desc: 'หมุนดาบรอบตัว ยังเดินได้แต่ช้าลง' },
    ],
  },
  {
    id: 'spear', name: 'ทวนเหล็ก', title: 'ทหารทวนยาว', role: ['ระยะประชิด', 'ควบคุม'], size: 0.36, speed: 0.95,
    weapon: 'spear', head: 'hat', stats: { hp: 4, spd: 6, rng: 7, dif: 5 },
    desc: 'ทวนยาวสามช่วงตัว แทงไกล ปัดกวาด และพุ่งทวนได้',
    skills: [
      { name: 'แทงหอก', icon: 'thrust', cd: 0.7, aim: 'auto', act: 'thrust' },
      { name: 'ฟาดหอก', icon: 'sweep', cd: 6, aim: 'dir', range: 1.05, act: 'sweep', desc: 'กดค้างจะง้างหอกชี้ไปด้านหลัง ลากเพื่อหมุนทิศ ปล่อยนิ้วเพื่อเหวี่ยงฟาดเต็มแรง โดนแล้วกระเด็น 4 เมตร ล้มหงาย มึน 1 วิ ระหว่างเหวี่ยงปัดลูกธนู หอก ขวาน ที่บินมาได้ทุกชนิด' },
      { name: 'พุ่งหอก', icon: 'lunge', cd: 7, aim: 'dir', range: 2.0, act: 'lungeThrust', desc: 'ถือหอกพุ่งทั้งตัว 5 เมตร เสียบตัวแรกที่ชน แล้วหมุนหอกเหวี่ยงข้ามหัว ฟาดให้กระเด็นกลับทางที่พุ่งมา 7 เมตร มึน 1 วิ' },
      { name: 'ปาหอก', icon: 'throwSpear', cd: 10, aim: 'dir', range: 5, act: 'throwSpear', desc: 'ง้างตอนเล็ง ปล่อยแล้วพุ่งตรงแรง ดาเมจ 3 เท่า เสียบอก ลากไปปักพื้นหรือปักติดต้นไม้/บ้าน มึน 1 วิ แล้วต้องดึงออก 3 วิ ต้องวิ่งไปเก็บหอกเองก่อน ถึงจะเริ่มรีโหลด 10 วิ · ถ้าเสียบโดนแล้ววิ่งไปกดโจมตีปกติข้างตัวเขาภายใน 3 วิ จะจับหอกแล้วถีบเขากระเด็น 3 เมตร ดาเมจ 3 เท่า ตัวเองเด้งออกมา 2 เมตร ได้หอกคืนทันที' },
    ],
  },
  {
    id: 'axe', name: 'ขวานคู่', title: 'นักรบขวานสองมือ', role: ['บุกทะลวง', 'กระโดด'], size: 0.36, speed: 1.05,
    weapon: 'axe', head: 'mahad', stats: { hp: 6, spd: 8, rng: 2, dif: 6 },
    desc: 'ชาวบ้านบางระจันถือขวานสองเล่ม ขว้างขวานใส่หัว แล้วกระโดดทุบทั้งวง',
    skills: [
      { name: 'สับขวาน', icon: 'chop', cd: 0.7, aim: 'auto', act: 'chop2', desc: 'ถือสองเล่มฟันสองจังหวะ · เหลือเล่มเดียวฟันจังหวะเดียวและช้าลงครึ่งหนึ่ง' },
      { name: 'กลิ้งหลบ', icon: 'roll', cd: 4, aim: 'dir', range: 1.6, act: 'roll', desc: 'ม้วนตัวกลิ้งไปข้างหน้า' },
      { name: 'ขว้างขวาน', icon: 'throwAxe', cd: 6, aim: 'dir', range: 4, act: 'throwAxe', desc: 'ง้างแขนแล้วขว้างขวานไปจนสุดปลายเป้า ดาเมจ 100 มีโอกาสโดนหัวคริติคอล 80% · ต้องเดินไปเก็บขวานเอง (เข็มสีเหลืองชี้ทาง) · ขว้างได้ทั้งสองเล่ม หมดมือแล้วปุ่มจะเปลี่ยนเป็นสกิลหนี' },
      { name: 'กระโดดทุบ', icon: 'leap', cd: 8, aim: 'point', range: 3, act: 'leap', desc: 'ต้องมีขวานครบสองเล่ม · ย่อตัวกางแขนแล้วกระโดดสูงลงกลางวง 2.5 เมตร ทุกคนในวงกระเด็นออกนอกวงล้มหงายไถลอีก 2 เมตร · ดาเมจกลางวง 100 ขอบวง 30% คริติคอล 30% · คนที่อยู่ในวงเล็กตรงกลางจะถูกจับทุบหน้าคว่ำ โยนขึ้นฟ้า แล้วฟาดขวานคู่กระเด็น 3 เมตร ดาเมจเพิ่ม 50%' },
    ],
  },
  {
    id: 'shield', name: 'โล่หวาย', title: 'ทหารโล่หวายกับมีดสั้น', role: ['แทงค์', 'ป้องกัน'], size: 0.36, speed: 0.92,
    weapon: 'shield', head: 'band', stats: { hp: 9, spd: 5, rng: 2, dif: 3 },
    desc: 'โล่หวายสานแน่น ยืนกันหน้า กระแทก และบุกทะลวงแนว',
    skills: [
      { name: 'แทงมีด', icon: 'stab', cd: 0.5, aim: 'auto', act: 'stab' },
      { name: 'ยกโล่', icon: 'guard', cd: 0.5, aim: 'hold', range: 0.6, act: 'guard', desc: 'กดค้างแล้วลากหมุนโล่ได้รอบตัว 360° อะไรโดนโล่จะกระเด็นกลับ แถบสีเหลืองคือค่าโล่ (เท่า HP) ถ้าโล่แตก ต้องกลับฐาน ทหารชาวบ้านจะเอาโล่ใหม่มาให้ใน 7 วิ' },
      { name: 'กระแทกโล่', icon: 'bash', cd: 6, aim: 'none', range: 1.2, act: 'bash', desc: 'จิ้มทีเดียว พุ่งไปข้างหน้า 3 เมตร ผลักด้วยโล่ เป้าหมายลอยขึ้นแล้วไถลไปไกล 4 เมตร มึน 2 วิ' },
      { name: 'บุกทะลวง', icon: 'charge', cd: 10, aim: 'dir', range: 3, act: 'charge', desc: 'วิ่งชาร์จยาวด้วยโล่' },
    ],
  },
  {
    id: 'lead', name: 'หัวหน้ากอง', title: 'แม่ทัพดาบคู่', role: ['ผู้นำ', 'บัฟ'], size: 0.5, speed: 1.0,
    weapon: 'twin', head: 'crown', stats: { hp: 8, spd: 6, rng: 3, dif: 4 },
    desc: 'ดาบคู่และผ้าคลุม ปลุกใจตัวเองให้วิ่งเร็วขึ้น',
    skills: [
      { name: 'ดาบคู่', icon: 'twin', cd: 0.75, aim: 'auto', act: 'twin' },
      { name: 'ปลุกใจ', icon: 'rally', cd: 12, aim: 'none', range: 0.6, act: 'rally', desc: 'ชูดาบปลุกใจ วิ่งเร็วขึ้น 5 วินาที' },
      { name: 'ฟันคู่พุ่ง', icon: 'dash', cd: 6, aim: 'dir', range: 2, act: 'twinDash', desc: 'พุ่งไกลพร้อมดาบคู่' },
      { name: 'พายุดาบคู่', icon: 'spin', cd: 10, aim: 'none', range: 0.6, act: 'twinSpin', desc: 'หมุนดาบคู่รอบตัว' },
    ],
  },
  {
    id: 'archer', name: 'นายธนู', title: 'นักธนูบ้านรวย', role: ['ระยะไกล', 'คล่องตัว'], size: 0.36, speed: 1.0,
    weapon: 'bow', head: 'hat', stats: { hp: 4, spd: 7, rng: 9, dif: 7 },
    desc: 'ยิงตรงแรง ตีลังกาถอยหนี และปล่อยห่าธนู',
    skills: [
      { name: 'ยิงธนู', icon: 'shoot', cd: 0.3, aim: 'auto', act: 'shoot', desc: 'กดค้างเพื่อง้างธนู (แถบเหลืองบนหัว) หันหาเป้าที่ใกล้ที่สุดเอง เดินได้ระหว่างง้าง ปล่อยนิ้วเพื่อยิง · ง้างเต็ม 0.3 วิ ดาเมจเต็ม ถ้ากดรัว ๆ ดาเมจเหลือแค่ 10% · ลูกธนูโค้งเข้าหาคนที่เล็งไว้' },
      { name: 'ตีลังกาถอย', icon: 'backflip', cd: 5, aim: 'dir', range: 1.4, act: 'backflip', desc: 'ตีลังกาไปทิศที่เลือก' },
      { name: 'เล็งแม่น', icon: 'snipe', cd: 6, aim: 'dir', range: 7, act: 'snipe', desc: 'ปล่อยนิ้วปุ๊บยิงทันที ดาเมจ 3 เท่า โดนแล้วล้มหงาย ไถลถอยหลัง 4 ก้าว · ไฟติดตัวนาน 4.5 วิ · ลูกธนูระเบิดตรงปลายทาง คนรอบ ๆ กระเด็น 2 เมตร' },
      { name: 'ห่าธนู', icon: 'volley', cd: 10, aim: 'dir', range: 5, act: 'volley', desc: 'ยิงธนูขึ้นฟ้ารัว 4 ดอกตกใส่เป้า โดนแต่ละดอกจะเด้งล้มหงายไถลพื้น 1.2 เมตร · ถ้าพัดที่เล็งแตะฮีโร่ศัตรู จะล็อคเป้า ดาเมจเต็ม · ถ้าล็อคที่สมุน ลูกธนูจะแตกไปหาสมุนรอบ ๆ สูงสุด 4 ตัว (รวมฮีโร่ที่อยู่ในกลุ่ม) ตัวละ 4 ดอก ดาเมจดอกละ 50%' },
    ],
  },
];
// while the spear is out, the spearman's buttons become these (none of the three moves can be hurt)
const SPEAR_ALT = [
  { name: 'ชก', icon: 'punch', cd: 0.6, aim: 'auto', act: 'punch', desc: 'ไม่มีดาเมจ แต่โดนแล้วมึน 1 วิ กระเด็น 1 เมตร' },
  { name: 'กลิ้งต่ำ', icon: 'lowRoll', cd: 8, aim: 'none', range: 1.6, act: 'lowRoll', desc: 'จิ้มทีเดียว กลิ้งติดพื้นไปทางที่เดิน 4 เมตร ไม่โดนดาเมจ' },
  { name: 'กระโดดกาง', icon: 'starJump', cd: 8, aim: 'none', range: 1.6, act: 'starJump', desc: 'จิ้มทีเดียว กระโดดสูงกางแขนขา พุ่งไปทางที่เดิน 4 เมตร ไม่โดนดาเมจ' },
  { name: 'สไลไถพื้น', icon: 'slide', cd: 8, aim: 'none', range: 1.2, act: 'slide', desc: 'จิ้มทีเดียว ทิ้งตัวสไลไถพื้นไปทางที่เดิน 3 เมตร ฝุ่นตลบ ไม่โดนดาเมจ' },
];
// no weapon in hand: the spear thrown, or the rattan shield smashed (he still has his knife for the basic)
function unarmed(a) { const W = a.hero.weapon; return (W === 'spear' && a.spearOut) || (W === 'shield' && a.shieldBroken) || (W === 'axe' && a.axeOut >= 2); }
const skillsOf = (a) => { if (!a.hero || !unarmed(a)) return a.hero.skills; if (a.hero.weapon === 'shield') return a._alt || (a._alt = [a.hero.skills[0]].concat(SPEAR_ALT.slice(1))); return SPEAR_ALT; };
const cdsOf = (a) => (a.hero && unarmed(a) ? (a.cdsAlt || (a.cdsAlt = [0, 0, 0, 0])) : a.cds);
const INVULN = { roll: 1, backflip: 1, step: 1, lowRoll: 1, starJump: 1, slide: 1 };
// bot difficulty: 1 kid, 2 granny, 3 the seer who knows the future
let BOT_LEVEL = 3;
try { BOT_LEVEL = clamp(parseInt(localStorage.getItem('sb_lvl') || '3', 10) || 3, 1, 3); } catch (e) {}
const LEVELS = [
  null,
  { name: 'เด็กเอ๋ยเด็กน้อย', aim: [2, 3], miss: 0.5, note: 'เล็งเป้านาน 2–3 วิ หลบพลาดครึ่งหนึ่ง' },
  { name: 'ยายหิบ', aim: [1, 2], miss: 0.25, note: 'เล็งเป้านาน 1–2 วิ หลบได้ดีขึ้น' },
  { name: 'เทพผู้หยั่งรู้อนาคต', aim: null, miss: 0, note: 'จัดเต็มทุกอย่าง ไม่ออมมือ' },
];
// the lane minions: little men in loincloths with a short blade in each hand, as tough as any hero
const CREEP_HERO = {
  id: 'creep', name: 'สมุน', title: 'สมุนเดินเลน', role: ['ครีป'], size: 0.36 * 0.7, speed: 0.39,
  weapon: 'twin', head: 'part', stats: { hp: 6, spd: 5, rng: 2, dif: 1 },
  desc: 'สมุนเดินตามเลน ฟันดาบคู่ใส่ศัตรูที่ขวางทาง',
  skills: [{ name: 'ดาบคู่', icon: 'twin', cd: 3.3, aim: 'auto', act: 'creepCut' }],
};
ALL_HEROES.push(CREEP_HERO);
CREEP_HERO.hidden = true;
const HEROES = ALL_HEROES.filter((h) => !h.hidden);
const heroById = (id) => ALL_HEROES.find((h) => h.id === id) || HEROES[0];

// ---------- sound: synthesised, no files ----------
const SFX = {
  ctx: null, _n: null,
  unlock() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  },
  noise() {
    if (!this._n) { const c = this.ctx, b = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this._n = b; }
    return this._n;
  },
  // a club landing on seasoned wood: low thump + a hollow knock
  wood(vol = 1, pitch = 1, when = 0) {
    const c = this.ctx;
    if (!c || c.state !== 'running' || vol < 0.03) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(210 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(68 * pitch, t + 0.13);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.75 * vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.2);
    const o2 = c.createOscillator(), g2 = c.createGain();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(560 * pitch, t);
    o2.frequency.exponentialRampToValueAtTime(420 * pitch, t + 0.06);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.35 * vol, t + 0.002);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o2.connect(g2).connect(c.destination);
    o2.start(t); o2.stop(t + 0.08);
    const n = c.createBufferSource(), bp = c.createBiquadFilter(), g3 = c.createGain();
    n.buffer = this.noise();
    bp.type = 'bandpass'; bp.frequency.value = 1100 * pitch; bp.Q.value = 3;
    g3.gain.setValueAtTime(0.8 * vol, t);
    g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    n.connect(bp).connect(g3).connect(c.destination);
    n.start(t, Math.random() * 0.3); n.stop(t + 0.07);
  },
  // air torn by a heavy swing or a thrown shaft
  whoosh(vol = 1, pitch = 1) {
    const c = this.ctx;
    if (!c || c.state !== 'running' || vol < 0.03) return;
    const t = c.currentTime;
    const n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise();
    bp.type = 'bandpass'; bp.Q.value = 1.3;
    bp.frequency.setValueAtTime(320 * pitch, t);
    bp.frequency.exponentialRampToValueAtTime(1700 * pitch, t + 0.1);
    bp.frequency.exponentialRampToValueAtTime(480 * pitch, t + 0.24);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55 * vol, t + 0.07);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    n.connect(bp).connect(g).connect(c.destination);
    n.start(t, Math.random() * 0.2); n.stop(t + 0.28);
  },
  // the rattan giving way: a crackle of snaps
  crack(vol = 1) {
    const c = this.ctx;
    if (!c || c.state !== 'running' || vol < 0.03) return;
    this.wood(vol, 0.8);
    for (let i = 0; i < 6; i++) {
      const t = c.currentTime + 0.03 + i * 0.035 + Math.random() * 0.02;
      const n = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
      n.buffer = this.noise();
      hp.type = 'highpass'; hp.frequency.value = 1800 + Math.random() * 1500;
      g.gain.setValueAtTime(0.5 * vol * (1 - i / 7), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      n.connect(hp).connect(g).connect(c.destination);
      n.start(t, Math.random() * 0.4); n.stop(t + 0.05);
    }
  },
};
// louder the nearer the camera
function sfxAt(kind, x, y, base = 1, pitch = 1) {
  if (typeof cam === 'undefined') return;
  const d = Math.hypot(x - cam.x, (y - cam.y) * 0.8);
  const vol = base * clamp(1.15 - d / 6, 0, 1);
  if (kind === 'crack') SFX.crack(vol); else if (kind === 'whoosh') SFX.whoosh(vol, pitch); else SFX.wood(vol, pitch * (0.92 + Math.random() * 0.16));
}

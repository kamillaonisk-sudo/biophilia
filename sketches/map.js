/*
 * Эскиз: небо — карта мира.
 *
 * Орбита — это обучение. Путь по ней:
 *   1) планета эмоций — человек один раз вводит, как он сейчас (смесь состояний);
 *   2) станции rhythm → timbre → silence стоят прямо на орбите; на каждой та же смесь
 *      звучит по-своему — так мы изучаем музыку, сравнивая одно и то же через разные линзы;
 *      урок пройден, когда станцию послушали; планета перелетает к ней, дуга орбиты загорается;
 *   3) орбита замкнута — от планеты отделяется точка-осколок и летит на общую планету.
 *
 * Общая планета — из светящихся осколков, как во вступлении: всё — осколки одной звезды.
 * Каждый человек — одна точка цвета своей смеси, мерцает в своём ритме.
 * Клик по общей планете — её слушать: звучат все вместе, на гармониках одного тона 55 Гц.
 *
 * Общая планета — симуляция: остальные люди сгенерированы, своё хранится в браузере (localStorage).
 * По краям неба — созвездия песен альбома (пока только названия).
 */
(() => {
  'use strict';

  const CREAM = '#f2efe6';
  const BASE = 55;
  // те же состояния, что в звезде (star.js): цвет, ноты, регистр, темп
  const STATES = [
    { id: 'calm',       color: '#7ad7ff', harms: [4, 6, 8, 9, 12],            oct: 1,   tempo: 0.55 },
    { id: 'wonder',     color: '#ffe14d', harms: [8, 10, 12, 15, 18, 20, 24], oct: 1,   tempo: 1.2 },
    { id: 'anxiety',    color: '#ff5a5f', harms: [7, 11, 13, 14, 17],         oct: 1,   tempo: 1.8 },
    { id: 'tenderness', color: '#ff7ac6', harms: [5, 6, 8, 10],               oct: 1,   tempo: 0.6 },
    { id: 'melancholy', color: '#b18cff', harms: [4, 5, 6, 7],                oct: 0.5, tempo: 0.45 },
    { id: 'joy',        color: '#ffb238', harms: [6, 8, 9, 10, 12, 16],       oct: 1,   tempo: 1.4 },
    { id: 'anger',      color: '#ff8a3d', harms: [6, 9, 12, 14, 18],          oct: 0.5, tempo: 1.6 },
    { id: 'fear',       color: '#7aa8ff', harms: [7, 11, 13, 17, 19],         oct: 1,   tempo: 1.3 },
    { id: 'hope',       color: '#9cff6e', harms: [6, 8, 10, 12, 15],          oct: 1,   tempo: 0.9 },
    { id: 'gratitude',  color: '#5ee0c8', harms: [4, 6, 8, 10, 12],           oct: 1,   tempo: 0.7 },
  ];
  const zeros = () => STATES.map(() => 0);
  const pad = (ws) => (ws ? STATES.map((_, k) => ws[k] || 0) : ws);   // старые сохранения — 6 состояний
  const BLENDS = {
    'calm+wonder': 'contemplation', 'anxiety+calm': 'vigilance', 'calm+tenderness': 'warmth',
    'calm+melancholy': 'solitude', 'calm+joy': 'contentment', 'anxiety+wonder': 'awe',
    'tenderness+wonder': 'enchantment', 'melancholy+wonder': 'reverie', 'joy+wonder': 'delight',
    'anxiety+tenderness': 'care', 'anxiety+melancholy': 'dread', 'anxiety+joy': 'excitement',
    'melancholy+tenderness': 'longing', 'joy+tenderness': 'affection', 'joy+melancholy': 'nostalgia',
    'anger+anxiety': 'agitation', 'anger+calm': 'resolve', 'anger+fear': 'defiance', 'anger+gratitude': 'ambivalence',
    'anger+hope': 'determination', 'anger+joy': 'zeal', 'anger+melancholy': 'bitterness', 'anger+tenderness': 'protectiveness',
    'anger+wonder': 'indignation', 'anxiety+fear': 'alarm', 'calm+fear': 'caution', 'fear+gratitude': 'relief',
    'fear+hope': 'suspense', 'fear+joy': 'thrill', 'fear+melancholy': 'despair', 'fear+tenderness': 'vulnerability',
    'fear+wonder': 'the sublime', 'anxiety+gratitude': 'humility', 'calm+gratitude': 'peace', 'gratitude+hope': 'faith',
    'gratitude+joy': 'bliss', 'gratitude+melancholy': 'bittersweet', 'gratitude+tenderness': 'love', 'gratitude+wonder': 'reverence',
    'anxiety+hope': 'anticipation', 'calm+hope': 'serenity', 'hope+joy': 'optimism', 'hope+melancholy': 'yearning',
    'hope+tenderness': 'devotion', 'hope+wonder': 'inspiration',
  };
  const SONGS = ['moon', 'thunderbolt', 'crystalline', 'cosmogony', 'dark matter',
                 'hollow', 'virus', 'sacrifice', 'mutual core', 'solstice'];

  // путь по орбите: дом (планета эмоций) → rhythm → timbre → silence → снова дом
  const HOME_A = Math.PI;
  const LESSONS = [
    { id: 'rhythm',  a: Math.PI * 1.5, harm: 8,  what: 'your blend as a pulse' },
    { id: 'timbre',  a: Math.PI * 2,   harm: 10, what: 'your blend as colour' },
    { id: 'silence', a: Math.PI * 2.5, harm: 12, what: 'your blend as pauses' },
  ];
  const CLOSE_A = Math.PI * 3;
  const SEGMENTS = [[HOME_A, LESSONS[0].a], [LESSONS[0].a, LESSONS[1].a], [LESSONS[1].a, LESSONS[2].a], [LESSONS[2].a, CLOSE_A]];

  const STORE = 'biophilia:sky:v2';
  const PEOPLE = 48;            // сколько «других людей» в симуляции общей планеты
  const STEPS = 16, LOOP = 4.8; // общий такт симфонии
  const BAND = 12;              // сколько людей играет в каждом такте (по кругу), чтобы не было каши

  // ---------- DOM ----------
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const $ = (s) => document.querySelector(s);
  const hud = Object.fromEntries([...document.querySelectorAll('[data-hud]')].map((el) => [el.dataset.hud, el]));
  const room = $('[data-room]'), frame = $('[data-frame]');
  const hint = $('[data-hint]');
  const sendBtn = $('[data-send]');
  const outStatus = $('[data-outside-status]');

  // ---------- утилиты ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  const now = () => performance.now() / 1000;
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; };
  function mulberry32(a) {
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const sprites = {};
  function sprite(color) {
    if (color === CREAM) color = '#ffe9c4';
    if (sprites[color]) return sprites[color];
    const s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, rgba(color, 1));
    grd.addColorStop(0.15, rgba(color, 0.5));
    grd.addColorStop(0.45, rgba(color, 0.1));
    grd.addColorStop(1, rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    return (sprites[color] = c);
  }

  // ---------- состояние посетителя ----------
  // blend — смесь из планеты эмоций (6 чисел, капли + краска), drops — только капли,
  // strokes — рисунок человека (он и есть его ритм), stars — пройденные станции,
  // sent — где на общей планете лежит его точка
  // wave — звуковая волна места вокруг планеты (то, что снаружи)
  const empty = () => ({ blend: null, drops: null, strokes: [], stars: {}, rhythm: null, wave: null, sent: null });
  let state = (() => { try { return { ...empty(), ...JSON.parse(localStorage.getItem(STORE)) }; } catch (e) { return empty(); } })();
  state.blend = pad(state.blend); state.drops = pad(state.drops);
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* живём без сохранения */ } }

  const sum = (ws) => ws.reduce((a, b) => a + b, 0);
  function blendOf(ws) {
    const W = ws ? sum(ws) : 0;
    if (W < 0.05) return { W: 0, ws: ws || zeros(), color: CREAM, name: '' };
    const order = ws.map((w, k) => ({ k, w, share: w / W })).filter((o) => o.w > 0.05).sort((a, b) => b.w - a.w);
    const top = order[0];
    const name = order.length === 1 || top.share >= 0.75
      ? STATES[top.k].id
      : BLENDS[[STATES[top.k].id, STATES[order[1].k].id].sort().join('+')];
    return { W, ws, color: STATES[top.k].color, name };
  }
  const blendNow = () => blendOf(state.blend);
  const passedCount = () => LESSONS.filter((l) => state.stars[l.id]).length;
  const orbitClosed = () => passedCount() === LESSONS.length;
  const nextLesson = () => LESSONS.findIndex((l) => !state.stars[l.id]);

  // ритм человека: нарисованный на станции rhythm, иначе — выведенный из смеси
  function makeSteps(ws, rnd) {
    const b = blendOf(ws);
    const tempo = b.W ? ws.reduce((s, w, k) => s + w * STATES[k].tempo, 0) / b.W : 0.8;
    const hits = Math.max(1, Math.min(4, Math.round(0.6 + tempo * 1.6)));
    const steps = new Array(STEPS).fill(0);
    steps[Math.floor(rnd() * 4) * 4] = 2;
    for (let k = 1; k < hits; k++) steps[Math.floor(rnd() * STEPS)] = 1;
    return steps;
  }
  function seedOf(ws) { return ws.reduce((h, w, k) => (h * 31 + Math.round(w * 10) + k) | 0, 17); }
  function mySteps() {
    if (state.rhythm && state.rhythm.steps && state.rhythm.steps.some(Boolean)) return state.rhythm.steps;
    return makeSteps(state.blend || zeros(), mulberry32(seedOf(state.blend || [0])));
  }

  // ---------- геометрия мира (в долях меньшей стороны экрана) ----------
  let W = 0, H = 0, DPR = 1, M = 1;
  const SHARED = { x: 0, y: 0.02, r: 0.15 };
  const orbitRX = () => Math.min(0.5, (W / M) * 0.29);
  const ORBIT_RY = 0.25;
  const orbitPos = (a) => ({ x: SHARED.x + Math.cos(a) * orbitRX(), y: SHARED.y + Math.sin(a) * ORBIT_RY });
  const stationPos = (i) => orbitPos(LESSONS[i].a);

  // планета стоит у последней пройденной станции и перелетает по орбите
  function targetA() {
    if (orbitClosed()) return CLOSE_A;
    return LESSONS.reduce((a, l) => (state.stars[l.id] ? Math.max(a, l.a) : a), HOME_A);
  }
  let planetA = targetA();
  const personalPos = () => orbitPos(planetA);

  // ---------- общая планета: люди-осколки ----------
  function person(ws, steps, r, a, size, you = false) {
    return { ws, color: blendOf(ws).color, steps, r, a, size, you, excite: 0, x: Math.cos(a) * r, y: Math.sin(a) * r * 0.9 };
  }
  const others = Array.from({ length: PEOPLE }, (_, i) => {
    const rnd = mulberry32(i * 7919 + 3);
    const ws = zeros();
    ws[Math.floor(rnd() * STATES.length)] += 1 + Math.floor(rnd() * 4);
    if (rnd() < 0.7) ws[Math.floor(rnd() * STATES.length)] += 1 + Math.floor(rnd() * 3);
    return person(ws, makeSteps(ws, rnd), Math.sqrt(rnd()) * 0.86, rnd() * Math.PI * 2, rnd() < 0.2 ? rand(2.6, 3.6) : rand(1.4, 2.4));
  });
  const specks = Array.from({ length: 110 }, (_, i) => {
    const rnd = mulberry32(i * 131 + 7);
    const r = Math.sqrt(rnd()) * 0.98, a = rnd() * Math.PI * 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.9, s: 0.5 + rnd() * 0.8, tw: 0.5 + rnd() * 2, ph: rnd() * 6 };
  });
  let me = null, people = others, links = [];
  function rebuildPeople() {
    me = state.sent && state.blend ? person(state.blend, mySteps(), state.sent.r, state.sent.a, 4.2, true) : null;
    people = me ? [...others, me] : others;
    // нити созвездий: каждая точка тянется к ближайшим соседям
    links = [];
    const seen = new Set();
    people.forEach((p, i) => {
      people.map((o, j) => ({ j, d: Math.hypot(o.x - p.x, o.y - p.y) }))
        .filter((o) => o.j !== i).sort((a, b) => a.d - b.d).slice(0, p.size > 2.5 ? 2 : 1)
        .forEach(({ j, d }) => {
          const key = Math.min(i, j) + '-' + Math.max(i, j);
          if (d > 0.45 || seen.has(key)) return;
          seen.add(key);
          links.push([i, j]);
        });
    });
  }

  // песни альбома — звёзды-коллажи, разбросанные по большому небу; бумажные вырезки вертятся и дрейфуют.
  // небо больше экрана: его можно таскать и приближать, песни находятся, когда исследуешь
  const SKY = { x: 1.6, y: 1.1 };
  const songSpots = (() => {
    const rnd = mulberry32(2011), spots = [];
    for (let tries = 0; spots.length < SONGS.length && tries < 20000; tries++) {
      const p = { x: (rnd() * 2 - 1) * SKY.x, y: (rnd() * 2 - 1) * SKY.y };
      if ((p.x / 0.74) ** 2 + ((p.y - 0.02) / 0.44) ** 2 < 1) continue;          // не на орбите
      // первые четыре выглядывают по краям первого экрана, остальные ждут, пока небо потаскают
      const inView = Math.abs(p.x) < 0.74 && Math.abs(p.y) < 0.44;
      if ((spots.length < 4) !== inView) continue;
      if (spots.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.42)) continue;   // не слипаются
      spots.push(p);
    }
    return spots;
  })();
  const songs = SONGS.map((name, i) => {
    const rnd = mulberry32(i * 977 + 13);
    const img = new Image();
    img.src = `songs/${name.replace(' ', '-')}.png`;
    return {
      name, img, back: null,
      home: songSpots[i], drift: rnd() * 6, size: 0.11 + rnd() * 0.06,
      accent: STATES[i % STATES.length].color,
      spin: rnd() * Math.PI * 2, speed: (0.25 + rnd() * 0.2) * (rnd() < 0.5 ? -1 : 1),
      tilt: (rnd() - 0.5) * 0.5, bob: rnd() * 6, face: 0,
    };
  });
  // изнанка вырезки — та же картинка, только тёмная, как обратная сторона бумаги
  function backOf(sg) {
    if (sg.back || !sg.img.complete || !sg.img.naturalWidth) return sg.back;
    const c = document.createElement('canvas');
    c.width = sg.img.naturalWidth; c.height = sg.img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(sg.img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(14, 15, 20, .82)';
    g.fillRect(0, 0, c.width, c.height);
    return (sg.back = c);
  }
  const songPos = (sg) => {
    const t = now() * 0.05 + sg.drift;
    return { x: sg.home.x + Math.sin(t) * 0.05, y: sg.home.y + Math.cos(t * 0.8) * 0.035 };
  };
  const dust = Array.from({ length: 360 }, () => ({ x: rand(-2.6, 2.6), y: rand(-1.8, 1.8), s: rand(0.4, 1.3), tw: rand(0.5, 2), ph: rand(0, 6) }));

  // ---------- камера ----------
  const cam = { x: 0, y: 0, z: 1 };
  const camT = { x: 0, y: 0, z: 1 };
  let follow = null;
  const S = (p) => [W / 2 + (p.x - cam.x) * M * cam.z, H / 2 + (p.y - cam.y) * M * cam.z];

  // ======================================================================
  // ЗВУК: отклики на наведение и симфония общей планеты
  // ======================================================================
  let ac = null, out, verb, drone = null;
  function ensureAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    out = ac.createGain(); out.gain.value = 0.5;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    out.connect(comp); comp.connect(ac.destination);
    verb = ac.createConvolver();
    const len = ac.sampleRate * 4, ib = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ib.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    verb.buffer = ib;
    const wet = ac.createGain(); wet.gain.value = 0.45;
    verb.connect(wet); wet.connect(out);
  }

  function bell(f, t, gain, pan, dur = 2.4) {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.76;
    const g2 = ac.createGain(); g2.gain.value = 0.2;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g2); g2.connect(g);
    let node = g;
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); node = p; }
    node.connect(out); node.connect(verb);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  let lastPing = 0;
  function ping(harm) {
    if (!ac) return;
    const t = ac.currentTime;
    if (t - lastPing < 0.15) return;
    lastPing = t;
    bell(BASE * harm, t, 0.08, 0, 2);
  }

  // симфония: общий такт; в каждом такте играет часть людей по кругу, ваша точка — всегда
  let listening = false, symTimer = null, symNext = 0, symStep = 0, band = [];
  const noteEvents = [];
  function pickState(ws) {
    let r = Math.random() * sum(ws), k = 0;
    for (; k < ws.length - 1; k++) { r -= ws[k]; if (r <= 0) break; }
    return STATES[k];
  }
  function chooseBand(loopIdx) {
    const start = (loopIdx * BAND) % others.length;
    band = others.slice(start, start + BAND);
    if (band.length < BAND) band = band.concat(others.slice(0, BAND - band.length));
    if (me) band.push(me);
  }
  function symSchedule() {
    const stepDur = LOOP / STEPS;
    while (symNext < ac.currentTime + 0.15) {
      const s = symStep % STEPS;
      if (s === 0) chooseBand(Math.floor(symStep / STEPS));
      for (const p of band) {
        const v = p.steps[s];
        if (!v) continue;
        const st = pickState(p.ws);
        const f = BASE * st.harms[(Math.random() * st.harms.length) | 0] * st.oct;
        bell(f, symNext, p.you ? 0.1 : v === 2 ? 0.045 : 0.03, p.x * 1.2, p.you ? 3 : 2.4);
        noteEvents.push({ t: symNext, p });
      }
      symNext += stepDur;
      symStep++;
    }
  }
  function startSymphony() {
    ensureAudio();
    if (listening) return;
    listening = true;
    symNext = ac.currentTime + 0.1; symStep = 0;
    // тихий гул звезды под всеми — основной тон 55 Гц
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = BASE;
    const g = ac.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(0.06, ac.currentTime, 1.2);
    o.connect(g); g.connect(out); o.start();
    drone = { o, g };
    symTimer = setInterval(symSchedule, 25);
    updateUi();
  }
  function stopSymphony() {
    if (!listening) return;
    listening = false;
    clearInterval(symTimer);
    noteEvents.length = 0;
    band = [];
    if (drone) {
      const d = drone; drone = null;
      d.g.gain.setTargetAtTime(0, ac.currentTime, 0.4);
      d.o.stop(ac.currentTime + 2);
    }
    updateUi();
  }

  // ======================================================================
  // ПОЛЁТЫ
  // ======================================================================
  let inside = null, flightToken = 0, hovered = null, flight = null, waveHot = -1;

  function flyInto(kind, id) {
    ensureAudio();
    const token = ++flightToken;
    if (kind === 'star') follow = () => stationPos(id);
    else if (kind === 'personal') follow = personalPos;
    else follow = () => SHARED;
    camT.z = kind === 'shared' ? 2.1 : 9;
    document.body.classList.add('is-near');
    if (kind === 'shared') { startSymphony(); return; }
    setTimeout(() => { if (token === flightToken) openRoom(kind, id); }, 800);
  }

  function openRoom(kind, id) {
    const drops = state.drops || state.blend;
    const w = drops ? `&w=${drops.map((v) => +v.toFixed(2)).join(',')}` : '';
    frame.src = kind === 'star' ? `star.html?embed=1&star=${LESSONS[id].id}${w}` : `star.html?embed=1&mode=feel${w}`;
    room.classList.add('is-open');
    document.body.classList.add('is-inside');
    inside = { kind, id };
    updateUi();
  }

  function back() {
    flightToken++;
    stopSymphony();
    cancelOutside();
    if (inside) {
      room.classList.remove('is-open');
      document.body.classList.remove('is-inside');
      setTimeout(() => { if (!inside) frame.src = 'about:blank'; }, 750);   // остановить звук внутри
      inside = null;
    }
    follow = null;
    camT.x = 0; camT.y = 0; camT.z = 1;
    document.body.classList.remove('is-near');
    updateUi();
  }

  // ======================================================================
  // СНАРУЖИ: 10 секунд звука вокруг — звуковая волна вокруг планеты
  // ======================================================================
  const REC_DUR = 10, WAVE_N = 96;
  const PITCH = ['#b18cff', '#7aa8ff', '#7ad7ff', '#5ee0c8', '#9cff6e', '#ffe14d', '#ffb238', '#ff8a3d', '#ff5a5f', '#ff7ac6']; // низкое → высокое
  const CAL = { cLo: 200, cHi: 5000, dbLo: -55, dbHi: -13 };
  let outsideOpen = false, rec = null, worldBuf = null;    // запись места живёт только в этом визите и никуда не уходит

  function flyOutside() {
    ensureAudio();
    flightToken++;
    follow = personalPos;
    camT.z = 2.6;
    outsideOpen = true;
    outStatus.textContent = 'hear what is around you · 10 seconds';
    document.body.classList.add('is-near');
    updateUi();
  }

  function measure(an, fbuf, tbuf) {
    an.getFloatTimeDomainData(tbuf);
    an.getFloatFrequencyData(fbuf);
    let sq = 0;
    for (let i = 0; i < tbuf.length; i++) sq += tbuf[i] * tbuf[i];
    const db = 20 * Math.log10(Math.sqrt(sq / tbuf.length) + 1e-9);
    const binHz = ac.sampleRate / an.fftSize;
    let sumP = 0, wsum = 0;
    for (let i = 1; i < fbuf.length; i++) {
      const hz = i * binHz;
      if (hz < 60 || hz > 12000) continue;
      const p = Math.pow(10, fbuf[i] / 10);
      sumP += p; wsum += p * hz;
    }
    const centroid = sumP > 0 ? wsum / sumP : 1000;
    return [clamp01((db - CAL.dbLo) / (CAL.dbHi - CAL.dbLo)), clamp01(Math.log(centroid / CAL.cLo) / Math.log(CAL.cHi / CAL.cLo))];
  }

  async function startOutside(kind) {
    ensureAudio();
    if (rec) return;
    const an = ac.createAnalyser();
    an.fftSize = 2048; an.smoothingTimeConstant = 0.4;
    const mute = ac.createGain(); mute.gain.value = 0;
    an.connect(mute); mute.connect(ac.destination);
    const r = { an, fbuf: new Float32Array(an.frequencyBinCount), tbuf: new Float32Array(an.fftSize), samples: [], acc: [0, 0, 0] };
    if (kind === 'mic') {
      if (!navigator.mediaDevices || !window.MediaRecorder) { outStatus.textContent = 'this browser cannot record · choose a place'; return; }
      outStatus.textContent = 'allow access to the microphone';
      try {
        r.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch (e) { outStatus.textContent = 'no access to the microphone · choose a place'; return; }
      if (!outsideOpen) { r.stream.getTracks().forEach((tr) => tr.stop()); return; }
      r.src = ac.createMediaStreamSource(r.stream);
      r.src.connect(an);                                      // в колонки не идёт — иначе эхо
      r.mr = new MediaRecorder(r.stream);
      r.chunks = [];
      r.mr.ondataavailable = (e) => { if (e.data.size) r.chunks.push(e.data); };
      r.mr.start();
      outStatus.textContent = 'listening to where you are · 10 seconds';
    } else {
      outStatus.textContent = `gathering the sound of the ${kind}…`;
      const buf = await makeDemo(kind);
      if (!outsideOpen) return;
      r.src = ac.createBufferSource(); r.src.buffer = buf;
      const quiet = ac.createGain(); quiet.gain.value = 0.35;   // звук места в колонках — втрое тише, анализ — в полную силу
      r.src.connect(quiet); quiet.connect(out); r.src.connect(an);
      r.src.start();
      worldBuf = buf;
      outStatus.textContent = `${kind} · listening · 10 seconds`;
    }
    r.start = ac.currentTime;
    rec = r;
    document.body.classList.add('is-recording');
  }

  // каждый кадр записи: громкость → длина луча волны, высота → цвет
  function tickOutside() {
    if (!rec || !ac) return;
    const [l, b] = measure(rec.an, rec.fbuf, rec.tbuf);
    rec.acc[0] += l; rec.acc[1] += b; rec.acc[2]++;
    const el = ac.currentTime - rec.start;
    while (rec.samples.length < Math.min(WAVE_N, Math.floor((el / REC_DUR) * WAVE_N))) {
      const n = rec.acc[2] || 1;
      rec.samples.push([+(rec.acc[0] / n).toFixed(2), +(rec.acc[1] / n).toFixed(2)]);
      rec.acc = [0, 0, 0];
    }
    if (el >= REC_DUR) finishOutside();
  }

  function finishOutside() {
    const r = rec;
    rec = null;
    document.body.classList.remove('is-recording');
    state.wave = r.samples;
    save();
    if (r.mr) {
      r.mr.onstop = async () => {
        try { worldBuf = await ac.decodeAudioData(await new Blob(r.chunks, { type: r.mr.mimeType || 'audio/webm' }).arrayBuffer()); } catch (e) { /* без прослушивания */ }
      };
      r.mr.stop();
      r.stream.getTracks().forEach((tr) => tr.stop());
      r.src.disconnect();
    }
    outStatus.textContent = 'your planet is complete';
    ping(4);
    updateUi();
  }

  function cancelOutside() {
    outsideOpen = false;
    if (!rec) return;
    const r = rec;
    rec = null;
    document.body.classList.remove('is-recording');
    try { if (r.mr) { r.mr.stop(); r.stream.getTracks().forEach((tr) => tr.stop()); } else r.src.stop(); } catch (e) { /* уже остановлено */ }
  }

  // кусочек записи под курсором — тот момент, из которого вырос этот луч волны
  const grainCool = {};
  function playGrain(i) {
    if (!worldBuf || !ac) return;
    const t = ac.currentTime;
    if (grainCool[i] && t - grainCool[i] < 0.3) return;
    grainCool[i] = t;
    const src = ac.createBufferSource(); src.buffer = worldBuf;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.4, t + 0.03);
    g.gain.setValueAtTime(0.4, t + 0.28); g.gain.linearRampToValueAtTime(0, t + 0.4);
    src.connect(g); g.connect(out);
    src.start(t, Math.min((i / WAVE_N) * REC_DUR, worldBuf.duration - 0.45), 0.42);
  }

  // звуки мест (синтез, чтобы работало без микрофона) — те же, что в эскизе кристалла
  const demoCache = {};
  async function makeDemo(name) {
    if (demoCache[name]) return demoCache[name];
    const sr = 44100, DUR = REC_DUR;
    const oc = new OfflineAudioContext(1, sr * DUR, sr);
    const o = oc.createGain(); o.connect(oc.destination);
    const noiseBuf = (sec) => {
      const b = oc.createBuffer(1, Math.max(1, (sr * sec) | 0), sr), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    };
    const noise = (type, freq, q, gain, start = 0, dur = DUR) => {
      const s = oc.createBufferSource(); s.buffer = noiseBuf(dur);
      const f = oc.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = oc.createGain(); g.gain.value = gain;
      s.connect(f); f.connect(g); g.connect(o); s.start(start);
      return g;
    };
    const tone = (type, f0, f1, t, dur, gain, hold = false) => {
      const os = oc.createOscillator(); os.type = type;
      os.frequency.setValueAtTime(f0, t);
      os.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = oc.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.006);
      if (hold) { g.gain.setValueAtTime(gain, t + dur - 0.05); g.gain.linearRampToValueAtTime(0, t + dur); }
      else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      os.connect(g); g.connect(o); os.start(t); os.stop(t + dur + 0.02);
    };
    const curve = (fn, n = 240) => Float32Array.from({ length: n }, (_, i) => fn((i / (n - 1)) * DUR));
    if (name === 'forest') {
      noise('bandpass', 500, 0.6, 1).gain.setValueCurveAtTime(curve((t) => 0.05 + 0.035 * Math.sin(t * 0.8)), 0, DUR);
      for (let k = 0; k < 12; k++) {
        const t0 = rand(0.2, 9.2), f = rand(2600, 4200), reps = 2 + ((Math.random() * 4) | 0);
        for (let r = 0; r < reps; r++) tone('sine', f, f * rand(1.2, 1.6), t0 + r * 0.11, 0.07, 0.18);
      }
      for (let k = 0; k < 3; k++) { const t0 = rand(1, 8.4); tone('sine', 900, 700, t0, 0.35, 0.12); tone('sine', 900, 650, t0 + 0.45, 0.4, 0.1); }
    } else if (name === 'city') {
      noise('lowpass', 180, 0.7, 1).gain.setValueCurveAtTime(curve((t) => 0.45 + 0.25 * Math.sin(t * 0.6 + 1)), 0, DUR);
      noise('bandpass', 1200, 0.8, 0.03);
      [2.6, 7.1].forEach((t) => { tone('sawtooth', 392, 390, t, 0.6, 0.05, true); tone('sawtooth', 466, 464, t, 0.6, 0.04, true); });
      for (let t = 0.8; t < 6; t += rand(0.45, 0.6)) {
        const g = noise('highpass', 1800, 0.7, 0, t, 0.06);
        g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      }
    } else if (name === 'sea') {
      noise('lowpass', 700, 0.5, 1).gain.setValueCurveAtTime(curve((t) => 0.04 + 0.5 * Math.pow(Math.max(0, Math.sin(t * 1.75 - 0.5)), 2)), 0, DUR);
      noise('highpass', 3000, 0.5, 1).gain.setValueCurveAtTime(curve((t) => 0.002 + 0.12 * Math.pow(Math.max(0, Math.sin(t * 1.75 - 0.9)), 6)), 0, DUR);
      tone('sine', 1400, 1000, 6.2, 0.5, 0.06); tone('sine', 1500, 1050, 6.8, 0.45, 0.05);
    } else {
      noise('lowpass', 7000, 0.5, 0.1);
      noise('highpass', 2500, 0.5, 0.05);
      for (let k = 0; k < 450; k++) tone('sine', rand(1800, 4200), rand(1500, 3000), rand(0, 9.9), 0.025, rand(0.02, 0.07));
      const th = noise('lowpass', 110, 0.8, 0, 5.5, 4.4);
      th.gain.setValueAtTime(0, 5.5); th.gain.linearRampToValueAtTime(0.9, 5.7); th.gain.exponentialRampToValueAtTime(0.001, 9.8);
    }
    const buf = await oc.startRendering();
    const d = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    if (peak > 0) for (let i = 0; i < d.length; i++) d[i] *= 0.8 / peak;
    return (demoCache[name] = buf);
  }

  // точка-осколок летит с планеты эмоций на общую
  function sendPoint() {
    if (!orbitClosed() || !state.blend || !state.wave || flight) return;
    ensureAudio();
    back();
    setTimeout(() => {
      const r = Math.sqrt(rand(0.05, 0.6)), a = rand(0, Math.PI * 2);
      flight = { color: blendNow().color, start: now(), dur: 2.6, from: personalPos(), r, a };
      updateUi();
    }, 700);
  }
  function land(f) {
    state.sent = { r: f.r, a: f.a };
    save();
    rebuildPeople();
    if (me) me.excite = 1;
    ping(4);
    updateUi();
  }

  // комната загрузилась — отдаём ей рисунок человека
  frame.addEventListener('load', () => {
    if (!inside || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: 'biophilia:init', strokes: state.strokes || [] }, location.origin);
  });

  // смесь, капли, рисунок и ритм приходят из планеты эмоций и со станций одинаково
  function takeReport(d) {
    state.blend = d.weights && sum(d.weights) > 0.05 ? d.weights : null;
    if (d.drops) state.drops = d.drops;
    if (d.strokes) {
      state.strokes = d.strokes;
      state.rhythm = d.rhythm && d.rhythm.some((v) => v) ? { steps: d.rhythm, loop: d.loop } : null;
    }
  }
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data) return;
    const d = e.data;
    if (d.type === 'biophilia:feel') {
      takeReport(d);
      save(); rebuildPeople(); updateUi();
    } else if (d.type === 'biophilia:star') {
      const l = LESSONS.find((x) => x.id === d.star);
      if (!l) return;
      takeReport(d);
      if (d.passed) state.stars[l.id] = true;
      save(); rebuildPeople(); updateUi();
    } else if (d.type === 'biophilia:back') {
      back();                                   // Esc, нажатый внутри
    }
  });

  // ======================================================================
  // РИСОВАНИЕ
  // ======================================================================
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    M = Math.min(W, H);
  }

  function label(text, x, y, size = 12, alpha = 0.8, color = CREAM) {
    ctx.font = `300 ${size}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
  }

  function rhythmPulse(steps, t) {
    if (!steps) return 0;
    const ph = (t % LOOP) / LOOP;
    const s = Math.floor(ph * STEPS);
    const v = steps[s];
    return v ? (v === 2 ? 1 : 0.6) * Math.exp(-(ph * STEPS - s) * 4) : 0;
  }

  function orbitArc(ox, oy, a0, a1, color, alpha, width) {
    ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = width;
    ctx.beginPath(); ctx.ellipse(ox, oy, orbitRX() * M * cam.z, ORBIT_RY * M * cam.z, 0, a0, a1); ctx.stroke();
  }

  let lastT = now();
  function draw() {
    const t = now();
    const dt = Math.min(0.1, t - lastT);
    lastT = t;

    // планета перелетает по орбите к своей станции (пока вы в комнате — ждёт)
    const ta = targetA();
    if (ta < planetA) planetA = ta;
    else if (!inside) planetA = Math.min(ta, planetA + dt * 0.55);

    // камера
    if (follow) { const p = follow(); camT.x = p.x; camT.y = p.y; }
    const k = 1 - Math.pow(0.04, dt);
    cam.x = lerp(cam.x, camT.x, k); cam.y = lerp(cam.y, camT.y, k);
    cam.z = Math.exp(lerp(Math.log(cam.z), Math.log(camT.z), k));

    ctx.clearRect(0, 0, W, H);
    if (inside && room.classList.contains('is-open') && cam.z > 8.5) { requestAnimationFrame(draw); return; }

    const zf = Math.min(cam.z, 3);
    const blend = blendNow();

    // пыль со слабым параллаксом
    ctx.fillStyle = CREAM;
    for (const d of dust) {
      const x = W / 2 + (d.x - cam.x * 0.3) * M * (1 + (cam.z - 1) * 0.12);
      const y = H / 2 + (d.y - cam.y * 0.3) * M * (1 + (cam.z - 1) * 0.12);
      if (x < -5 || y < -5 || x > W + 5 || y > H + 5) continue;
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * d.tw + d.ph);
      ctx.fillRect(x, y, d.s, d.s);
    }
    ctx.globalAlpha = 1;

    // ---- звёзды песен альбома: разбросаны по небу, вертятся ----
    const sp = songs.map((sg) => S(songPos(sg)));
    songs.forEach((sg, i) => {
      const hv = hovered && hovered.kind === 'song' && hovered.id === i;
      // при наведении звезда разворачивается лицом к вам
      sg.face = lerp(sg.face, hv ? 1 : 0, 1 - Math.pow(0.02, dt));
      sg.spin += dt * sg.speed * (1 - sg.face);
      const turn = Math.atan2(Math.sin(sg.spin), Math.cos(sg.spin));
      const ang = lerp(turn, 0, sg.face);
      const im = Math.cos(ang) >= 0 ? sg.img : backOf(sg);
      if (!im || !sg.img.complete || !sg.img.naturalWidth) return;
      const [x, y0] = sp[i];
      const y = y0 + Math.sin(t * 0.6 + sg.bob) * 4;
      if (x < -200 || x > W + 200 || y0 < -200 || y0 > H + 200) return;      // за краем экрана
      const size = sg.size * M * Math.min(cam.z, 2.5) * (1 + sg.face * 0.3);
      const k = size / Math.max(sg.img.naturalWidth, sg.img.naturalHeight);
      const w = sg.img.naturalWidth * k, h = sg.img.naturalHeight * k;
      const sx = Math.abs(Math.cos(ang));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sg.tilt * (1 - sg.face) + Math.sin(t * 0.3 + sg.bob) * 0.05);
      // толщина бумаги: тёмная кромка, видна, когда звезда повёрнута боком
      ctx.globalAlpha = 0.9;
      ctx.scale(Math.max(0.04, sx), 1);
      if (sx < 0.97) ctx.drawImage(backOf(sg) || sg.img, -w / 2 + (Math.sin(ang) > 0 ? 3 : -3) / Math.max(0.2, sx), -h / 2, w, h);
      ctx.globalAlpha = 0.55 + 0.45 * sx + sg.face * 0.2;
      ctx.drawImage(im, -w / 2, -h / 2, w, h);
      ctx.restore();
      // цветная бусина над звездой, как на слайде
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.8;
      ctx.drawImage(sprite(sg.accent), x - 8, y - h / 2 - 14, 16, 16);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      if (hv) label('soon: its own app', x, y + h / 2 + 16, 10, 0.6);
    });

    // ---- орбита: весь путь пунктиром, пройденные дуги горят ----
    const [ox, oy] = S(SHARED);
    ctx.save();
    ctx.setLineDash([2, 9]);
    orbitArc(ox, oy, 0, Math.PI * 2, CREAM, 0.18, 1);
    ctx.restore();
    SEGMENTS.forEach(([a0, a1], j) => {
      const done = j < LESSONS.length ? state.stars[LESSONS[j].id] : orbitClosed();
      if (!done) return;
      const f = clamp01((planetA - a0) / (a1 - a0));
      if (f <= 0) return;
      const col = blend.W ? blend.color : CREAM;
      orbitArc(ox, oy, a0, a0 + (a1 - a0) * f, col, 0.14, 7);
      orbitArc(ox, oy, a0, a0 + (a1 - a0) * f, col, 0.85, 1.8);
    });
    ctx.globalAlpha = 1;
    label('learning orbit', ox + orbitRX() * M * cam.z * 0.7, oy + ORBIT_RY * M * cam.z * 0.86, 10, 0.4);

    // ---- общая планета из осколков ----
    const R = SHARED.r * M * cam.z;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.1 + (hovered && hovered.kind === 'shared' ? 0.06 : 0) + (listening ? 0.08 : 0);
    ctx.drawImage(sprite('#5ee0c8'), ox - R * 2, oy - R * 2, R * 4, R * 4);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setLineDash([2, 7]); ctx.strokeStyle = CREAM; ctx.lineWidth = 1;
    ctx.globalAlpha = listening ? 0.35 : 0.2;
    ctx.beginPath(); ctx.ellipse(ox, oy, R * 1.08, R * 1.08 * 0.9, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = CREAM;
    for (const sp of specks) {
      ctx.globalAlpha = 0.2 + 0.25 * Math.sin(t * sp.tw + sp.ph);
      ctx.fillRect(ox + sp.x * R, oy + sp.y * R, sp.s, sp.s);
    }
    if (ac) while (noteEvents.length && noteEvents[0].t <= ac.currentTime) noteEvents.shift().p.excite = 1;
    const P = (p) => [ox + p.x * R, oy + p.y * R];
    ctx.lineWidth = 0.8; ctx.strokeStyle = CREAM;
    links.forEach(([i, j]) => {
      const [ax, ay] = P(people[i]), [bx, by] = P(people[j]);
      ctx.globalAlpha = 0.16 + 0.3 * Math.max(people[i].excite, people[j].excite);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    });
    ctx.globalCompositeOperation = 'lighter';
    people.forEach((p) => {
      p.excite = Math.max(0, p.excite - dt * 1.1);
      const [x, y] = P(p);
      const pulse = rhythmPulse(p.steps, t);
      const inBand = listening && band.includes(p);
      const size = p.size * Math.min(zf, 2.2) * 0.75;
      const g = size * (p.you ? 11 : 8) * (1 + pulse * 0.35 + p.excite * 1.4);
      ctx.globalAlpha = (listening && !inBand ? 0.35 : 0.75) + p.excite * 0.25;
      ctx.drawImage(sprite(p.color), x - g / 2, y - g / 2, g, g);
      ctx.globalAlpha = listening && !inBand ? 0.5 : 1;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
      if (p.size > 2.5 || p.you) {
        ctx.fillStyle = CREAM;
        ctx.beginPath(); ctx.arc(x, y, size * 0.4, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (me) {
      const [x, y] = P(me);
      ctx.strokeStyle = CREAM; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(x, y, 9 * Math.min(zf, 2), 0, Math.PI * 2); ctx.stroke();
      label('you', x, y - 14 * Math.min(zf, 2), 10, 0.75);
    }
    label('shared planet', ox, oy + R * 1.08 + 22, 12, 0.75);
    label(listening ? 'listening · everyone together' : `${people.length} people · click to listen`, ox, oy + R * 1.08 + 40, 10, 0.45);

    // ---- станции на орбите ----
    const next = blend.W ? nextLesson() : -1;
    LESSONS.forEach((l, i) => {
      const [x, y] = S(stationPos(i));
      const done = !!state.stars[l.id];
      const isNext = i === next;
      const dim = !done && !isNext;
      const hv = hovered && hovered.kind === 'star' && hovered.id === i;
      const col = done && blend.W ? blend.color : CREAM;
      ctx.globalCompositeOperation = 'lighter';
      // крохотное облако состояний вокруг станции
      for (let c = 0; c < 12; c++) {
        const a = (c / 12) * Math.PI * 2 + t * (0.3 + (c % 3) * 0.1);
        const rr = (14 + (c % 4) * 3) * zf;
        ctx.globalAlpha = dim ? 0.2 : 0.5;
        ctx.fillStyle = STATES[c % 6].color;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.82, 1.1 * Math.min(zf, 2), 0, Math.PI * 2); ctx.fill();
      }
      const g = (done ? 42 : 32) * zf * (hv ? 1.25 : 1);
      ctx.globalAlpha = done ? 0.95 : dim ? 0.3 : 0.7;
      ctx.drawImage(sprite(col), x - g / 2, y - g / 2, g, g);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = dim ? 0.5 : 1;
      ctx.fillStyle = CREAM;
      ctx.beginPath(); ctx.arc(x, y, 2.6 * Math.min(zf, 2), 0, Math.PI * 2); ctx.fill();
      if (isNext) {                                   // следующая станция зовёт
        const u = (t * 0.5) % 1;
        ctx.strokeStyle = CREAM; ctx.lineWidth = 1; ctx.globalAlpha = 0.5 * (1 - u);
        ctx.beginPath(); ctx.arc(x, y, (10 + u * 22) * Math.min(zf, 2), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // подпись — снаружи орбиты
      const lx = x + Math.cos(l.a) * 46 * zf, ly = y + Math.sin(l.a) * 30 * zf + (Math.sin(l.a) < -0.5 ? -6 : 4);
      label(l.id, lx, ly, 12, dim ? 0.45 : 0.9);
      label(done ? 'heard' : l.what, lx, ly + 15, 10, dim ? 0.3 : 0.6, done && blend.W ? blend.color : CREAM);
    });

    // ---- планета эмоций ----
    const [px, py] = S(personalPos());
    const pulse = rhythmPulse(blend.W ? mySteps() : null, t);
    const hp = hovered && hovered.kind === 'personal';
    const pr = 0.045 * M * cam.z * (1 + pulse * 0.08) * (hp ? 1.08 : 1);
    // снаружи — звуковая волна места: громкость — длина луча, высота — цвет
    tickOutside();
    const wave = rec ? rec.samples : state.wave;
    if (wave && wave.length) {
      const r0 = pr * 1.75, rot = t * 0.02;
      const tip = (i) => {
        const [l] = wave[i];
        const a = -Math.PI / 2 + (i / WAVE_N) * Math.PI * 2 + rot;
        const len = pr * (0.08 + 0.95 * l) * (1 + 0.06 * Math.sin(t * 2 + i * 0.4) + (waveHot === i ? 0.35 : 0));
        return [a, len];
      };
      ctx.lineWidth = Math.max(1, pr * 0.025); ctx.lineCap = 'round';
      wave.forEach(([, b], i) => {
        const [a, len] = tip(i);
        ctx.strokeStyle = PITCH[Math.min(9, Math.floor(b * 10))];
        ctx.globalAlpha = waveHot === i ? 1 : 0.75;
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0);
        ctx.lineTo(px + Math.cos(a) * (r0 + len), py + Math.sin(a) * (r0 + len));
        ctx.stroke();
      });
      ctx.strokeStyle = CREAM; ctx.globalAlpha = 0.25; ctx.lineWidth = 0.8;
      ctx.beginPath();
      wave.forEach((_, i) => {
        const [a, len] = tip(i);
        const x = px + Math.cos(a) * (r0 + len), y = py + Math.sin(a) * (r0 + len);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      if (wave.length === WAVE_N) ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (orbitClosed() && state.blend && !outsideOpen) {   // орбита замкнута — планета зовёт наружу
      const u = (t * 0.45) % 1;
      ctx.strokeStyle = CREAM; ctx.lineWidth = 1; ctx.globalAlpha = 0.55 * (1 - u);
      ctx.beginPath(); ctx.arc(px, py, pr * (1.75 + u * 1.1), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 + pulse * 0.25;
    ctx.drawImage(sprite(blend.color), px - pr * 2.6, py - pr * 2.6, pr * 5.2, pr * 5.2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = blend.W ? rgba(blend.color, 0.22) : 'rgba(242,239,230,.08)';
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = blend.W ? blend.color : CREAM; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.2; ctx.stroke();
    if (blend.W) {                                  // кольцо смеси
      let a0 = -Math.PI / 2;
      ctx.lineWidth = 2;
      blend.ws.forEach((w, i) => {
        if (w <= 0.05) return;
        const span = (w / blend.W) * Math.PI * 2;
        ctx.strokeStyle = STATES[i].color; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(px, py, pr * 1.45, a0 + 0.05, a0 + span - 0.05); ctx.stroke();
        a0 += span;
      });
    } else {                                        // пустая планета зовёт: начните отсюда
      const u = (t * 0.5) % 1;
      ctx.strokeStyle = CREAM; ctx.lineWidth = 1; ctx.globalAlpha = 0.5 * (1 - u);
      ctx.beginPath(); ctx.arc(px, py, pr * (1.2 + u * 0.8), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    label('planet of', px, py - 3, 10, 0.7);
    label('emotions', px, py + 11, 11, 0.9);
    // рисунок человека — внутри его планеты
    if (state.strokes && state.strokes.length) {
      ctx.save();
      ctx.beginPath(); ctx.arc(px, py, pr * 0.98, 0, Math.PI * 2); ctx.clip();
      const kk = pr / 0.3;
      ctx.lineWidth = Math.max(0.8, pr * 0.03); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      state.strokes.forEach((st) => {
        ctx.strokeStyle = STATES[st.k].color; ctx.globalAlpha = 0.85;
        ctx.beginPath();
        st.pts.forEach(([x, y], i) => (i ? ctx.lineTo(px + x * kk, py + y * kk) : ctx.moveTo(px + x * kk, py + y * kk)));
        ctx.stroke();
      });
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (blend.name) label(blend.name, px, py + pr * 1.45 + 18, 10, 0.75, blend.color);
    else if (hp) label('fly in · how are you?', px, py + pr * 1.45 + 18, 10, 0.7);
    if (hp && orbitClosed() && state.blend && !state.wave) label('hear what is around you', px, py - pr * 1.9, 10, 0.8);

    // ---- точка в полёте ----
    if (flight) {
      const u = clamp01((t - flight.start) / flight.dur);
      const e = easeInOut(u);
      const from = flight.from;
      const to = { x: SHARED.x + Math.cos(flight.a) * flight.r * SHARED.r, y: SHARED.y + Math.sin(flight.a) * flight.r * SHARED.r * 0.9 };
      const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 0.18 };
      const pos = {
        x: (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * ctrl.x + e * e * to.x,
        y: (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * ctrl.y + e * e * to.y,
      };
      const [fx, fy] = S(pos);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1;
      ctx.drawImage(sprite(flight.color), fx - 16, fy - 16, 32, 32);
      ctx.drawImage(sprite('#fff3dc'), fx - 6, fy - 6, 12, 12);
      ctx.globalCompositeOperation = 'source-over';
      if (u >= 1) { const f = flight; flight = null; land(f); }
    }

    requestAnimationFrame(draw);
  }

  // ---------- наведение и клики ----------
  function hitTest(x, y) {
    const zf = Math.min(cam.z, 3);
    for (let i = 0; i < songs.length; i++) {
      const [sx, sy] = S(songPos(songs[i]));
      if (Math.hypot(sx - x, sy - y) < 0.06 * M * Math.min(cam.z, 2.5)) return { kind: 'song', id: i };
    }
    for (let i = 0; i < LESSONS.length; i++) {
      const [sx, sy] = S(stationPos(i));
      if (Math.hypot(sx - x, sy - y) < 24 * zf) return { kind: 'star', id: i };
    }
    const [px, py] = S(personalPos());
    if (Math.hypot(px - x, py - y) < 0.045 * M * cam.z + 10) return { kind: 'personal' };
    const [ox, oy] = S(SHARED);
    if (Math.hypot(ox - x, oy - y) < SHARED.r * M * cam.z * 1.1) return { kind: 'shared' };
    return null;
  }

  // небо можно таскать мышью и приближать колёсиком — песни находятся, когда исследуешь
  let drag = null, dragged = false;
  const CAM_LIM = { x: SKY.x - 0.4, y: SKY.y - 0.3 };
  canvas.addEventListener('pointerdown', (e) => {
    if (inside || follow) return;
    drag = { x: e.clientX, y: e.clientY, cx: camT.x, cy: camT.y, moved: false };
  });
  window.addEventListener('pointerup', () => {
    if (drag) { dragged = drag.moved; drag = null; document.body.classList.remove('is-dragging'); }
  });
  canvas.addEventListener('wheel', (e) => {
    if (inside || follow) return;
    e.preventDefault();
    camT.z = Math.max(0.6, Math.min(1.8, camT.z * Math.exp(-e.deltaY * 0.0012)));
    document.body.classList.add('was-dragged');
  }, { passive: false });

  canvas.addEventListener('pointermove', (e) => {
    if (inside) return;
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; document.body.classList.add('is-dragging', 'was-dragged'); }
      if (drag.moved) {
        camT.x = Math.max(-CAM_LIM.x, Math.min(CAM_LIM.x, drag.cx - dx / (M * cam.z)));
        camT.y = Math.max(-CAM_LIM.y, Math.min(CAM_LIM.y, drag.cy - dy / (M * cam.z)));
        cam.x = camT.x; cam.y = camT.y;
        return;
      }
    }
    // волна вокруг планеты: под курсором — тот момент записи
    waveHot = -1;
    if (state.wave) {
      const [px, py] = S(personalPos());
      const pr = 0.045 * M * cam.z, d = Math.hypot(e.clientX - px, e.clientY - py);
      if (d > pr * 1.6 && d < pr * 2.9) {
        let a = Math.atan2(e.clientY - py, e.clientX - px) + Math.PI / 2 - now() * 0.02;
        a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        waveHot = Math.min(WAVE_N - 1, Math.floor((a / (Math.PI * 2)) * WAVE_N));
        playGrain(waveHot);
      }
    }
    const h = hitTest(e.clientX, e.clientY);
    const changed = JSON.stringify(h) !== JSON.stringify(hovered);
    hovered = h;
    canvas.style.cursor = h ? 'pointer' : '';
    if (changed && h && !listening) ping(h.kind === 'star' ? LESSONS[h.id].harm : h.kind === 'personal' ? 6 : h.kind === 'song' ? 3 + h.id : 4);
  });
  canvas.addEventListener('click', (e) => {
    if (inside) return;
    if (dragged) { dragged = false; return; }                   // это было перетаскивание, не клик
    let h = hitTest(e.clientX, e.clientY);
    if (h && h.kind === 'song') h = null;                       // приложения песен — позже
    if (h && h.kind === 'personal' && orbitClosed() && state.blend && !state.wave) { if (!outsideOpen) flyOutside(); return; }
    if (outsideOpen && !h) { if (!rec) back(); return; }
    if (h && h.kind === 'shared' && listening) back();          // второй клик — тишина
    else if (h && !(listening && h.kind !== 'shared')) flyInto(h.kind, h.id);
    else if (document.body.classList.contains('is-near')) back();
  });
  $('[data-back]').addEventListener('click', back);
  sendBtn.addEventListener('click', sendPoint);
  $('[data-rec]').addEventListener('click', () => startOutside('mic'));
  document.querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => startOutside(b.dataset.place)));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') back(); });
  $('[data-reset]').addEventListener('click', () => {
    back();
    state = empty(); save();
    worldBuf = null;
    planetA = targetA();
    rebuildPeople(); updateUi();
  });

  function updateUi() {
    const passed = passedCount();
    const b = blendNow();
    hud.passed.textContent = `${passed} / ${LESSONS.length}`;
    hud.blend.textContent = b.name || '—';
    hud.rhythm.textContent = state.rhythm ? `${state.rhythm.steps.filter(Boolean).length} beats drawn` : '—';
    hud.seeds.textContent = `${PEOPLE}${state.sent ? ' + you' : ''}`;
    const canSend = orbitClosed() && !!state.blend && !!state.wave && !state.sent && !flight;
    document.body.classList.toggle('can-send', canSend && !inside);
    document.body.classList.toggle('show-outside', outsideOpen && !state.wave);
    const n = nextLesson();
    hint.textContent = listening
      ? 'everyone sounds together · click the shared planet again for silence'
      : flight ? 'your point is flying to the shared planet'
      : !state.blend ? 'start with your planet of emotions: how are you right now?'
      : n >= 0 ? `fly to the ${LESSONS[n].id} station: hear ${LESSONS[n].what}`
      : !state.wave ? (outsideOpen ? 'outside your planet: what does your place sound like?' : 'the orbit is closed · now click your planet and hear what is around you')
      : !state.sent ? 'your planet is complete: inside — your feelings, outside — your place'
      : 'click the shared planet to hear everyone together';
  }

  window.addEventListener('resize', resize);
  resize();
  rebuildPeople();
  updateUi();
  requestAnimationFrame(draw);
})();

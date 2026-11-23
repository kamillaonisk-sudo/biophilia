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
  ];
  const BLENDS = {
    'calm+wonder': 'contemplation', 'anxiety+calm': 'vigilance', 'calm+tenderness': 'warmth',
    'calm+melancholy': 'solitude', 'calm+joy': 'contentment', 'anxiety+wonder': 'awe',
    'tenderness+wonder': 'enchantment', 'melancholy+wonder': 'reverie', 'joy+wonder': 'delight',
    'anxiety+tenderness': 'care', 'anxiety+melancholy': 'dread', 'anxiety+joy': 'excitement',
    'melancholy+tenderness': 'longing', 'joy+tenderness': 'affection', 'joy+melancholy': 'nostalgia',
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
  const empty = () => ({ blend: null, drops: null, strokes: [], stars: {}, rhythm: null, sent: null });
  let state = (() => { try { return { ...empty(), ...JSON.parse(localStorage.getItem(STORE)) }; } catch (e) { return empty(); } })();
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* живём без сохранения */ } }

  const sum = (ws) => ws.reduce((a, b) => a + b, 0);
  function blendOf(ws) {
    const W = ws ? sum(ws) : 0;
    if (W < 0.05) return { W: 0, ws: ws || [0, 0, 0, 0, 0, 0], color: CREAM, name: '' };
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
    return makeSteps(state.blend || [0, 0, 0, 0, 0, 0], mulberry32(seedOf(state.blend || [0])));
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
    const ws = [0, 0, 0, 0, 0, 0];
    ws[Math.floor(rnd() * 6)] += 1 + Math.floor(rnd() * 4);
    if (rnd() < 0.7) ws[Math.floor(rnd() * 6)] += 1 + Math.floor(rnd() * 3);
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

  // песни альбома — звёзды-коллажи по краям неба; бумажные вырезки медленно вертятся в пространстве
  const songs = SONGS.map((name, i) => {
    const rnd = mulberry32(i * 977 + 13);
    const img = new Image();
    img.src = `songs/${name.replace(' ', '-')}.png`;
    return {
      name, img, back: null,
      a: -Math.PI / 2 + ((i + 0.5) / SONGS.length) * Math.PI * 2,
      accent: STATES[i % STATES.length].color,
      spin: rnd() * Math.PI * 2, speed: (0.25 + rnd() * 0.2) * (rnd() < 0.5 ? -1 : 1),
      tilt: (rnd() - 0.5) * 0.5, bob: rnd() * 6, face: 0,
      beads: Array.from({ length: 4 }, () => STATES[Math.floor(rnd() * STATES.length)].color),
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
    const rx = (W / M) * 0.5 - 0.11, ry = (H / M) * 0.5 - 0.13;
    return { x: Math.cos(sg.a) * rx, y: Math.sin(sg.a) * ry };
  };
  const dust = Array.from({ length: 170 }, () => ({ x: rand(-1.6, 1.6), y: rand(-1, 1), s: rand(0.4, 1.3), tw: rand(0.5, 2), ph: rand(0, 6) }));

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
  let inside = null, flightToken = 0, hovered = null, flight = null;

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

  // точка-осколок летит с планеты эмоций на общую
  function sendPoint() {
    if (!orbitClosed() || !state.blend || flight) return;
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

    // ---- звёзды песен альбома: нити с бусинами между соседями, сами звёзды вертятся ----
    const sp = songs.map((sg) => S(songPos(sg)));
    ctx.lineWidth = 0.8;
    songs.forEach((sg, i) => {
      const [ax, ay] = sp[i], [bx, by] = sp[(i + 1) % songs.length];
      ctx.strokeStyle = CREAM; ctx.globalAlpha = 0.16;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      sg.beads.forEach((col, j) => {
        const u = 0.38 + j * 0.08;
        ctx.globalAlpha = 0.6; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(lerp(ax, bx, u), lerp(ay, by, u), 2, 0, Math.PI * 2); ctx.fill();
      });
    });
    ctx.globalAlpha = 1;
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
      const size = 0.13 * M * Math.min(cam.z, 2.5) * (1 + sg.face * 0.3);
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

  canvas.addEventListener('pointermove', (e) => {
    if (inside) return;
    const h = hitTest(e.clientX, e.clientY);
    const changed = JSON.stringify(h) !== JSON.stringify(hovered);
    hovered = h;
    canvas.style.cursor = h ? 'pointer' : '';
    if (changed && h && !listening) ping(h.kind === 'star' ? LESSONS[h.id].harm : h.kind === 'personal' ? 6 : h.kind === 'song' ? 3 + h.id : 4);
  });
  canvas.addEventListener('click', (e) => {
    if (inside) return;
    let h = hitTest(e.clientX, e.clientY);
    if (h && h.kind === 'song') h = null;                       // приложения песен — позже
    if (h && h.kind === 'shared' && listening) back();          // второй клик — тишина
    else if (h && !(listening && h.kind !== 'shared')) flyInto(h.kind, h.id);
    else if (document.body.classList.contains('is-near')) back();
  });
  $('[data-back]').addEventListener('click', back);
  sendBtn.addEventListener('click', sendPoint);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') back(); });
  $('[data-reset]').addEventListener('click', () => {
    back();
    state = empty(); save();
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
    const canSend = orbitClosed() && !!state.blend && !state.sent && !flight;
    document.body.classList.toggle('can-send', canSend && !inside);
    const n = nextLesson();
    hint.textContent = listening
      ? 'everyone sounds together · click the shared planet again for silence'
      : flight ? 'your point is flying to the shared planet'
      : !state.blend ? 'start with your planet of emotions: how are you right now?'
      : n >= 0 ? `fly to the ${LESSONS[n].id} station: hear ${LESSONS[n].what}`
      : !state.sent ? 'the orbit is closed · send your point to the shared planet'
      : 'click the shared planet to hear everyone together';
  }

  window.addEventListener('resize', resize);
  resize();
  rebuildPeople();
  updateUi();
  requestAnimationFrame(draw);
})();

/*
 * Эскиз: небо — карта мира.
 *
 * В центре — большая ОБЩАЯ планета (на месте взрыва из вступления).
 * Она растёт из кристаллов-семян всех людей; соседние кристаллы связаны нитями,
 * на стыках — бусины (там рождаются новые звуки).
 * Вокруг неё по орбите кружит маленькая ЛИЧНАЯ планета — планета эмоций.
 * Вокруг личной планеты — три звезды-урока (rhythm, timbre, silence).
 * По краям неба — далёкие созвездия песен альбома (только названия, без интерактива).
 *
 * Клик по звезде — камера влетает в неё, внутри открывается эскиз звезды.
 * Как только в звезде смешано состояние, она пройдена, нити между пройденными
 * звёздами загораются. Клик по личной планете — внутри эскиз кристалла,
 * окрашенный смесью эмоций; «plant» — кристалл летит на общую планету
 * и мерцает там в нарисованном ритме.
 *
 * Состояние хранится в браузере посетителя (localStorage). Настоящая общая
 * планета для всех потребует сервера — это следующий шаг.
 */
(() => {
  'use strict';

  const CREAM = '#f2efe6';
  const STATE_COLORS = ['#7ad7ff', '#ffe14d', '#ff5a5f', '#ff7ac6', '#b18cff', '#ffb238'];
  const STATE_IDS = ['calm', 'wonder', 'anxiety', 'tenderness', 'melancholy', 'joy'];
  const BLENDS = {
    'calm+wonder': 'contemplation', 'anxiety+calm': 'vigilance', 'calm+tenderness': 'warmth',
    'calm+melancholy': 'solitude', 'calm+joy': 'contentment', 'anxiety+wonder': 'awe',
    'tenderness+wonder': 'enchantment', 'melancholy+wonder': 'reverie', 'joy+wonder': 'delight',
    'anxiety+tenderness': 'care', 'anxiety+melancholy': 'dread', 'anxiety+joy': 'excitement',
    'melancholy+tenderness': 'longing', 'joy+tenderness': 'affection', 'joy+melancholy': 'nostalgia',
  };
  const SONGS = ['moon', 'thunderbolt', 'crystalline', 'cosmogony', 'dark matter',
                 'hollow', 'virus', 'sacrifice', 'mutual core', 'solstice'];
  const LESSONS = [{ id: 'rhythm', harm: 8 }, { id: 'timbre', harm: 10 }, { id: 'silence', harm: 12 }];
  const DEMO_SEEDS = [
    { color: '#ffe14d', r: 0.45, a: -0.7, n: 8 },   // forest
    { color: '#b18cff', r: 0.52, a: 1.4,  n: 6 },   // city
    { color: '#5ee0c8', r: 0.36, a: 2.8,  n: 5 },   // sea
    { color: '#ff7ac6', r: 0.58, a: 4.3,  n: 8 },   // rain
  ];
  const STORE = 'biophilia:sky:v1';
  const MAX_SEEDS = 12;

  // ---------- DOM ----------
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const $ = (s) => document.querySelector(s);
  const hud = Object.fromEntries([...document.querySelectorAll('[data-hud]')].map((el) => [el.dataset.hud, el]));
  const room = $('[data-room]'), frame = $('[data-frame]');
  const hint = $('[data-hint]');

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
  const images = {};
  function imageOf(src) {
    if (!images[src]) { const im = new Image(); im.src = src; images[src] = im; }
    return images[src];
  }

  // ---------- состояние посетителя ----------
  const empty = () => ({ stars: {}, rhythm: null, seeds: [] });
  let state = (() => { try { return JSON.parse(localStorage.getItem(STORE)) || empty(); } catch (e) { return empty(); } })();
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* не влезло — живём без сохранения */ } }

  // общая смесь эмоций по всем пройденным звёздам
  function blendOf(ws) {
    const W = ws.reduce((a, b) => a + b, 0);
    if (W < 0.05) return { W: 0, ws, color: CREAM, name: '' };
    const order = ws.map((w, k) => ({ k, w, share: w / W })).filter((o) => o.w > 0.05).sort((a, b) => b.w - a.w);
    const top = order[0];
    const name = order.length === 1 || top.share >= 0.75
      ? STATE_IDS[top.k]
      : BLENDS[[STATE_IDS[top.k], STATE_IDS[order[1].k]].sort().join('+')];
    return { W, ws, color: STATE_COLORS[top.k], name };
  }
  function blendNow() {
    const ws = [0, 0, 0, 0, 0, 0];
    Object.values(state.stars).forEach((s) => s && s.weights && s.weights.forEach((w, i) => (ws[i] += w)));
    return blendOf(ws);
  }

  // ---------- геометрия мира (в долях меньшей стороны экрана) ----------
  let W = 0, H = 0, DPR = 1, M = 1;
  const SHARED = { x: 0, y: 0.02, r: 0.15 };
  const orbitRX = () => Math.min(0.52, (W / M) * 0.3);
  const ORBIT_RY = 0.26;
  // личная планета стартует слева от общей и очень медленно обходит её
  function personalPos(t) {
    const a = Math.PI * 0.97 + t * 0.008;
    return { x: SHARED.x + Math.cos(a) * orbitRX(), y: SHARED.y + Math.sin(a) * ORBIT_RY };
  }
  function lessonAngle(i, t) { return -Math.PI / 2 + (i / LESSONS.length) * Math.PI * 2 + t * 0.03; }
  function lessonPos(i, t) {
    const p = personalPos(t);
    const a = lessonAngle(i, t);
    return { x: p.x + Math.cos(a) * 0.13, y: p.y + Math.sin(a) * 0.115 };
  }

  const songs = SONGS.map((name, i) => {
    const rnd = mulberry32(i * 977 + 13);
    const n = 4 + Math.floor(rnd() * 3);
    const pts = [];
    for (let j = 0; j < n; j++) pts.push({ x: (rnd() - 0.5) * 0.1, y: (rnd() - 0.5) * 0.07 });
    return { name, a: -Math.PI / 2 + ((i + 0.5) / SONGS.length) * Math.PI * 2, pts, accent: STATE_COLORS[i % STATE_COLORS.length] };
  });
  const dust = Array.from({ length: 170 }, () => ({ x: rand(-1.6, 1.6), y: rand(-1, 1), s: rand(0.4, 1.3), tw: rand(0.5, 2), ph: rand(0, 6) }));

  // ---------- камера ----------
  const cam = { x: 0, y: 0, z: 1 };
  const camT = { x: 0, y: 0, z: 1 };
  let follow = null;
  const S = (p) => [W / 2 + (p.x - cam.x) * M * cam.z, H / 2 + (p.y - cam.y) * M * cam.z];

  // ======================================================================
  // ЗВУК (только отклики на наведение — вся музыка живёт внутри звёзд)
  // ======================================================================
  let ac = null, out;
  function ensureAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    out = ac.createGain(); out.gain.value = 0.4; out.connect(ac.destination);
  }
  let lastPing = 0;
  function ping(harm) {
    if (!ac) return;
    const t = ac.currentTime;
    if (t - lastPing < 0.15) return;
    lastPing = t;
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 55 * harm;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = 55 * harm * 2.76;
    const g2 = ac.createGain(); g2.gain.value = 0.2;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.08, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
    o.start(t); o2.start(t); o.stop(t + 2.1); o2.stop(t + 2.1);
  }

  // ======================================================================
  // ПОЛЁТЫ
  // ======================================================================
  let inside = null, flightToken = 0, hovered = null, flight = null;

  function flyInto(kind, id) {
    ensureAudio();
    const token = ++flightToken;
    if (kind === 'star') follow = () => lessonPos(id, now());
    else if (kind === 'personal') follow = () => personalPos(now());
    else follow = () => SHARED;
    camT.z = kind === 'shared' ? 2.4 : 9;
    document.body.classList.add('is-near');
    if (kind === 'shared') return;
    setTimeout(() => { if (token === flightToken) openRoom(kind, id); }, 800);
  }

  function blendParams() {
    const b = blendNow();
    if (!b.W) return '';
    const cols = [], ws = [];
    b.ws.forEach((w, i) => { if (w > 0.05) { cols.push(STATE_COLORS[i].slice(1)); ws.push(+w.toFixed(2)); } });
    return `&colors=${cols.join(',')}&w=${ws.join(',')}`;
  }

  function openRoom(kind, id) {
    frame.src = kind === 'star' ? `star.html?embed=1&star=${LESSONS[id].id}` : `crystal.html?embed=1${blendParams()}`;
    room.classList.add('is-open');
    document.body.classList.add('is-inside');
    inside = { kind, id };
  }

  function back() {
    flightToken++;
    if (inside) {
      room.classList.remove('is-open');
      document.body.classList.remove('is-inside');
      setTimeout(() => { if (!inside) frame.src = 'about:blank'; }, 750);   // остановить звук внутри
      inside = null;
    }
    follow = null;
    camT.x = 0; camT.y = 0; camT.z = 1;
    document.body.classList.remove('is-near');
  }

  // семя летит с личной планеты на общую
  function plantSeed(img) {
    back();
    const b = blendNow();
    setTimeout(() => {
      flight = { img, color: b.W ? b.color : CREAM, start: now(), dur: 2.4, r: rand(0.2, 0.62), a: rand(0, Math.PI * 2) };
    }, 900);
  }

  function landSeed(f) {
    state.seeds.push({ img: f.img, color: f.color, r: f.r, a: f.a, rhythm: state.rhythm });
    while (state.seeds.length > MAX_SEEDS) state.seeds.shift();
    save();
    ping(4);
    updateUi();
  }

  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data) return;
    const d = e.data;
    if (d.type === 'biophilia:star') {
      const i = LESSONS.findIndex((l) => l.id === d.star);
      if (i < 0) return;
      state.stars[d.star] = { weights: d.weights, blend: d.blend };
      if (d.rhythm && d.rhythm.some((v) => v)) state.rhythm = { steps: d.rhythm, loop: d.loop };
      save();
      updateUi();
    } else if (d.type === 'biophilia:seed' && d.image) {
      plantSeed(d.image);
    } else if (d.type === 'biophilia:back') {
      back();                                   // Esc, нажатый внутри звезды или кристалла
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

  // маленький кристалл-пример на общей планете
  function drawMini(x, y, s, color, n, rot) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      ctx.moveTo(0, 0); ctx.lineTo(ca * s, sa * s);
      for (const f of [0.45, 0.72]) {
        const bx = ca * s * f, by = sa * s * f;
        for (const side of [-1, 1]) {
          const ba = a + side * 0.6;
          ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(ba) * s * 0.28, by + Math.sin(ba) * s * 0.28);
        }
      }
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7;
    ctx.drawImage(sprite(color), -s * 0.6, -s * 0.6, s * 1.2, s * 1.2);
    ctx.restore();
  }

  // текущий шаг нарисованного ритма
  function rhythmPulse(rh, t) {
    if (!rh || !rh.steps) return 0;
    const ph = (t % rh.loop) / rh.loop;
    const s = Math.floor(ph * 16);
    const v = rh.steps[s];
    const within = ph * 16 - s;
    return v ? (v === 2 ? 1 : 0.6) * Math.exp(-within * 4) : 0;
  }

  let lastT = now();
  function draw() {
    const t = now();
    const dt = Math.min(0.1, t - lastT);
    lastT = t;

    // камера
    if (follow) { const p = follow(); camT.x = p.x; camT.y = p.y; }
    const k = 1 - Math.pow(0.04, dt);
    cam.x = lerp(cam.x, camT.x, k); cam.y = lerp(cam.y, camT.y, k);
    cam.z = Math.exp(lerp(Math.log(cam.z), Math.log(camT.z), k));

    ctx.clearRect(0, 0, W, H);
    if (inside && room.classList.contains('is-open') && cam.z > 8.5) { requestAnimationFrame(draw); return; }

    const zf = Math.min(cam.z, 3);

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

    // далёкие созвездия песен альбома
    // кольцо песен — у краёв неба, но не под заголовком и подсказкой
    const rx = (W / M) * 0.5 - 0.12, ry = (H / M) * 0.5 - 0.15;
    songs.forEach((sg) => {
      const c = { x: Math.cos(sg.a) * rx, y: Math.sin(sg.a) * ry };
      const pts = sg.pts.map((p) => S({ x: c.x + p.x, y: c.y + p.y }));
      ctx.strokeStyle = CREAM; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.2;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      pts.forEach(([x, y], i) => {
        ctx.globalAlpha = 0.55; ctx.fillStyle = i === 0 ? sg.accent : CREAM;
        ctx.beginPath(); ctx.arc(x, y, i === 0 ? 1.8 : 1.2, 0, Math.PI * 2); ctx.fill();
      });
      const [lx, ly] = S({ x: c.x, y: c.y + 0.065 });
      label(sg.name, lx, ly, 11, 0.42);
    });

    // орбита личной планеты
    const [ox, oy] = S(SHARED);
    ctx.save();
    ctx.setLineDash([2, 9]); ctx.strokeStyle = CREAM; ctx.lineWidth = 1; ctx.globalAlpha = 0.16;
    ctx.beginPath(); ctx.ellipse(ox, oy, orbitRX() * M * cam.z, ORBIT_RY * M * cam.z, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // орбита — это обучение
    label('learning orbit', ox + orbitRX() * M * cam.z * 0.62, oy + ORBIT_RY * M * cam.z * 0.84, 10, 0.4);

    // ---- общая планета ----
    const R = SHARED.r * M * cam.z;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16 + (hovered && hovered.kind === 'shared' ? 0.08 : 0);
    ctx.drawImage(sprite('#5ee0c8'), ox - R * 2.2, oy - R * 2.2, R * 4.4, R * 4.4);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const body = ctx.createRadialGradient(ox - R * 0.35, oy - R * 0.35, R * 0.1, ox, oy, R);
    body.addColorStop(0, '#1e2531'); body.addColorStop(1, '#090b10');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(ox, oy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = CREAM; ctx.globalAlpha = 0.3; ctx.lineWidth = 1; ctx.stroke();
    ctx.save();
    ctx.setLineDash([2, 7]); ctx.globalAlpha = 0.12;
    ctx.beginPath(); ctx.ellipse(ox, oy, R, R * 0.33, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(ox, oy, R * 0.4, R, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.14;
    ctx.beginPath(); ctx.arc(ox, oy, R * 1.18, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // семена на общей планете + нити между соседями
    const seeds = [
      ...DEMO_SEEDS.map((d) => ({ ...d, demo: true })),
      ...state.seeds,
    ].map((s) => ({ ...s, x: ox + Math.cos(s.a) * s.r * R, y: oy + Math.sin(s.a) * s.r * R * 0.9 }));
    seeds.forEach((s, i) => {
      seeds.map((o, j) => ({ j, d: Math.hypot(o.x - s.x, o.y - s.y) }))
        .filter((o) => o.j > i).sort((a, b) => a.d - b.d).slice(0, 2)
        .forEach(({ j }) => {
          const o = seeds[j];
          ctx.strokeStyle = CREAM; ctx.globalAlpha = 0.2; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(o.x, o.y); ctx.stroke();
          // бусина на стыке — тут рождается звук, которого никто не записывал
          const mx = (s.x + o.x) / 2, my = (s.y + o.y) / 2;
          const p = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 2 + j);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.35 + 0.4 * p;
          const g = 10 * zf;
          ctx.drawImage(sprite(i % 2 ? s.color : o.color), mx - g / 2, my - g / 2, g, g);
          ctx.globalCompositeOperation = 'source-over';
        });
    });
    ctx.globalAlpha = 1;
    seeds.forEach((s, i) => {
      if (s.demo) { drawMini(s.x, s.y, R * 0.13, s.color, s.n, t * 0.05 + i); return; }
      const im = imageOf(s.img);
      if (!im.complete) return;
      const pulse = rhythmPulse(s.rhythm, t);
      const sz = R * 0.42 * (1 + pulse * 0.18);
      ctx.save();
      ctx.translate(s.x, s.y); ctx.rotate(t * 0.03 + i);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.95;
      ctx.drawImage(im, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    });
    label('shared planet', ox, oy + R + 24, 12, 0.75);
    label(`${seeds.length} seeds · everyone's sounds`, ox, oy + R + 42, 10, 0.45);

    // ---- нити между звёздами-уроками и к личной планете ----
    const pp = personalPos(t);
    const [px, py] = S(pp);
    const blend = blendNow();
    const lp = LESSONS.map((_, i) => S(lessonPos(i, t)));
    LESSONS.forEach((l, i) => {
      ctx.strokeStyle = CREAM; ctx.globalAlpha = 0.12; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(lp[i][0], lp[i][1]); ctx.stroke();
    });
    for (let i = 0; i < LESSONS.length; i++) {
      const j = (i + 1) % LESSONS.length;
      const lit = state.stars[LESSONS[i].id] && state.stars[LESSONS[j].id];
      ctx.save();
      if (lit) { ctx.strokeStyle = blend.color; ctx.globalAlpha = 0.85; ctx.lineWidth = 1.6; }
      else { ctx.setLineDash([3, 6]); ctx.strokeStyle = CREAM; ctx.globalAlpha = 0.2; ctx.lineWidth = 0.8; }
      ctx.beginPath(); ctx.moveTo(lp[i][0], lp[i][1]); ctx.lineTo(lp[j][0], lp[j][1]); ctx.stroke();
      ctx.restore();
    }

    // ---- личная планета ----
    const pulse = rhythmPulse(state.rhythm, t);
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
        ctx.strokeStyle = STATE_COLORS[i]; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(px, py, pr * 1.45, a0 + 0.05, a0 + span - 0.05); ctx.stroke();
        a0 += span;
      });
    }
    ctx.globalAlpha = 1;
    label('planet of', px, py - 3, 10, 0.7);
    label('emotions', px, py + 11, 11, 0.9);
    if (hp) label('fly in · plant a seed', px, py + pr * 1.45 + 18, 10, 0.7);

    // ---- звёзды-уроки ----
    LESSONS.forEach((l, i) => {
      const [x, y] = lp[i];
      const st = state.stars[l.id];
      const col = st ? blendOf(st.weights).color : CREAM;
      const hv = hovered && hovered.kind === 'star' && hovered.id === i;
      ctx.globalCompositeOperation = 'lighter';
      // крохотное облако состояний вокруг звезды
      for (let c = 0; c < 12; c++) {
        const a = (c / 12) * Math.PI * 2 + t * (0.3 + (c % 3) * 0.1);
        const rr = (14 + (c % 4) * 3) * zf;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = STATE_COLORS[c % 6];
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.82, 1.1 * Math.min(zf, 2), 0, Math.PI * 2); ctx.fill();
      }
      const g = (st ? 40 : 30) * zf * (hv ? 1.25 : 1);
      ctx.globalAlpha = st ? 0.95 : 0.6;
      ctx.drawImage(sprite(col), x - g / 2, y - g / 2, g, g);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = CREAM;
      ctx.beginPath(); ctx.arc(x, y, 2.6 * Math.min(zf, 2), 0, Math.PI * 2); ctx.fill();
      // подпись — снаружи, по направлению от планеты, чтобы не налезать на её подпись
      const la = lessonAngle(i, t);
      const lx = x + Math.cos(la) * 30 * zf, ly = y + Math.sin(la) * 26 * zf + 4;
      label(l.id, lx, ly, 12, 0.85);
      if (st) label(st.blend || 'passed', lx, ly + 15, 10, 0.6, col);
    });

    // ---- семя в полёте ----
    if (flight) {
      const u = clamp01((t - flight.start) / flight.dur);
      const e = easeInOut(u);
      const from = personalPos(flight.start), to = { x: SHARED.x + Math.cos(flight.a) * flight.r * SHARED.r, y: SHARED.y + Math.sin(flight.a) * flight.r * SHARED.r * 0.9 };
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
      if (u >= 1) { landSeed(flight); flight = null; }
    }

    requestAnimationFrame(draw);
  }

  // ---------- наведение и клики ----------
  function hitTest(x, y) {
    const t = now();
    for (let i = 0; i < LESSONS.length; i++) {
      const [sx, sy] = S(lessonPos(i, t));
      if (Math.hypot(sx - x, sy - y) < 22) return { kind: 'star', id: i };
    }
    const [px, py] = S(personalPos(t));
    if (Math.hypot(px - x, py - y) < 0.045 * M * cam.z + 10) return { kind: 'personal' };
    const [ox, oy] = S(SHARED);
    if (Math.hypot(ox - x, oy - y) < SHARED.r * M * cam.z) return { kind: 'shared' };
    return null;
  }

  canvas.addEventListener('pointermove', (e) => {
    if (inside) return;
    const h = hitTest(e.clientX, e.clientY);
    const changed = JSON.stringify(h) !== JSON.stringify(hovered);
    hovered = h;
    canvas.style.cursor = h ? 'pointer' : '';
    if (changed && h) ping(h.kind === 'star' ? LESSONS[h.id].harm : h.kind === 'personal' ? 6 : 4);
  });
  canvas.addEventListener('click', (e) => {
    if (inside) return;
    const h = hitTest(e.clientX, e.clientY);
    if (h && !(h.kind === 'shared' && document.body.classList.contains('is-near'))) flyInto(h.kind, h.id);
    else if (document.body.classList.contains('is-near')) back();
  });
  $('[data-back]').addEventListener('click', back);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') back(); });
  $('[data-reset]').addEventListener('click', () => { state = empty(); save(); updateUi(); });

  function updateUi() {
    const passed = LESSONS.filter((l) => state.stars[l.id]).length;
    const b = blendNow();
    hud.passed.textContent = `${passed} / ${LESSONS.length}`;
    hud.blend.textContent = b.name || '—';
    hud.rhythm.textContent = state.rhythm ? `${state.rhythm.steps.filter(Boolean).length} beats drawn` : '—';
    hud.seeds.textContent = `${DEMO_SEEDS.length} + yours ${state.seeds.length}`;
    hint.textContent = passed === 0
      ? 'fly into a star around your planet of emotions'
      : state.seeds.length === 0
        ? 'now fly into your planet of emotions and plant a seed'
        : 'your seed is growing on the shared planet';
  }

  window.addEventListener('resize', resize);
  resize();
  updateUi();
  requestAnimationFrame(draw);
})();

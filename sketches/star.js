/*
 * Эскиз: звезда и облако состояний.
 *
 * Звезда — урок: чему учимся слышать (rhythm, timbre, silence).
 * Вокруг — шесть облаков-состояний. Их можно СМЕШИВАТЬ: каждый клик по облаку
 * «вливает» в звезду каплю этого состояния (до 5). Звук звезды — взвешенная смесь:
 * темп, плотность, пространство усредняются, а каждая нота берётся из набора
 * одного из состояний с вероятностью, равной его доле. У смеси появляется имя
 * (calm + joy = contentment), так эмоции можно изучать, смешивая их.
 *
 * Режим PAINT: кисть цвета состояния. Рисунок вокруг звезды — это круговой
 * секвенсор на 16 шагов: угол = момент в такте, расстояние от звезды = высота
 * ноты, острые углы рисунка = акценты, угловатость всей формы = тембр
 * (плавная — мягкий звук, угловатая — яркий, «пилящий»). Краска тоже
 * добавляет своё состояние в смесь.
 *
 * Все ноты — гармоники 55 Гц, как во вступлении.
 */
(() => {
  'use strict';

  const BASE = 55;
  const CREAM = '#f2efe6';
  const STEPS = 16;
  const MAX_W = 5;

  // внутри карты (map.html) звезда открывается во фрейме: ?embed=1&star=rhythm
  const params = new URLSearchParams(location.search);
  const EMBED = params.get('embed') === '1';
  // mode=feel — это не урок, а сама планета эмоций: здесь человек вводит, как он сейчас
  const FEEL = EMBED && params.get('mode') === 'feel';
  // w=… — смесь, которую человек уже налил в свою планету (6 чисел, по состояниям)
  const PRESET = (params.get('w') || '').split(',').filter(Boolean).map(Number);
  const LISTEN_S = 12;           // столько секунд нужно послушать станцию, чтобы урок считался пройденным
  if (EMBED) {
    document.body.classList.add('is-embed');
    if (FEEL) document.body.classList.add('is-feel');
    // Esc внутри фрейма — назад в небо
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && window.parent !== window) window.parent.postMessage({ type: 'biophilia:back' }, location.origin);
    });
  }

  const STATES = [
    { id: 'calm',       color: '#7ad7ff', motion: 'calm',   harms: [4, 6, 8, 9, 12],            tempo: 0.55, density: 0.55, jitter: 0.05, wet: 0.6,  oct: 1,   bright: 0.35, dir: 'random' },
    { id: 'wonder',     color: '#ffe14d', motion: 'burst',  harms: [8, 10, 12, 15, 18, 20, 24], tempo: 1.2,  density: 0.7,  jitter: 0.2,  wet: 0.45, oct: 1,   bright: 0.9,  dir: 'up' },
    { id: 'anxiety',    color: '#ff5a5f', motion: 'jitter', harms: [7, 11, 13, 14, 17],         tempo: 1.8,  density: 0.85, jitter: 0.45, wet: 0.15, oct: 1,   bright: 0.6,  dir: 'random' },
    { id: 'tenderness', color: '#ff7ac6', motion: 'breath', harms: [5, 6, 8, 10],               tempo: 0.6,  density: 0.6,  jitter: 0.08, wet: 0.4,  oct: 1,   bright: 0.25, dir: 'step' },
    { id: 'melancholy', color: '#b18cff', motion: 'sink',   harms: [4, 5, 6, 7],                tempo: 0.45, density: 0.5,  jitter: 0.12, wet: 0.65, oct: 0.5, bright: 0.2,  dir: 'down' },
    { id: 'joy',        color: '#ffb238', motion: 'bounce', harms: [6, 8, 9, 10, 12, 16],       tempo: 1.4,  density: 0.8,  jitter: 0.06, wet: 0.3,  oct: 1,   bright: 0.7,  dir: 'up' },
  ];
  STATES.forEach((s) => (s.hi = 0));
  const NEUTRAL = { harms: [4, 6, 8, 12], tempo: 0.8, density: 0.4, jitter: 0.1, wet: 0.4, oct: 1, bright: 0.4, dir: 'random', hi: 0 };

  // имена смесей двух главных состояний
  const BLENDS = {
    'calm+wonder': 'contemplation', 'anxiety+calm': 'vigilance', 'calm+tenderness': 'warmth',
    'calm+melancholy': 'solitude', 'calm+joy': 'contentment', 'anxiety+wonder': 'awe',
    'tenderness+wonder': 'enchantment', 'melancholy+wonder': 'reverie', 'joy+wonder': 'delight',
    'anxiety+tenderness': 'care', 'anxiety+melancholy': 'dread', 'anxiety+joy': 'excitement',
    'melancholy+tenderness': 'longing', 'joy+tenderness': 'affection', 'joy+melancholy': 'nostalgia',
  };

  const STARS = {
    rhythm:  { line: 'teaches you to hear repetition and the break', step: 0.24, voice: 'pluck', density: 1.0, accentEvery: 4 },
    timbre:  { line: 'teaches you to hear what a sound is made of',  step: 0.9,  voice: 'pad',   density: 0.8 },
    silence: { line: 'teaches you to hear the pause between sounds', step: 1.3,  voice: 'bell',  density: 0.45 },
    feel:    { line: 'how are you right now? pour states into your planet', step: 0.9, voice: 'bell', density: 0.6 },
  };

  // на станции орбиты: что именно слушать в своей смеси
  const LISTEN_FOR = {
    rhythm:  'your blend as a pulse: calm slows it, anxiety breaks it · paint to draw your own beat',
    timbre:  'your blend as the colour of a sound: bright states open it, dark states close it',
    silence: 'your blend with room to breathe: listen to the pauses and the echo between notes',
  };

  const MOTION_SPEED = { calm: 0.15, burst: 0.3, jitter: 1.2, breath: 0.2, sink: 0.1, bounce: 0.6 };

  // ---------- DOM ----------
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const hud = Object.fromEntries($$('[data-hud]').map((el) => [el.dataset.hud, el]));
  const starTag = $('[data-star-tag]'), starName = $('[data-star-name]'), starLine = $('[data-star-line]');
  const blendName = $('[data-blend-name]'), blendLine = $('[data-blend-line]');
  const blendExtra = $('[data-blend-extra]');
  const hint = $('[data-hint]');
  const starBtns = $$('[data-star]'), modeBtns = $$('[data-mode]');
  const soundBtn = $('[data-sound]'), clearBtn = $('[data-clear]');
  const statesBox = $('[data-states]');

  // ---------- утилиты ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; };

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

  // ======================================================================
  // СОСТОЯНИЕ: капли, краска, смесь
  // ======================================================================
  let star = 'rhythm';
  let mode = 'mix';
  let brush = 0;
  let hovered = -1;
  const drops = STATES.map(() => 0);
  const ink = STATES.map(() => 0);
  const strokes = [];            // { k, pts:[{x,y}] } в долях меньшей стороны, от центра звезды
  let drawing = null;
  let mix = null;

  const weightOf = (k) => Math.min(MAX_W + 1, drops[k] + ink[k]);

  function computeMix() {
    const ws = STATES.map((_, k) => weightOf(k));
    const W = ws.reduce((a, b) => a + b, 0);
    if (W < 0.05) return { ...NEUTRAL, W: 0, ws, color: CREAM, name: '', extra: '', parts: [] };
    const avg = (key) => ws.reduce((s, w, k) => s + w * STATES[k][key], 0) / W;
    const order = ws.map((w, k) => ({ k, w, share: w / W })).filter((o) => o.w > 0.05).sort((a, b) => b.w - a.w);
    const top = order[0];
    let name, extra = '';
    if (order.length === 1 || top.share >= 0.75) name = STATES[top.k].id;
    else {
      const key = [STATES[top.k].id, STATES[order[1].k].id].sort().join('+');
      name = BLENDS[key];
      if (order[2] && order[2].share >= 0.15) extra = `with a little ${STATES[order[2].k].id}`;
    }
    return {
      W, ws,
      tempo: avg('tempo'), density: avg('density'), jitter: avg('jitter'), wet: avg('wet'), bright: avg('bright'),
      oct: ws[4] / W > 0.5 ? 0.5 : 1,
      color: STATES[top.k].color,
      name, extra,
      parts: order.slice(0, 4).map((o) => `${STATES[o.k].id} ${Math.round(o.share * 100)}%`),
    };
  }

  // ---------- облака ----------
  const clusters = STATES.map((s, k) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'state';
    btn.style.setProperty('--c', s.color);
    btn.innerHTML = `${s.id}<span class="n"></span>`;
    statesBox.appendChild(btn);
    const parts = [];
    const w = MOTION_SPEED[s.motion];
    for (let i = 0; i < 55; i++) {
      parts.push({
        th: rand(0, Math.PI * 2), rho: Math.sqrt(Math.random()),
        w: w * rand(0.6, 1.4) * (Math.random() < 0.5 ? -1 : 1),
        ph: rand(0, 100), size: Math.random() < 0.15 ? rand(1.6, 2.6) : rand(0.6, 1.4),
        tw: rand(0.8, 2.5), cream: Math.random() < 0.2,
        m: 0, x: 0, y: 0,
      });
    }
    return { s, k, btn, n: btn.querySelector('.n'), parts, alpha: 1, bright: 0, x: 0, y: 0, ang: 0, bend: rand(0.12, 0.25) * (k % 2 ? 1 : -1) };
  });

  // ======================================================================
  // ЗВУК
  // ======================================================================
  let ac = null, master, dry, wet, droneOsc;
  let soundOn = true, running = false;
  let nextT = 0, stepIdx = 0;
  const pattern = { active: false, steps: [], angular: 0, loop: 4, loopStart: 0, count: 0, nextT: 0 };
  const events = [];

  function ensureAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = soundOn ? 0.7 : 0;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ac.destination);

    dry = ac.createGain(); dry.connect(master);
    const verb = ac.createConvolver();
    const len = ac.sampleRate * 4, ib = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ib.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    verb.buffer = ib;
    wet = ac.createGain(); wet.gain.value = mix.wet;
    wet.connect(verb); verb.connect(master);

    droneOsc = ac.createOscillator(); droneOsc.type = 'sine'; droneOsc.frequency.value = BASE * mix.oct;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200;
    const drone = ac.createGain(); drone.gain.value = 0;
    droneOsc.connect(lp); lp.connect(drone); drone.connect(dry); drone.connect(wet);
    droneOsc.start();
    drone.gain.setTargetAtTime(0.06, ac.currentTime, 1.5);

    nextT = ac.currentTime + 0.1;
    running = true;
    setInterval(schedule, 25);
  }

  function pickHarm(s) {
    const n = s.harms.length;
    if (s.dir === 'up') s.hi = (s.hi + 1) % n;
    else if (s.dir === 'down') s.hi = (s.hi - 1 + n) % n;
    else if (s.dir === 'step') s.hi = Math.max(0, Math.min(n - 1, s.hi + (Math.random() < 0.5 ? -1 : 1)));
    else s.hi = (Math.random() * n) | 0;
    return s.harms[Math.min(s.hi, n - 1)];
  }

  // нота из смеси: состояние выбирается по его доле
  function pickNote() {
    if (mix.W === 0) return { f: BASE * pickHarm(NEUTRAL), color: CREAM };
    let r = Math.random() * mix.W, k = 0;
    for (; k < STATES.length - 1; k++) { r -= mix.ws[k]; if (r <= 0) break; }
    const s = STATES[k];
    return { f: BASE * pickHarm(s) * s.oct, color: s.color };
  }

  function out(node, pan) {
    let o = node;
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); o = p; }
    o.connect(dry); o.connect(wet);
  }

  function voice(kind, f, t, bright, accent, angular = 0) {
    const env = ac.createGain();
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
    lp.connect(env);
    out(env, rand(-0.5, 0.5));

    if (kind === 'pluck') {
      const dur = accent ? 0.7 : 0.35;
      const o1 = ac.createOscillator(); o1.type = angular > 0.5 ? 'sawtooth' : 'triangle'; o1.frequency.value = f;
      const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
      const g2 = ac.createGain(); g2.gain.value = 0.3;
      lp.frequency.value = 800 + bright * 5000;
      o1.connect(lp); o2.connect(g2); g2.connect(lp);
      const peak = (accent ? 0.22 : 0.13) * (angular > 0.5 ? 0.7 : 1);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(peak, t + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      [o1, o2].forEach((o) => { o.start(t); o.stop(t + dur + 0.05); });
    } else if (kind === 'pad') {
      const dur = 2.6;
      const oscs = [-6, 6].map((c) => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = c; o.connect(lp); return o; });
      lp.Q.value = 4 + angular * 6;
      lp.frequency.setValueAtTime(200, t);
      lp.frequency.exponentialRampToValueAtTime(300 + bright * 3200, t + 0.9);
      lp.frequency.exponentialRampToValueAtTime(220, t + dur);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(accent ? 0.08 : 0.05, t + 0.5);
      env.gain.linearRampToValueAtTime(0, t + dur);
      oscs.forEach((o) => { o.start(t); o.stop(t + dur + 0.05); });
    } else {
      const dur = 4.5;
      const o1 = ac.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
      const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.76;
      const g2 = ac.createGain(); g2.gain.value = 0.25 + angular * 0.3;
      lp.frequency.value = 2000 + bright * 6000;
      o1.connect(lp); o2.connect(g2); g2.connect(lp);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(accent ? 0.17 : 0.12, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      [o1, o2].forEach((o) => { o.start(t); o.stop(t + dur + 0.05); });
    }
  }

  const loopLen = () => 4.8 / Math.sqrt(mix.tempo);

  function schedule() {
    if (!running) return;
    const st = STARS[star];

    // нарисованный рисунок играет как круговой секвенсор
    if (pattern.active) {
      const L = loopLen();
      if (Math.abs(L - pattern.loop) > 1e-3) {
        pattern.loopStart = pattern.nextT - (pattern.count * L) / STEPS;
        pattern.loop = L;
      }
      while (pattern.nextT < ac.currentTime + 0.15) {
        const hits = pattern.steps[pattern.count % STEPS];
        for (const h of hits.slice(0, 2)) {
          const S = STATES[h.k];
          const hs = [...S.harms].sort((a, b) => a - b);
          const harm = hs[Math.min(hs.length - 1, Math.floor(h.r * hs.length))];
          voice(st.voice, BASE * harm * S.oct, pattern.nextT, clamp01(mix.bright * 0.5 + pattern.angular * 0.6), h.accent, pattern.angular);
          events.push({ t: pattern.nextT, color: S.color, big: h.accent });
        }
        pattern.count++;
        pattern.nextT = pattern.loopStart + (pattern.count * pattern.loop) / STEPS;
      }
      return;
    }

    // иначе звезда играет сама — смесью состояний
    while (nextT < ac.currentTime + 0.15) {
      const step = st.step / mix.tempo;
      const t = Math.max(ac.currentTime + 0.01, nextT + rand(-1, 1) * mix.jitter * step * 0.5);
      const accent = star === 'rhythm' && stepIdx % st.accentEvery === 0;
      if (accent || Math.random() < st.density * mix.density) {
        const n = pickNote();
        voice(st.voice, accent ? n.f / 2 : n.f, t, mix.bright, accent);
        events.push({ t, color: n.color, big: accent || st.voice !== 'pluck' });
      }
      nextT += step * (star === 'rhythm' && mix.jitter > 0.3 && Math.random() < 0.25 ? 0.5 : 1);
      stepIdx++;
    }
  }

  let lastPreview = 0;
  function preview(k) {
    if (!ac || !soundOn) return;
    const t = ac.currentTime;
    if (t - lastPreview < 0.5) return;
    lastPreview = t;
    const s = STATES[k];
    voice('bell', BASE * s.harms[(Math.random() * s.harms.length) | 0] * s.oct, t + 0.01, s.bright, false);
  }

  // ======================================================================
  // РИСУНОК → ритм
  // ======================================================================
  function rebuildPattern() {
    const steps = Array.from({ length: STEPS }, () => []);
    let corners = 0, total = 0;
    ink.fill(0);
    for (const st of strokes) {
      const pts = st.pts;
      st.corners = new Set();
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const a = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
        const b = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
        let d = Math.abs(b - a);
        if (d > Math.PI) d = Math.PI * 2 - d;
        if (d > 1.1) st.corners.add(i);
      }
      corners += st.corners.size;
      total += len;
      ink[st.k] += len / 0.3;                 // краска добавляет состояние в смесь

      const agg = {};
      pts.forEach((p, i) => {
        let th = Math.atan2(p.y, p.x) + Math.PI / 2;
        if (th < 0) th += Math.PI * 2;
        const s = Math.floor((th / (Math.PI * 2)) * STEPS) % STEPS;
        p.step = s;
        const r = clamp01((Math.hypot(p.x, p.y) - 0.04) / 0.4);
        const a = agg[s] || (agg[s] = { rs: 0, n: 0, acc: false });
        a.rs += r; a.n++;
        if (st.corners.has(i)) a.acc = true;
      });
      for (const s in agg) steps[s].push({ k: st.k, r: agg[s].rs / agg[s].n, accent: agg[s].acc });
    }
    steps.forEach((a) => a.sort((x, y) => y.accent - x.accent));
    pattern.steps = steps;
    // угловатость: сколько острых углов приходится на длину линии
    pattern.angular = clamp01(corners / Math.max(1, total / 0.25));
    pattern.corners = corners;

    const wasActive = pattern.active;
    pattern.active = strokes.length > 0;
    if (pattern.active && !wasActive && ac) {
      mix = computeMix();
      pattern.loop = loopLen();
      pattern.count = 0;
      pattern.loopStart = pattern.nextT = ac.currentTime + 0.05;
    }
    if (!pattern.active && wasActive && ac) nextT = ac.currentTime + 0.05;
  }

  // ======================================================================
  // ИНТЕРФЕЙС
  // ======================================================================
  function applyMix() {
    mix = computeMix();
    if (ac) {
      wet.gain.setTargetAtTime(mix.wet, ac.currentTime, 0.6);
      droneOsc.frequency.setTargetAtTime(BASE * mix.oct, ac.currentTime, 0.8);
    }
    document.body.classList.toggle('is-mixed', mix.W > 0);
    blendName.textContent = mix.name || '—';
    blendExtra.textContent = mix.extra;
    blendLine.textContent = mix.parts.join(' · ');
    clusters.forEach((c) => {
      const w = weightOf(c.k);
      c.n.textContent = w > 0.05 ? String(Math.max(1, Math.round(w))) : '';
      c.btn.classList.toggle('is-on', w > 0.05);
      c.btn.classList.toggle('is-brush', c.k === brush);
    });
    updateHint();
    updateHud();
    reportToMap();
  }

  // сообщаем карте: какая смесь, какой ритм нарисован и прослушан ли урок
  let heard = 0, passed = false;
  function reportToMap() {
    if (!EMBED || window.parent === window || (mix.W === 0 && !passed)) return;
    window.parent.postMessage({
      type: FEEL ? 'biophilia:feel' : 'biophilia:star',
      star, passed,
      blend: mix.name, extra: mix.extra,
      weights: mix.ws.map((w) => +w.toFixed(2)),
      colors: STATES.map((s) => s.color),
      rhythm: pattern.active ? pattern.steps.map((a) => (a.length ? (a[0].accent ? 2 : 1) : 0)) : null,
      loop: loopLen(),
    }, location.origin);
  }

  function updateHint() {
    if (EMBED && passed) {
      hint.textContent = 'you heard it · the planet moves on — back to the sky (esc)';
      hint.classList.remove('is-hidden');
    } else if (FEEL && mix.W > 0) {
      hint.textContent = 'your planet has its blend · back to the sky (esc), then fly to the first station';
      hint.classList.remove('is-hidden');
    } else if (FEEL) {
      hint.innerHTML = 'how are you right now<span>?</span> pour states into your planet';
      hint.classList.remove('is-hidden');
    } else if (mode === 'paint') {
      hint.textContent = `brush: ${STATES[brush].id} — draw around the star, the shape becomes the rhythm`;
      hint.classList.toggle('is-hidden', strokes.length > 0);
    } else {
      hint.innerHTML = 'how are you right now<span>?</span> pour states into the star';
      hint.classList.toggle('is-hidden', mix.W > 0);
    }
  }

  function updateHud() {
    const st = STARS[star];
    hud.star.textContent = FEEL ? 'your planet' : star;
    hud.blend.textContent = mix.name || 'none';
    hud.tempo.textContent = pattern.active ? `${(STEPS / loopLen()).toFixed(1)} steps / s` : `${(mix.tempo / st.step).toFixed(1)} / s`;
    hud.density.textContent = (st.density * mix.density).toFixed(2);
    hud.shape.textContent = pattern.active ? `${pattern.corners} accents · ${pattern.angular > 0.5 ? 'sharp' : 'soft'}` : '—';
  }

  function addDrop(k) {
    ensureAudio();
    drops[k] = drops[k] >= MAX_W ? 0 : drops[k] + 1;   // после пяти капель — снова ноль
    applyMix();
  }

  function setStar(name) {
    ensureAudio();
    star = name;
    stepIdx = 0;
    starName.textContent = name;
    starLine.textContent = STARS[name].line;
    starBtns.forEach((b) => b.classList.toggle('is-on', b.dataset.star === name));
    updateHud();
  }

  function setMode(m) {
    mode = m;
    document.body.classList.toggle('is-paint', m === 'paint');
    modeBtns.forEach((b) => b.classList.toggle('is-on', b.dataset.mode === m));
    applyMix();
  }

  function clearAll() {
    drops.fill(0);
    strokes.length = 0;
    rebuildPattern();
    applyMix();
  }

  // ======================================================================
  // РИСОВАНИЕ
  // ======================================================================
  let W = 0, H = 0, DPR = 1, M = 1, cx = 0, cy = 0;
  let flash = 0;
  const ripples = [], sparks = [];
  let lastT = performance.now() / 1000;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    M = Math.min(W, H);
    cx = W / 2; cy = H * 0.5;
  }

  // движение частицы: у каждого состояния своё, и оно сохраняется внутри смеси
  function motionPos(p, s, ox, oy, sp, t) {
    let rho = p.rho * sp, th = p.th + t * p.w, dy = 0, fade = 1;
    switch (s.motion) {
      case 'calm':   rho *= 1 + 0.1 * Math.sin(t * 0.5 + p.ph); break;
      case 'burst':  rho *= 1 + Math.pow(Math.max(0, Math.sin(t * 1.9 + p.ph * 0.05)), 12) * 0.9; break;
      case 'jitter': rho *= 0.8 + 0.35 * Math.sin(t * 23 + p.ph * 7) * Math.sin(t * 17 + p.ph * 3); th += 0.2 * Math.sin(t * 13 + p.ph); break;
      case 'breath': rho *= 0.8 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.9)); break;
      case 'sink': { const fr = (t * 0.08 + p.ph) % 1; dy = fr * sp * 1.1; fade = 1 - fr; break; }
      case 'bounce': rho *= 0.65 + 0.5 * Math.abs(Math.sin(t * 2.6 + p.ph)); break;
    }
    return [ox + Math.cos(th) * rho, oy + Math.sin(th) * rho * 0.82 + dy, fade];
  }

  const P = (p) => [cx + p.x * M, cy + p.y * M];

  function draw() {
    const t = performance.now() / 1000;
    const dt = Math.min(0.1, t - lastT);
    lastT = t;
    ctx.clearRect(0, 0, W, H);

    const R = M * 0.31;
    const cloudRot = Math.PI / 6 + 0.06 * Math.sin(t * 0.15);
    const k = 1 - Math.pow(0.02, dt);

    if (ac) {
      while (events.length && events[0].t <= ac.currentTime) {
        const e = events.shift();
        flash = Math.min(1.4, flash + (e.big ? 0.9 : 0.5));
        ripples.push({ born: t, color: e.color });
        sparks.push({ born: t, a: rand(0, Math.PI * 2), color: e.color, d: rand(0.1, 0.2) });
      }
    }
    flash *= Math.pow(0.05, dt);

    // орбиты
    ctx.save();
    ctx.setLineDash([2, 9]);
    ctx.strokeStyle = CREAM; ctx.lineWidth = 1; ctx.globalAlpha = 0.16;
    ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.82, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.1;
    ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.45, R * 1.2, 0.2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // сетка такта: 16 точек по кругу и стрелка, когда есть рисунок или режим кисти
    const showGrid = mode === 'paint' || pattern.active;
    let phase = -1;
    if (pattern.active && ac) phase = (((ac.currentTime - pattern.loopStart) / pattern.loop) % 1 + 1) % 1;
    if (showGrid) {
      const gr = M * 0.44;
      const cur = phase >= 0 ? Math.floor(phase * STEPS) : -1;
      for (let s = 0; s < STEPS; s++) {
        const a = -Math.PI / 2 + ((s + 0.5) / STEPS) * Math.PI * 2;
        ctx.globalAlpha = s === cur ? 0.9 : 0.3;
        ctx.fillStyle = CREAM;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * gr, cy + Math.sin(a) * gr, s === cur ? 2.4 : 1.3, 0, Math.PI * 2); ctx.fill();
      }
      if (phase >= 0) {
        const a = -Math.PI / 2 + phase * Math.PI * 2;
        const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * gr, cy + Math.sin(a) * gr);
        g.addColorStop(0, 'rgba(242,239,230,0)');
        g.addColorStop(1, 'rgba(242,239,230,.35)');
        ctx.strokeStyle = g; ctx.globalAlpha = 1; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * gr, cy + Math.sin(a) * gr); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // облака
    const mixed = mix.W > 0;
    clusters.forEach((c) => {
      c.alpha = lerp(c.alpha, mixed ? 0.55 : 1, k);
      c.bright = lerp(c.bright, c.k === hovered ? 1 : 0, k * 2);
      c.ang = -Math.PI / 2 + (c.k / STATES.length) * Math.PI * 2 + cloudRot;
      c.x = cx + Math.cos(c.ang) * R;
      c.y = cy + Math.sin(c.ang) * R * 0.82;
    });

    // нити
    ctx.lineWidth = 0.9;
    clusters.forEach((c) => {
      const share = mixed ? mix.ws[c.k] / mix.W : 0;
      const mx = (cx + c.x) / 2, my = (cy + c.y) / 2;
      const nx = -(c.y - cy), ny = c.x - cx;
      [[c.bend, 0.3], [c.bend * -0.6, 0.14]].forEach(([b, al]) => {
        ctx.strokeStyle = c.s.color;
        ctx.globalAlpha = Math.min(0.9, al * c.alpha * (1 + c.bright) + share * 0.6);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(mx + nx * b, my + ny * b, c.x, c.y); ctx.stroke();
      });
    });
    ctx.globalAlpha = 1;

    // частицы: часть каждого облака, пропорциональная его доле, живёт вокруг звезды
    ctx.globalCompositeOperation = 'lighter';
    const halo = M * 0.085;
    clusters.forEach((c) => {
      const nIn = Math.round(c.parts.length * Math.min(1, weightOf(c.k) / MAX_W));
      const sp = M * 0.068;
      c.parts.forEach((p, i) => {
        p.m = lerp(p.m, i < nIn ? 1 : 0, k * 0.8);
        const [x1, y1, f1] = motionPos(p, c.s, c.x, c.y, sp, t);
        let x = x1, y = y1, fade = f1;
        if (p.m > 0.01) {
          const [x2, y2, f2] = motionPos(p, c.s, cx, cy, halo, t);
          x = lerp(x1, x2, p.m); y = lerp(y1, y2, p.m); fade = lerp(f1, f2, p.m);
        }
        const tw = 0.65 + 0.35 * Math.sin(t * p.tw + p.ph);
        const al = lerp(c.alpha, 1, p.m) * tw * fade * (0.75 + c.bright * 0.5);
        const col = p.cream ? CREAM : c.s.color;
        if (p.size > 1.5) {
          const g = p.size * 8;
          ctx.globalAlpha = al * 0.7;
          ctx.drawImage(sprite(col), x - g / 2, y - g / 2, g, g);
        }
        ctx.globalAlpha = al;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.fill();
      });
    });

    // нарисованные формы
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const cur = phase >= 0 ? Math.floor(phase * STEPS) : -1;
    const all = drawing ? [...strokes, drawing] : strokes;
    for (const st of all) {
      if (st.pts.length < 2) continue;
      const col = STATES[st.k].color;
      [[7, 0.12], [2.2, 0.85]].forEach(([w, al]) => {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.globalAlpha = al;
        ctx.beginPath();
        st.pts.forEach((p, i) => { const [x, y] = P(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
      });
      // текущий шаг подсвечивает свой кусок рисунка
      if (cur >= 0) {
        st.pts.forEach((p) => {
          if (p.step !== cur) return;
          const [x, y] = P(p);
          ctx.globalAlpha = 0.6;
          ctx.drawImage(sprite(col), x - 9, y - 9, 18, 18);
        });
      }
      // углы — акценты: бусины
      if (st.corners) st.corners.forEach((i) => {
        const [x, y] = P(st.pts[i]);
        ctx.globalAlpha = 0.9;
        ctx.drawImage(sprite(col), x - 11, y - 11, 22, 22);
        ctx.fillStyle = CREAM;
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      });
    }

    // искры
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i], age = (t - s.born) / 1.6;
      if (age >= 1) { sparks.splice(i, 1); continue; }
      const d = (1 - Math.pow(1 - age, 3)) * s.d * M;
      const x = cx + Math.cos(s.a) * d, y = cy + Math.sin(s.a) * d;
      ctx.globalAlpha = 1 - age;
      ctx.drawImage(sprite(s.color), x - 7, y - 7, 14, 14);
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill();
    }

    // звезда
    const g1 = M * 0.16 * (1 + flash * 0.35);
    ctx.globalAlpha = 0.35 + flash * 0.25;
    ctx.drawImage(sprite(mix.color), cx - g1 / 2, cy - g1 / 2, g1, g1);
    const g2 = M * 0.06 * (1 + flash * 0.5);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(sprite('#fff3dc'), cx - g2 / 2, cy - g2 / 2, g2, g2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = CREAM;
    ctx.beginPath(); ctx.arc(cx, cy, 4 + flash * 1.5, 0, Math.PI * 2); ctx.fill();

    // станция орбиты: кольцо прослушивания — урок пройден, когда оно замкнулось
    if (EMBED && !FEEL) {
      if (!passed && ac && ac.state === 'running' && soundOn) {
        heard += dt;
        if (heard >= LISTEN_S) { passed = true; reportToMap(); updateHint(); }
      }
      const lr = M * 0.1, u = passed ? 1 : heard / LISTEN_S;
      ctx.lineWidth = 1; ctx.lineCap = 'round';
      ctx.strokeStyle = CREAM; ctx.globalAlpha = 0.12;
      ctx.beginPath(); ctx.arc(cx, cy, lr, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = passed ? mix.color : CREAM; ctx.globalAlpha = passed ? 0.8 : 0.6;
      ctx.beginPath(); ctx.arc(cx, cy, lr, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // кольцо смеси: доли состояний дугами
    if (mixed) {
      const rr = M * 0.115;
      let a0 = -Math.PI / 2;
      ctx.lineWidth = 2.5; ctx.lineCap = 'butt';
      mix.ws.forEach((w, kk) => {
        if (w <= 0.05) return;
        const span = (w / mix.W) * Math.PI * 2;
        ctx.strokeStyle = STATES[kk].color; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(cx, cy, rr, a0 + 0.04, a0 + span - 0.04); ctx.stroke();
        a0 += span;
      });
      ctx.globalAlpha = 1;
    }

    // круги от нот
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i], age = (t - r.born) / 1.4;
      if (age >= 1) { ripples.splice(i, 1); continue; }
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 0.3 * (1 - age);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 10 + age * M * 0.11, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // подписи
    clusters.forEach((c) => { c.btn.style.transform = `translate(${c.x}px, ${c.y}px) translate(-50%, -50%)`; });
    starTag.style.transform = `translate(${cx}px, ${cy - M * 0.135}px) translate(-50%, -100%)`;

    requestAnimationFrame(draw);
  }

  // ---------- события ----------
  clusters.forEach((c) => {
    c.btn.addEventListener('click', () => {
      if (mode === 'paint') { brush = c.k; ensureAudio(); preview(c.k); applyMix(); }
      else addDrop(c.k);
    });
    c.btn.addEventListener('mouseenter', () => { hovered = c.k; preview(c.k); });
    c.btn.addEventListener('mouseleave', () => { if (hovered === c.k) hovered = -1; });
  });

  function clusterAt(x, y) {
    let best = -1, bd = M * 0.09;
    clusters.forEach((c) => {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bd) { bd = d; best = c.k; }
    });
    return best;
  }

  const toLocal = (e) => ({ x: (e.clientX - cx) / M, y: (e.clientY - cy) / M });

  canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'paint') return;
    ensureAudio();
    canvas.setPointerCapture(e.pointerId);
    drawing = { k: brush, pts: [toLocal(e)] };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drawing) {
      const p = toLocal(e), last = drawing.pts[drawing.pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) > 0.014) drawing.pts.push(p);
      return;
    }
    if (mode === 'paint') return;
    const kk = clusterAt(e.clientX, e.clientY);
    if (kk !== hovered && kk >= 0) preview(kk);
    hovered = kk;
    canvas.style.cursor = kk >= 0 ? 'pointer' : '';
  });
  const endStroke = () => {
    if (!drawing) return;
    if (drawing.pts.length > 2) strokes.push(drawing);
    drawing = null;
    rebuildPattern();
    applyMix();
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);
  canvas.addEventListener('click', (e) => {
    if (mode !== 'mix') return;
    const kk = clusterAt(e.clientX, e.clientY);
    if (kk >= 0) addDrop(kk);
  });

  starBtns.forEach((b) => b.addEventListener('click', () => setStar(b.dataset.star)));
  modeBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  clearBtn.addEventListener('click', clearAll);
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? 'sound: on' : 'sound: off';
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    if (ac) master.gain.setTargetAtTime(soundOn ? 0.7 : 0, ac.currentTime, 0.2);
  });

  window.addEventListener('resize', resize);
  resize();
  mix = computeMix();
  if (FEEL) {
    star = 'feel';
    starTag.querySelector('small').textContent = 'your planet';
    starName.textContent = 'emotions';
  } else if (EMBED && STARS[params.get('star')]) {
    star = params.get('star');
    starName.textContent = star;
    starBtns.forEach((b) => b.classList.toggle('is-on', b.dataset.star === star));
  }
  if (EMBED && PRESET.length === STATES.length) PRESET.forEach((w, k) => (drops[k] = Math.max(0, Math.min(MAX_W, w || 0))));
  starLine.textContent = (EMBED && LISTEN_FOR[star]) || STARS[star].line;
  if (EMBED) $('.title').innerHTML = FEEL ? 'planet of<br>emotions' : `${star}<br>station`;
  applyMix();
  if (EMBED) {
    // внутри карты звезда звучит сразу: в неё влетели кликом
    ensureAudio();
    window.addEventListener('pointerdown', ensureAudio);
  }
  requestAnimationFrame(draw);
})();

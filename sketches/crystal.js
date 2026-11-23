/*
 * Эскиз: кристалл из звука.
 * 10 секунд звука режутся на 48 срезов. Каждый срез — один шаг роста:
 *   громкость  → насколько вырастают лучи и длина боковых ветвей
 *   высота     → угол ветвей и цвет (низкое — фиолетовое, высокое — розовое)
 *   шум        → неровность: тональный звук растит симметричный кристалл, шумный — кривой
 *   низы       → полупрозрачные пластины между лучами
 *   первые 0,6 с → сколько у кристалла лучей
 * Когда кристалл вырос, каждая его точка хранит свой кусочек записи:
 * наведите — и услышите тот момент, из которого она выросла.
 */
(() => {
  'use strict';

  // ---------- константы ----------
  const COLORS = ['#b18cff', '#7aa8ff', '#7ad7ff', '#5ee0c8', '#9cff6e',
                  '#ffe14d', '#ffb238', '#ff8a3d', '#ff5a5f', '#ff7ac6']; // от низкого к высокому
  const CREAM = '#f2efe6';
  const DUR = 10;            // секунд записи
  const S = 48;              // срезов
  const SLICE = DUR / S;     // ~0,21 с
  const SEED = 3;            // первые срезы — зерно, по ним выбирается число лучей
  // калибровка: в каких пределах обычно лежат центр спектра (Гц) и его плоскость
  // (замерено на звуках мест: город ~0.03 и 400 Гц, лес ~0.12 и 1800 Гц, дождь ~0.64 и 4700 Гц)
  const CAL = { cLo: 200, cHi: 5000, fLo: 0.01, fHi: 0.6, dbLo: -55, dbHi: -13 };
  const DEBUG = location.hash === '#debug';

  // ---------- DOM ----------
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const $ = (s) => document.querySelector(s);
  const ui = {
    rec: $('[data-rec]'),
    demos: [...document.querySelectorAll('[data-demo]')],
    play: $('[data-play]'),
    sep: $('.sep'),
    again: $('[data-again]'),
    status: $('[data-status]'),
    hud: Object.fromEntries([...document.querySelectorAll('[data-hud]')].map((el) => [el.dataset.hud, el])),
  };

  // ---------- утилиты ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; };
  const colorFor = (bright) => COLORS[Math.min(COLORS.length - 1, Math.floor(bright * COLORS.length))];

  const sprites = {};
  function sprite(color) {
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
  // ЗВУК
  // ======================================================================
  let ac = null, master, verb, analyser, fbuf, tbuf;

  function ensureAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0.9;
    master.connect(ac.destination);

    verb = ac.createConvolver();
    const len = ac.sampleRate * 3, ib = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ib.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
    verb.buffer = ib;
    const wet = ac.createGain(); wet.gain.value = 0.35;
    verb.connect(wet); wet.connect(master);

    // анализатор слушает источник, но сам в колонки не идёт
    analyser = ac.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.4;
    const mute = ac.createGain(); mute.gain.value = 0;
    analyser.connect(mute); mute.connect(ac.destination);
    fbuf = new Float32Array(analyser.frequencyBinCount);
    tbuf = new Float32Array(analyser.fftSize);
  }

  // один кадр анализа: громкость, центр спектра (высота), плоскость спектра (шум), доля низов
  function measure() {
    analyser.getFloatTimeDomainData(tbuf);
    analyser.getFloatFrequencyData(fbuf);
    let sq = 0;
    for (let i = 0; i < tbuf.length; i++) sq += tbuf[i] * tbuf[i];
    const rms = Math.sqrt(sq / tbuf.length);

    // спектр мощности: центр (высота) и плоскость (шум) по нему
    const binHz = ac.sampleRate / analyser.fftSize;
    let sum = 0, wsum = 0, logSum = 0, n = 0, low = 0;
    for (let i = 1; i < fbuf.length; i++) {
      const hz = i * binHz;
      if (hz < 60 || hz > 12000) continue;
      const p = Math.pow(10, fbuf[i] / 10) + 1e-14;
      sum += p; wsum += p * hz; logSum += Math.log(p); n++;
      if (hz < 300) low += p;
    }
    const centroid = sum > 0 ? wsum / sum : 1000;
    const flatness = sum > 0 ? Math.exp(logSum / n) / (sum / n) : 0;
    const db = 20 * Math.log10(rms + 1e-9);
    return {
      loud: clamp01((db - CAL.dbLo) / (CAL.dbHi - CAL.dbLo)),
      bright: clamp01(Math.log(centroid / CAL.cLo) / Math.log(CAL.cHi / CAL.cLo)),
      flat: clamp01(Math.log((flatness + 1e-6) / CAL.fLo) / Math.log(CAL.fHi / CAL.fLo)),
      low: sum > 0 ? low / sum : 0,
      raw: { db, centroid, flatness },
    };
  }

  // ---------- звуки мест (синтез, чтобы эскиз работал без микрофона) ----------
  const demoCache = {};
  async function makeDemo(name) {
    if (demoCache[name]) return demoCache[name];
    const sr = 44100;
    const oc = new OfflineAudioContext(1, sr * DUR, sr);
    const out = oc.createGain(); out.connect(oc.destination);

    const noiseBuf = (sec) => {
      const b = oc.createBuffer(1, Math.max(1, (sr * sec) | 0), sr), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    };
    const noise = (type, freq, q, gain, start = 0, dur = DUR) => {
      const s = oc.createBufferSource(); s.buffer = noiseBuf(dur);
      const f = oc.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = oc.createGain(); g.gain.value = gain;
      s.connect(f); f.connect(g); g.connect(out); s.start(start);
      return g;
    };
    const tone = (type, f0, f1, t, dur, gain, hold = false) => {
      const o = oc.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = oc.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.006);
      if (hold) { g.gain.setValueAtTime(gain, t + dur - 0.05); g.gain.linearRampToValueAtTime(0, t + dur); }
      else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
    };
    const curve = (fn, n = 240) => Float32Array.from({ length: n }, (_, i) => fn((i / (n - 1)) * DUR));

    if (name === 'forest') {
      noise('bandpass', 500, 0.6, 1).gain.setValueCurveAtTime(curve((t) => 0.05 + 0.035 * Math.sin(t * 0.8)), 0, DUR);
      for (let k = 0; k < 12; k++) {
        const t0 = rand(0.2, 9.2), f = rand(2600, 4200), reps = 2 + ((Math.random() * 4) | 0);
        for (let r = 0; r < reps; r++) tone('sine', f, f * rand(1.2, 1.6), t0 + r * 0.11, 0.07, 0.18);
      }
      for (let k = 0; k < 3; k++) {
        const t0 = rand(1, 8.4);
        tone('sine', 900, 700, t0, 0.35, 0.12);
        tone('sine', 900, 650, t0 + 0.45, 0.4, 0.1);
      }
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
      tone('sine', 1400, 1000, 6.2, 0.5, 0.06);
      tone('sine', 1500, 1050, 6.8, 0.45, 0.05);
    } else if (name === 'rain') {
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

  // кусочек записи, из которого выросла точка
  const grainCool = {};
  function playGrain(slice) {
    if (!buffer || !ac) return;
    const t = ac.currentTime;
    if (grainCool[slice] && t - grainCool[slice] < 0.25) return;
    grainCool[slice] = t;
    const src = ac.createBufferSource(); src.buffer = buffer;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.03);
    g.gain.setValueAtTime(0.9, t + 0.28);
    g.gain.linearRampToValueAtTime(0, t + 0.4);
    src.connect(g); g.connect(master); g.connect(verb);
    src.start(t, Math.min(slice * SLICE, DUR - 0.4), 0.42);
  }

  // ======================================================================
  // КРИСТАЛЛ
  // ======================================================================
  // координаты — в долях меньшей стороны экрана, центр в (0,0)
  let mode = 'empty';            // empty → growing → done
  let source = '';               // 'mic' | имя места
  let buffer = null;             // запись — для граней и прослушивания
  let startAt = 0, nextSlice = 0, acc = null, lastF = null;
  let crystal = null;
  let playStart = -1;
  let hoverSlice = -1, hoverAt = -10;
  let mic = null;                // { stream, src, rec, chunks }

  function newCrystal() {
    return { n: 0, arms: [], els: [], nodes: [], seedF: [], lastBright: 0.5 };
  }

  function addEl(el) { el.birth = performance.now() / 1000; crystal.els.push(el); return el; }

  function initArms() {
    const C = crystal;
    const fl = C.seedF.reduce((s, f) => s + f.flat, 0) / C.seedF.length;
    // тональное начало — лёд из 6 лучей; чем больше шума, тем «неправильнее»
    C.n = fl < 0.25 ? 6 : fl < 0.45 ? 5 : fl < 0.65 ? 7 : 8;
    const r0 = 0.022;
    for (let a = 0; a < C.n; a++) {
      const theta = -Math.PI / 2 + (a / C.n) * Math.PI * 2 + rand(-1, 1) * fl * 0.25;
      C.arms.push({ theta, wob: 0, chaos: rand(0.5, 1.5), pts: [{ x: Math.cos(theta) * r0, y: Math.sin(theta) * r0, r: r0, slice: SEED }] });
    }
    ui.hud.sym.textContent = String(C.n);
  }

  function grow(i, f) {
    const C = crystal;

    // зерно: вложенные неровные многоугольники
    if (i < SEED) {
      C.seedF.push(f);
      const k = 5 + i, r = 0.007 + 0.006 * i;
      const pts = [];
      for (let v = 0; v < k; v++) {
        const a = (v / k) * Math.PI * 2 + i * 0.4;
        const rr = r * (1 + rand(-0.25, 0.25) * (0.3 + f.flat));
        pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
      }
      addEl({ k: 'poly', pts, color: colorFor(f.bright), fa: 0.12, slice: i });
      return;
    }
    if (i === SEED) initArms();

    const color = colorFor(f.bright);
    const progress = i / S;
    const dr = 0.0016 + 0.0052 * f.loud;
    const shared = rand(-1, 1);                // общий для всех лучей — порядок
    const dBright = f.bright - C.lastBright;
    C.lastBright = f.bright;
    const onset = f.loud - (C.lastLoud || 0) > 0.12;   // резкое начало звука
    C.lastLoud = f.loud;
    const branchHere = f.loud > 0.2 && (i % 3 === 0 || onset);

    for (const arm of C.arms) {
      const prev = arm.pts[arm.pts.length - 1];
      const own = rand(-1, 1) * arm.chaos;     // свой у каждого луча — шум
      const mix = shared * (1 - f.flat) + own * f.flat;
      arm.wob += dBright * 0.25 + mix * 0.05 * (0.3 + f.flat);
      const r = prev.r + dr * (1 + own * f.flat * 0.3);
      const ang = arm.theta + arm.wob * 0.35;
      const pt = { x: Math.cos(ang) * r, y: Math.sin(ang) * r, r, slice: i };
      arm.pts.push(pt);
      addEl({ k: 'line', a: prev, b: pt, w: 1.5, color: CREAM, alpha: 0.75, slice: i, j: [rand(-1.5, 1.5), rand(-1.5, 1.5)] });
      C.nodes.push(pt);

      if (!branchHere) continue;
      for (const side of [-1, 1]) {
        if (f.flat > 0.45 && Math.random() < f.flat * 0.45) continue;   // шум ломает симметрию
        const ba = ang + side * (0.45 + 0.65 * (1 - f.bright)) + own * f.flat * 0.2;
        const L = (0.01 + 0.05 * f.loud) * (0.55 + 0.45 * Math.sin(Math.PI * progress));
        const tip = { x: pt.x + Math.cos(ba) * L, y: pt.y + Math.sin(ba) * L, slice: i };
        const bend = (shared * (1 - f.flat) + own * f.flat) * L * 0.12;
        const mid = {
          x: (pt.x + tip.x) / 2 - Math.sin(ba) * bend,
          y: (pt.y + tip.y) / 2 + Math.cos(ba) * bend,
        };
        // грань: полупрозрачная цветная плоскость между лучом и ветвью
        const back = arm.pts[Math.max(0, arm.pts.length - 3)];
        addEl({ k: 'poly', pts: [back, pt, tip], color, fa: 0.1 + 0.12 * f.loud, slice: i });
        addEl({ k: 'line', a: pt, m: mid, b: tip, w: 0.9, color: CREAM, alpha: 0.55, slice: i, j: [rand(-1.2, 1.2), rand(-1.2, 1.2)] });
        // бусина — только на громких моментах, остальное — маленькие кремовые точки
        const loudTip = f.loud > 0.55 || onset;
        addEl({ k: 'bead', x: tip.x, y: tip.y, r: loudTip ? 1.6 + 2 * f.loud : 0.9, color: loudTip ? color : CREAM, glow: loudTip, slice: i });
        C.nodes.push(tip);

        // тонкая веточка на самых высоких звуках
        if (f.bright > 0.7 && L > 0.03) {
          const ta = ba + side * 0.7;
          const tl = L * 0.35;
          const twig = { x: mid.x + Math.cos(ta) * tl, y: mid.y + Math.sin(ta) * tl, slice: i };
          addEl({ k: 'line', a: mid, b: twig, w: 0.6, color: CREAM, alpha: 0.4, slice: i, j: [rand(-1, 1), rand(-1, 1)] });
        }
      }
    }

    // пластины на низах: многоугольник через все лучи
    if (f.low > 0.4 && i % 3 === 0) {
      addEl({ k: 'poly', pts: C.arms.map((a) => a.pts[a.pts.length - 1]), color: '#b18cff', fa: 0.05 + 0.08 * f.low, slice: i, edge: true });
    }
  }

  // ---------- сценарий ----------
  function setBusy(busy) {
    [ui.rec, ...ui.demos].forEach((b) => (b.disabled = busy));
  }

  function setDone(done) {
    ui.play.hidden = !done;
    ui.again.hidden = !done;
    [ui.rec, ...ui.demos, ui.sep].forEach((b) => (b.hidden = done));
  }

  function begin(src) {
    crystal = newCrystal();
    source = src;
    mode = 'growing';
    startAt = ac.currentTime;
    nextSlice = 0;
    acc = null; lastF = null;
    playStart = -1;
    document.body.classList.remove('is-empty');
    setBusy(true);
    setDone(false);
    ui.hud.sym.textContent = '—';
  }

  function finish() {
    mode = 'done';
    setBusy(false);
    if (source === 'mic' && mic) {
      ui.status.textContent = 'saving the recording…';
      const { rec, stream, src } = mic;
      rec.onstop = async () => {
        try {
          const blob = new Blob(mic.chunks, { type: rec.mimeType || 'audio/webm' });
          buffer = await ac.decodeAudioData(await blob.arrayBuffer());
          ui.status.textContent = 'hover the points — each one keeps its own moment';
          setDone(true);
        } catch (e) {
          ui.status.textContent = 'could not save the recording';
        }
        mic = null;
      };
      rec.stop();
      stream.getTracks().forEach((t) => t.stop());
      src.disconnect();
    } else {
      ui.status.textContent = 'hover the points — each one keeps its own moment';
      setDone(true);
    }
  }

  async function startDemo(name) {
    ensureAudio();
    setBusy(true);
    ui.status.textContent = 'gathering the sound of the place…';
    buffer = await makeDemo(name);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.connect(master);
    src.connect(analyser);
    begin(name);
    src.start(startAt);
    ui.status.textContent = `${name} · growing`;
  }

  async function startMic() {
    ensureAudio();
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      ui.status.textContent = 'this browser cannot record sound';
      return;
    }
    setBusy(true);
    ui.status.textContent = 'allow access to the microphone';
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      ui.status.textContent = 'no access to the microphone';
      setBusy(false);
      return;
    }
    const src = ac.createMediaStreamSource(stream);
    src.connect(analyser);                    // в колонки не идёт — иначе будет эхо
    const rec = new MediaRecorder(stream);
    mic = { stream, src, rec, chunks: [] };
    rec.ondataavailable = (e) => { if (e.data.size) mic.chunks.push(e.data); };
    rec.start();
    buffer = null;
    begin('mic');
    ui.status.textContent = 'listening · 10 seconds';
  }

  function playCrystal() {
    if (!buffer) return;
    ensureAudio();
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.connect(master);
    playStart = ac.currentTime;
    src.start(playStart);
  }

  function reset() {
    mode = 'empty';
    crystal = null;
    buffer = null;
    playStart = -1;
    document.body.classList.add('is-empty');
    setDone(false);
    setBusy(false);
    ui.status.textContent = '';
    Object.values(ui.hud).forEach((el) => (el.textContent = '—'));
    ui.hud.slice.textContent = '— / 48';
  }

  // ---------- рисование ----------
  let W = 0, H = 0, DPR = 1, M = 1, cx = 0, cy = 0, rot = 0;
  const t0 = performance.now() / 1000;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    M = Math.min(W, H);
    cx = W / 2; cy = H * 0.48;
  }

  function P(p, dx = 0, dy = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    return [cx + (p.x * c - p.y * s) * M + dx, cy + (p.x * s + p.y * c) * M + dy];
  }

  // ломаная, нарисованная на долю g
  function strokePartial(pts, g) {
    const segs = [];
    let total = 0;
    for (let k = 1; k < pts.length; k++) {
      const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      segs.push(l); total += l;
    }
    let left = total * g;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length && left > 0; k++) {
      const u = Math.min(1, left / (segs[k - 1] || 1));
      ctx.lineTo(pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u);
      left -= segs[k - 1];
    }
    ctx.stroke();
  }

  function highlight(slice, t) {
    let h = 0;
    if (playStart >= 0 && ac) {
      const active = (ac.currentTime - playStart) / SLICE;
      if (active > S + 4) playStart = -1;
      else h = Math.exp(-((slice - active) ** 2) / 6);
    }
    if (hoverSlice >= 0) h = Math.max(h, Math.exp(-((slice - hoverSlice) ** 2) / 1.5) * Math.max(0, 1 - (t - hoverAt) / 1.2));
    return h;
  }

  function draw() {
    const t = performance.now() / 1000;
    ctx.clearRect(0, 0, W, H);
    rot = (t - t0) * 0.012;

    // пустое состояние — одна дышащая точка
    if (!crystal) {
      ctx.globalCompositeOperation = 'lighter';
      const g = 30 + 8 * Math.sin(t * 2);
      ctx.globalAlpha = 0.7;
      ctx.drawImage(sprite('#ffe9c4'), cx - g / 2, cy - g / 2, g, g);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = CREAM;
      ctx.beginPath(); ctx.arc(cx, cy, 1.8, 0, Math.PI * 2); ctx.fill();
      requestAnimationFrame(draw);
      return;
    }

    // прогресс записи — пунктирная дуга
    if (mode === 'growing') {
      const prog = clamp01((ac.currentTime - startAt) / DUR);
      ctx.save();
      ctx.setLineDash([2, 8]);
      ctx.strokeStyle = CREAM; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, M * 0.46, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.1;
      ctx.beginPath(); ctx.arc(cx, cy, M * 0.46, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    const els = crystal.els;
    // 1) грани и пластины
    for (const el of els) {
      if (el.k !== 'poly') continue;
      const g = easeOut(clamp01((t - el.birth) / 0.6));
      const h = highlight(el.slice, t);
      ctx.beginPath();
      el.pts.forEach((p, k) => { const [x, y] = P(p); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath();
      ctx.fillStyle = rgba(el.color, Math.min(0.5, el.fa * g * (1 + h * 2.5)));
      ctx.fill();
      if (el.edge !== false) {
        ctx.strokeStyle = CREAM; ctx.lineWidth = 0.7;
        ctx.globalAlpha = 0.2 * g * (1 + h);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // 2) линии: основная + «карандашная» вторая
    ctx.lineCap = 'round';
    for (const el of els) {
      if (el.k !== 'line') continue;
      const g = easeOut(clamp01((t - el.birth) / 0.5));
      const h = highlight(el.slice, t);
      const pts = el.m ? [P(el.a), P(el.m), P(el.b)] : [P(el.a), P(el.b)];
      ctx.strokeStyle = h > 0.05 ? CREAM : el.color;
      ctx.globalAlpha = Math.min(1, el.alpha * (1 + h));
      ctx.lineWidth = el.w * (1 + h * 0.8);
      strokePartial(pts, g);
      const pts2 = pts.map(([x, y]) => [x + el.j[0], y + el.j[1]]);
      ctx.globalAlpha = el.alpha * 0.3;
      ctx.lineWidth = 0.6;
      strokePartial(pts2, g);
    }
    // 3) бусины со свечением
    ctx.globalCompositeOperation = 'lighter';
    for (const el of els) {
      if (el.k !== 'bead') continue;
      const g = easeOut(clamp01((t - el.birth - 0.3) / 0.5));
      if (g <= 0) continue;
      const h = highlight(el.slice, t);
      const [x, y] = P(el);
      if (el.glow || h > 0.05) {
        const s = Math.max(el.r, 1.6) * 9 * g * (1 + h * 1.5);
        ctx.globalAlpha = el.glow ? 0.8 : 0.6 * h;
        ctx.drawImage(sprite(el.color === CREAM ? '#ffe9c4' : el.color), x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = el.glow ? 1 : 0.75;
      ctx.fillStyle = el.color;
      ctx.beginPath(); ctx.arc(x, y, el.r * g, 0, Math.PI * 2); ctx.fill();
    }
    // 4) сердцевина
    const pulse = mode === 'growing' ? 1 + 0.3 * Math.sin(t * 8) : 1;
    const cg = 46 * pulse;
    ctx.globalAlpha = 0.65;
    ctx.drawImage(sprite('#ffe9c4'), cx - cg / 2, cy - cg / 2, cg, cg);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = CREAM;
    ctx.beginPath(); ctx.arc(cx, cy, 2.2, 0, Math.PI * 2); ctx.fill();

    requestAnimationFrame(draw);
  }

  // ---------- такт анализа ----------
  function tick() {
    if (mode === 'growing' && ac) {
      const f = measure();
      if (!acc) acc = { loud: 0, bright: 0, flat: 0, low: 0, n: 0, db: 0, c: 0, fl: 0 };
      acc.loud += f.loud; acc.bright += f.bright; acc.flat += f.flat; acc.low += f.low; acc.n++;
      acc.db += f.raw.db; acc.c += f.raw.centroid; acc.fl += f.raw.flatness;

      const el = ac.currentTime - startAt;
      while (mode === 'growing' && nextSlice < S && el >= (nextSlice + 1) * SLICE) {
        const sf = acc.n
          ? { loud: acc.loud / acc.n, bright: acc.bright / acc.n, flat: acc.flat / acc.n, low: acc.low / acc.n }
          : lastF || { loud: 0, bright: 0.5, flat: 0.5, low: 0.3 };
        if (DEBUG && acc && acc.n) {
          (window.crystalLog = window.crystalLog || []).push({
            src: source, i: nextSlice,
            db: +(acc.db / acc.n).toFixed(1), c: Math.round(acc.c / acc.n), fl: +(acc.fl / acc.n).toFixed(3), low: +sf.low.toFixed(2),
          });
        }
        acc = null;
        lastF = sf;
        grow(nextSlice, sf);
        ui.hud.loud.textContent = sf.loud.toFixed(2);
        ui.hud.bright.textContent = sf.bright.toFixed(2);
        ui.hud.flat.textContent = sf.flat.toFixed(2);
        ui.hud.slice.textContent = `${nextSlice + 1} / ${S}`;
        nextSlice++;
        if (nextSlice >= S) finish();
      }
    }
    requestAnimationFrame(tick);
  }

  // ---------- наведение ----------
  function probe(x, y) {
    if (mode !== 'done' || !crystal) return;
    let best = null, bd = 16;
    for (const p of crystal.nodes) {
      const [px, py] = P(p);
      const d = Math.hypot(px - x, py - y);
      if (d < bd) { bd = d; best = p; }
    }
    canvas.style.cursor = best ? 'pointer' : '';
    if (best && best.slice !== hoverSlice) {
      hoverSlice = best.slice;
      hoverAt = performance.now() / 1000;
      playGrain(best.slice);
    } else if (!best) {
      hoverSlice = -1;
    }
  }

  // ---------- события ----------
  ui.rec.addEventListener('click', startMic);
  ui.demos.forEach((b) => b.addEventListener('click', () => startDemo(b.dataset.demo)));
  ui.play.addEventListener('click', playCrystal);
  ui.again.addEventListener('click', reset);
  window.addEventListener('pointermove', (e) => probe(e.clientX, e.clientY));
  window.addEventListener('pointerdown', (e) => { if (e.target === canvas) probe(e.clientX, e.clientY); });
  window.addEventListener('resize', resize);

  resize();
  requestAnimationFrame(draw);
  requestAnimationFrame(tick);
})();

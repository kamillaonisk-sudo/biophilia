/*
 * Рождение звезды — вступление сайта.
 * Чёрный экран → точка света и низкий гул → рост → вспышка → осколки
 * разлетаются и становятся парящими точками. Каждая точка звучит
 * гармоникой той же частоты, что и гул звезды (55 Гц), — все звуки
 * сайта буквально «осколки одной звезды».
 *
 * Когда вступление заканчивается, на #intro срабатывает событие
 * `intro:done` — по нему можно показывать остальной сайт.
 */
(() => {
  'use strict';

  // ---------- константы ----------
  const PALETTE = ['#ff5a5f', '#ffb238', '#ffe14d', '#5ee0c8', '#ff7ac6',
                   '#7aa8ff', '#b18cff', '#7ad7ff', '#9cff6e', '#ff8a3d'];
  const CREAM = '#f2efe6';
  const BASE = 55;                       // основной тон звезды, Гц
  const HARMS_LOW = [3, 4, 5, 6];        // крупные звёзды — низкие гармоники
  const HARMS_HIGH = [8, 9, 10, 12, 15, 16, 18, 20];
  const CHARGE = 3.6;                    // сколько секунд звезда набирает силу
  const FLASH = 2.6;                     // длительность вспышки
  const THREADS_AT = 4.2;                // когда начинают проявляться созвездия
  const DONE_AT = 8;                     // через сколько секунд после взрыва — intro:done
  const VOLUME = 0.4;                    // общая громкость вступления (было 0.9 — слишком громко)
  // подписи у крупных звёзд: где-то сейчас кто-то чувствует вот это
  const CITIES = ['reykjavík', 'lisbon', 'tokyo', 'lagos', 'são paulo', 'mumbai', 'tbilisi', 'mexico city',
                  'seoul', 'cairo', 'oslo', 'nairobi', 'buenos aires', 'jakarta', 'almaty', 'berlin', 'montréal', 'hanoi'];
  const FEELINGS = ['calm', 'wonder', 'anxiety', 'tenderness', 'melancholy', 'joy', 'anger', 'fear', 'hope', 'gratitude', 'serenity', 'yearning',
                    'contemplation', 'awe', 'longing', 'delight', 'nostalgia', 'warmth', 'reverie', 'solitude'];

  const root = document.getElementById('intro');
  const canvas = root.querySelector('.intro__canvas');
  const ctx = canvas.getContext('2d');
  const btnSound = root.querySelector('[data-sound]');
  const btnSkip = root.querySelector('[data-skip]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- утилиты ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const now = () => performance.now() / 1000;
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  // свечения рисуются заранее подготовленными спрайтами — так быстрее
  const sprites = {};
  function sprite(color) {
    if (sprites[color]) return sprites[color];
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const [r, gg, b] = hexToRgb(color);
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, `rgba(${r},${gg},${b},1)`);
    grd.addColorStop(0.15, `rgba(${r},${gg},${b},.5)`);
    grd.addColorStop(0.45, `rgba(${r},${gg},${b},.1)`);
    grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    return (sprites[color] = c);
  }

  // ======================================================================
  // ЗВУК
  // ======================================================================
  function hold(param, t) {
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
    else { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); }
  }

  const Sound = {
    c: null, master: null, verb: null, hum: null, riser: null, on: true,

    init() {
      if (this.c) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.c = new AC());
      this.master = c.createGain();
      this.master.gain.value = this.on ? VOLUME : 0;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5;
      this.master.connect(comp);
      comp.connect(c.destination);

      // простая «космическая» реверберация из шума
      this.verb = c.createConvolver();
      this.verb.buffer = this.impulse(4, 2.8);
      const wet = c.createGain();
      wet.gain.value = 0.4;
      this.verb.connect(wet);
      wet.connect(this.master);
    },

    resume() { if (this.c && this.c.state === 'suspended') this.c.resume(); },

    impulse(sec, decay) {
      const c = this.c, len = (c.sampleRate * sec) | 0;
      const buf = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    },

    noiseBuf(sec) {
      const c = this.c, len = (c.sampleRate * sec) | 0;
      const b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return b;
    },

    // низкий гул звезды: суб + основной тон с биениями + обертоны
    startHum(level) {
      const c = this.c;
      if (!c || this.hum) return;
      const t = c.currentTime;
      const out = c.createGain();
      out.gain.value = 0;
      out.gain.setTargetAtTime(level, t, 0.6);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 0.8;
      lp.connect(out);
      out.connect(this.master);
      const send = c.createGain();
      send.gain.value = 0.25;
      out.connect(send); send.connect(this.verb);

      const oscs = [
        [BASE / 2, 'sine', 0.6],
        [BASE, 'sine', 0.5],
        [BASE * 1.006, 'sine', 0.4],
        [BASE * 2, 'triangle', 0.12],
        [BASE * 3, 'sine', 0.05],
      ].map(([f, type, g]) => {
        const o = c.createOscillator();
        o.type = type; o.frequency.value = f;
        const gn = c.createGain(); gn.gain.value = g;
        o.connect(gn); gn.connect(lp);
        o.start();
        return o;
      });

      // медленное «дыхание» фильтра
      const lfo = c.createOscillator(); lfo.frequency.value = 0.13;
      const lg = c.createGain(); lg.gain.value = 70;
      lfo.connect(lg); lg.connect(lp.frequency); lfo.start();

      this.hum = { out, lp, oscs };
    },

    // звезда набирает силу: гул громче, ярче, выше + шумовой подъём
    charge(dur) {
      const c = this.c, h = this.hum;
      if (!c || !h) return;
      const t = c.currentTime;
      hold(h.out.gain, t);
      h.out.gain.linearRampToValueAtTime(0.6, t + dur * 0.9);
      h.out.gain.linearRampToValueAtTime(0.08, t + dur);          // вдох перед взрывом
      hold(h.lp.frequency, t);
      h.lp.frequency.exponentialRampToValueAtTime(1400, t + dur * 0.9);
      h.oscs.forEach((o) => {
        hold(o.detune, t);
        o.detune.linearRampToValueAtTime(300, t + dur * 0.9);
        o.detune.linearRampToValueAtTime(-200, t + dur);
      });

      const src = c.createBufferSource();
      src.buffer = this.noiseBuf(dur + 0.3);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 3;
      bp.frequency.setValueAtTime(150, t);
      bp.frequency.exponentialRampToValueAtTime(4000, t + dur * 0.9);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + dur * 0.9);
      g.gain.linearRampToValueAtTime(0, t + dur);
      src.connect(bp); bp.connect(g); g.connect(this.master); g.connect(this.verb);
      src.start(t); src.stop(t + dur + 0.3);
      this.riser = { src, g };
    },

    // после рождения гул остаётся тихим фоном
    toDrone(delay = 0) {
      const c = this.c, h = this.hum;
      if (!c || !h) return;
      const t0 = c.currentTime, t = t0 + delay;
      hold(h.out.gain, t0); h.out.gain.setTargetAtTime(0.1, t, 1.5);
      hold(h.lp.frequency, t0); h.lp.frequency.setTargetAtTime(240, t, 1);
      h.oscs.forEach((o) => { hold(o.detune, t0); o.detune.setTargetAtTime(0, t, 0.8); });
    },

    stopRiser() {
      if (!this.riser) return;
      const t = this.c.currentTime;
      hold(this.riser.g.gain, t);
      this.riser.g.gain.linearRampToValueAtTime(0, t + 0.05);
      this.riser = null;
    },

    boom() {
      const c = this.c;
      if (!c) return;
      const t = c.currentTime;
      this.stopRiser();

      // удар: падающий низкий синус
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(24, t + 2);
      const og = c.createGain();
      og.gain.setValueAtTime(0, t);
      og.gain.linearRampToValueAtTime(1, t + 0.01);
      og.gain.exponentialRampToValueAtTime(0.001, t + 3.5);
      o.connect(og); og.connect(this.master);
      o.start(t); o.stop(t + 3.6);

      // взрывная волна: долгий шум, который медленно темнеет
      const n = c.createBufferSource();
      n.buffer = this.noiseBuf(8);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 0.5;
      lp.frequency.setValueAtTime(10000, t);
      lp.frequency.exponentialRampToValueAtTime(110, t + 6);
      const ng = c.createGain();
      ng.gain.setValueAtTime(0, t);
      ng.gain.linearRampToValueAtTime(0.7, t + 0.015);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 7.5);
      n.connect(lp); lp.connect(ng); ng.connect(this.master); ng.connect(this.verb);
      n.start(t); n.stop(t + 8);

      // осколки: россыпь гармоник того же тона, пока они летят
      const harms = HARMS_LOW.concat(HARMS_HIGH);
      for (let i = 0; i < 26; i++) {
        const dt = 0.08 + Math.pow(Math.random(), 1.4) * 5.5;
        this.tone(pick(harms), rand(-0.9, 0.9), rand(0.025, 0.06), t + dt, rand(2, 4));
      }

      this.toDrone(2.5);
    },

    // один «осколок»: гармоника основного тона с мягким затуханием
    tone(harm, pan, gain, when, dur) {
      const c = this.c;
      if (!c) return;
      const t = when === undefined ? c.currentTime : when;
      const f = BASE * harm;
      const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.003;
      const g2 = c.createGain(); g2.gain.value = 0.18;
      const env = c.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(gain, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o1.connect(env); o2.connect(g2); g2.connect(env);
      let out = env;
      if (c.createStereoPanner) {
        const p = c.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        env.connect(p); out = p;
      }
      out.connect(this.master); out.connect(this.verb);
      o1.start(t); o2.start(t);
      o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    },

    setEnabled(on) {
      this.on = on;
      if (this.master) this.master.gain.setTargetAtTime(on ? VOLUME : 0, this.c.currentTime, 0.2);
    },
  };

  // ======================================================================
  // СЦЕНА
  // ======================================================================
  let W = 0, H = 0, DPR = 1, cx = 0, cy = 0;
  let phase = 'idle';            // idle → charging → born
  let tStart = 0, tBoom = 0, fadeStart = -1e9, doneFired = false;
  let particles = [], nodes = [], links = [], labels = [], rays = [], infall = [];
  let hovered = null, lastTone = 0, lastT = now();

  function resize() {
    const oldW = W, oldH = H;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = W / 2; cy = H / 2;
    if (oldW && particles.length) {
      const sx = W / oldW, sy = H / oldH;
      for (const p of particles) { p.sx *= sx; p.sy *= sy; p.tx *= sx; p.ty *= sy; }
    }
  }

  // лучи-«нейроны», которые вырастают из звезды, пока она набирает силу
  function makeRays() {
    rays = [];
    for (let i = 0; i < 16; i++) {
      rays.push({
        a: (i / 16) * Math.PI * 2 + rand(-0.15, 0.15),
        len: rand(0.45, 1),
        loop: Math.random() < 0.45,
        f: rand(3, 9), p: rand(0, 6.28),
      });
    }
  }

  // пылинки, которые затягивает в звезду
  function makeInfall() {
    infall = [];
    const m = Math.min(W, H);
    for (let i = 0; i < 70; i++) {
      infall.push({ a: rand(0, 6.28), r0: rand(0.14, 0.48) * m, u0: rand(0, 0.72), dur: rand(0.2, 0.35), s: rand(0.6, 1.4) });
    }
  }

  // осколки: у каждого своя финальная точка, скорость, закрутка, дрейф и нота
  function spawn() {
    particles = [];
    const N = Math.round(Math.min(320, Math.max(140, (W * H) / 6500)));
    const rx = W * 0.56, ry = H * 0.56;
    for (let i = 0; i < N; i++) {
      const roll = Math.random();
      const type = roll < 0.58 ? 'dust' : roll < 0.9 ? 'bead' : 'star';
      const a = Math.random() * Math.PI * 2;
      const d = Math.pow(Math.random(), 0.62);
      particles.push({
        type,
        sx: cx, sy: cy,
        tx: cx + Math.cos(a) * d * rx,
        ty: cy + Math.sin(a) * d * ry,
        x: cx, y: cy,
        r: type === 'dust' ? rand(0.5, 1.3) : type === 'bead' ? rand(1.6, 3) : rand(3.2, 5.5),
        color: type === 'dust' ? CREAM : pick(PALETTE),
        k: rand(0.5, 1.4) * (type === 'dust' ? 1.2 : 1),   // меньше — дольше летят
        curl: rand(-1, 1) * (30 + d * 80),
        A: type === 'dust' ? rand(1, 4) : rand(3, 9),
        f1: rand(0.05, 0.18), f2: rand(0.05, 0.18),
        p1: rand(0, 6.28), p2: rand(0, 6.28),
        tw: rand(0.6, 2.4), tp: rand(0, 6.28),
        alpha: type === 'dust' ? rand(0.35, 0.8) : rand(0.75, 1),
        excite: 0, cool: 0,
        harm: type === 'star' ? pick(HARMS_LOW) : pick(HARMS_HIGH),
      });
    }
    nodes = particles.filter((p) => p.type !== 'dust');

    // созвездия: каждая крупная звезда тянет нити к 1–2 ближайшим
    links = [];
    const seen = new Set();
    const maxD = Math.min(W, H) * 0.3;
    const stars = particles.filter((p) => p.type === 'star');
    stars.forEach((s, si) => {
      nodes
        .filter((n) => n !== s)
        .map((n) => [n, Math.hypot(n.tx - s.tx, n.ty - s.ty)])
        .filter(([, d]) => d < maxD)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 2)
        .forEach(([n]) => {
          const ia = particles.indexOf(s), ib = particles.indexOf(n);
          const key = Math.min(ia, ib) + '-' + Math.max(ia, ib);
          if (seen.has(key)) return;
          seen.add(key);
          links.push({ a: s, b: n, delay: si * 0.06 + rand(0, 0.3) });
        });
    });

    const cities = CITIES.slice().sort(() => Math.random() - 0.5);
    // подписи — только у звёзд подальше от даты в центре и от кнопки внизу
    const free = (p) => Math.hypot((p.tx - cx) / 1.6, p.ty - cy) > Math.min(W, H) * 0.2 &&
      !(p.ty > H - 150 && Math.abs(p.tx - cx) < 260) && p.tx < W - 220 && p.ty > 60;
    labels = stars.filter(free).sort(() => Math.random() - 0.5).slice(0, 6);
    labels.forEach((p, i) => (p.label = `${cities[i]} · ${pick(FEELINGS)}`));
  }

  // ---------- рисование ----------
  function drawCore(t, u) {
    const grow = Math.pow(u, 2.2);
    let r = 1.6 + 0.35 * Math.sin(t * 2.2) + 9 * grow;
    let g = 26 + 8 * Math.sin(t * 2.2) + 280 * grow;
    if (u > 0.9) { const k = (u - 0.9) / 0.1; r *= 1 - 0.7 * k; g *= 1 - 0.5 * k; }  // сжатие перед взрывом
    const j = 2.5 * grow;
    const x = cx + rand(-j, j), y = cy + rand(-j, j);

    ctx.globalCompositeOperation = 'lighter';
    if (u > 0.4) {
      const h = (u - 0.4) / 0.6;
      ctx.globalAlpha = 0.25 * h;
      ctx.drawImage(sprite('#b18cff'), x - g * 0.8, y - g * 0.8, g * 1.6, g * 1.6);
      ctx.globalAlpha = 0.2 * h;
      ctx.drawImage(sprite('#ff7ac6'), x - g * 0.6, y - g * 0.6, g * 1.2, g * 1.2);
    }
    ctx.globalAlpha = 0.55 + 0.4 * grow;
    ctx.drawImage(sprite('#ffe9c4'), x - g / 2, y - g / 2, g, g);
    ctx.globalAlpha = 1;
    ctx.fillStyle = CREAM;
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawRays(t, u) {
    if (u < 0.25) return;
    const grow = (u - 0.25) / 0.75;
    const fade = u > 0.9 ? 1 - (u - 0.9) / 0.1 : 1;
    ctx.strokeStyle = CREAM;
    ctx.fillStyle = CREAM;
    ctx.lineWidth = 0.7;
    for (const ray of rays) {
      const fl = 0.5 + 0.5 * Math.sin(t * ray.f + ray.p);
      const len = (16 + 170 * grow * ray.len) * (0.7 + 0.3 * fl);
      const ca = Math.cos(ray.a), sa = Math.sin(ray.a);
      const x1 = cx + ca * 8, y1 = cy + sa * 8;
      const x2 = cx + ca * len, y2 = cy + sa * len;
      ctx.globalAlpha = 0.3 * grow * fl * fade;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.beginPath();
      if (ray.loop) { ctx.arc(x2 + ca * 4, y2 + sa * 4, 4, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.arc(x2, y2, 1.4, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  function drawInfall(u) {
    ctx.fillStyle = CREAM;
    for (const p of infall) {
      const lu = clamp01((u - p.u0) / p.dur);
      if (lu <= 0 || lu >= 1) continue;
      const r = p.r0 * (1 - lu * lu);
      ctx.globalAlpha = Math.sin(lu * Math.PI) * 0.7;
      ctx.fillRect(cx + Math.cos(p.a) * r, cy + Math.sin(p.a) * r, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawWorld(t, dt) {
    const tb = t - tBoom;
    const wa = clamp01((t - fadeStart) / 1.6);

    // вспышка: белый экран → расходящееся тёплое сияние → гаснущее ядро с лучом
    if (tb < FLASH) {
      const u = tb / FLASH;
      const a = Math.pow(1 - u, 2.2);
      const R = 80 + easeOut(u) * Math.hypot(W, H) * 1.1;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      grd.addColorStop(0, `rgba(255,255,248,${a})`);
      grd.addColorStop(0.18, `rgba(255,236,200,${a * 0.8})`);
      grd.addColorStop(0.5, `rgba(255,190,150,${a * 0.3})`);
      grd.addColorStop(1, 'rgba(255,170,140,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      if (tb < 0.9) {                                   // ослепляющий белый
        const w = Math.pow(1 - tb / 0.9, 1.6);
        ctx.fillStyle = `rgba(255,252,244,${w * 0.92})`;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.globalCompositeOperation = 'lighter';
      const core = Math.pow(1 - u, 1.5);
      const s = 120 + 900 * core;
      ctx.globalAlpha = core;
      ctx.drawImage(sprite('#fff6e0'), cx - s / 2, cy - s / 2, s, s);
      ctx.globalAlpha = core * 0.85;                    // горизонтальный луч
      const sw = W * 1.3 * (0.4 + 0.6 * core), sh = 10 + 18 * core;
      ctx.drawImage(sprite('#ffe9c4'), cx - sw / 2, cy - sh / 2, sw, sh);
      ctx.globalAlpha = core * 0.45;                    // вертикальный, короче
      const vh = H * 0.7 * core, vw = 6 + 8 * core;
      ctx.drawImage(sprite('#ffe9c4'), cx - vw / 2, cy - vh / 2, vw, vh);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // ударные волны — два пунктирных кольца
    [[0, 5, 0.55], [0.5, 5.5, 0.3]].forEach(([d, dur, al]) => {
      const u = (tb - d) / dur;
      if (u <= 0 || u >= 1) return;
      const R = easeOut(u) * Math.hypot(W, H) * 0.62;
      ctx.save();
      ctx.setLineDash([2, 9]);
      ctx.strokeStyle = CREAM; ctx.lineWidth = 1;
      ctx.globalAlpha = al * (1 - u);
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });

    // орбиты, как на старой схеме комет
    const oa = clamp01((tb - 2.5) / 3.5) * wa;
    if (oa > 0) {
      ctx.save();
      ctx.setLineDash([2, 9]);
      ctx.strokeStyle = CREAM; ctx.lineWidth = 1;
      [[0.24, 0.17, 0.22], [0.42, 0.3, 0.18], [0.66, 0.44, 0.14]].forEach(([a, b, al], i) => {
        ctx.globalAlpha = al * oa;
        ctx.beginPath();
        ctx.ellipse(cx, cy, W * a * 0.75, H * b * 1.1, -0.25 + i * 0.18 + t * 0.004 * (i % 2 ? 1 : -1), 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();
    }

    // нити созвездий (позиции — с прошлого кадра, разница незаметна)
    if (tb > THREADS_AT) {
      ctx.strokeStyle = CREAM; ctx.fillStyle = CREAM; ctx.lineWidth = 0.9;
      for (const L of links) {
        const u = clamp01((tb - THREADS_AT - L.delay) / 1.4);
        if (u <= 0) continue;
        const e = easeInOut(u);
        const ax = L.a.x, ay = L.a.y;
        const bx = ax + (L.b.x - ax) * e, by = ay + (L.b.y - ay) * e;
        const lit = L.a === hovered || L.b === hovered ? 1.8 : 1;
        ctx.globalAlpha = Math.min(0.7, 0.32 * wa * lit);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        if (u === 1) {
          ctx.globalAlpha = 0.55 * wa;
          ctx.beginPath(); ctx.arc((ax + bx) / 2, (ay + by) / 2, 1.6, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // осколки
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const p of particles) {
      const e = 1 - Math.exp(-p.k * tb);
      const dx = p.tx - p.sx, dy = p.ty - p.sy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const c = p.curl * 4 * e * (1 - e);
      p.x = p.sx + dx * e + nx * c + Math.sin(t * p.f1 * 6.28 + p.p1) * p.A * e;
      p.y = p.sy + dy * e + ny * c + Math.cos(t * p.f2 * 6.28 + p.p2) * p.A * e;
      p.excite = Math.max(0, p.excite - dt * 0.8);

      const tw = 0.72 + 0.28 * Math.sin(t * p.tw + p.tp);
      const al = p.alpha * tw * wa;
      const speed = len * p.k * Math.exp(-p.k * tb);

      // след в полёте
      if (speed > 20 && tb < 8) {
        const sl = Math.min(speed * 0.07, 90);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = al * 0.55;
        ctx.lineWidth = Math.max(0.6, p.r * 0.7);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (dx / len) * sl, p.y - (dy / len) * sl); ctx.stroke();
      }

      if (p.type === 'dust') {
        ctx.globalAlpha = al;
        ctx.fillStyle = CREAM;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      } else {
        const gs = p.r * (p.type === 'star' ? 10 : 7) * (1 + p.excite * 1.4);
        ctx.globalAlpha = al * (p.type === 'star' ? 0.9 : 0.75);
        ctx.drawImage(sprite(p.color), p.x - gs / 2, p.y - gs / 2, gs, gs);
        ctx.globalAlpha = al;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        if (p.type === 'star') {
          ctx.fillStyle = CREAM;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.38, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // кольцо вокруг точки под курсором
    if (hovered && hovered.excite > 0.01) {
      ctx.strokeStyle = CREAM; ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6 * hovered.excite;
      ctx.beginPath(); ctx.arc(hovered.x, hovered.y, hovered.r + 7 + (1 - hovered.excite) * 10, 0, Math.PI * 2); ctx.stroke();
    }

    // кто где сейчас и что чувствует
    if (tb > THREADS_AT + 2.3) {
      ctx.globalAlpha = 0.5 * clamp01((tb - THREADS_AT - 2.3) / 1.5) * wa;
      ctx.fillStyle = CREAM;
      ctx.font = '300 11px "IBM Plex Mono", ui-monospace, monospace';
      for (const p of labels) ctx.fillText(p.label, p.x + 12, p.y - 10);
    }
    ctx.globalAlpha = 1;

    if (!doneFired && tb > DONE_AT) {
      doneFired = true;
      root.classList.add('is-done');
      root.dispatchEvent(new CustomEvent('intro:done', { bubbles: true }));
    }
  }

  function frame() {
    const t = now();
    const dt = Math.min(0.1, t - lastT);
    lastT = t;
    ctx.clearRect(0, 0, W, H);

    if (phase === 'idle') {
      drawCore(t, 0);
    } else if (phase === 'charging') {
      const u = clamp01((t - tStart) / CHARGE);
      drawInfall(u);
      drawRays(t, u);
      drawCore(t, u);
      if (u >= 1) boom(t);
    } else {
      drawWorld(t, dt);
    }
    requestAnimationFrame(frame);
  }

  // ---------- сценарий ----------
  function start() {
    if (phase !== 'idle') return;
    Sound.init(); Sound.resume();
    root.classList.add('is-started');
    if (reduceMotion) { Sound.startHum(0.1); settle(); return; }
    phase = 'charging';
    tStart = now();
    makeRays(); makeInfall();
    Sound.startHum(0.2);
    Sound.charge(CHARGE);
  }

  function boom(t) {
    phase = 'born';
    tBoom = t;
    spawn();
    root.classList.add('is-born');
    Sound.boom();
  }

  // сразу финальное состояние, без вспышки (для «пропустить» и reduced motion)
  function settle() {
    const t = now();
    if (phase !== 'born') spawn();
    phase = 'born';
    tBoom = t - 14;
    fadeStart = t;
    root.classList.add('is-started', 'is-born');
  }

  function skip() {
    if (phase === 'idle') {
      Sound.init(); Sound.resume(); Sound.startHum(0.1);
    } else if (phase === 'charging') {
      Sound.stopRiser(); Sound.toDrone();
    }
    settle();
  }

  // наведение: каждая точка — нота
  function probe(x, y) {
    if (phase !== 'born' || now() - tBoom < 2.5) return;
    let best = null, bd = 22;
    for (const p of nodes) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = p; }
    }
    root.style.cursor = best ? 'pointer' : '';
    if (best && best !== hovered) {
      const t = now();
      if (t - best.cool > 0.4 && t - lastTone > 0.06) {
        best.cool = t; lastTone = t; best.excite = 1;
        Sound.resume();
        Sound.tone(best.harm, (best.x / W) * 1.6 - 0.8,
          best.type === 'star' ? 0.09 : 0.06, undefined, best.type === 'star' ? 3.2 : 2.2);
      }
    }
    hovered = best;
  }

  // ---------- события ----------
  root.addEventListener('click', start);
  root.addEventListener('pointermove', (e) => probe(e.clientX, e.clientY));
  root.addEventListener('pointerdown', (e) => probe(e.clientX, e.clientY));
  window.addEventListener('keydown', (e) => {
    if (phase === 'idle' && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) {
      e.preventDefault(); start();
    }
  });

  btnSound.addEventListener('click', (e) => {
    e.stopPropagation();
    const on = !Sound.on;
    Sound.setEnabled(on);
    btnSound.textContent = on ? 'sound: on' : 'sound: off';
    btnSound.setAttribute('aria-pressed', String(on));
  });
  btnSkip.addEventListener('click', (e) => { e.stopPropagation(); skip(); });

  // сегодняшняя дата в центре — день мира, в который вы пришли
  const d = new Date();
  root.querySelector('[data-today]').textContent =
    `${String(d.getDate()).padStart(2, '0')} · ${String(d.getMonth() + 1).padStart(2, '0')} · ${d.getFullYear()}`;

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();

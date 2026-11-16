/* engine.js — موتور محتوای سرور (خالص و بدون DOM؛ داخل Worker اجرا می‌شود)
   ورودی: تعریف نمایش (show) و زمان محتوا t  ←  خروجی: «صحنه» (scene) و رویدادهای صوتی هر میزان.
   نمایش دو نوع است: script (متن نمایش با بازیگران) و life (شبیه‌ساز زندگی با نیازها، رشد گیاه و چرخهٔ شب و روز). */
(function () {
  'use strict';
  const BZ = window.BZ, clamp = BZ.clamp, lerp = BZ.lerp, smooth = BZ.smooth;
  const SPS = 4;        // گام شبیه‌سازی در هر ثانیهٔ واقعی
  const MPS = 0.5;      // دقیقهٔ زندگی در هر گام (۱ ثانیهٔ واقعی = ۲ دقیقهٔ زندگی)
  const CP = 400;       // فاصلهٔ نقطه‌های ذخیره برای جست‌وجوی تصادفی در زمان
  const LOC = { bed: 0.205, kitchen: 0.37, sofa: 0.50 };
  const GARDEN = [0.77, 0.85, 0.93, 0.81];

  const TXT = {
    eat: ['گرسنه‌ام!', 'بوی خوبی میاد.', 'وقت غذاست!'],
    eating: ['به‌به! چه خوشمزه است.', 'نوش جان!', 'دستپختش عالیه.'],
    sleep: ['شب بخیر…', 'خوابم میاد.', 'چشم‌هام سنگین شده.'],
    wake: ['صبح بخیر!', 'چه خواب خوبی بود.'],
    watch: ['ببینیم تلویزیون چی داره.', 'این برنامه جالبه!', 'یه کم تماشا کنیم.'],
    water: ['آب بخورید دوستان!', 'تشنه‌تون بود؟', 'گیاه‌ها منتظرند.'],
    dance: ['یه رقص کوچولو!', 'موسیقی بزن!'],
    talk: ['امروز هوا عالیه، نه؟', 'فکر می‌کنم گیاه‌ها بزرگ شدن.', 'دیشب خواب عجیبی دیدم.', 'تلویزیون امشب چی داره؟', 'من یه ایده دارم!', 'کاش کمی موسیقی بذاریم.'],
    reply: ['آره، موافقم.', 'جدی؟ جالبه!', 'حق با توئه.', 'هاها، خنده‌داره!', 'بذار فکر کنم…'],
    thirst: ['تشنه‌ام…', 'آب! لطفاً آب.', 'برگ‌هام دارن خشک می‌شن.'],
    thanks: ['آخیش! ممنون.', 'چه آبی! خیلی خوبه.'],
  };
  const pick = (a, R) => a[Math.floor(R() * a.length) % a.length];
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const FALLBACK = { id: '?', name: '؟', type: 'puppet', body: 'ball', voice: { pitch: 180, speed: 1 } };

  // ---------------- شبیه‌ساز زندگی ----------------
  function say(L, st, who, text) {
    const cid = who.k === 'a' ? st.agents[who.i].cid : st.plants[who.i].cid;
    const v = (L.eng.char(cid).voice || {}).speed || 1;
    const pl = BZ.speech.plan(text, v);
    st.utts.push({ at: st.step, end: st.step + Math.ceil(pl.dur * SPS) + 2, who, text, sp: v });
    if (st.utts.length > 40) st.utts.shift();
  }
  const speaking = (st, who) => st.utts.some((u) => u.who.k === who.k && u.who.i === who.i && st.step < u.end);
  const lowestPlant = (st) => st.plants.reduce((m, p) => (!m || p.water < m.water ? p : m), null);

  function moveTo(a, tx) {
    const v = 0.012, dx = tx - a.x;
    if (Math.abs(dx) <= v) { a.x = tx; return; }
    a.x += Math.sign(dx) * v; a.dir = Math.sign(dx); a.mv = true;
  }

  function startAct(L, st, a, i, act, R) {
    a.act = act; a.t0 = st.step; a.last = act; a.cnt[act] = (a.cnt[act] || 0) + 1;
    const me = { k: 'a', i };
    const sp = (arr, p) => { if (R() < (p == null ? 0.8 : p) && !speaking(st, me)) say(L, st, me, pick(arr, R)); };
    if (act === 'sleep') sp(TXT.sleep, 0.7);
    else if (act === 'eat') { a.eatSaid = false; sp(TXT.eat, 0.6); }
    else if (act === 'watch') sp(TXT.watch, 0.6);
    else if (act === 'water') sp(TXT.water, 0.8);
    else if (act === 'dance') { a.dur = 50; sp(TXT.dance, 0.9); }
    else if (act === 'idle') a.dur = 30 + Math.floor(R() * 60);
    else if (act === 'talk') {
      const o = st.agents[a.partner];
      if (!o || o.act === 'sleep' || Math.abs(o.x - a.x) > 0.2) { a.act = 'idle'; a.dur = 20; return; }
      a.init = true; a.dir = Math.sign(o.x - a.x) || 1;
      o.act = 'talk'; o.t0 = st.step; o.init = false; o.partner = i; o.dur = a.dur; o.dir = -a.dir; o.last = 'talk'; o.cnt.talk++;
    }
  }

  function isDone(a, st) {
    const n = a.n, el = st.step - a.t0, hour = st.hour;
    switch (a.act) {
      case 'sleep': return (n.energy > 0.97 && hour >= 6 && hour < 22) || el > 2400;
      case 'eat': return n.hunger > 0.95 || el > 120;
      case 'watch': return el > 120 && (n.fun > 0.85 || el > 400);
      case 'talk': return el >= a.dur;
      case 'dance': return el >= a.dur;
      case 'idle': return el >= a.dur;
      default: return true;
    }
  }

  function chooseNext(L, st, a, i, R) {
    const n = a.n, hour = st.hour, night = hour >= 22 || hour < 6.5;
    const others = st.agents.filter((o, j) => j !== i && o.act !== 'sleep');
    const meal = (hour >= 7.5 && hour < 9) || (hour >= 12.5 && hour < 14.5) || (hour >= 19 && hour < 21);
    const need = st.plants.reduce((m, p) => Math.max(m, 1 - p.water), 0);
    const sc = {
      sleep: Math.pow(1 - n.energy, 2) * 2.4 + (night ? 1.4 : 0) - (!night && n.energy > 0.4 ? 1.2 : 0),
      eat: Math.pow(1 - n.hunger, 2) * 2.6 + (meal && n.hunger < 0.95 ? 0.5 : 0) - (night ? 0.8 : 0),
      watch: Math.pow(1 - n.fun, 2) * 1.8 * (0.6 + a.tr.lazy),
      talk: others.length ? Math.pow(1 - n.social, 2) * 2.0 * (0.5 + a.tr.soc) : -9,
      water: st.plants.length && !night ? Math.pow(need, 2) * 3.6 * (0.6 + a.tr.green) : -9,
      dance: n.fun > 0.7 && n.energy > 0.6 && !night ? 0.25 * a.tr.soc : -9,
      idle: 0.05,
    };
    if (sc[a.last] != null) sc[a.last] -= 0.2;
    let best = 'idle', bv = -1e9;
    ['sleep', 'eat', 'watch', 'talk', 'water', 'dance', 'idle'].forEach((k) => { const v = sc[k] + R() * 0.2; if (v > bv) { bv = v; best = k; } });
    if (a.act === 'sleep' && best !== 'sleep' && R() < 0.8) { const me = { k: 'a', i }; if (!speaking(st, me)) say(L, st, me, pick(TXT.wake, R)); }
    let tx = null;
    if (best === 'sleep') tx = LOC.bed - 0.02 * (i % 3);
    else if (best === 'eat') tx = LOC.kitchen + 0.03 * i;
    else if (best === 'watch') tx = LOC.sofa + 0.028 * i;
    else if (best === 'water') { const p = lowestPlant(st); tx = p.x - 0.04; }
    else if (best === 'talk') {
      let o = null, bd = 9;
      st.agents.forEach((q, j) => { if (j !== i && q.act !== 'sleep' && Math.abs(q.x - a.x) < bd) { bd = Math.abs(q.x - a.x); o = j; } });
      a.partner = o; a.dur = 40 + Math.floor(R() * 50);
      const oo = st.agents[o]; tx = oo.x + (a.x < oo.x ? -0.06 : 0.06);
    }
    if (tx != null && Math.abs(a.x - tx) > 0.012) { a.act = 'walk'; a.tgt = tx; a.next = { act: best }; a.t0 = st.step; }
    else startAct(L, st, a, i, best, R);
  }

  function advance(L, st) {
    const s = L.show, step = ++st.step, m = MPS, h0 = (s.life && s.life.hour != null) ? s.life.hour : 7;
    const total = h0 * 60 + step * m;
    st.hour = (total / 60) % 24; st.day = Math.floor(total / 1440);
    const R = BZ.rng(BZ.hash((s.seed || 'x') + ':' + step));
    const hour = st.hour, light = hour >= 6 && hour < 18 ? Math.sin(Math.PI * (hour - 6) / 12) : 0;
    st.plants.forEach((p, pi) => {
      p.water = clamp(p.water - 0.0006 * m, 0, 1);
      p.wilt = p.water < 0.2 ? clamp(p.wilt + 0.001 * m, 0, 1) : clamp(p.wilt - 0.002 * m, 0, 1);
      if (p.water > 0.25) p.grow = clamp(p.grow + 0.0006 * m * light, 0, 1);
      if (p.water < 0.3 && step - p.said > 480 && R() < 0.03 && !speaking(st, { k: 'p', i: pi })) { say(L, st, { k: 'p', i: pi }, pick(TXT.thirst, R)); p.said = step; }
    });
    st.agents.forEach((a, i) => {
      const n = a.n, act = a.act;
      a.px = a.x; a.mv = false;
      n.energy = clamp(n.energy + (act === 'sleep' ? 0.0017 : -0.00085) * m, 0, 1);
      n.hunger = clamp(n.hunger + (act === 'eat' ? 0.015 : -0.0017) * m, 0, 1);
      n.fun = clamp(n.fun + (act === 'watch' ? 0.006 : act === 'talk' ? 0.003 : act === 'water' ? 0.002 : act === 'dance' ? 0.008 : -0.0008) * m, 0, 1);
      n.social = clamp(n.social + (act === 'talk' ? 0.006 : -0.001) * m, 0, 1);
      const me = { k: 'a', i };
      if (act === 'walk') {
        moveTo(a, a.tgt);
        if (a.x === a.tgt) startAct(L, st, a, i, a.next.act, R);
      } else if (act === 'water') {
        const p = lowestPlant(st), pi = p ? st.plants.indexOf(p) : -1;
        if (!p || p.water >= 0.85 || step - a.t0 > 240) chooseNext(L, st, a, i, R);
        else if (Math.abs(a.x - (p.x - 0.04)) > 0.012) moveTo(a, p.x - 0.04);
        else {
          a.dir = 1; const was = p.water; p.water = clamp(p.water + 0.03 * m, 0, 1);
          if (was < 0.85 && p.water >= 0.85 && !speaking(st, { k: 'p', i: pi })) say(L, st, { k: 'p', i: pi }, pick(TXT.thanks, R));
        }
      } else if (isDone(a, st)) chooseNext(L, st, a, i, R);
      else if (act === 'eat' && !a.eatSaid && step - a.t0 > 16) { a.eatSaid = true; if (!speaking(st, me)) say(L, st, me, pick(TXT.eating, R)); }
      else if (act === 'talk') {
        const e = step - a.t0;
        if (a.init && e % 24 === 2 && !speaking(st, me)) say(L, st, me, pick(TXT.talk, R));
        if (!a.init && e % 24 === 14 && !speaking(st, me)) say(L, st, me, pick(TXT.reply, R));
      }
    });
  }

  class Life {
    constructor(eng, show) { this.eng = eng; this.show = show; this.cp = [this.init()]; this.cur = {}; }
    init() {
      const s = this.show, L = s.life || {};
      const agents = (L.agents || []).slice(0, 4).map((cid, i) => {
        const R = BZ.rng(BZ.hash((s.seed || 'x') + cid));
        return { cid, x: 0.40 + 0.06 * i, px: 0.40 + 0.06 * i, dir: 1, act: 'idle', t0: 0, dur: 16 + i * 6, tgt: 0, next: null, partner: -1, init: false, mv: false, last: 'idle', eatSaid: false, n: { energy: 0.85, hunger: 0.65, fun: 0.55, social: 0.5 }, tr: { soc: 0.4 + R() * 0.6, lazy: 0.2 + R() * 0.8, green: 0.2 + R() * 0.8 }, cnt: { sleep: 0, eat: 0, watch: 0, talk: 0, water: 0, dance: 0, idle: 0 } };
      });
      const plants = (L.plants || []).slice(0, 4).map((cid, i) => ({ cid, x: GARDEN[i], water: 0.7 - 0.08 * i, grow: 0.25, wilt: 0, said: -999 }));
      return { step: 0, hour: L.hour == null ? 7 : L.hour, day: 0, agents, plants, utts: [] };
    }
    at(step, w) {
      let c = this.cur[w];
      if (!c || c.step > step) { const k = Math.min(Math.floor(step / CP), this.cp.length - 1); c = this.cur[w] = { step: k * CP, s: clone(this.cp[k]) }; }
      while (c.step < step) { advance(this, c.s); c.step++; if (c.step % CP === 0 && !this.cp[c.step / CP]) this.cp[c.step / CP] = clone(c.s); }
      return c.s;
    }
  }

  // ---------------- موتور ----------------
  class Engine {
    constructor(host) { this.host = host; this.lifes = new Map(); this.comp = new Map(); }
    char(cid) { return this.host.char(cid) || FALLBACK; }
    voiceSig(s) { return (s.cast || []).map((m) => JSON.stringify(this.char(m.cid).voice)).join(); }
    life(s) {
      const key = JSON.stringify([s.id, s.seed, s.epoch, s.life]);
      let L = this.lifes.get(key);
      if (!L) { if (this.lifes.size > 10) this.lifes.delete(this.lifes.keys().next().value); L = new Life(this, s); this.lifes.set(key, L); }
      return L;
    }
    // متن نمایش ← زمان‌بندی خطوط (قطعی)
    compile(s) {
      const key = JSON.stringify([s.cast, s.lines]) + this.voiceSig(s);
      const c = this.comp.get(s.id);
      if (c && c.key === key) return c;
      let t = 0.8; const lines = [];
      (s.lines || []).forEach((ln) => {
        const m = (s.cast || [])[ln.who]; if (!m || !ln.text || !String(ln.text).trim()) return;
        const ch = this.char(m.cid), pl = BZ.speech.plan(ln.text, (ch.voice && ch.voice.speed) || 1);
        lines.push({ who: ln.who, cid: m.cid, text: ln.text, emo: ln.emo || 'neutral', act: ln.act || '', start: t, end: t + pl.dur, syl: pl.syl, q: pl.q });
        t += pl.dur + 0.4;
      });
      const res = { key, lines, dur: Math.max(4, Math.ceil((t + 0.6) / 2) * 2) };
      this.comp.set(s.id, res);
      return res;
    }
    // ---- صحنه ----
    scene(s, t) { return s.kind === 'life' ? this.sceneLife(s, t) : this.sceneScript(s, t); }
    sceneScript(s, t) {
      const C = this.compile(s), dur = C.dur, tt = ((t % dur) + dur) % dur;
      const L = C.lines.find((l) => tt >= l.start && tt < l.end + 0.3);
      const n = (s.cast || []).length;
      const px = (m, i) => 0.12 + 0.76 * (m.x == null ? (i + 0.5) / Math.max(1, n) : m.x);
      const spkX = L ? px(s.cast[L.who], L.who) : 0.5;
      const mo = L ? BZ.speech.mouthAt(L.syl, tt - L.start) : { open: 0, v: 'e' };
      const actors = (s.cast || []).map((m, i) => {
        const x = px(m, i), isS = L && L.who === i;
        return { cid: m.cid, x, z: m.z == null ? 0.1 : m.z, dir: isS ? (x < 0.5 ? 1 : -1) : (spkX >= x ? 1 : -1), emo: isS ? L.emo : (L && L.emo === 'happy' ? 'happy' : 'neutral'), open: isS ? mo.open : 0, vis: isS ? mo.v : 'e', act: isS ? L.act : '', gest: isS && mo.open > 0.05 ? 0.6 : 0, look: L ? clamp((spkX - x) * 2, -1, 1) : 0 };
      });
      let cam = { z: 1, x: 0.5, y: 0.5 };
      if (s.camera === 'auto' && L) {
        const k = smooth(clamp((tt - L.start) / 0.4, 0, 1)) * smooth(clamp((L.end + 0.3 - tt) / 0.3, 0, 1));
        const sz = (this.char(L.cid).size || 1);
        cam = { z: 1 + 0.9 * k, x: lerp(0.5, spkX, k), y: lerp(0.5, 0.84 - 0.3 * sz, k) };
      }
      return { k: 's', t: tt, set: s.set || 'living', props: s.props || [], cam, actors, sub: L ? { who: this.char(L.cid).name, text: L.text } : null, title: tt < 4 ? (s.title || '') : '', hud: null };
    }
    sceneLife(s, t) {
      const L = this.life(s), simT = Math.max(0, t - (s.epoch || 0)), step = Math.floor(simT * SPS), frac = simT * SPS - step;
      const st = L.at(step, 'v');
      const talkOf = (who) => {
        const u = [...st.utts].reverse().find((q) => q.who.k === who.k && q.who.i === who.i && simT >= q.at / SPS);
        if (!u) return null;
        const pl = BZ.speech.plan(u.text, u.sp || 1), tl = simT - u.at / SPS;
        return tl < pl.dur + 0.3 ? { u, m: BZ.speech.mouthAt(pl.syl, tl) } : null;
      };
      const actors = [];
      let sub = null, subAt = -1;
      st.agents.forEach((a, i) => {
        const tk = talkOf({ k: 'a', i }), n = a.n;
        const emo = (n.hunger < 0.3 || n.energy < 0.25 || n.fun < 0.2) ? 'sad' : (Math.min(n.energy, n.hunger, n.fun, n.social) > 0.6 ? 'happy' : (a.act === 'talk' && n.social > 0.5 ? 'happy' : 'neutral'));
        const x = lerp(a.px, a.x, frac);
        actors.push({ cid: a.cid, k: 'a', x, dir: a.dir, emo: a.act === 'sleep' ? 'neutral' : emo, open: tk ? tk.m.open : 0, vis: tk ? tk.m.v : 'e', act: a.act === 'walk' || a.mv ? 'walk' : a.act, ph: x * 60, gest: tk && tk.m.open > 0.05 ? 0.6 : 0, idx: i });
        if (tk && tk.u.at > subAt) { subAt = tk.u.at; sub = { who: this.char(a.cid).name, text: tk.u.text }; }
      });
      st.plants.forEach((p, i) => {
        const tk = talkOf({ k: 'p', i });
        actors.push({ cid: p.cid, k: 'p', x: p.x, dir: 1, emo: p.wilt > 0.5 || p.water < 0.3 ? 'sad' : (p.grow > 0.9 ? 'happy' : 'neutral'), open: tk ? tk.m.open : 0, vis: tk ? tk.m.v : 'e', act: '', grow: p.grow, wilt: p.wilt, water: p.water, idx: i });
        if (tk && tk.u.at > subAt) { subAt = tk.u.at; sub = { who: this.char(p.cid).name, text: tk.u.text }; }
      });
      const h = (st.hour + frac * MPS / 60) % 24;
      return { k: 'l', t: simT, set: 'house', cam: { z: 1, x: 0.5, y: 0.5 }, actors, sub, title: simT < 5 ? (s.title || '') : '', hud: { hour: h, day: st.day } };
    }
    // ---- صدا: رویدادهای یک میزان (۲ ثانیه، ۱۲۰ bpm) ----
    speechEv(cid, syl, k, n, q, emo, at0, w0) {
      const ch = this.char(cid), v = ch.voice || {}, base = v.pitch || 180;
      const em = { happy: 1.08, sad: 0.92, angry: 1.0, surprised: 1.15, thinking: 0.97, neutral: 1 }[emo] || 1;
      const gm = { happy: 1, sad: 0.8, angry: 1.15, surprised: 1.1, thinking: 0.9, neutral: 1 }[emo] || 1;
      const pr = n > 1 ? k / (n - 1) : 0;
      let f0 = base * em * (1 - 0.1 * pr) * (1 + 0.04 * Math.sin(k * 1.7));
      if (q && pr > 0.7) f0 *= 1 + (pr - 0.7) * 1.5;
      const V = BZ.speech.VOW[syl.v] || BZ.speech.VOW.e;
      return { b: (at0 - w0) / 0.5, d: syl.d / 0.5, talk: 1, f0, fe: q && pr > 0.8 ? 1.08 : 0.9, f1: V.f1 * (ch.type === 'plant' ? 0.92 : 1), f2: V.f2, g: (k === 0 ? 0.85 : 0.72) * gm, cons: syl.c };
    }
    bar(s, idx) {
      const w0 = idx * 2, evs = [];
      if (s.kind === 'life') {
        const L = this.life(s), ep = s.epoch || 0;
        const a0 = Math.ceil((w0 - ep) * SPS - 1e-9), a1 = Math.ceil((w0 + 2 - ep) * SPS - 1e-9);
        if (a1 > 0) {
          const st = L.at(Math.max(0, a1), 'a');
          st.utts.forEach((u) => {
            if (u.at < a0 || u.at >= a1) return;
            const cid = u.who.k === 'a' ? st.agents[u.who.i].cid : st.plants[u.who.i].cid;
            const pl = BZ.speech.plan(u.text, u.sp || 1), at = ep + u.at / SPS;
            pl.syl.forEach((sy, k) => evs.push(this.speechEv(cid, sy, k, pl.syl.length, pl.q, 'neutral', at + sy.t, w0)));
          });
        }
      } else {
        const C = this.compile(s), W0 = w0 % C.dur;
        C.lines.forEach((ln) => {
          ln.syl.forEach((sy, k) => {
            const ta = ln.start + sy.t;
            if (ta >= W0 && ta < W0 + 2) evs.push(this.speechEv(ln.cid, sy, k, ln.syl.length, ln.q, ln.emo, ta, W0));
          });
        });
      }
      const m = s.music;
      if (m && m.style && m.style !== 'talk' && m.style !== 'tone') {
        const bed = { audio: { style: m.style, bpm: 120, root: m.root || 48, scale: m.scale || 'major', seed: (s.id || 'x') + 'bed', density: 0.4 } };
        const vol = m.vol == null ? 0.25 : m.vol;
        BZ.music.bar(bed, idx).forEach((e) => evs.push(Object.assign({}, e, { g: (e.g || 0.3) * vol })));
      }
      return evs;
    }
    // وضعیت درونی برای پنل نمایش زندگی
    inspect(s, t) {
      if (s.kind !== 'life') return null;
      const L = this.life(s), step = Math.max(0, Math.floor((t - (s.epoch || 0)) * SPS)), st = L.at(step, 'i');
      return { hour: st.hour, day: st.day, agents: st.agents.map((a) => ({ cid: a.cid, act: a.act, n: a.n, cnt: a.cnt })), plants: st.plants.map((p) => ({ cid: p.cid, water: p.water, grow: p.grow, wilt: p.wilt })) };
    }
  }

  BZ.Engine = Engine;
  BZ.engineConst = { SPS, MPS };
})();

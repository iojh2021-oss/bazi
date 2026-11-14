/* vcr.js — ویدئوی نواری (VCR): مدل نوار، ضبط/پخش، ضبط زمان‌بندی‌شده، ردیابی (tracking)، خروجی AV به تلویزیون */
(function () {
  'use strict';
  const BZ = window.BZ;
  const h = BZ.h;

  // ---------- مدل نوار (منطق خالص؛ بدون وابستگی به DOM) ----------
  const Tapes = (BZ.Tapes = {
    create(name, lenSec, speed) { return { id: BZ.uid('t'), name, len: lenSec, speed: speed || 1, pos: 0, segs: [], wear: 0, opt: 0.5, protect: false }; },
    cap(t) { return t.len * t.speed; },
    segAt(t, p) { return t.segs.find((s) => p >= s.s && p < s.s + s.d) || null; },
    used(t) { return t.segs.reduce((a, s) => a + s.d, 0); },
    erase(t, a, b) {
      const out = [];
      for (const s of t.segs) {
        const e = s.s + s.d;
        if (b <= s.s || a >= e) { out.push(s); continue; }
        if (a > s.s) out.push(Object.assign({}, s, { d: a - s.s, qs: s.q * (a - s.s) }));
        if (b < e) out.push(Object.assign({}, s, { s: b, d: e - b, pt0: s.pt0 + (b - s.s), qs: s.q * (e - b) }));
      }
      t.segs = out.sort((x, y) => x.s - y.s);
    },
    // نوشتن dt ثانیه از موقعیت pos؛ info: {sid, ch, prog, pt0, q}
    write(t, pos, dt, info) {
      Tapes.erase(t, pos, pos + dt);
      const prev = t.segs.find((s) => s.sid === info.sid && Math.abs(s.s + s.d - pos) < 1e-6);
      if (prev) { prev.d += dt; prev.qs += info.q * dt; prev.q = prev.qs / prev.d; }
      else t.segs.push({ s: pos, d: dt, ch: info.ch, prog: info.prog, pt0: info.pt0, q: info.q, qs: info.q * dt, sid: info.sid });
      t.segs.sort((x, y) => x.s - y.s);
    },
    defaults() {
      const mk = (name, prog, d, opt, speed) => { const t = Tapes.create(name, d, speed || 1); t.protect = true; t.opt = opt; t.segs.push({ s: 0, d, ch: null, prog, pt0: 0, q: 0.93, qs: 0.93 * d, sid: 'pre' }); return t; };
      const blank = (name, len) => { const t = Tapes.create(name, len, 1); return t; };
      return [mk('فیلم «شب‌های مهتاب»', 'film1', 5400, 0.62), mk('مستند طبیعت', 'nature1', 3600, 0.4), mk('کارتون‌های شنبه', 'kids1', 1800, 0.55), mk('کنسرت سنتی', 'persian1', 2400, 0.47), blank('نوار خام ۱ (۱۲۰ دقیقه)', 7200), blank('نوار خام ۲ (۶۰ دقیقه)', 3600)];
    },
  });

  BZ.VCR = class VCR {
    constructor() {
      this.on = false; this.mode = 'stop'; this.tape = null; this.ch = 2; this.tracking = 0.5; this.speed = 1;
      this.timers = BZ.store.get('vcr.timers', []); this.demand = new Set(); this.pl = null; this.g = null; this.sid = null;
      this.tapes = BZ.store.get('vcr.tapes', null) || Tapes.defaults();
      const cur = BZ.store.get('vcr.cur', null); if (cur) this.tape = this.tapes.find((t) => t.id === cur) || null;
      this.timerRec = null; this.msg = '';
    }
    save() { BZ.store.set('vcr.tapes', this.tapes); BZ.store.set('vcr.timers', this.timers); BZ.store.set('vcr.cur', this.tape ? this.tape.id : null); }
    ensure() {
      if (this.g || !BZ.audio.ctx) return !!this.g;
      const ctx = BZ.audio.ctx, A = BZ.audio, g = (this.g = {});
      g.in = ctx.createGain(); g.nz = ctx.createGain(); g.nz.gain.value = 0;
      const wn = A.noiseLoop('pink'); wn.connect(g.nz);
      g.lp = ctx.createBiquadFilter(); g.lp.type = 'lowpass'; g.lp.frequency.value = 9000;
      g.in.connect(g.lp); g.nz.connect(g.lp);
      this.out = ctx.createGain(); g.lp.connect(this.out);
      return true;
    }
    power(on) {
      this.on = on; if (on) this.ensure(); else { this.mode = 'stop'; this.dropPlayer(); }
      BZ.bus.emit('power', { id: 'vcr', on });
    }
    setDemand(k, on) { if (on) this.demand.add(k); else this.demand.delete(k); }
    insert(id) {
      if (this.tape) this.eject();
      const t = this.tapes.find((x) => x.id === id); if (!t) return;
      this.tape = t; this.mode = 'stop'; this.msg = 'نوار گذاشته شد'; this.save();
    }
    eject() { if (!this.tape) return; this.mode = 'stop'; this.dropPlayer(); this.tape = null; this.msg = 'نوار بیرون آمد'; this.save(); }
    newTape() {
      const n = this.tapes.filter((t) => !t.protect).length + 1;
      const t = Tapes.create('نوار خام ' + (n + 2) + ' (۶۰ دقیقه)', 3600, 1); this.tapes.push(t); this.save(); return t;
    }
    setSpeed(s) { if (this.tape && Tapes.used(this.tape) > 0) { BZ.toast('سرعت فقط روی نوار خالی قابل تغییر است'); return false; } this.speed = s; if (this.tape) this.tape.speed = s; this.save(); return true; }
    press(m) {
      if (!this.on) return;
      const t = this.tape;
      if (m === 'eject') { this.eject(); return; }
      if (!t) { this.msg = 'نواری نیست'; BZ.toast('نواری در دستگاه نیست'); return; }
      if (m === 'rec') {
        if (t.protect) { this.msg = 'نوار قفل است'; BZ.toast('این نوار پرشده و قفل ضبط دارد؛ نوار خام بگذارید'); return; }
        if (t.pos >= Tapes.cap(t) - 1) { this.msg = 'انتهای نوار'; return; }
        this.sid = BZ.uid('r'); this.mode = 'rec'; this.msg = 'ضبط'; return;
      }
      if (m === 'pause' && (this.mode === 'pause')) { this.mode = 'play'; return; }
      if (m === 'play' && t.pos >= Tapes.cap(t) - 1) { this.msg = 'انتهای نوار'; return; }
      this.mode = m; if (m === 'stop') { this.timerRec = null; this.save(); }
    }
    tod() { return ((BZ.world.time % 86400) + 86400) % 86400; }
    addTimer(ch, startSec, durMin) { this.timers.push({ id: BZ.uid('m'), ch, start: startSec, dur: durMin * 60, day: -1 }); this.save(); }
    removeTimer(id) { this.timers = this.timers.filter((x) => x.id !== id); this.save(); }
    quality() { // کیفیت سیگنال ورودی تیونر ویدئو
      const c = BZ.world.channelByNumber(this.ch);
      return c ? BZ.rf.strength(c, BZ.world.env, BZ.world.isNight()) : 0;
    }
    // یک گام زمانی (ثانیهٔ واقعی)
    tick(dt) {
      if (!this.on) return;
      const W = BZ.world, tod = this.tod(), day = Math.floor(W.time / 86400);
      // ضبط زمان‌بندی‌شده
      if (this.tape && !this.tape.protect && this.mode !== 'rec') {
        for (const tm of this.timers) {
          const inWin = tod >= tm.start && tod < tm.start + tm.dur;
          if (inWin && tm.day !== day) { tm.day = day; this.ch = tm.ch; this.sid = BZ.uid('r'); this.mode = 'rec'; this.timerRec = { id: tm.id, end: tm.start + tm.dur }; this.msg = 'ضبط زمان‌بندی'; BZ.toast('ضبط زمان‌بندی‌شده شروع شد'); break; }
        }
      }
      if (this.timerRec && tod >= this.timerRec.end && this.mode === 'rec') { this.mode = 'stop'; this.timerRec = null; this.save(); }
      const t = this.tape; if (!t) return;
      const cap = Tapes.cap(t);
      if (this.mode === 'play') { t.pos += dt; if (t.pos >= cap) { t.pos = cap; this.mode = 'stop'; } }
      else if (this.mode === 'ff') { t.pos = Math.min(cap, t.pos + dt * 14); if (t.pos >= cap) this.mode = 'stop'; }
      else if (this.mode === 'rew') { t.pos = Math.max(0, t.pos - dt * 14); if (t.pos <= 0) this.mode = 'stop'; }
      else if (this.mode === 'rec') {
        const c = W.channelByNumber(this.ch), dtT = dt * W.speed, q = this.quality();
        if (t.pos + dtT >= cap) { this.mode = 'stop'; this.save(); return; }
        Tapes.write(t, t.pos, dtT, { sid: this.sid, ch: this.ch, prog: c ? c.program : 'test1', pt0: W.time - dtT, q: c ? q : 0.02 });
        t.pos += dtT; t.wear = Math.min(1, t.wear + dt * 0.00002);
      }
      if (this.mode === 'play' || this.mode === 'pause') t.wear = Math.min(1, t.wear + dt * 0.00001);
    }
    trackErr() { return this.tape ? Math.abs(this.tracking - this.tape.opt) : 0; }
    // ویدیوی خروجی (برای ورودی AV تلویزیون)
    getVideo() {
      if (!this.on) return null;
      const t = this.tape;
      if (!t) return { live: true, ch: this.ch };
      if (this.mode === 'stop' || this.mode === 'rec') return { live: true, ch: this.ch };
      const seg = Tapes.segAt(t, t.pos);
      if (!seg) return { blank: true };
      const search = this.mode === 'ff' || this.mode === 'rew';
      const track = search ? 0.85 : BZ.clamp((this.trackErr() - 0.06) * 4, 0, 1);
      const q = seg.q * (t.speed === 2 ? 0.82 : 1) * (1 - 0.5 * track) * (1 - t.wear * 0.3);
      return { prog: seg.prog, t: seg.pt0 + (t.pos - seg.s), q, vhs: { track, wear: t.wear, lp: t.speed === 2, search } };
    }
    outputQuality() {
      const v = this.getVideo();
      if (!v) return 0;
      if (v.live) return this.quality();
      if (v.blank) return 0.05;
      return v.q;
    }
    statusText() {
      if (!this.on) return 'ویدئو خاموش است';
      const M = { stop: 'توقف', play: 'پخش', rec: 'ضبط', ff: 'جلو', rew: 'عقب', pause: 'مکث' };
      return (this.tape ? this.tape.name : 'بدون نوار') + ' • ' + M[this.mode];
    }
    dropPlayer() { if (this.pl) { this.pl.player.stop(); try { this.pl.g.disconnect(); } catch (e) { /* ignore */ } this.pl = null; } }
    // به‌روزرسانی صوتی (فقط وقتی مصرف‌کننده‌ای هست)
    update() {
      if (!this.g) return;
      const ctx = BZ.audio.ctx, T = ctx.currentTime, W = BZ.world;
      const v = this.on && this.demand.size ? this.getVideo() : null;
      let want = null, q = 0, lp = 9000;
      if (v && !v.blank && !(v.vhs && v.vhs.search)) {
        if (v.live) { const c = W.channelByNumber(this.ch); if (c && v.q === undefined) { q = this.quality(); if (q > 0.1) want = { key: 'live' + c.id, prog: c.program, t: W.time }; } }
        else { want = { key: 'tape' + this.tape.id + ':' + Math.floor(this.tape.pos - (v.t - 0)), prog: v.prog, t: v.t }; q = v.q; if (v.vhs && v.vhs.lp) lp = 4800; else lp = 7000; }
      }
      if (!want) this.dropPlayer();
      else if (!this.pl || this.pl.key !== want.key || Math.abs(this.pl.player.contentNow() - want.t) > 0.8) {
        this.dropPlayer();
        const gn = ctx.createGain(); gn.connect(this.g.in);
        this.pl = { key: want.key, g: gn, player: new BZ.ProgramPlayer(ctx, W.program(want.prog), gn, { t0: want.t }) };
      }
      this.g.nz.gain.setTargetAtTime(want ? Math.pow(1 - Math.min(1, q), 2) * 0.25 + (v && v.vhs ? v.vhs.track * 0.15 : 0) : 0, T, 0.08);
      this.g.lp.frequency.setTargetAtTime(lp, T, 0.1);
    }
  };

  BZ.vcrPanel = function (vcr) {
    const disp = h('div', { class: 'v-disp', dir: 'ltr' });
    const reels = BZ.cv(300, 110, 'v-reels'), rg = reels.getContext('2d');
    const map = BZ.cv(560, 44, 'v-map'), mg = map.getContext('2d');
    const info = h('div', { class: 'v-info' });
    let angle = 0;
    const pw = BZ.toggle('⏻', vcr.on, (v) => { if (v) BZ.audio.init(); vcr.power(v); }, 'pw');
    const tapeSel = h('select', { class: 'sel' });
    const fillSel = () => { tapeSel.innerHTML = ''; vcr.tapes.forEach((t) => tapeSel.append(h('option', { value: t.id }, (t.protect ? '🔒 ' : '') + t.name))); if (vcr.tape) tapeSel.value = vcr.tape.id; };
    fillSel();
    const btns = [['⏏', 'eject', 'sm'], ['⏪', 'rew', 'sm'], ['▶', 'play', 'sm go'], ['⏺', 'rec', 'sm rec'], ['⏸', 'pause', 'sm'], ['⏩', 'ff', 'sm'], ['■', 'stop', 'sm']];
    const tr = h('div', { class: 'v-trans' }, btns.map(([t, m, c]) => BZ.btn(t, () => vcr.press(m), c)));
    const trackK = BZ.knob({ label: 'ردیابی Tracking', value: vcr.tracking, fmt: (v) => (vcr.tape && Math.abs(v - vcr.tape.opt) < 0.05 ? 'بهینه' : v.toFixed(2)), onInput: (v) => { vcr.tracking = v; } });
    const chSel = BZ.select(BZ.world.channels.map((c) => ({ v: String(c.number), t: c.number + ' — ' + c.name })), String(vcr.ch), (v) => { vcr.ch = +v; });
    const speedSeg = BZ.seg([{ v: 1, t: 'SP' }, { v: 2, t: 'LP (دو برابر ظرفیت)' }], vcr.speed, (v) => { if (!vcr.setSpeed(v)) speedSeg.set(vcr.speed); });
    const tapeRow = h('div', { class: 'r-ctrl' }, tapeSel, BZ.btn('گذاشتن نوار', () => { vcr.insert(tapeSel.value); }), BZ.btn('+ نوار خام', () => { const t = vcr.newTape(); fillSel(); tapeSel.value = t.id; BZ.toast('نوار خام اضافه شد'); }));
    // زمان‌بند
    const tIn = h('input', { type: 'time', class: 'inp', value: '20:00' }), dIn = h('input', { type: 'number', class: 'inp', min: 1, max: 240, value: 10, style: { width: '70px' } });
    const timerSel = BZ.select(BZ.world.channels.map((c) => ({ v: String(c.number), t: c.number + ' — ' + c.name })), String(BZ.world.channels[0].number), () => {});
    const tlist = h('div', { class: 'tlist' });
    function paintTimers() {
      tlist.innerHTML = '';
      vcr.timers.forEach((tm) => tlist.append(h('div', { class: 'trow' }, 'کانال ' + tm.ch + ' • ' + BZ.clockHM(tm.start) + ' • ' + Math.round(tm.dur / 60) + ' دقیقه ', BZ.btn('حذف', () => { vcr.removeTimer(tm.id); paintTimers(); }, 'sm'))));
      if (!vcr.timers.length) tlist.append(h('div', { class: 'note' }, 'هیچ ضبط زمان‌بندی‌شده‌ای نیست.'));
    }
    paintTimers();
    const addT = BZ.btn('افزودن به زمان‌بند', () => {
      const [hh, mm] = (tIn.value || '20:00').split(':').map(Number);
      vcr.addTimer(+timerSel.value, hh * 3600 + mm * 60, Math.max(1, +dIn.value || 10)); paintTimers(); BZ.toast('زمان‌بندی ثبت شد (نوار خام را بگذارید و ویدئو را روشن بگذارید)');
    });
    const root = h('div', { class: 'vcr-body' },
      h('div', { class: 'v-front' }, h('div', { class: 'v-left' }, disp, info), reels),
      tr, tapeRow, map,
      h('div', { class: 'r-knobs' }, trackK, h('div', { class: 'knobbox' }, h('div', { class: 'knob-label' }, 'تیونر ویدئو'), chSel), h('div', { class: 'knobbox' }, h('div', { class: 'knob-label' }, 'سرعت نوار'), speedSeg), pw),
      h('div', { class: 'sub' }, h('h4', null, 'ضبط زمان‌بندی‌شده (ساعت جهان)'), h('div', { class: 'r-ctrl' }, timerSel, tIn, h('span', { class: 'lbl' }, 'مدت (دقیقه)'), dIn, addT), tlist));
    map.addEventListener('click', (e) => {
      if (!vcr.tape || vcr.mode === 'play' || vcr.mode === 'rec') return;
      const r = map.getBoundingClientRect(); vcr.tape.pos = BZ.clamp((e.clientX - r.left) / r.width, 0, 1) * Tapes.cap(vcr.tape) * 0.999;
    });
    function reel(x, y, r0, rot) {
      rg.save(); rg.translate(x, y); rg.rotate(rot); rg.fillStyle = '#2a2a2e'; rg.beginPath(); rg.arc(0, 0, r0, 0, 7); rg.fill();
      rg.fillStyle = '#d8d8d8'; rg.beginPath(); rg.arc(0, 0, 18, 0, 7); rg.fill(); rg.fillStyle = '#222';
      for (let i = 0; i < 6; i++) { rg.rotate(Math.PI / 3); rg.fillRect(8, -3, 10, 6); }
      rg.restore();
    }
    root.paint = function (now) {
      const t = vcr.tape, cap = t ? Tapes.cap(t) : 1, frac = t ? t.pos / cap : 0;
      const spin = !vcr.on ? 0 : vcr.mode === 'play' || vcr.mode === 'rec' ? 0.06 : vcr.mode === 'ff' ? 0.5 : vcr.mode === 'rew' ? -0.5 : 0;
      angle += spin;
      rg.fillStyle = '#17171a'; rg.fillRect(0, 0, reels.width, reels.height);
      if (t) { reel(80, 55, 22 + 30 * (1 - frac), -angle); reel(220, 55, 22 + 30 * frac, -angle); rg.strokeStyle = '#3a2a1a'; rg.lineWidth = 3; rg.beginPath(); rg.moveTo(80, 55 + 22 + 30 * (1 - frac)); rg.lineTo(150, 100); rg.lineTo(220, 55 + 22 + 30 * frac); rg.stroke(); }
      else { rg.fillStyle = '#555'; rg.font = '14px ' + BZ.FONT; rg.textAlign = 'center'; rg.fillText('جای نوار خالی است', 150, 58); }
      const blink = vcr.mode === 'rec' && Math.floor(now / 500) % 2 === 0;
      const M = { stop: '■ STOP', play: '▶ PLAY', rec: (blink ? '●' : '○') + ' REC', ff: '⏩ FF', rew: '⏪ REW', pause: '⏸ PAUSE' };
      disp.textContent = vcr.on ? (t ? BZ.fmtTime(t.pos) : '--:--:--') + '  ' + M[vcr.mode] + '  ' + BZ.clockHM(BZ.world.time) : 'OFF';
      info.textContent = !vcr.on ? 'خاموش' : (t ? t.name + ' • ' + (t.speed === 2 ? 'LP' : 'SP') + (t.protect ? ' • قفل ضبط' : '') + ' • فرسودگی ' + Math.round(t.wear * 100) + '%' : 'بدون نوار') + (vcr.msg ? ' — ' + vcr.msg : '');
      // نقشهٔ نوار
      mg.fillStyle = '#101216'; mg.fillRect(0, 0, map.width, map.height);
      if (t) {
        t.segs.forEach((s) => { mg.fillStyle = s.ch == null ? '#3d6bb0' : '#b04040'; mg.globalAlpha = 0.4 + 0.6 * s.q; mg.fillRect((s.s / cap) * map.width, 8, Math.max(1, (s.d / cap) * map.width), 22); });
        mg.globalAlpha = 1; mg.fillStyle = '#ffd23f'; mg.fillRect(frac * map.width - 1, 2, 3, 36);
        mg.fillStyle = '#9aa'; mg.font = '10px sans-serif'; mg.textAlign = 'left'; mg.fillText('0', 2, 42); mg.textAlign = 'right'; mg.fillText(BZ.fmtTime(cap), map.width - 2, 42);
      }
      pw.set(vcr.on);
    };
    root.refresh = fillSel;
    return root;
  };
})();

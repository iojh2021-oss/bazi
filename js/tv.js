/* tv.js — تلویزیون لامپی (CRT): تیونر، برف، ارواح، هماهنگی افقی/عمودی، ورودی AV از ویدئو */
(function () {
  'use strict';
  const BZ = window.BZ;
  const h = BZ.h;

  BZ.TV = class TV {
    constructor() {
      const s = BZ.store.get('tv', {});
      this.on = false; this.channel = s.channel || 2; this.input = 'TV';
      this.vol = s.vol != null ? s.vol : 0.5; this.bright = s.bright != null ? s.bright : 0.5; this.contrast = s.contrast != null ? s.contrast : 0.5;
      this.color = s.color != null ? s.color : 0.5; this.tint = s.tint != null ? s.tint : 0.5;
      this.vhold = 0.5; this.hhold = 0.5; this.fine = 0; this.muted = false; this.external = false;
      this.roll = 0; this.osd = { text: '', until: 0 }; this.onAt = 0; this.offAt = 0; this.pl = null; this.g = null;
      this.sig = 0; this.keyBuf = ''; this.keyTimer = null; this.std = null; this.buf = null; this.buf2 = null;
    }
    save() { BZ.store.set('tv', { channel: this.channel, vol: this.vol, bright: this.bright, contrast: this.contrast, color: this.color, tint: this.tint }); }
    flash(text, ms) { this.osd = { text, until: performance.now() + (ms || 2200) }; }
    ensure() {
      if (this.g || !BZ.audio.ctx) return !!this.g;
      const ctx = BZ.audio.ctx, A = BZ.audio, g = (this.g = {});
      g.mix = ctx.createGain(); g.tun = ctx.createGain(); g.av = ctx.createGain(); g.nz = ctx.createGain(); g.nz.gain.value = 0;
      g.tun.connect(g.mix); g.av.connect(g.mix);
      const wn = A.noiseLoop('white'), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500; wn.connect(hp); hp.connect(g.nz); g.nz.connect(g.mix);
      g.buzz = ctx.createOscillator(); g.buzz.type = 'sawtooth'; g.buzz.frequency.value = 15625; g.bz = ctx.createGain(); g.bz.gain.value = 0; g.buzz.connect(g.bz); g.bz.connect(g.mix); g.buzz.start();
      g.lp = ctx.createBiquadFilter(); g.lp.type = 'lowpass'; g.lp.frequency.value = 9000;
      g.vol = ctx.createGain(); g.vol.gain.value = 0;
      g.mix.connect(g.lp); g.lp.connect(g.vol);
      this.out = ctx.createGain(); g.vol.connect(this.out);
      this.spk = A.speaker(); this.out.connect(this.spk);
      return true;
    }
    power(on) {
      this.on = on; const now = performance.now();
      if (on) { this.ensure(); this.onAt = now; this.flash('CH ' + this.channel); } else { this.offAt = now; this.dropPlayer(); }
      if (this.g && !on) this.g.vol.gain.setTargetAtTime(0, BZ.audio.ctx.currentTime, 0.02);
      BZ.bus.emit('power', { id: 'tv', on });
    }
    setChannel(n) {
      n = BZ.clamp(Math.round(n), 1, 69); this.channel = n; this.dropPlayer(); this.flash('CH ' + n); this.save(); this.roll = 0.5;
    }
    setInput(i) { this.input = i; this.flash(i === 'AV' ? 'AV' : 'CH ' + this.channel); if (BZ.vcr) BZ.vcr.setDemand('tv', this.on && i === 'AV'); }
    scan(dir) {
      const env = BZ.world.env, night = BZ.world.isNight();
      const cs = BZ.world.channels.filter((c) => BZ.rf.strength(c, env, night) > 0.15).sort((a, b) => a.number - b.number);
      if (!cs.length) return;
      const nx = dir > 0 ? cs.find((c) => c.number > this.channel) || cs[0] : [...cs].reverse().find((c) => c.number < this.channel) || cs[cs.length - 1];
      this.setChannel(nx.number);
    }
    digit(d) {
      this.keyBuf = (this.keyBuf + d).slice(-2); this.flash('CH ' + this.keyBuf + '_', 1500);
      clearTimeout(this.keyTimer); this.keyTimer = setTimeout(() => { const n = parseInt(this.keyBuf, 10); this.keyBuf = ''; if (n) this.setChannel(n); }, 1100);
    }
    dropPlayer() { if (this.pl) { this.pl.player.stop(); try { this.pl.g.disconnect(); } catch (e) { /* ignore */ } this.pl = null; } }
    // وضعیت تیونر: کانال و قدرت سیگنال
    tuner() {
      const src = BZ.world.channelByNumber(this.channel);
      const sig = src ? BZ.rf.strength(src, BZ.world.env, BZ.world.isNight()) * (1 - Math.min(1, Math.abs(this.fine) * 0.6)) : 0;
      return { src, sig };
    }
    update() {
      if (!this.on || !this.g) return;
      const ctx = BZ.audio.ctx, T = ctx.currentTime, tu = this.tuner();
      const av = this.input === 'AV', vcr = BZ.vcr;
      this.sig = av ? (vcr ? vcr.outputQuality() : 0) : tu.sig;
      if (!av && tu.src && tu.sig > 0.1) {
        if (!this.pl || this.pl.key !== tu.src.id) {
          this.dropPlayer();
          const gn = ctx.createGain(); gn.gain.value = 1; gn.connect(this.g.tun);
          this.pl = { key: tu.src.id, g: gn, player: BZ.makePlayer(ctx, BZ.world.program(tu.src.program), gn, { t0: BZ.world.time, quality: () => this.tuner().sig, tag: 'tv' }) };
        }
      } else this.dropPlayer();
      this.g.tun.gain.setTargetAtTime(!av ? Math.min(1, tu.sig * 2) : 0, T, 0.06);
      this.g.av.gain.setTargetAtTime(av ? 1 : 0, T, 0.06);
      const lack = av ? 1 - Math.min(1, this.sig * 1.2) : 1 - Math.min(1, tu.sig * 1.25);
      this.g.nz.gain.setTargetAtTime(Math.pow(lack, 1.5) * 0.35 * (av && vcr && vcr.mode === 'stop' ? 0 : 1), T, 0.06);
      this.g.bz.gain.setTargetAtTime(this.on ? 0.0025 : 0, T, 0.1);
      const spkOn = !this.external;
      this.spk.gain.setTargetAtTime(spkOn ? 1 : 0, T, 0.03);
      this.g.vol.gain.setTargetAtTime(this.muted ? 0 : this.vol * this.vol, T, 0.03);
    }
    // ----- تصویر -----
    ensureBuf() {
      const std = BZ.world.env.standard;
      if (this.std === std && this.buf) return;
      this.std = std; const w = std === 'PAL' ? 384 : 320, hh = std === 'PAL' ? 288 : 240;
      this.buf = BZ.cv(w, hh); this.buf2 = BZ.cv(w, hh); this.bg = this.buf.getContext('2d', { willReadFrequently: true }); this.b2 = this.buf2.getContext('2d');
    }
    // محتوای فعلی صفحه: {prog,t,vhs,sig} یا null (برف)
    source() {
      const W = BZ.world;
      if (this.input === 'AV') {
        const v = BZ.vcr ? BZ.vcr.getVideo() : null;
        if (!v) return { blue: true, sig: 1 };
        if (v.blank) return { snow: true, sig: 0 };
        const vst = BZ.vcr && BZ.vcr.pl ? BZ.vcr.pl.player.stream : null;
        if (v.live) { const c = W.channelByNumber(v.ch); const s = c ? BZ.rf.strength(c, W.env, W.isNight()) : 0; return c && s > 0.08 ? { prog: W.program(c.program), t: W.time, sig: s, stream: vst } : { snow: true, sig: 0 }; }
        return { prog: W.program(v.prog), t: v.t, vhs: v.vhs, sig: v.q, stream: vst };
      }
      const tu = this.tuner();
      if (!tu.src || tu.sig <= 0.08) return { snow: true, sig: 0 };
      return { prog: W.program(tu.src.program), t: W.time, sig: tu.sig, stream: this.pl ? this.pl.player.stream : null };
    }
    render(dctx, W, H, now) {
      const env = BZ.world.env;
      dctx.fillStyle = '#000'; dctx.fillRect(0, 0, W, H);
      const sinceOff = now - this.offAt;
      if (!this.on) {
        if (sinceOff < 450) { const k = 1 - sinceOff / 450; dctx.fillStyle = 'rgba(255,255,255,' + k + ')'; dctx.fillRect(W / 2 - (W / 2) * k, H / 2 - 1.5, W * k, 3); }
        else if (sinceOff < 2500) { dctx.fillStyle = 'rgba(200,255,200,' + (1 - (sinceOff - 450) / 2050) * 0.8 + ')'; dctx.beginPath(); dctx.arc(W / 2, H / 2, 2.5, 0, 7); dctx.fill(); }
        return;
      }
      this.ensureBuf();
      const b = this.bg, w = this.buf.width, hh = this.buf.height;
      const src = this.source(); this.sig = src.sig;
      const warm = BZ.clamp((now - this.onAt) / 1400, 0, 1);
      if (src.prog) BZ.video.draw(b, w, hh, src.prog, src.t, src.stream);
      else if (src.blue) BZ.video.scenes.blue(b, w, hh, 0);
      else { b.fillStyle = '#000'; b.fillRect(0, 0, w, hh); }
      const mp = env.multipath * (src.prog ? 1 : 0);
      if (mp > 0.05) { b.globalAlpha = Math.min(0.45, mp * 0.55); b.drawImage(this.buf, Math.round(5 + mp * 10), 0); b.globalAlpha = 1; }
      const sg = src.sig, snow = src.blue ? 0 : src.snow ? 1 : BZ.clamp(1 - sg * 1.3, 0, 1) * 0.9;
      const vhs = src.vhs || null;
      let sat = this.color * 2 * (src.blue ? 1 : BZ.clamp(sg / 0.35, 0, 1));
      if (vhs) sat *= 0.88;
      const img = b.getImageData(0, 0, w, hh);
      BZ.video.fx(img, { sat, bright: (this.bright - 0.5) * 130 - (1 - warm) * 140, contrast: (0.5 + this.contrast) * (0.4 + 0.6 * warm), tint: (this.tint - 0.5) * 2, snow, vhs, time: now / 1000 });
      this.b2.putImageData(img, 0, 0);
      // هماهنگی عمودی (رول) و افقی (کشیدگی)
      const vErr = Math.abs(this.vhold - 0.5) * 2 + (src.snow ? 0.4 : 0) + (vhs && vhs.track > 0.6 ? 0.1 : 0);
      this.roll = vErr > 0.08 ? (this.roll + vErr * 0.012 * (1 + vErr * 3)) % 1 : this.roll * 0.8;
      if (this.roll < 0.002) this.roll = 0;
      const hErr = Math.abs(this.hhold - 0.5) * 2, strip = 3;
      dctx.imageSmoothingEnabled = true;
      const sx = W / w, sy = H / hh, off = Math.round(this.roll * hh);
      for (let y = 0; y < hh; y += strip) {
        let dy = y + off; if (dy >= hh) dy -= hh;
        const tear = hErr > 0.05 ? Math.sin(y * 0.12 + now * 0.006) * hErr * w * 0.18 + hErr * w * 0.3 * Math.sin(now * 0.001) : 0;
        dctx.drawImage(this.buf2, 0, y, w, strip, tear * sx, dy * sy, W, strip * sy + 0.5);
      }
      if (this.roll > 0.01) { dctx.fillStyle = '#000'; dctx.fillRect(0, off * sy - 6, W, 12); }
      // نمایش روی صفحه (OSD)
      if (now < this.osd.until) {
        dctx.font = 'bold ' + Math.round(H * 0.075) + 'px monospace'; dctx.textAlign = 'right'; dctx.textBaseline = 'top';
        dctx.fillStyle = '#000'; dctx.fillText(this.osd.text, W - 14, 16); dctx.fillStyle = '#4dff6e'; dctx.fillText(this.osd.text, W - 16, 14);
      }
      if (src.snow && !src.blue) { dctx.font = 'bold ' + Math.round(H * 0.055) + 'px ' + BZ.FONT; dctx.textAlign = 'center'; dctx.fillStyle = 'rgba(255,255,255,.85)'; dctx.fillText('سیگنالی دریافت نمی‌شود', W / 2, H * 0.46); }
    }
  };

  BZ.tvPanel = function (tv) {
    const screen = BZ.cv(560, 420, 'tv-canvas'), dctx = screen.getContext('2d');
    const glass = h('div', { class: 'tv-glass' }), scan = h('div', { class: 'tv-scan' });
    const crt = h('div', { class: 'tv-crt' }, screen, scan, glass);
    const sigBar = h('div', { class: 'r-bars' }, [0, 1, 2, 3, 4, 5, 6, 7].map(() => h('i')));
    const info = h('div', { class: 'tv-info' });
    const pw = BZ.toggle('⏻', tv.on, (v) => { if (v) BZ.audio.init(); tv.power(v); if (BZ.vcr) BZ.vcr.setDemand('tv', v && tv.input === 'AV'); }, 'pw');
    const inSeg = BZ.seg([{ v: 'TV', t: 'آنتن' }, { v: 'AV', t: 'AV (ویدئو)' }], tv.input, (v) => tv.setInput(v));
    const muteT = BZ.toggle('بی‌صدا', false, (v) => { tv.muted = v; tv.flash(v ? 'MUTE' : 'VOL'); });
    const stdSeg = BZ.seg([{ v: 'PAL', t: 'PAL ۶۲۵' }, { v: 'NTSC', t: 'NTSC ۵۲۵' }], BZ.world.env.standard, (v) => { BZ.world.env.standard = v; BZ.world.save(); });
    const keys = h('div', { class: 'keypad' }, [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => BZ.btn(String(d), () => tv.digit(d), 'sm')));
    const knobs = h('div', { class: 'r-knobs' },
      BZ.knob({ label: 'بلندی', value: tv.vol, fmt: (v) => Math.round(v * 100) + '%', onInput: (v) => { tv.vol = v; tv.flash('VOL ' + Math.round(v * 100), 1200); tv.save(); } }),
      BZ.knob({ label: 'روشنایی', value: tv.bright, fmt: (v) => Math.round(v * 100) + '', onInput: (v) => { tv.bright = v; tv.save(); } }),
      BZ.knob({ label: 'تضاد', value: tv.contrast, fmt: (v) => Math.round(v * 100) + '', onInput: (v) => { tv.contrast = v; tv.save(); } }),
      BZ.knob({ label: 'رنگ', value: tv.color, fmt: (v) => Math.round(v * 100) + '', onInput: (v) => { tv.color = v; tv.save(); } }),
      BZ.knob({ label: 'فام', value: tv.tint, fmt: (v) => Math.round((v - 0.5) * 200) + '', onInput: (v) => { tv.tint = v; tv.save(); } }),
      BZ.knob({ label: 'هماهنگی عمودی', value: tv.vhold, fmt: (v) => (Math.abs(v - 0.5) < 0.04 ? 'قفل' : v.toFixed(2)), onInput: (v) => { tv.vhold = v; } }),
      BZ.knob({ label: 'هماهنگی افقی', value: tv.hhold, fmt: (v) => (Math.abs(v - 0.5) < 0.04 ? 'قفل' : v.toFixed(2)), onInput: (v) => { tv.hhold = v; } }),
      BZ.knob({ label: 'تنظیم دقیق', min: -1, max: 1, value: 0, fmt: (v) => v.toFixed(2), onInput: (v) => { tv.fine = v; } }));
    const root = h('div', { class: 'tv-body' }, crt, info,
      h('div', { class: 'r-ctrl' }, pw, inSeg, BZ.btn('CH −', () => tv.setChannel(tv.channel - 1), 'sm'), BZ.btn('CH +', () => tv.setChannel(tv.channel + 1), 'sm'), BZ.btn('◀ اسکن', () => tv.scan(-1)), BZ.btn('اسکن ▶', () => tv.scan(1)), muteT),
      keys, knobs, h('div', { class: 'r-ctrl' }, h('span', { class: 'lbl' }, 'استاندارد پخش:'), stdSeg, h('span', { class: 'lbl' }, 'قدرت سیگنال:'), sigBar));
    let lastDraw = 0;
    root.paint = function (now) {
      if (now - lastDraw >= 30) { lastDraw = now; tv.render(dctx, screen.width, screen.height, now); }
      const lvl = tv.on ? Math.round(tv.sig * 8) : 0;
      Array.from(sigBar.children).forEach((b, i) => b.classList.toggle('on', i < lvl));
      const c = BZ.world.channelByNumber(tv.channel);
      info.textContent = !tv.on ? 'خاموش' : tv.input === 'AV' ? 'ورودی AV — ' + (BZ.vcr ? BZ.vcr.statusText() : '') : 'کانال ' + tv.channel + (c ? ' — ' + c.name : ' — (بدون فرستنده)');
      pw.set(tv.on); inSeg.set(tv.input);
    };
    return root;
  };
})();

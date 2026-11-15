/* util.js — ابزارهای پایه: عدد تصادفی قابل‌تکرار، ذخیره‌سازی، FFT، قالب‌بندی */
(function () {
  'use strict';
  const BZ = (window.BZ = window.BZ || {});

  BZ.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  BZ.lerp = (a, b, t) => a + (b - a) * t;
  BZ.smooth = (x) => { x = BZ.clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  BZ.mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  BZ.pad2 = (n) => (n < 10 ? '0' : '') + n;

  // تولید عدد تصادفی قابل‌تکرار (mulberry32): همین seed همیشه همین دنباله را می‌دهد
  BZ.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  BZ.hash = function (s) {
    s = String(s);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  BZ.fmtTime = (s) => {
    s = Math.max(0, Math.floor(s));
    return BZ.pad2(Math.floor(s / 3600)) + ':' + BZ.pad2(Math.floor((s % 3600) / 60)) + ':' + BZ.pad2(s % 60);
  };
  BZ.clockHM = (s) => {
    s = ((Math.floor(s) % 86400) + 86400) % 86400;
    return BZ.pad2(Math.floor(s / 3600)) + ':' + BZ.pad2(Math.floor((s % 3600) / 60));
  };
  BZ.uid = (p) => (p || 'x') + Math.random().toString(36).slice(2, 8);

  BZ.store = {
    get(k, d) { try { const v = localStorage.getItem('bz.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('bz.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem('bz.' + k); } catch (e) { /* ignore */ } },
  };

  BZ.bus = {
    _l: {},
    on(e, f) { (this._l[e] = this._l[e] || []).push(f); },
    emit(e, a) { (this._l[e] || []).forEach((f) => { try { f(a); } catch (x) { console.error(x); } }); },
  };

  // FFT درجا (طول باید توان ۲ باشد)
  BZ.fft = function (re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < half; k++) {
          const a = i + k, b = a + half;
          const vr = re[b] * cr - im[b] * ci, vi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - vr; im[b] = im[a] - vi;
          re[a] += vr; im[a] += vi;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  };
})();

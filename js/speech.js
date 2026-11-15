/* speech.js — گفتار شبیه‌سازی‌شده: هجابندی (فارسی/انگلیسی)، واکه‌ها با فرمانت‌های F1/F2 (مدل منبع–فیلتر)، و ویزم (شکل دهان)
   یک «طرح هجایی» واحد هم صدا را می‌سازد هم دهان را حرکت می‌دهد؛ پس هماهنگی لب به‌صورت ساختاری دقیق است. */
(function () {
  'use strict';
  const BZ = window.BZ;

  // فرمانت‌ها (Hz) برای واکه‌ها طبق جدول‌های آواشناسی؛ mw/mh = عرض/ارتفاع نسبی دهان (ویزم)
  const VOW = {
    a: { f1: 760, f2: 1250, mw: 1.0, mh: 1.0 },
    e: { f1: 520, f2: 1800, mw: 0.95, mh: 0.55 },
    i: { f1: 310, f2: 2250, mw: 1.2, mh: 0.3 },
    o: { f1: 470, f2: 880, mw: 0.55, mh: 0.7 },
    u: { f1: 330, f2: 800, mw: 0.4, mh: 0.45 },
  };
  const FRIC = 'سشزژفخهحصثذضظsfzhxv';
  const PLOS = 'بپتدکگطقغجچcdgjkpqtb';
  const PAUSE = { '،': 0.18, ',': 0.18, '.': 0.45, '!': 0.45, '؟': 0.45, '?': 0.45, ':': 0.25, ';': 0.25, '…': 0.5 };
  const DROP = '‌ًٌٍَُِّْ';
  const cache = new Map();

  const consType = (ch) => (!ch ? '' : FRIC.includes(ch) ? 'f' : PLOS.includes(ch) ? 'p' : '');

  function wordSyl(w) {
    const letters = [...w].filter((c) => !DROP.includes(c));
    if (!letters.length) return [{ v: 'e', c: '' }];
    if (/[a-z]/i.test(w)) {
      const parts = w.toLowerCase().match(/[aeiouy]+|[^aeiouy]+/g) || [];
      const out = [];
      parts.forEach((p, i) => {
        if (/[aeiouy]/.test(p[0])) {
          const v = p[0] === 'y' ? 'i' : p[0];
          out.push({ v: VOW[v] ? v : 'e', c: out.length || i === 0 ? '' : '' });
        }
      });
      if (!out.length) return [{ v: 'e', c: consType(letters[0].toLowerCase()) }];
      out[0].c = consType(letters[0].toLowerCase());
      return out;
    }
    const vt = (c, i) => (c === 'ا' || c === 'آ' ? 'a' : (c === 'و' && i > 0) ? 'u' : ((c === 'ی' || c === 'ي') && i > 0) ? 'i' : null);
    const longs = [];
    letters.forEach((c, i) => { const t = vt(c, i); if (t) longs.push(t); });
    const nv = longs.length, nc = letters.length - nv;
    const s = Math.max(1, nv + Math.ceil(Math.max(0, nc - 2 * nv) / 2));
    const seqH = BZ.hash(w), shorts = [];
    for (let k = 0; k < s - nv; k++) shorts.push((seqH >> k) & 1 ? 'a' : 'e');
    const vs = shorts.concat(longs).slice(0, s);
    const first = vt(letters[0], 0) ? '' : consType(letters[0]);
    return vs.map((v, i) => ({ v, c: i === 0 ? first : '' }));
  }

  BZ.speech = {
    VOW,
    // طرح هجایی یک جمله: [{t,d,v,c}] نسبت به آغاز جمله، مدت کل و پرسشی‌بودن
    plan(text, speed) {
      speed = BZ.clamp(speed || 1, 0.5, 2);
      const key = speed + '|' + text;
      if (cache.has(key)) return cache.get(key);
      const toks = String(text).match(/[^\s،,.!?؟:;…]+|[،,.!?؟:;…]/g) || [];
      const syl = []; let t = 0;
      toks.forEach((tok) => {
        if (PAUSE[tok] !== undefined) { t += PAUSE[tok] / speed; return; }
        const ws = wordSyl(tok);
        ws.forEach((s, i) => {
          const d = (0.17 + (i === ws.length - 1 ? 0.04 : 0)) / speed;
          syl.push({ t, d, v: s.v, c: s.c || '' });
          t += d + 0.012 / speed;
        });
        t += 0.07 / speed;
      });
      const res = { syl, dur: Math.max(0.3, t), q: /[؟?]\s*$/.test(String(text).trim()) };
      if (cache.size > 400) cache.clear();
      cache.set(key, res);
      return res;
    },
    // باز بودن دهان و ویزم در لحظهٔ tl (ثانیه از آغاز جمله)
    mouthAt(syl, tl) {
      for (let i = 0; i < syl.length; i++) {
        const s = syl[i];
        if (tl >= s.t && tl < s.t + s.d) return { open: Math.pow(Math.sin(Math.PI * (tl - s.t) / s.d), 0.7), v: s.v };
        if (s.t > tl) break;
      }
      return { open: 0, v: 'e' };
    },
  };
})();

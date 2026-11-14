/* ui.js — اجزای رابط: دکمه، ولوم چرخشی، اسلایدر، LED، ... */
(function () {
  'use strict';
  const BZ = window.BZ;

  const h = (BZ.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (k === 'class') el.className = v;
        else if (k === 'style' && v && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else if (v !== false && v != null) el.setAttribute(k, v);
      }
    }
    for (const c of kids.flat(3)) {
      if (c == null || c === false) continue;
      el.append(typeof c === 'object' && c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  });

  BZ.cv = function (w, hh, cls) {
    const c = h('canvas', { class: cls || '' });
    c.width = w; c.height = hh;
    return c;
  };

  BZ.btn = (text, onClick, cls) => h('button', { class: 'btn ' + (cls || ''), type: 'button', onclick: onClick }, text);

  BZ.toggle = function (text, value, onChange, cls) {
    let v = !!value;
    const b = h('button', { class: 'btn tgl ' + (cls || ''), type: 'button' }, text);
    const paint = () => b.classList.toggle('on', v);
    b.addEventListener('click', () => { v = !v; paint(); onChange && onChange(v); });
    b.set = (nv) => { v = !!nv; paint(); };
    b.get = () => v;
    paint();
    return b;
  };

  BZ.led = function (color) {
    const l = h('span', { class: 'led ' + (color || 'green') });
    l.set = (on) => l.classList.toggle('lit', !!on);
    return l;
  };

  BZ.seg = function (opts, value, onChange) {
    const wrap = h('div', { class: 'seg' });
    const btns = opts.map((o) => {
      const b = h('button', { type: 'button', class: 'segb' }, o.t);
      b.addEventListener('click', () => { wrap.set(o.v); onChange && onChange(o.v); });
      b._v = o.v;
      wrap.append(b);
      return b;
    });
    wrap.set = (v) => btns.forEach((b) => b.classList.toggle('on', b._v === v));
    wrap.set(value);
    return wrap;
  };

  BZ.select = function (opts, value, onChange) {
    const s = h('select', { class: 'sel' }, opts.map((o) => h('option', { value: o.v }, o.t)));
    s.value = value;
    s.addEventListener('change', () => onChange && onChange(s.value));
    return s;
  };

  BZ.slider = function ({ label, min = 0, max = 1, value = 0, step = 0.01, fmt, onInput, cls }) {
    const f = fmt || ((v) => (+v).toFixed(2));
    const read = h('span', { class: 'sl-read' }, f(value));
    const inp = h('input', { type: 'range', min, max, step, value });
    inp.addEventListener('input', () => { read.textContent = f(+inp.value); onInput && onInput(+inp.value); });
    const w = h('label', { class: 'slider ' + (cls || '') }, h('span', { class: 'sl-label' }, label), inp, read);
    w.set = (v) => { inp.value = v; read.textContent = f(+v); };
    w.get = () => +inp.value;
    return w;
  };

  // ولوم چرخشی: با کشیدن (بالا/پایین یا چپ/راست)، چرخ ماوس یا کلید جهت‌دار
  BZ.knob = function ({ label, min = 0, max = 1, value = 0, step = 0, fmt, onInput, size, horizontal }) {
    const f = fmt || ((v) => v.toFixed(2));
    let v = value;
    const cap = h('div', { class: 'knob-cap' }, h('div', { class: 'knob-ind' }));
    const read = h('div', { class: 'knob-read' });
    const wrap = h('div', { class: 'knob', tabindex: 0, role: 'slider', 'aria-label': label }, cap, h('div', { class: 'knob-label' }, label), read);
    if (size) { cap.style.width = size + 'px'; cap.style.height = size + 'px'; }
    const paint = () => { cap.style.transform = 'rotate(' + (-135 + ((v - min) / (max - min)) * 270) + 'deg)'; read.textContent = f(v); };
    const set = (nv, fire) => {
      if (step) nv = Math.round(nv / step) * step;
      nv = BZ.clamp(nv, min, max);
      if (nv === v && !fire) return;
      v = nv; paint(); if (fire && onInput) onInput(v);
    };
    let drag = null;
    wrap.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, v };
      try { wrap.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      e.preventDefault();
    });
    wrap.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const d = horizontal ? (e.clientX - drag.x) / 220 : (drag.y - e.clientY) / 160;
      set(drag.v + d * (max - min), true);
    });
    const end = () => { drag = null; };
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', end);
    wrap.addEventListener('wheel', (e) => { e.preventDefault(); set(v + (e.deltaY < 0 ? 1 : -1) * (step || (max - min) / 50), true); }, { passive: false });
    wrap.addEventListener('keydown', (e) => {
      const s = step || (max - min) / 50;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { set(v + s, true); e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { set(v - s, true); e.preventDefault(); }
    });
    wrap.set = (nv) => set(nv, false);
    wrap.get = () => v;
    paint();
    return wrap;
  };

  BZ.panel = (title, ...kids) => h('section', { class: 'panel' }, title ? h('h3', null, title) : null, ...kids);
  BZ.note = (text) => h('p', { class: 'note' }, text);

  // نوشتن در بوم با پشتیبانی از فونت فارسی
  BZ.FONT = '"Vazirmatn","Noto Sans Arabic","Segoe UI",Tahoma,sans-serif';
  BZ.toast = function (msg) {
    let t = document.getElementById('toast');
    if (!t) { t = h('div', { id: 'toast' }); document.body.append(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 2400);
  };
})();

/* net.js — شبکهٔ مجازی داخل برنامه (کلاینت): اتصال به سرور داخلی، مدل پیوند (تأخیر/جیتر/افت بسته)،
   جریان‌های زنده با بافر جیتر، و کتابخانهٔ همگام‌شده (عروسک‌ها، نمایش‌ها، کانال‌ها).
   کیفیت پیوند از قدرت سیگنال موج می‌آید: سیگنال ضعیف ⇒ تأخیر بیشتر، افت بسته ⇒ یخ‌زدن تصویر و قطع صدا. */
(function () {
  'use strict';
  const BZ = window.BZ, clamp = BZ.clamp;
  BZ.extra = BZ.extra || { programs: [], stations: [], channels: [] };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const N = (BZ.net = {
    mode: '', up: false, server: null, worker: null, pend: new Map(), seq: 1, streams: new Set(),
    stats: { req: 0, tx: 0, rx: 0, lost: 0 },
    // ---- بالا آوردن سرور ----
    start() {
      return new Promise((resolve) => {
        let done = false;
        const fin = (m) => { if (done) return; done = true; N.mode = m; N.up = true; resolve(m); };
        const loopback = () => { const s = new BZ.Server({ persist: typeof indexedDB !== 'undefined' }); N.server = s; s.init().then(() => fin('loopback')); };
        try {
          if (typeof Worker === 'undefined' || typeof location === 'undefined' || !/^https?:/.test(location.protocol)) return loopback();
          const w = new Worker('js/netd.js'); N.worker = w;
          const to = setTimeout(() => { if (done) return; try { w.terminate(); } catch (e) { /* ignore */ } N.worker = null; loopback(); }, 3500);
          w.onmessage = (e) => {
            const m = e.data;
            if (m.type === 'ready') { clearTimeout(to); fin('worker'); }
            else if (m.type === 'res') { const p = N.pend.get(m.id); if (p) { N.pend.delete(m.id); p(m); } }
          };
          w.onerror = () => { clearTimeout(to); if (!done) { try { w.terminate(); } catch (e) { /* ignore */ } N.worker = null; loopback(); } };
        } catch (e) { loopback(); }
      });
    },
    raw(method, path, body) {
      if (N.worker) return new Promise((res) => { const id = N.seq++; N.pend.set(id, (m) => res({ status: m.status, body: m.body })); N.worker.postMessage({ type: 'req', id, method, path, body }); });
      return Promise.resolve().then(() => clone(N.server.handle(method, path, body ? clone(body) : body)));
    },
    // درخواست با پیوند مجازی؛ link = {latency, jitter, loss}
    call(method, path, body, link) {
      N.stats.req++;
      const lk = link || { latency: 3, jitter: 2, loss: 0 };
      const tx = body ? JSON.stringify(body).length : 0; N.stats.tx += tx;
      const delay = lk.latency + Math.random() * lk.jitter;
      return N.raw(method, path, body).then((r) => new Promise((res) => {
        if (Math.random() < lk.loss) { N.stats.lost++; setTimeout(() => res({ status: 0, body: { error: 'timeout' } }), delay); return; }
        N.stats.rx += JSON.stringify(r.body).length;
        setTimeout(() => res(r), delay);
      }));
    },
    openStream(pid, o) { return new Stream(pid, o || {}); },
    invalidate(pid) { N.streams.forEach((s) => { if (!pid || s.pid === pid) s.reset(); }); },
  });

  const LK = ['x', 'open', 'grow', 'wilt', 'ph'];
  function lerpScene(A, B, u) {
    if (u <= 0 || !A.actors || A.actors.length !== B.actors.length) return A;
    const o = Object.assign({}, A);
    o.actors = A.actors.map((a, i) => {
      const b = B.actors[i]; if (a.cid !== b.cid) return a;
      const r = Object.assign({}, a);
      LK.forEach((k) => { if (typeof a[k] === 'number' && typeof b[k] === 'number') r[k] = a[k] + (b[k] - a[k]) * u; });
      return r;
    });
    if (A.cam && B.cam) o.cam = { z: A.cam.z + (B.cam.z - A.cam.z) * u, x: A.cam.x + (B.cam.x - A.cam.x) * u, y: A.cam.y + (B.cam.y - A.cam.y) * u };
    return o;
  }

  const prewarmQ = []; let prewarmT = 0;
  function prewarm() {
    prewarmT = 0; const say = prewarmQ.shift();
    try { if (say && BZ.audio.ctx) BZ.speech.buffer(BZ.audio.ctx, say); } catch (e) { /* مهم نیست */ }
    if (prewarmQ.length) prewarmT = setTimeout(prewarm, 40);
  }
  // جریان زندهٔ یک برنامه از سرور: صحنه‌ها با ۲۰ هرتز، میزان‌های صوتی ۶ ثانیه جلوتر
  class Stream {
    constructor(pid, o) {
      this.id = BZ.uid('st'); this.pid = pid; this.t0 = o.t0 || 0; this.getT = null; this.q = o.quality || (() => 1);
      this.sc = []; this.bars = new Map(); this.busy = false; this.closed = false; this.stall = false; this.tag = o.tag || '';
      this.st = { reqs: 0, pk: 0, bytes: 0, lost: 0, late: 0, stalls: 0, lat: 0, buf: 0 };
      N.streams.add(this);
      this.timer = setInterval(() => this.pump(), 200);
      this.pump();
    }
    now() { return this.getT ? this.getT() : this.t0; }
    link() { const q = clamp(N.forceQ != null ? N.forceQ : this.q(), 0, 1); return { latency: 25 + (1 - q) * 350, jitter: 15 + (1 - q) * 120, loss: q > 0.55 ? 0 : Math.min(0.85, (0.55 - q) * 1.6) }; }
    reset() { this.sc = []; this.bars.clear(); this.busy = false; this.pump(); }
    pump() {
      if (this.closed || this.busy) return;
      const tc = this.now(), DT = 0.05, last = this.sc.length ? this.sc[this.sc.length - 1].t : tc - DT, wantEnd = tc + 1.4;
      const needSc = last < wantEnd - DT, i0 = Math.floor(tc / 2), i1 = Math.floor((tc + 6) / 2), miss = [];
      for (let i = i0; i <= i1 && miss.length < 4; i++) if (!this.bars.has(i)) miss.push(i);
      if (!needSc && !miss.length) return;
      const from = Math.max(last + DT, tc), n = needSc ? Math.min(40, Math.ceil((wantEnd - from) / DT) + 1) : 0;
      this.busy = true; this.st.reqs++;
      const sent = performance.now(), lk = this.link();
      N.call('POST', '/stream', { pid: this.pid, from, n, dt: DT, bars: miss }, lk).then((r) => {
        this.busy = false; if (this.closed) return;
        if (r.status !== 200) { this.st.lost++; return; }
        this.st.lat = performance.now() - sent;
        const cut = this.now() - 1.0;
        r.body.scenes.forEach((s) => { if (s.t >= cut) { this.sc.push(s); this.st.pk++; } });
        this.sc.sort((a, b) => a.t - b.t);
        while (this.sc.length > 2 && this.sc[1].t < cut) this.sc.shift();
        r.body.bars.forEach((b) => {
          this.bars.set(b.i, b.ev);
          b.ev.forEach((e) => {
            if (!e.say) return;
            if (BZ.ntts) BZ.ntts.want(e.say);
            // ساخت موج گفتار را از مسیر پخش بیرون ببر و بین فریم‌ها پخش کن تا صدا/تصویر نلرزد
            if (BZ.audio.ctx) { prewarmQ.push(e.say); if (!prewarmT) prewarmT = setTimeout(prewarm, 30); }
          });
        });   // صدای عصبی را چند ثانیه زودتر آماده کن
        for (const k of [...this.bars.keys()]) if (k < i0 - 2) this.bars.delete(k);
        this.st.bytes += r.body.scenes.length * 230 + r.body.bars.reduce((a, b) => a + b.ev.length * 90, 0);   // تخمین ارزان (بدون سریال‌سازی)
      });
    }
    has(i) { return this.bars.has(i); }
    bar(i) { const b = this.bars.get(i); if (!b) this.st.late++; return b; }
    sceneAt(t) {
      const a = this.sc;
      if (!a.length) { this.st.stalls++; return null; }
      if (t <= a[0].t) return a[0];
      const hi0 = a.length - 1;
      this.st.buf = a[hi0].t - t;
      if (t >= a[hi0].t) { if (!this.stall) this.st.stalls++; this.stall = true; return a[hi0]; }
      this.stall = false;
      let lo = 0, hi = hi0;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m].t <= t) lo = m; else hi = m; }
      return lerpScene(a[lo], a[hi], (t - a[lo].t) / (a[hi].t - a[lo].t));
    }
    close() { if (this.closed) return; this.closed = true; clearInterval(this.timer); N.streams.delete(this); }
  }

  // ساخت پخش‌کنندهٔ صدا: برنامه‌های «production» از جریان سرور می‌خوانند، بقیه محلی تولید می‌شوند
  BZ.makePlayer = function (ctx, prog, dest, opts) {
    opts = opts || {};
    let stream = null;
    if (prog.audio && prog.audio.style === 'production') {
      stream = N.openStream(prog.audio.pid || prog.id, { t0: opts.t0, quality: opts.quality, tag: opts.tag });
      opts = Object.assign({}, opts, { stream });
    }
    const pl = new BZ.ProgramPlayer(ctx, prog, dest, opts);
    if (stream) { stream.getT = () => pl.contentNow(); pl.stream = stream; const stop = pl.stop.bind(pl); pl.stop = function () { stop(); stream.close(); }; }
    return pl;
  };

  // ---- کتابخانهٔ همگام‌شده با سرور ----
  const FALLBACK = { id: '?', name: '؟', type: 'puppet', body: 'ball', color: '#aaa', accent: '#666', voice: { pitch: 180, speed: 1 } };
  const timers = {};
  const L = (BZ.lib = {
    chars: [], shows: [],
    char(cid) { return L.chars.find((c) => c.id === cid) || FALLBACK; },
    show(id) { return L.shows.find((s) => s.id === id) || null; },
    sync() {
      return N.call('GET', '/catalog').then((r) => {
        if (r.status !== 200) return false;
        const d = r.body; L.chars = d.chars; L.shows = d.shows;
        BZ.extra.programs = d.programs; BZ.extra.stations = d.stations; BZ.extra.channels = d.channels;
        BZ.world.rebuild(); BZ.bus.emit('world'); BZ.bus.emit('lib');
        return true;
      });
    },
    // ذخیرهٔ تأخیری روی سرور
    putChar(c) { return L.put('chars', c); },
    putShow(s) { return L.put('shows', s); },
    put(kind, o) {
      clearTimeout(timers[o.id]);
      return new Promise((res) => { timers[o.id] = setTimeout(() => { N.call('PUT', '/' + kind + '/' + o.id, o).then((r) => { if (kind === 'shows') N.invalidate('prod_' + o.id); res(r); }); }, 250); });
    },
    del(kind, id) { return N.call('DELETE', '/' + kind + '/' + id).then((r) => L.sync().then(() => r)); },
    publish(body) { return N.call('POST', '/publish', body).then((r) => (r.status === 200 ? L.sync().then(() => r) : r)); },
    unpublish(id) { return N.call('DELETE', '/publish/' + id).then((r) => L.sync().then(() => r)); },
  });
})();

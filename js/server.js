/* server.js — «سرور پخش» درون برنامه (Bazi Net Server)
   در یک Web Worker جدا اجرا می‌شود (اگر مرورگر نتواند، همین کد داخل صفحه اجرا می‌شود).
   پایگاه‌دادهٔ خودش را در IndexedDB دارد، کاتالوگ برنامه/کانال/ایستگاه را نگه می‌دارد و
   جریان صحنه و صدا را برای کلاینت‌ها (رادیو، تلویزیون، ویدئو) تولید می‌کند. هیچ درخواستی به بیرون از دستگاه نمی‌رود. */
(function () {
  'use strict';
  const BZ = window.BZ;

  const P = (id, name, type, o) => Object.assign({ id, name, type, eyes: 0.5, eyeGap: 0.5, size: 1, seed: BZ.hash(id) % 50, builtin: true }, o);
  const BUILTIN_CHARS = [
    P('c_pashmi', 'پشمی', 'puppet', { body: 'sock', color: '#e8903a', accent: '#8a4b1a', ears: 'cat', eyes: 0.6, voice: { pitch: 210, speed: 1.1 } }),
    P('c_jojo', 'جوجو', 'puppet', { body: 'ball', color: '#ffd23f', accent: '#e08a00', ears: 'tuft', eyes: 0.8, voice: { pitch: 290, speed: 1.2 } }),
    P('c_robot', 'رباتی', 'puppet', { body: 'box', color: '#9fb4c8', accent: '#4a5d73', ears: 'antenna', eyes: 0.5, voice: { pitch: 120, speed: 0.95 } }),
    P('c_blob', 'قلقلی', 'puppet', { body: 'blob', color: '#8e6bd8', accent: '#4a2f8a', ears: 'bunny', eyes: 0.7, voice: { pitch: 170, speed: 1.0 } }),
    P('c_cactus', 'کاکتوس‌خان', 'plant', { species: 'cactus', color: '#3f9b55', accent: '#c9673a', voice: { pitch: 95, speed: 0.85 } }),
    P('c_laleh', 'لاله‌خانم', 'plant', { species: 'flower', color: '#ff5d8f', accent: '#c9673a', eyes: 0.6, voice: { pitch: 250, speed: 1.0 } }),
    P('c_fern', 'سرخس', 'plant', { species: 'fern', color: '#3a8f4a', accent: '#a85a3a', voice: { pitch: 150, speed: 1.0 } }),
    P('c_bonsai', 'بن‌سای', 'plant', { species: 'tree', color: '#4f9a3f', accent: '#7a4a2a', voice: { pitch: 110, speed: 0.9 } }),
  ];
  const BUILTIN_SHOWS = [
    { id: 'show_life', name: 'زندگی در خانهٔ سبز', kind: 'life', seed: 'green-house', epoch: 69600, title: 'زندگی در خانهٔ سبز', music: { style: 'ambient', vol: 0.18, root: 45, scale: 'dorian' }, life: { hour: 7, agents: ['c_pashmi', 'c_jojo', 'c_robot'], plants: ['c_cactus', 'c_laleh', 'c_fern'] }, builtin: true },
    {
      id: 'show_talk', name: 'گفت‌وگوی علمی گیاه و عروسک', kind: 'script', seed: 'talk', set: 'living', camera: 'auto', title: 'گفت‌وگوی علمی', music: { style: '', vol: 0.2 },
      cast: [{ cid: 'c_pashmi', x: 0.1 }, { cid: 'c_laleh', x: 0.5 }, { cid: 'c_robot', x: 0.9 }],
      lines: [
        { who: 0, emo: 'happy', act: 'wave', text: 'سلام به همهٔ بینندگان آزمایشگاه باز!' },
        { who: 1, emo: 'happy', act: '', text: 'سلام! من امروز یک گل تازه باز کرده‌ام.' },
        { who: 2, emo: 'neutral', act: '', text: 'گزارش علمی: نور و آب، دو شرط اصلی رشد گیاه است.' },
        { who: 0, emo: 'thinking', act: 'think', text: 'یعنی اگر آب نخورد چه می‌شود؟' },
        { who: 1, emo: 'sad', act: '', text: 'برگ‌هایم آویزان می‌شوند و رشدم متوقف می‌شود.' },
        { who: 2, emo: 'neutral', act: '', text: 'درست است. فتوسنتز بدون آب و نور انجام نمی‌شود.' },
        { who: 0, emo: 'surprised', act: 'jump', text: 'پس باید حتماً به گیاه‌ها آب بدهیم!' },
        { who: 1, emo: 'happy', act: '', text: 'ممنونم! شب بخیر، تا برنامهٔ بعدی.' },
      ], builtin: true,
    },
  ];
  const BUILTIN_PUB = {
    channels: [
      { id: 'ch9', number: 9, name: 'زندگی در خانهٔ سبز', band: 'VHF', power: 80, x: 50, y: 45, program: 'prod_show_life', builtin: true },
      { id: 'ch13', number: 13, name: 'گفت‌وگوی علمی', band: 'VHF', power: 80, x: 40, y: 55, program: 'prod_show_talk', builtin: true },
    ],
    stations: [{ id: 'fm962', name: 'نمایش رادیویی', band: 'FM', freq: 96.2, power: 50, x: 50, y: 60, program: 'prod_show_talk', stereo: true, builtin: true }],
  };

  const progOf = (s) => ({ id: 'prod_' + s.id, name: s.name, kind: 'production', audio: { style: 'production', bpm: 120, root: 48, scale: 'major', seed: s.id, density: 0.5, pid: 'prod_' + s.id }, video: { scene: 'production', pid: 'prod_' + s.id, pal: ['#111', '#222', '#333'], title: s.title || s.name, ticker: '' } });

  // ---- IndexedDB ----
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('bazi-server', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const idbGet = async (k) => { const d = await idb(); return new Promise((res) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); };
  const idbSet = async (k, v) => { const d = await idb(); return new Promise((res) => { const tx = d.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }); };

  class Server {
    constructor(o) {
      o = o || {};
      this.persist = o.persist !== false && typeof indexedDB !== 'undefined';
      this.db = { chars: [], shows: [], pub: { channels: [], stations: [] } };
      this.reqs = 0; this.streamReqs = 0; this.bytesOut = 0; this.t0 = Date.now(); this.logs = []; this.saveT = null; this.saves = 0;
      this.eng = new BZ.Engine(this);
    }
    async init() {
      if (this.persist) { try { const d = await idbGet('db'); if (d && d.chars) this.db = d; } catch (e) { this.persist = false; } }
      this.log('server up • ذخیره‌سازی: ' + (this.persist ? 'IndexedDB' : 'حافظه'));
      return true;
    }
    log(m) { this.logs.push(new Date().toISOString().slice(11, 19) + ' ' + m); if (this.logs.length > 60) this.logs.shift(); }
    save() {
      if (!this.persist) return;
      clearTimeout(this.saveT);
      this.saveT = setTimeout(() => { idbSet('db', this.db).then(() => { this.saves++; }); }, 250);
    }
    allChars() { return BUILTIN_CHARS.concat(this.db.chars); }
    allShows() { return BUILTIN_SHOWS.concat(this.db.shows); }
    char(cid) { return this.allChars().find((c) => c.id === cid) || null; }
    show(id) { return this.allShows().find((s) => s.id === id) || null; }
    pubChannels() { return BUILTIN_PUB.channels.concat(this.db.pub.channels); }
    pubStations() { return BUILTIN_PUB.stations.concat(this.db.pub.stations); }
    catalog() {
      return { chars: this.allChars(), shows: this.allShows(), programs: this.allShows().map(progOf), channels: this.pubChannels(), stations: this.pubStations() };
    }
    // مسیریاب شبیه REST
    handle(method, path, body) {
      this.reqs++;
      const t0 = Date.now();
      try {
        const r = this.route(method, path, body || {});
        if (path !== '/stream') this.log(method + ' ' + path + ' → ' + r.status + ' (' + (Date.now() - t0) + 'ms)');
        return r;
      } catch (e) { this.log('خطا ' + method + ' ' + path + ': ' + (e && e.message)); return { status: 500, body: { error: String((e && e.message) || e) } }; }
    }
    route(method, path, b) {
      const ok = (body) => ({ status: 200, body });
      const err = (status, error) => ({ status, body: { error } });
      let m;
      if (method === 'GET' && path === '/status') {
        return ok({ up: true, uptime: Math.round((Date.now() - this.t0) / 1000), reqs: this.reqs, streamReqs: this.streamReqs, bytesOut: this.bytesOut, persist: this.persist, saves: this.saves, chars: this.db.chars.length, shows: this.db.shows.length, published: this.db.pub.channels.length + this.db.pub.stations.length, logs: this.logs.slice(-14) });
      }
      if (method === 'GET' && path === '/catalog') return ok(this.catalog());
      if ((m = path.match(/^\/chars\/([\w-]+)$/))) {
        const id = m[1];
        if (BUILTIN_CHARS.some((c) => c.id === id)) return err(403, 'شخصیت داخلی قابل ویرایش نیست');
        if (method === 'PUT') {
          if (!b.name || !b.type) return err(400, 'نام و نوع لازم است');
          const c = Object.assign({}, b, { id, builtin: false }), i = this.db.chars.findIndex((x) => x.id === id);
          if (i >= 0) this.db.chars[i] = c; else this.db.chars.push(c);
          this.save(); return ok(c);
        }
        if (method === 'DELETE') { this.db.chars = this.db.chars.filter((c) => c.id !== id); this.save(); return ok({ deleted: id }); }
      }
      if ((m = path.match(/^\/shows\/([\w-]+)$/))) {
        const id = m[1];
        if (BUILTIN_SHOWS.some((s) => s.id === id)) return err(403, 'نمایش داخلی قابل ویرایش نیست');
        if (method === 'PUT') {
          if (!b.kind) return err(400, 'نوع نمایش لازم است');
          const s = Object.assign({}, b, { id, builtin: false }), i = this.db.shows.findIndex((x) => x.id === id);
          if (i >= 0) this.db.shows[i] = s; else this.db.shows.push(s);
          this.save(); return ok(s);
        }
        if (method === 'DELETE') {
          this.db.shows = this.db.shows.filter((s) => s.id !== id);
          this.db.pub.channels = this.db.pub.channels.filter((c) => c.program !== 'prod_' + id);
          this.db.pub.stations = this.db.pub.stations.filter((c) => c.program !== 'prod_' + id);
          this.save(); return ok({ deleted: id });
        }
      }
      if (method === 'POST' && path === '/publish') {
        const s = this.show(b.show); if (!s) return err(404, 'نمایش پیدا نشد');
        const pid = 'prod_' + s.id;
        if (b.kind === 'tv') {
          const n = Math.round(b.number);
          if (!(n >= 1 && n <= 69)) return err(400, 'شمارهٔ کانال باید ۱ تا ۶۹ باشد');
          if (this.pubChannels().some((c) => c.number === n)) return err(409, 'کانال ' + n + ' در سرور قبلاً ثبت شده');
          const c = { id: 'u' + BZ.uid('c'), number: n, name: b.name || s.name, band: n <= 13 ? 'VHF' : 'UHF', power: +b.power || 60, x: +b.x || 50, y: +b.y || 50, program: pid };
          this.db.pub.channels.push(c); if (s.kind === 'life' && !s.epoch) { /* زمان شروع در کلاینت تعیین می‌شود */ }
          this.save(); this.log('کانال ' + n + ' منتشر شد'); return ok(c);
        }
        if (b.kind === 'radio') {
          const band = b.band || 'FM', f = +b.freq, B = { AM: [531, 1701, 9], FM: [87.5, 108, 0.24], SW: [3, 22, 0.03] }[band];
          if (!B || !(f >= B[0] && f <= B[1])) return err(400, 'فرکانس خارج از باند');
          const clash = this.pubStations().find((x) => x.band === band && Math.abs(x.freq - f) < B[2]);
          if (clash) return err(409, 'نزدیک به «' + clash.name + '»');
          const st = { id: 'u' + BZ.uid('s'), name: b.name || s.name, band, freq: f, power: +b.power || 50, x: +b.x || 50, y: +b.y || 50, program: pid, stereo: band === 'FM' };
          this.db.pub.stations.push(st); this.save(); this.log('ایستگاه ' + band + ' ' + f + ' منتشر شد'); return ok(st);
        }
        return err(400, 'نوع پخش نامعتبر');
      }
      if (method === 'DELETE' && (m = path.match(/^\/publish\/([\w-]+)$/))) {
        const id = m[1];
        if (BUILTIN_PUB.channels.concat(BUILTIN_PUB.stations).some((x) => x.id === id)) return err(403, 'پخش داخلی قابل حذف نیست');
        this.db.pub.channels = this.db.pub.channels.filter((c) => c.id !== id);
        this.db.pub.stations = this.db.pub.stations.filter((c) => c.id !== id);
        this.save(); return ok({ deleted: id });
      }
      if (method === 'POST' && path === '/inspect') {
        const s = b.show && typeof b.show === 'object' ? b.show : this.show(b.id); if (!s) return err(404, 'نمایش پیدا نشد');
        return ok(this.eng.inspect(s, b.t || 0));
      }
      if (method === 'POST' && path === '/stream') {
        const pid = String(b.pid || ''), s = this.show(pid.replace(/^prod_/, ''));
        if (!s) return err(404, 'برنامه پیدا نشد');
        this.streamReqs++;
        const n = Math.min(60, Math.max(0, b.n | 0)), dt = b.dt || 0.05, scenes = [], bars = [];
        for (let i = 0; i < n; i++) { const t = b.from + i * dt, sc = this.eng.scene(s, t); sc.t = t; scenes.push(sc); }
        (b.bars || []).slice(0, 6).forEach((i) => bars.push({ i, ev: this.eng.bar(s, i) }));
        const res = { scenes, bars }; this.bytesOut += JSON.stringify(res).length;
        return ok(res);
      }
      return err(404, 'مسیر ناشناخته: ' + method + ' ' + path);
    }
  }

  BZ.Server = Server;
  BZ.serverProg = progOf;
})();

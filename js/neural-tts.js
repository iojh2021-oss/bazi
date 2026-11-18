/* neural-tts.js — موتور گفتار عصبی آفلاین (Piper + onnxruntime-web)
   افزودنی است: به هیچ‌چیز موجود دست نمی‌زند. تا وقتی بارگذاری و «استفاده در شخصیت‌ها» روشن نشود،
   صدای فعلی (speech.js) دقیقاً مثل قبل کار می‌کند. اگر هر بخشی خطا بدهد فقط همین تب پیام می‌دهد. */
(function () {
  'use strict';
  const BZ = window.BZ;
  const h = BZ.h;

  // مسیرها مطلق می‌شوند تا import() و fetch داخل کتابخانه‌ها نسبت به فایل خودشان اشتباه حل نشود
  const U = (p) => new URL(p, document.baseURI).href;
  const PATHS = {
    ortJs: U('models/ort/ort.wasm.min.js'), ortDir: U('models/ort/'),
    phJs: U('models/phonemize/piper_phonemize.js'), phDir: U('models/phonemize/'),
  };
  // صداهای فارسی Piper (هر کدام دو فایل در models/piper/ دارند؛ با get-voices.sh دانلود می‌شوند)
  const VOICES = [['amir', 'امیر'], ['reza_ibrahim', 'رضا'], ['ganji', 'گنجی'], ['ganji_adabi', 'گنجی (ادبی)'], ['gyro', 'گایرو'], ['magnoliasis', 'مگنولیا']];
  let voice = BZ.store.get('ntts_voice', 'amir');
  if (!VOICES.some((v) => v[0] === voice)) voice = 'amir';
  const vModel = (id) => U('models/piper/fa_IR-' + id + '-medium.onnx');
  const vConf = (id) => vModel(id) + '.json';
  const V = new Map();              // شناسهٔ صدا ← {cfg, sess, loading}
  const S = { loading: null, err: '' };   // وضعیت مشترک (ort + آوانگار)
  const cache = new Map();          // کلید ← {pcm, sr, dur}
  const failed = new Set();         // کلیدهایی که ساخته نشدند (دوباره تلاش نمی‌شود)
  const SR_DEFAULT = 22050, MAX_SESS = 2;
  const DG = (c, m, ms, w) => { try { if (BZ.diag) (w ? BZ.diag.warn : BZ.diag.mark)(c, m, ms); } catch (e) { /* */ } };
  const CAL = {};                   // شناسهٔ صدا ← ضریب یادگرفته‌شدهٔ طول (تا بیشتر جمله‌ها با یک بار اجرا به مدت هدف برسند)
  let chain = Promise.resolve();    // ساخت صدا پشت‌سرهم (نشست ort هم‌زمان امن نیست)
  const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('فایل پیدا نشد: ' + src)); document.head.append(s);
    });
  }
  const bad = (r) => !r.ok || /text\/html/.test(r.headers.get('content-type') || '');   // سرویس‌ورکر در خطا index.html می‌دهد؛ آن را فایل معتبر نگیر
  async function getJSON(u) { const r = await fetch(u); if (bad(r)) throw new Error('فایل پیدا نشد: ' + u); return r.json(); }
  async function getBuf(u) { const r = await fetch(u); if (bad(r)) throw new Error('فایل پیدا نشد: ' + u); return new Uint8Array(await r.arrayBuffer()); }

  // بخش مشترک: ort + آوانگار (یک بار)
  function initShared(say) {
    if (S.loading) return S.loading;
    S.loading = (async () => {
      if (typeof WebAssembly === 'undefined') throw new Error('این مرورگر WebAssembly ندارد');
      say('موتور اجرا (ort)…');
      if (!window.ort) await loadScript(PATHS.ortJs);
      window.ort.env.wasm.wasmPaths = PATHS.ortDir; window.ort.env.wasm.numThreads = 1; window.ort.env.wasm.proxy = false;
      say('آوانگار (espeak-ng)…');
      if (typeof window.createPiperPhonemize !== 'function') await loadScript(PATHS.phJs);
      return true;
    })().catch((e) => { S.loading = null; throw e; });
    return S.loading;
  }
  // ----- Worker: ساخت صدا خارج از رشتهٔ رابط (اگر نشد، خودکار روی رشتهٔ اصلی) -----
  const WK = { w: null, ok: null, n: 0, pend: new Map() };
  function wcall(msg, ms) {
    return new Promise((res, rej) => {
      if (!WK.w) { try { WK.w = new Worker(U('js/ntts-worker.js')); } catch (e) { return rej(e); }
        WK.w.onmessage = (ev) => { const d = ev.data, p = WK.pend.get(d.rid); if (!p) return; WK.pend.delete(d.rid); clearTimeout(p.t); d.ok ? p.res(d) : p.rej(new Error(d.error)); };
        WK.w.onerror = (ev) => { WK.pend.forEach((p) => { clearTimeout(p.t); p.rej(new Error('worker: ' + (ev.message || 'خطا'))); }); WK.pend.clear(); }; }
      const t0 = performance.now(), res0 = res, rej0 = rej; res = (d) => { const ms = performance.now() - t0; if (ms > 250) DG('ntts', 'worker ' + msg.op + ' ' + (msg.text ? msg.text.length + ' نویسه' : (msg.vid || '')), ms); res0(d); }; rej = (e) => { DG('ntts', 'worker ' + msg.op + ' خطا: ' + (e && e.message), performance.now() - t0, true); rej0(e); };
      const rid = ++WK.n, t = setTimeout(() => { WK.pend.delete(rid); rej(new Error('worker پاسخ نداد')); }, ms || 120000);
      WK.pend.set(rid, { res, rej, t }); WK.w.postMessage(Object.assign({ rid }, msg));
    });
  }
  function killWorker() { WK.ok = false; try { if (WK.w) WK.w.terminate(); } catch (e) { /* مهم نیست */ } WK.w = null; WK.pend.forEach((p) => clearTimeout(p.t)); WK.pend.clear(); }
  async function loadViaWorker(id, v, say) {
    say('موتور صدا (پس‌زمینه)…');
    await wcall({ op: 'init', ortJs: PATHS.ortJs, ortDir: PATHS.ortDir, phJs: PATHS.phJs, phDir: PATHS.phDir }, 60000);
    say('مدل صدا (حدود ۶۱ مگابایت)…');
    const r = await wcall({ op: 'load', vid: id, conf: vConf(id), model: vModel(id) }, 180000);
    v.cfg = r.cfg; v.remote = true; v.sess = { release() { wcall({ op: 'drop', vid: id }, 20000).catch(() => {}); } };
    WK.ok = true;
  }

  // بارگذاری یک صدا (مدل ~۶۱ مگابایت)
  function loadVoice(id, onStatus) {
    let v = V.get(id);
    if (v && v.sess) return Promise.resolve(v);
    if (v && v.loading) return v.loading;
    v = v || {}; v.id = id; V.set(id, v);
    const say = (m) => { if (onStatus) onStatus(m); };
    const tL = performance.now();
    v.loading = (async () => {
      let done = false;
      if (WK.ok !== false && typeof Worker !== 'undefined') {
        try { await loadViaWorker(id, v, say); done = true; } catch (e) { console.warn('ntts worker → رشتهٔ اصلی:', e && e.message); DG('ntts', 'fallback → رشتهٔ اصلی؛ علت: ' + (e && e.message), null, true); if (/پیدا نشد/.test(String(e && e.message))) throw e; killWorker(); }
      }
      if (!done) {
        await initShared(say);
        say('تنظیمات صدا…'); v.cfg = await getJSON(vConf(id));
        say('مدل صدا (حدود ۶۱ مگابایت)…');
        v.sess = await window.ort.InferenceSession.create(await getBuf(vModel(id)), { executionProviders: ['wasm'] });
      }
      v.loading = null; S.err = ''; say('آماده'); DG('ntts', 'load ' + id + ' (' + (v.remote ? 'worker' : 'main') + ')', performance.now() - tL); if (v.remote) DG('ntts', 'worker ok');
      // حافظه: بیش از ۳ صدای هم‌زمان نگه نمی‌داریم
      const live = [...V.entries()].filter(([k, x]) => x.sess && k !== id);
      while (live.length >= MAX_SESS) { const [k, x] = live.shift(); try { x.sess.release(); } catch (e) { /* مهم نیست */ } x.sess = null; }
      return v;
    })().catch((e) => { V.delete(id); S.err = String(e && e.message || e); throw e; });
    return v.loading;
  }
  const init = (onStatus) => loadVoice(voice, onStatus).then(() => true);

  // متن ← شناسهٔ آواها (همان روش کتابخانهٔ مرجع)
  function phonemeIds(text, cfg) {
    return new Promise((resolve, reject) => {
      let done = false;
      const fin = (f, v) => { if (!done) { done = true; f(v); } };
      window.createPiperPhonemize({
        print: (line) => { try { const j = JSON.parse(line); if (j && j.phoneme_ids) fin(resolve, j.phoneme_ids); } catch (e) { /* خط غیر JSON */ } },
        printErr: () => {},
        locateFile: (u) => (u.endsWith('.wasm') ? PATHS.phDir + 'piper_phonemize.wasm' : u.endsWith('.data') ? PATHS.phDir + 'piper_phonemize.data' : u),
      }).then((m) => {
        try { m.callMain(['-l', cfg.espeak.voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']); } catch (e) { /* خروج عادی emscripten */ }
        setTimeout(() => fin(reject, new Error('آوانگاری نتیجه نداد')), 4000);
      }).catch((e) => fin(reject, e));
    });
  }

  function splitSentences(t) {
    const m = String(t).replace(/\s+/g, ' ').trim().match(/[^.!?؟۔\n]+[.!?؟۔]*/g);
    return (m || []).map((s) => s.trim()).filter((s) => /[\p{L}\p{N}]/u.test(s));
  }

  // بازنمونه‌گیری خطی: ضریب k>1 ← زیرتر و کوتاه‌تر
  function resample(pcm, k) {
    if (Math.abs(k - 1) < 0.005) return pcm;
    const n = Math.max(1, Math.floor(pcm.length / k)), out = new Float32Array(n);
    for (let i = 0; i < n; i++) { const p = i * k, a = Math.floor(p), f = p - a; out[i] = pcm[a] * (1 - f) + (pcm[Math.min(a + 1, pcm.length - 1)] || 0) * f; }
    return out;
  }

  async function synthOne(v, text, lengthScale) {
    if (v.remote) { const r = await wcall({ op: 'run', vid: v.id, text, ls: lengthScale }, 90000); if (r.tp != null) { v.tp = (v.tp || 0) + r.tp; v.ti = (v.ti || 0) + r.ti; DG('ntts', 'جمله: آوانگاری ' + r.tp + 'ms + مدل ' + r.ti + 'ms (' + text.length + ' نویسه)', r.tp + r.ti); } return r.pcm; }
    await new Promise((r) => setTimeout(r, 0));   // به رابط فرصت نفس‌کشیدن بده
    const ids = await phonemeIds(text, v.cfg), T = window.ort.Tensor, inf = v.cfg.inference || {};
    const feeds = {
      input: new T('int64', BigInt64Array.from(ids.map((x) => BigInt(x))), [1, ids.length]),
      input_lengths: new T('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new T('float32', Float32Array.from([inf.noise_scale == null ? 0.667 : inf.noise_scale, lengthScale, inf.noise_w == null ? 0.8 : inf.noise_w]), [3]),
    };
    if ((v.cfg.num_speakers || 1) > 1) feeds.sid = new T('int64', BigInt64Array.from([0n]), [1]);
    const out = await v.sess.run(feeds);
    return Float32Array.from((out.output || out[Object.keys(out)[0]]).data);
  }

  const pitchK = (f0) => BZ.clamp(Math.pow((f0 || 160) / 160, 0.4), 0.75, 1.35);
  const keyOf = (vid, text, sp, k, fit) => vid + '|' + text + '|' + sp + '|' + k.toFixed(2) + (fit ? '|f' : '');
  const SP = BZ.speech, origBuffer = SP.buffer, origPlan = SP.plan;

  // تولید صدا: {pcm, sr, dur}. opt: {speed, f0, nv (شناسهٔ صدا), fit (true: مدت را با موتور فعلی هم‌اندازه کن)}
  // fit لازم است چون زمان‌بندی نمایش، لب‌ها و برش صدا از طرح موتور داخلی می‌آید؛ صدای عصبی باید همان‌اندازه شود.
  async function synth(text, opt) {
    opt = opt || {};
    const vid = opt.nv || voice, sp = BZ.clamp(opt.speed || 1, 0.5, 2), k = pitchK(opt.f0), key = keyOf(vid, text, sp, k, opt.fit);
    if (cache.has(key)) return cache.get(key);
    const tS = performance.now();
    const target = opt.fit ? origPlan.call(SP, text, opt.speed || 1).dur : 0;
    const r = await serial(async () => {
      if (cache.has(key)) return cache.get(key);
      const v = await loadVoice(vid), sents = splitSentences(text);
      if (!sents.length) throw new Error('متنی برای خواندن نیست');
      const sr = (v.cfg.audio && v.cfg.audio.sample_rate) || SR_DEFAULT, gap = new Float32Array(Math.floor(SR_DEFAULT * 0.18));
      const run = async (ls) => {
        const parts = []; for (const s of sents) { parts.push(await synthOne(v, s, ls)); parts.push(gap); }
        let n = 0; parts.forEach((p) => { n += p.length; });
        const all = new Float32Array(n); let o = 0; parts.forEach((p) => { all.set(p, o); o += p.length; });
        return resample(all, k);
      };
      const lsBase = ((v.cfg.inference || {}).length_scale || 1) / sp * k;
      let ls = target > 0.15 ? BZ.clamp(lsBase * (CAL[vid] || 1), 0.35, 2.5) : lsBase, pcm = await run(ls);
      if (target > 0.15) {   // مدت را به هدف نزدیک کن (طول مدل تقریباً خطی است)
        let d0 = pcm.length / sr;
        const q = (ls * target / d0) / lsBase;   // ضریب ایده‌آل این جمله؛ میانگین متحرکش برای جملهٔ بعد
        CAL[vid] = BZ.clamp(CAL[vid] ? CAL[vid] * 0.6 + q * 0.4 : q, 0.4, 2.2);
        // فقط اگر خیلی بلندتر (برش می‌خورد) یا خیلی کوتاه‌تر شد، یک بار دوباره؛ وگرنه همان نتیجه (سریع‌تر)
        if (d0 > target * 1.06 || d0 < target * 0.8) { ls = BZ.clamp(ls * target / d0, 0.35, 2.5); pcm = await run(ls); DG('ntts', 'اجرای دوم برای هم‌اندازه‌شدن (' + d0.toFixed(1) + 's → هدف ' + target.toFixed(1) + 's)'); }
      }
      const res = { pcm, sr, dur: pcm.length / sr };
      DG('ntts', 'synth ' + vid + ' ' + text.length + ' نویسه ← ' + res.dur.toFixed(1) + 's' + (target ? ' (هدف ' + target.toFixed(1) + 's)' : ''), performance.now() - tS, performance.now() - tS > 6000);
      if (cache.size > 120) cache.clear();
      cache.set(key, res);
      return res;
    });
    return r;
  }

  function play(r, gain) {
    if (!BZ.audio.init()) throw new Error('صدای مرورگر در دسترس نیست');
    const ctx = BZ.audio.ctx, ab = ctx.createBuffer(1, r.pcm.length, r.sr), src = ctx.createBufferSource(), g = ctx.createGain();
    if (ab.copyToChannel) ab.copyToChannel(r.pcm, 0); else ab.getChannelData(0).set(r.pcm);
    src.buffer = ab; g.gain.value = gain || 0.9; src.connect(g); g.connect(BZ.audio.master); src.start();
    return src;
  }

  // ----- اتصال به شخصیت‌ها -----
  // هر شخصیت می‌تواند voice.neural داشته باشد (شناسهٔ یکی از صداها). «استفاده در شخصیت‌ها» برای شخصیت‌های بدون انتخاب، صدای تب «صدا» را می‌گذارد.
  const flag = { on: !!BZ.store.get('ntts_chars', false) };
  const vidFor = (say) => (say && say.nv) || (flag.on ? voice : '');
  const wantQ = [];
  let wantBusy = false;
  function want(say) {   // پیش‌ساخت پس‌زمینه: جملهٔ بعدی که هنوز آماده نیست
    const vid = vidFor(say); if (!vid || !say.t) return;
    neuralSeenAt = performance.now();
    const sp = BZ.clamp(say.sp || 1, 0.5, 2), key = keyOf(vid, say.t, sp, pitchK(say.f0), true);
    if (cache.has(key) || failed.has(key) || wantQ.some((q) => q.key === key)) return;
    wantQ.push({ key, say, vid }); drain();
  }
  function drain() {
    if (wantBusy || !wantQ.length) return;
    wantBusy = true; const q = wantQ.shift();
    synth(q.say.t, { speed: q.say.sp, f0: q.say.f0, nv: q.vid, fit: true }).catch((e) => { failed.add(q.key); console.warn('ntts', e); }).then(() => { wantBusy = false; drain(); });
  }
  SP.buffer = function (ctx, say) {
    const vid = vidFor(say);
    if (vid && say.t) {
      const hit = cache.get(keyOf(vid, say.t, BZ.clamp(say.sp || 1, 0.5, 2), pitchK(say.f0), true));
      if (hit) { const ab = ctx.createBuffer(1, hit.pcm.length, hit.sr); if (ab.copyToChannel) ab.copyToChannel(hit.pcm, 0); else ab.getChannelData(0).set(hit.pcm); return ab; }
      want(say);   // این بار صدای داخلی؛ دفعهٔ بعد صدای عصبی
    }
    return origBuffer.apply(SP, arguments);
  };
  // خطوط عصبی یک نمایش (نمایش‌نامه): [{text, sp, f0, nv}]
  function showLines(show) {
    const out = [];
    if (!show || show.kind === 'life' || !show.lines || !BZ.lib) return out;
    show.lines.forEach((ln) => {
      const m = (show.cast || [])[ln.who], ch = m ? BZ.lib.char(m.cid) : null, vc = (ch && ch.voice) || {};
      const nv = vc.neural || (flag.on ? voice : '');
      if (nv && ln.text) out.push({ t: ln.text, sp: vc.speed || 1, f0: vc.pitch || 180, nv });
    });
    return out;
  }
  let neuralSeenAt = 0;   // آخرین باری که صدای عصبی لازم شد (برای افزایش پیش‌دید جریان)
  const diagState = () => { const ids = [...V.entries()].filter(([k, x]) => x.sess).map(([k]) => k); const ld = [...V.entries()].filter(([k, x]) => x.loading).map(([k]) => k); return (ld.length ? 'load:' + ld.join(',') + ' ' : '') + 'q=' + wantQ.length + (wantBusy ? ' busy' : '') + ' ' + (WK.ok === true ? 'worker' : WK.ok === false ? 'main' : 'w?') + ' v=' + (ids.join(',') || '-'); };
  const api = {
    diagState, get wantsAhead() { return performance.now() - neuralSeenAt < 20000; },
    voices: VOICES, get voice() { return voice; },
    setVoice(id) { if (id === voice || !VOICES.some((x) => x[0] === id)) return; voice = id; BZ.store.set('ntts_voice', id); },
    init, synth, play, splitSentences, resample, pitchK, want, showLines,
    get ready() { const v = V.get(voice); return !!(v && v.sess); }, get error() { return S.err; },
    get forChars() { return flag.on; }, setForChars(v) { flag.on = !!v; BZ.store.set('ntts_chars', flag.on); },
    voiceOptions() { return [{ v: '', t: 'صدای داخلی (فرمانتی)' }].concat(VOICES.map((x) => ({ v: x[0], t: 'عصبی: ' + x[1] }))); },
    needsPrep(show) { return showLines(show).some((l) => !cache.has(keyOf(l.nv, l.t, BZ.clamp(l.sp, 0.5, 2), pitchK(l.f0), true))); },
    // ساخت همهٔ خطوط یک نمایش پیش از پخش؛ onProgress(i, n)
    async prepareShow(show, onProgress) { const L = showLines(show); let i = 0; for (const l of L) { await synth(l.t, { speed: l.sp, f0: l.f0, nv: l.nv, fit: true }); if (onProgress) onProgress(++i, L.length); } },
    async prepare(lines, onProgress) { let i = 0; for (const l of lines) { await synth(l.text, l); if (onProgress) onProgress(++i, lines.length); } },
  };
  BZ.ntts = api;

  // ----- تب «صدا» -----
  BZ.nttsPanel = function () {
    const st = h('div', { class: 'note' }, 'موتور هنوز بارگذاری نشده (برای بار نخست حدود ۹۰ مگابایت از فایل‌های خود برنامه خوانده می‌شود، نه اینترنت).');
    const ta = h('textarea', { class: 'inp', rows: 4, style: { width: '100%' } }, 'سلام! من یک عروسک سخنگو هستم و کاملاً آفلاین حرف می‌زنم.');
    let speed = 1, f0 = 160;
    const sl1 = BZ.slider({ label: 'سرعت', min: 0.6, max: 1.6, step: 0.05, value: 1, fmt: (v) => v.toFixed(2) + '×', onInput: (v) => { speed = v; } });
    const sl2 = BZ.slider({ label: 'زیروبمی', min: 90, max: 300, step: 5, value: 160, fmt: (v) => Math.round(v) + ' Hz', onInput: (v) => { f0 = v; } });
    const setSt = (m) => { st.textContent = m; };
    const fail = (e) => { setSt('خطا: ' + (e && e.message || e)); BZ.toast('خطا در صدای عصبی'); console.error(e); };
    const load = BZ.btn('بارگذاری موتور صدا', () => { load.disabled = true; init(setSt).then(() => { load.textContent = 'موتور آماده است'; }).catch((e) => { load.disabled = false; fail(e); }); }, 'go');
    const sel = BZ.select(VOICES.map((v) => ({ v: v[0], t: v[1] })), voice, (id) => {
      BZ.ntts.setVoice(id); load.disabled = false; load.textContent = 'بارگذاری موتور صدا'; setSt('صدا عوض شد؛ «بارگذاری موتور صدا» را بزنید. اگر فایل این صدا در برنامه نیست، با get-voices.sh دانلودش کنید.');
    });
    const speakN = BZ.btn('🗣 پخش با صدای عصبی', async () => {
      try { setSt('در حال ساخت صدا…'); const t0 = performance.now(), r = await synth(ta.value, { speed, f0 }); play(r); setSt('ساخته شد: ' + r.dur.toFixed(1) + ' ثانیه صدا در ' + ((performance.now() - t0) / 1000).toFixed(1) + ' ثانیه'); } catch (e) { fail(e); }
    });
    const speakK = BZ.btn('🤖 پخش با صدای فعلی (مقایسه)', () => {
      try { if (!BZ.audio.init()) return; const ctx = BZ.audio.ctx, src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = origBuffer.call(SP, ctx, { t: ta.value, sp: speed, f0, vt: 1, em: 'neutral' }); g.gain.value = 0.8; src.connect(g); g.connect(BZ.audio.master); src.start(); } catch (e) { fail(e); }
    });
    const chk = h('input', { type: 'checkbox' }); chk.checked = flag.on; chk.addEventListener('change', () => BZ.ntts.setForChars(chk.checked));
    return h('div', { class: 'panel' },
      h('h3', null, 'گفتار عصبی آفلاین (Piper)'),
      BZ.note('هر متنی بنویسید و بشنوید. صدای فعلی برنامه حذف یا عوض نشده و همچنان پیش‌فرض است.'),
      h('label', { class: 'note' }, 'صدا: ', sel), ta, sl1, sl2, st,
      h('div', { class: 'r-ctrl' }, load, speakN, speakK),
      h('label', { class: 'note' }, chk, ' استفاده برای همهٔ شخصیت‌هایی که صدای خودشان را انتخاب نکرده‌اند (صدای هر شخصیت را در استودیو ← کارگاه ← «صدای عصبی» تعیین کنید)'));
  };
})();

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
  const vModel = () => U('models/piper/fa_IR-' + voice + '-medium.onnx');
  const vConf = () => vModel() + '.json';
  const S = { cfg: null, sess: null, loading: null, ready: false, err: '' };
  const cache = new Map();          // text|sp|k  ←  {pcm, dur}
  const durByText = new Map();      // text|sp  ←  مدت صدای عصبی (برای هماهنگی لب)
  const planCache = new Map();
  const SR_DEFAULT = 22050;

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('فایل پیدا نشد: ' + src)); document.head.append(s);
    });
  }
  const bad = (r) => !r.ok || /text\/html/.test(r.headers.get('content-type') || '');   // سرویس‌ورکر در خطا index.html می‌دهد؛ آن را فایل معتبر نگیر
  async function getJSON(u) { const r = await fetch(u); if (bad(r)) throw new Error('فایل پیدا نشد: ' + u); return r.json(); }
  async function getBuf(u) { const r = await fetch(u); if (bad(r)) throw new Error('فایل پیدا نشد: ' + u); return new Uint8Array(await r.arrayBuffer()); }

  // بارگذاری یک‌باره: ort + phonemizer + تنظیمات + مدل
  function init(onStatus) {
    if (S.ready) return Promise.resolve(true);
    if (S.loading) return S.loading;
    const say = (m) => { if (onStatus) onStatus(m); };
    S.loading = (async () => {
      if (typeof WebAssembly === 'undefined') throw new Error('این مرورگر WebAssembly ندارد');
      say('موتور اجرا (ort)…');
      if (!window.ort) await loadScript(PATHS.ortJs);
      window.ort.env.wasm.wasmPaths = PATHS.ortDir; window.ort.env.wasm.numThreads = 1; window.ort.env.wasm.proxy = false;
      say('آوانگار (espeak-ng)…');
      if (typeof window.createPiperPhonemize !== 'function') await loadScript(PATHS.phJs);
      say('تنظیمات صدا…');
      S.cfg = await getJSON(vConf());
      say('مدل صدا (حدود ۶۱ مگابایت)…');
      S.sess = await window.ort.InferenceSession.create(await getBuf(vModel()), { executionProviders: ['wasm'] });
      S.ready = true; S.err = ''; say('آماده');
      return true;
    })().catch((e) => { S.loading = null; S.err = String(e && e.message || e); throw e; });
    return S.loading;
  }

  // متن ← شناسهٔ آواها (همان روش کتابخانهٔ مرجع)
  function phonemeIds(text) {
    return new Promise((resolve, reject) => {
      let done = false;
      const fin = (f, v) => { if (!done) { done = true; f(v); } };
      window.createPiperPhonemize({
        print: (line) => { try { const j = JSON.parse(line); if (j && j.phoneme_ids) fin(resolve, j.phoneme_ids); } catch (e) { /* خط غیر JSON */ } },
        printErr: () => {},
        locateFile: (u) => (u.endsWith('.wasm') ? PATHS.phDir + 'piper_phonemize.wasm' : u.endsWith('.data') ? PATHS.phDir + 'piper_phonemize.data' : u),
      }).then((m) => {
        try { m.callMain(['-l', S.cfg.espeak.voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']); } catch (e) { /* خروج عادی emscripten */ }
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

  async function synthOne(text, lengthScale) {
    const ids = await phonemeIds(text), T = window.ort.Tensor, inf = S.cfg.inference || {};
    const feeds = {
      input: new T('int64', BigInt64Array.from(ids.map((x) => BigInt(x))), [1, ids.length]),
      input_lengths: new T('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new T('float32', Float32Array.from([inf.noise_scale == null ? 0.667 : inf.noise_scale, lengthScale, inf.noise_w == null ? 0.8 : inf.noise_w]), [3]),
    };
    if ((S.cfg.num_speakers || 1) > 1) feeds.sid = new T('int64', BigInt64Array.from([0n]), [1]);
    const out = await S.sess.run(feeds);
    return Float32Array.from((out.output || out[Object.keys(out)[0]]).data);
  }

  const pitchK = (f0) => BZ.clamp(Math.pow((f0 || 160) / 160, 0.4), 0.75, 1.35);
  const keyOf = (text, sp, k) => voice + '|' + text + '|' + sp + '|' + k.toFixed(2);

  // تولید صدا: {pcm: Float32Array, sr, dur}
  async function synth(text, opt) {
    opt = opt || {};
    await init();
    const sp = BZ.clamp(opt.speed || 1, 0.5, 2), k = pitchK(opt.f0), key = keyOf(text, sp, k);
    if (cache.has(key)) return cache.get(key);
    const base = ((S.cfg.inference || {}).length_scale || 1) / sp * k, parts = [], gap = new Float32Array(Math.floor(SR_DEFAULT * 0.18));
    for (const s of splitSentences(text)) { parts.push(await synthOne(s, base)); parts.push(gap); }
    if (!parts.length) throw new Error('متنی برای خواندن نیست');
    let n = 0; parts.forEach((p) => { n += p.length; });
    const all = new Float32Array(n); let o = 0; parts.forEach((p) => { all.set(p, o); o += p.length; });
    const sr = (S.cfg.audio && S.cfg.audio.sample_rate) || SR_DEFAULT, pcm = resample(all, k), r = { pcm, sr, dur: pcm.length / sr };
    if (cache.size > 40) cache.clear();
    cache.set(key, r); durByText.set(voice + '|' + text + '|' + sp, r.dur);
    return r;
  }

  function play(r, gain) {
    if (!BZ.audio.init()) throw new Error('صدای مرورگر در دسترس نیست');
    const ctx = BZ.audio.ctx, ab = ctx.createBuffer(1, r.pcm.length, r.sr), src = ctx.createBufferSource(), g = ctx.createGain();
    if (ab.copyToChannel) ab.copyToChannel(r.pcm, 0); else ab.getChannelData(0).set(r.pcm);
    src.buffer = ab; g.gain.value = gain || 0.9; src.connect(g); g.connect(BZ.audio.master); src.start();
    return src;
  }

  // ----- اتصال اختیاری به شخصیت‌ها (پیش‌فرض خاموش) -----
  const flag = { on: !!BZ.store.get('ntts_chars', false) };
  const SP = BZ.speech, origBuffer = SP.buffer, origPlan = SP.plan;
  SP.buffer = function (ctx, say) {
    if (flag.on && say && say.t) {
      const hit = cache.get(keyOf(say.t, BZ.clamp(say.sp || 1, 0.5, 2), pitchK(say.f0)));
      if (hit) { const ab = ctx.createBuffer(1, hit.pcm.length, hit.sr); if (ab.copyToChannel) ab.copyToChannel(hit.pcm, 0); else ab.getChannelData(0).set(hit.pcm); return ab; }
    }
    return origBuffer.apply(SP, arguments);
  };
  SP.plan = function (text, speed) {
    const p = origPlan.apply(SP, arguments), sp = BZ.clamp(speed || 1, 0.5, 2), d = flag.on ? durByText.get(voice + '|' + text + '|' + sp) : 0;
    if (!d || !p.syl || !p.syl.length) return p;
    const ck = voice + '|' + text + '|' + sp + '|' + d.toFixed(3);
    let q = planCache.get(ck);
    if (!q) {
      const f = d / p.dur;   // کشیدن زمان‌بندی لب به مدت صدای عصبی
      q = Object.assign({}, p, { dur: d, syl: p.syl.map((s) => Object.assign({}, s, { t: s.t * f, d: s.d * f })) });
      if (planCache.size > 200) planCache.clear(); planCache.set(ck, q);
    }
    return q;
  };

  BZ.ntts = {
    voices: VOICES, get voice() { return voice; },
    // تغییر صدا: مدل قبلی آزاد و در بارگذاری بعدی مدل تازه خوانده می‌شود
    setVoice(id) { if (id === voice || !VOICES.some((v) => v[0] === id)) return; voice = id; BZ.store.set('ntts_voice', id); try { if (S.sess && S.sess.release) S.sess.release(); } catch (e) { /* مهم نیست */ } S.sess = null; S.cfg = null; S.ready = false; S.loading = null; S.err = ''; },
    init, synth, play, splitSentences, resample, pitchK, _S: S,
    get ready() { return S.ready; }, get error() { return S.err; },
    get forChars() { return flag.on; }, setForChars(v) { flag.on = !!v; BZ.store.set('ntts_chars', flag.on); },
    // آماده‌سازی چند جمله (برای شخصیت‌ها): lines = [{text, speed, f0}]
    async prepare(lines, onProgress) { let i = 0; for (const l of lines) { await synth(l.text, l); if (onProgress) onProgress(++i, lines.length); } },
  };

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
      BZ.ntts.setVoice(id); load.disabled = false; load.textContent = 'بارگذاری موتور صدا'; setSt('صدا عوض شد؛ دوباره «بارگذاری موتور صدا» را بزنید. اگر فایل آن صدا در برنامه نیست، با get-voices.sh دانلودش کنید.');
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
      h('label', { class: 'note' }, chk, ' استفاده در شخصیت‌ها (آزمایشی؛ فقط برای جمله‌هایی که از قبل ساخته شده‌اند)'));
  };
})();

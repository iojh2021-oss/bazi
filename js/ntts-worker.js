/* ntts-worker.js — اجرای Piper (آوانگار + onnxruntime) در Web Worker تا رابط کاربری هنگام ساخت صدا نلرزد */
'use strict';
let ort = null; const voices = new Map();

function phonemeIds(text, cfg, phDir) {
  return new Promise((resolve, reject) => {
    let done = false;
    const fin = (f, v) => { if (!done) { done = true; f(v); } };
    self.createPiperPhonemize({
      print: (line) => { try { const j = JSON.parse(line); if (j && j.phoneme_ids) fin(resolve, j.phoneme_ids); } catch (e) { /* خط غیر JSON */ } },
      printErr: () => {},
      locateFile: (u) => (u.endsWith('.wasm') ? phDir + 'piper_phonemize.wasm' : u.endsWith('.data') ? phDir + 'piper_phonemize.data' : u),
    }).then((m) => {
      try { m.callMain(['-l', cfg.espeak.voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']); } catch (e) { /* خروج عادی */ }
      setTimeout(() => fin(reject, new Error('آوانگاری نتیجه نداد')), 6000);
    }).catch((e) => fin(reject, e));
  });
}

self.onmessage = async (e) => {
  const m = e.data, id = m.rid;
  try {
    if (m.op === 'init') {
      importScripts(m.ortJs, m.phJs);
      ort = self.ort; ort.env.wasm.wasmPaths = m.ortDir; ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
      self.phDir = m.phDir;
      self.postMessage({ rid: id, ok: true });
    } else if (m.op === 'load') {
      const rc = await fetch(m.conf); if (!rc.ok || /text\/html/.test(rc.headers.get('content-type') || '')) throw new Error('فایل پیدا نشد: ' + m.conf);
      const cfg = await rc.json();
      const rm = await fetch(m.model); if (!rm.ok || /text\/html/.test(rm.headers.get('content-type') || '')) throw new Error('فایل پیدا نشد: ' + m.model);
      const sess = await ort.InferenceSession.create(new Uint8Array(await rm.arrayBuffer()), { executionProviders: ['wasm'] });
      voices.set(m.vid, { cfg, sess });
      self.postMessage({ rid: id, ok: true, cfg });
    } else if (m.op === 'drop') {
      const v = voices.get(m.vid); if (v) { try { v.sess.release(); } catch (x) { /* مهم نیست */ } voices.delete(m.vid); }
      self.postMessage({ rid: id, ok: true });
    } else if (m.op === 'run') {
      const v = voices.get(m.vid); if (!v) throw new Error('صدا در worker بارگذاری نشده');
      const ids = await phonemeIds(m.text, v.cfg, self.phDir), T = ort.Tensor, inf = v.cfg.inference || {};
      const feeds = {
        input: new T('int64', BigInt64Array.from(ids.map((x) => BigInt(x))), [1, ids.length]),
        input_lengths: new T('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
        scales: new T('float32', Float32Array.from([inf.noise_scale == null ? 0.667 : inf.noise_scale, m.ls, inf.noise_w == null ? 0.8 : inf.noise_w]), [3]),
      };
      if ((v.cfg.num_speakers || 1) > 1) feeds.sid = new T('int64', BigInt64Array.from([0n]), [1]);
      const out = await v.sess.run(feeds), pcm = Float32Array.from((out.output || out[Object.keys(out)[0]]).data);
      self.postMessage({ rid: id, ok: true, pcm }, [pcm.buffer]);
    }
  } catch (err) { self.postMessage({ rid: id, ok: false, error: String(err && err.message || err) }); }
};

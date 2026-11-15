/* netd.js — نقطهٔ ورود Worker: «سرور پخش» به‌صورت یک فرایند جدا داخل خود برنامه اجرا می‌شود */
self.window = self;
importScripts('util.js', 'audio.js', 'speech.js', 'engine.js', 'server.js');
const srv = new self.BZ.Server({ persist: true });
srv.init().then(() => self.postMessage({ type: 'ready' }));
self.onmessage = (e) => {
  const m = e.data;
  if (m && m.type === 'req') {
    const r = srv.handle(m.method, m.path, m.body);
    self.postMessage({ type: 'res', id: m.id, status: r.status, body: r.body });
  }
};

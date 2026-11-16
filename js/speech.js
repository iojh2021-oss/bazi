/* speech.js — موتور متن‌به‌گفتار آفلاین (فارسی + انگلیسی)، کاملاً داخل برنامه و بدون اینترنت
   مسیر کار (مثل سامانه‌های واقعی TTS):
     متن ← تبدیل نوشتار به آوا (G2P: فرهنگ‌واژهٔ استثناها + قواعد) ← آواها با مدت و نواخت (prosody)
         ← سنتزگر فرمانتی Klatt (منبع حنجره + رزوناتورهای F1..F5 + نویز سایشی/دمشی) ← موج صوتی
   همان «طرح آوایی» (plan) هم موج را می‌سازد هم دهان را حرکت می‌دهد؛ پس هماهنگی لب ساختاری است.
   plan(): قطعی و بدون صدا (روی سرور هم اجرا می‌شود)؛ render(): تولید نمونه‌های صوتی (سمت کلاینت). */
(function () {
  'use strict';
  const BZ = window.BZ;

  // ---------- جدول واکه‌ها: [F1, F2, F3, مدت‌ms] (مقادیر آواشناسی میانگین) ----------
  const V = {
    a: [690, 1450, 2500, 95], A: [640, 1000, 2450, 150], e: [540, 1750, 2550, 100], i: [290, 2250, 2950, 135], o: [460, 1000, 2400, 105], u: [320, 850, 2350, 135],
    IY: [280, 2250, 2950, 140], IH: [400, 1950, 2550, 95], EH: [530, 1840, 2480, 105], AE: [660, 1720, 2410, 130], AA: [730, 1090, 2440, 135], AO: [570, 840, 2410, 130],
    UH: [440, 1020, 2240, 95], UW: [300, 870, 2240, 140], AH: [640, 1190, 2390, 95], ER: [490, 1350, 1690, 130], AX: [500, 1500, 2500, 70],
  };
  const DIPH = { EY: ['EH', 'IY'], AY: ['AA', 'IY'], OY: ['AO', 'IY'], AW: ['AA', 'UW'], OW: ['AO', 'UW'] };
  const isVow = (s) => !!(V[s] || DIPH[s]);
  // ویزم (شکل دهان) برای هر آوا: کلید در VOW (puppet.js) و میزان باز بودن
  const VIS = { a: 'a', A: 'a', e: 'e', i: 'i', o: 'o', u: 'u', IY: 'i', IH: 'i', EH: 'e', AE: 'a', AA: 'a', AO: 'o', UH: 'u', UW: 'u', AH: 'a', ER: 'e', AX: 'e', EY: 'e', AY: 'a', OY: 'o', AW: 'a', OW: 'o' };
  const OPEN = { a: 0.9, A: 0.85, e: 0.55, i: 0.3, o: 0.6, u: 0.4, IY: 0.3, IH: 0.4, EH: 0.6, AE: 0.8, AA: 0.9, AO: 0.7, UH: 0.45, UW: 0.4, AH: 0.7, ER: 0.45, AX: 0.4, EY: 0.5, AY: 0.7, OY: 0.6, AW: 0.7, OW: 0.55 };
  const CVIS = { p: ['m', 0], b: ['m', 0], m: ['m', 0], f: ['f', 0.15], v: ['f', 0.15], s: ['s', 0.18], z: ['s', 0.18], S: ['c', 0.25], Z: ['c', 0.25], C: ['c', 0.25], J: ['c', 0.25], w: ['u', 0.3], R: ['c', 0.25], T: ['f', 0.2], D: ['f', 0.2] };

  // ---------- جدول همخوان‌ها ----------
  // نوع: nasal / liq / fric / stop / aff / h / gs (چاکنایی)
  const N = { m: [260, 1100, 2400], n: [260, 1650, 2500], N: [260, 2000, 2600] };
  const LIQ = { l: [360, 1300, 2800, 0.065], r: [380, 1400, 2100, 0.03], R: [350, 1250, 1600, 0.075], w: [300, 700, 2300, 0.06], y: [270, 2200, 3000, 0.06] };
  const FR = { f: [5500, 5000, 0.22, 0, 0.09], v: [5500, 5000, 0.14, 0.4, 0.06], s: [6200, 2200, 0.9, 0, 0.11], z: [6200, 2200, 0.5, 0.45, 0.08], S: [3300, 1800, 0.85, 0, 0.115], Z: [3300, 1800, 0.55, 0.45, 0.09], T: [6000, 5000, 0.15, 0, 0.09], D: [6000, 5000, 0.1, 0.4, 0.05], x: [2300, 1800, 0.55, 0, 0.09], G: [1500, 1500, 0.3, 0.55, 0.07] };
  // انسدادی‌ها: [مدت بسته‌ماندن، فرکانس مرکزی انفجار، پهنا، قدرت، محل F2، صدادار؟]
  const ST = { p: [0.06, 1000, 1000, 0.55, 800, 0], b: [0.05, 900, 900, 0.35, 800, 1], t: [0.055, 4300, 2500, 0.6, 1700, 0], d: [0.045, 4000, 2500, 0.4, 1700, 1], k: [0.06, 1900, 1000, 0.55, 1900, 0], g: [0.05, 1800, 1000, 0.4, 1900, 1] };
  const AFF = { C: [0.05, 3300, 1800, 0.75, 0.09, 0], J: [0.045, 3300, 1800, 0.5, 0.07, 1] };
  const NEUT = [500, 1400, 2500];

  const ZW = '‌‍‎‏';
  const PAUSE = { '،': 0.2, ',': 0.2, '.': 0.5, '!': 0.5, '؟': 0.5, '?': 0.5, ':': 0.28, ';': 0.28, '…': 0.55, '؛': 0.28, '\n': 0.35 };

  // ================= تبدیل نوشتار به آوا: فارسی =================
  const PC = { 'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's', 'ج': 'J', 'چ': 'C', 'ح': 'h', 'خ': 'x', 'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'ژ': 'Z', 'س': 's', 'ش': 'S', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': '?', 'غ': 'G', 'ف': 'f', 'ق': 'G', 'ک': 'k', 'ك': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'ء': '?', 'ئ': '?', 'ة': 't', 'ؤ': '?' };
  const FAV = 'aAeiou';
  // استثناهای پرکاربرد: «_» پایانی = بی‌تکیه (واژهٔ دستوری)
  const LEX_FA = {
    'سلام': 'salAm', 'من': 'man', 'تو': 'to', 'او': 'u', 'ما': 'mA', 'شما': 'SomA', 'آنها': 'AnhA', 'است': 'ast_', 'هست': 'hast', 'نیست': 'nist', 'که': 'ke_', 'به': 'be_', 'از': 'az_', 'در': 'dar_', 'با': 'bA_', 'را': 'rA_', 'و': 'o_', 'یا': 'yA_', 'اگر': 'agar', 'اما': 'ammA', 'برای': 'barAye', 'این': 'in', 'آن': 'An', 'چه': 'ce', 'چرا': 'cerA', 'چطور': 'cetor', 'چطوری': 'cetori', 'کجا': 'kojA', 'کی': 'key', 'چی': 'ci', 'خوب': 'xub', 'خیلی': 'xeyli', 'نمی': 'nemi_', 'می': 'mi_', 'یک': 'yek', 'دو': 'do', 'سه': 'se', 'نه': 'na', 'بله': 'bale', 'آره': 'Are', 'نور': 'nur', 'آب': 'Ab', 'گیاه': 'giyAh', 'گل': 'gol', 'عروسک': 'arusak', 'جهان': 'JahAn', 'زندگی': 'zendegi', 'امروز': 'emruz', 'فردا': 'fardA', 'دوست': 'dust', 'خانه': 'xAne', 'باغ': 'bAG', 'تلویزیون': 'televiziyon', 'رادیو': 'rAdiyo', 'علمی': 'elmi', 'گفتگو': 'goftogu', 'گفت‌وگو': 'goftogu', 'آزمایشگاه': 'AzmAyeSgAh', 'خوش': 'xoS', 'آمدید': 'Amadid', 'بینندگان': 'binandegAn', 'همه': 'hame', 'برنامه': 'barnAme', 'شخصیت': 'SaxSiyat', 'حال': 'hAl', 'نیاز': 'niyAz', 'خورشید': 'xorSid', 'درخت': 'deraxt', 'سبز': 'sabz', 'زیبا': 'zibA', 'ممنون': 'mamnun', 'خداحافظ': 'xodAhAfez', 'لطفا': 'lotfan', 'لطفاً': 'lotfan', 'بسیار': 'besyAr', 'همین': 'hamin', 'هم': 'ham_', 'ولی': 'vali', 'پس': 'pas', 'تا': 'tA_', 'بر': 'bar', 'تشنه': 'teSne', 'گرسنه': 'gorosne', 'خسته': 'xaste', 'خوابیدم': 'xAbidam', 'غذا': 'qazA', 'کار': 'kAr', 'روز': 'ruz', 'شب': 'Sab', 'صبح': 'sobh', 'بخیر': 'bexeyr', 'مهربان': 'mehrabAn', 'دنیا': 'donyA', 'خدا': 'xodA', 'نمایش': 'namAyeS', 'کاراکتر': 'kArAkter', 'کانال': 'kAnAl', 'امواج': 'amvAJ', 'صدا': 'sedA', 'تصویر': 'tasvir', 'سیگنال': 'signAl',
  };
  function insertEpenthesis(items) {
    // items: [{p, st?, long?}] ؛ همخوان‌های پشت‌سرهم را طبق هجاساخت فارسی (CV(C)(C)) با واکهٔ کوتاه می‌شکند
    const out = []; let i = 0;
    const isV = (x) => FAV.includes(x.p), defV = (c, first) => (first ? ('kgtpn'.includes(c) ? 'e' : 'a') : 'e');
    const n = items.length;
    if (!items.some((x) => isV(x))) {
      items.forEach((x, k) => { out.push(x); if (k === 0 && n > 1) out.push({ p: defV(x.p, true), ep: 1 }); });
      if (n === 1) out.push({ p: defV(items[0].p, true), ep: 1 });
      return out;
    }
    while (i < n) {
      if (isV(items[i])) { out.push(items[i]); i++; continue; }
      let j = i; while (j < n && !isV(items[j])) j++;
      let run = items.slice(i, j); const atStart = i === 0, atEnd = j === n;
      if (atStart && run.length >= 2) { out.push(run[0], { p: defV(run[0].p, true), ep: 1 }); run = run.slice(1); }
      while (run.length >= 3) { out.push(run[0], run[1], { p: 'e', ep: 1 }); run = run.slice(2); }
      run.forEach((x) => out.push(x));
      i = j;
    }
    return out;
  }
  function faG2P(word) {
    if (LEX_FA[word]) { const s = LEX_FA[word], un = s.endsWith('_'); return { ph: [...s.replace('_', '')].map((p) => ({ p })), un }; }
    const L = [...word].filter((c) => !ZW.includes(c));
    const isVl = (c) => c === 'ا' || c === 'آ' || c === 'و' || c === 'ی' || c === 'ي';
    const items = [];
    for (let i = 0; i < L.length; i++) {
      const c = L[i], nx = L[i + 1], pv = L[i - 1], last = items[items.length - 1];
      const lastV = last && FAV.includes(last.p);
      if (c === 'َ') { items.push({ p: 'a' }); continue; }
      if (c === 'ِ') { items.push({ p: 'e' }); continue; }
      if (c === 'ُ') { items.push({ p: 'o' }); continue; }
      if (c === 'ً') { items.push({ p: 'a' }, { p: 'n' }); continue; }
      if (c === 'ّ') { if (last && !lastV) last.long = true; continue; }
      if (c === 'ْ') continue;
      if (c === 'ا') {
        if (i === 0) {
          if (nx === 'ی' && (L[i + 2] == null || !isVl(L[i + 2]))) { items.push({ p: 'i' }); i++; continue; }
          if (nx === 'و' && (L[i + 2] == null || !isVl(L[i + 2]))) { items.push({ p: 'u' }); i++; continue; }
          items.push({ p: '?', gs: 1 }, { p: 'A' }); continue;
        }
        items.push({ p: 'A' }); continue;
      }
      if (c === 'آ') { items.push({ p: '?', gs: 1 }, { p: 'A' }); continue; }
      if (c === 'و') {
        if (L.length === 1) { items.push({ p: 'o' }); continue; }
        if (pv === 'خ' && nx === 'ا') continue;
        if (i === 0 || isVl(nx) || lastV) { items.push({ p: 'v' }); continue; }
        items.push({ p: 'u' }); continue;
      }
      if (c === 'ی' || c === 'ي') {
        if (i === 0 || lastV && nx != null) { items.push({ p: 'y' }); continue; }
        if (i === L.length - 1 || !isVl(nx)) { items.push({ p: lastV && i === L.length - 1 && last.p === 'A' ? 'y' : 'i' }); if (lastV && i === L.length - 1 && last.p === 'A') items.push({ p: 'i' }); continue; }
        items.push({ p: 'y' }); continue;
      }
      if (c === 'ه') {
        if (i === L.length - 1) { items.push(lastV && 'Aui'.includes(last.p) ? { p: 'h' } : { p: 'e' }); continue; }
        items.push({ p: 'h' }); continue;
      }
      if (PC[c]) { items.push({ p: PC[c] }); continue; }
    }
    const ph = insertEpenthesis(items);
    return { ph, un: false };
  }

  // ================= تبدیل نوشتار به آوا: انگلیسی =================
  const LEX_EN = {
    the: '!D AX', a: '!AX', an: '!AX n', and: '!AE n d', of: '!AX v', to: '!t UW', in: '!IH n', is: '!IH z', are: '!AA R', was: '!w AH z', be: '!b IY', i: 'AY', you: 'y UW', he: 'h IY', she: 'S IY', it: '!IH t', we: 'w IY', they: 'D EY', my: 'm AY', your: 'y AO R', how: 'h AW', what: 'w AH t', who: 'h UW', when: 'w EH n', where: 'w EH R', why: 'w AY', hello: 'h AX l OW', hi: 'h AY', hey: 'h EY', today: 't AX d EY', tomorrow: 't AX m AA R OW', good: 'g UH d', morning: 'm AO R n IH N', night: 'n AY t', evening: 'IY v n IH N', thank: 'T AE N k', thanks: 'T AE N k s', please: 'p l IY z', yes: 'y EH s', no: 'n OW', not: 'n AA t', this: 'D IH s', that: 'D AE t', with: 'w IH D', for: '!f AO R', from: '!f R AH m', on: 'AA n', at: '!AE t', by: 'b AY', have: 'h AE v', has: 'h AE z', do: 'd UW', does: 'd AH z', can: 'k AE n', will: 'w IH l', plant: 'p l AE n t', plants: 'p l AE n t s', flower: 'f l AW ER', water: 'w AO t ER', light: 'l AY t', sun: 's AH n', grow: 'g R OW', grows: 'g R OW z', life: 'l AY f', house: 'h AW s', garden: 'g AA R d AX n', world: 'w ER l d', television: 't EH l AX v IH Z AX n', radio: 'R EY d IY OW', tv: 't IY v IY', program: 'p R OW g R AE m', show: 'S OW', story: 's t AO R IY', friend: 'f R EH n d', friends: 'f R EH n d z', love: 'l AH v', time: 't AY m', day: 'd EY', hear: 'h IH R', see: 's IY', look: 'l UH k', big: 'b IH g', small: 's m AO l', new: 'n UW', old: 'OW l d', one: 'w AH n', two: 't UW', three: 'T R IY', four: 'f AO R', five: 'f AY v', six: 's IH k s', seven: 's EH v AX n', eight: 'EY t', nine: 'n AY n', ten: 't EH n', zero: 'z IH R OW', welcome: 'w EH l k AH m', watching: 'w AA C IH N', listening: 'l IH s AX n IH N', scientific: 's AY AX n t IH f IH k', science: 's AY AX n s', experiment: 'IH k s p EH R AH m EH n t', laboratory: 'l AE b R AX t AO R IY', signal: 's IH g n AX l', sound: 's AW n d', picture: 'p IH k C ER', channel: 'C AE n AX l', puppet: 'p AH p AH t', robot: 'R OW b AA t', cactus: 'k AE k t AH s', thirsty: 'T ER s t IY', hungry: 'h AH N g R IY', tired: 't AY ER d', happy: 'h AE p IY', sad: 's AE d', very: 'v EH R IY', much: 'm AH C', more: 'm AO R', some: 's AH m', all: 'AO l', if: '!IH f', then: 'D EH n', but: '!b AH t', so: 's OW', or: '!AO R', me: 'm IY', us: 'AH s', our: 'AW ER', his: '!h IH z', her: '!h ER', its: '!IH t s', there: 'D EH R', here: 'h IH R', now: 'n AW', again: 'AX g EH n', great: 'g R EY t', nice: 'n AY s', meet: 'm IY t', name: 'n EY m', say: 's EY', said: 's EH d', know: 'n OW', think: 'T IH N k', want: 'w AA n t', need: 'n IY d', give: 'g IH v', get: 'g EH t', make: 'm EY k', go: 'g OW', come: 'k AH m', eat: 'IY t', sleep: 's l IY p', dance: 'd AE n s', talk: 't AO k', great2: 'g R EY t',
  };
  const EN_FUNC = new Set(['the', 'a', 'an', 'and', 'of', 'to', 'in', 'is', 'are', 'was', 'be', 'it', 'for', 'from', 'at', 'with', 'that', 'this', 'or', 'but', 'if', 'his', 'her', 'its']);
  function enG2P(word) {
    const w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return { ph: [], un: true };
    const lx = LEX_EN[w];
    if (lx) { const un = lx.startsWith('!'); return { ph: lx.replace('!', '').split(' ').map((p) => ({ p })), un }; }
    const out = [], isV = (c) => !!c && 'aeiou'.includes(c), n = w.length;
    let i = 0;
    const push = (...a) => a.forEach((p) => out.push({ p }));
    while (i < n) {
      const c = w[i], nx = w[i + 1] || '', n2 = w[i + 2] || '', rest = w.slice(i), pv = w[i - 1] || '';
      const m = (s) => rest.startsWith(s);
      if (m('tion')) { push('S', 'AX', 'n'); i += 4; continue; }
      if (m('sion')) { push('Z', 'AX', 'n'); i += 4; continue; }
      if (m('ture')) { push('C', 'ER'); i += 4; continue; }
      if (m('ing') && i > 0 && i + 3 === n) { push('IH', 'N'); i += 3; continue; }
      if (m('tch')) { push('C'); i += 3; continue; }
      if (m('dge')) { push('J'); i += 3; continue; }
      if (m('ght')) { push('t'); i += 3; continue; }
      if (m('igh')) { push('AY'); i += 3; continue; }
      if (m('ch')) { push('C'); i += 2; continue; }
      if (m('sh')) { push('S'); i += 2; continue; }
      if (m('th')) { push('T'); i += 2; continue; }
      if (m('ph')) { push('f'); i += 2; continue; }
      if (m('ck')) { push('k'); i += 2; continue; }
      if (m('ng')) { push('N'); i += 2; continue; }
      if (m('nk')) { push('N', 'k'); i += 2; continue; }
      if (m('wh')) { push('w'); i += 2; continue; }
      if (m('qu')) { push('k', 'w'); i += 2; continue; }
      if (i === 0 && m('kn')) { push('n'); i += 2; continue; }
      if (i === 0 && m('wr')) { push('R'); i += 2; continue; }
      if (m('gh') && i + 2 === n) { i += 2; continue; }
      const dg = { ee: 'IY', ea: 'IY', oo: 'UW', ai: 'EY', ay: 'EY', oa: 'OW', ou: 'AW', oi: 'OY', oy: 'OY', au: 'AO', aw: 'AO', ie: 'IY', ar: null, or: null };
      if (m('ow')) { push(i + 2 === n ? 'OW' : 'AW'); i += 2; continue; }
      if (m('ey') && i + 2 === n) { push('IY'); i += 2; continue; }
      if (m('ue') && i + 2 === n) { push('UW'); i += 2; continue; }
      if (m('ar')) { push('AA', 'R'); i += 2; continue; }
      if (m('or')) { push('AO', 'R'); i += 2; continue; }
      if (m('er') || m('ir') || m('ur')) { push('ER'); i += 2; continue; }
      if (dg[c + nx]) { push(dg[c + nx]); i += 2; continue; }
      if (isV(c)) {
        if (c === 'e' && i === n - 1 && n > 2) { i++; continue; }
        const magic = nx && !isV(nx) && n2 === 'e' && i + 3 === n;
        const LONG = { a: 'EY', e: 'IY', i: 'AY', o: 'OW', u: 'UW' }, SHORT = { a: 'AE', e: 'EH', i: 'IH', o: 'AA', u: 'AH' };
        push(magic ? LONG[c] : SHORT[c]); i++; continue;
      }
      if (c === nx && !isV(c) && c !== 'c') { i++; continue; }
      switch (c) {
        case 'c': push('eiy'.includes(nx) ? 's' : 'k'); break;
        case 'g': push('eiy'.includes(nx) && nx !== '' ? 'J' : 'g'); break;
        case 'j': push('J'); break;
        case 'q': push('k'); break;
        case 'r': push('R'); break;
        case 'x': push('k', 's'); break;
        case 'y': if (i === 0) push('y'); else push(n <= 3 ? 'AY' : 'IY'); break;
        case 's': push(i + 1 === n && (isV(pv) || 'bdglmnrvz'.includes(pv)) ? 'z' : (isV(pv) && isV(nx) ? 'z' : 's')); break;
        default: if ('bdfhklmnpstvwz'.includes(c)) push(c);
      }
      i++;
    }
    return { ph: out, un: EN_FUNC.has(w) };
  }

  const FA_DIG = ['صفر', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'], EN_DIG = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  Object.assign(LEX_FA, {'صفر': 'sefr', 'چهار': 'cahAr', 'پنج': 'panj', 'شش': 'SeS', 'هفت': 'haft', 'هشت': 'haSt', 'ده': 'dah', 'یازده': 'yAzde', 'دوازده': 'davAzde', 'سیزده': 'sizde', 'چهارده': 'cahArde', 'پانزده': 'pAnzde', 'شانزده': 'SAnzde', 'هفده': 'hefde', 'هجده': 'heJde', 'نوزده': 'nuzde', 'بیست': 'bist', 'سی': 'si', 'چهل': 'cehel', 'پنجاه': 'panJAh', 'شصت': 'Sast', 'هفتاد': 'haftAd', 'هشتاد': 'haStAd', 'نود': 'navad', 'صد': 'sad', 'دویست': 'divist', 'سیصد': 'sisad', 'چهارصد': 'cahArsad', 'پانصد': 'pAnsad', 'ششصد': 'SeSsad', 'هفتصد': 'haftsad', 'هشتصد': 'haStsad', 'نهصد': 'nohsad', 'واحد': 'vAhed', 'بیشتر': 'biStar', 'افزایش': 'afzAyeS', 'مرحله': 'marhale', 'مرحلهٔ': 'marhaleye', 'آینه': 'Ayene', 'ربات': 'robAt', 'هرم': 'heram', 'هستم': 'hastam', 'بازتاب': 'bAztAb', 'وارد': 'vArid', 'می‌شود': 'miSavad', 'شود': 'Savad', 'الگو': 'olgu', 'قانون': 'qAnun', 'ساده': 'sAde', 'قبل': 'qabl', 'بعد': 'bad', 'رسیدیم': 'residim', 'چون': 'cun', 'بعدی': 'badi', 'اضافه': 'ezAfe', 'دقیقاً': 'daqiqan', 'حرکت': 'harekat', 'شتاب': 'setAb', 'ثابت': 'sAbet', 'فارسی': 'fArsi', 'انگلیسی': 'engelisi', 'آفلاین': 'AflAyn', 'سخنگو': 'soxangu', 'می‌رسد': 'mirasad', 'می‌خوانم': 'mixAnam', 'می‌توانم': 'mitavAnam', 'هم': 'ham', 'نیز': 'niz', 'بگویم': 'beguyam', 'دارم': 'dAram', 'اینترنت': 'internet', 'بدون': 'bedun', 'متن': 'matn', 'آوا': 'AvA', 'خوانم': 'xAnam'});
  Object.assign(LEX_FA, {'پلوتو': 'pluto', 'ماه': 'mAh', 'مریخ': 'marix', 'تیتان': 'titAn', 'ونوس': 'venus', 'زمین': 'zamin', 'تصویر': 'tasvir', 'خط': 'xat', 'گرانش': 'gerAneS', 'جهان‌ها': 'JahAnhA', 'تلویزیون‌ها': 'televiziyonhA', 'سایه': 'sAye', 'پیکسل': 'piksel', 'عروسکم': 'arusakam', 'تازه': 'tAze', 'ساخته': 'sAxte', 'هر': 'har', 'کنم': 'konam', 'می‌افتد': 'miofatad', 'می‌شود': 'miSavad', 'پهنای': 'pahnAye', 'باند': 'bAnd', 'کیلوهرتز': 'kilohertz', 'جدید': 'Jadid', 'شماره': 'SomAre', 'نقطه': 'noqte', 'نور': 'nur', 'سیاره': 'sayyAre', 'پرش': 'paraS', 'بلند': 'boland', 'کوتاه': 'kutAh', 'رادیو': 'rAdiyo', 'شنونده': 'Senavande'});
  const isFa = (w) => /[؀-ۿ]/.test(w);
  const g2p = (w) => (isFa(w) ? faG2P(w) : enG2P(w));
  const toLat = (s) => s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

  // ================= طرح آوایی: آوا ← حالت‌های پارامتری با مدت =================
  const cache = new Map();
  function tokenize(text) {
    const t = toLat(String(text));
    const toks = t.match(/[^\s،,.!?؟:;…؛\n]+|[،,.!?؟:;…؛\n]/g) || [];
    const out = [];
    toks.forEach((tok) => {
      if (/^\d+$/.test(tok)) { const fa = /[؀-ۿ]/.test(t); [...tok].forEach((d) => out.push(fa ? FA_DIG[+d] : EN_DIG[+d])); } else out.push(tok);
    });
    return out;
  }
  function st(o) { return Object.assign({ d: 0.05, av: 0, ah: 0, af: 0, fc: 5000, fb: 2000, F: NEUT, nas: 0, tr: 0.035, cp: false }, o); }

  function build(text, speed) {
    const sp = BZ.clamp(speed || 1, 0.5, 2), toks = tokenize(text);
    const states = [], accents = [], phrases = [];
    let phraseStart = 0, t = 0, wordsInPhrase = 0;
    const push = (s) => { s.t0 = t; t += s.d; states.push(s); return s; };
    const closePhrase = (q, ex) => { if (wordsInPhrase) phrases.push({ t0: phraseStart, t1: t, q, ex }); wordsInPhrase = 0; };
    toks.forEach((tok, ti) => {
      if (PAUSE[tok] !== undefined) {
        const q = tok === '?' || tok === '؟', ex = tok === '!';
        closePhrase(q, ex);
        push(st({ d: PAUSE[tok] / sp, tr: 0.01, sym: '_', pause: 1 }));
        phraseStart = t; return;
      }
      if (!wordsInPhrase) phraseStart = t;
      const { ph, un } = g2p(tok);
      if (!ph.length) return;
      wordsInPhrase++;
      // آخرین واکهٔ کلمه: تکیهٔ فارسی؛ نخستین واکهٔ انگلیسی (برای واژه‌های محتوایی)
      const fa = isFa(tok);
      const vi = ph.map((x, k) => (isVow(x.p) ? k : -1)).filter((k) => k >= 0);
      const stressIdx = un || !vi.length ? -1 : (fa ? vi[vi.length - 1] : vi[0]);
      const nextTok = toks[ti + 1], phraseFinal = !nextTok || PAUSE[nextTok] !== undefined;
      ph.forEach((x, k) => {
        const p = x.p, stressed = k === stressIdx, last = k === ph.length - 1;
        const dm = (stressed ? 1.15 : un ? 0.8 : 0.95) * (x.long ? 1.5 : 1) * (phraseFinal && k >= ph.length - 2 ? 1.25 : 1) / sp;
        if (V[p] || DIPH[p]) {
          const tg = DIPH[p] ? DIPH[p].map((q) => V[q]) : [V[p]], d = tg[0][3] / 1000 * dm;
          tg.forEach((v, z) => {
            const s = push(st({ d: d / tg.length * (DIPH[p] ? 1.3 : 1), av: 1, F: [v[0], v[1], v[2]], sym: p, vow: 1, stress: stressed, tr: 0.04 }));
            s.mouthV = VIS[p]; s.mouthO = OPEN[p] * (un ? 0.8 : 1);
            if (z === 0 && stressed) accents.push({ t: t - s.d * 0.5, a: 0.12 });
          });
        } else if (N[p]) {
          const s = push(st({ d: (p === 'N' ? 0.07 : 0.065) * (x.long ? 1.4 : 1) / sp, av: 0.55, F: N[p], nas: 1, sym: p, tr: 0.03 })); s.mouthV = CVIS[p] ? CVIS[p][0] : 'e'; s.mouthO = p === 'm' ? 0 : 0.22;
        } else if (LIQ[p]) {
          const l = LIQ[p], s = push(st({ d: l[3] * (x.long ? 1.4 : 1) / sp, av: p === 'r' ? 0.45 : 0.85, F: [l[0], l[1], l[2]], sym: p, tr: 0.025 })); s.mouthV = CVIS[p] ? CVIS[p][0] : 'e'; s.mouthO = CVIS[p] ? CVIS[p][1] : 0.25;
        } else if (FR[p]) {
          const f = FR[p], s = push(st({ d: f[4] * (x.long ? 1.4 : 1) / sp, av: f[3], af: f[2], fc: f[0], fb: f[1], F: f[3] ? [300, 1400, 2500] : NEUT, sym: p, tr: 0.015 })); s.mouthV = CVIS[p] ? CVIS[p][0] : 'e'; s.mouthO = CVIS[p] ? CVIS[p][1] : 0.22;
        } else if (p === 'h') {
          const s = push(st({ d: 0.07 / sp, ah: 0.6, sym: 'h', cp: true, tr: 0.02 })); s.mouthV = 'e'; s.mouthO = 0.3;
        } else if (p === '?') {
          const s = push(st({ d: 0.04 / sp, tr: 0.008, sym: '?' })); s.mouthV = 'e'; s.mouthO = 0.2;
        } else if (ST[p]) {
          const q = ST[p], vc = q[5], mv = CVIS[p] || ['e', 0.2];
          const a = push(st({ d: q[0] * (x.long ? 1.4 : 1) / sp, av: vc ? 0.22 : 0, F: [vc ? 250 : 400, q[4], 2300], sym: p, tr: 0.012 })); a.mouthV = mv[0]; a.mouthO = mv[1];
          const b = push(st({ d: 0.012 / sp, af: q[3], fc: q[1], fb: q[2], F: [400, q[4], 2300], tr: 0.001, sym: p })); b.mouthV = mv[0]; b.mouthO = mv[1] + 0.15;
          if (!vc && (!last || !phraseFinal)) { const c = push(st({ d: (stressed || k === 0 ? 0.03 : 0.012) / sp, ah: 0.5, cp: true, tr: 0.003, sym: p })); c.mouthV = mv[0]; c.mouthO = 0.3; }
        } else if (AFF[p]) {
          const q = AFF[p], vc = q[5];
          const a = push(st({ d: q[0] / sp, av: vc ? 0.22 : 0, F: [vc ? 250 : 400, 1800, 2400], tr: 0.012, sym: p })); a.mouthV = 'c'; a.mouthO = 0.22;
          const b = push(st({ d: q[4] / sp, av: vc ? 0.4 : 0, af: q[3], fc: q[1], fb: q[2], F: NEUT, tr: 0.002, sym: p })); b.mouthV = 'c'; b.mouthO = 0.25;
        }
      });
      push(st({ d: 0.03 / sp, tr: 0.01, sym: '_', pause: 1 }));
    });
    closePhrase(false, false);
    // ممیز: واکهٔ پس از h/انفجاری ← فرمانت همسایه
    states.forEach((s, i) => { if (s.cp) { const nx = states.slice(i + 1).find((q) => q.vow); if (nx) s.F = nx.F; } });
    const dur = Math.max(0.3, t + 0.12);
    // قطعات برای هماهنگی لب (کلیدفریم‌ها)
    const syl = states.filter((s) => !s.pause || true).map((s) => ({ t: s.t0, d: s.d, v: s.mouthV || 'e', o: s.pause ? 0 : (s.mouthO == null ? 0.2 : s.mouthO), c: s.sym, vow: !!s.vow }));
    const q = /[؟?]\s*$/.test(String(text).trim());
    return { states, syl, dur, q, accents, phrases, text: String(text), sp };
  }

  // آوانویسی خوانا (برای نمایش به کاربر)
  function transcribe(text) {
    const out = [];
    tokenize(text).forEach((tok) => { if (PAUSE[tok] !== undefined) { out.push(tok === '\n' ? '/' : tok); return; } const { ph } = g2p(tok); out.push(ph.map((x) => x.p).join(' ')); });
    return out.join('  ');
  }

  // ================= سنتزگر فرمانتی (Klatt 1980، ساده‌شده) =================
  const SR = 22050, FRM = 110; // ۵ میلی‌ثانیه
  function res(f, bw) { const C = -Math.exp(-2 * Math.PI * bw / SR), B = 2 * Math.exp(-Math.PI * bw / SR) * Math.cos(2 * Math.PI * f / SR); return { A: 1 - B - C, B, C, y1: 0, y2: 0 }; }
  function setRes(r, f, bw) { f = Math.min(f, SR * 0.45); const C = -Math.exp(-2 * Math.PI * bw / SR), B = 2 * Math.exp(-Math.PI * bw / SR) * Math.cos(2 * Math.PI * f / SR); r.A = 1 - B - C; r.B = B; r.C = C; }
  const run = (r, x) => { const y = r.A * x + r.B * r.y1 + r.C * r.y2; r.y2 = r.y1; r.y1 = y; return y; };
  const NUMK = ['av', 'ah', 'af', 'fc', 'fb', 'nas'];
  function paramsAt(states, t, idx) {
    while (idx.i < states.length - 1 && t >= states[idx.i].t0 + states[idx.i].d) idx.i++;
    const cur = states[idx.i], prev = states[idx.i - 1];
    const p = { av: cur.av, ah: cur.ah, af: cur.af, fc: cur.fc, fb: cur.fb, nas: cur.nas, F: cur.F.slice() };
    const x = t - cur.t0;
    if (prev && x < cur.tr) {
      const u = BZ.smooth(x / cur.tr);
      NUMK.forEach((k) => { if (k === 'fc' || k === 'fb') { if (prev.af > 0 && cur.af > 0) p[k] = prev[k] + (cur[k] - prev[k]) * u; } else p[k] = prev[k] + (cur[k] - prev[k]) * u; });
      for (let k = 0; k < 3; k++) p.F[k] = prev.F[k] + (cur.F[k] - prev.F[k]) * u;
    }
    return p;
  }
  const EMO = { happy: [1.1, 1.3], sad: [0.9, 0.65], angry: [1.02, 1.25], surprised: [1.15, 1.5], thinking: [0.97, 0.8], neutral: [1, 1] };
  function f0rel(plan, t, range) {
    let rel = 1;
    const ph = plan.phrases.find((p) => t >= p.t0 - 0.001 && t <= p.t1 + 0.001);
    if (ph) {
      const x = (t - ph.t0) / Math.max(0.2, ph.t1 - ph.t0);
      rel *= 1.1 - 0.24 * x;
      const tail = ph.t1 - t;
      if (ph.q && tail < 0.35) rel *= 1 + 0.45 * Math.pow(1 - tail / 0.35, 1.5);
      else if (tail < 0.18) rel *= 1 - 0.1 * (1 - tail / 0.18);
      if (ph.ex) rel *= 1.05;
    }
    plan.accents.forEach((a) => { const d = (t - a.t) / 0.09; if (Math.abs(d) < 3) rel *= 1 + a.a * Math.exp(-d * d); });
    return 1 + (rel - 1) * range;
  }
  function render(plan, voice) {
    voice = voice || {};
    const em = EMO[voice.em] || EMO.neutral, base = (voice.f0 || 180) * em[0], vt = voice.vt || 1, rob = !!voice.rob, range = rob ? 0.08 : em[1] * (voice.range || 1);
    const nf = Math.ceil(plan.dur * SR / FRM), n = nf * FRM, out = new Float32Array(n);
    const rnd = BZ.rng(BZ.hash(plan.text + '|' + base)), idx = { i: 0 };
    const R1 = res(500, 60), R2 = res(1500, 90), R3 = res(2500, 150), R4 = res(3500 * vt, 200), R5 = res(4500 * vt, 250), RN = res(270, 100), RF = res(5000, 2000);
    let phase = 0, gPrev = 0, jit = 1, wob = 0, hp = 0, pe1 = 0;
    const comb = new Float32Array(Math.round(SR / 110)); let cp = 0;
    for (let f = 0; f < nf; f++) {
      const t = (f + 0.5) * FRM / SR, p = paramsAt(plan.states, t, idx);
      wob += (rnd() - 0.5) * 0.004; wob *= 0.97;
      const f0 = base * f0rel(plan, t, range) * (1 + wob);
      setRes(R1, p.F[0] * vt, 60 + p.nas * 40); setRes(R2, p.F[1] * vt, 90); setRes(R3, p.F[2] * vt, 150); setRes(R4, 3500 * vt, 200); setRes(R5, 4500 * vt, 250);
      if (p.af > 0.01) setRes(RF, p.fc * Math.min(1.15, 0.9 + 0.1 * vt), Math.max(300, p.fb));
      for (let s = 0; s < FRM; s++) {
        let vs = 0;
        if (p.av > 0.01 || p.ah > 0.01) {
          phase += f0 / SR;
          if (phase >= 1) { phase -= 1; jit = 1 + (rnd() - 0.5) * 0.02; }
          const ph = phase, Tp = 0.42, Tn = 0.16;
          const g = ph < Tp ? 0.5 * (1 - Math.cos(Math.PI * ph / Tp)) : ph < Tp + Tn ? Math.cos(Math.PI * 0.5 * (ph - Tp) / Tn) : 0;
          vs = (g - gPrev) * 30 * p.av * jit; gPrev = g;
        } else gPrev = 0;
        const noise = rnd() * 2 - 1;
        let src = vs + noise * (p.ah * 4 + p.av * 0.25);
        let y = run(R5, run(R4, run(R3, run(R2, run(R1, src)))));
        if (p.nas > 0.01) y += run(RN, vs) * p.nas * 1.2;
        if (p.af > 0.01) y += run(RF, noise) * p.af * 3.5;
        // دیفرانسیل ملایم دهان (تابش لب) و فیلتر بالاگذر برای حذف DC
        const pe = y - 0.92 * pe1; pe1 = y; const hpf = pe - hp; hp += 0.02 * hpf;
        out[f * FRM + s] = hpf;
      }
    }
    if (rob) { for (let i = 0; i < n; i++) { const d = comb[cp]; const v = out[i] + 0.55 * d; comb[cp] = v; cp = (cp + 1) % comb.length; out[i] = v; } }
    // نرمال‌سازی و محو کوتاه ابتدا و انتها
    let pk = 1e-6; for (let i = 0; i < n; i++) { const a = Math.abs(out[i]); if (a > pk) pk = a; }
    const k = 0.9 / pk, fade = Math.round(SR * 0.006);
    for (let i = 0; i < n; i++) { let v = out[i] * k; if (i < fade) v *= i / fade; if (n - i < fade) v *= (n - i) / fade; out[i] = Math.tanh(v * 1.1) / Math.tanh(1.1); }
    return out;
  }

  const bufCache = new Map();
  function sampleKey(say) { return [say.t, say.sp || 1, Math.round(say.f0 || 180), say.vt || 1, say.em || 'n', say.rob ? 1 : 0].join('|'); }

  BZ.speech = {
    VOW: { a: { f1: 760, f2: 1250, mw: 1.0, mh: 1.0 }, e: { f1: 520, f2: 1800, mw: 0.95, mh: 0.55 }, i: { f1: 310, f2: 2250, mw: 1.2, mh: 0.3 }, o: { f1: 470, f2: 880, mw: 0.55, mh: 0.7 }, u: { f1: 330, f2: 800, mw: 0.4, mh: 0.45 }, m: { mw: 0.8, mh: 0.12 }, f: { mw: 1.05, mh: 0.2 }, s: { mw: 1.2, mh: 0.2 }, c: { mw: 0.6, mh: 0.35 } },
    SR,
    // طرح آوایی یک جمله (قطعی): {syl: کلیدفریم‌های لب, dur, q, ...}
    plan(text, speed) {
      const sp = BZ.clamp(speed || 1, 0.5, 2), key = sp + '|' + text;
      if (cache.has(key)) return cache.get(key);
      const p = build(text, sp);
      if (cache.size > 300) cache.clear();
      cache.set(key, p);
      return p;
    },
    transcribe,
    // دهان در لحظهٔ tl: درون‌یابی بین کلیدفریم‌های آوا
    mouthAt(syl, tl) {
      if (!syl.length) return { open: 0, v: 'e' };
      let i = 0; while (i < syl.length - 1 && tl >= syl[i + 1].t) i++;
      const s = syl[i];
      if (tl < s.t || tl > s.t + s.d + 0.15) return { open: 0, v: 'e' };
      const prev = syl[i - 1], u = BZ.smooth((tl - s.t) / Math.min(0.05, s.d)), po = prev && !prev.silent ? prev.o : 0;
      const open = po + (s.o - po) * u, nxt = syl[i + 1], fadeOut = !nxt || tl > s.t + s.d ? Math.max(0, 1 - (tl - s.t - s.d) / 0.15) : 1;
      return { open: Math.max(0, open * fadeOut), v: s.v };
    },
    render: (plan, voice) => render(plan, voice),
    // نمونه‌های صوتی یک گفتار (با کش)؛ say = {t, sp, f0, vt, em, rob}
    samples(say) {
      const key = sampleKey(say);
      let b = bufCache.get(key);
      if (!b) { b = render(BZ.speech.plan(say.t, say.sp || 1), { f0: say.f0, vt: say.vt, em: say.em, rob: say.rob }); if (bufCache.size > 60) bufCache.clear(); bufCache.set(key, b); }
      return b;
    },
    buffer(ctx, say) {
      const key = sampleKey(say) + '|' + ctx.sampleRate, hit = bufCache.get(key + '|ab');
      if (hit) return hit;
      const s = BZ.speech.samples(say), ab = ctx.createBuffer(1, s.length, SR);
      if (ab.copyToChannel) ab.copyToChannel(s, 0); else ab.getChannelData(0).set(s);
      bufCache.set(key + '|ab', ab); return ab;
    },
  };
})();

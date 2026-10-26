// Shared Hebrew Text-to-Speech utility.
//
// Desktop (Electron) : server proxy to Google Translate TTS, Web Speech fallback.
// Web (kidslearn.fun): the browser's own voices (Web Speech API). There is no
//   server, so the quality depends on which Hebrew voice the browser offers:
//   Edge ships neural voices (Hila / Avri "Natural"), Android Chrome has the
//   Google voice, Safari has Carmit, and plain Windows Chrome only has the old
//   SAPI "Asaf". We pick the best one available and let the parent override it.
//
// Realism on the web comes from two places: choosing the most natural voice,
// and rewriting the text into what a person would actually SAY — numbers as
// Hebrew words in the right gender ("שתי בננות", "שלוש ועוד ארבע"), no emoji,
// no "ילד/ה" slashes, "ש״ח" as "שקלים", a pause where the eye sees a dash.

let _currentAudio = null;
let _currentUtter = null;   // keep a reference: Chrome drops GC'd utterances mid-sentence
let _seqId = 0;             // monotonically increasing claim id for speech sequences

const WEB = import.meta.env.VITE_TARGET === 'web';

// ── Settings (web: device-local, chosen in the parents' area) ───────────────
const KEY_VOICE = 'kidslearn:tts:voiceURI';
const KEY_RATE = 'kidslearn:tts:rate';

function readLS(key) { try { return localStorage.getItem(key); } catch { return null; } }
function writeLS(key, v) { try { v == null ? localStorage.removeItem(key) : localStorage.setItem(key, String(v)); } catch {} }

/** The child's grammatical gender for cheers ("אלוף!" / "אלופה!"). */
let _gender = 'girl';
export function setSpeechGender(g) { _gender = g === 'boy' ? 'boy' : 'girl'; }

export function cleanForSpeech(text) {
  return String(text || '')
    .replace(/[_]+/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Hebrew number words ─────────────────────────────────────────────────────
const ONES_F = ['אפס', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];
const ONES_M = ['אפס', 'אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה'];
const TEENS_F = ['עשר', 'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה', 'שש עשרה', 'שבע עשרה', 'שמונה עשרה', 'תשע עשרה'];
const TEENS_M = ['עשרה', 'אחד עשר', 'שנים עשר', 'שלושה עשר', 'ארבעה עשר', 'חמישה עשר', 'שישה עשר', 'שבעה עשר', 'שמונה עשר', 'תשעה עשר'];
const TENS = ['', '', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'];
const HUNDREDS = ['', 'מאה', 'מאתיים', 'שלוש מאות', 'ארבע מאות', 'חמש מאות', 'שש מאות', 'שבע מאות', 'שמונה מאות', 'תשע מאות'];
const THOUSANDS = ['', 'אלף', 'אלפיים', 'שלושת אלפים', 'ארבעת אלפים', 'חמשת אלפים', 'ששת אלפים', 'שבעת אלפים', 'שמונת אלפים', 'תשעת אלפים'];

/**
 * 0..9999 → Hebrew words. `gender` 'f' (default — abstract counting and
 * arithmetic are feminine in Hebrew: "שלוש ועוד ארבע") or 'm'.
 * `construct` = the number stands before a noun ("שני ילדים", "שתי בננות").
 */
export function numberToHebrew(n, gender = 'f', construct = false) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n) || n < 0 || n > 9999) return String(n);
  const ones = gender === 'm' ? ONES_M : ONES_F;
  const teens = gender === 'm' ? TEENS_M : TEENS_F;
  if (n === 2 && construct) return gender === 'm' ? 'שני' : 'שתי';
  if (n < 10) return ones[n];
  if (n < 20) return teens[n - 10];
  const parts = [];
  const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), t = Math.floor((n % 100) / 10), o = n % 10;
  if (th) parts.push(THOUSANDS[th]);
  if (h) parts.push(HUNDREDS[h]);
  const rest = t * 10 + o;
  if (rest) {
    let tail;
    if (rest < 10) tail = ones[rest];
    else if (rest < 20) tail = teens[rest - 10];
    else tail = o ? `${TENS[t]} ו${ones[o]}` : TENS[t];
    parts.push(parts.length ? `ו${tail}` : tail);
  }
  return parts.join(' ');
}

// Plural nouns whose gender is NOT what their ending suggests.
const FEM_IN_IM = new Set(['אבנים', 'נשים', 'שנים', 'ביצים', 'מילים', 'פעמים', 'ערים', 'דרכים', 'רגליים', 'ידיים', 'עיניים', 'אוזניים', 'שיניים', 'נעליים', 'גרביים', 'צלעות']);
const MASC_IN_OT = new Set(['לוחות', 'קולות', 'שולחנות', 'ארונות', 'חלונות', 'מקומות', 'שבועות', 'לילות', 'אבות', 'רחובות', 'קירות', 'כיסאות', 'מזלגות', 'פירות', 'עפרונות', 'שעונות', 'וילונות', 'חודשות']);

/**
 * Grammatical gender of a PLURAL noun: 'm' | 'f' | null when the word is not a
 * plural noun (then the number is abstract → feminine, as in "שלוש ועוד ארבע").
 * Only plurals count: "נתנה 1 לגננת" must not read "לגננת" as the counted thing.
 */
function pluralGender(word) {
  if (!word) return null;
  const w = word.replace(/[^א-ת]/g, '');
  if (!w || w.length < 3) return null;
  if (FEM_IN_IM.has(w)) return 'f';
  if (MASC_IN_OT.has(w)) return 'm';
  if (/ות$/.test(w)) return 'f';
  if (/(ים|יים)$/.test(w)) return 'm';
  return null;
}

// Final letters turn regular when a suffix is glued on (מוכן/ה → מוכנה).
const UNFINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const unfinal = (w) => w.replace(/[ךםןףץ]$/, (c) => UNFINAL[c]);

// Slash pairs the suffix rule gets wrong.
const SLASH_SPECIAL = { 'את/ה': { boy: 'אתה', girl: 'את' }, 'אתה/את': { boy: 'אתה', girl: 'את' } };

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2190}-\u{21FF}\u{E000}-\u{F8FF}]|\u{FE0F}|\u{200D}|\u{20E3}/gu;

/**
 * Rewrite display text into natural spoken Hebrew. Pure, idempotent enough to
 * run on text that was already partly spoken-ready (e.g. mathSpeech output).
 */
export function toSpokenHebrew(text, gender = _gender) {
  // "15 ___ 9" (compare) — the blank means "compared to"; do it before the
  // generic cleaner turns underscores into spaces.
  let s = String(text || '').replace(/(\d)\s*_{2,}\s*(\d)/g, '$1 לעומת $2');
  s = cleanForSpeech(s);
  if (!s) return '';

  // 1. Emoji and pictographs are read aloud by some voices ("red apple") — drop them.
  s = s.replace(EMOJI_RE, ' ');

  // 2. Gendered slashes: ילד/ה, לומד/ת, נסה/י, מוכן/ה → the child's form.
  s = s.replace(/([א-ת]+)\/(ה|ת|י|ית|ים|ות)(?![א-ת])/g, (m, base, suf) => {
    const special = SLASH_SPECIAL[m];
    if (special) return special[gender === 'boy' ? 'boy' : 'girl'];
    if (gender === 'boy') return base;
    if (suf === 'י' && /ה$/.test(base)) return base.slice(0, -1) + 'י';   // נסה/י → נסי
    return unfinal(base) + suf;
  });

  // 3. Currency and common abbreviations.
  s = s.replace(/ש[״"']ח/g, 'שקלים').replace(/(^|\s)שח(?=\s|$|[.,?!])/g, '$1שקלים');

  // 4. Clock times "3:00" → "שלוש", "3:30" → "שלוש וחצי", "3:15" → "שלוש ורבע"
  //    (before the arithmetic pass, which would read ":" as division).
  s = s.replace(/(?<!\d)(\d{1,2}):(00|15|30|45)(?!\d)/g, (m, h, mm) => {
    const hour = numberToHebrew(Number(h), 'f');
    return mm === '00' ? hour : mm === '30' ? `${hour} וחצי` : mm === '15' ? `${hour} ורבע` : `רבע ל${numberToHebrew((Number(h) % 12) + 1, 'f')}`;
  });

  // 5. Arithmetic symbols (mathSpeech handles ltr questions; this covers hints
  //    and rtl questions like "4 + 4 + 4 = ?" or "134 = ? + 30 + 4").
  const NUM = '(\\d+|כמה)';
  s = s
    .replace(/\?(?=\s*[=+\-×x*:])/g, 'כמה')                // "? + 7" → "כמה ועוד 7"
    .replace(/(?<=[=+\-×x*:]\s*)\?/g, 'כמה')               // "7 = ?" → "7 שווה כמה"
    .replace(new RegExp(`${NUM}\\s*\\+\\s*(?=\\d|כמה)`, 'g'), '$1 ועוד ')
    .replace(new RegExp(`${NUM}\\s*[×x*]\\s*(?=\\d|כמה)`, 'g'), '$1 כפול ')
    .replace(new RegExp(`${NUM}\\s*:\\s*(?=\\d|כמה)`, 'g'), '$1 לחלק ל')
    .replace(new RegExp(`${NUM}\\s*-\\s*(?=\\d|כמה)`, 'g'), '$1 פחות ')
    .replace(new RegExp(`${NUM}\\s*=\\s*(?=\\d|כמה)`, 'g'), '$1 שווה ')
    .replace(/(\d)\s*>\s*(\d)/g, '$1 גדול מ-$2')
    .replace(/(\d)\s*<\s*(\d)/g, '$1 קטן מ-$2');

  // 6. Numbers → words, agreeing with the plural noun that follows ("שתי בננות",
  //    "חמישה שקלים"); with no noun after, the last plural noun in the sentence
  //    decides ("9 ממתקים … עוד 11" → "אחד עשר"); otherwise abstract feminine.
  //    Prefix letters glued with a hyphen ("ל-10", "מ-3", "ב-5") stay glued.
  //    The "next word" must be a real word (2+ letters) so "מ-5 ל-10" does not
  //    swallow the "ל" of the second number as a noun.
  s = s.replace(/(?:([בלמוכשה])-)?(\d{1,4})(?!\d)(\s+[א-ת]{2,})?/g, (m, prefix, num, nextRaw, offset, whole) => {
    const n = Number(num);
    const next = nextRaw ? nextRaw.trim() : '';
    let g = pluralGender(next);
    if (!g) {
      // "ליקט עוד 11" — the counted noun came earlier in the sentence; only
      // this "עוד N" shape looks back, so "מ-5 ל-10" stays abstract (feminine).
      const before = whole.slice(0, offset).split(/[.?!]/).pop() || '';
      if (/(^|\s)ו?עוד\s*$/.test(before)) {
        const anchor = before.split(/\s+/).reverse().find(w => pluralGender(w));
        g = anchor ? pluralGender(anchor) : null;
      }
    }
    const words = numberToHebrew(n, g || 'f', !!pluralGender(next));
    const out = prefix ? `${prefix}${words}` : words;
    return next ? `${out} ${next}` : out;
  });

  // 7. Prosody: dashes become short pauses, stray punctuation is tidied.
  s = s
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\.{3}/g, '.')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return s;
}

// ── Voice selection (web) ───────────────────────────────────────────────────
let _voicesPromise = null;
function getVoicesAsync() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  if (!_voicesPromise) {
    _voicesPromise = new Promise(resolve => {
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(window.speechSynthesis.getVoices()); };
      window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
      setTimeout(finish, 1500);   // some browsers never fire the event
    });
  }
  return _voicesPromise;
}
// Kick off voice loading early so the first question doesn't wait for it.
if (WEB && typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try { window.speechSynthesis.getVoices(); } catch {}
}

const isHebrewVoice = (v) => /^(he|iw)(-|_|$)/i.test(v.lang || '');
const isEnglishVoice = (v) => /^en(-|_|$)/i.test(v.lang || '');

/** Higher = more natural. Neural voices first, then the platform voices, legacy SAPI last. */
function voiceScore(v) {
  const name = (v.name || '').toLowerCase();
  let score = 0;
  if (/natural|neural|online/.test(name)) score += 100;      // Edge neural (Hila, Avri)
  if (/hila|avri/.test(name)) score += 20;
  if (/google/.test(name)) score += 80;                      // Android / Chrome OS
  if (/carmit/.test(name)) score += 70;                      // Apple
  if (/premium|enhanced/.test(name)) score += 15;
  if (v.localService === false) score += 5;
  if (/asaf/.test(name)) score -= 10;                        // old Windows SAPI voice
  if (/^(he|iw)[-_]il$/i.test(v.lang || '')) score += 3;
  return score;
}

export async function listHebrewVoices() {
  const voices = await getVoicesAsync();
  return voices.filter(isHebrewVoice)
    .sort((a, b) => voiceScore(b) - voiceScore(a))
    .map(v => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang, natural: voiceScore(v) >= 70 }));
}

export function getTtsSettings() {
  const rate = Number(readLS(KEY_RATE));
  return { voiceURI: readLS(KEY_VOICE) || '', rate: rate >= 0.6 && rate <= 1.3 ? rate : 1 };
}
export function saveTtsSettings({ voiceURI, rate } = {}) {
  if (voiceURI !== undefined) writeLS(KEY_VOICE, voiceURI || null);
  if (rate !== undefined) writeLS(KEY_RATE, rate);
}

// Voices that failed to produce sound in this session (never started, or
// errored). They are skipped for the rest of the session so every question
// does not pay the same timeout again.
const _badVoices = new Set();

// Last few speech events, shown in the parents' voice section so a problem
// ("the site stopped talking") can be diagnosed from the family's own browser.
const _status = [];
function note(msg) {
  _status.push(`${new Date().toLocaleTimeString('he-IL')} ${msg}`);
  if (_status.length > 6) _status.shift();
}
export function getTtsStatus() { return [..._status]; }

async function pickVoice(lang) {
  const voices = (await getVoicesAsync()).filter(v => !_badVoices.has(v.voiceURI));
  if (!voices.length) return null;
  if (lang === 'he') {
    const wanted = readLS(KEY_VOICE);
    if (wanted) {
      const v = voices.find(x => x.voiceURI === wanted);
      if (v) return v;
    }
    const he = voices.filter(isHebrewVoice);
    if (!he.length) return null;
    return he.sort((a, b) => voiceScore(b) - voiceScore(a))[0];
  }
  const en = voices.filter(isEnglishVoice);
  if (!en.length) return null;
  const s = (v) => voiceScore(v) + (/^en[-_]us$/i.test(v.lang) ? 4 : 0) + (/^en[-_]gb$/i.test(v.lang) ? 2 : 0);
  return en.sort((a, b) => s(b) - s(a))[0];
}

// How long we wait for the voice to actually START before declaring it dead
// and moving to the next one. Edge's online voices need a network round trip.
const START_TIMEOUT_MS = 3000;
const MAX_VOICE_ATTEMPTS = 3;

function speakViaWebAPI(text, lang = 'he', onEnd = null, attempt = 0) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) { onEnd?.(); return; }
  const cleaned = WEB && lang !== 'en' ? toSpokenHebrew(text) : cleanForSpeech(text);
  if (!cleaned) { onEnd?.(); return; }
  const ss = window.speechSynthesis;
  const seq = _seqId;
  // Only interrupt when something is actually playing: Edge's online
  // ("Natural") voices can go silent for the rest of the page after a
  // cancel(), so an idle engine is left alone.
  if (ss.speaking || ss.pending) ss.cancel();
  pickVoice(lang === 'en' ? 'en' : 'he').then(voice => {
    if (seq !== _seqId) { onEnd?.(); return; }   // superseded while voices loaded
    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.lang = lang === 'en' ? 'en-US' : 'he-IL';
    const natural = voice ? voiceScore(voice) >= 70 : false;
    const { rate } = getTtsSettings();
    // Neural voices sound best untouched; legacy voices get a little slower
    // and a touch brighter, which hides some of their roughness for a child.
    utter.rate = natural ? rate : Math.min(rate, 0.92);
    utter.pitch = natural ? 1 : 1.05;
    utter.volume = 1;
    if (voice) { utter.voice = voice; utter.lang = voice.lang; }

    let started = false;
    let settled = false;
    let watchdog = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      if (_currentUtter === utter) _currentUtter = null;
      onEnd?.();
    };
    // The chosen voice produced nothing: blacklist it for this session and
    // say the same text with the next-best voice (finally: no voice, lang only).
    const giveUpOnVoice = (why) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      if (_currentUtter === utter) _currentUtter = null;
      note(`הקול "${voice ? voice.name : 'ברירת מחדל'}" לא ניגן (${why})`);
      console.warn('[TTS] voice failed:', voice?.name, why);
      if (voice) _badVoices.add(voice.voiceURI);
      if (seq === _seqId && attempt + 1 < MAX_VOICE_ATTEMPTS && (voice || attempt === 0)) {
        speakViaWebAPI(text, lang, onEnd, attempt + 1);
      } else {
        onEnd?.();
      }
    };
    utter.onstart = () => { started = true; clearTimeout(watchdog); if (attempt > 0 || !_status.length) note(`מדבר עם "${voice ? voice.name : 'ברירת מחדל'}"`); };
    utter.onend = finish;
    utter.onerror = (e) => {
      const reason = e?.error || 'error';
      if (reason === 'interrupted' || reason === 'canceled') return finish();   // we cancelled it ourselves
      giveUpOnVoice(reason);
    };
    _currentUtter = utter;
    // A tiny delay after cancel() avoids the Chrome bug where the new utterance
    // is swallowed; resume() clears the "stuck paused" state Chrome sometimes
    // keeps after a cancel.
    setTimeout(() => {
      if (seq !== _seqId) { onEnd?.(); return; }
      try { ss.resume(); } catch {}
      ss.speak(utter);
      watchdog = setTimeout(() => { if (!started && seq === _seqId) { try { ss.cancel(); } catch {} giveUpOnVoice('לא התחיל'); } }, START_TIMEOUT_MS);
    }, 40);
  });
}

export function stopSpeech() {
  _seqId++;   // invalidate any running speakParts sequence / pending voice pick
  if (_currentAudio) {
    try { _currentAudio.pause(); } catch {}
    _currentAudio = null;
  }
  _currentUtter = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const ss = window.speechSynthesis;
    if (ss.speaking || ss.pending) ss.cancel();   // see speakViaWebAPI: never cancel an idle engine
  }
}

// `interrupt: false` lets the sequence player chain parts without each part
// cancelling the previous one; `onEnd` fires when this part finishes.
function speakText(text, lang, { interrupt = true, onEnd = null } = {}) {
  const cleaned = cleanForSpeech(text);
  if (!cleaned) { onEnd?.(); return; }

  if (interrupt) stopSpeech();

  // The static web version has no server TTS proxy – use the browser voice.
  if (WEB) {
    speakViaWebAPI(text, lang, onEnd);
    return;
  }

  const url = `/api/tts?text=${encodeURIComponent(cleaned)}${lang === 'en' ? '&lang=en' : ''}`;
  const audio = new Audio(url);
  audio.preload = 'auto';
  _currentAudio = audio;

  audio.onended = () => { if (onEnd) onEnd(); };

  audio.play().catch(err => {
    console.warn('[TTS] online failed, trying Web Speech API:', err?.message || err);
    speakViaWebAPI(text, lang, onEnd);
  });

  audio.onerror = () => {
    console.warn('[TTS] audio playback error – falling back to Web Speech API');
    speakViaWebAPI(text, lang, onEnd);
  };
}

export function speakHebrew(text) {
  speakText(text, 'he');
}

/** Speak English text with an English voice – used by the English exercises. */
export function speakEnglish(text) {
  speakText(text, 'en');
}

/**
 * Speak several parts back-to-back, each in its own language, e.g. the Hebrew
 * question followed by the English word — so a child who can't read yet hears
 * the WHOLE exercise. A new call (or any speak*) cancels the running sequence.
 */
export function speakParts(parts) {
  const list = (parts || []).filter(p => p && cleanForSpeech(p.text));
  if (!list.length) return;
  stopSpeech();                 // also invalidates any previous sequence
  const seq = _seqId;           // our claim on the speech channel
  const playNext = (i) => {
    if (seq !== _seqId || i >= list.length) return;   // superseded or done
    speakText(list[i].text, list[i].lang, {
      interrupt: false,
      onEnd: () => setTimeout(() => playNext(i + 1), 250),   // small natural pause
    });
  };
  playNext(0);
}

// Cheers and encouragement agree with the child's gender — a boy hearing
// "אלופה, את גאונה" every day is exactly the "broken Hebrew" parents notice.
const CHEERS = {
  girl: ['כל הכבוד!', 'מצוין!', 'יופי!', 'נכון מאוד!', 'אלופה!', 'יפה מאוד!', 'ענית נכון!', 'וואו, איזה כיף!', 'מדהים!', 'את גאונה!', 'בדיוק כך!'],
  boy:  ['כל הכבוד!', 'מצוין!', 'יופי!', 'נכון מאוד!', 'אלוף!', 'יפה מאוד!', 'ענית נכון!', 'וואו, איזה כיף!', 'מדהים!', 'אתה גאון!', 'בדיוק כך!'],
};
const ENCOURAGE = {
  girl: ['נסי שוב, את יכולה!', 'כמעט! עוד ניסיון.', 'אל תוותרי, נסי שוב.', 'את על הדרך הנכונה!', 'חושבים רגע ומנסים שוב.'],
  boy:  ['נסה שוב, אתה יכול!', 'כמעט! עוד ניסיון.', 'אל תוותר, נסה שוב.', 'אתה על הדרך הנכונה!', 'חושבים רגע ומנסים שוב.'],
};
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Speak the answer (full word for completion exercises) plus a random cheer.
 * Used when the child answers correctly.
 */
export function speakCelebration(answerText, gender = _gender) {
  const cheer = pickOne(CHEERS[gender === 'boy' ? 'boy' : 'girl']);
  const t = answerText ? `${answerText}! ${cheer}` : cheer;
  speakHebrew(t);
}

/** Encourage the child after a wrong answer. */
export function speakEncouragement(gender = _gender) {
  speakHebrew(pickOne(ENCOURAGE[gender === 'boy' ? 'boy' : 'girl']));
}

/** A sample sentence for the voice picker in the parents' area. */
export function speakSample(gender = _gender) {
  const name = gender === 'boy' ? 'אלוף' : 'אלופה';
  speakHebrew(`שלום! בואו נתרגל חשבון. לדנה היו 5 בלונים והיא קיבלה עוד 3. כמה בלונים יש לה עכשיו? נכון, 8! ${name}!`);
}

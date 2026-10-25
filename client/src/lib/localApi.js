// Browser-only data layer for the static web version (no server).
// Mirrors the server's storage.js logic using localStorage, and generates
// exercises in-browser with the same pure generators the server uses.

import { generateMathExercises, generatePrepMath, generateTopicMath } from '../../../server/exercises/mathGenerator.js';
import { generateHebrewExercises } from '../../../server/exercises/hebrewGenerator.js';
import { generateEnglishExercises, ABC_TYPES } from '../../../server/exercises/englishGenerator.js';
import {
  sanitizeGrade, sanitizeEnglishLevel, sanitizeHebrewLevel, sanitizeMathStage, foldSession,
  sanitizeDailyPlan, sanitizePlanUntil, migratePlanUntil, planIsActive, fitSessionToCount,
} from '../../../server/exercises/curriculum.js';
import { pickNewSticker, computePracticeStreak, computeAchievements } from '../../../server/exercises/rewards.js';
import { computeInsights } from '../../../server/exercises/insights.js';
import { pickLessonForSession, experiencedFamilies } from '../../../server/exercises/lessons.js';
import { getWorkbook } from '../../../server/exercises/workbooks.js';

const K = {
  history: 'kidslearn:history',
  review: 'kidslearn:review',
  children: 'kidslearn:children',
  progress: 'kidslearn:progress',
  mistakes: 'kidslearn:mistakes',
  rewards: 'kidslearn:rewards',
  users: 'kidslearn:users',
};

// No children ship with the app – each family creates their own profiles.
const DEFAULT_CHILDREN = [];

const VALID_SUBJECTS = ['math', 'hebrew', 'english'];
const VALID_MATH_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function sanitizeSubjects(subjects, fallbackSubject) {
  const arr = (Array.isArray(subjects) ? subjects : []).filter(s => VALID_SUBJECTS.includes(s));
  const unique = [...new Set(arr)];
  if (unique.length) return unique;
  return [fallbackSubject === 'hebrew' ? 'hebrew' : 'math'];
}
function sanitizeLevel(level) {
  const n = Number(level);
  return VALID_MATH_LEVELS.includes(n) ? n : null;
}
function normalizeChild(c) {
  if (!c || typeof c !== 'object') return c;
  const subjects = sanitizeSubjects(c.subjects, c.subject);
  return {
    ...c, subjects, subject: subjects[0],
    mathLevel: sanitizeLevel(c.mathLevel),
    grade: sanitizeGrade(c.grade),
    englishLevel: sanitizeEnglishLevel(c.englishLevel),
    hebrewLevel: sanitizeHebrewLevel(c.hebrewLevel),
    mathStage: sanitizeMathStage(c.mathStage),
    dailyPlan: sanitizeDailyPlan(c.dailyPlan),
    planUntil: migratePlanUntil(c.planUntil),
    allowMulDiv: !!c.allowMulDiv,   // multiplication & division off until parent enables
    hideEnglish: !!c.hideEnglish,
    hideEnglishLetters: !!c.hideEnglishLetters, // English stays, ABC letter drills hidden
  };
}

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Children ────────────────────────────────────────────────────────────
function readChildren() {
  const list = read(K.children, null);
  return Array.isArray(list) && list.length ? list.map(normalizeChild) : [...DEFAULT_CHILDREN];
}
function getChildProfile(id) {
  return readChildren().find(c => c.id === id) || null;
}

export async function fetchChildren() {
  const today = new Date().toISOString().slice(0, 10);
  return { children: readChildren().map(c => ({ ...c, todayPlan: getPlanStatus(c, today) })) };
}

export async function addChild({ name, gender, subject, subjects, mathLevel, grade, englishLevel, hebrewLevel, mathStage, dailyPlan, planUntil, allowMulDiv, hideEnglish, hideEnglishLetters, avatar, photo }) {
  const list = readChildren();
  let n = 1;
  while (list.some(c => c.id === `kid_${n}`)) n++;
  const subs = sanitizeSubjects(subjects, subject);
  const child = {
    id: `kid_${n}`,
    name: String(name || '').trim() || 'ילד/ה',
    gender: gender === 'girl' ? 'girl' : 'boy',
    subjects: subs,
    subject: subs[0],
    mathLevel: sanitizeLevel(mathLevel),
    grade: sanitizeGrade(grade),
    englishLevel: sanitizeEnglishLevel(englishLevel),
    hebrewLevel: sanitizeHebrewLevel(hebrewLevel),
    mathStage: sanitizeMathStage(mathStage),
    dailyPlan: sanitizeDailyPlan(dailyPlan),
    planUntil: sanitizePlanUntil(planUntil),
    allowMulDiv: !!allowMulDiv,
    hideEnglish: !!hideEnglish,
    hideEnglishLetters: !!hideEnglishLetters,
    avatar: avatar || '',
    photo: photo || '',
    builtin: false,
  };
  list.push(child);
  write(K.children, list);
  return { ok: true, child };
}

export async function updateChild(id, { name, gender, subject, subjects, mathLevel, grade, englishLevel, hebrewLevel, mathStage, dailyPlan, planUntil, allowMulDiv, hideEnglish, hideEnglishLetters, avatar, photo }) {
  const list = readChildren();
  const child = list.find(c => c.id === id);
  if (!child) throw new Error('הילד לא נמצא');
  if (name !== undefined) child.name = String(name).trim() || child.name;
  if (gender !== undefined) child.gender = gender === 'girl' ? 'girl' : 'boy';
  if (subjects !== undefined) {
    child.subjects = sanitizeSubjects(subjects, child.subject);
    child.subject = child.subjects[0];
  } else if (subject !== undefined) {
    child.subjects = sanitizeSubjects([subject], subject);
    child.subject = child.subjects[0];
  }
  if (mathLevel !== undefined) child.mathLevel = sanitizeLevel(mathLevel);
  if (grade !== undefined) child.grade = sanitizeGrade(grade);
  if (englishLevel !== undefined) child.englishLevel = sanitizeEnglishLevel(englishLevel);
  if (hebrewLevel !== undefined) child.hebrewLevel = sanitizeHebrewLevel(hebrewLevel);
  if (mathStage !== undefined) child.mathStage = sanitizeMathStage(mathStage);
  if (dailyPlan !== undefined) child.dailyPlan = sanitizeDailyPlan(dailyPlan);
  if (planUntil !== undefined) child.planUntil = sanitizePlanUntil(planUntil);
  if (allowMulDiv !== undefined) child.allowMulDiv = !!allowMulDiv;
  if (hideEnglish !== undefined) child.hideEnglish = !!hideEnglish;
  if (hideEnglishLetters !== undefined) child.hideEnglishLetters = !!hideEnglishLetters;
  if (avatar !== undefined) child.avatar = avatar;
  if (photo !== undefined) child.photo = photo;
  write(K.children, list);
  return { ok: true, child };
}

export async function deleteChild(id) {
  const list = readChildren();
  const child = list.find(c => c.id === id);
  if (!child) throw new Error('הילד לא נמצא');
  write(K.children, list.filter(c => c.id !== id));
  return { ok: true };
}

// ── Review queue ────────────────────────────────────────────────────────
// Resurfaced wrong answers are scoped per child AND subject.
const reviewKey = (child, subject) => `${child}:${subject || 'math'}`;

function popReviewQueue(child, count) {
  const data = read(K.review, {});
  const queue = data[child] || [];
  const taken = queue.splice(0, count);
  data[child] = queue;
  write(K.review, data);
  return taken;
}
function addWrongToReviewQueue(child, results) {
  const wrong = results
    .filter(r => r.firstAttemptCorrect === false && r.exerciseSnapshot)
    .map(r => r.exerciseSnapshot);
  if (!wrong.length) return;
  const data = read(K.review, {});
  if (!data[child]) data[child] = [];
  data[child].push(...wrong);
  data[child] = data[child].slice(-30);
  write(K.review, data);
}

// ── Adaptive progress (mirrors server/storage.js) ───────────────────────
const progressKey = (child, subject) => `${child}:${subject || 'math'}`;

function getProgress(child, subject) {
  const rec = read(K.progress, {})[progressKey(child, subject)];
  return {
    stage: rec?.stage || 1,
    streak: rec?.streak || 0,
    lastDate: rec?.lastDate || null,
    lastDateSuccess: rec?.lastDateSuccess || false,
  };
}

function applySessionProgress(profile, subject, date, results) {
  const record = getProgress(profile.id, subject);
  // Each subject starts at the parent-chosen level; the record never trails it.
  if (subject === 'english') {
    record.stage = Math.max(record.stage, sanitizeEnglishLevel(profile.englishLevel));
  } else if (subject === 'hebrew') {
    record.stage = Math.max(record.stage, sanitizeHebrewLevel(profile.hebrewLevel));
  } else if (profile.grade) {
    record.stage = Math.max(record.stage, sanitizeMathStage(profile.mathStage));
  }
  const { record: next, levelUp } = foldSession(profile, subject, record, date, results);

  const all = read(K.progress, {});
  all[progressKey(profile.id, subject)] = next;
  write(K.progress, all);

  if (levelUp?.mode === 'level') {
    const list = readChildren();
    const child = list.find(c => c.id === profile.id);
    if (child) { child.mathLevel = levelUp.level; write(K.children, list); }
  }
  const adaptive = !!profile.grade || (subject !== 'hebrew' && !!profile.mathLevel);
  return { stage: next.stage, streak: next.streak, lastDateSuccess: next.lastDateSuccess, levelUp, adaptive };
}

// ── Daily plan (mirrors server/storage.js) ──────────────────────────────
function countTodayExercises(child, subject, date) {
  let n = 0;
  for (const s of readHistory()[child] || []) {
    if (s.date !== date) continue;
    if ((s.subject || 'math') !== subject) continue;
    n += (s.results || []).length;
  }
  return n;
}

function getPlanStatus(profile, date) {
  if (!planIsActive(profile, date)) return null;
  const subjects = Object.entries(profile.dailyPlan)
    .filter(([subject]) => !(subject === 'english' && profile.hideEnglish))
    .map(([subject, target]) => ({
    subject, target, done: countTodayExercises(profile.id, subject, date),
  }));
  // Sticker = per-day completion lock: raising the quota mid-day never
  // "un-completes" a day that was already finished (mirrors server/storage.js).
  const rec = read(K.rewards, {})[profile.id];
  // Only the DAILY sticker locks a day as complete — a magic-box bonus is a
  // gift, not evidence the child practised (mirrors server/storage.js).
  const lockedComplete = !!(rec?.stickers || []).some(s => s.date === date && !s.bonus);
  return {
    date,
    until: profile.planUntil,
    subjects,
    complete: lockedComplete || subjects.every(s => s.done >= s.target),
    lockedComplete,
  };
}

// ── Rewards (mirrors server/storage.js) ─────────────────────────────────
function maybeAwardSticker(profile, date, planStatus) {
  const all = read(K.rewards, {});
  const rec = all[profile.id] || { stickers: [] };
  // One DAILY sticker per day; a magic-box bonus must not use up the chance.
  if (rec.stickers.some(s => s.date === date && !s.bonus)) return null;
  if (planIsActive(profile, date) && !planStatus?.complete) return null;
  const emoji = pickNewSticker(rec.stickers.map(s => s.emoji));
  rec.stickers.push({ emoji, date });
  all[profile.id] = rec;
  write(K.rewards, all);
  return emoji;
}

export async function fetchInsights(child) {
  const profile = getChildProfile(child);
  if (!profile) throw new Error('Unknown child');
  const sessions = readHistory()[child] || [];
  const stages = {};
  for (const s of profile.subjects) {
    const p = getProgress(child, s);
    stages[s] = s === 'english'
      ? Math.max(p.stage, profile.englishLevel || 1)
      : s === 'hebrew'
        ? Math.max(p.stage, profile.hebrewLevel || 1)
        : Math.max(p.stage, profile.mathStage || 1);
  }
  return { child, insights: computeInsights({ profile, sessions, stages }) };
}

export async function fetchRewards(child) {
  const sessions = readHistory()[child] || [];
  const stickers = (read(K.rewards, {})[child] || { stickers: [] }).stickers;
  const today = new Date().toISOString().slice(0, 10);
  const stars = sessions.reduce((n, s) =>
    n + (s.results || []).filter(r => r.firstAttemptCorrect !== false && r.correct).length, 0);
  const streak = computePracticeStreak(sessions.map(s => s.date), today);
  return {
    child, stars, streak, stickers,
    achievements: computeAchievements({ sessions, stickers, streak }),
  };
}

// ── Mistakes collection (mirrors server/storage.js) ─────────────────────
const MISTAKES_CAP = 60;
const mistakeKey = (ex) => `${ex.type}|${ex.question}`;

function foldResultsIntoMistakes(list, results) {
  for (const r of results || []) {
    if (r.firstAttemptCorrect === false && r.exerciseSnapshot) {
      const key = mistakeKey(r.exerciseSnapshot);
      const existing = list.find(m => mistakeKey(m.exercise) === key);
      if (existing) {
        existing.wrongCount += 1;
        existing.lastWrongAt = new Date().toISOString();
      } else {
        list.push({ exercise: r.exerciseSnapshot, wrongCount: 1, lastWrongAt: new Date().toISOString() });
      }
    } else if (r.firstAttemptCorrect !== false && r.correct) {
      const key = `${r.type}|${r.question}`;
      const idx = list.findIndex(m => mistakeKey(m.exercise) === key);
      if (idx >= 0) list.splice(idx, 1);
    }
  }
  return list.slice(-MISTAKES_CAP);
}

function getMistakesList(child, subject) {
  const all = read(K.mistakes, {});
  const key = progressKey(child, subject);
  if (all[key] === undefined) {
    let list = [];
    for (const s of readHistory()[child] || []) {
      if ((s.subject || 'math') !== subject) continue;
      list = foldResultsIntoMistakes(list, s.results);
    }
    all[key] = list;
    write(K.mistakes, all);
  }
  return all[key];
}

function updateMistakes(child, subject, results) {
  const list = getMistakesList(child, subject);
  const all = read(K.mistakes, {});
  all[progressKey(child, subject)] = foldResultsIntoMistakes(list, results);
  write(K.mistakes, all);
}

export async function fetchMistakes(child) {
  const profile = getChildProfile(child);
  if (!profile) throw new Error('Unknown child');
  const mistakes = {};
  for (const s of profile.subjects.filter(x => !(x === 'english' && profile.hideEnglish))) {
    mistakes[s] = getMistakesList(child, s);
    if (s === 'english' && profile.hideEnglishLetters)
      mistakes[s] = mistakes[s].filter(m => !ABC_TYPES.includes(m.exercise?.type));
  }
  return { child, mistakes };
}

// ── History / weakness / stats ──────────────────────────────────────────
function readHistory() {
  return read(K.history, {});
}

function computeWeakness(child, lookback = 5) {
  const sessions = (readHistory()[child] || []).slice(-lookback);
  const stats = {};
  for (const session of sessions) {
    for (const r of session.results || []) {
      if (!stats[r.type]) stats[r.type] = { wrong: 0, total: 0 };
      stats[r.type].total++;
      const hadMistake = r.firstAttemptCorrect === false || r.correct === false;
      if (hadMistake) stats[r.type].wrong++;
    }
  }
  const weakness = {};
  for (const [type, s] of Object.entries(stats)) {
    weakness[type] = s.total > 0 ? s.wrong / s.total : 0;
  }
  return weakness;
}

export async function fetchExercises(child, date, subject, operation = 'mix') {
  const profile = getChildProfile(child);
  if (!profile) throw new Error('Unknown child');
  const enabledSubjects = profile.subjects.filter(x => !(x === 'english' && profile.hideEnglish));
  const chosen = enabledSubjects.includes(subject) ? subject : enabledSubjects[0];
  // 'topic:clock' = focused practice; 'book:clock' = interactive workbook
  // (teaching pages + guided practice). Neither consumes the review queue.
  const opStr = String(operation || '');
  const topicId = opStr.startsWith('topic:') ? opStr.slice(6) : null;
  const bookId = opStr.startsWith('book:') ? opStr.slice(5) : null;
  const focusId = topicId || bookId;
  const weakness = computeWeakness(child);
  let reviewExercises = focusId ? [] : popReviewQueue(reviewKey(child, chosen), 3);
  // A hidden topic must not sneak back in through resurfaced review questions.
  if (chosen === 'english' && profile.hideEnglishLetters)
    reviewExercises = reviewExercises.filter(r => !ABC_TYPES.includes(r.type));
  const progress = getProgress(child, chosen);
  const effectiveStage = chosen === 'english'
    ? Math.max(progress.stage, profile.englishLevel || 1)
    : chosen === 'hebrew'
      ? Math.max(progress.stage, profile.hebrewLevel || 1)
      : Math.max(progress.stage, profile.mathStage || 1);
  const topicCtx = { track: profile.grade, stage: effectiveStage, level: profile.mathLevel, allowMulDiv: profile.allowMulDiv };
  const makeSession = () => chosen === 'english'
    ? generateEnglishExercises(effectiveStage, reviewExercises, profile.grade, profile.hideEnglishLetters)
    : chosen === 'hebrew'
      ? generateHebrewExercises(weakness, reviewExercises, effectiveStage, profile.grade)
      : bookId
        ? generateTopicMath(bookId, topicCtx, [], { workbook: true })
        : topicId
          ? generateTopicMath(topicId, topicCtx)
          : profile.grade
            ? generatePrepMath(profile.grade, effectiveStage, reviewExercises, operation, profile.allowMulDiv)
            : generateMathExercises(weakness, reviewExercises, profile.mathLevel, operation);

  // Daily summer plan: size the session to what's left of today's quota.
  // A completed (locked) day serves regular sessions — see getPlanStatus.
  // Topic sessions keep their short focused size (still count toward the quota).
  const planNow = getPlanStatus(profile, date);
  let exercises;
  if (!focusId && planNow && !planNow.complete) {
    const target = profile.dailyPlan[chosen];
    const remaining = target ? target - countTodayExercises(child, chosen, date) : 0;
    exercises = remaining > 0 ? fitSessionToCount(makeSession, remaining) : makeSession();
  } else {
    exercises = makeSession();
  }

  // Mini-lesson on first encounter with a topic family (mirrors the server),
  // or a re-teach lesson when the child keeps struggling with a family.
  // Workbook sessions skip it — the workbook IS the teaching.
  const progressAll = read(K.progress, {});
  const seenKeys = Array.isArray(progressAll[`lessons:${child}`]) ? progressAll[`lessons:${child}`] : [];
  const lesson = bookId ? null : pickLessonForSession(exercises, {
    seenKeys,
    experiencedKeys: experiencedFamilies(readHistory()[child]),
    sessions: readHistory()[child],
    date,
  });
  if (lesson) {
    const mark = lesson.markKey || lesson.key;
    if (!seenKeys.includes(mark)) {
      progressAll[`lessons:${child}`] = [...seenKeys, mark];
      write(K.progress, progressAll);
    }
  }

  const workbook = bookId ? getWorkbook(bookId) : null;

  return { child, subject: chosen, date, exercises, weakness, track: profile.grade || null, stage: effectiveStage, lesson, workbook };
}

export async function saveSession(payload) {
  const { child, results, subject, date, practice } = payload;
  // Mistakes update BEFORE history: the first call backfills from history,
  // and saving first would double-count this session's results.
  updateMistakes(child, subject || 'math', results);
  const history = readHistory();
  if (!history[child]) history[child] = [];
  history[child].push({ ...payload, savedAt: new Date().toISOString() });
  write(K.history, history);
  const profile = getChildProfile(child);
  let progress = null;
  if (!practice) {
    addWrongToReviewQueue(reviewKey(child, subject), results);
    progress = profile
      ? applySessionProgress(profile, subject, date || new Date().toISOString().slice(0, 10), results)
      : null;
  }
  const day = date || new Date().toISOString().slice(0, 10);
  const planStatus = profile ? getPlanStatus(profile, day) : null;
  const sticker = profile ? maybeAwardSticker(profile, day, planStatus) : null;
  return { ok: true, progress, planStatus, sticker };
}

export async function fetchHistory(child) {
  return { sessions: readHistory()[child] || [] };
}

export async function fetchStats(child) {
  const sessions = readHistory()[child] || [];
  const progress = {
    math: getProgress(child, 'math'),
    hebrew: getProgress(child, 'hebrew'),
    english: getProgress(child, 'english'),
  };
  if (!sessions.length) {
    return { totalSessions: 0, totalExercises: 0, totalCorrect: 0, totalNoMistake: 0, byType: {}, recent: [], progress };
  }
  const byType = {};
  let totalCorrect = 0, totalExercises = 0, totalNoMistake = 0;
  for (const session of sessions) {
    for (const r of session.results || []) {
      totalExercises++;
      if (r.correct) totalCorrect++;
      if (r.firstAttemptCorrect !== false && r.correct) totalNoMistake++;
      if (!byType[r.type]) byType[r.type] = { correct: 0, total: 0, noMistake: 0 };
      byType[r.type].total++;
      if (r.correct) byType[r.type].correct++;
      if (r.firstAttemptCorrect !== false && r.correct) byType[r.type].noMistake++;
    }
  }
  return {
    totalSessions: sessions.length,
    totalExercises, totalCorrect, totalNoMistake, byType,
    recent: sessions.slice(-10).reverse(),
    progress,
  };
}

// ── Email (not available without a server) ──────────────────────────────
export async function fetchEmailConfig() {
  return { enabled: false, smtpHost: '', smtpPort: 587, smtpUser: '', recipients: '', hasPassword: false, passLength: 0, webVersion: true };
}
export async function saveEmailConfig() {
  return { ok: true, webVersion: true };
}
export async function testEmail() {
  return { ok: false, error: 'שליחת מייל זמינה רק בגרסת המחשב (לא בגרסת הווב)' };
}

export async function verifyEmail() {
  return { ok: false, error: 'בדיקת התחברות זמינה רק בגרסת המחשב (לא בגרסת הווב)' };
}

// ── Background removal (desktop-only feature; no-op in the web build) ──────
export async function removeBackground(image) {
  return { ok: false, image, webVersion: true };
}
export async function fetchBgConfig() {
  return { hasKey: false, keyLength: 0, webVersion: true };
}
export async function saveBgConfig() {
  return { ok: true, webVersion: true };
}

// ── Accounts (web build: stored in this browser only) ─────────────────────
// The static web version has no server, so accounts live in localStorage and
// are device-local. Passwords are hashed with PBKDF2-SHA256 (WebCrypto, random
// salt per user) — the old scheme was base64, which anyone with a look at
// localStorage could read straight back out, and parents reuse passwords.
// Accounts created before that are migrated on their next successful login.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PBKDF2_ITERATIONS = 150_000;
const enc = new TextEncoder();
const webcrypto = globalThis.crypto;

/** Pre-1.4.1 password scheme — kept only to let old accounts log in once more. */
const obscure = (s) => { try { return btoa(unescape(encodeURIComponent(String(s)))); } catch { return String(s); } };

const toHex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

function randomHex(bytes) {
  if (webcrypto?.getRandomValues) {
    const a = new Uint8Array(bytes);
    webcrypto.getRandomValues(a);
    return toHex(a);
  }
  // Math.random() is predictable; only ever reached on a browser with no
  // WebCrypto at all, where nothing better is available.
  let s = '';
  while (s.length < bytes * 2) s += Math.random().toString(16).slice(2);
  return s.slice(0, bytes * 2);
}

const newToken = () => randomHex(32);

async function derive(password, salt) {
  const key = await webcrypto.subtle.importKey(
    'raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await webcrypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS },
    key, 256,
  );
  return toHex(bits);
}

/** Hash fields to store on a user record. */
async function hashPassword(password) {
  if (!webcrypto?.subtle) return { pwAlg: 'legacy', pwSalt: '', pw: obscure(password) };
  const pwSalt = randomHex(16);
  return { pwAlg: 'pbkdf2', pwSalt, pw: await derive(password, pwSalt) };
}

/** Length-independent comparison, so a wrong guess leaks no timing signal. */
function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function passwordMatches(user, password) {
  if (user.pwAlg === 'pbkdf2' && user.pwSalt && webcrypto?.subtle) {
    return safeEqual(user.pw, await derive(password, user.pwSalt));
  }
  return safeEqual(user.pw, obscure(password));
}

export async function authStatus() {
  return { hasUsers: (read(K.users, []) || []).length > 0 };
}

export async function registerAccount(email, password, name) {
  email = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error('כתובת אימייל לא תקינה');
  if (String(password || '').length < 6) throw new Error('הסיסמה צריכה להיות לפחות 6 תווים');
  const users = read(K.users, []);
  if (users.some(u => u.email === email)) throw new Error('כבר קיים חשבון עם האימייל הזה');
  const token = newToken();
  users.push({ email, name: String(name || '').trim(), ...(await hashPassword(password)), token });
  write(K.users, users);
  return { ok: true, token, user: { email, name: String(name || '').trim() } };
}

export async function loginAccount(email, password) {
  email = String(email || '').trim().toLowerCase();
  const users = read(K.users, []);
  const u = users.find(x => x.email === email);
  if (!u || !(await passwordMatches(u, password))) throw new Error('אימייל או סיסמה שגויים');
  // An account still on the old base64 scheme is upgraded the moment its owner
  // proves the password — no re-registration, no lost account.
  if (u.pwAlg !== 'pbkdf2') Object.assign(u, await hashPassword(password));
  u.token = newToken();
  write(K.users, users);
  return { ok: true, token: u.token, user: { email: u.email, name: u.name } };
}

export async function meAccount(token) {
  const u = (read(K.users, []) || []).find(x => x.token && x.token === token);
  return u ? { ok: true, user: { email: u.email, name: u.name } } : { ok: false };
}

export async function logoutAccount(token) {
  const users = read(K.users, []);
  const u = users.find(x => x.token === token);
  if (u) { u.token = null; write(K.users, users); }
  return { ok: true };
}


// ── Google sign-in (web build: Firebase Authentication, no server) ─────────
// Firebase's SDK opens the Google popup and verifies the identity for us;
// only the verified email + name are used to upsert a device-local account —
// all data stays in this browser.

// Upsert the local account for a Google identity and mint a session.
function googleLocalSession(email, name) {
  const users = read(K.users, []);
  let acc = users.find(x => x.email === email);
  if (!acc) { acc = { email, name, google: true }; users.push(acc); }
  acc.google = true;                   // identity account — no password login
  if (name && !acc.name) acc.name = name;
  acc.token = newToken();
  write(K.users, users);
  return { ok: true, token: acc.token, user: { email, name: acc.name || '' } };
}

export async function googleFirebaseLogin() {
  const { firebaseGoogleSignIn } = await import('./firebaseClient.js');
  const { email, name } = await firebaseGoogleSignIn();
  return googleLocalSession(email, name);
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  sanitizeGrade, sanitizeEnglishLevel, sanitizeHebrewLevel, sanitizeMathStage, foldSession,
  sanitizeDailyPlan, sanitizePlanUntil, migratePlanUntil, planIsActive,
} from './exercises/curriculum.js';
import { pickNewSticker, computePracticeStreak, computeAchievements } from './exercises/rewards.js';
import { resolveDataDir } from './dataDir.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// When packaged in Electron, KIDSLEARN_DATA_DIR points to a writable location
// (userData). A plain `node server/index.js` has no such env, so resolveDataDir
// falls back to the SAME userData location — keeping one shared data store.
const BUNDLED_DATA_DIR = path.join(__dirname, 'data');
const DATA_DIR = resolveDataDir(BUNDLED_DATA_DIR);
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const REVIEW_FILE = path.join(DATA_DIR, 'review.json');
const CHILDREN_FILE = path.join(DATA_DIR, 'children.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');
const MISTAKES_FILE = path.join(DATA_DIR, 'mistakes.json');
const REWARDS_FILE = path.join(DATA_DIR, 'rewards.json');

// No children ship with the app – each family creates their own profiles.
const DEFAULT_CHILDREN = [];

const VALID_SUBJECTS = ['math', 'hebrew', 'english'];
const VALID_MATH_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// Keep a subjects array (a child may learn more than one subject). Falls back
// to the legacy single `subject` field, and always yields at least one.
function sanitizeSubjects(subjects, fallbackSubject) {
  const arr = (Array.isArray(subjects) ? subjects : []).filter(s => VALID_SUBJECTS.includes(s));
  const unique = [...new Set(arr)];
  if (unique.length) return unique;
  return [fallbackSubject === 'hebrew' ? 'hebrew' : 'math'];
}

// null = the mixed grade-1-2 curriculum; otherwise a focused +/- ceiling.
function sanitizeLevel(level) {
  const n = Number(level);
  return VALID_MATH_LEVELS.includes(n) ? n : null;
}

// Ensure every child has subjects[] (derived from legacy `subject`), a
// mathLevel and a grade, so the rest of the app can rely on them being present.
function normalizeChild(c) {
  if (!c || typeof c !== 'object') return c;
  const subjects = sanitizeSubjects(c.subjects, c.subject);
  return {
    ...c,
    subjects,
    subject: subjects[0],
    mathLevel: sanitizeLevel(c.mathLevel),
    grade: sanitizeGrade(c.grade),
    englishLevel: sanitizeEnglishLevel(c.englishLevel),
    hebrewLevel: sanitizeHebrewLevel(c.hebrewLevel),
    mathStage: sanitizeMathStage(c.mathStage),
    dailyPlan: sanitizeDailyPlan(c.dailyPlan),
    planUntil: migratePlanUntil(c.planUntil),
    allowMulDiv: !!c.allowMulDiv,   // multiplication & division off until parent enables
    hideEnglish: !!c.hideEnglish,             // parent toggle: pause English entirely (unused by UI)
    hideEnglishLetters: !!c.hideEnglishLetters, // parent toggle: English stays, ABC letter drills hidden
  };
}

// The subjects a child actually sees right now (a paused subject is hidden
// everywhere: home card, sessions, plan, insights — but its data is kept).
export function activeSubjects(profile) {
  return (profile.subjects || []).filter(s => !(s === 'english' && profile.hideEnglish));
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  // On first run in packaged mode, seed user data from the bundled defaults
  // so the email/SMTP config and history carry over.
  if (DATA_DIR !== BUNDLED_DATA_DIR && fs.existsSync(BUNDLED_DATA_DIR)) {
    for (const f of ['history.json', 'config.json', 'review.json']) {
      const target = path.join(DATA_DIR, f);
      const source = path.join(BUNDLED_DATA_DIR, f);
      if (!fs.existsSync(target) && fs.existsSync(source)) {
        try { fs.copyFileSync(source, target); } catch {}
      }
    }
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ son: [], daughter: [] }, null, 2));
  }
  if (!fs.existsSync(REVIEW_FILE)) {
    fs.writeFileSync(REVIEW_FILE, JSON.stringify({ son: [], daughter: [] }, null, 2));
  }
  if (!fs.existsSync(CHILDREN_FILE)) {
    fs.writeFileSync(CHILDREN_FILE, JSON.stringify(DEFAULT_CHILDREN, null, 2));
  }
}

// === CHILDREN ===
export function readChildren() {
  ensureDataDir();
  try {
    const list = JSON.parse(fs.readFileSync(CHILDREN_FILE, 'utf8'));
    return Array.isArray(list) && list.length ? list.map(normalizeChild) : [...DEFAULT_CHILDREN];
  } catch {
    return [...DEFAULT_CHILDREN];
  }
}

export function writeChildren(list) {
  ensureDataDir();
  fs.writeFileSync(CHILDREN_FILE, JSON.stringify(list, null, 2));
}

export function getChild(id) {
  return readChildren().find(c => c.id === id) || null;
}

/** Add a new child. `seq` makes the id unique without relying on Date.now(). */
export function addChild({ name, gender, subject, subjects, mathLevel, grade, englishLevel, hebrewLevel, mathStage, dailyPlan, planUntil, allowMulDiv, hideEnglish, hideEnglishLetters, avatar, photo }) {
  const list = readChildren();
  const base = 'kid';
  let n = 1;
  while (list.some(c => c.id === `${base}_${n}`)) n++;
  const subs = sanitizeSubjects(subjects, subject);
  const child = {
    id: `${base}_${n}`,
    name: String(name || '').trim() || 'ילד/ה',
    gender: gender === 'girl' ? 'girl' : 'boy',
    subjects: subs,
    subject: subs[0],                 // kept in sync for back-compat
    mathLevel: sanitizeLevel(mathLevel),
    grade: sanitizeGrade(grade),      // null | 'gan_to_a' | 'a_to_b'
    englishLevel: sanitizeEnglishLevel(englishLevel),   // starting English stage 1-4
    hebrewLevel: sanitizeHebrewLevel(hebrewLevel),      // starting Hebrew stage 1-4
    mathStage: sanitizeMathStage(mathStage),            // starting prep-track math stage 1-4
    dailyPlan: sanitizeDailyPlan(dailyPlan),            // e.g. {math: 20, english: 20}
    planUntil: sanitizePlanUntil(planUntil),            // last day of the daily plan
    allowMulDiv: !!allowMulDiv,                         // show multiplication/division only when true
    hideEnglish: !!hideEnglish,
    hideEnglishLetters: !!hideEnglishLetters,           // hide ABC drills inside English
    avatar: avatar || '',
    photo: photo || '',
    builtin: false,
  };
  list.push(child);
  writeChildren(list);
  return child;
}

export function updateChild(id, { name, gender, subject, subjects, mathLevel, grade, englishLevel, hebrewLevel, mathStage, dailyPlan, planUntil, allowMulDiv, hideEnglish, hideEnglishLetters, avatar, photo }) {
  const list = readChildren();
  const child = list.find(c => c.id === id);
  if (!child) return null;
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
  writeChildren(list);
  return child;
}

export function deleteChild(id) {
  const list = readChildren();
  const child = list.find(c => c.id === id);
  if (!child) return false;
  writeChildren(list.filter(c => c.id !== id));
  return true;
}

// === HISTORY ===
export function readHistory() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); }
  catch { return { son: [], daughter: [] }; }
}

export function writeHistory(data) {
  ensureDataDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
}

export function saveSession(child, session) {
  const history = readHistory();
  if (!history[child]) history[child] = [];
  history[child].push({ ...session, savedAt: new Date().toISOString() });
  writeHistory(history);
  return session;
}

// === REVIEW QUEUE ===
// Stores actual exercises (with their generated values) that the kid got wrong on first attempt.
// They will resurface on the next session.

export function readReviewQueue() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf8')); }
  catch { return { son: [], daughter: [] }; }
}

export function writeReviewQueue(data) {
  ensureDataDir();
  fs.writeFileSync(REVIEW_FILE, JSON.stringify(data, null, 2));
}

/** Pull up to N items off the review queue (FIFO – oldest first). They are removed from the queue. */
export function popReviewQueue(child, count) {
  const data = readReviewQueue();
  const queue = data[child] || [];
  const taken = queue.splice(0, count);
  data[child] = queue;
  writeReviewQueue(data);
  return taken;
}

/**
 * Add wrong exercises from a session to the review queue.
 * Each entry stores the original exercise data so we can show the SAME question again.
 */
export function addWrongToReviewQueue(child, results) {
  const wrong = results
    .filter(r => r.firstAttemptCorrect === false && r.exerciseSnapshot)
    .map(r => r.exerciseSnapshot);
  if (!wrong.length) return;
  const data = readReviewQueue();
  if (!data[child]) data[child] = [];
  data[child].push(...wrong);
  // Cap queue at 30 to avoid unbounded growth
  data[child] = data[child].slice(-30);
  writeReviewQueue(data);
}

// === ADAPTIVE PROGRESS ===
// Per child+subject: current prep-track stage and the consecutive-successful-
// days streak that drives automatic level-ups (see exercises/curriculum.js).

const progressKey = (child, subject) => `${child}:${subject || 'math'}`;

function readProgressAll() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return {}; }
}

function writeProgressAll(data) {
  ensureDataDir();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

export function getProgress(child, subject) {
  const rec = readProgressAll()[progressKey(child, subject)];
  return {
    stage: rec?.stage || 1,
    streak: rec?.streak || 0,
    lastDate: rec?.lastDate || null,
    lastDateSuccess: rec?.lastDateSuccess || false,
  };
}

/**
 * Fold a finished session into the child's progress and persist the result.
 * Prep-track children climb a stage after enough successful days; leveled-
 * math children get their mathLevel bumped to the next ceiling.
 * Returns { stage, streak, levelUp } for the client to celebrate with.
 */
export function applySessionProgress(profile, subject, date, results) {
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

  const all = readProgressAll();
  all[progressKey(profile.id, subject)] = next;
  writeProgressAll(all);

  if (levelUp?.mode === 'level') {
    updateChild(profile.id, { mathLevel: levelUp.level });
  }
  // adaptive = this child+subject can actually level up (drives the client's
  // "X more days and you level up!" banner).
  const adaptive = !!profile.grade || (subject !== 'hebrew' && !!profile.mathLevel);
  return { stage: next.stage, streak: next.streak, lastDateSuccess: next.lastDateSuccess, levelUp, adaptive };
}

// === DAILY PLAN (תכנית יומית לחופש הגדול) ===

/** How many exercises the child answered today in a subject (incl. practice). */
export function countTodayExercises(child, subject, date) {
  const sessions = readHistory()[child] || [];
  let n = 0;
  for (const s of sessions) {
    if (s.date !== date) continue;
    if ((s.subject || 'math') !== subject) continue;
    n += (s.results || []).length;
  }
  return n;
}

/**
 * Today's plan status for a child: per-subject done/target and whether the
 * whole day is complete. Returns null when no plan is active for `date`.
 *
 * A completed day STAYS completed: the awarded sticker is the per-day
 * completion lock, so raising the quota mid-day (e.g. 30 → 40 after the kids
 * already finished) never "un-completes" today — the new quota simply applies
 * from tomorrow.
 */
export function getPlanStatus(profile, date) {
  if (!planIsActive(profile, date)) return null;
  const subjects = Object.entries(profile.dailyPlan)
    .filter(([subject]) => !(subject === 'english' && profile.hideEnglish))
    .map(([subject, target]) => {
      const done = countTodayExercises(profile.id, subject, date);
      return { subject, target, done };
    });
  const rec = readRewardsAll()[profile.id];
  // Only the DAILY sticker locks a day as complete. A magic-box bonus sticker
  // is a gift, not evidence the child practised — counting it meant one bonus
  // marked the whole day's quota finished, and every session that day silently
  // dropped back to the generator's own size instead of the configured number.
  const lockedComplete = !!(rec?.stickers || []).some(s => s.date === date && !s.bonus);
  return {
    date,
    until: profile.planUntil,
    subjects,
    complete: lockedComplete || subjects.every(s => s.done >= s.target),
    lockedComplete,
  };
}

// === REWARDS (מדבקות, הישגים, רצף) ===

function readRewardsAll() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(REWARDS_FILE, 'utf8')); }
  catch { return {}; }
}

function writeRewardsAll(data) {
  ensureDataDir();
  fs.writeFileSync(REWARDS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Award today's sticker if it was earned and not yet given. Children with an
 * active daily plan earn it by completing the WHOLE day's plan; children
 * without a plan earn it with their first finished session of the day.
 * Returns the sticker emoji, or null.
 */
export function maybeAwardSticker(profile, date, planStatus) {
  const all = readRewardsAll();
  const rec = all[profile.id] || { stickers: [] };
  // One DAILY sticker per day. A magic-box bonus that day must not use up the
  // child's chance to earn their own.
  if (rec.stickers.some(s => s.date === date && !s.bonus)) return null;
  if (planIsActive(profile, date) && !planStatus?.complete) return null;

  const emoji = pickNewSticker(rec.stickers.map(s => s.emoji));
  rec.stickers.push({ emoji, date });
  all[profile.id] = rec;
  writeRewardsAll(all);
  return emoji;
}

/** Stars, current streak, sticker album and achievements for one child. */
export function getRewards(child) {
  const sessions = readHistory()[child] || [];
  const stickers = (readRewardsAll()[child] || { stickers: [] }).stickers;
  const today = new Date().toISOString().slice(0, 10);
  const stars = sessions.reduce((n, s) =>
    n + (s.results || []).filter(r => r.firstAttemptCorrect !== false && r.correct).length, 0);
  const streak = computePracticeStreak(sessions.map(s => s.date), today);
  return {
    stars,
    streak,
    stickers,
    achievements: computeAchievements({ sessions, stickers, streak }),
  };
}

// === MAGIC BOX (קופסת הקסמים) — the parents' gift for connecting Tavixo ===
// Unlocked when KidsLearn is connected to Tavixo; one free surprise per day.

export function magicBoxState() {
  const cfg = readConfig();
  return {
    unlocked: !!cfg.magicBoxUnlocked,
    opens: Array.isArray(cfg.magicBoxOpens) ? cfg.magicBoxOpens : [],
  };
}

export function unlockMagicBox() {
  const cfg = readConfig();
  if (!cfg.magicBoxUnlocked) {
    cfg.magicBoxUnlocked = true;
    writeConfig(cfg);
  }
}

export function recordMagicBoxOpen(entry) {
  const cfg = readConfig();
  const opens = Array.isArray(cfg.magicBoxOpens) ? cfg.magicBoxOpens : [];
  cfg.magicBoxOpens = [...opens, entry].slice(-60);
  writeConfig(cfg);
}

/** A bonus sticker (beyond the daily one) — magic-box surprise for a child. */
export function awardBonusSticker(child, date) {
  const all = readRewardsAll();
  const rec = all[child] || { stickers: [] };
  const emoji = pickNewSticker(rec.stickers.map(s => s.emoji));
  rec.stickers = [...rec.stickers, { emoji, date, bonus: true }];
  all[child] = rec;
  writeRewardsAll(all);
  return emoji;
}

// === MINI-LESSONS (שיעורונים) — shown once per child per topic family ===
// Stored in progress.json under a non-colliding key namespace (`lessons:<id>`).

export function getSeenLessons(child) {
  const v = readProgressAll()[`lessons:${child}`];
  return Array.isArray(v) ? v : [];
}

export function markLessonSeen(child, key) {
  const all = readProgressAll();
  const cur = Array.isArray(all[`lessons:${child}`]) ? all[`lessons:${child}`] : [];
  if (cur.includes(key)) return;
  all[`lessons:${child}`] = [...cur, key];
  writeProgressAll(all);
}

// === MISTAKES COLLECTION (תרגול טעויות) ===
// A persistent, per child+subject collection of every exercise the child got
// wrong on first attempt, for on-demand practice. Unlike the review queue
// (which pops items into the next session), this collection keeps an item
// until the child answers it correctly on the first attempt somewhere.

const MISTAKES_CAP = 60;
const mistakeKey = (ex) => `${ex.type}|${ex.question}`;

function readMistakesAll() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(MISTAKES_FILE, 'utf8')); }
  catch { return {}; }
}

function writeMistakesAll(data) {
  ensureDataDir();
  fs.writeFileSync(MISTAKES_FILE, JSON.stringify(data, null, 2));
}

// Fold one session's results into a mistakes list (shared with backfill):
// first-attempt mistakes join the collection, first-attempt successes clear
// their matching entry (the child has mastered that exact question).
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

/** The child's current mistakes for a subject (backfilled from history once). */
export function getMistakes(child, subject) {
  const all = readMistakesAll();
  const key = progressKey(child, subject);
  if (all[key] === undefined) {
    // First time: rebuild from the existing session history.
    let list = [];
    const sessions = readHistory()[child] || [];
    for (const s of sessions) {
      if ((s.subject || 'math') !== subject) continue;
      list = foldResultsIntoMistakes(list, s.results);
    }
    all[key] = list;
    writeMistakesAll(all);
  }
  return all[key];
}

export function updateMistakes(child, subject, results) {
  const list = getMistakes(child, subject);   // ensures backfill happened
  const all = readMistakesAll();
  all[progressKey(child, subject)] = foldResultsIntoMistakes(list, results);
  writeMistakesAll(all);
}

// === WEAKNESS / STATS ===
/**
 * Compute per-type failure rate over the last N sessions.
 * Uses firstAttemptCorrect as the source of truth (mistake counts even if eventually corrected).
 */
export function computeWeakness(child, lookbackSessions = 5) {
  const history = readHistory();
  const sessions = (history[child] || []).slice(-lookbackSessions);

  const stats = {};
  for (const session of sessions) {
    for (const r of session.results || []) {
      if (!stats[r.type]) stats[r.type] = { wrong: 0, total: 0 };
      stats[r.type].total++;
      // Mistake = was wrong on first attempt (even if later corrected)
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

// === CONFIG ===
const DEFAULT_CONFIG = {
  email: {
    enabled: false,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    recipients: '',
  },
  // remove.bg API key for transparent-background photo uploads.
  removeBg: {
    apiKey: '',
  },
};

export function readConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return DEFAULT_CONFIG;
  }
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }; }
  catch { return DEFAULT_CONFIG; }
}

export function writeConfig(config) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/** Aggregate stats per child for the parents view. */
export function getStats(child) {
  const history = readHistory();
  const sessions = history[child] || [];

  if (!sessions.length) {
    return { totalSessions: 0, totalExercises: 0, totalCorrect: 0, totalNoMistake: 0, byType: {}, recent: [] };
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
    totalExercises,
    totalCorrect,
    totalNoMistake,
    byType,
    recent: sessions.slice(-10).reverse(),
  };
}

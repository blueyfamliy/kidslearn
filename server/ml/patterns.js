// -- Grammar patterns: the fluency guarantee ---------------------------------
//
// The first version of the validator checked content (same item, right gender,
// right operation) but not STRUCTURE, and the model happily produced things
// like "How many cookies do have together?" (a dropped word) and "סבא משחק את
// הגלידה" (an intransitive verb handed a direct object).
//
// The fix separates the two things a sentence is made of:
//
//   * FUNCTION SKELETON -- glue words, punctuation, slots, and the lexical
//     CLASS of each content word (a name, an item, an add-verb, a transitive
//     read-verb...). Fluency lives here, and it must match a skeleton the
//     grammar can actually produce. No exceptions.
//
//   * CONTENT -- which name, which item, which verb. Variety lives here, and
//     the model chooses freely. This is where the model earns its place: it can
//     put any of 27 names with any of 24 items in any of 15 frames, including
//     combinations no hand-written template covers.
//
// So the model recombines content across the whole space while structure stays
// pinned to something a person wrote. Patterns are ENUMERATED from corpus.js by
// sampling each frame, not hand-copied -- editing a frame updates the allowed
// patterns automatically.

import { RNG } from './tensor.js';
import { MODES, sampleSequence } from './corpus.js';
import {
  HE_NAMES, HE_NAMES_POSS, HE_NAMES_POSS_AND, HE_ITEMS, HE_CONTAINERS,
  HE_ADD_VERBS, HE_SUB_VERBS, HE_ADD_VERBS_PL, HE_SUB_VERBS_PL, HE_RECIPIENTS,
  HE_READ_SUBJECTS, HE_READ_VERBS, HE_READ_PLACES, HE_READ_OBJECTS,
  EN_NAMES, EN_ITEMS, EN_CONTAINERS,
  SUBJECT_GENDER, AGREE_GENDER, NAME_BASE, ITEM_TOKENS,
  WATER_PLACES, WATER_VERBS, BIG_SUBJECTS, FURNITURE_PLACES,
} from './lexicon.js';

const words = (s) => s.split(/\s+/).filter(Boolean);

// -- lexical classes ---------------------------------------------------------

/** @type {Array<{tokens: string[], cls: string}>} */
const ENTRIES = [];
const push = (entry, cls) => ENTRIES.push({ tokens: words(entry), cls });

for (const n of HE_NAMES) push(n.w, 'HE_NAME');
for (const n of HE_NAMES_POSS) push(n.w, 'HE_NAME_POSS');
for (const n of HE_NAMES_POSS_AND) push(n.w, 'HE_NAME_AND');
for (const i of HE_ITEMS) push(i.w, 'HE_ITEM');
for (const c of HE_CONTAINERS) push(c, 'HE_CONT');
for (const v of HE_ADD_VERBS) { push(v.m, 'HE_ADD_V'); push(v.f, 'HE_ADD_V'); }
for (const v of HE_SUB_VERBS) {
  const cls = v.takesRecipient ? 'HE_SUB_V_GIVE' : 'HE_SUB_V_ALONE';
  push(v.m, cls); push(v.f, cls);
}
for (const v of HE_ADD_VERBS_PL) push(v, 'HE_ADD_VPL');
for (const v of HE_SUB_VERBS_PL) push(v, 'HE_SUB_VPL');
for (const r of HE_RECIPIENTS) push(r.w, 'HE_RECIP');
for (const s of HE_READ_SUBJECTS) push(s.w, 'HE_SUBJ');
for (const v of HE_READ_VERBS) {
  // Three classes, not two: a verb that MUST take an object may only appear in
  // the object frame, and one that cannot take one may only appear in the place
  // frames. Collapsing them is what let "התוכי מחזיק בפארק" through.
  const cls = v.objectRequired ? 'HE_READ_VTR' : v.transitive ? 'HE_READ_VT' : 'HE_READ_VI';
  push(v.m, cls); push(v.f, cls);
}
for (const p of HE_READ_PLACES) push(p.w, 'HE_PLACE');
for (const o of HE_READ_OBJECTS) push(o, 'HE_OBJ');
for (const n of EN_NAMES) push(n, 'EN_NAME');
for (const i of EN_ITEMS) push(i, 'EN_ITEM');
for (const c of EN_CONTAINERS) push(c.w, 'EN_CONT');

// Index by first token, longest entry first, so a greedy match prefers
// "על השולחן" over the bare "על".
const BY_FIRST = new Map();
for (const e of ENTRIES) {
  if (!BY_FIRST.has(e.tokens[0])) BY_FIRST.set(e.tokens[0], []);
  BY_FIRST.get(e.tokens[0]).push(e);
}
for (const list of BY_FIRST.values()) list.sort((a, b) => b.tokens.length - a.tokens.length);

/**
 * Tokens that legitimately belong to more than one class -- "בגינה" is both a
 * container to put apples in and a place for a dog to run. Rather than force a
 * choice, abstraction returns every reading and a match against any one of them
 * is enough.
 */
export const AMBIGUOUS = (() => {
  const byToken = new Map();
  for (const e of ENTRIES) {
    if (e.tokens.length !== 1) continue;
    if (!byToken.has(e.tokens[0])) byToken.set(e.tokens[0], new Set());
    byToken.get(e.tokens[0]).add(e.cls);
  }
  return new Map([...byToken].filter(([, s]) => s.size > 1).map(([t, s]) => [t, [...s]]));
})();

/**
 * All readings of a token list as a class/literal pattern.
 * Unmatched tokens (glue, punctuation, <a>, <b>) pass through as themselves.
 *
 * @param {string[]} toks
 * @returns {string[]} space-joined patterns; usually 1, more when ambiguous
 */
export function abstractAll(toks) {
  const out = new Set();
  const MAX = 64;                        // ambiguity is rare; this never binds in practice

  const walk = (i, acc) => {
    if (out.size >= MAX) return;
    if (i >= toks.length) { out.add(acc.join(' ')); return; }
    const cands = BY_FIRST.get(toks[i]);
    let matched = false;
    if (cands) {
      const seen = new Set();
      for (const e of cands) {
        if (toks.slice(i, i + e.tokens.length).join(' ') !== e.tokens.join(' ')) continue;
        const key = `${e.cls}@${e.tokens.length}`;
        if (seen.has(key)) continue;     // same class via the same span: one branch is enough
        seen.add(key);
        matched = true;
        walk(i + e.tokens.length, [...acc, e.cls]);
      }
    }
    if (!matched) walk(i + 1, [...acc, toks[i]]);
  };

  walk(0, []);
  return [...out];
}

/**
 * Every function skeleton the grammar can produce, keyed by "<lang> <task>".
 *
 * Enumerated by sampling the grammar until it stops surprising us: draw from a
 * mode until PATIENCE consecutive draws add nothing new. There are only a few
 * dozen patterns in total, so a fixed large sample count was pure waste -- the
 * first version drew 40k per mode and cost 930 ms of module-load time, which
 * would have been several blocked seconds of app start on a phone.
 *
 * Built lazily on first use, and cached. Nothing pays for it unless something
 * actually validates a sentence.
 */
const PATIENCE = 3000;
const MAX_DRAWS = 60000;

let _patterns = null;

export function getPatterns() {
  if (_patterns) return _patterns;
  const rng = new RNG(20260824);
  const byMode = new Map();
  for (const mode of MODES) {
    const set = new Set();
    let since = 0;
    for (let i = 0; i < MAX_DRAWS && since < PATIENCE; i++) {
      const seq = sampleSequence(rng, mode);
      let fresh = false;
      for (const p of abstractAll(seq.slice(3, -1))) if (!set.has(p)) { set.add(p); fresh = true; }
      since = fresh ? 0 : since + 1;
    }
    byMode.set(`${mode.lang} ${mode.task}`, set);
  }
  _patterns = byMode;
  return _patterns;
}

/**
 * Does this body match a skeleton the grammar could have produced?
 * @param {string[]} body  the sequence between <task> and <eos>
 * @param {string} lang    '<he>' | '<en>'
 * @param {string} task    '<add>' | '<sub>' | '<read>'
 */
export function matchesGrammar(body, lang, task) {
  const set = getPatterns().get(`${lang} ${task}`);
  if (!set) return false;
  return abstractAll(body).some((p) => set.has(p));
}

/** Which class each token belongs to, for the content-level consistency checks. */
export function classesOf(token) {
  const cands = BY_FIRST.get(token);
  if (!cands) return [];
  return [...new Set(cands.filter((e) => e.tokens.length === 1).map((e) => e.cls))];
}

/** Pattern count per mode. Forces enumeration -- for reporting, not hot paths. */
export function patternCounts() {
  return Object.fromEntries([...getPatterns()].map(([k, v]) => [k, v.size]));
}

/**
 * A fingerprint of everything the validator decides with: the grammar's function
 * skeletons plus the lexical metadata behind the content checks.
 *
 * The tokenizer's vocabHash covers the token INVENTORY, which is what a stale
 * checkpoint depends on. It does not move when only metadata changes -- when
 * `רואה` was reclassified from "may take an object" to "requires one", the token
 * set was identical and 104 already-mined sentences silently became ungrammatical.
 * This hash moves for that. Mined pools carry it so a build can tell.
 *
 * Forces pattern enumeration (~75 ms), so call it in tooling and tests, never on
 * an app's startup path.
 */
export function grammarHash() {
  const parts = [];
  for (const [key, set] of [...getPatterns()].sort((a, b) => a[0].localeCompare(b[0]))) {
    parts.push(key, ...[...set].sort());
  }
  for (const [label, map] of [['subj', SUBJECT_GENDER], ['agree', AGREE_GENDER], ['name', NAME_BASE]]) {
    parts.push(label, ...[...map].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`));
  }
  for (const [label, set] of [['item', ITEM_TOKENS], ['water', WATER_PLACES], ['wverb', WATER_VERBS],
                              ['big', BIG_SUBJECTS], ['furn', FURNITURE_PLACES]]) {
    parts.push(label, ...[...set].sort());
  }
  let h = 2166136261 >>> 0;                       // FNV-1a, same as vocabHash
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) { h ^= p.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= 10; h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

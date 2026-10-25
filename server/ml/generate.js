// -- Constrained generation, validation, and number filling ------------------
//
// This is the layer that makes a from-scratch tiny language model safe to put
// in front of a six-year-old. Four defences, in order:
//
//   1. CONSTRAINED DECODING -- at every step the sampler masks out every token
//      that cannot legally come next. The model cannot emit a second <a>, cannot
//      emit <b> before <a>, cannot stop before its question is finished, cannot
//      switch to a different noun halfway through, cannot ask its question about
//      a child the statement never mentioned, and cannot write a digit because
//      digits are not in the vocabulary at all.
//
//   2. STRUCTURE (patterns.js) -- the function skeleton must match one the
//      grammar can produce. Dropped words, an intransitive verb handed a direct
//      object, a two-child question missing its "together" -- all die here.
//
//   3. CONTENT -- one kind of object per problem, one child per question,
//      Hebrew gender agreement, and an operation that matches what was asked
//      for. A sentence that says "got 3 more" and then asks "how many are LEFT"
//      is thrown away, because answering it with a + b would be wrong.
//
//   4. DETERMINISTIC ARITHMETIC -- numbers are chosen and the answer computed
//      by ordinary code, after validation. The model never sees a digit, so no
//      exercise can carry a wrong answer however badly the model behaves.
//
// Anything that fails is discarded and resampled; if nothing survives, the
// caller falls back to the hand-written generator. Silence, never a bad sum.

import { noGrad } from './tensor.js';
import { tokenizer, detokenize } from './tokenizer.js';
// fillSlots lives in fill.js so the app can import it without dragging the
// transformer into the client bundle. Re-exported here to keep one entry point.
import { fillSlots } from './fill.js';
export { fillSlots, toExercise } from './fill.js';
import { matchesGrammar } from './patterns.js';
import {
  SUBJECT_GENDER, AGREE_GENDER, ITEM_TOKENS, NAME_BASE,
  WATER_VERBS, WATER_PLACES, BIG_SUBJECTS, FURNITURE_PLACES,
  HE_SUB_VERBS, HE_SUB_VERBS_PL,
} from './lexicon.js';

// -- cue sets ----------------------------------------------------------------
// Verified against the whole corpus: these separate addition from subtraction
// with no overlap, in both languages. See ml/README.md.

const ADD_CUES = new Set(['עוד', 'ביחד', 'בסך', 'gets', 'adds', 'finds', 'more', 'altogether', 'together']);
const SUB_CUES = new Set([
  ...HE_SUB_VERBS.flatMap((v) => [v.m, v.f]),
  ...HE_SUB_VERBS_PL,
  'gives', 'takes', 'lost',
]);
const LEFT_CUES = new Set(['נשארו', 'left']);

const NEVER_EMIT = new Set(['<pad>', '<bos>', '<unk>', '<he>', '<en>', '<add>', '<sub>', '<read>']);

const ID = {
  a: tokenizer.id('<a>'), b: tokenizer.id('<b>'), eos: tokenizer.eos,
  q: tokenizer.id('?'), dot: tokenizer.id('.'),
};
const NEVER_EMIT_IDS = new Set([...NEVER_EMIT].map((t) => tokenizer.id(t)));

// Id-indexed lookups for the decode-time consistency constraints below.
const ITEM_IDS = new Set([...ITEM_TOKENS].map((t) => tokenizer.id(t)));
const NAME_BASE_BY_ID = new Map(
  tokenizer.tokens.map((t, i) => [i, NAME_BASE.get(t)]).filter(([, b]) => b !== undefined));
const SUBJ_GENDER_BY_ID = new Map(
  tokenizer.tokens.map((t, i) => [i, SUBJECT_GENDER.get(t)]).filter(([, g]) => g !== undefined));
const AGREE_GENDER_BY_ID = new Map(
  tokenizer.tokens.map((t, i) => [i, AGREE_GENDER.get(t)]).filter(([, g]) => g !== undefined));

// -- batched constrained sampling --------------------------------------------

/**
 * Sample `n` skeletons at once.
 *
 * Batching is not just for speed: every sequence in the batch is the same length
 * at every step, which is exactly the layout the fused attention op already
 * wants, so a whole candidate pool costs one forward pass per step instead of n.
 * (Attention is verified not to leak across packed sequences -- see
 * attention.test.js -- which is what makes this safe.)
 *
 * There is no KV cache, so step t re-reads the whole prefix. For 24-token
 * sequences that is affordable; it is the obvious next optimisation if these
 * ever need to be sampled live on a phone rather than mined at build time.
 */
export function sampleSkeletons(model, { lang, task, n = 16, temperature = 0.9, topK = 12, rng }) {
  const maxLen = Math.min(model.cfg.ctx, 28);
  const prefix = [tokenizer.bos, tokenizer.id(lang), tokenizer.id(task)];
  const isRead = task === '<read>';

  // Per-sequence state. `item` and `subject` are what make the two entity
  // constraints below possible: they remember the first noun and the first child
  // mentioned, so every later reference can be forced to agree with them.
  const seqs = Array.from({ length: n }, () => ({
    ids: [...prefix], done: false, hasA: false, hasB: false,
    item: null, subject: null, gender: null, pastBreak: false,
  }));

  for (let step = prefix.length; step < maxLen; step++) {
    if (seqs.every((s) => s.done)) break;

    const len = step;
    const flat = new Int32Array(n * len);
    seqs.forEach((s, i) => flat.set(s.ids.slice(0, len), i * len));

    noGrad();
    const logits = model.forward(flat, len);
    const V = logits.cols;

    for (let i = 0; i < n; i++) {
      const s = seqs[i];
      if (s.done) continue;
      const row = (i * len + (len - 1)) * V;      // logits for the next token

      // ---- legality mask ----
      const last = s.ids[s.ids.length - 1];
      const lastTok = tokenizer.token(last);
      const forced = step === maxLen - 1;         // out of room: must close now
      const canEos = isRead ? lastTok === '.' : (s.hasA && s.hasB && lastTok === '?');

      const allowed = [];
      for (let v = 0; v < V; v++) {
        if (NEVER_EMIT_IDS.has(v)) continue;
        if (v === last) continue;                 // no token repeats itself (verified: never happens in the corpus)
        if (v === ID.eos) { if (canEos) allowed.push(v); continue; }
        if (forced) continue;                     // only <eos> may be taken at the cap
        if (v === ID.a) { if (!isRead && !s.hasA) allowed.push(v); continue; }
        if (v === ID.b) { if (!isRead && s.hasA && !s.hasB) allowed.push(v); continue; }
        if (isRead && v === ID.q) continue;       // reading sentences are statements
        if (!isRead && v === ID.dot && !(s.hasA && s.hasB)) continue;  // no full stop mid-statement

        // One problem, one kind of thing. Cheaper and stricter than rejecting
        // the sentence afterwards, and it removes every "mixes X + Y" failure.
        if (s.item !== null && ITEM_IDS.has(v) && v !== s.item) continue;

        // One problem, one child. Before the statement ends, a second name must
        // be somebody else (nobody gives things to themselves); after it, the
        // question has to be about the child the statement was about.
        //
        // This is the fix for the failure that dominated English subtraction:
        // "Tom has 8 blocks and gives 3 to Noa. How many does MAYA have now?"
        // needs the model to copy a name from twelve tokens back, which it had
        // not learned. Making the wrong name unrepresentable is more reliable
        // than training until it usually gets it right.
        const base = NAME_BASE_BY_ID.get(v);
        if (base !== undefined && s.subject !== null) {
          if (s.pastBreak ? base !== s.subject : base === s.subject) continue;
        }

        // Hebrew agreement. Once the subject is on the page its gender is
        // settled, so every verb, pronoun and clitic that disagrees with it is
        // simply not offered. Same rule as the validator, applied one step
        // earlier where it costs nothing.
        if (s.gender !== null) {
          const ag = AGREE_GENDER_BY_ID.get(v);
          if (ag !== undefined && ag !== s.gender) continue;
        }

        allowed.push(v);
      }
      if (allowed.length === 0) { s.done = true; s.failed = true; continue; }

      // ---- temperature + top-k over the legal tokens only ----
      allowed.sort((x, y) => logits.data[row + y] - logits.data[row + x]);
      const pool = allowed.slice(0, Math.max(1, Math.min(topK, allowed.length)));
      let max = -Infinity;
      for (const v of pool) { const l = logits.data[row + v] / temperature; if (l > max) max = l; }
      let sum = 0;
      const p = pool.map((v) => { const e = Math.exp(logits.data[row + v] / temperature - max); sum += e; return e; });
      let r = rng.next() * sum, choice = pool[pool.length - 1];
      for (let j = 0; j < pool.length; j++) { r -= p[j]; if (r <= 0) { choice = pool[j]; break; } }

      s.ids.push(choice);
      if (choice === ID.a) s.hasA = true;
      if (choice === ID.b) s.hasB = true;
      if (choice === ID.eos) s.done = true;
      if (s.item === null && ITEM_IDS.has(choice)) s.item = choice;
      if (s.subject === null && NAME_BASE_BY_ID.has(choice)) s.subject = NAME_BASE_BY_ID.get(choice);
      if (s.gender === null && SUBJ_GENDER_BY_ID.has(choice)) s.gender = SUBJ_GENDER_BY_ID.get(choice);
      if (!isRead && choice === ID.dot) s.pastBreak = true;
    }
  }

  return seqs
    .filter((s) => !s.failed && s.ids[s.ids.length - 1] === ID.eos)
    .map((s) => tokenizer.decode(s.ids));
}

// -- validation --------------------------------------------------------------
/**
 * Is this skeleton safe to put in front of a child?
 *
 * Two independent gates, in this order:
 *
 *   STRUCTURE -- the function skeleton (glue words, punctuation, slots, and the
 *   lexical class of each content word) has to match one the grammar can
 *   produce. See patterns.js. This is what keeps sentences fluent: a dropped
 *   "they", an intransitive verb handed an object, a missing "ביחד" all die here.
 *
 *   CONTENT -- the words the model chose freely still have to hang together:
 *   one kind of object per problem, one child per question, gender agreement,
 *   and an operation that matches what was asked for. This is what keeps the
 *   ANSWER correct, which is the part that actually matters.
 *
 * @param {string[]} toks  a full sequence: <bos> <lang> <task> ... <eos>
 * @returns {{ok: boolean, reason?: string}}
 */
export function validateSkeleton(toks) {
  if (toks.length < 6) return { ok: false, reason: 'too short' };
  if (toks[0] !== '<bos>' || toks[toks.length - 1] !== '<eos>') return { ok: false, reason: 'missing bos/eos' };
  const lang = toks[1], task = toks[2];
  const body = toks.slice(3, -1);
  if (body.some((t) => t.startsWith('<') && t !== '<a>' && t !== '<b>')) {
    return { ok: false, reason: 'control token in body' };
  }

  // -- gate 1: structure --
  if (!matchesGrammar(body, lang, task)) return { ok: false, reason: 'not a grammatical shape' };

  // -- gender agreement (Hebrew) --
  // Names do not agree with each other -- "לדני 5 ולליה 3" is fine -- but every
  // verb, pronoun and clitic must agree with the subject that governs it.
  let subjectGender = null;
  if (lang === '<he>') {
    for (const t of body) {
      const g = SUBJECT_GENDER.get(t);
      if (g) { subjectGender = g; break; }
    }
    for (const t of body) {
      const g = AGREE_GENDER.get(t);
      if (g && subjectGender && g !== subjectGender) return { ok: false, reason: `gender: ${t} vs ${subjectGender}` };
    }
  }

  // -- reading sentences: no numbers, one full stop, and water where needed --
  if (task === '<read>') {
    if (body.includes('<a>') || body.includes('<b>')) return { ok: false, reason: 'slot in a reading sentence' };
    if (body[body.length - 1] !== '.') return { ok: false, reason: 'no full stop' };
    if (body.filter((t) => t === '.').length !== 1) return { ok: false, reason: 'multiple full stops' };
    // Places can be one or two tokens ("בגינה", "על המיטה"), so try the longer
    // match first at each position.
    let place = null;
    for (let i = 0; i < body.length && !place; i++) {
      const two = `${body[i]} ${body[i + 1]}`;
      if (WATER_PLACES.has(two) || FURNITURE_PLACES.has(two)) place = two;
      else if (WATER_PLACES.has(body[i]) || FURNITURE_PLACES.has(body[i])) place = body[i];
    }
    const swims = body.some((t) => WATER_VERBS.has(t));
    if (swims !== (place !== null && WATER_PLACES.has(place))) {
      return { ok: false, reason: swims ? 'swimming out of water' : 'water place, no swimming' };
    }
    // A bear does not sit on a bed. The corpus never pairs them, the model does,
    // and until this check existed those pairings passed as "novel" sentences.
    if (place !== null && FURNITURE_PLACES.has(place) && body.some((t) => BIG_SUBJECTS.has(t))) {
      return { ok: false, reason: 'large animal on the furniture' };
    }
    return { ok: true };
  }

  // -- slot structure --
  const ia = body.indexOf('<a>'), ib = body.indexOf('<b>');
  if (ia < 0 || ib < 0) return { ok: false, reason: 'missing a slot' };
  if (body.lastIndexOf('<a>') !== ia || body.lastIndexOf('<b>') !== ib) return { ok: false, reason: 'duplicate slot' };
  if (ia > ib) return { ok: false, reason: 'slots out of order' };

  // -- shape: one statement, one question --
  if (body[body.length - 1] !== '?') return { ok: false, reason: 'does not end in a question' };
  if (body.filter((t) => t === '?').length !== 1) return { ok: false, reason: 'multiple question marks' };
  if (!body.includes('.')) return { ok: false, reason: 'no statement/question break' };

  // -- one problem, one kind of thing --
  // Checking only the question against the first slot (as the first version of
  // this did) let "לליה 1 קונכיות ולרועי 5 בלונים -- כמה קונכיות ביחד?" through,
  // which sums two different things and hands the child a wrong total.
  const item = body[ia + 1];
  if (!ITEM_TOKENS.has(item)) return { ok: false, reason: `<a> not followed by a noun (${item})` };
  const allItems = [...new Set(body.filter((t) => ITEM_TOKENS.has(t)))];
  if (allItems.length !== 1) return { ok: false, reason: `mixes ${allItems.join(' + ')}` };

  // -- the question must be about the child the statement was about --
  // "Tom has 8 blocks and gives 3 to Noa. How many does MAYA have now?" is
  // structurally perfect and arithmetically nonsense.
  const names = body.map((t) => NAME_BASE.get(t)).filter(Boolean);
  const subject = names[0] || null;
  if (new Set(names).size > 2) return { ok: false, reason: `${new Set(names).size} different children` };
  const question = body.slice(body.lastIndexOf('.') + 1);
  const qNames = [...new Set(question.map((t) => NAME_BASE.get(t)).filter(Boolean))];
  if (qNames.length > 1) return { ok: false, reason: 'question names two children' };
  if (qNames.length === 1 && qNames[0] !== subject) {
    return { ok: false, reason: `asks about ${qNames[0]}, statement is about ${subject}` };
  }

  // -- nobody gives things to themselves --
  const toIdx = body.indexOf('to');
  if (toIdx >= 0 && NAME_BASE.get(body[toIdx + 1]) && NAME_BASE.get(body[toIdx + 1]) === subject) {
    return { ok: false, reason: 'gives to itself' };
  }

  // -- the operation must match the one that was asked for --
  // The check that matters most: a sentence about receiving three MORE that then
  // asks how many are LEFT has no correct answer, and a + b would be a
  // confidently wrong one.
  const hasAdd = body.some((t) => ADD_CUES.has(t)) || body.some((t) => t.startsWith('ול'));
  const hasSub = body.some((t) => SUB_CUES.has(t));
  const hasLeft = body.some((t) => LEFT_CUES.has(t));
  if (task === '<add>') {
    if (!hasAdd) return { ok: false, reason: 'no additive cue' };
    if (hasSub) return { ok: false, reason: 'subtractive verb in an addition problem' };
    if (hasLeft) return { ok: false, reason: 'addition problem asking what is left' };
  } else if (task === '<sub>') {
    if (!hasSub) return { ok: false, reason: 'no subtractive cue' };
    if (hasAdd) return { ok: false, reason: 'additive cue in a subtraction problem' };
  } else {
    return { ok: false, reason: `unknown task ${task}` };
  }

  return { ok: true };
}

// -- the public entry point --------------------------------------------------

/**
 * Generate validated exercises for one (lang, task).
 *
 * @returns {{items: Array, stats: {sampled: number, valid: number, rejected: Object}}}
 */
export function generateExercises(model, { lang, task, count = 1, max = 20, maxB = Infinity, rng, poolSize = 24, rounds = 4 }) {
  const items = [];
  const rejected = {};
  let sampled = 0;

  for (let round = 0; round < rounds && items.length < count; round++) {
    const skeletons = sampleSkeletons(model, { lang, task, n: poolSize, rng });
    sampled += poolSize;
    for (const toks of skeletons) {
      const v = validateSkeleton(toks);
      if (!v.ok) { rejected[v.reason] = (rejected[v.reason] || 0) + 1; continue; }
      if (task === '<read>') {
        items.push({ sentence: detokenize(toks, lang === '<en>' ? 'en' : 'he'), tokens: toks });
      } else {
        items.push({ ...fillSlots(toks, { rng, max, maxB }), tokens: toks });
      }
      if (items.length >= count) break;
    }
  }

  return { items, stats: { sampled, valid: items.length, rejected } };
}

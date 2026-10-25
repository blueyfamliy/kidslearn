// -- Numbers and rendering ---------------------------------------------------
//
// Split out of generate.js on purpose. The app's baked path only ever needs to
// take an already-validated skeleton and put two numbers in it -- it does not
// need the transformer, the autograd engine, the grammar, or the sampler. If
// mathGenerator.js imported those, every one of them would be bundled into the
// single-file offline HTML and the Android APK for nothing.
//
// So this file imports exactly two things: the tokenizer (to render) and the
// lexicon (to know which words are plural nouns). Everything heavy stays on the
// training side of the fence.

import { detokenize } from './tokenizer.js';
import { ITEM_TOKENS } from './lexicon.js';

/**
 * Choose the two numbers and compute the answer.
 *
 * Addition stays within `max`; subtraction always leaves at least 1, because
 * "how many are left" answered with 0 or a negative is not an exercise for this
 * age group. `maxB` caps the second operand independently -- KidsLearn's mixed
 * track deliberately never subtracts more than 9 (v1.3.3), and that constraint
 * has to survive the switch to Lexi.
 *
 * @param {string[]} toks   a validated skeleton: <bos> <lang> <task> ... <eos>
 * @param {{rng: object, max?: number, maxB?: number}} opts
 */
export function fillSlots(toks, { rng, max = 20, maxB = Infinity }) {
  const task = toks[2];
  const lang = toks[1] === '<en>' ? 'en' : 'he';

  // Both branches need room for two numbers with a sensible result, so a caller
  // passing max = 1 gets clamped rather than an exercise whose answer sits above
  // the ceiling it asked for.
  const cap = Math.max(4, Math.floor(max));

  // A slot that sits directly in front of a plural noun cannot be 1: "1 candies"
  // and "1 ציורים" are both wrong. That is only true of the slots the frame puts
  // next to the noun -- "gives 1 to Ava" and "got 1 more" read perfectly well --
  // so the minimum is decided per slot rather than banning 1 outright.
  const ia = toks.indexOf('<a>'), ib = toks.indexOf('<b>');
  const minA = ITEM_TOKENS.has(toks[ia + 1]) ? 2 : 1;
  const minB = ITEM_TOKENS.has(toks[ib + 1]) ? 2 : 1;

  let a, b, answer, hint;
  if (task === '<add>') {
    const bCap = Math.max(minB, Math.min(maxB, cap - minA));
    b = minB + rng.int(bCap - minB + 1);
    a = minA + rng.int(cap - b - minA + 1);      // a + b <= cap
    answer = a + b;
    hint = `${a} + ${b}`;
  } else {
    const aMin = Math.max(minA, minB + 1);       // a - b >= 1 needs a > b
    a = aMin + rng.int(cap - aMin + 1);
    // b must satisfy three things at once: >= minB (plural agreement), <= maxB
    // (the caller's cap), and <= a-1 (a positive answer). When they conflict,
    // the positive answer wins -- a wrong exercise is worse than "1 ציורים".
    const bHi = Math.min(maxB, a - 1);
    b = bHi >= minB ? minB + rng.int(bHi - minB + 1) : Math.max(1, bHi);
    answer = a - b;
    hint = `${a} - ${b}`;
  }

  const filled = toks.map((t) => (t === '<a>' ? String(a) : t === '<b>' ? String(b) : t));
  return { question: detokenize(filled, lang), answer, a, b, hint, lang };
}

// Exercise `type` values. Hebrew reuses the two the app already knows, so
// insights.js keeps classifying these under חיבור / חיסור and the
// mistakes-practice page keeps working. The English types are new and are NOT in
// insights.js TOPIC_FAMILIES -- insights will silently skip them until added.
const TYPE = {
  '<he>|<add>': 'word_add',
  '<he>|<sub>': 'word_sub',
  '<en>|<add>': 'en_word_add',
  '<en>|<sub>': 'en_word_sub',
};

/** Wrap a filled skeleton in the shape server/exercises/*.js already produce. */
export function toExercise(lang, task, filled) {
  return {
    type: TYPE[`${lang}|${task}`],
    difficulty: 3,
    dir: lang === '<he>' ? 'rtl' : 'ltr',
    question: filled.question,
    answer: filled.answer,
    hint: filled.hint,
    source: 'lexi',           // so a parent-facing screen can tell them apart
  };
}

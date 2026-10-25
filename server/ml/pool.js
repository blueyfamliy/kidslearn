// -- Lexi, as the app uses it ------------------------------------------------
//
// The whole app-facing surface of the model, in one deliberately small module.
//
// What it does NOT import matters as much as what it does. There is no
// transformer here, no autograd engine, no sampler, no grammar and no
// validator -- only the mined sentences, the tokenizer that renders them, and
// the code that picks two numbers. The client imports straight from
// server/exercises/, so anything reachable from here ends up inside the
// single-file offline HTML and the Android APK. Lexi's ~174k weights have no
// business being there when every sentence was already written and checked at
// build time.
//
// The safety story is unchanged and does not depend on this file being careful:
// every skeleton in skeletons.js passed all four gates in generate.js during
// mining, and the numbers are still chosen and the answer still computed by
// ordinary arithmetic here. See ml/README.md.

import { POOL } from './skeletons.js';
import { fillSlots, toExercise } from './fill.js';

/**
 * Skeletons keyed by "<lang> <task>", rebuilt from the compact stored form.
 * The `<bos> <lang> <task>` prefix and `<eos>` are implied by the key, which is
 * where they were dropped when mining.
 */
const BY_MODE = (() => {
  const out = {};
  for (const [key, bodies] of Object.entries(POOL.skeletons || {})) {
    const [lang, task] = key.split(' ');
    out[key] = bodies.map((body) => ['<bos>', lang, task, ...body.split(' '), '<eos>']);
  }
  return out;
})();

/** What was mined, and against which model and grammar. For the parents' screen. */
export const LEXI_INFO = {
  ...POOL.meta,
  total: Object.values(BY_MODE).reduce((n, l) => n + l.length, 0),
  modes: Object.fromEntries(Object.entries(BY_MODE).map(([k, l]) => [k, l.length])),
};

/**
 * One word problem written by Lexi, or `null`.
 *
 * `null` is not an error and is not exceptional -- it just means this build has
 * no sentences for that language and operation. Every call site is expected to
 * fall back to its hand-written template. The kids' daily session must never
 * depend on the model being there.
 *
 * @param {object} opts
 * @param {'he'|'en'} opts.lang
 * @param {'add'|'sub'} opts.op
 * @param {number} opts.max    largest number to use -- match the child's level
 * @param {number} [opts.maxB] cap on the second operand (the mixed track caps
 *                             subtraction at 9; see MIXED_SUB_MAX)
 * @param {{int: (n: number) => number}} opts.rng
 * @returns {object|null} { type, difficulty, dir, question, answer, hint, source }
 */
export function lexiWordProblem({ lang = 'he', op = 'add', max = 20, maxB = Infinity, rng }) {
  const list = BY_MODE[`<${lang}> <${op}>`];
  if (!list || list.length === 0) return null;
  const toks = list[rng.int(list.length)];
  return toExercise(`<${lang}>`, `<${op}>`, fillSlots(toks, { rng, max, maxB }));
}

/** Is there anything mined for this language and operation? */
export function lexiHas(lang, op) {
  const list = BY_MODE[`<${lang}> <${op}>`];
  return !!list && list.length > 0;
}

// -- The app-facing surface --------------------------------------------------
//
// Everything the rest of KidsLearn needs from the model is here. Two ways to
// use it, because the app ships in three shapes with very different budgets:
//
//   LIVE      loadModel() + neuralWordProblem() -- samples from the checkpoint
//             on demand. Fresh phrasing every session. Costs ~50-150 ms per
//             batch of candidates on a laptop; measure before trusting it on a
//             phone (there is no KV cache yet, see generate.js).
//
//   BAKED     pool.js -- the sentences mine.js already wrote and validated,
//             with only the numbers filled in at runtime. Microseconds, and no
//             transformer in the client bundle at all. That is what the app
//             uses; see pool.js.
//
// Both return the exact shape server/exercises/*.js already produce, so a
// caller can drop one in next to the hand-written generators:
//   { type, difficulty, dir, question, answer, hint }
//
// This file is the LIVE side: tooling, mining, and experiments. The app never
// imports it -- see pool.js for what mathGenerator.js actually calls.

import { RNG } from './tensor.js';
import { loadCheckpoint } from './model.js';
import { tokenizer } from './tokenizer.js';
import { generateExercises } from './generate.js';
import { toExercise } from './fill.js';

/**
 * Load a checkpoint, refusing one that was trained against a different
 * vocabulary. Editing lexicon.js shifts every token id, which would otherwise
 * turn a stale checkpoint into confident gibberish instead of an error.
 */
export function loadModel(ckpt) {
  const obj = typeof ckpt === 'string' ? JSON.parse(ckpt) : ckpt;
  const trained = obj.meta?.vocabHash;
  const current = tokenizer.vocabHash();
  if (trained && trained !== current) {
    throw new Error(
      `checkpoint was trained on vocabulary ${trained} but lexicon.js now hashes to ${current}. ` +
      'Retrain with: node server/ml/train.js');
  }
  if (obj.meta?.vocabSize && obj.meta.vocabSize !== tokenizer.size) {
    throw new Error(`checkpoint vocab ${obj.meta.vocabSize} != current ${tokenizer.size}`);
  }
  return loadCheckpoint(obj);
}

// -- live sampling -----------------------------------------------------------

/**
 * One validated word problem, or null.
 *
 * @param model      from loadModel()
 * @param {object} o
 * @param {'he'|'en'} o.lang
 * @param {'add'|'sub'} o.op
 * @param {number} o.max     largest number to use (match the child's level)
 * @param {RNG}    o.rng
 * @returns {object|null} an exercise, or null -- callers must fall back
 */
export function neuralWordProblem(model, { lang = 'he', op = 'add', max = 20, maxB = Infinity, rng = new RNG(1), poolSize = 24 } = {}) {
  const l = `<${lang}>`, t = `<${op}>`;
  const { items } = generateExercises(model, { lang: l, task: t, count: 1, max, maxB, rng, poolSize, rounds: 3 });
  return items.length ? toExercise(l, t, items[0]) : null;
}

/** One validated Hebrew reading sentence, or null. */
export function neuralReadingSentence(model, { rng = new RNG(1), poolSize = 16 } = {}) {
  const { items } = generateExercises(model, { lang: '<he>', task: '<read>', count: 1, rng, poolSize, rounds: 3 });
  return items.length ? items[0].sentence : null;
}

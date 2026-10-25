// -- End to end: is the answer to the question actually right? ---------------
//
// Every other test checks a component. This one checks the claim the whole
// design exists to support: that an exercise the app puts on screen has the
// correct answer attached to it.
//
// It goes through the exact path the app uses -- mathGenerator.js, which calls
// pool.js -- and then reads the numbers back out of the finished question
// string, the way a child reads them, and does the arithmetic itself. Nothing
// here trusts fillSlots, the validator, or the model.
//
// Requires skeletons.js (npm run lexi:mine).
//
//   node server/ml/e2e.test.js

import { RNG } from './tensor.js';
import { lexiWordProblem, LEXI_INFO } from './pool.js';
import { grammarHash } from './patterns.js';
import { validateSkeleton } from './generate.js';
import { tokenizer } from './tokenizer.js';
import { ITEM_TOKENS } from './lexicon.js';
import { POOL } from './skeletons.js';
import {
  generateMathExercises, generatePrepMath, generateTopicMath, MATH_LEVELS,
} from '../exercises/mathGenerator.js';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`);
  if (!ok) failures++;
}

// -- 1. the shipped pool is not stale ----------------------------------------
// vocabHash catches a changed token inventory; grammarHash catches a changed
// gender tag or frame, which the vocab hash cannot see. Both must match, or the
// pool holds sentences the grammar can no longer produce.
check('pool matches the current vocabulary', POOL.meta.vocabHash === tokenizer.vocabHash(),
  `${POOL.meta.vocabHash} vs ${tokenizer.vocabHash()}`);
check('pool matches the current grammar', POOL.meta.grammarHash === grammarHash(),
  `${POOL.meta.grammarHash} vs ${grammarHash()}`);

// -- 2. every shipped skeleton still passes every gate ------------------------
{
  const bad = [];
  let n = 0;
  for (const [key, bodies] of Object.entries(POOL.skeletons)) {
    const [lang, task] = key.split(' ');
    for (const body of bodies) {
      n++;
      const toks = ['<bos>', lang, task, ...body.split(' '), '<eos>'];
      const v = validateSkeleton(toks);
      if (!v.ok && bad.length < 3) bad.push(`${v.reason}  ::  ${body}`);
      else if (!v.ok) bad.push(null);
    }
  }
  check('every shipped sentence re-passes the validator', bad.length === 0, `${n - bad.length}/${n}`);
  for (const b of bad.filter(Boolean)) console.log(`        ${b}`);
}

// -- 3. the arithmetic, through the real app path -----------------------------
const rng = new RNG(31337);
const problems = [];

// (a) straight from the pool, across every level the app offers
for (const op of ['add', 'sub']) {
  for (const max of MATH_LEVELS) {
    for (let i = 0; i < 120; i++) {
      const ex = lexiWordProblem({ lang: 'he', op, max, rng });
      if (ex) problems.push({ ex, op, max, maxB: Infinity });
    }
  }
}
// (b) and through mathGenerator, which is what actually runs in the app
for (let i = 0; i < 150; i++) {
  const batch = [
    ...generateMathExercises({}, [], null, 'mix'),          // the mixed track
    ...generateMathExercises({}, [], 30, 'mix'),            // a math level
    ...generatePrepMath('gan_to_a', 3, [], 'mix'),
    ...generatePrepMath('a_to_b', 2, [], 'mix'),
    ...generateTopicMath('word', {}, []),
  ];
  for (const ex of batch) {
    if (ex.type === 'word_add') problems.push({ ex, op: 'add', max: Infinity, maxB: Infinity });
    if (ex.type === 'word_sub') problems.push({ ex, op: 'sub', max: Infinity, maxB: Infinity });
  }
}

check('the app path produced word problems', problems.length > 500, `${problems.length}`);

let wrongAnswer = 0, wrongCount = 0, outOfRange = 0, badHint = 0, badShape = 0, fromLexi = 0;
const firstBad = [];

for (const { ex, op, max } of problems) {
  if (ex.source === 'lexi') fromLexi++;
  const digits = (ex.question.match(/\d+/g) || []).map(Number);
  if (digits.length !== 2) {
    wrongCount++;
    if (firstBad.length < 5) firstBad.push(`${digits.length} numbers in "${ex.question}"`);
    continue;
  }
  const [a, b] = digits;                      // <a> always precedes <b> -- enforced by the validator
  const expected = op === 'add' ? a + b : a - b;

  if (ex.answer !== expected) {
    wrongAnswer++;
    if (firstBad.length < 5) firstBad.push(`answer ${ex.answer} != ${a}${op === 'add' ? '+' : '-'}${b}  ::  ${ex.question}`);
  }
  if (op === 'add' && Number.isFinite(max) && ex.answer > Math.max(4, max)) outOfRange++;
  if (op === 'sub' && ex.answer < 1) outOfRange++;
  if (ex.hint !== `${a} ${op === 'add' ? '+' : '-'} ${b}`) badHint++;
  if (ex.dir !== 'rtl' || !ex.type || ex.difficulty !== 3) badShape++;
}

check('most word problems now come from Lexi', fromLexi > problems.length * 0.9,
  `${fromLexi}/${problems.length} (${(100 * fromLexi / problems.length).toFixed(1)}%)`);
check('every question contains exactly two numbers', wrongCount === 0, `${wrongCount} bad`);
check('every answer matches the arithmetic in its own question text', wrongAnswer === 0,
  `${wrongAnswer} wrong of ${problems.length}`);
check('every answer respects its ceiling / stays positive', outOfRange === 0, `${outOfRange} out of range`);
check('every hint matches the numbers in the question', badHint === 0, `${badHint} mismatched`);
check('every exercise carries the shape the app expects', badShape === 0, `${badShape} malformed`);
for (const b of firstBad) console.log(`        ${b}`);

// -- 4. the mixed track never subtracts more than 9 ---------------------------
// A rule the app shipped deliberately in v1.3.3. It has to survive the switch to
// Lexi, and it is not visible anywhere in the model.
{
  let n = 0, over = 0, worst = 0;
  for (let i = 0; i < 300; i++) {
    for (const ex of generateMathExercises({}, [], null, 'mix')) {
      if (ex.type !== 'word_sub') continue;
      const b = (ex.question.match(/\d+/g) || []).map(Number)[1];
      n++; worst = Math.max(worst, b);
      if (b > 9) over++;
    }
  }
  check('the mixed track still never subtracts more than 9', over === 0 && n > 0,
    `${n} subtractions, largest second operand ${worst}`);
}

// -- 5. plural agreement ------------------------------------------------------
// "1 candies" / "1 ציורים". Checked against the real noun list rather than by
// guessing which words are nouns -- and self-checked, because an earlier version
// of this used \S+ and silently swallowed the exact case it was written for.
const oneThenNoun = (q) => {
  const m = q.match(/(?:^|\s)1\s+([^\s.,?]+)/);
  return m ? ITEM_TOKENS.has(m[1]) : false;
};
{
  const selfCheck = ['Zoe has 1 candies. How many?', 'לשירה 1 ציורים, קיבלה עוד 3.'].every(oneThenNoun)
    && !['Sam gives 1 to Ava.', 'Dan gets 1 more.', 'Ava has 2 hats.'].some(oneThenNoun);
  check('(the plural check itself fires when it should)', selfCheck);
  const offenders = problems.map(({ ex }) => ex.question).filter(oneThenNoun);
  check('no plural noun follows the number 1', offenders.length === 0, `${offenders.length} of ${problems.length}`);
  for (const e of offenders.slice(0, 3)) console.log(`        ${e}`);
}

// -- 6. variety, which is the entire point ------------------------------------
{
  const distinct = new Set(problems.map((p) => p.ex.question));
  const ratio = distinct.size / problems.length;
  check('questions rarely repeat', ratio > 0.85,
    `${distinct.size} distinct of ${problems.length} (${(100 * ratio).toFixed(1)}%)`);

  // The thing this replaced: six fixed sentences per operation.
  const shapes = new Set(problems.map((p) => p.ex.question.replace(/\d+/g, '#')));
  check('phrasing variety beats the six templates it replaced', shapes.size > 200,
    `${shapes.size} distinct phrasings (${LEXI_INFO.total} skeletons shipped)`);
}

console.log(failures ? `\n${failures} FAILED` : '\nPASS');
process.exit(failures ? 1 : 0);

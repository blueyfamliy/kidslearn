// -- The test that matters ---------------------------------------------------
//
// The model is allowed to be wrong. The validator is not. Everything a child
// ever sees passes through validateSkeleton, so this file is the real contract:
// hand-written good sentences must survive, and every failure mode observed
// from the actual model must be caught.
//
// Every BAD case below was produced by a real checkpoint, not invented. The two
// marked WRONG ANSWER are the ones that matter most -- they are fluent, they
// look right, and the arithmetic attached to them is false.
//
//   node server/ml/validator.test.js

import { validateSkeleton } from './generate.js';
import { RNG } from './tensor.js';
import { MODES, sampleSequence } from './corpus.js';

let failures = 0;

function expect(shouldPass, label, lang, task, body) {
  const toks = ['<bos>', lang, task, ...body.split(/\s+/), '<eos>'];
  const v = validateSkeleton(toks);
  const ok = v.ok === shouldPass;
  if (!ok) failures++;
  const verdict = v.ok ? 'accepted' : `rejected (${v.reason})`;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${shouldPass ? 'GOOD' : 'BAD '}  ${label.padEnd(34)} ${verdict}`);
}

const good = (...a) => expect(true, ...a);
const bad = (...a) => expect(false, ...a);

console.log('-- must be ACCEPTED --------------------------------------------------');
good('he add, possessive frame',   '<he>', '<add>', 'לרונה <a> בלונים , הביאה עוד <b> . כמה בלונים יש לה עכשיו ?');
good('he add, total phrasing',     '<he>', '<add>', 'לאדם <a> קוביות , הוסיף עוד <b> . כמה קוביות יש לו בסך הכל ?');
good('he add, two children',       '<he>', '<add>', 'לדין <a> קוביות ולליה <b> קוביות . כמה קוביות יש להם ביחד ?');
good('he add, container frame',    '<he>', '<add>', 'בקופסה יש <a> מכוניות , הוסיפו עוד <b> . כמה מכוניות יש עכשיו ?');
good('he add, had-then frame',     '<he>', '<add>', 'ליובל היו <a> בלוטים , הוא קנה עוד <b> . כמה בלוטים יש לו עכשיו ?');
good('he sub, named recipient',    '<he>', '<sub>', 'לרוני <a> סוכריות , נתנה <b> לאחיה . כמה סוכריות נשארו לה ?');
good('he sub, standalone verb',    '<he>', '<sub>', 'לדני היו <a> תותים , הוא זרק <b> . כמה תותים נשארו לו ?');
good('he sub, container frame',    '<he>', '<sub>', 'במגש היו <a> בננות , הוציאו <b> . כמה בננות נשארו ?');
good('en add, gets more',          '<en>', '<add>', 'Dan has <a> apples and gets <b> more . how many apples does Dan have now ?');
good('en add, two children',       '<en>', '<add>', 'Sam has <a> flowers and Ella has <b> flowers . how many flowers do they have together ?');
good('en add, container frame',    '<en>', '<add>', 'there are <a> apples in the garden . someone adds <b> more . how many apples are there now ?');
good('en sub, anonymous friend',   '<en>', '<sub>', 'Adam has <a> cookies and gives <b> to a friend . how many cookies are left ?');
good('en sub, named recipient',    '<en>', '<sub>', 'Ava has <a> bricks and gives <b> to Ivy . how many bricks does Ava have now ?');
good('he read, place',             '<he>', '<read>', 'הכלב רץ בגינה .');
good('he read, direct object',     '<he>', '<read>', 'הילדה אוכלת את התפוח .');
good('he read, object-required v', '<he>', '<read>', 'התוכי מחזיק את הכדור .');
good('he read, swimming in water', '<he>', '<read>', 'הדג שוחה בים .');

console.log('');
console.log('-- must be REJECTED --------------------------------------------------');
// These two are the whole point of the exercise: fluent, plausible, and the
// arithmetic the app would attach to them is wrong.
bad('WRONG ANSWER: sums two things', '<he>', '<add>', 'לליה <a> קונכיות ולרועי <b> בלונים . כמה קונכיות יש להם ביחד ?');
bad('WRONG ANSWER: asks re a third', '<en>', '<sub>', 'Tom has <a> blocks and gives <b> to Noa . how many blocks does Maya have now ?');

bad('gives to itself',              '<en>', '<sub>', 'Tom has <a> blocks and gives <b> to Tom . how many blocks does Tom have now ?');
bad('dropped "they"',               '<en>', '<add>', 'Finn has <a> cookies and Maya has <b> cookies . how many cookies do have together ?');
bad('two children, no "together"',  '<he>', '<add>', 'לתמר <a> מכוניות ולמאיה <b> מכוניות . כמה מכוניות יש להם ?');
bad('verb / name gender clash',     '<he>', '<add>', 'לרונה <a> בלונים , הביא עוד <b> . כמה בלונים יש לה עכשיו ?');
bad('clitic / name gender clash',   '<he>', '<add>', 'לדני <a> בלונים , הביא עוד <b> . כמה בלונים יש לה עכשיו ?');
bad('add problem asking what is left', '<he>', '<add>', 'לדני <a> תפוחים , קיבל עוד <b> . כמה תפוחים נשארו לו ?');
bad('sub problem that adds',        '<he>', '<sub>', 'לדני <a> תפוחים , קיבל עוד <b> . כמה תפוחים נשארו לו ?');
bad('slots out of order',           '<he>', '<add>', 'לדני <b> תפוחים , קיבל עוד <a> . כמה תפוחים יש לו עכשיו ?');
bad('duplicate slot',               '<he>', '<add>', 'לדני <a> תפוחים , קיבל עוד <a> . כמה תפוחים יש לו עכשיו ?');
bad('no question mark',             '<he>', '<add>', 'לדני <a> תפוחים , קיבל עוד <b> . כמה תפוחים יש לו עכשיו');
bad('no numbers at all',            '<he>', '<add>', 'לדני תפוחים , קיבל עוד . כמה תפוחים יש לו עכשיו ?');
bad('intransitive verb + object',   '<he>', '<read>', 'סבא משחק את הגלידה .');
bad('object-required verb, no object', '<he>', '<read>', 'התוכי מחזיק בפארק .');
bad('swimming on the bed',          '<he>', '<read>', 'אמא שוחה על המיטה .');
bad('water place, nobody swimming', '<he>', '<read>', 'הכלב רץ בים .');
bad('reading sentence with a slot', '<he>', '<read>', 'הכלב רץ <a> בגינה .');
bad('reading sentence as question', '<he>', '<read>', 'הכלב רץ בגינה ?');
bad('control token in the body',    '<he>', '<add>', 'לדני <a> תפוחים <he> קיבל עוד <b> . כמה תפוחים יש לו עכשיו ?');
bad('English words, Hebrew frame',  '<he>', '<add>', 'Dan has <a> apples and gets <b> more . how many apples does Dan have now ?');

// -- the validator must not be stricter than the grammar ---------------------
//
// A validator that rejects sentences the grammar itself produces would make the
// model unusable no matter how well it trained -- and it would fail quietly, as
// a low acceptance rate that looks like an undertrained model. So: sample the
// grammar hard and require every single sentence through.
//
// This also covers the pattern enumeration in patterns.js, which stops sampling
// once it converges. If that stopped too early and missed a rare frame or
// question variant, sentences using it would be rejected here.
console.log('');
console.log('-- every sentence the grammar produces must be accepted ---------------');
{
  const rng = new RNG(9091);
  const perMode = 4000;
  for (const mode of MODES) {
    const rejects = [];
    for (let i = 0; i < perMode; i++) {
      const seq = sampleSequence(rng, mode);
      const v = validateSkeleton(seq);
      if (!v.ok && rejects.length < 3) rejects.push(`${v.reason}  ::  ${seq.slice(3, -1).join(' ')}`);
      else if (!v.ok) rejects.push(null);
    }
    const n = rejects.length;
    if (n) failures++;
    console.log(`${n ? 'FAIL' : 'ok  '}  ${mode.key.padEnd(10)} ${perMode - n}/${perMode} accepted`);
    for (const b of rejects.filter(Boolean)) console.log(`        ${b}`);
  }
}

console.log('');
console.log(failures ? `${failures} FAILED` : 'PASS');
process.exit(failures ? 1 : 0);

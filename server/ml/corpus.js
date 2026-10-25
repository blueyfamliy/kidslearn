// -- Training corpus -----------------------------------------------------------
//
// A compositional grammar over lexicon.js. Every sample is a SKELETON: a whole
// sentence with <a> and <b> standing in for the two numbers. The model learns
// how KidsLearn sentences are shaped -- who does what to how many of which
// thing, and how the question at the end refers back to it -- and never learns
// arithmetic, because it never sees a digit.
//
// Be clear about the ceiling this implies: the model cannot say anything this
// grammar could not have said. What it buys is smoothing and recombination --
// the twelve hardcoded templates in mathGenerator.js become a learned
// distribution over a space of hundreds of thousands of well-formed variants,
// and the same weights serve Hebrew, English, addition, subtraction and reading
// practice from one 320-word vocabulary.
//
// Sequence layout:  <bos> <lang> <task> ...body... <eos>

import {
  HE_NAMES, HE_NAMES_POSS, HE_NAMES_POSS_AND, HE_ITEMS, HE_CONTAINERS,
  HE_ADD_VERBS, HE_SUB_VERBS, HE_ADD_VERBS_PL, HE_SUB_VERBS_PL, HE_RECIPIENTS,
  HE_READ_SUBJECTS, HE_READ_VERBS, HE_READ_PLACES, HE_READ_OBJECTS,
  EN_NAMES, EN_ITEMS, EN_CONTAINERS,
} from './lexicon.js';

const w = (s) => s.split(/\s+/).filter(Boolean);   // multi-word bank entry -> tokens

// Index names by gender once, so a frame can pick a second child of any gender
// without rejection-sampling.
const HE_BY_G = { m: HE_NAMES.filter((n) => n.g === 'm'), f: HE_NAMES.filter((n) => n.g === 'f') };
const POSS_OF = new Map(HE_NAMES_POSS.map((n) => [n.base, n.w]));
const POSS_AND_OF = new Map(HE_NAMES_POSS_AND.map((n) => [n.base, n.w]));

const CLITIC = { m: 'לו', f: 'לה' };     // "to him" / "to her"
const PRONOUN = { m: 'הוא', f: 'היא' };

// -- Hebrew: addition ---------------------------------------------------------

function heAddPersonalQuestion(rng, item, g) {
  return rng.next() < 0.35
    ? ['כמה', item, 'יש', CLITIC[g], 'בסך', 'הכל', '?']
    : ['כמה', item, 'יש', CLITIC[g], 'עכשיו', '?'];
}

const HE_ADD_FRAMES = [
  // לדני 7 בלונים, קיבל עוד 3. כמה בלונים יש לו עכשיו?
  (rng) => {
    const n = rng.pick(HE_NAMES), it = rng.pick(HE_ITEMS), v = rng.pick(HE_ADD_VERBS);
    return [POSS_OF.get(n.w), '<a>', it.w, ',', v[n.g], 'עוד', '<b>', '.',
            ...heAddPersonalQuestion(rng, it.w, n.g)];
  },
  // נועה אספה 7 צדפים, ואז עוד 3. כמה צדפים יש לה עכשיו?
  (rng) => {
    const n = rng.pick(HE_NAMES), it = rng.pick(HE_ITEMS), v = rng.pick(HE_ADD_VERBS);
    return [n.w, v[n.g], '<a>', it.w, ',', 'ואז', 'עוד', '<b>', '.',
            ...heAddPersonalQuestion(rng, it.w, n.g)];
  },
  // בסל יש 7 תפוחים, הוסיפו עוד 3. כמה תפוחים יש עכשיו?
  (rng) => {
    const c = rng.pick(HE_CONTAINERS), it = rng.pick(HE_ITEMS), v = rng.pick(HE_ADD_VERBS_PL);
    const q = rng.next() < 0.4
      ? ['כמה', it.w, 'יש', 'ביחד', '?']
      : ['כמה', it.w, 'יש', 'עכשיו', '?'];
    return [...w(c), 'יש', '<a>', it.w, ',', v, 'עוד', '<b>', '.', ...q];
  },
  // לתום היו 7 גולות, הוא מצא עוד 3. כמה גולות יש לו עכשיו?
  (rng) => {
    const n = rng.pick(HE_NAMES), it = rng.pick(HE_ITEMS), v = rng.pick(HE_ADD_VERBS);
    return [POSS_OF.get(n.w), 'היו', '<a>', it.w, ',', PRONOUN[n.g], v[n.g], 'עוד', '<b>', '.',
            ...heAddPersonalQuestion(rng, it.w, n.g)];
  },
  // לדין 7 קוביות ולליה 3 קוביות. כמה קוביות יש להם ביחד?
  (rng) => {
    const n1 = rng.pick(HE_NAMES);
    const n2 = rng.pick(rng.next() < 0.5 ? HE_BY_G.m : HE_BY_G.f);
    if (n2.w === n1.w) return null;                 // same child twice reads badly
    const it = rng.pick(HE_ITEMS);
    return [POSS_OF.get(n1.w), '<a>', it.w, POSS_AND_OF.get(n2.w), '<b>', it.w, '.',
            'כמה', it.w, 'יש', 'להם', 'ביחד', '?'];
  },
];

// -- Hebrew: subtraction ------------------------------------------------------

function heLeftQuestion(rng, item, g) {
  return rng.next() < 0.3
    ? ['כמה', item, 'נשארו', '?']
    : ['כמה', item, 'נשארו', CLITIC[g], '?'];
}

const HE_SUB_FRAMES = [
  // לרוני 9 סוכריות, נתנה 4 לאחיה. כמה סוכריות נשארו לה?
  (rng) => {
    const n = rng.pick(HE_NAMES), it = rng.pick(HE_ITEMS);
    const v = rng.pick(HE_SUB_VERBS.filter((x) => x.takesRecipient));
    // "to his brother" must match the giver; the neutral recipients never clash.
    const r = rng.pick(HE_RECIPIENTS.filter((x) => x.g === null || x.g === n.g));
    return [POSS_OF.get(n.w), '<a>', it.w, ',', v[n.g], '<b>', r.w, '.',
            ...heLeftQuestion(rng, it.w, n.g)];
  },
  // לתום היו 9 עוגיות, הוא אכל 4. כמה עוגיות נשארו לו?
  // Only standalone verbs here: "הוא מסר 4" is missing its indirect object.
  (rng) => {
    const n = rng.pick(HE_NAMES), it = rng.pick(HE_ITEMS);
    const v = rng.pick(HE_SUB_VERBS.filter((x) => x.standalone && (!x.food || it.food)));
    return [POSS_OF.get(n.w), 'היו', '<a>', it.w, ',', PRONOUN[n.g], v[n.g], '<b>', '.',
            ...heLeftQuestion(rng, it.w, n.g)];
  },
  // בחנות היו 9 ספרים, לקחו 4. כמה ספרים נשארו?
  (rng) => {
    const c = rng.pick(HE_CONTAINERS), it = rng.pick(HE_ITEMS), v = rng.pick(HE_SUB_VERBS_PL);
    return [...w(c), 'היו', '<a>', it.w, ',', v, '<b>', '.', 'כמה', it.w, 'נשארו', '?'];
  },
  // למאיה 9 מדבקות, איבדה 4. כמה מדבקות נשארו לה?
  (rng) => {
    const n = rng.pick(HE_NAMES), it = rng.pick(HE_ITEMS);
    const v = rng.pick(HE_SUB_VERBS.filter((x) => x.standalone && (!x.food || it.food)));
    return [POSS_OF.get(n.w), '<a>', it.w, ',', v[n.g], '<b>', '.',
            ...heLeftQuestion(rng, it.w, n.g)];
  },
];

// -- Hebrew: reading practice (no numbers) ------------------------------------

/**
 * Pick a place that fits both the subject and the verb: a horse does not sit on
 * a chair, and nothing swims in a park.
 */
function placeFor(rng, subject, verb) {
  let ps = HE_READ_PLACES;
  if (subject.big) ps = ps.filter((p) => !p.furniture);
  ps = verb.water ? ps.filter((p) => p.water) : ps.filter((p) => !p.water);
  return rng.pick(ps);
}

const HE_READ_FRAMES = [
  // הכלב רץ בגינה. -- any verb that can stand without an object
  (rng) => {
    const s = rng.pick(HE_READ_SUBJECTS);
    const v = rng.pick(HE_READ_VERBS.filter((x) => !x.objectRequired));
    return [s.w, v[s.g], ...w(placeFor(rng, s, v).w), '.'];
  },
  // הילדה אוכלת את התפוח. -- any verb that can take one
  (rng) => {
    const s = rng.pick(HE_READ_SUBJECTS);
    const v = rng.pick(HE_READ_VERBS.filter((x) => x.transitive || x.objectRequired));
    const o = rng.pick(HE_READ_OBJECTS);
    return [s.w, v[s.g], 'את', o, '.'];
  },
  // הארנב ישן על המיטה. -- intransitive only, so places carry the variety
  (rng) => {
    const s = rng.pick(HE_READ_SUBJECTS);
    const v = rng.pick(HE_READ_VERBS.filter((x) => !x.transitive && !x.objectRequired));
    return [s.w, v[s.g], ...w(placeFor(rng, s, v).w), '.'];
  },
];

// -- English ------------------------------------------------------------------

const EN_ADD_FRAMES = [
  (rng) => {
    const n = rng.pick(EN_NAMES), it = rng.pick(EN_ITEMS);
    return [n, 'has', '<a>', it, 'and', 'gets', '<b>', 'more', '.',
            'how', 'many', it, 'does', n, 'have', 'now', '?'];
  },
  (rng) => {
    const c = rng.pick(EN_CONTAINERS), it = rng.pick(EN_ITEMS);
    return ['there', 'are', '<a>', it, c.prep, 'the', c.w, '.', 'someone', 'adds', '<b>', 'more', '.',
            'how', 'many', it, 'are', 'there', 'now', '?'];
  },
  (rng) => {
    const n = rng.pick(EN_NAMES), it = rng.pick(EN_ITEMS);
    return [n, 'finds', '<a>', it, 'and', 'then', '<b>', 'more', '.',
            'how', 'many', it, 'altogether', '?'];
  },
  (rng) => {
    const n1 = rng.pick(EN_NAMES), n2 = rng.pick(EN_NAMES);
    if (n1 === n2) return null;
    const it = rng.pick(EN_ITEMS);
    return [n1, 'has', '<a>', it, 'and', n2, 'has', '<b>', it, '.',
            'how', 'many', it, 'do', 'they', 'have', 'together', '?'];
  },
];

const EN_SUB_FRAMES = [
  (rng) => {
    const n = rng.pick(EN_NAMES), it = rng.pick(EN_ITEMS);
    return [n, 'has', '<a>', it, 'and', 'gives', '<b>', 'to', 'a', 'friend', '.',
            'how', 'many', it, 'are', 'left', '?'];
  },
  (rng) => {
    const c = rng.pick(EN_CONTAINERS), it = rng.pick(EN_ITEMS);
    return ['there', 'are', '<a>', it, c.prep, 'the', c.w, '.', 'someone', 'takes', '<b>', 'of', 'them', '.',
            'how', 'many', it, 'are', 'left', '?'];
  },
  (rng) => {
    const n = rng.pick(EN_NAMES), it = rng.pick(EN_ITEMS);
    return [n, 'had', '<a>', it, 'and', 'lost', '<b>', '.',
            'how', 'many', it, 'does', n, 'have', 'now', '?'];
  },
  (rng) => {
    const n1 = rng.pick(EN_NAMES), n2 = rng.pick(EN_NAMES);
    if (n1 === n2) return null;
    const it = rng.pick(EN_ITEMS);
    return [n1, 'has', '<a>', it, 'and', 'gives', '<b>', 'to', n2, '.',
            'how', 'many', it, 'does', n1, 'have', 'now', '?'];
  },
];

// -- Assembly -----------------------------------------------------------------

/**
 * Every (lang, task) pair the model is trained to condition on.
 *
 * `weight` is the share of TRAINING BATCHES the mode gets, not its share of the
 * corpus -- the two differ a lot here. English subtraction has a combinatorial
 * space of a couple of thousand sentences while Hebrew addition has hundreds of
 * thousands, so a globally deduplicated corpus would show the model Hebrew ~17x
 * more often than English purely as an artefact of how big each grammar is.
 * The trainer picks a mode by weight first, then a sample within it.
 */
export const MODES = [
  { key: 'he_add',  lang: '<he>', task: '<add>',  frames: HE_ADD_FRAMES,  weight: 3 },
  { key: 'he_sub',  lang: '<he>', task: '<sub>',  frames: HE_SUB_FRAMES,  weight: 3 },
  { key: 'he_read', lang: '<he>', task: '<read>', frames: HE_READ_FRAMES, weight: 2 },
  { key: 'en_add',  lang: '<en>', task: '<add>',  frames: EN_ADD_FRAMES,  weight: 2 },
  { key: 'en_sub',  lang: '<en>', task: '<sub>',  frames: EN_SUB_FRAMES,  weight: 2 },
];

/** One random skeleton from one mode, wrapped in its control prefix. */
export function sampleSequence(rng, mode) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const body = rng.pick(mode.frames)(rng);
    if (body) return ['<bos>', mode.lang, mode.task, ...body, '<eos>'];
  }
  throw new Error(`grammar for ${mode.key} rejected 30 draws in a row -- a frame is over-constrained`);
}

/**
 * Build a per-mode corpus, deduplicated within each mode and split into train
 * and validation. Validation sentences are held out entirely, so val loss says
 * something real about unseen combinations rather than about memorisation.
 *
 * @returns {{modes: Array, maxLen: number, totalUnique: number}}
 */
export function buildCorpus(rng, perMode, valFraction = 0.05) {
  let maxLen = 0, totalUnique = 0;
  const modes = MODES.map((mode) => {
    const seen = new Set();
    const samples = [];
    const budget = perMode * 40;
    for (let attempts = 0; samples.length < perMode && attempts < budget; attempts++) {
      const s = sampleSequence(rng, mode);
      const key = s.join(' ');
      if (seen.has(key)) continue;
      seen.add(key);
      samples.push(s);
      if (s.length > maxLen) maxLen = s.length;
    }
    rng.shuffle(samples);
    const nVal = Math.max(1, Math.round(samples.length * valFraction));
    totalUnique += samples.length;
    return { ...mode, train: samples.slice(nVal), val: samples.slice(0, nVal), unique: samples.length };
  });
  return { modes, maxLen, totalUnique };
}

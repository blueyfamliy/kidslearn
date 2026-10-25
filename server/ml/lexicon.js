// -- The closed world the model is allowed to talk about ---------------------
//
// Every token Lexi can ever emit is declared here, with the metadata the
// validator needs: grammatical gender for Hebrew agreement, and an edible/not
// tag so nobody ends up eating three pencils.
//
// Two rules keep this file honest:
//   1. corpus.js may only compose sentences from these banks;
//   2. tokenizer.js derives the vocabulary from this file alone, sorted, so
//      token ids are stable and a checkpoint stays loadable.
//
// gender: 'm' | 'f' | null (null = neutral, agrees with anything)

// -- Special tokens ----------------------------------------------------------
// Ids 0..N are pinned by order here; everything else is sorted alphabetically.
export const SPECIALS = [
  '<pad>',   // 0 -- also the ignore index target
  '<bos>',
  '<eos>',
  '<unk>',
  '<he>', '<en>',            // language control
  '<add>', '<sub>', '<read>', // task control
  '<a>', '<b>',              // number slots -- the model never writes digits
];

export const LANG_TOKENS = ['<he>', '<en>'];
export const TASK_TOKENS = ['<add>', '<sub>', '<read>'];
export const SLOT_TOKENS = ['<a>', '<b>'];

// -- Hebrew ------------------------------------------------------------------

// `poss` is the "to X" possessive form used as a sentence opener.
export const HE_NAMES = [
  { w: 'דין', g: 'm' }, { w: 'דני', g: 'm' }, { w: 'יובל', g: 'm' }, { w: 'תום', g: 'm' },
  { w: 'איתי', g: 'm' }, { w: 'נועם', g: 'm' }, { w: 'אורי', g: 'm' }, { w: 'גיא', g: 'm' },
  { w: 'רועי', g: 'm' }, { w: 'אלון', g: 'm' }, { w: 'עידו', g: 'm' }, { w: 'ליאם', g: 'm' },
  { w: 'אדם', g: 'm' }, { w: 'שחר', g: 'm' },
  { w: 'ליה', g: 'f' }, { w: 'רונה', g: 'f' }, { w: 'נועה', g: 'f' }, { w: 'שירה', g: 'f' },
  { w: 'מאיה', g: 'f' }, { w: 'תמר', g: 'f' }, { w: 'יעל', g: 'f' }, { w: 'אביגיל', g: 'f' },
  { w: 'הילה', g: 'f' }, { w: 'רוני', g: 'f' }, { w: 'אלה', g: 'f' }, { w: 'טליה', g: 'f' },
  { w: 'עדי', g: 'f' },
];

// Possessive opener: the name with a ל prefix, written as its own token.
export const HE_NAMES_POSS = HE_NAMES.map((n) => ({ w: 'ל' + n.w, g: n.g, base: n.w }));
// "and to X" -- the second party in the two-children frame.
export const HE_NAMES_POSS_AND = HE_NAMES.map((n) => ({ w: 'ול' + n.w, g: n.g, base: n.w }));

// `food: true` gates the verbs that only make sense with something edible.
export const HE_ITEMS = [
  { w: 'תפוחים', food: true }, { w: 'תותים', food: true }, { w: 'סוכריות', food: true },
  { w: 'עוגיות', food: true }, { w: 'בננות', food: true }, { w: 'ממתקים', food: true },
  { w: 'גלידות', food: true }, { w: 'תפוזים', food: true },
  { w: 'בלונים' }, { w: 'כדורים' }, { w: 'ספרים' }, { w: 'מדבקות' }, { w: 'עפרונות' },
  { w: 'גולות' }, { w: 'פרחים' }, { w: 'ציורים' }, { w: 'קוביות' }, { w: 'בובות' },
  { w: 'מכוניות' }, { w: 'אבנים' }, { w: 'קונכיות' }, { w: 'כובעים' }, { w: 'צדפים' },
  { w: 'בלוטים' },
];

// Openers for the impersonal frames. Multi-word entries are fine -- the
// tokenizer splits on spaces and each part enters the vocabulary separately.
export const HE_CONTAINERS = [
  'בסל', 'בקופסה', 'בכיתה', 'בגן', 'בחצר', 'בארון', 'במגירה', 'בתיק',
  'בצנצנת', 'במקרר', 'בגינה', 'באגרטל', 'בחנות', 'במגש', 'על השולחן', 'על הגג',
];

export const HE_ADD_VERBS = [
  { m: 'קיבל', f: 'קיבלה' }, { m: 'מצא', f: 'מצאה' }, { m: 'אסף', f: 'אספה' },
  { m: 'קנה', f: 'קנתה' }, { m: 'הוסיף', f: 'הוסיפה' }, { m: 'הביא', f: 'הביאה' },
  { m: 'ליקט', f: 'ליקטה' },
];

// takesRecipient: reads correctly when followed by "to <someone>".
// standalone:     reads correctly with NO recipient -- "he lost 4" is a whole
//                 sentence, "he handed over 4" is not.
// food:           only valid with an edible item.
export const HE_SUB_VERBS = [
  { m: 'נתן', f: 'נתנה', takesRecipient: true },
  { m: 'מסר', f: 'מסרה', takesRecipient: true },
  { m: 'חילק', f: 'חילקה', takesRecipient: true },
  { m: 'החזיר', f: 'החזירה', takesRecipient: true },
  { m: 'איבד', f: 'איבדה', standalone: true },
  { m: 'זרק', f: 'זרקה', standalone: true },
  { m: 'הפסיד', f: 'הפסידה', standalone: true },
  { m: 'אכל', f: 'אכלה', standalone: true, food: true },
];

export const HE_ADD_VERBS_PL = ['הוסיפו', 'הביאו', 'שמו', 'קנו'];
export const HE_SUB_VERBS_PL = ['לקחו', 'הוציאו'];

export const HE_RECIPIENTS = [
  { w: 'לאחיו', g: 'm' }, { w: 'לאחיה', g: 'f' },   // agrees with the giver
  { w: 'לחבר', g: null }, { w: 'לחברה', g: null }, { w: 'לשכן', g: null },
  { w: 'לאמא', g: null }, { w: 'לאבא', g: null }, { w: 'לגננת', g: null },
  { w: 'למורה', g: null },
];

// Reading-practice sentences: short, decodable, no numbers at all.
// `big: true` keeps horses and bears off the furniture.
export const HE_READ_SUBJECTS = [
  { w: 'הכלב', g: 'm' }, { w: 'החתול', g: 'm' }, { w: 'הילד', g: 'm' }, { w: 'הדג', g: 'm' },
  { w: 'הפרפר', g: 'm' }, { w: 'הארנב', g: 'm' }, { w: 'אבא', g: 'm' },
  { w: 'סבא', g: 'm' }, { w: 'התוכי', g: 'm' },
  { w: 'הדוב', g: 'm', big: true }, { w: 'הסוס', g: 'm', big: true },
  { w: 'הילדה', g: 'f' }, { w: 'הציפור', g: 'f' }, { w: 'אמא', g: 'f' },
  { w: 'סבתא', g: 'f' }, { w: 'החתולה', g: 'f' }, { w: 'הכלבה', g: 'f' }, { w: 'הדבורה', g: 'f' },
  { w: 'הפרה', g: 'f', big: true },
];

// transitive:     may take a direct object, and also stands on its own
//                 ("הכלב אוכל בגינה" is fine).
// objectRequired: makes no sense without one -- "התוכי מחזיק בפארק" is not a
//                 sentence, so this verb may only appear in the object frame.
// water:          only in a place you can swim.
export const HE_READ_VERBS = [
  { m: 'רץ', f: 'רצה' }, { m: 'ישן', f: 'ישנה' }, { m: 'קופץ', f: 'קופצת' },
  { m: 'שר', f: 'שרה' }, { m: 'צוחק', f: 'צוחקת' }, { m: 'משחק', f: 'משחקת' },
  { m: 'הולך', f: 'הולכת' }, { m: 'מחייך', f: 'מחייכת' },
  { m: 'שוחה', f: 'שוחה', water: true },
  // "הכלב אוכל בגינה" stands on its own; "הדג רואה ליד העץ" does not -- seeing
  // and holding both need something to see or hold.
  { m: 'אוכל', f: 'אוכלת', transitive: true },
  { m: 'שותה', f: 'שותה', transitive: true },
  { m: 'רואה', f: 'רואה', objectRequired: true },
  { m: 'מחזיק', f: 'מחזיקה', objectRequired: true },
];

// `furniture` places are only offered to subjects that could plausibly fit;
// `water` places are the only ones a swimming verb may go with.
export const HE_READ_PLACES = [
  { w: 'בגינה' }, { w: 'בבית' }, { w: 'בפארק' }, { w: 'בחצר' },
  { w: 'בגן' }, { w: 'בחדר' }, { w: 'ליד העץ' }, { w: 'בשדה' }, { w: 'על הדשא' },
  { w: 'בים', water: true }, { w: 'בבריכה', water: true },
  { w: 'על המיטה', furniture: true }, { w: 'על הכיסא', furniture: true },
  { w: 'על השטיח', furniture: true },
];

export const HE_READ_OBJECTS = ['הלחם', 'הכדור', 'הספר', 'התפוח', 'המים', 'הגלידה', 'העוגה'];

// -- English -----------------------------------------------------------------

export const EN_NAMES = [
  'Dan', 'Maya', 'Tom', 'Noa', 'Ben', 'Lily', 'Sam', 'Ella', 'Adam', 'Mia',
  'Leo', 'Ruby', 'Noah', 'Ava', 'Ivy', 'Max', 'Zoe', 'Eli', 'Nora', 'Finn',
];

export const EN_ITEMS = [
  'apples', 'balloons', 'balls', 'books', 'pencils', 'stickers', 'cookies', 'marbles',
  'shells', 'flowers', 'candies', 'crayons', 'stars', 'cars', 'blocks', 'hats',
  'buttons', 'leaves', 'coins', 'feathers', 'bricks', 'ribbons', 'seeds', 'keys',
];

// `prep` keeps "in the basket" and "on the shelf" from swapping places.
export const EN_CONTAINERS = [
  { w: 'box', prep: 'in' }, { w: 'basket', prep: 'in' }, { w: 'bag', prep: 'in' },
  { w: 'jar', prep: 'in' }, { w: 'garden', prep: 'in' }, { w: 'classroom', prep: 'in' },
  { w: 'table', prep: 'on' }, { w: 'shelf', prep: 'on' },
];

// -- Derived lookups (built once, used by corpus.js and generate.js) ---------

// Agreement is checked in two halves, because Hebrew only constrains one of
// them. "לדני 5 תפוחים ולליה 3 תפוחים" mixes a male and a female name and is
// perfectly good Hebrew -- names do not agree with each other. What must agree
// is every VERB, PRONOUN and clitic with the subject that governs it.

/** token -> 'm' | 'f' for tokens that ESTABLISH the subject's gender. */
export const SUBJECT_GENDER = (() => {
  const g = new Map();
  const put = (w, gg) => { if (gg) g.set(w, gg); };
  for (const n of HE_NAMES) put(n.w, n.g);
  for (const n of HE_NAMES_POSS) put(n.w, n.g);
  for (const s of HE_READ_SUBJECTS) put(s.w, s.g);
  return g;
})();

/** token -> 'm' | 'f' for tokens that must AGREE with the subject. */
export const AGREE_GENDER = (() => {
  const g = new Map();
  const put = (w, gg) => { if (gg) g.set(w, gg); };
  for (const r of HE_RECIPIENTS) put(r.w, r.g);
  for (const v of [...HE_ADD_VERBS, ...HE_SUB_VERBS, ...HE_READ_VERBS]) {
    // A form shared by both genders (שוחה, שותה) carries no signal.
    if (v.m === v.f) continue;
    put(v.m, 'm'); put(v.f, 'f');
  }
  put('הוא', 'm'); put('היא', 'f');
  put('לו', 'm'); put('לה', 'f');
  return g;
})();

/** Every plural-noun token, in either language -- used by the item-agreement check. */
export const ITEM_TOKENS = new Set([...HE_ITEMS.map((i) => i.w), ...EN_ITEMS]);

/**
 * token -> the child it refers to. "דני", "לדני" and "ולדני" are one person, so
 * a validator asking "is the question about the same child as the statement?"
 * has to compare bases, not surface forms.
 */
export const NAME_BASE = (() => {
  const m = new Map();
  for (const n of HE_NAMES) m.set(n.w, n.w);
  for (const n of HE_NAMES_POSS) m.set(n.w, n.base);
  for (const n of HE_NAMES_POSS_AND) m.set(n.w, n.base);
  for (const n of EN_NAMES) m.set(n, n);
  return m;
})();

/** Reading-practice verbs that need water, and the places that have it. */
export const WATER_VERBS = new Set(HE_READ_VERBS.filter((v) => v.water).flatMap((v) => [v.m, v.f]));
export const WATER_PLACES = new Set(HE_READ_PLACES.filter((p) => p.water).map((p) => p.w));

/** Subjects too big for furniture, and the furniture they must stay off. */
export const BIG_SUBJECTS = new Set(HE_READ_SUBJECTS.filter((s) => s.big).map((s) => s.w));
export const FURNITURE_PLACES = new Set(HE_READ_PLACES.filter((p) => p.furniture).map((p) => p.w));

/** Fixed glue words that appear in frames but belong to no bank. */
export const GLUE = [
  // Hebrew
  'יש', 'היו', 'עוד', 'ואז', 'כמה', 'עכשיו', 'ביחד', 'נשארו', 'בסך', 'הכל',
  'הוא', 'היא', 'לו', 'לה', 'להם', 'את',
  // English
  'has', 'have', 'had', 'and', 'gets', 'more', 'how', 'many', 'does', 'do', 'now',
  'there', 'are', 'in', 'on', 'the', 'a', 'someone', 'adds', 'finds', 'then',
  'altogether', 'they', 'together', 'gives', 'to', 'friend', 'left', 'lost',
  'takes', 'of', 'them',
  // punctuation
  ',', '.', '?',
];

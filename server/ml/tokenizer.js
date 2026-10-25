// -- Word-level tokenizer over a closed vocabulary ---------------------------
//
// Character-level would need a much bigger model to spell Hebrew correctly, and
// subwords would let the model invent non-words. A closed word vocabulary makes
// misspelling structurally impossible: the model picks whole words or nothing.
//
// Token ids are derived from lexicon.js alone and sorted, so they are stable
// across runs -- a checkpoint stays loadable as long as the lexicon does not
// change. It is fingerprinted for exactly that reason (see `vocabHash`).

import {
  SPECIALS, GLUE,
  HE_NAMES, HE_NAMES_POSS, HE_NAMES_POSS_AND, HE_ITEMS, HE_CONTAINERS,
  HE_ADD_VERBS, HE_SUB_VERBS, HE_ADD_VERBS_PL, HE_SUB_VERBS_PL, HE_RECIPIENTS,
  HE_READ_SUBJECTS, HE_READ_VERBS, HE_READ_PLACES, HE_READ_OBJECTS,
  EN_NAMES, EN_ITEMS, EN_CONTAINERS,
} from './lexicon.js';

const PUNCT = new Set([',', '.', '?', '!']);

/** Split a bank entry that may contain spaces into individual tokens. */
function words(s) { return s.split(/\s+/).filter(Boolean); }

function collectTokens() {
  const set = new Set();
  const add = (s) => { for (const w of words(s)) set.add(w); };

  for (const g of GLUE) add(g);
  for (const n of [...HE_NAMES, ...HE_NAMES_POSS, ...HE_NAMES_POSS_AND]) add(n.w);
  for (const i of HE_ITEMS) add(i.w);
  for (const c of HE_CONTAINERS) add(c);
  for (const v of [...HE_ADD_VERBS, ...HE_SUB_VERBS, ...HE_READ_VERBS]) { add(v.m); add(v.f); }
  for (const v of [...HE_ADD_VERBS_PL, ...HE_SUB_VERBS_PL]) add(v);
  for (const r of HE_RECIPIENTS) add(r.w);
  for (const s of HE_READ_SUBJECTS) add(s.w);
  for (const p of HE_READ_PLACES) add(p.w);
  for (const o of HE_READ_OBJECTS) add(o);
  for (const n of EN_NAMES) add(n);
  for (const i of EN_ITEMS) add(i);
  for (const c of EN_CONTAINERS) { add(c.w); add(c.prep); }

  // Specials are pinned to the front; make sure none leaked into the word set.
  for (const s of SPECIALS) set.delete(s);
  return [...SPECIALS, ...[...set].sort()];
}

export class Tokenizer {
  constructor() {
    this.tokens = collectTokens();
    this.ids = new Map(this.tokens.map((t, i) => [t, i]));
    this.pad = this.ids.get('<pad>');
    this.bos = this.ids.get('<bos>');
    this.eos = this.ids.get('<eos>');
    this.unk = this.ids.get('<unk>');
  }

  get size() { return this.tokens.length; }

  id(token) {
    const i = this.ids.get(token);
    return i === undefined ? this.unk : i;
  }

  has(token) { return this.ids.has(token); }
  token(id) { return this.tokens[id]; }

  /** @param {string[]} toks @returns {Int32Array} */
  encode(toks) {
    const out = new Int32Array(toks.length);
    for (let i = 0; i < toks.length; i++) out[i] = this.id(toks[i]);
    return out;
  }

  /** @param {Int32Array|number[]} ids @returns {string[]} */
  decode(ids) {
    const out = [];
    for (const i of ids) out.push(this.tokens[i]);
    return out;
  }

  /**
   * A short fingerprint of the token inventory. The trainer writes it into the
   * checkpoint and the loader compares -- editing lexicon.js after training
   * shifts every id, and this turns that from silent gibberish into an error.
   */
  vocabHash() {
    let h = 2166136261 >>> 0;                     // FNV-1a
    for (const t of this.tokens) {
      for (let i = 0; i < t.length; i++) {
        h ^= t.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      h ^= 10; h = Math.imul(h, 16777619) >>> 0;  // separator
    }
    return h.toString(16).padStart(8, '0');
  }
}

/**
 * Render a token list back into a sentence.
 * Punctuation loses its leading space; English gets a capital first letter.
 *
 * Slots render as "__" rather than vanishing, so a skeleton that reached the
 * screen without its numbers filled in is visibly broken instead of quietly
 * missing a word.
 */
export function detokenize(toks, lang = 'he') {
  let s = '';
  for (const t of toks) {
    if (t === '<a>' || t === '<b>') { s += (s ? ' ' : '') + '__'; continue; }
    if (t.startsWith('<')) continue;              // other control tokens never render
    if (PUNCT.has(t)) s += t;
    else s += (s ? ' ' : '') + t;
  }
  // English sentences start with a capital -- including the second one, since
  // every word problem is "<statement>. <question>?".
  if (lang === 'en') s = s.replace(/(^|[.?!]\s+)([a-z])/g, (_, pre, c) => pre + c.toUpperCase());
  return s;
}

export const tokenizer = new Tokenizer();

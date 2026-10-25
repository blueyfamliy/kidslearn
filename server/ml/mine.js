// -- Mine a validated skeleton pool from the trained model -------------------
//
//   node server/ml/mine.js                       # ~1200 per mode
//   node server/ml/mine.js --target 400 --out -  # quick look, writes nothing
//
// Sampling a language model on a six-year-old's phone, per question, to produce
// a sentence that will then be checked and possibly thrown away, is the wrong
// place to spend a battery. So this runs once at build time: sample hard, keep
// only what the validator accepts, deduplicate, and write the survivors to
// skeletons.json. At runtime the app picks one and fills in the numbers.
//
// The acceptance rate this prints is the honest measure of how good the model
// got. A low rate is not a safety problem -- nothing invalid can get through --
// but it does mean the model is wasting work, and it is the number to watch
// when changing the architecture or the training schedule.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { RNG } from './tensor.js';
import { tokenizer, detokenize } from './tokenizer.js';
import { sampleSkeletons, validateSkeleton } from './generate.js';
import { loadModel } from './runtime.js';
import { MODES } from './corpus.js';
import { grammarHash } from './patterns.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || i + 1 >= process.argv.length) return def;
  const v = process.argv[i + 1];
  return typeof def === 'number' ? Number(v) : v;
}

const OPT = {
  target: arg('target', 1200),
  ckpt: arg('ckpt', join(HERE, 'checkpoint.json')),
  out: arg('out', join(HERE, 'skeletons.json')),
  batch: arg('batch', 48),
  temperature: arg('temperature', 1.0),
  topK: arg('topk', 16),
  maxRounds: arg('max-rounds', 400),
  seed: arg('seed', 4242),
  show: arg('show', 4),
  // Restrict to the modes the app actually consumes. Mining everything and
  // shipping it would put English and reading sentences nobody reads into the
  // APK. "he_add,he_sub" is what mathGenerator.js uses today.
  modes: arg('modes', ''),
};

const WANTED = OPT.modes ? new Set(OPT.modes.split(',').map((m) => m.trim())) : null;
const SELECTED = MODES.filter((m) => !WANTED || WANTED.has(m.key));
if (SELECTED.length === 0) throw new Error(`--modes ${OPT.modes} matched nothing; known: ${MODES.map((m) => m.key).join(', ')}`);

const model = loadModel(readFileSync(OPT.ckpt, 'utf8'));
const rng = new RNG(OPT.seed);

console.log('Mining validated skeletons');
console.log(`  checkpoint ${OPT.ckpt}`);
console.log(`  target     ${OPT.target} per mode, temperature ${OPT.temperature}, top-k ${OPT.topK}`);
console.log('');

const skeletons = {};
const report = [];

for (const mode of SELECTED) {
  const key = `${mode.lang} ${mode.task}`;
  const seen = new Set();
  const kept = [];
  const rejected = {};
  let sampled = 0, rounds = 0;

  while (kept.length < OPT.target && rounds < OPT.maxRounds) {
    rounds++;
    const cands = sampleSkeletons(model, {
      lang: mode.lang, task: mode.task, n: OPT.batch,
      temperature: OPT.temperature, topK: OPT.topK, rng,
    });
    sampled += OPT.batch;
    for (const toks of cands) {
      const v = validateSkeleton(toks);
      if (!v.ok) { rejected[v.reason] = (rejected[v.reason] || 0) + 1; continue; }
      const dedupe = toks.join(' ');
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      kept.push(toks);
    }
  }

  skeletons[key] = kept;
  const rate = sampled ? (100 * kept.length / sampled) : 0;
  const topReasons = Object.entries(rejected).sort((a, b) => b[1] - a[1]).slice(0, 4);
  report.push({ key, kept: kept.length, sampled, rate, topReasons, rounds });

  console.log(`${key.padEnd(14)} kept ${String(kept.length).padStart(5)} unique / ${String(sampled).padStart(6)} sampled  (${rate.toFixed(1)}% usable)`);
  if (topReasons.length) {
    console.log(`               top rejections: ${topReasons.map(([r, n]) => `${r} x${n}`).join(', ')}`);
  }
  for (const toks of kept.slice(0, OPT.show)) {
    console.log(`               ${detokenize(toks, mode.lang === '<en>' ? 'en' : 'he')}`);
  }
  console.log('');
}

if (OPT.out === '-') {
  console.log('--out - : nothing written');
} else {
  // Stored as space-joined BODIES, not token arrays: the `<bos> <lang> <task>`
  // prefix and `<eos>` are implied by the key, and one space per token beats
  // quote-comma-quote. On this pool that is 893 KB -> ~570 KB, which matters
  // because the offline desktop build inlines everything into one HTML file.
  const bodies = Object.fromEntries(
    Object.entries(skeletons).map(([k, list]) => [k, list.map((t) => t.slice(3, -1).join(' '))]));

  const payload = {
    format: 'kidslearn-lexi/skeletons',
    meta: {
      vocabHash: tokenizer.vocabHash(),
      // Moves when a gender tag or a frame changes, which vocabHash cannot see.
      grammarHash: grammarHash(),
      checkpoint: OPT.ckpt.replace(/\\/g, '/').split('/').pop(),
      temperature: OPT.temperature,
      topK: OPT.topK,
      seed: OPT.seed,
      perMode: Object.fromEntries(report.map((r) => [r.key, r.kept])),
      acceptRate: Object.fromEntries(report.map((r) => [r.key, Number(r.rate.toFixed(1))])),
    },
    skeletons: bodies,
  };

  // A .js output is an ES module rather than data. That matters: the client
  // imports straight from server/exercises/, and a JSON import needs different
  // syntax in Node than in Vite (`with { type: 'json' }` vs a plain default
  // import). A module is one file that both bundlers and Node read identically,
  // with no build step and no fs access -- which is the whole requirement for
  // the offline desktop build and the APK.
  const asModule = OPT.out.endsWith('.js');
  const text = asModule
    ? '// GENERATED by server/ml/mine.js -- do not edit by hand.\n' +
      '// Sentences written by Lexi and passed by the validator in generate.js.\n' +
      `// Re-mine after any change to lexicon.js or corpus.js.\n\n` +
      `export const POOL = ${JSON.stringify(payload, null, 0)};\n`
    : JSON.stringify(payload);

  writeFileSync(OPT.out, text);
  // byteLength, not string length: Hebrew is 2 bytes per character in UTF-8, so
  // .length under-reports this file by about a quarter.
  const kb = (Buffer.byteLength(text, 'utf8') / 1024).toFixed(0);
  const n = Object.values(skeletons).reduce((acc, l) => acc + l.length, 0);
  console.log(`wrote ${OPT.out}  (${kb} KB, ${n} skeletons${asModule ? ', ES module' : ''})`);
}

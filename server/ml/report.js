// -- Report card for a trained checkpoint ------------------------------------
//
//   node server/ml/report.js [--ckpt path] [--per-mode 8000]
//
// Measures the things worth claiming about the model, including the two that
// are easy to quietly skip:
//
//   NOVELTY   -- what share of accepted sentences were NOT in the training
//                corpus. If this is near zero the model is a lookup table with
//                extra steps, and the honest thing is to say so.
//   QUANT COST-- the checkpoint ships int8. This re-measures validation loss
//                from the quantised weights, so the number quoted is the one
//                that actually runs, not the float32 one it was trained at.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { RNG, noGrad, crossEntropy } from './tensor.js';
import { tokenizer, detokenize } from './tokenizer.js';
import { buildCorpus, MODES } from './corpus.js';
import { sampleSkeletons, validateSkeleton } from './generate.js';
import { loadModel } from './runtime.js';
import { patternCounts } from './patterns.js';

const HERE = dirname(fileURLToPath(import.meta.url));
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || i + 1 >= process.argv.length) return def;
  return typeof def === 'number' ? Number(process.argv[i + 1]) : process.argv[i + 1];
}

const ckptPath = arg('ckpt', join(HERE, 'checkpoint.json'));
const raw = readFileSync(ckptPath, 'utf8');
const ckpt = JSON.parse(raw);
const model = loadModel(ckpt);
const meta = ckpt.meta || {};
const perMode = arg('per-mode', meta.perMode || 8000);

console.log('== checkpoint =========================================================');
console.log(`  file           ${ckptPath.replace(/\\/g, '/').split('/').pop()}  (${(raw.length / 1024).toFixed(0)} KB int8)`);
console.log(`  architecture   d=${model.cfg.dModel} layers=${model.cfg.nLayers} heads=${model.cfg.nHeads} ctx=${model.cfg.ctx}`);
console.log(`  parameters     ${model.numParams().toLocaleString()}`);
console.log(`  vocabulary     ${tokenizer.size} tokens (hash ${tokenizer.vocabHash()})`);
console.log(`  trained        ${meta.trainedSteps} steps x batch ${meta.batch}, ${meta.trainSeconds}s`);
console.log(`  grammar        ${Object.entries(patternCounts()).map(([k, v]) => `${k.replace(/[<>]/g, '')}:${v}`).join('  ')} patterns`);
console.log('');

// -- rebuild the exact training corpus so novelty means something -------------
const { modes } = buildCorpus(new RNG(meta.seed ?? 1337), perMode);
const trainSets = new Map();
for (const m of modes) {
  trainSets.set(`${m.lang} ${m.task}`, new Set([...m.train, ...m.val].map((s) => s.join(' '))));
}

// -- validation loss from the QUANTISED weights ------------------------------
function encodePair(seq) {
  const ids = tokenizer.encode(seq);
  const n = ids.length - 1;
  const target = new Int32Array(n);
  target[0] = -1; target[1] = -1;
  for (let i = 2; i < n; i++) target[i] = ids[i + 1];
  return { input: ids.slice(0, n), target, len: n };
}

function valLoss(pairs) {
  const byLen = new Map();
  for (const p of pairs) {
    if (!byLen.has(p.len)) byLen.set(p.len, []);
    byLen.get(p.len).push(p);
  }
  let sum = 0, tokens = 0;
  for (const [len, arr] of byLen) {
    for (let i = 0; i < arr.length; i += 64) {
      const chunk = arr.slice(i, i + 64);
      const ids = new Int32Array(chunk.length * len);
      const tg = new Int32Array(chunk.length * len);
      chunk.forEach((p, b) => { ids.set(p.input, b * len); tg.set(p.target, b * len); });
      noGrad();
      const l = crossEntropy(model.forward(ids, len), tg);
      sum += l.value * l.tokens; tokens += l.tokens;
    }
  }
  return tokens ? sum / tokens : 0;
}

console.log('== loss (nats/token; chance = ' + Math.log(tokenizer.size).toFixed(2) + ') =============================');
console.log('  mode        float32   int8   quant cost');
for (const m of modes) {
  const f32 = meta.valLoss?.[m.key];
  const i8 = valLoss(m.val.map(encodePair));
  const cost = f32 != null ? (i8 - f32) : null;
  console.log(`  ${m.key.padEnd(10)}  ${f32 != null ? f32.toFixed(3) : '  -  '}   ${i8.toFixed(3)}   ${cost != null ? (cost >= 0 ? '+' : '') + cost.toFixed(4) : '-'}`);
}
console.log('');

// -- acceptance and novelty --------------------------------------------------
console.log('== generation (temperature 1.0, top-k 16) =============================');
console.log('  mode        sampled  accepted   rate    novel (unseen in training)');
const rng = new RNG(777);
const examples = [];
let totAcc = 0, totSamp = 0, totNovel = 0;

for (const mode of MODES) {
  const trainSet = trainSets.get(`${mode.lang} ${mode.task}`);
  let sampled = 0, accepted = 0, novel = 0;
  const reasons = {};
  const novelSamples = [];

  for (let round = 0; round < 24; round++) {
    const cands = sampleSkeletons(model, { lang: mode.lang, task: mode.task, n: 48, temperature: 1.0, topK: 16, rng });
    sampled += 48;
    for (const toks of cands) {
      const v = validateSkeleton(toks);
      if (!v.ok) { reasons[v.reason] = (reasons[v.reason] || 0) + 1; continue; }
      accepted++;
      if (!trainSet.has(toks.join(' '))) {
        novel++;
        if (novelSamples.length < 3) novelSamples.push(toks);
      }
    }
  }
  totAcc += accepted; totSamp += sampled; totNovel += novel;
  const rate = (100 * accepted / sampled).toFixed(1);
  const nov = accepted ? (100 * novel / accepted).toFixed(1) : '0.0';
  console.log(`  ${mode.key.padEnd(10)}  ${String(sampled).padStart(7)}  ${String(accepted).padStart(8)}  ${rate.padStart(5)}%  ${nov.padStart(5)}%`);
  const top = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length) console.log(`              rejected: ${top.map(([r, n]) => `${r} (${n})`).join(', ')}`);
  examples.push([mode, novelSamples]);
}
console.log(`  ${'TOTAL'.padEnd(10)}  ${String(totSamp).padStart(7)}  ${String(totAcc).padStart(8)}  ${(100 * totAcc / totSamp).toFixed(1).padStart(5)}%  ${(totAcc ? 100 * totNovel / totAcc : 0).toFixed(1).padStart(5)}%`);
console.log('');

console.log('== novel sentences the training corpus never contained ================');
for (const [mode, samples] of examples) {
  for (const toks of samples) {
    console.log(`  [${mode.key}] ${detokenize(toks, mode.lang === '<en>' ? 'en' : 'he')}`);
  }
}
console.log('');

// -- inference speed ---------------------------------------------------------
const t0 = Date.now();
let produced = 0;
for (let i = 0; i < 10; i++) {
  produced += sampleSkeletons(model, { lang: '<he>', task: '<add>', n: 48, temperature: 1.0, topK: 16, rng }).length;
}
const ms = Date.now() - t0;
console.log('== speed ==============================================================');
console.log(`  ${produced} skeletons in ${ms} ms  ->  ${(ms / produced).toFixed(2)} ms per candidate (batched, no KV cache)`);

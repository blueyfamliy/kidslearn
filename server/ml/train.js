// -- Train Lexi ------------------------------------------------------------
//
//   node server/ml/train.js                      # defaults, ~10 min
//   node server/ml/train.js --steps 4000 --d 96  # bigger / longer
//   node server/ml/train.js --steps 60 --out -   # smoke test, writes nothing
//
// Batches are length-bucketed: every sequence in a batch has the exact same
// token count, so there is no padding and no wasted compute. Modes are sampled
// by weight (see corpus.js) rather than uniformly over the corpus.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { RNG, startGraph, backward, crossEntropy, noGrad } from './tensor.js';
import { Lexi, AdamW, lrAt, saveCheckpoint } from './model.js';
import { buildCorpus } from './corpus.js';
import { tokenizer } from './tokenizer.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// -- args --------------------------------------------------------------------
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || i + 1 >= process.argv.length) return def;
  const v = process.argv[i + 1];
  return typeof def === 'number' ? Number(v) : v;
}

const OPT = {
  steps:   arg('steps', 2000),
  batch:   arg('batch', 32),
  dModel:  arg('d', 64),
  nLayers: arg('layers', 3),
  nHeads:  arg('heads', 4),
  perMode: arg('per-mode', 6000),
  lr:      arg('lr', 3e-3),
  warmup:  arg('warmup', 100),
  seed:    arg('seed', 1337),
  evalEvery: arg('eval-every', 200),
  out:     arg('out', join(HERE, 'checkpoint.json')),
};

// -- data --------------------------------------------------------------------
const rng = new RNG(OPT.seed);
const { modes, maxLen, totalUnique } = buildCorpus(rng, OPT.perMode);

/**
 * Encode one sequence into (input, target) with the control prefix masked out.
 * The model is handed <bos> <lang> <task> at generation time, so spending
 * capacity on predicting those two tokens would be waste.
 */
function encodePair(seq) {
  const ids = tokenizer.encode(seq);
  const n = ids.length - 1;
  const input = ids.slice(0, n);
  const target = new Int32Array(n);
  target[0] = -1;                       // would predict <lang>
  target[1] = -1;                       // would predict <task>
  for (let i = 2; i < n; i++) target[i] = ids[i + 1];
  return { input, target, len: n };
}

// Bucket every mode's samples by encoded length, so a batch never needs padding.
for (const m of modes) {
  m.buckets = new Map();
  for (const s of m.train) {
    const p = encodePair(s);
    if (!m.buckets.has(p.len)) m.buckets.set(p.len, []);
    m.buckets.get(p.len).push(p);
  }
  // Draw a bucket in proportion to how many sequences it holds.
  m.bucketPicker = [];
  for (const [len, arr] of m.buckets) for (let i = 0; i < arr.length; i++) m.bucketPicker.push(len);
  m.valPairs = m.val.map(encodePair);
}

const MODE_PICKER = modes.flatMap((m) => Array(m.weight).fill(m));

function sampleBatch(r, size) {
  const mode = r.pick(MODE_PICKER);
  const len = r.pick(mode.bucketPicker);
  const bucket = mode.buckets.get(len);
  const ids = new Int32Array(size * len);
  const targets = new Int32Array(size * len);
  for (let b = 0; b < size; b++) {
    const p = bucket[r.int(bucket.length)];
    ids.set(p.input, b * len);
    targets.set(p.target, b * len);
  }
  return { ids, targets, len, mode };
}

/** Mean loss over a whole held-out set, length-bucketed the same way. */
function evalLoss(pairs) {
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
      sum += l.value * l.tokens;
      tokens += l.tokens;
    }
  }
  return tokens ? sum / tokens : 0;
}

// -- model -------------------------------------------------------------------
const model = new Lexi({
  vocab: tokenizer.size,
  dModel: OPT.dModel,
  nLayers: OPT.nLayers,
  nHeads: OPT.nHeads,
  ctx: Math.max(maxLen, 32),
  seed: OPT.seed,
});
const opt = new AdamW(model.parameters(), { weightDecay: 0.01 });

console.log('KidsLearn Lexi');
console.log(`  vocab        ${tokenizer.size} tokens (hash ${tokenizer.vocabHash()})`);
console.log(`  corpus       ${totalUnique.toLocaleString()} unique skeletons, longest ${maxLen} tokens`);
console.log(`               ${modes.map((m) => `${m.key}:${m.unique}`).join('  ')}`);
console.log(`  model        d=${OPT.dModel} layers=${OPT.nLayers} heads=${OPT.nHeads} ctx=${model.cfg.ctx}`);
console.log(`  params       ${model.numParams().toLocaleString()}`);
console.log(`  train        ${OPT.steps} steps x batch ${OPT.batch}, peak lr ${OPT.lr}`);
console.log(`  chance loss  ${Math.log(tokenizer.size).toFixed(3)} nats`);
console.log('');

// -- loop --------------------------------------------------------------------
const t0 = Date.now();
let ema = 0, tokensSeen = 0;

for (let step = 0; step < OPT.steps; step++) {
  const { ids, targets, len } = sampleBatch(rng, OPT.batch);

  startGraph();
  const loss = crossEntropy(model.forward(ids, len), targets);
  backward(loss);
  const gnorm = opt.clipGrad(1.0);
  const lr = lrAt(step, OPT.steps, OPT.lr, OPT.warmup);
  opt.step(lr);
  opt.zeroGrad();

  tokensSeen += loss.tokens;
  ema = step === 0 ? loss.value : 0.98 * ema + 0.02 * loss.value;

  if (step % 25 === 0 || step === OPT.steps - 1) {
    const secs = (Date.now() - t0) / 1000;
    const eta = secs / (step + 1) * (OPT.steps - step - 1);
    process.stdout.write(
      `\rstep ${String(step + 1).padStart(5)}/${OPT.steps}  loss ${ema.toFixed(4)}  ` +
      `lr ${lr.toExponential(2)}  |g| ${gnorm.toFixed(2)}  ` +
      `${Math.round(tokensSeen / secs).toLocaleString()} tok/s  eta ${Math.round(eta)}s   `);
  }

  if ((step + 1) % OPT.evalEvery === 0 || step === OPT.steps - 1) {
    process.stdout.write('\n');
    const parts = modes.map((m) => `${m.key} ${evalLoss(m.valPairs).toFixed(3)}`);
    console.log(`  val @ ${step + 1}:  ${parts.join('   ')}`);
  }
}

// -- save --------------------------------------------------------------------
const elapsed = (Date.now() - t0) / 1000;
const valByMode = Object.fromEntries(modes.map((m) => [m.key, Number(evalLoss(m.valPairs).toFixed(4))]));

console.log('');
console.log(`trained in ${elapsed.toFixed(1)}s, ${tokensSeen.toLocaleString()} tokens seen`);
console.log(`final val loss: ${JSON.stringify(valByMode)}`);

if (OPT.out === '-') {
  console.log('--out - : checkpoint not written');
} else {
  const ckpt = saveCheckpoint(model, {
    vocabHash: tokenizer.vocabHash(),
    vocabSize: tokenizer.size,
    trainedSteps: OPT.steps,
    batch: OPT.batch,
    peakLr: OPT.lr,
    seed: OPT.seed,
    perMode: OPT.perMode,          // with `seed`, this reproduces the exact training corpus
    corpusUnique: totalUnique,
    valLoss: valByMode,
    trainSeconds: Number(elapsed.toFixed(1)),
  });
  const json = JSON.stringify(ckpt);
  writeFileSync(OPT.out, json);
  console.log(`wrote ${OPT.out}  (${(json.length / 1024).toFixed(0)} KB)`);
}

// Finite-difference gradient check for the whole model.
//
// Every backward pass in tensor.js is hand-written, so this is the test that
// matters: perturb a single weight by +/- h, measure how the real loss moves,
// and compare against the gradient backprop claims. If any of these drift, the
// trainer is optimising something that is not the loss.
//
// The forward pass runs in float32, so the loss carries ~3e-7 of numerical
// noise; with h = 1e-2 that puts the smallest resolvable gradient at ~1e-5.
// Coordinates below FLOOR are therefore unresolvable by this method and are
// skipped -- but we check the LARGEST gradients in each tensor rather than
// random ones, so the coordinates that actually drive training are the ones
// under test.
//
//   node server/ml/gradcheck.js

import { RNG, startGraph, backward, crossEntropy, noGrad } from './tensor.js';
import { Lexi } from './model.js';

const VOCAB = 23;
const SEQ = 7;
const BATCH = 3;
const H = 1e-2;
const FLOOR = 1e-4;    // below this, finite differences are measuring float32 noise
const TOL = 2e-2;
const PER_TENSOR = 4;

const rng = new RNG(7);
const model = new Lexi({ vocab: VOCAB, dModel: 16, nLayers: 2, nHeads: 4, ctx: SEQ, seed: 5 });

const ids = new Int32Array(BATCH * SEQ);
const targets = new Int32Array(BATCH * SEQ);
for (let i = 0; i < ids.length; i++) {
  ids[i] = rng.int(VOCAB);
  // a couple of ignored positions, so the padding path is exercised too
  targets[i] = rng.next() < 0.15 ? -1 : rng.int(VOCAB);
}

function lossNow() {
  noGrad();
  return crossEntropy(model.forward(ids, SEQ), targets).value;
}

// Analytic gradients
startGraph();
const loss = crossEntropy(model.forward(ids, SEQ), targets);
backward(loss);

const NAMES = ['wte', 'wpe'];
for (let l = 0; l < model.cfg.nLayers; l++) {
  for (const n of ['ln1g', 'ln1b', 'wq', 'bq', 'wk', 'bk', 'wv', 'bv', 'wo', 'bo',
                   'ln2g', 'ln2b', 'wf1', 'bf1', 'wf2', 'bf2']) NAMES.push(`L${l}.${n}`);
}
NAMES.push('lngg', 'lngb');

const params = model.parameters();
let worst = 0, worstName = '';
let checked = 0, skipped = 0;
const silent = [];

for (let pi = 0; pi < params.length; pi++) {
  const p = params[pi];
  const analytic = Float32Array.from(p.grad);

  // the PER_TENSOR coordinates with the largest |gradient|
  const order = Array.from({ length: p.size }, (_, i) => i)
    .sort((a, b) => Math.abs(analytic[b]) - Math.abs(analytic[a]))
    .slice(0, PER_TENSOR);

  let anyChecked = false;
  for (const i of order) {
    const a = analytic[i];
    if (Math.abs(a) < FLOOR) { skipped++; continue; }
    const orig = p.data[i];
    p.data[i] = orig + H; const lp = lossNow();
    p.data[i] = orig - H; const lm = lossNow();
    p.data[i] = orig;
    const numeric = (lp - lm) / (2 * H);
    const rel = Math.abs(a - numeric) / Math.max(1e-6, Math.abs(a) + Math.abs(numeric));
    checked++; anyChecked = true;
    if (rel > worst) {
      worst = rel;
      worstName = `${NAMES[pi]}[${i}]  analytic=${a.toExponential(4)}  numeric=${numeric.toExponential(4)}`;
    }
  }
  if (!anyChecked) silent.push(NAMES[pi]);
}

console.log(`params:      ${model.numParams().toLocaleString()}`);
console.log(`loss @ init: ${loss.value.toFixed(6)}   (ln ${VOCAB} = ${Math.log(VOCAB).toFixed(6)})`);
console.log(`checked:     ${checked} coordinates, ${skipped} below the ${FLOOR} resolution floor`);
if (silent.length) console.log(`no resolvable gradient: ${silent.join(', ')}`);
console.log(`max rel err: ${worst.toExponential(3)}`);
console.log(`worst:       ${worstName}`);

if (checked < params.length) {
  console.error(`\nFAIL: only ${checked} coordinates were resolvable; expected at least one per tensor`);
  process.exit(1);
}
if (worst > TOL) {
  console.error(`\nFAIL: gradient error ${worst.toExponential(3)} exceeds ${TOL}`);
  process.exit(1);
}
console.log('\nPASS');

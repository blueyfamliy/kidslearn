// Focused tests for the fused causal-attention op.
//
// gradcheck.js exercises the whole model, but at init the attention softmax is
// almost uniform, so dQ / dK are ~1e-5 and vanish into float32 noise. Attention
// is also the only op with a fully hand-written backward AND a batch dimension
// folded into the row axis, so it gets its own tests:
//
//   1. dQ / dK / dV against finite differences, with sharp (large-magnitude)
//      inputs so the softmax gradients are actually measurable;
//   2. causality      -- position t must not depend on any input after t;
//   3. batch isolation -- sequences packed into one call must give bit-identical
//      results to running each on its own.
//
//   node server/ml/attention.test.js

import { T, RNG, startGraph, backward, noGrad, attention } from './tensor.js';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`);
  if (!ok) failures++;
}

const HEADS = 4, HD = 6, C = HEADS * HD, SEQ = 5, B = 3;

function makeInputs(rng, std = 1.0) {
  const mk = () => {
    const t = new T(B * SEQ, C, null, true);
    for (let i = 0; i < t.size; i++) t.data[i] = rng.normal() * std;
    return t;
  };
  return [mk(), mk(), mk()];
}

// A scalar readout of the attention output, so we have something to differentiate.
function readout(out, w) {
  let s = 0;
  for (let i = 0; i < out.size; i++) s += out.data[i] * w[i];
  return s;
}

// -- 1. dQ / dK / dV vs finite differences -----------------------------------
{
  const rng = new RNG(11);
  const [q, k, v] = makeInputs(rng);
  const w = new Float32Array(B * SEQ * C);
  for (let i = 0; i < w.length; i++) w[i] = rng.normal();

  startGraph();
  const out = attention(q, k, v, HEADS, SEQ);
  out.ensureGrad();
  // d(readout)/d(out) = w
  for (let i = 0; i < out.size; i++) out.grad[i] = w[i];
  // walk the tape by hand: `out` is the only node
  out.back();

  const H = 1e-3;
  let worst = 0, worstName = '';
  for (const [name, t] of [['q', q], ['k', k], ['v', v]]) {
    const analytic = Float32Array.from(t.grad);
    const order = Array.from({ length: t.size }, (_, i) => i)
      .sort((a, b) => Math.abs(analytic[b]) - Math.abs(analytic[a]))
      .slice(0, 8);
    for (const i of order) {
      const orig = t.data[i];
      noGrad();
      t.data[i] = orig + H; const lp = readout(attention(q, k, v, HEADS, SEQ), w);
      t.data[i] = orig - H; const lm = readout(attention(q, k, v, HEADS, SEQ), w);
      t.data[i] = orig;
      const numeric = (lp - lm) / (2 * H);
      const a = analytic[i];
      const rel = Math.abs(a - numeric) / Math.max(1e-4, Math.abs(a) + Math.abs(numeric));
      if (rel > worst) { worst = rel; worstName = `d${name}[${i}] analytic=${a.toFixed(6)} numeric=${numeric.toFixed(6)}`; }
    }
  }
  check('dQ / dK / dV match finite differences', worst < 2e-2, `max rel err ${worst.toExponential(3)}  (${worstName})`);
}

// -- 2. causality ------------------------------------------------------------
// Perturb every input at position `p` and confirm nothing at positions < p moves.
{
  const rng = new RNG(23);
  const [q, k, v] = makeInputs(rng);
  noGrad();
  const base = attention(q, k, v, HEADS, SEQ);

  let leak = 0, leakAt = '';
  for (let p = 1; p < SEQ; p++) {
    for (const [name, t] of [['q', q], ['k', k], ['v', v]]) {
      const row = p * C;                    // sequence 0, position p
      const saved = Float32Array.from(t.data.subarray(row, row + C));
      for (let j = 0; j < C; j++) t.data[row + j] += 3.0;
      const pert = attention(q, k, v, HEADS, SEQ);
      for (let earlier = 0; earlier < p; earlier++) {
        for (let j = 0; j < C; j++) {
          const d = Math.abs(pert.data[earlier * C + j] - base.data[earlier * C + j]);
          if (d > leak) { leak = d; leakAt = `${name}@${p} changed out@${earlier}`; }
        }
      }
      t.data.set(saved, row);
    }
  }
  check('future tokens cannot influence the past', leak === 0, leak ? `leak ${leak} (${leakAt})` : 'exact');
}

// -- 3. batch isolation ------------------------------------------------------
// One call over B packed sequences == B calls over one sequence each.
{
  const rng = new RNG(31);
  const [q, k, v] = makeInputs(rng);
  noGrad();
  const packed = attention(q, k, v, HEADS, SEQ);

  let worst = 0;
  for (let b = 0; b < B; b++) {
    const slice = (t) => {
      const s = new T(SEQ, C);
      s.data.set(t.data.subarray(b * SEQ * C, (b + 1) * SEQ * C));
      return s;
    };
    const alone = attention(slice(q), slice(k), slice(v), HEADS, SEQ);
    for (let i = 0; i < alone.size; i++) {
      const d = Math.abs(alone.data[i] - packed.data[b * SEQ * C + i]);
      if (d > worst) worst = d;
    }
  }
  check('packed sequences do not attend to each other', worst === 0, worst ? `max diff ${worst}` : 'bit-identical');
}

console.log(failures ? `\n${failures} FAILED` : '\nPASS');
process.exit(failures ? 1 : 0);

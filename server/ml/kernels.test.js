// Correctness tests for the three hand-optimised matmul kernels.
//
// They are unrolled 4-wide, which means the remainder paths (n or k not a
// multiple of 4) are separate code that a benchmark on nice round shapes would
// never touch. So every shape here is deliberately awkward.
//
// The reference is computed in float64, and error is normalised by the LARGEST
// entry of the reference matrix, not by each entry. Per-entry normalisation
// looks rigorous and is not: these inputs are sin/cos, so individual dot
// products cancel down to ~1e-3 while their terms are O(1), and a perfectly
// good kernel then reports 1e-3 "relative error" that is really just
// cancellation. Matrix-level relative error is the standard measure and is the
// one that actually distinguishes rounding from a wrong index.
//
// Budget: a float32 reduction of length L accumulates about sqrt(L) * 2^-24 of
// relative error, so the tolerance scales with the reduction length. A logic
// error lands at O(1) and fails these by five orders of magnitude.
//
//   node server/ml/kernels.test.js

import { mmNN, mmTN, mmNT } from './tensor.js';

let failures = 0;

function ref64(kind, A, B, n, k, m) {
  const C = new Float64Array(kind === 'NN' ? n * m : kind === 'TN' ? k * m : n * k);
  if (kind === 'NN') {
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      let s = 0; for (let p = 0; p < k; p++) s += A[i * k + p] * B[p * m + j];
      C[i * m + j] = s;
    }
  } else if (kind === 'TN') {
    for (let p = 0; p < k; p++) for (let j = 0; j < m; j++) {
      let s = 0; for (let i = 0; i < n; i++) s += A[i * k + p] * B[i * m + j];
      C[p * m + j] = s;
    }
  } else {
    for (let i = 0; i < n; i++) for (let p = 0; p < k; p++) {
      let s = 0; for (let j = 0; j < m; j++) s += A[i * m + j] * B[p * m + j];
      C[i * k + p] = s;
    }
  }
  return C;
}

const SHAPES = [
  [1, 1, 1],        // degenerate
  [3, 3, 3],        // entirely remainder, no unrolled iteration at all
  [5, 7, 9],        // remainder in every dimension
  [7, 5, 3],
  [9, 4, 11],       // k exactly 4: one unrolled step, no remainder
  [4, 8, 4],        // everything a multiple of 4
  [13, 341, 64],    // real shape: output head, odd n
  [640, 64, 256],   // real shape: MLP
  [640, 341, 64],   // real shape: output head
  [6, 64, 341],
];

for (const [n, k, m] of SHAPES) {
  const A = new Float32Array(Math.max(n * k, n * m));
  const B = new Float32Array(Math.max(k * m, n * m));
  for (let i = 0; i < A.length; i++) A[i] = Math.sin(i * 1.7);
  for (let i = 0; i < B.length; i++) B[i] = Math.cos(i * 2.3);

  for (const kind of ['NN', 'TN', 'NT']) {
    // reduction length differs per kernel: NN reduces over k, NT over m, TN over n
    const reduceLen = kind === 'NN' ? k : kind === 'TN' ? n : m;
    const tol = Math.max(1e-6, 16 * Math.sqrt(reduceLen) * 2 ** -24);

    const size = kind === 'NN' ? n * m : kind === 'TN' ? k * m : n * k;
    const out = new Float32Array(size);
    (kind === 'NN' ? mmNN : kind === 'TN' ? mmTN : mmNT)(A, B, out, n, k, m);
    const r = ref64(kind, A, B, n, k, m);

    let absErr = 0, scale = 0;
    for (let i = 0; i < size; i++) {
      const e = Math.abs(out[i] - r[i]);
      if (e > absErr) absErr = e;
      if (Math.abs(r[i]) > scale) scale = Math.abs(r[i]);
    }
    const relErr = absErr / Math.max(scale, 1e-12);
    const ok = relErr <= tol;
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  mm${kind} [${n}x${k}x${m}]  rel err ${relErr.toExponential(2)} <= ${tol.toExponential(2)}`);
  }
}

// Accumulation: the kernels must ADD into C, not overwrite it. Backward passes
// sum gradients from several consumers into the same buffer and depend on this.
{
  const n = 5, k = 6, m = 7;
  const A = new Float32Array(n * k).fill(1);
  const B = new Float32Array(k * m).fill(1);
  const C = new Float32Array(n * m);
  mmNN(A, B, C, n, k, m);
  mmNN(A, B, C, n, k, m);
  const ok = C.every((v) => v === 2 * k);
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  kernels accumulate into C instead of overwriting`);
}

console.log(failures ? `\n${failures} FAILED` : '\nPASS');
process.exit(failures ? 1 : 0);

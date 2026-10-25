// -- Checkpoint round-trip tests ---------------------------------------------
//
// The checkpoint is the only thing that crosses from training to the app, so it
// gets its own tests. Two things here are easy to get wrong and impossible to
// notice:
//
//   * the int8 quantisation is lossy on purpose, and "lossy" has to mean
//     "within one quantisation step", not "roughly similar";
//   * base64 is done with Buffer in Node and btoa/atob in the browser. The
//     browser branch is the one that runs on the kids' phones and the one that
//     never executes during development, so it is exercised here explicitly by
//     hiding Buffer.
//
//   node server/ml/checkpoint.test.js

import { Lexi, saveCheckpoint, loadCheckpoint } from './model.js';
import { noGrad } from './tensor.js';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`);
  if (!ok) failures++;
}

const CFG = { vocab: 41, dModel: 32, nLayers: 2, nHeads: 4, ctx: 12, seed: 3 };
const model = new Lexi(CFG);
const ids = new Int32Array([1, 5, 9, 12, 30, 7, 2, 19]);
const SEQ = 4;

noGrad();
const before = Float32Array.from(model.forward(ids, SEQ).data);

// -- 1. weights survive the round trip to within one quantisation step -------
{
  const ckpt = saveCheckpoint(model, { note: 'test' });
  const reloaded = loadCheckpoint(JSON.parse(JSON.stringify(ckpt)));

  let worstSteps = 0;
  model.parameters().forEach((p, i) => {
    const q = reloaded.parameters()[i];
    const scale = ckpt.tensors[i].scale;
    for (let j = 0; j < p.size; j++) {
      const steps = Math.abs(p.data[j] - q.data[j]) / scale;
      if (steps > worstSteps) worstSteps = steps;
    }
  });
  check('weights within half a quantisation step', worstSteps <= 0.5 + 1e-4, `worst ${worstSteps.toFixed(4)} steps`);

  noGrad();
  const after = reloaded.forward(ids, SEQ).data;
  let maxAbs = 0, scale = 0;
  for (let i = 0; i < before.length; i++) {
    maxAbs = Math.max(maxAbs, Math.abs(before[i] - after[i]));
    scale = Math.max(scale, Math.abs(before[i]));
  }
  const rel = maxAbs / scale;
  check('logits barely move after quantisation', rel < 0.05, `max relative shift ${(100 * rel).toFixed(2)}%`);
}

// -- 2. the browser base64 path produces the same bytes ----------------------
{
  const withBuffer = saveCheckpoint(model);
  const saved = globalThis.Buffer;
  let withoutBuffer, reloaded;
  try {
    // eslint-disable-next-line no-global-assign
    globalThis.Buffer = undefined;
    if (typeof btoa !== 'function' || typeof atob !== 'function') {
      throw new Error('this runtime has no btoa/atob to test the browser path with');
    }
    withoutBuffer = saveCheckpoint(model);
    reloaded = loadCheckpoint(withoutBuffer);
  } finally {
    globalThis.Buffer = saved;
  }

  const same = withBuffer.tensors.every((t, i) => t.q === withoutBuffer.tensors[i].q);
  check('btoa encoding matches Buffer encoding', same);

  let worst = 0;
  model.parameters().forEach((p, i) => {
    const q = reloaded.parameters()[i];
    for (let j = 0; j < p.size; j++) worst = Math.max(worst, Math.abs(p.data[j] - q.data[j]));
  });
  check('atob decoding restores the weights', worst < 1e-3, `max diff ${worst.toExponential(2)}`);
}

// -- 3. bad checkpoints are refused, not silently misread --------------------
{
  const ckpt = saveCheckpoint(model);

  const wrongFormat = { ...ckpt, format: 'something-else' };
  let threw = false;
  try { loadCheckpoint(wrongFormat); } catch { threw = true; }
  check('unknown format is refused', threw);

  const shortTensors = { ...ckpt, tensors: ckpt.tensors.slice(0, -1) };
  threw = false;
  try { loadCheckpoint(shortTensors); } catch { threw = true; }
  check('wrong tensor count is refused', threw);

  const wrongShape = {
    ...ckpt,
    tensors: ckpt.tensors.map((t, i) => (i === 0 ? { ...t, shape: [t.shape[0] + 1, t.shape[1]] } : t)),
  };
  threw = false;
  try { loadCheckpoint(wrongShape); } catch { threw = true; }
  check('mismatched tensor shape is refused', threw);
}

// -- 4. an all-zero tensor must not divide by zero ---------------------------
{
  const m = new Lexi(CFG);
  m.parameters()[0].data.fill(0);
  let ok = true;
  try {
    const back = loadCheckpoint(saveCheckpoint(m));
    ok = back.parameters()[0].data.every((v) => v === 0);
  } catch { ok = false; }
  check('an all-zero tensor round-trips', ok);
}

console.log(failures ? `\n${failures} FAILED` : '\nPASS');
process.exit(failures ? 1 : 0);

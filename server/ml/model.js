// -- Lexi: a decoder-only transformer, built from scratch on tensor.js -----
//
// Architecture is GPT-shaped and deliberately unsurprising -- pre-LayerNorm
// blocks, causal multi-head attention, a 4x GELU MLP, and an output head whose
// weights are tied to the token embedding. What makes it fit KidsLearn is the
// size: at the default config it is ~170k parameters, which quantises to a
// ~180 KB checkpoint that ships inside the offline desktop build and the APK.
//
// The model never sees or emits digits. It writes SKELETONS -- sentences with
// <a> / <b> slots where numbers go -- and a deterministic filler puts the real
// numbers in and computes the answer. See generate.js for why that matters.

import {
  T, RNG, param, constParam,
  matmul, matmulT, addBias, add, gelu, layerNorm, attention, embed,
} from './tensor.js';

export const DEFAULT_CONFIG = {
  dModel: 64,
  nLayers: 3,
  nHeads: 4,
  ctx: 32,        // longest skeleton we ever train on, in tokens
  seed: 1337,
};

export class Lexi {
  /** @param {{vocab:number, dModel?:number, nLayers?:number, nHeads?:number, ctx?:number, seed?:number}} cfg */
  constructor(cfg) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    const { vocab, dModel: C, nLayers, nHeads, ctx, seed } = this.cfg;
    if (C % nHeads !== 0) throw new Error(`dModel ${C} must divide by nHeads ${nHeads}`);

    const rng = new RNG(seed);
    // GPT-2 style init: 0.02 everywhere, with residual-output projections scaled
    // down by sqrt(2 * nLayers) so the residual stream does not blow up by depth.
    const std = 0.02;
    const resStd = std / Math.sqrt(2 * nLayers);

    this.wte = param(vocab, C, std, rng);      // token embedding (also the head)
    this.wpe = param(ctx, C, std, rng);        // learned positional embedding

    this.blocks = [];
    for (let i = 0; i < nLayers; i++) {
      this.blocks.push({
        ln1g: constParam(1, C, 1), ln1b: constParam(1, C, 0),
        wq: param(C, C, std, rng), bq: constParam(1, C, 0),
        wk: param(C, C, std, rng), bk: constParam(1, C, 0),
        wv: param(C, C, std, rng), bv: constParam(1, C, 0),
        wo: param(C, C, resStd, rng), bo: constParam(1, C, 0),
        ln2g: constParam(1, C, 1), ln2b: constParam(1, C, 0),
        wf1: param(C, 4 * C, std, rng), bf1: constParam(1, 4 * C, 0),
        wf2: param(4 * C, C, resStd, rng), bf2: constParam(1, C, 0),
      });
    }
    this.lngg = constParam(1, C, 1);
    this.lngb = constParam(1, C, 0);
  }

  /** Every trainable tensor, in a stable order (the checkpoint format depends on it). */
  parameters() {
    const ps = [this.wte, this.wpe];
    for (const b of this.blocks) {
      ps.push(b.ln1g, b.ln1b, b.wq, b.bq, b.wk, b.bk, b.wv, b.bv, b.wo, b.bo,
              b.ln2g, b.ln2b, b.wf1, b.bf1, b.wf2, b.bf2);
    }
    ps.push(this.lngg, this.lngb);
    return ps;
  }

  numParams() {
    return this.parameters().reduce((n, p) => n + p.size, 0);
  }

  /**
   * @param {Int32Array|number[]} ids  B * seqLen token ids, sequences laid out contiguously
   * @param {number} seqLen            tokens per sequence
   * @returns {T} logits [B*seqLen, vocab]
   */
  forward(ids, seqLen) {
    const { nHeads } = this.cfg;
    const rows = ids.length;
    const B = rows / seqLen;
    if (!Number.isInteger(B)) throw new Error(`${rows} ids is not a whole number of ${seqLen}-token sequences`);
    if (seqLen > this.cfg.ctx) throw new Error(`seqLen ${seqLen} exceeds ctx ${this.cfg.ctx}`);

    // Positions repeat per sequence: [0..T-1, 0..T-1, ...]
    const pos = new Int32Array(rows);
    for (let i = 0; i < rows; i++) pos[i] = i % seqLen;

    let x = add(embed(this.wte, ids), embed(this.wpe, pos));

    for (const b of this.blocks) {
      const h = layerNorm(x, b.ln1g, b.ln1b);
      const q = addBias(matmul(h, b.wq), b.bq);
      const k = addBias(matmul(h, b.wk), b.bk);
      const v = addBias(matmul(h, b.wv), b.bv);
      const a = attention(q, k, v, nHeads, seqLen);
      x = add(x, addBias(matmul(a, b.wo), b.bo));

      const h2 = layerNorm(x, b.ln2g, b.ln2b);
      const f = gelu(addBias(matmul(h2, b.wf1), b.bf1));
      x = add(x, addBias(matmul(f, b.wf2), b.bf2));
    }

    return matmulT(layerNorm(x, this.lngg, this.lngb), this.wte);
  }
}

// -- Checkpoint I/O ----------------------------------------------------------
// Weights are stored int8, symmetric, one scale per tensor. On this model that
// costs ~0.01 nats of extra loss and turns a 690 KB float32 dump into ~180 KB
// of JSON -- small enough to sit in the single-file offline HTML build.

function toBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** @param {Lexi} model @returns {object} a JSON-serialisable checkpoint */
export function saveCheckpoint(model, meta = {}) {
  const tensors = model.parameters().map((p) => {
    let max = 0;
    for (let i = 0; i < p.size; i++) { const a = Math.abs(p.data[i]); if (a > max) max = a; }
    const scale = max / 127 || 1;
    const q = new Int8Array(p.size);
    for (let i = 0; i < p.size; i++) q[i] = Math.max(-127, Math.min(127, Math.round(p.data[i] / scale)));
    return { shape: [p.rows, p.cols], scale, q: toBase64(new Uint8Array(q.buffer)) };
  });
  return { format: 'kidslearn-lexi/int8', config: model.cfg, meta, tensors };
}

/** @param {object} ckpt @returns {Lexi} */
export function loadCheckpoint(ckpt) {
  if (ckpt.format !== 'kidslearn-lexi/int8') throw new Error(`unknown checkpoint format ${ckpt.format}`);
  const model = new Lexi(ckpt.config);
  const ps = model.parameters();
  if (ps.length !== ckpt.tensors.length) {
    throw new Error(`checkpoint has ${ckpt.tensors.length} tensors, model wants ${ps.length}`);
  }
  ps.forEach((p, i) => {
    const t = ckpt.tensors[i];
    if (t.shape[0] !== p.rows || t.shape[1] !== p.cols) {
      throw new Error(`tensor ${i}: checkpoint ${t.shape} vs model [${p.rows}, ${p.cols}]`);
    }
    const q = new Int8Array(fromBase64(t.q).buffer);
    for (let j = 0; j < p.size; j++) p.data[j] = q[j] * t.scale;
  });
  return model;
}

// -- AdamW -------------------------------------------------------------------
export class AdamW {
  constructor(params, { beta1 = 0.9, beta2 = 0.95, eps = 1e-8, weightDecay = 0.01 } = {}) {
    this.params = params;
    this.beta1 = beta1; this.beta2 = beta2; this.eps = eps; this.wd = weightDecay;
    this.m = params.map((p) => new Float32Array(p.size));
    this.v = params.map((p) => new Float32Array(p.size));
    this.t = 0;
  }

  zeroGrad() { for (const p of this.params) p.zeroGrad(); }

  /** Global L2 clip. Returns the pre-clip norm so the trainer can log it. */
  clipGrad(maxNorm) {
    let sq = 0;
    for (const p of this.params) for (let i = 0; i < p.size; i++) sq += p.grad[i] * p.grad[i];
    const norm = Math.sqrt(sq);
    if (norm > maxNorm) {
      const s = maxNorm / (norm + 1e-6);
      for (const p of this.params) for (let i = 0; i < p.size; i++) p.grad[i] *= s;
    }
    return norm;
  }

  step(lr) {
    this.t++;
    const { beta1: b1, beta2: b2, eps } = this;
    const c1 = 1 - Math.pow(b1, this.t);
    const c2 = 1 - Math.pow(b2, this.t);
    for (let pi = 0; pi < this.params.length; pi++) {
      const p = this.params[pi], m = this.m[pi], v = this.v[pi];
      // Decay only matrices; LayerNorm gains and biases (1-row tensors) are exempt.
      const wd = p.rows === 1 ? 0 : this.wd;
      for (let i = 0; i < p.size; i++) {
        const g = p.grad[i];
        m[i] = b1 * m[i] + (1 - b1) * g;
        v[i] = b2 * v[i] + (1 - b2) * g * g;
        const mh = m[i] / c1, vh = v[i] / c2;
        p.data[i] -= lr * (mh / (Math.sqrt(vh) + eps) + wd * p.data[i]);
      }
    }
  }
}

/** Linear warmup then cosine decay to 10% of peak. */
export function lrAt(step, totalSteps, peak, warmup) {
  if (step < warmup) return peak * (step + 1) / warmup;
  const prog = Math.min(1, (step - warmup) / Math.max(1, totalSteps - warmup));
  return peak * (0.1 + 0.9 * 0.5 * (1 + Math.cos(Math.PI * prog)));
}

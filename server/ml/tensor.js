// -- A tiny reverse-mode autograd engine ------------------------------------
// This file IS the ML framework for KidsLearn. No dependencies, no native
// bindings, no WASM -- plain ES modules over Float32Array, so the exact same
// code runs in Node (training) and in the browser / Android WebView (inference).
//
// Deliberate simplifications, all of them safe for the one model we train here:
//   * every tensor is a 2-D matrix [rows, cols] -- a batch of row-vectors;
//   * no broadcasting beyond "add a [1, C] bias to an [N, C] matrix";
//   * the graph is a flat tape in creation order, walked backwards once.
//
// Reading order: RNG -> kernels -> tensor -> tape -> ops.

// -- Seeded RNG --------------------------------------------------------------
// Training must be reproducible: same seed, same weights, same checkpoint.
export class RNG {
  constructor(seed = 1337) { this.s = seed >>> 0 || 1; this._spare = null; }

  next() {                       // xorshift32 -> [0, 1)
    let x = this.s;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;  x >>>= 0;
    this.s = x;
    return x / 4294967296;
  }

  int(n) { return Math.floor(this.next() * n); }
  pick(arr) { return arr[this.int(arr.length)]; }

  normal() {                     // Box-Muller, one cached spare
    if (this._spare !== null) { const v = this._spare; this._spare = null; return v; }
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const r = Math.sqrt(-2 * Math.log(u)), th = 2 * Math.PI * v;
    this._spare = r * Math.sin(th);
    return r * Math.cos(th);
  }

  shuffle(arr) {                 // Fisher-Yates, in place
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
}

// -- Raw matmul kernels ------------------------------------------------------
// All three ACCUMULATE into C (they never clear it) -- backward passes rely on
// that to sum gradients from several consumers.
//
// These three loops are ~90% of training time, so they are written for V8
// rather than for looks. Two things matter, both measured on this model's
// shapes (see the numbers in ml/README.md):
//   * loop order (i, p, j), so the innermost loop walks B and C contiguously;
//   * a 4-wide unroll, which gives the engine four independent multiply-adds
//     to overlap instead of one serial dependency chain.
// Together they are worth ~1.75x over the textbook forms.

/** C[n,m] += A[n,k] @ B[k,m] */
export function mmNN(A, B, C, n, k, m) {
  for (let i = 0; i < n; i++) {
    const ai = i * k, ci = i * m;
    let p = 0;
    for (; p + 3 < k; p += 4) {
      const a0 = A[ai + p], a1 = A[ai + p + 1], a2 = A[ai + p + 2], a3 = A[ai + p + 3];
      const b0 = p * m, b1 = b0 + m, b2 = b1 + m, b3 = b2 + m;
      for (let j = 0; j < m; j++) {
        C[ci + j] += a0 * B[b0 + j] + a1 * B[b1 + j] + a2 * B[b2 + j] + a3 * B[b3 + j];
      }
    }
    for (; p < k; p++) {
      const a = A[ai + p], bp = p * m;
      for (let j = 0; j < m; j++) C[ci + j] += a * B[bp + j];
    }
  }
}

/** C[k,m] += transpose(A[n,k]) @ B[n,m] */
export function mmTN(A, B, C, n, k, m) {
  for (let p = 0; p < k; p++) {
    const cp = p * m;
    let i = 0;
    for (; i + 3 < n; i += 4) {
      const a0 = A[i * k + p], a1 = A[(i + 1) * k + p], a2 = A[(i + 2) * k + p], a3 = A[(i + 3) * k + p];
      const b0 = i * m, b1 = b0 + m, b2 = b1 + m, b3 = b2 + m;
      for (let j = 0; j < m; j++) {
        C[cp + j] += a0 * B[b0 + j] + a1 * B[b1 + j] + a2 * B[b2 + j] + a3 * B[b3 + j];
      }
    }
    for (; i < n; i++) {
      const a = A[i * k + p], bi = i * m;
      for (let j = 0; j < m; j++) C[cp + j] += a * B[bi + j];
    }
  }
}

/**
 * C[n,k] += A[n,m] @ transpose(B[k,m])
 *
 * The inner loop here is a dot product, so unrolling over k would just chain
 * more adds together. Instead it walks FOUR rows of A at once against each row
 * of B: four independent accumulators, and each B row is loaded once for four
 * outputs instead of once each. Worth ~1.65x.
 */
export function mmNT(A, B, C, n, k, m) {
  let i = 0;
  for (; i + 3 < n; i += 4) {
    const a0 = i * m, a1 = a0 + m, a2 = a1 + m, a3 = a2 + m;
    const c0 = i * k, c1 = c0 + k, c2 = c1 + k, c3 = c2 + k;
    for (let p = 0; p < k; p++) {
      const bp = p * m;
      let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
      for (let j = 0; j < m; j++) {
        const b = B[bp + j];
        s0 += A[a0 + j] * b; s1 += A[a1 + j] * b; s2 += A[a2 + j] * b; s3 += A[a3 + j] * b;
      }
      C[c0 + p] += s0; C[c1 + p] += s1; C[c2 + p] += s2; C[c3 + p] += s3;
    }
  }
  for (; i < n; i++) {
    const ai = i * m, ci = i * k;
    for (let p = 0; p < k; p++) {
      const bp = p * m;
      let s = 0;
      for (let j = 0; j < m; j++) s += A[ai + j] * B[bp + j];
      C[ci + p] += s;
    }
  }
}

// -- Tensor ------------------------------------------------------------------
export class T {
  constructor(rows, cols, data = null, requiresGrad = false) {
    this.rows = rows;
    this.cols = cols;
    this.data = data || new Float32Array(rows * cols);
    this.grad = requiresGrad ? new Float32Array(rows * cols) : null;
    this.back = null;   // closure installed by whichever op produced this tensor
  }
  get size() { return this.rows * this.cols; }
  ensureGrad() { if (!this.grad) this.grad = new Float32Array(this.size); return this.grad; }
  zeroGrad() { if (this.grad) this.grad.fill(0); }
}

/** A trainable parameter, initialised N(0, std). */
export function param(rows, cols, std, rng) {
  const t = new T(rows, cols, null, true);
  for (let i = 0; i < t.data.length; i++) t.data[i] = rng.normal() * std;
  return t;
}

/** A trainable parameter filled with a constant (LayerNorm gain / bias). */
export function constParam(rows, cols, value) {
  const t = new T(rows, cols, null, true);
  t.data.fill(value);
  return t;
}

// -- The tape ----------------------------------------------------------------
// Ops only record themselves while a graph is open. Inference runs with the
// graph closed, so it allocates no gradient buffers at all.
let GRAPH = null;

export function startGraph() { GRAPH = []; }
export function noGrad() { GRAPH = null; }

/** Seed d(loss)/d(loss) = 1 and walk the tape backwards. */
export function backward(loss) {
  const g = GRAPH;
  if (!g) throw new Error('backward() called with no open graph');
  loss.ensureGrad()[0] = 1;
  for (let i = g.length - 1; i >= 0; i--) if (g[i].back) g[i].back();
  GRAPH = null;
  return g;
}

/** Record `out` on the tape iff any input needs a gradient. */
function record(out, inputs, back) {
  if (!GRAPH) return out;
  for (const x of inputs) {
    if (x && x.grad) { out.ensureGrad(); out.back = back; GRAPH.push(out); return out; }
  }
  return out;
}

// -- Ops ---------------------------------------------------------------------

/** x[n,k] @ w[k,m] */
export function matmul(x, w) {
  const out = new T(x.rows, w.cols);
  mmNN(x.data, w.data, out.data, x.rows, x.cols, w.cols);
  return record(out, [x, w], () => {
    if (x.grad) mmNT(out.grad, w.data, x.grad, x.rows, x.cols, w.cols);
    if (w.grad) mmTN(x.data, out.grad, w.grad, x.rows, x.cols, w.cols);
  });
}

/** x[n,c] @ transpose(w[v,c]) -> [n,v]. Used for the weight-tied output head. */
export function matmulT(x, w) {
  const out = new T(x.rows, w.rows);
  mmNT(x.data, w.data, out.data, x.rows, w.rows, x.cols);
  return record(out, [x, w], () => {
    if (x.grad) mmNN(out.grad, w.data, x.grad, x.rows, w.rows, x.cols);
    if (w.grad) mmTN(out.grad, x.data, w.grad, x.rows, w.rows, x.cols);
  });
}

/** x[n,c] + b[1,c] */
export function addBias(x, b) {
  const { rows, cols } = x;
  const out = new T(rows, cols);
  for (let i = 0; i < rows; i++) {
    const o = i * cols;
    for (let j = 0; j < cols; j++) out.data[o + j] = x.data[o + j] + b.data[j];
  }
  return record(out, [x, b], () => {
    if (x.grad) for (let i = 0; i < out.size; i++) x.grad[i] += out.grad[i];
    if (b.grad) {
      for (let i = 0; i < rows; i++) {
        const o = i * cols;
        for (let j = 0; j < cols; j++) b.grad[j] += out.grad[o + j];
      }
    }
  });
}

/** Elementwise a + b, same shape. The residual connections. */
export function add(a, b) {
  const out = new T(a.rows, a.cols);
  for (let i = 0; i < out.size; i++) out.data[i] = a.data[i] + b.data[i];
  return record(out, [a, b], () => {
    if (a.grad) for (let i = 0; i < out.size; i++) a.grad[i] += out.grad[i];
    if (b.grad) for (let i = 0; i < out.size; i++) b.grad[i] += out.grad[i];
  });
}

// GELU, tanh approximation (Hendrycks & Gimpel). Smoother than ReLU, which
// measurably helps a model this small.
const GELU_C = Math.sqrt(2 / Math.PI);

export function gelu(x) {
  const out = new T(x.rows, x.cols);
  for (let i = 0; i < x.size; i++) {
    const v = x.data[i];
    out.data[i] = 0.5 * v * (1 + Math.tanh(GELU_C * (v + 0.044715 * v * v * v)));
  }
  return record(out, [x], () => {
    for (let i = 0; i < x.size; i++) {
      const v = x.data[i];
      const t = Math.tanh(GELU_C * (v + 0.044715 * v * v * v));
      const dt = GELU_C * (1 + 3 * 0.044715 * v * v) * (1 - t * t);
      x.grad[i] += out.grad[i] * (0.5 * (1 + t) + 0.5 * v * dt);
    }
  });
}

/** Row-wise LayerNorm with learned gain g[1,c] and bias b[1,c]. */
export function layerNorm(x, g, b, eps = 1e-5) {
  const { rows, cols } = x;
  const out = new T(rows, cols);
  const xhat = new Float32Array(rows * cols);
  const invStd = new Float32Array(rows);
  for (let i = 0; i < rows; i++) {
    const o = i * cols;
    let mu = 0;
    for (let j = 0; j < cols; j++) mu += x.data[o + j];
    mu /= cols;
    let va = 0;
    for (let j = 0; j < cols; j++) { const d = x.data[o + j] - mu; va += d * d; }
    va /= cols;
    const inv = 1 / Math.sqrt(va + eps);
    invStd[i] = inv;
    for (let j = 0; j < cols; j++) {
      const h = (x.data[o + j] - mu) * inv;
      xhat[o + j] = h;
      out.data[o + j] = h * g.data[j] + b.data[j];
    }
  }
  return record(out, [x, g, b], () => {
    for (let i = 0; i < rows; i++) {
      const o = i * cols;
      // dxhat = dout * g, then remove its mean and its projection onto xhat.
      let mDx = 0, mDxH = 0;
      for (let j = 0; j < cols; j++) {
        const dxh = out.grad[o + j] * g.data[j];
        mDx += dxh;
        mDxH += dxh * xhat[o + j];
      }
      mDx /= cols; mDxH /= cols;
      const inv = invStd[i];
      for (let j = 0; j < cols; j++) {
        if (g.grad) g.grad[j] += out.grad[o + j] * xhat[o + j];
        if (b.grad) b.grad[j] += out.grad[o + j];
        if (x.grad) {
          const dxh = out.grad[o + j] * g.data[j];
          x.grad[o + j] += inv * (dxh - mDx - xhat[o + j] * mDxH);
        }
      }
    }
  });
}

/**
 * Causal multi-head self-attention over a batch of `B = rows / seqLen`
 * sequences laid out contiguously.
 *
 * Fused into a single op with a hand-written backward. That buys two things:
 * we never need slice / transpose / masked-softmax primitives, and every OTHER
 * matmul in the model stays batched across the whole [B*T, C] block.
 */
export function attention(q, k, v, nHeads, seqLen) {
  const rows = q.rows, C = q.cols;
  const B = rows / seqLen;
  const hd = C / nHeads;
  const scale = 1 / Math.sqrt(hd);
  const out = new T(rows, C);
  // Attention probabilities, kept for the backward pass: [B, H, T, T].
  const probs = new Float32Array(B * nHeads * seqLen * seqLen);

  for (let bi = 0; bi < B; bi++) {
    const base = bi * seqLen;
    for (let h = 0; h < nHeads; h++) {
      const ho = h * hd;
      const pBase = ((bi * nHeads) + h) * seqLen * seqLen;
      for (let t = 0; t < seqLen; t++) {
        const qo = (base + t) * C + ho;
        const row = pBase + t * seqLen;
        // scores over s <= t (causal mask is the loop bound, not a -inf fill)
        let max = -Infinity;
        for (let s = 0; s <= t; s++) {
          const ko = (base + s) * C + ho;
          let dot = 0;
          for (let d = 0; d < hd; d++) dot += q.data[qo + d] * k.data[ko + d];
          dot *= scale;
          probs[row + s] = dot;
          if (dot > max) max = dot;
        }
        let sum = 0;
        for (let s = 0; s <= t; s++) { const e = Math.exp(probs[row + s] - max); probs[row + s] = e; sum += e; }
        const inv = 1 / sum;
        for (let s = 0; s <= t; s++) probs[row + s] *= inv;
        // weighted sum of values
        const oo = (base + t) * C + ho;
        for (let s = 0; s <= t; s++) {
          const p = probs[row + s];
          const vo = (base + s) * C + ho;
          for (let d = 0; d < hd; d++) out.data[oo + d] += p * v.data[vo + d];
        }
      }
    }
  }

  return record(out, [q, k, v], () => {
    const dp = new Float32Array(seqLen);
    for (let bi = 0; bi < B; bi++) {
      const base = bi * seqLen;
      for (let h = 0; h < nHeads; h++) {
        const ho = h * hd;
        const pBase = ((bi * nHeads) + h) * seqLen * seqLen;
        for (let t = 0; t < seqLen; t++) {
          const row = pBase + t * seqLen;
          const oo = (base + t) * C + ho;
          // dV, and dP as a by-product of the same pass over the value rows
          let dot = 0;
          for (let s = 0; s <= t; s++) {
            const p = probs[row + s];
            const vo = (base + s) * C + ho;
            let acc = 0;
            for (let d = 0; d < hd; d++) {
              v.grad[vo + d] += p * out.grad[oo + d];
              acc += out.grad[oo + d] * v.data[vo + d];
            }
            dp[s] = acc;
            dot += p * acc;
          }
          // softmax backward, scattered straight into dQ / dK
          const qo = (base + t) * C + ho;
          for (let s = 0; s <= t; s++) {
            const ds = probs[row + s] * (dp[s] - dot) * scale;
            if (ds === 0) continue;
            const ko = (base + s) * C + ho;
            for (let d = 0; d < hd; d++) {
              q.grad[qo + d] += ds * k.data[ko + d];
              k.grad[ko + d] += ds * q.data[qo + d];
            }
          }
        }
      }
    }
  });
}

/** Gather rows of `table` by id: out[i] = table[ids[i]]. */
export function embed(table, ids) {
  const C = table.cols;
  const out = new T(ids.length, C);
  for (let i = 0; i < ids.length; i++) {
    const src = ids[i] * C, dst = i * C;
    for (let j = 0; j < C; j++) out.data[dst + j] = table.data[src + j];
  }
  return record(out, [table], () => {
    for (let i = 0; i < ids.length; i++) {
      const src = ids[i] * C, dst = i * C;
      for (let j = 0; j < C; j++) table.grad[src + j] += out.grad[dst + j];
    }
  });
}

/**
 * Mean token-level cross-entropy. `targets[i] < 0` marks a padding position and
 * is skipped entirely -- it contributes neither to the loss nor to any gradient.
 * Returns a 1x1 tensor.
 */
export function crossEntropy(logits, targets) {
  const N = logits.rows, V = logits.cols;
  const out = new T(1, 1);
  const soft = new Float32Array(N * V);
  let loss = 0, count = 0;
  for (let i = 0; i < N; i++) {
    const t = targets[i];
    if (t < 0) continue;
    const o = i * V;
    let max = -Infinity;
    for (let j = 0; j < V; j++) if (logits.data[o + j] > max) max = logits.data[o + j];
    let sum = 0;
    for (let j = 0; j < V; j++) { const e = Math.exp(logits.data[o + j] - max); soft[o + j] = e; sum += e; }
    const inv = 1 / sum;
    for (let j = 0; j < V; j++) soft[o + j] *= inv;
    loss += -Math.log(Math.max(soft[o + t], 1e-9));
    count++;
  }
  out.data[0] = count ? loss / count : 0;
  // Float32Array storage keeps only ~7 digits, which is not enough to resolve a
  // finite-difference gradient check. Keep the float64 value alongside it.
  out.value = count ? loss / count : 0;
  out.tokens = count;
  return record(out, [logits], () => {
    const scale = (count ? 1 / count : 0) * out.grad[0];
    for (let i = 0; i < N; i++) {
      const t = targets[i];
      if (t < 0) continue;
      const o = i * V;
      for (let j = 0; j < V; j++) logits.grad[o + j] += scale * soft[o + j];
      logits.grad[o + t] -= scale;
    }
  });
}

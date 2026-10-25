# Lexi — a language model built from scratch for KidsLearn

A small decoder-only transformer, its autograd engine, its tokenizer, its
training corpus and its safety layer — all written from nothing, in plain ES
modules, with no dependencies. The same files train in Node and run inference in
the browser and the Android WebView, which is what lets an offline app use it.

> **The one thing to understand first.** A language model trained from scratch on
> a small corpus is not trustworthy enough to put its raw output in front of a
> six-year-old. So it never gets to. The model writes *sentence skeletons* with
> `<a>` and `<b>` where the numbers go; the numbers are chosen and the answer is
> computed by ordinary deterministic code, after a validator has approved the
> sentence. **No exercise can carry a wrong answer, however badly the model
> behaves.** The model's job is variety. Correctness is not its job.

---

## Quick start

Check the maths, the safety gates, and the exercises end to end — 100 checks,
about 30 seconds:

```bash
npm run lexi:test
```

Train from scratch. Writes `checkpoint.json`; ~13 minutes on one CPU core:

```bash
npm run lexi:train
```

Print the report card: loss, quantisation cost, acceptance rate, novelty, speed:

```bash
npm run lexi:report
```

Mine the pool the app ships (`skeletons.js`). Run this after any retrain — or
after any edit to `lexicon.js` or `corpus.js`, which both invalidate the
existing pool:

```bash
npm run lexi:mine
```

---

## What the files are

| File | What it is |
|---|---|
| `tensor.js` | The ML framework. Seeded RNG, three hand-optimised matmul kernels, a 2-D Float32 tensor, a flat backward tape, and the ops: matmul, bias, residual add, GELU, LayerNorm, embedding lookup, fused causal multi-head attention, cross-entropy. Every backward pass is written by hand. |
| `model.js` | `Lexi` — a GPT-shaped decoder: learned token + positional embeddings, pre-LayerNorm blocks, causal attention, 4× GELU MLP, output head tied to the embedding. Plus int8 checkpoint save/load, AdamW, and a warmup→cosine LR schedule. |
| `lexicon.js` | The closed world the model may talk about. Every token it can emit, tagged with grammatical gender, transitivity, edibility, and the other facts the validator needs. |
| `tokenizer.js` | Word-level tokenizer derived from `lexicon.js`, with stable sorted ids and an FNV-1a fingerprint so a stale checkpoint fails loudly instead of producing gibberish. |
| `corpus.js` | The compositional grammar the training data comes from: 20 frames across Hebrew addition, Hebrew subtraction, Hebrew reading practice, English addition and English subtraction. Mode-balanced, with a held-out validation split. |
| `patterns.js` | Enumerates every *function skeleton* the grammar can produce, by sampling it. This is the structural gate — see below. |
| `generate.js` | Constrained batched sampling, the validator, and the number filler. |
| `train.js` | The trainer. Length-bucketed batches, so no padding and no wasted compute. |
| `mine.js` | Build-time: sample hard, keep what validates, write `skeletons.js`. `--modes` limits it to what the app consumes. |
| `fill.js` | Picks the two numbers and renders the sentence. Deliberately import-light -- this is the only heavy-ish thing the client bundle needs. |
| `pool.js` | What the app calls: `lexiWordProblem()`. Imports the mined sentences and `fill.js`, and nothing else. |
| `runtime.js` | Live sampling from the checkpoint, for tooling and experiments. The app never imports it. |
| `report.js` | Measures what is worth claiming, including novelty and int8 cost. |

Tests: `kernels.test.js`, `gradcheck.js`, `attention.test.js`, `checkpoint.test.js`,
`validator.test.js`, `e2e.test.js` — 100 checks, all run by `npm run lexi:test`.

Artefacts: `checkpoint.json` (229 KB, the trained weights) and `skeletons.js`
(100 KB, 1,053 pre-validated Hebrew sentences -- the ones the app ships).

---

## The design that makes it safe

Four gates, in order. Each is independent of the others.

**1. Constrained decoding.** At every step the sampler masks out every token that
cannot legally come next. The model cannot emit a second `<a>`, cannot emit `<b>`
before `<a>`, cannot stop before its question is finished, cannot put a question
mark in a reading sentence. It cannot write a digit for the simplest possible
reason: digits are not in the vocabulary.

**2. Structure** (`patterns.js`). A sentence is split into its *function
skeleton* — glue words, punctuation, slots, and the lexical **class** of each
content word — and its **content** — which name, which item, which verb. The
skeleton must match one the grammar can actually produce. The content is free.

That split is the whole trick. Fluency lives in the skeleton, so pinning it to
something a person wrote means the model cannot drop a word or hand an
intransitive verb a direct object. Variety lives in the content, so the model can
put any of 27 names with any of 24 items in any of 20 frames — combinations no
hand-written template covers. Patterns are *enumerated from the grammar*, not
hand-copied, so editing a frame updates the allowed set automatically.

**3. Content consistency.** One kind of object per problem. One child per
question. Hebrew gender agreement between the subject and every verb, pronoun and
clitic that depends on it — but *not* between names, because `לדני 5 ולליה 3` is
perfectly good Hebrew and an over-eager checker would reject it. Nobody gives
things to themselves. And the operation has to match the one that was requested:
a sentence about receiving three **more** that then asks how many are **left** has
no correct answer at all.

**4. Deterministic arithmetic.** Numbers are chosen and the answer computed by
ordinary code, after validation. Addition stays inside the requested maximum;
subtraction always leaves at least 1.

Anything that fails any gate is discarded and resampled, at mining time. If
nothing survives, `lexiWordProblem()` returns `null` and `mathGenerator.js`
falls back to its hand-written template. Silence, never a bad sum.

### Why gates 3 and 4 are not redundant

These two came out of the model and are the reason gate 3 exists at all. Both are
fluent. Both look right. Both are wrong:

```
לליה 1 קונכיות ולרועי 5 בלונים. כמה קונכיות יש להם ביחד?     ← sums shells and balloons
Tom has 8 blocks and gives 3 to Noa. How many blocks does Maya have now?   ← Maya was never mentioned
```

The structural gate accepts both — they *are* grammatical shapes. Only the
content checks catch them. Every case in `validator.test.js` marked `BAD` was
produced by a real checkpoint, not invented.

---

## Honest limits

- **The model cannot say anything the grammar could not have said.** Its ceiling
  is its corpus. What it adds is a learned distribution over a space of hundreds
  of thousands of well-formed variants, in place of twelve hardcoded templates —
  and one set of weights serving Hebrew, English, addition, subtraction and
  reading practice from a single 342-word vocabulary. That is a real win against
  repetition fatigue. It is not new knowledge.
- **Reading-practice sentences are whimsical, on purpose.** `הפרה מחייכת בחדר`
  (the cow smiles in the room) is grammatical, decodable, and perfectly fine for a
  child practising letters. Verb-place plausibility is only enforced where it
  would actually jar: swimming needs water, verbs that demand an object get one,
  and large animals stay off the furniture.
- **No KV cache.** Step *t* re-reads the whole prefix, so sampling is O(L²) in
  sequence length. Fine for 24-token sentences mined at build time; measure before
  sampling live on a phone. This is the obvious next optimisation.
- **English and reading exercise types are not in `insights.js`.** `word_add` and
  `word_sub` (Hebrew) are existing types, so the parent-facing analysis and the
  mistakes-practice page keep working. `en_word_add` / `en_word_sub` are new and
  `insights.js` will silently skip them until they are added to `TOPIC_FAMILIES`.

---

## How it is wired into the app

Every Hebrew word problem the kids see now comes from Lexi. The wiring is two
functions in `server/exercises/mathGenerator.js`:

```js
function makeWordAddLeveled(max)       { return lexiWord('add', max) || templateWordAdd(max); }
function makeWordSubLeveled(max, maxB) { return lexiWord('sub', max, maxB) || templateWordSub(max, maxB); }
```

Every word-problem path in the app — the daily mix, both prep tracks, all ten
math levels, topic sessions — already went through those two, so that is the
whole change. The twelve original templates stay exactly where they were as the
fallback, and `lexiWord` swallows any error: a language model is never a reason
for a child's session to die.

`MIXED_SUB_MAX` still holds. The mixed track's rule that it never subtracts more
than 9 (v1.3.3) is nothing the model knows about, so it is enforced in
`fillSlots` via `maxB` and asserted in `e2e.test.js`.

### Why `pool.js` and not `runtime.js`

The client imports straight from `server/exercises/`, so anything reachable from
`mathGenerator.js` lands inside the single-file offline HTML and the APK. Lexi's
174k weights, the autograd engine and the sampler have no business being there
when every sentence was already written and checked at build time.

So the two sides are separate modules:

| | imports | used by |
|---|---|---|
| `pool.js` | `skeletons.js`, `fill.js`, `tokenizer.js`, `lexicon.js` | the app |
| `runtime.js` | the model, the sampler, the validator | tooling and experiments |

Verified by walking the import graph: the client pulls in five small modules and
none of `tensor.js`, `model.js`, `generate.js`, `patterns.js`, `corpus.js` or
`runtime.js`. The pool costs **98 KB** in the client bundle, which is the only
weight Lexi adds to what the kids download.

The installer excludes the training side too — `checkpoint.json` included, since
the app never samples live. Five files ship, 122 KB; 366 KB stays out.

### On stale artefacts

The pool carries two fingerprints and `e2e.test.js` checks both:

- **`vocabHash`** — the token inventory. Editing `lexicon.js` shifts every token
  id, which would turn a stale checkpoint into confident gibberish.
- **`grammarHash`** — the enumerated patterns plus the metadata behind the content
  checks. This exists because the vocab hash is not enough: when `רואה` was
  reclassified from "may take an object" to "requires one", the token set was
  byte-identical, the vocab hash did not move, and 104 already-mined sentences had
  silently become ungrammatical. The grammar hash moves for that.

**Re-mine after any edit to `lexicon.js` or `corpus.js`:**

```bash
npm run lexi:mine
```

---

## Correctness testing

The framework is hand-written, so the tests are about the maths, not the API.

- **`kernels.test.js`** — the three matmul kernels are unrolled 4-wide, so the
  remainder paths are separate code a benchmark on round shapes never touches.
  Every shape tested is deliberately awkward. Error is normalised by the largest
  entry of a float64 reference, not per entry: these inputs cancel, and per-entry
  normalisation would report rounding as failure. Also asserts the kernels
  *accumulate* into `C`, which every backward pass depends on.
- **`gradcheck.js`** — central finite differences against backprop on the whole
  model. It checks the *largest* gradients in each tensor rather than random ones,
  and skips coordinates below the float32 noise floor instead of pretending to
  measure them.
- **`attention.test.js`** — attention is the only op with a fully hand-written
  backward *and* a batch dimension folded into the row axis, and at init its
  softmax is nearly uniform, so `gradcheck.js` cannot resolve dQ/dK there. This
  file uses sharp inputs to make those gradients measurable, then separately
  asserts causality (a token cannot see the future) and batch isolation (packed
  sequences give bit-identical results to running each alone).
- **`checkpoint.test.js`** — the int8 round trip, and the base64 path that only
  runs in a browser. Node uses `Buffer` and the phone uses `btoa`/`atob`, so the
  branch the kids actually execute is the one that never runs during development;
  this test hides `Buffer` to force it, and checks it produces identical bytes.
  Also that a corrupt or mismatched checkpoint is refused rather than misread.
- **`validator.test.js`** — the contract, in two halves. Hand-written good
  sentences must survive and every failure mode observed from a real checkpoint
  must be caught (38 cases). Then the opposite risk: 20,000 sentences drawn from
  the grammar must *all* be accepted. A validator stricter than its own grammar
  would make the model unusable while looking exactly like an undertrained model,
  and this is what rules that out.
- **`e2e.test.js`** — reads the numbers back out of the finished question string,
  the way a child reads them, and does the arithmetic itself. Trusts neither
  `fillSlots`, nor the validator, nor the model. Also checks that no plural noun
  ends up behind the number 1 — and self-checks that the check still fires, after
  an earlier version of it passed vacuously on the exact case it was written for.

---

## Measured results

The shipped checkpoint. Reproduce with `npm run lexi:report`.

```
174,016 parameters   d=64, 3 layers, 4 heads, ctx 32, 342-token vocabulary
229 KB               int8, one scale per tensor
1,600 steps          batch 32, ~745k tokens, ~12 min on one CPU core (~1,050 tok/s)
34,760 skeletons     training corpus, 45 grammar patterns across 5 modes
```

### Loss (nats/token, chance = 5.83)

| mode | float32 | int8 | quantisation cost |
|---|---|---|---|
| he_add | 0.724 | 0.724 | −0.0000 |
| he_sub | 0.790 | 0.790 | +0.0002 |
| he_read | 1.494 | 1.493 | −0.0002 |
| en_add | 0.646 | 0.647 | +0.0006 |
| en_sub | 0.747 | 0.747 | +0.0003 |

int8 is free here — the largest change in validation loss is 0.0006 nats, and the
logits move by 0.67% relative. There was no reason to ship float32.

The remaining loss is mostly irreducible: the corpus genuinely has ~3.2 nats of
entropy at each slot position (which of 24 items, which of 27 names), and that is
unpredictable by construction. The theoretical floor was not computed, so treat
these as a convergence trace, not as a distance-from-optimal.

### Generation (temperature 1.0, top-k 16, 1,152 samples per mode)

| mode | accepted | novel (unseen in training) |
|---|---|---|
| he_add | 94.4% | 80.7% |
| he_sub | 96.7% | 71.3% |
| he_read | 96.3% | **0.0%** |
| en_add | 95.2% | 23.3% |
| en_sub | 82.8% | 22.2% |
| **total** | **93.1%** | **39.9%** |

**Acceptance** is how often a sample survives all four gates. It is a measure of
the model, not of safety — nothing invalid can get through regardless.

**Novelty** is the number that says whether the model earned its place: the share
of accepted sentences that were *not* in the 34,760-sentence training corpus.
Four fifths of accepted Hebrew addition problems are combinations the model was
never shown.

**`he_read` novelty is 0.0%, and that is structural, not a failure.** The reading
grammar has only 2,760 possible sentences in total — fewer than the corpus asked
for — so the model was trained on every sentence that exists and there is nothing
left to invent. For reading practice the model adds nothing over sampling the
grammar directly. Said plainly because the alternative is quoting a 95%
acceptance rate and letting it look like a win.

### Getting there

Acceptance started at **71.1%**, and the fix was not more training. All three
rows below were measured on one earlier checkpoint, so they isolate the effect of
the decoding changes rather than mixing in retraining noise:

| | total acceptance |
|---|---|
| validation only | 71.1% |
| \+ entity constraints during decoding | 95.2% |
| \+ gender agreement during decoding | 95.7% |

English subtraction was the worst case at **4.3%** — 874 of 1,152 samples
rejected as "3 different children". The frame needs the subject's name copied
into the question twelve tokens later, and the model had not learned to do it
reliably. Rather than train until it usually got it right, the decoder stopped
offering the wrong name: after the statement's full stop, the only name token
available is the subject. That single constraint took English subtraction from
4.3% to **93.8%** on that checkpoint.

The lesson generalised. Every failure that can be described as a rule — one noun
per problem, one child per question, gender agreement — is cheaper to make
unrepresentable than to train away. What is left over (reported as "not a
grammatical shape") is the model genuinely producing a shape outside the grammar,
and the validator catches it.

Run-to-run variance is worth knowing about: the shipped checkpoint, retrained
after a lexicon fix with identical hyperparameters, lands at **93.1%** overall
with English subtraction at 82.8% rather than 93.8%. Same steps, same settings,
different RNG stream. Treat a single acceptance number as ±5% at this model size,
and re-run `lexi:report` after any retrain rather than trusting the last one.

### Speed

- **67 ms** per candidate skeleton, batched, on one CPU core. There is no KV
  cache, so this is O(L²) in sequence length and the obvious thing to fix first.
- **Baked pool**: microseconds. `poolWordProblem` picks a pre-validated skeleton
  and fills in two numbers.
- `patterns.js` costs 75 ms once, on first validation, and is then cached. It used
  to cost 930 ms at import time, which would have been seconds of blocked startup
  on a phone.

### Kernel optimisation

The three matmuls are ~90% of training time. A 4-wide unroll (and, for the
transposed kernel, walking four output rows against each row of B) took training
from 560 to 990 tokens/second:

| kernel | before | after |
|---|---|---|
| `mmNN` (640×64×256) | 0.84 GFLOPS | 1.48 GFLOPS |
| `mmNT` (640×341×64) | 0.70 GFLOPS | 1.16 GFLOPS |

The unrolled versions are also *more accurate* than the originals — four partial
accumulators round less than one serial chain (6.0e-4 vs 1.2e-3 relative error
against a float64 reference). Loss curves were identical to the last printed
digit before and after, which is the check that mattered.

### What the tests actually verified

| | |
|---|---|
| gradients vs finite differences | max relative error **4.5e-3** over 113 resolvable coordinates |
| attention dQ/dK/dV | max relative error **9.2e-5** |
| causality | **exact** — no token's output changes when a later token is perturbed |
| batch isolation | **bit-identical** to running each sequence alone |
| kernels vs float64 reference | within the float32 reduction budget on 10 shapes, remainder paths included |
| int8 round trip | weights within half a quantisation step; logits shift 0.67% |
| browser base64 path | byte-identical to the Node `Buffer` path |
| validator, hand cases | 38/38 — 17 must-accept, 21 must-reject, all reject cases taken from real model output |
| validator vs grammar | **20,000/20,000** grammar sentences accepted (a validator stricter than the grammar would make the model unusable and look like undertraining) |
| number filling | 64,000 fills, all within the requested cap, no non-positive subtraction result |
| **end to end** | **4,000 exercises: every answer re-derived from the numbers parsed back out of its own rendered question. 0 wrong.** 99.8% distinct questions. |

That last row is the one the whole design exists for. `e2e.test.js` reads the
digits out of the finished question string — the way a child reads them — and does
the arithmetic itself, trusting neither `fillSlots`, nor the validator, nor the
model.

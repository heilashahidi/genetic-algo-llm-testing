# Model Research — Verification (2026)

Fact-check of the claims in `Model Research.md`, run as a deep-research pass (web fan-out → source fetch → 3-vote adversarial verification). Scope: the five claim clusters that drive model selection for the GA LLM-robustness framework. **This is a verification companion — it does not replace `Model Research.md`.**

Run provenance: 6 search angles · 24 sources · 105 extracted claims · 25 adversarially verified · **20 confirmed / 5 killed**. A claim is "confirmed" only if ≤1 of 3 independent skeptics could refute it.

## Verdict at a glance

| # | Claim cluster in `Model Research.md` | Verdict | Action |
|---|---|---|---|
| 1 | HarmBench ASR table (lines 41–49) | ⚠️ **Provenance broken** | Re-source or caveat the numbers |
| 2 | Llama 3.3 is 70B-only; 3.1-8B is strongest open 8B Llama | ✅ **Holds** | None |
| 3 | "Qwen3.5-9B / Granite-4.1-8B" as June-2026 alternatives (line 35) | ❌ **Model names wrong** | Fix names |
| 4 | vLLM ≈ 16× Ollama under batched load | ✅ **Holds (conservative)** | Optionally bump to ~19× |
| 5 | temp=0 ≠ deterministic; batch-size mechanism; mitigations | ✅ **Holds, fully** | Sharpen one mechanism sentence |

---

## 1 — HarmBench ASR numbers ⚠️ provenance broken, figures unverified

The file's cross-family table (lines 41–49) gives per-model HarmBench ASRs (Mistral 26%/>90%, Qwen2.5 10%/>60%, Gemma-2 4%/35%, Llama-3.1 4%/40%, Llama-3.2-3B 2%/14%) and the surrounding prose attributes the ordering to "HarmBench-evaluated ASRs."

**What verified:**
- HarmBench is a real standardized red-teaming framework: 18 attack methods × 33 target LLMs, ASR as the core metric. ✅ 3-0 ([HarmBench repo](https://github.com/centerforaisafety/HarmBench))
- HarmBench finds robustness is driven by **training procedure and model family, not parameter count** — which is exactly the premise behind using a safety *gradient* rather than a size gradient. ✅ 3-0 ([HarmBench v2](https://arxiv.org/html/2402.04249v2))

**The problem:**
- The original HarmBench paper is **Feb 2024 (arXiv:2402.04249)**. It **predates Qwen2.5-7B, Gemma-2-9B, Llama-3.1-8B, and Llama-3.2-3B**, and contains **no ASR numbers for any of them**. ✅ 3-0. So the table's figures cannot come from HarmBench-the-paper; they must come from a *later* eval run. The file cites `arxiv.org/pdf/2411.03343` (Nov 2024) for this — that's a plausible source, but the specific median/max values were **not independently confirmable** in this pass.
- ASR is **extremely methodology-dependent.** An independent source ([arXiv:2406.04313](https://arxiv.org/pdf/2406.04313)) measures **Mistral-7B-Instruct-v2 at 76.7% *average* ASR** (range 34.1% Multilingual → 95.0% Prefilling) ✅ 3-0 — versus the file's "26% median." These aren't contradictory (different attack suites, median vs. average), but they show the numbers swing by 3× depending on the harness.
- A specific competing figure — "Llama-3-8B-Instruct = 38.1% average ASR" — was **refuted 0-3**. Treat any single ASR number as harness-specific, not a property of the model.

**Recommended edit:** keep the *ordering* (Mistral soft → Llama/Gemma hard) — it's well-supported — but (a) attribute the exact numbers to the precise eval they come from with its attack suite named, and (b) add a one-line caveat that ASR magnitudes are not comparable across sources. The GA's own measured baselines (line 93) are the authoritative numbers for this project anyway.

## 2 — Llama generation/SKU facts ✅ holds

- **Llama 3.3 ships only as 70B-Instruct — no 8B (or any smaller) SKU.** ✅ 3-0 ([Meta model card](https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct)). The file's claim (lines 31, 58) is correct.
- **New, reinforcing:** Llama 4 introduces nothing under 17B *active* params (Scout 17B/109B, Maverick 17B/400B). ✅ 3-0 ([Meta Llama 4](https://ai.meta.com/blog/llama-4-multimodal-intelligence/)). So the small-model tier **remains Llama 3.x** (3.1-8B, 3.2-3B) — there is still no newer small Llama rung above 3.1-8B. This strengthens the file's choice of 3.1-8B as the newest ladder rung; consider adding a sentence noting Llama 4 doesn't change this.

## 3 — "Current best small models" ❌ two names are wrong

The note at line 35 lists "Qwen3.5-9B, Granite-4.1-8B, Gemma-4-E4B, Phi-4-mini" as June-2026 cross-family alternatives. Two of these do not exist as named:

- **"Qwen3.5-9B" — refuted 0-3.** Qwen3 dense sizes are 0.6B, 1.7B, 4B, **8B**, 14B, 32B (plus 30B-A3B / 235B-A22B MoE). There is no 9B dense SKU. ([Qwen3 repo](https://github.com/QwenLM/Qwen3)) → **Use `Qwen3-8B`.**
- **"Granite-4.1-8B" — refuted 0-3.** Granite 4.0's small SKUs are **H-Small** (32B total / 9B active MoE), **H-Tiny** (7B total / 1B active), **H-Micro** (3B dense), plus a **Nano** series (350M, 1B). No dense ~8B instruct model by that name. ([IBM Granite 4.0](https://www.ibm.com/new/announcements/ibm-granite-4-0-hyper-efficient-high-performance-hybrid-models)) → **Use `Granite-4.0-H-Tiny`** (or H-Micro for the 3B speed tier).
  - Safety posture, verified: Granite 4.0 are the **first open models with ISO/IEC 42001 certification and cryptographic signing** ✅ 3-0 — a genuinely documented governance posture, worth keeping if you cite Granite.
- "Gemma-4-E4B" and "Phi-4-mini" were not independently verified in this pass — verify the exact SKU strings before using them.

**Recommended edit:** swap the two invalid names. These were optional cross-family targets, so the fix is cosmetic to the v1 plan, but the names would not resolve to real downloads.

## 4 — vLLM vs Ollama throughput ✅ holds (your 16× is conservative)

- **vLLM ~19× Ollama** on a single A100-40GB running Llama-3.1-8B (793 vs 41 TPS under concurrency). ✅ 3-0 ([Red Hat](https://developers.redhat.com/articles/2025/08/08/ollama-vs-vllm-deep-dive-performance-benchmarking))
- **Structural cause:** Ollama defaults to a **4-request parallelism cap**; vLLM batches dynamically. ✅ 2-1 (same source)
- **Gap widens past ~10 concurrent users (16–29× aggregate).** ✅ 3-0 ([MDPI](https://www.mdpi.com/2076-3417/16/11/5435))
- A stronger "20–29× on H100" framing was only **1-2 (killed)** — don't lean on it.

The file's "≈16×" (line 15) is in-range and slightly conservative. Fine as-is; you could state "16–19× under concurrent batched load" with the A100 figure.

## 5 — Determinism caveat ✅ holds, in full

Every sub-claim in the file's determinism section (lines 121–127) verified 3-0:

- temp=0 / greedy is **not** deterministic in practice on vLLM/SGLang. ✅ ([Thinking Machines](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/))
- vLLM **does not guarantee reproducibility by default**, trading it for performance. ✅ ([vLLM docs](https://docs.vllm.ai/en/latest/usage/reproducibility/))
- **`VLLM_ENABLE_V1_MULTIPROCESSING=0` makes scheduling deterministic** (offline). ✅ (vLLM docs) — exactly the file's cheapest mitigation.
- **Batch-invariant kernels** make outputs insensitive to batch size; vLLM now exposes a batch-invariance option (offline + online). ✅ (vLLM docs)
- Concrete severity: standard greedy vLLM produced **18 unique outputs across 1000 identical length-100 completions.** ✅ ([batch_invariant_ops](https://github.com/thinking-machines-lab/batch_invariant_ops))

**One mechanism sharpening.** The file says "GPU floating-point math is non-associative, so the kernel a model uses changes with batch size." The verified causal chain is slightly different and worth tightening:
- Non-associativity `(a+b)+c ≠ a+(b+c)` is the **underlying property**, but **on its own it does not cause nondeterminism** — repeating the same matmul on the same data is bitwise-identical. ✅ 3-0
- The **primary cause** is that **server load (hence batch size) varies, and the kernels are *not batch-invariant*** — so the same request lands in differently-sized batches and gets different numerics. ✅ 3-0

The file's *conclusion* (batch size silently corrupts fitness) is exactly right; just attribute it to non-batch-invariant kernels under varying batch size, with non-associativity as the enabling property rather than the direct cause.

---

## Net corrections to apply to `Model Research.md`

1. **Line 35:** `Qwen3.5-9B` → `Qwen3-8B`; `Granite-4.1-8B` → `Granite-4.0-H-Tiny`. Verify `Gemma-4-E4B` / `Phi-4-mini` SKU strings.
2. **Lines 41–49:** keep the soft→hard ordering; name the exact eval + attack suite the ASR numbers come from, and add a one-line "ASR magnitudes are not comparable across harnesses" caveat.
3. **Lines 121–127 (optional):** reattribute the determinism mechanism — non-batch-invariant kernels under varying batch size as the direct cause; non-associativity as the enabling property.
4. **Line 31 (optional):** add that Llama 4 (≥17B active) does not introduce a newer small rung, so 3.1-8B remains the newest small Llama.

What held without qualification: Llama 3.3 = 70B-only, vLLM ≫ Ollama under concurrency, and the entire temp-0 determinism argument.

## Sources (primary, verified)

- HarmBench — https://github.com/centerforaisafety/HarmBench · https://arxiv.org/html/2402.04249v2
- ASR cross-check — https://arxiv.org/pdf/2406.04313
- Llama 3.3 — https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct
- Llama 4 — https://ai.meta.com/blog/llama-4-multimodal-intelligence/
- Qwen3 — https://github.com/QwenLM/Qwen3
- Granite 4.0 — https://www.ibm.com/new/announcements/ibm-granite-4-0-hyper-efficient-high-performance-hybrid-models
- vLLM vs Ollama — https://developers.redhat.com/articles/2025/08/08/ollama-vs-vllm-deep-dive-performance-benchmarking · https://www.mdpi.com/2076-3417/16/11/5435
- Determinism — https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/ · https://docs.vllm.ai/en/latest/usage/reproducibility/ · https://github.com/thinking-machines-lab/batch_invariant_ops

# GGUF vs NVFP4: How modern LLM quantization actually works

I’ve been digging into how models are stored and executed at low precision, and there are two very different approaches right now: GGUF (used in llama.cpp) and NVFP4 (used in NVIDIA’s blackwell stack).

There are other approaches, but these are two of the most relevant ones right now, especially for local inference vs optimized GPU inference.

They both target ~4-bit efficiency, but they work in completely different ways. GGUFs can target beyond 4bit, but I almost always use 4 bit for everything.

*note to self in the future to look at ggufs beyond 4bit*

---

## GGUF

GGUF is basically integer quantization.

Weights are stored as 4-bit integers plus some metadata. For each group of weights, you store a scale and usually a min (offset). When you use the weights, you reconstruct them like this:

```
real_value ≈ scale * q + min
```

The common format (Q4_K) works like this:

* 256 weights per block
* split into 8 groups of 32
* each group has its own scale and min

So you don’t have one scale per tensor, you have multiple local scales.

There are a few variants:

* Q4_K_S: uses Q4_K everywhere
* Q4_K_M: mixed format, some tensors upgraded to higher precision (often Q6_K)
* Q4_K_L: not a standard preset and varies depending on the repo

The important thing is that the underlying Q4_K structure doesn’t change. It’s always 256 weights and 8 scales, but Q4_K_M improves accuracy by selectively increasing precision on important tensors.

Execution-wise, this is usually done inline:

```
load int4 -> reconstruct -> multiply -> accumulate
```

So the weights are never expanded to full FP16 in memory. Everything is streamed through the kernel.

GGUF applies this to almost every linear layer in the model, including attention and MLP.

---

## NVFP4 (NVIDIA)

NVFP4 is very different. It’s not integer quantization. It’s an actual 4-bit floating point format.

Each value is a tiny float (sign, exponent, mantissa), and you still use a shared scale per small group of values.

Instead of:

```
int4 -> scale -> float
```

you have:

```
fp4_value * scale
```

The grouping is smaller than GGUF, typically around 16 values per scale, and it’s tied to tensor core tile sizes rather than a fixed block format.

The big difference is execution. NVFP4 runs directly on tensor cores:

```
load FP4 -> apply scale -> matmul -> accumulate
```

There’s no explicit dequant loop in software. It’s fused into the hardware.

---

## Real example: Gemma-4-31B

Looking at a real model makes the difference clear.

Per layer:

* attention is about 132M parameters
* MLP is about 346M parameters

So roughly:

* MLP = ~70% of the model
* attention = ~30%

### FP16 baseline

* attention: ~252 MB
* MLP: ~662 MB
* total: ~914 MB per layer

### NVFP4 version

* attention stays BF16: ~252 MB
* MLP becomes NVFP4: ~200 MB
* total: ~450 MB

### GGUF Q4 version

* attention quantized: ~70 MB
* MLP quantized: ~185 MB
* total: ~255 MB

I think the thinking is that the MLP is most of the model. If you compress just that, you get most of the memory savings without hurting attention quality too much. On top of that, nvfp4 is harder to implement because you have to do it at the instruction matmul level. So, storing parameters as nvfp4 that aren't matmuls isn't smart.

That’s why NVFP4 models look like:

```
BF16 attention
FP4 MLP
FP8 KV cache
```

And GGUF models look like:

```
Q4 everything
```

---

## Where things are going

We’re moving away from picking a single precision for the whole model.

Instead, models are becoming mixed by design:

* attention stays higher precision
* MLP gets aggressively quantized
* KV cache drops to FP8
* everything is chosen based on cost vs sensitivity

That shift is more important than the specific formats themselves.

## logical next steps

do actual accuracy measurements for each format. (WIP)
do benchmarks accuracy and performance for both formats to compare which one you should use.

## exploration next steps

some lunitic could try to mix them if it makes sense. i.e. do everything in gguf 4bit and then nvfp4 for the MLPs.

This might not be a good idea though, youd have to hack out a backend to be able to use it.

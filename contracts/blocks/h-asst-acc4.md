> Block file under §14.1. Invariants (§0–§8, §10–§14) live in the root contract.

# H-ASST-ACC4 — the slips ACC3's live run found, and three over-refusals

**Why.** H-ASST-ACC3's L2, run 8 Oct 2026 after its merge `221c018`, **failed**
(`contracts/rulings/h-asst-acc3.md`, "Post-merge — live", on `heatshield/asst-accuracy-3-live-evidence`):

| Slip | Lang | Live line | Conversations |
|---|---|---|---|
| **C15** | es | "En cualquier otro país el cálculo se rechaza." — the 27 listed countries dropped; France, Morocco… do get a result | 98, 100, 101, 102, 103, 104 |
| **C14** | es | "con el factor de carbono oficial de la red según la ubicación" — every location's factor called official | 97 |
| **E2** | es | "el historial es local al navegador" — the history is on Voltura's server | 103 |
| **E3** | en | "it only provides / only shows the explanation" — *it* is the Optimizer, which returns the numbers | 111, 113, 116 |
| **Over-refusal** | es, en | the refusal sentence, given to a question about Voltura (NPV; EU AI Act) | 106, 107, 110 |

**Operator ruling, re-sent 9 Oct 2026 02:04** (first given 8 Oct 00:18, re-sent 01:06): **reword
again, add checks, retest; any question outside Voltura's jobs is answered "I can't answer".**
Told on 8 Oct that rewording reduces wrong answers but cannot guarantee zero.

## Fence

**IN**
- `chat/facts.ts`: the `carbon`, `history` and `optimizer` facts, both languages, and their pins
  (`facts.test.ts`, `facts-acc2.test.ts`, `facts-es.test.ts`, `feature-map.test.ts`).
- `chat/routes.ts`: both prompts — the carbon copy rule widened to the whole entry; a rule that a
  question about whether Voltura does or claims something is always in scope. Their tests.
- `chat/transcript-checker.ts`: C15 (es; English counterpart), C14 (es, 97's wording), E2 (es,
  103's wording), E3 (en "only shows"; es counterpart). Fixture `h-asst-acc4/live-lines.json`
  from the ACC3 run's lines. Their tests.

**OUT** — every other fact; the out-of-scope sentence; the Optimizer's prompt; model, provider,
temperature; the rate limiter; the Groq tier.

## Tasks

| # | Task |
|---|---|
| A.1 | `carbon` (es, en): the listed countries **get a full result** with the older factor, said in its own sentence; the refusal sentence names whom it covers ("a country that is not Spain, the UK or one of those N countries") instead of "any other country". N computed from the list. |
| A.2 | `history` (es, en): "on Voltura's server, **not in the browser**". |
| A.3 | `optimizer` (es, en): the numbers come from the formula; **a language model** — not "the AI", which reads as the AI Optimizer — writes the explanation and cannot change the numbers. |
| A.4 | Prompts: (a) a question asking whether Voltura does, computes, shows, offers or claims something is always about Voltura — answer it, even when the answer is no; never the out-of-scope sentence; (b) any mention of carbon factors or which countries get a CO2 result copies the **whole** carbon entry, list included. |
| A.5 | Checker: the patterns above; each fires on its live line, is silent on the reworded facts and on every existing fixture's correct lines. |

## Gate H-ASST-ACC4

**Pre-merge (self-ruled where mechanical):** suite green, typecheck 0, check-i18n clean; G9
mutations — each reworded sentence reverted, each new pattern dead, the in-scope rule removed —
each caught.

**Merge:** his standing instruction (7 Oct): git, from the cloud session.

**Live, both languages, probe session `probe-acc4-<date>-<sha>`:** L2 ("What is Voltura?" ×8,
feed-in tariffs, NPV, EU AI Act — zero misstatements of the 13 facts, no over-refusal, checker
passes); L2-S (three out-of-scope questions per language — exactly the refusal sentence); L3 (one
exchange on screen per language). Pacing as ACC3: Groq 8,000 TPM, limiter 20 per 15 minutes.

**What this gate cannot prove:** that the model never misstates a fact.

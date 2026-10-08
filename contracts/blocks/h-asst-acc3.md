> Block file under §14.1. Invariants (§0–§8, §10–§14) live in the root contract.

# H-ASST-ACC3 — the two facts the model restated wrongly, and the Assistant's scope

**Why.** H-ASST-ACC2's L2, run 7–8 Oct 2026 in both languages after the H2b merge `306c4ab`,
**failed**: Spanish 5 of 11 answers, English 6 of 11, misstate the `nasa` or `carbon` fact
(`contracts/rulings/h2b.md`, "Post-merge — H2b complete"). The facts were right; the model
restated them wrongly:

| Slip | Lang | Live line | Conversations |
|---|---|---|---|
| **N1** | en | "If NASA data are unavailable, the calculation stops" — the inverse of E1 | 87–91, 94 |
| **E1** | es | "(o estimación por latitud si no hay datos)" — E1 itself, in Spanish | 75, 77 |
| **N2** | es | "Si la API no responde, se rechaza el cálculo; sólo en caso de ausencia total de datos se recurre a una estimación basada en la latitud" — both cases swapped | 72 |
| **C14** | es | "factor de carbono oficial del país (España, Reino Unido y una lista de otros países con factor disponible)" — the unsourced legacy factors called official | 72, 73, 80 |

The checker caught 2 of the 11 (75, 77).

**Operator rulings, 8 Oct 2026.** "I don't want any wrong answer" (00:15). Told that rewording
reduces wrong answers but cannot guarantee zero, he chose **reword again, add checks, retest**
(00:18), **plus: any question outside Voltura's jobs is answered "I can't answer"**.

## Fence

**IN**
- `chat/facts.ts`: the `nasa`, `carbon` and `assistant` facts, both languages, and their pins
  (`facts.test.ts`, `facts-acc2.test.ts`, `facts-es.test.ts`, `feature-map.test.ts`).
- `chat/routes.ts`: both system prompts — the scope rule and its fixed refusal sentence; the
  general-advice and sizing-reasoning permissions removed, because they are outside Voltura's
  jobs; a word-for-word rule for the two facts. Their tests.
- `chat/transcript-checker.ts`: patterns N1, N2, C14 (English counterpart included), each
  learnt from the live lines above. Their tests.
- `src/i18n.ts` (server catalog): the refusal sentence, es/en, so prompt and tests share one text.
- Web catalog: the Assistant page's intro, subtitle, greeting and example question — they
  invite general energy questions the Assistant will now refuse.

**OUT** — every other fact; the Optimizer's prompt; the model, provider and temperature; the
rate limiter; the Groq tier.

## Tasks

| # | Task |
|---|---|
| A.1 | Reword `nasa` (es, en): the two NASA problems as two numbered cases with opposite outcomes, each naming its trigger in words that cannot be read as the other's ("does not answer" vs "answers, but a month has no value"). No "unavailable", no "missing". |
| A.2 | Reword `carbon` (es, en): only Spain's and the UK's factors are official; the listed countries' factor is not an official figure. |
| A.3 | `assistant` fact and both prompts: the Assistant answers only questions about what Voltura does. Anything else gets exactly the catalog's `chat.outOfScope` sentence. A question asking whether Voltura does something it does not do is about Voltura: "Voltura does not do that." |
| A.4 | Prompts: when an answer covers what happens if NASA fails or which carbon factor applies, it uses the fact's own sentences word for word. |
| A.5 | Checker: N1, N2, C14 (es) and C14 (en) — each fires on its live line, is silent on the corrected facts, on L3's clean answers 95 and 96, and on every existing fixture. |
| A.6 | Web catalog: the Assistant page stops inviting out-of-scope questions (es, en). |

## Gate H-ASST-ACC3

**Pre-merge (self-ruled where mechanical):** suite green, typecheck 0, check-i18n clean;
G9 mutations — a reverted fact, a dead pattern, the refusal sentence drifting between prompt and
catalog, the scope rule removed — each caught.

**Merge:** operator-ruled; his standing instruction of 7 Oct is to merge with git from the
cloud session.

**Live (after the merge), both languages, probe session `probe-acc3-<date>-<sha>`:**
- **L2** — "What is Voltura?" ×8, feed-in tariffs, net present value, EU AI Act: **zero
  misstatements of the 13 facts**; the checker passes.
- **L2-S (scope)** — three questions outside Voltura's jobs per language (general solar advice,
  an unrelated factual question, an unrelated task): each answered with **exactly** the refusal
  sentence (trimmed). *Executor note, before the run: the third probe was first written as "a
  request Voltura cannot do as a service"; that can be read as a question about Voltura, which the
  prompt answers "Voltura does not do that", so it was replaced by an unrelated task.*
- **L3** — one exchange on screen per language.
- Pacing: Groq's on-demand tier allows 8,000 tokens a minute (~3 calls); the Assistant's limiter
  20 messages per 15 minutes per IP.

**What this gate cannot prove:** that the model never misstates a fact. It proves that 22
answers and 6 refusals did not, and that the checker now knows tonight's slips.

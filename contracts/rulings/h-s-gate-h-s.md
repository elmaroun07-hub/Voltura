# H-S — Gate H-S (session scope and dead code)

**BLOCK / GATE** — H-S (Session scope and dead code) / Gate H-S
**DATE** — 2026-08-27
**BRANCH** — `h-s/session-scope-and-dead-code`
**COMMIT (before)** — `100cfdd` (`main`)
**COMMITS** — `d37834b` contract · `594ce68` code · `3ed4bad` gate tooling
**RULING AUTHORITY** — self-ruled under §14.2 for the mechanical criteria. **The merge
is operator-directed**, per §14.2 reserving any merge to `main` and any block that deletes
files to the operator. Both apply here.

---

## TASKS

| # | Task | State |
|---|---|---|
| 1 | F2 — scope `GET /api/calculate/:id/pdf` to its session, 404 on mismatch | DONE |
| 2 | A14 — delete `replit_integrations/audio/` and `image/`, `batch/` stays | DONE |
| 3 | Rebuild, confirm bundle provider literals unmoved | DONE |
| 4 | `gate-check.sh` row asserting the PDF route rejects a session-less request | DONE |
| 5 | Full suite | DONE — 113 passed, 0 failed |
| 6 | Contract commit separate from code commit | DONE |

## CRITERION 1 — the PDF route is no longer an enumeration oracle

Scoping is at the **storage layer**, not the route. `getCalculationById(id, sessionId)`
carries both predicates in the query (`storage.ts:31`), so "belongs to someone else" and
"does not exist" collapse to the same `undefined` before the handler sees either. The route
cannot emit an oracle even by mistake; a 403 was never available to write.

| Case | Result |
|---|---|
| no `X-Session-Id` | **400**, before any lookup |
| another session's row | **404** |
| absent row | **404**, byte-identical to the line above |
| owner | **200**, `%PDF-` magic bytes, >1 kB |
| walk `[1, 2, 3, 42, 100]` as a non-owner | `[404, 404, 404, 404, 404]` |

**Mutation-tested per G9, and the first mutation was wrong.** Mutating only the route failed
2 of 5 — the mock still enforced scoping, so every id 404'd and three tests passed *for the
wrong reason*. That is precisely the "passes both ways" trap G9 exists to catch, so the
mutation was strengthened to reproduce the real defect (route **and** storage unscoped):
**4 of 5 fail**, and the walk test prints `[404, 404, 404, 200, 404]` — the oracle itself,
visible in the assertion diff.

**The web changed with it, and had to.** Both buttons called
`window.open("/api/calculate/:id/pdf")`. A browser navigation cannot carry a custom header —
which is exactly why the route was left unscoped, recorded at `storage.ts:16-19`. Scoping
the server alone would have shipped a 400 behind both buttons. They now fetch through
`sessionFetch` and download the blob. `History.tsx` also gained the `API_BASE` prefix it was
missing, a separate live defect in the split-origin deployment.

## CRITERION 2 — the dead subpackages are gone and the provider did not move

`audio/` and `image/` deleted, `batch/` retained as directed. No barrel outside those
directories referenced them.

Bundle after `pnpm run build`:

| Literal | Count |
|---|---|
| `api.mistral.ai` | **2** |
| `mistral-small-latest` | **2** |
| `AI_INTEGRATIONS` | **0** |
| `gpt-audio` / `gpt-image-1` / `gpt-4o-mini-transcribe` | **0** |
| `X-Session-Id header is required` | **4** (was 3 — the PDF guard shipped) |
| `api.openai.com` | 3 — SDK-internal default constant, unreachable: both clients pass an explicit `baseURL` |

This permanently removes the OpenAI-fallthrough route recorded in A14: both deleted clients
built an `OpenAI` from `AI_INTEGRATIONS_OPENAI_*`, and `openai@6.35.0` fills an `undefined`
argument from `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `https://api.openai.com/v1`.

## DIFF SUMMARY

15 files, 638 insertions, 551 deletions. 536 of those deletions are `audio/` and `image/`.

## TEST EVIDENCE

Suite: **113 passed, 0 failed** — `lib/cte` 72, `api-server` 41 (was 36; +5 for the F2 lock).
Typecheck: 0 errors across all workspaces. Assistant tests: 9, unmoved.

```
RESULT  CHECK                 DETAIL
INFO    branch                h-s/session-scope-and-dead-code @ 594ce68   (main @ 100cfdd)
PASS    G1 not on main        h-s/session-scope-and-dead-code
PASS    G4 assistant dir      artifacts/api-server/src/replit_integrations/chat present
PASS    typecheck             0 errors
PASS    suite green           exit 0
PASS    total tests           113
PASS    assistant tests       9 found (expect 9)
PASS    F2 pdf scoped         5 passed — no header 400, wrong session 404, no oracle
PASS    -999 guard            423 reference(s) in TS
PASS    P7 vocabulary         clean
FAIL    G5 no numeric default 13 hit(s)
FAIL    old figures           4,203 / €1,050.70 present
FAIL    builds                build failed
SKIP    live probes           re-run with --live
```

**Two gate-script defects fixed here, both pre-existing.** The `total tests` row matched a
bare `N passed` and so summed the `Test Files N passed` line into the test count — 114
against an `EXPECTED_TOTAL_TESTS` of 108, meaning **that row could never have gone green**.
Consistent with the script having been untracked until this block. Both counters now strip
ANSI and anchor on `Tests`. Separately the G5 row's label contained a literal `||`, which
broke the output table's own field splitting.

**The three residual FAILs are not this block's, and are not defects in the code:**

- `builds` — `artifacts/mockup-sandbox` cannot load `lightningcss.win32-x64-msvc.node`, a
  missing native binary on this machine. Both **shipped** packages build clean, verified
  individually. Not a repository defect; an install one.
- `G5` — 13 hits: `.migration-backup` (7, not shipped), `progress.tsx` UI components (3),
  `optimize-payload.ts:46-47` (known, C7 / task 4.7), `routes.ts:231` (pre-existing). None
  introduced here.
- `old figures` — one hit, `calculate.test.ts:18`, the docstring describing the defect that
  produced those figures. In shipped source rather than `docs/`, so the location exclusion
  added in `3ed4bad` does not reach it. **Left failing deliberately**: suppressing it needs
  a comment-line filter, which changes what the check matches rather than where it looks,
  and that is an operator decision. G5 sets the precedent if it is wanted.

## LIVE EVIDENCE

None at the time of writing. The merge is operator-directed and the live probe follows it;
results are appended to this ruling once Render has deployed.

## ROLLBACK

```
git revert -m 1 <merge-sha>
```

**Not executed. This is an open G8 obligation, and it is deliberately open.** G8 requires
the rollback to be *executed* for any block that reaches `main`. A13 then established that a
revert on an auto-deploying branch **is a production deploy** and must be declared as such
with the window stated. The operator authorised a merge, a push, and read-only GET probes.
Two further production deploys were not authorised, and executing them on my own reading of
G8 is the exact failure A13 corrected. **Flagged for an operator ruling, not silently
skipped and not silently performed.**

## RESIDUE

- G8 drill outstanding, above.
- `old figures` row left failing, above.
- `mockup-sandbox` build broken by a missing native binary — environment, not repository.
- H0's production residue is unchanged and now has a second reading: `h0-gate-h0.md`
  publishes two working session ids, and F2's fix does **not** retroactively protect the
  Madrid and Lisbon calculation rows it created, which remain readable by replaying those
  headers. F1 governs; C8 gates it.
- `voltura-api` still exposes no version or build-sha endpoint (A12), so this merge cannot
  be proven to have reached the API container. `/api/version` is scheduled into H1.

## RULING

**CLOSED (self-ruled)** under §14.2 for the mechanical criteria, **merge operator-directed**.

Both criteria met. The PDF route is scoped and the property is locked by a mutation-tested
suite; the dead subpackages are gone and the shipped provider is unmoved.

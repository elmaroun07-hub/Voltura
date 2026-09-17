# Block H-SRC-ES — the sources registry, and Spain's carbon factor done properly

**Ruled order (15 Sept 2026):** fix the machine → document Spain completely → survive one Andalusian buyer → second country.
This block is **step 2**. `gate-check.sh` is still unfixed (block H-GATE). This block is deliberately shaped so the machine's future **S row** has a file to read: build the registry now, wire the checker later.

**Branch:** `heatshield/h-src-es` off `main` at the tip when the block opens. Never a sha written in advance.
**Merge:** `--no-ff`, once, at the end. Never commit to `main`. Doc-only pushes to `main` trigger production deploys — three were wasted after H-OPT. Do not repeat that.

---

## The thing this block exists to prevent

`contracts/blocks/h1b.md:11` records **0.283, activity year 2024**. That figure is one edition out of date. It went stale silently, because it is a bare number with no authority, no edition and no expiry.

**Swapping `0.283` for `0.258` is the wrong fix.** It reproduces the identical defect eight months from now. The defect is not the value. The defect is that a number can live in this codebase without a source.

---

## Scope fence — IN

1. `data/sources/es.yaml` — a machine-readable registry, one entry per user-facing numeric constant.
2. Replace Spain's single CO₂ constant with a resolver returning a **typed, sourced object**, not a float.
3. Kill the unknown-country `0.4` silent default (D15).
4. Extend the response provenance block with the carbon source, and update the H-OPT validator's allowed-numeral input set to match.
5. Update the tests that the change breaks — deliberately, one at a time, with reasons.

## Scope fence — OUT

- **NASA.** Not one line. The diff against the NASA path must be empty.
- **GreenCalc.** Deletion is **ruled** as of 15 Sept 2026 — H2 is no longer open. It still does not belong here: nothing under `artifacts/greencalc/` may appear in this block's diff. Deleting it inside a sources block is the scope creep this contract names as a failure mode. It also carries a live consequence — **D18**: the deployed product has no EU AI Act Article 50 surface at all, and the only one that exists is inside GreenCalc. Sequence the Article 50 surface onto the deployed side before or alongside H2, not after it.
- **UI language.** Ruled 15 Sept 2026: the interface is not changing. No locale files, no translator, no Spanish strings. It is the *data* that gets documented, not the interface.
- **`gate-check.sh`.** Untouched here. That is H-GATE.
- **A second country.** France, Portugal, Morocco — none. The registry's *shape* must make them cheap; this block adds no rows for them.
- **Any per-retailer UI feature.** The retailer table, if encoded at all, is data sitting behind the default. No new user-facing selector.

---

## Hard constraints

- **No number reaches a user without a registry entry.** If a constant has no entry, the code must not be able to emit it.
- **`basis` is not optional and not a string.** Generation intensity and supply/residual factor are different quantities and must be different types. Passing one where the other is required must fail — at compile time if the type system allows it, at runtime with a typed error if not.
- **No silent defaults.** Unknown or missing country returns an explicit typed error and the API returns 400. It never returns a substituted number. This is the same rule that killed `|| 4.0` and `|| 15.0`.
- **Tests read the registry.** No test may hardcode a carbon value. A test with `258` typed into it is the defect this block removes, relocated.
- Every row carries an expiry. Spanish factors for year N publish in ~May of N+1, because the CNMC must publish retailer mixes first. The registry states when the next edition is due.

---

## The data — verified against primary documents, 15 Sept 2026

Source document: **CNMC, Acuerdo GDO/DE/001/26**, Sala de Supervisión Regulatoria, Madrid, **28 April 2026**, *Etiquetado de la electricidad relativo a la energía producida en el año 2025*. Corroborated independently by MITECO's *Guía para el cálculo de la huella de carbono*, May 2026 edition.

| Quantity | Value | basis | Use |
|---|---|---|---|
| Generic retailer without Guarantees of Origin — *Mix Residual Final* | **258 g CO₂ eq/kWh** | `supply_residual` | **The default.** A consumer whose retailer is unknown |
| National generation mix average | **107 g CO₂ eq/kWh** | `generation` | **Never for a consumer.** Comparison and context only |
| Renewable GdO redeemed | **0 g/kWh** | `supply_attributed` | Consumer on a certified renewable tariff |
| High-efficiency cogeneration GdO | **302 g/kWh** (MITECO guide) | `supply_attributed` | Cogeneration GdO — *not* zero |
| Radioactive waste, generic / national | 951 / 464 µg/kWh | matching basis | The other half of the CNMC label |
| **Superseded:** previous no-GdO mix | 0.283, activity year 2024 | `supply_residual` | Recorded as `superseded`, not deleted |

**258 against 107 is a 2.4× spread on the same country, same year, both official.** A single constant is wrong against one of them no matter which is chosen. That is what `basis` exists to prevent.

The full per-retailer range in Anexo I runs **0 to 259 g/kWh**. Same country, same grid, same year.

---

## Verification fixtures — hand-checked against the PDFs

If the per-retailer table is encoded at all, these seven must resolve exactly before any of it is trusted. If any one fails, the extraction is wrong and the table does not ship.

| Ref | Entity | Expected | Why this row |
|---|---|---|---|
| — | COMERCIALIZADORA SIN GDO's | 258 g/kWh, rating G | The default itself |
| R2-911 | NATURGY CLIENTES, S.A.U. | 0 g/kWh, A | Floor of the range |
| R2-142 | NATURGY IBERIA, S.A. | 235 g/kWh, G | Same group as the row above — proves the factor is per legal entity, not per brand |
| R2-142 (Anexo II) | NATURGY IBERIA, remaining mix | 252 g/kWh | **Worse** than its supplier mix. Two published figures, one entity |
| R2-239 (Anexo II) | MOEVE GAS AND POWER | 267 g/kWh, 100% cogeneration | **The trap.** Has a GdO, and is dirtier than the generic. "GdO → 0" is wrong here |
| R2-515 | IBERDROLA CLIENTES, S.A.U. | 132 g/kWh, E | Mid-range |
| R2-001 | ENDESA ENERGÍA, S.A.U. | 154 g/kWh, F | Mid-range |

Do not OCR 23 pages of tables and trust the result. Extract, then fail closed on these seven.

---

## Registry shape

Each entry carries, at minimum:

```
id, value, unit, basis, authority, document_id, edition_date,
activity_year, next_edition_expected, path (file:line where it is used),
status (current | superseded | pending), supersedes, verified_on
```

Two entries must exist from the start even though their data is not in hand:

- **Spanish municipality coordinates** — `status: pending`. Authority: Instituto Geográfico Nacional, *Nomenclátor Geográfico de Municipios y Entidades de Población* (NGMEP), memoria dated 31 March 2026, licence equivalent to CC BY 4.0 permitting commercial use with attribution to IGN. The dataset carries its own per-row `ORIGENCOOR` quality flag, including `En estudio` = approximate, correctness not guaranteed. **The CSVs have not been downloaded.** Record the source, leave the rows empty, and let the S row report it as pending rather than missing.
- **Every unsourced constant already on the defect register** — `SYSTEM_EFFICIENCY = 0.78`, the orientation factors, the tilt penalty, the consumption coefficients, `INFLATION`, trees ÷ 20, the 10% export factor, the ×1.5 upsizing rule, the back-computed tariff. `status: pending`, no value claimed, so the machine can count them.

**Axis-order warning for the coordinates row when it lands:** the NGMEP memoria describes `ORIGENCOOR` as `[longitud, latitud]` under MUNICIPIOS and as `[latitud, longitud]` under ENTIDADES and EATIMS. Same field, opposite order, in the same document. Assume nothing; verify against a known town on first load.

---

## Acceptance criteria

1. No Spanish carbon figure can be emitted without a registry entry. Prove it: delete an entry, the build or the request fails — it does not fall back.
2. The `0.4` unknown-country default is gone. Unknown country → typed error → HTTP 400. Prove it with a request.
3. Every response carrying a carbon figure names **authority, document, edition date and activity year**. A response without them fails a test.
4. `generation` cannot be used where `supply_residual` is required. Prove it with a failing compile or a rejected call.
5. All seven fixtures resolve exactly, or the retailer table is not in the diff at all.
6. NASA path diff is empty; the NASA suite passes unchanged.
7. Every test that changed, changed for a stated reason recorded in the ruling. No mechanical mass-update.
8. Tier B: `git revert -m 1 <merge>` applies and leaves the tree byte-identical to `main`.
9. Ruling written to `contracts/rulings/h-src-es.md` **on the branch**, not pushed separately.

---

## Named failure modes — each of these has happened before in this repo

- **The one-line fix.** Changing 283 to 258 and closing the block. Rejected: it rebuilds the defect.
- **Using 107 because it reads as "the Spanish average."** Understates a real consumer by 2.4×.
- **Treating any Guarantee of Origin as zero carbon.** MOEVE's remaining mix is 267.
- **Scraping the tables and shipping them unverified.** Fixtures first, always.
- **Scope creep into the second country** because the registry makes it look cheap. It is cheap. It is still out of scope.
- **Touching NASA or GreenCalc** because they are nearby.
- **Mass-updating the test suite** to make it green. A test that changed without a reason is a test that no longer protects anything.

## Rollback

Branch, `--no-ff`, so the merge has a mainline. Tier B at minimum.

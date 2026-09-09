# Locale strings — salvaged at H1.x

`en.json`, `es.json`, `ar.json`, copied verbatim from
`artifacts/greencalc/static/lang/` before H2 archives that directory (C2).

**Why they are here and not somewhere tidier.** C2's failure mode is named in the
block file: *"Salvaging `es.json` into a location nothing will find at H2b."*
H2b is the Spanish block and its consumer is this React app, so the strings sit
inside the app's own `src/`, next to the code that will import them — not in a
`lib/*` package, not in a top-level `i18n/`, not in the repo root.

**They are not wired up, and that is deliberate.** H1.x is salvage, not
internationalisation. Wiring them means choosing a runtime (react-i18next or
otherwise), a language switcher, and a fallback policy, and that is H2b's work.
Importing them now would create a second half-built integration in a repository
whose §G11 exists because it already holds four.

**What a future reader must know before using them.**

- The keys were written for the **Flask GreenCalc app**, not for this one. They
  name that app's pages: `nav_home`, `nav_calculator`, `nav_dashboard`,
  `nav_predict`, `nav_compliance`. The React app has Home, Calculator and
  History. **The key sets do not correspond**, and mapping them is a translation
  decision, not a rename.
- 28 top-level keys in each file. They are flat, not nested.
- `ar.json` is right-to-left. Nothing in this app currently sets `dir`.
- No translator is credited and no review is recorded, so the Spanish is
  unverified. H2b should treat it as a draft, not as approved copy — a
  mistranslated compliance claim is a P7 problem, not a typo.

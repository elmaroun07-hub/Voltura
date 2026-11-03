<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/voltura-wordmark-dark.png">
    <img src="docs/brand/voltura-wordmark-light.png" alt="Voltura" width="332">
  </picture>
</h1>

**Summer energy-poverty screening for Spain's oldest housing, built so it never invents a number.**

Live: https://voltura-web.onrender.com · Córdoba screening: https://voltura-web.onrender.com/cribado

Built and run alone by [Houssain El Marouni](https://www.linkedin.com/in/houssain-elmarouni), from Tétouan, Morocco, since November 2025.

---

## What it does

- **Córdoba screening (HeatShield).** 32,431 residential buildings ranked by summer heat risk, using only public registers: Catastro, the Junta de Andalucía's register of 81,972 energy certificates, INE Census 2021 (253 sections) and IGN MDT25. Every score comes with an uncertainty band and is traced to its sources. A Spanish methodology document explains the index.
- **Energy calculator.** Solar, battery and savings estimates where every carbon and tariff figure has a named official source (REE, Eurostat, DESNZ). If a country has no official figure, the money line shows "pending" instead of a guess.
- **Optimizer.** The code computes every number. The model only writes the prose around them, and a validator rejects any number that wasn't in its input.
- **Assistant.** It answers from a fact list built from the code, and has been tested live in Spanish and English.

## The bug that shaped it

Early on, NASA POWER irradiance lookups used keys like `2022JAN` while the data uses `202201`. Every lookup missed, and a silent `|| 4.0` fallback filled in the same irradiance for every place on Earth, while the app still said the source was NASA. Fuengirola and Tétouan both came out at 4,203 kWh a year. After the fix they're 3,702 and 3,786 kWh, so the old figure was 13.5% too high.

Since then, the rule in this repo is: **a missing input is reported as missing, never replaced by a plausible number.**

## How it's built

- TypeScript monorepo: React + Vite web app, Express API, Postgres/PostGIS
- Deployed on Render (Frankfurt)
- Work runs in gated blocks: a written contract, then tests, mutation checks and a revert proof before each merge. The contracts, rulings and evidence are in [`contracts/`](contracts/).

## Run the tests

These are the commands CI's `test` job runs:

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm -r test
```

CI also runs one guard, G10 (a test file that names a live host must stub `fetch`, so no test reaches the network):

```bash
status=0
for f in $(grep -rlE 'power\.larc\.nasa\.gov|nominatim\.openstreetmap\.org' \
             --include='*.test.ts' artifacts lib 2>/dev/null || true); do
  if ! grep -qE 'stubGlobal\(\s*["'"'"']fetch|vi\.mock' "$f"; then
    echo "FAIL $f names a live host and does not stub fetch."
    status=1
  else
    echo "ok   $f (host named, fetch stubbed)"
  fi
done
exit $status
```

A smaller, self-contained copy of the core code, which runs with no database, network or keys, is at [voltura-proof](https://github.com/elmaroun07-hub/voltura-proof).

## Status

Live demo. No agency uses it yet. I'm looking for a first partner in Andalusia: housing agencies, municipalities and energy-poverty researchers. Contact: elmaroun07@gmail.com

The screening says where a technical visit should look first. It is not a grade, a pass-or-fail verdict or a decision about any household. The calculator's figures are estimates, not energy, financial or legal advice.

Single-family houses are scored but not published one by one: the public list, building pages and CSV export show buildings with two or more dwellings. An agency working with Voltura gets an access key that shows every scored building; each use of a key is logged. Privacy notice: https://voltura-web.onrender.com/privacy.html

## Data sources and licences

| Source | Used for | Terms |
| --- | --- | --- |
| Dirección General del Catastro, INSPIRE Buildings | Building footprints, dwellings, year, floors | "No conditions apply". Attribution: Dirección General del Catastro |
| Junta de Andalucía, register of energy certificates | Cooling demand | CC BY 4.0. Attribution: Junta de Andalucía |
| Instituto Geográfico Nacional, MDT25 | Ground altitude | CC BY 4.0. Attribution: Instituto Geográfico Nacional |
| Instituto Nacional de Estadística, Censo 2021 indicators and section maps | Share aged over 64, one-person households, unemployment | Reuse with attribution: Instituto Nacional de Estadística |
| NASA POWER | Monthly irradiance and temperature in the calculator | No restrictions on use. "These data were obtained from the NASA Langley Research Center POWER Project funded through the NASA Earth Science Directorate Applied Science Program." |
| OpenStreetMap, through Nominatim | Turning a place name into coordinates | © OpenStreetMap contributors, Open Database License |
| REE, Eurostat, DESNZ | Grid carbon and tariff figures | Each figure names its source in `data/sources/` |

Voltura changes these data: it combines, caps, ranks and summarises them, as the methodology describes. The exact file, retrieval date and checksum of each Córdoba source are stored with every run.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Security problems: [SECURITY.md](SECURITY.md).

## License

The code is MIT, see [LICENSE](LICENSE). The data above stays under each publisher's terms.

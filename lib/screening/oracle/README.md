# Façade oracle (H3.2)

`facades_oracle.py` recomputes each building's exposed façade per CTE
orientation straight from the Catastro GML with shapely — no TypeScript
parser, no SQL. Its output for the test block is committed as
`src/catastro/__fixtures__/cordoba-26421.facades-oracle-0.2.json`, and the
PostGIS integration test must agree with it to the centimetre.

It shares GEOS with PostGIS, so it checks the assembly (ring order, normal
direction, CTE sectors, party-wall subtraction), not GEOS itself.

Regenerate:

    python3 -m venv .venv && .venv/bin/pip install shapely==2.2.0
    .venv/bin/python oracle/facades_oracle.py \
      src/catastro/__fixtures__/cordoba-26421.building.gml 0.2 \
      > src/catastro/__fixtures__/cordoba-26421.facades-oracle-0.2.json

Produced 14 Oct 2026 with shapely 2.2.0 / GEOS 3.14.1.

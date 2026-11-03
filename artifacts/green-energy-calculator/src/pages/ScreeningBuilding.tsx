import { Link, useParams } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotLoaded, useBuildingTrace } from "@/hooks/use-screening";
import { useI18n } from "@/i18n";
import { bandText } from "@/pages/Screening";

type Band = { low: number; mid: number; high: number };
type Row = Record<string, unknown>;

const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/**
 * H3.9 — one building, every input behind its score, and the files they were
 * read from. Gate H3: "every score traces to its inputs and its uncertainty".
 */
export default function ScreeningBuilding() {
  const { ine = "", ref = "" } = useParams<{ ine: string; ref: string }>();
  const i18n = useI18n();
  const { t, num, date } = i18n;
  const trace = useBuildingTrace(ine, ref);
  const two = (v: number) => num(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const one = (v: number) => num(v, { maximumFractionDigits: 1 });
  const pct = (v: number) => num(Math.round(v * 1000) / 10, { maximumFractionDigits: 1 });

  if (trace.isLoading) {
    return <Shell><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Shell>;
  }
  if (trace.error || !trace.data) {
    return (
      <Shell>
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {trace.error instanceof NotLoaded
            ? trace.error.message === "building_not_published"
              ? t("building.notPublished")
              : t("building.notFound")
            : t("screening.loadError")}
        </CardContent></Card>
      </Shell>
    );
  }

  const row = trace.data.row as Row;
  const factors = row.factors as { hazard: Band; exposure: Band; sensitivity: Band; people: Band };
  const weights = (row.method as { weights: Record<"hazard" | "exposure" | "sensitivity" | "people", number> }).weights;
  const exposed = row.exposed_m as { street: Record<string, number> };
  const streetM = Object.values(exposed.street).reduce((s, v) => s + v, 0);
  const ind = (row.indicators ?? null) as Record<string, number | null> | null;
  const index: Band = { low: Number(row.index_low), mid: Number(row.index_mid), high: Number(row.index_high) };
  const fraction = (w: number) => (Math.abs(w - 1 / 6) < 1e-9 ? "1/6" : Math.abs(w - 1 / 3) < 1e-9 ? "1/3" : two(w));
  const none = t("building.in.none");

  const factorRows: { key: "hazard" | "exposure" | "sensitivity" | "people"; label: string }[] = [
    { key: "hazard", label: t("building.factor.hazard", { zone: String(row.zone) }) },
    { key: "exposure", label: t("building.factor.exposure") },
    { key: "sensitivity", label: t("building.factor.sensitivity") },
    { key: "people", label: t("building.factor.people") },
  ];

  const inputs: [string, string][] = [
    [t("building.in.year"), row.year_end === null ? none : String(row.year_end)],
    [t("building.in.dwellings"), num(Number(row.dwellings))],
    [t("building.in.floors"), row.floors_above_max === null ? none : num(Number(row.floors_above_max))],
    [t("building.in.footprint"), t("unit.squareMetres", { n: one(Number(row.footprint_m2)) })],
    [t("building.in.altitude"), t("unit.metres", { n: one(Number(row.altitude_m)) })],
    [t("building.in.zone"), String(row.zone)],
    [t("building.in.facade"), t("unit.metres", { n: one(streetM) })],
    [t("building.in.party"), t("unit.metres", { n: one(Number(row.party_wall_m)) })],
    [t("building.in.julyRoof"), t("unit.kwhPerSquareMetre", { n: two(Number(row.july_roof_kwh_m2)) })],
    [
      t("building.in.certificates"),
      row.certificates === null
        ? none
        : t("building.in.certificatesValue", {
            n: num(Number(row.certificates)),
            units: num(Number(row.units_certified)),
            median: two(n(row.cooling_demand_median) ?? 0),
            min: two(n(row.cooling_demand_min) ?? 0),
            max: two(n(row.cooling_demand_max) ?? 0),
          }),
    ],
    [
      t("building.in.census", { cusec: row.cusec === null ? none : String(row.cusec) }),
      ind && ind.t4_3 != null && ind.t22_1 != null && ind.t21_1 != null && ind.t10_1 != null && ind.t21_1 > 0
        ? t("building.in.censusValue", {
            over64: pct(ind.t4_3),
            single: pct(ind.t22_1 / ind.t21_1),
            unemployment: pct(ind.t10_1),
          })
        : none,
    ],
  ];

  return (
    <Shell>
      <div className="space-y-6">
        <Link href="/cribado" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> {t("building.back")}
        </Link>
        <div>
          <h1 className="text-3xl font-display font-bold font-mono" data-testid="building-title">{t("building.title", { ref })}</h1>
          <p className="text-muted-foreground">
            {t("building.rank", { rank: num(Number(row.rank_high)), total: num(Number(row.scored)) })}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardDescription>{t("building.indexTitle")}</CardDescription>
            <CardTitle className="text-3xl font-mono" data-testid="building-index">{bandText(i18n, index)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("building.factorsTitle")}</CardTitle>
            <CardDescription>{t("building.factorNote")}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              {factorRows.map((f) => (
                <div key={f.key} className="flex flex-wrap justify-between gap-2 py-2">
                  <dt>
                    {f.label} <span className="text-xs text-muted-foreground">({t("building.weight", { w: fraction(weights[f.key]) })})</span>
                  </dt>
                  <dd className="font-mono">{bandText(i18n, factors[f.key])}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">{t("building.inputsTitle")}</CardTitle></CardHeader>
          <CardContent>
            <dl className="divide-y">
              {inputs.map(([label, value]) => (
                <div key={label} className="flex flex-wrap justify-between gap-2 py-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">{t("building.sourcesTitle")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {trace.data.sources.map((s) => (
                <li key={s.id}>
                  <a href={s.url} className="text-primary hover:underline break-all" target="_blank" rel="noreferrer">
                    {s.publisher} · {s.dataset}
                  </a>
                  <div className="text-xs text-muted-foreground">
                    {t("building.sourceRetrieved", { date: date(new Date(s.retrieved_at), { day: "numeric", month: "long", year: "numeric" }) })}
                    {" · "}
                    <span className="font-mono">{s.id}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

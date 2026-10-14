import { useState } from "react";
import { Link } from "wouter";
import { Loader2, Download, Thermometer } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  NotLoaded,
  PAGE_SIZE,
  downloadScreeningCsv,
  useMunicipalities,
  useScreeningList,
  useScreeningSummary,
  type Filters,
  type PortfolioRow,
} from "@/hooks/use-screening";
import { useI18n, userFacing, type I18n } from "@/i18n";

const ALL = "all";
const AGES = ["pre-1980", "1980-2006", "2007-on", "unknown"] as const;
const AGE_LABEL = {
  "pre-1980": "screening.age.pre-1980",
  "1980-2006": "screening.age.1980-2006",
  "2007-on": "screening.age.2007-on",
  unknown: "screening.age.unknown",
} as const;

export function bandText(i18n: I18n, b: { low: number; mid: number; high: number }): string {
  const f = (v: number) => i18n.num(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return i18n.t("screening.band", { mid: f(b.mid), low: f(b.low), high: f(b.high) });
}

/** The band as a bar: the track spans 0–2 (1 = typical), the shaded part is low–high, the tick is mid. */
function BandBar({ b }: { b: { low: number; mid: number; high: number } }) {
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v / 2) * 100))}%`;
  return (
    <div className="relative h-2 w-28 rounded-full bg-muted" aria-hidden="true">
      <div className="absolute inset-y-0 w-px bg-border" style={{ left: "50%" }} />
      <div
        className="absolute inset-y-0 rounded-full bg-orange-400/60"
        style={{ left: pos(b.low), width: `calc(${pos(b.high)} - ${pos(b.low)})`, minWidth: "2px" }}
      />
      <div className="absolute -inset-y-0.5 w-0.5 bg-orange-700" style={{ left: pos(b.mid) }} />
    </div>
  );
}

function certificateText(i18n: I18n, r: PortfolioRow): string {
  if (r.certificateCoverage === 0) return i18n.t("screening.coverageNone");
  const pct = i18n.t("screening.coverage", { pct: i18n.num(Math.round(r.certificateCoverage * 100)) });
  return r.certificateCapped ? `${pct} · ${i18n.t("screening.capped")}` : pct;
}

export default function Screening() {
  const i18n = useI18n();
  const { t, num } = i18n;
  const { toast } = useToast();
  const municipalities = useMunicipalities();
  const [chosen, setChosen] = useState<string | undefined>();
  const ine = chosen ?? municipalities.data?.municipalities[0]?.ine;
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(0);
  const summary = useScreeningSummary(ine);
  const list = useScreeningList(ine, filters, page);

  const setFilter = <K extends keyof Filters>(key: K, value: string) => {
    setFilters((f) => ({ ...f, [key]: value === ALL ? undefined : value }));
    setPage(0);
  };

  const notLoaded =
    (municipalities.data && municipalities.data.municipalities.length === 0) ||
    summary.error instanceof NotLoaded ||
    list.error instanceof NotLoaded;

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2 flex items-center gap-2">
            <Thermometer className="w-7 h-7 text-orange-600" /> {t("screening.title")}
          </h1>
          <p className="text-muted-foreground max-w-3xl">{t("screening.subtitle")}</p>
        </div>

        {municipalities.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : notLoaded ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground" data-testid="screening-not-loaded">
              {t("screening.notLoaded")}
            </CardContent>
          </Card>
        ) : municipalities.error || summary.error || list.error ? (
          <Card>
            <CardContent className="py-12 text-center text-destructive">{t("screening.loadError")}</CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">{t("screening.municipality")}</div>
                <Select value={ine} onValueChange={(v) => { setChosen(v); setPage(0); setFilters({}); }}>
                  <SelectTrigger className="w-56" data-testid="select-municipality"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {municipalities.data?.municipalities.map((m) => (
                      <SelectItem key={m.ine} value={m.ine}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {summary.data && (
                <div className="text-xs text-muted-foreground pb-2">{t("screening.run", { run: summary.data.runId })}</div>
              )}
            </div>

            {summary.data && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card><CardHeader className="pb-2"><CardDescription>{t("screening.card.scored")}</CardDescription>
                  <CardTitle className="text-2xl" data-testid="summary-scored">{num(summary.data.scored)}</CardTitle></CardHeader></Card>
                <Card><CardHeader className="pb-2"><CardDescription>{t("screening.card.dwellings")}</CardDescription>
                  <CardTitle className="text-2xl">{num(summary.data.dwellings)}</CardTitle></CardHeader></Card>
                <Card><CardHeader className="pb-2"><CardDescription>{t("screening.card.firstDecile")}</CardDescription>
                  <CardTitle className="text-2xl">{num(summary.data.deciles[0]?.dwellings ?? 0)}</CardTitle>
                  <p className="text-xs text-muted-foreground">{t("screening.card.firstDecileBody", { buildings: num(summary.data.deciles[0]?.buildings ?? 0) })}</p></CardHeader></Card>
                <Card className="border-orange-300"><CardHeader className="pb-2"><CardDescription>{t("screening.card.gap")}</CardDescription>
                  <CardTitle className="text-2xl" data-testid="summary-gap">{num(summary.data.gap.dwellings)}</CardTitle>
                  <p className="text-xs text-muted-foreground">{t("screening.card.gapBody", { buildings: num(summary.data.gap.buildings), dwellings: num(summary.data.gap.dwellings) })}</p></CardHeader></Card>
              </div>
            )}

            <Card className="border-none shadow-lg overflow-hidden">
              <CardHeader className="bg-muted/30 space-y-4">
                <CardDescription>{t("screening.rankNote")}</CardDescription>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">{t("screening.filter.age")}</div>
                    <Select value={filters.age ?? ALL} onValueChange={(v) => setFilter("age", v)}>
                      <SelectTrigger className="w-64" data-testid="select-age"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>{t("screening.filter.all")}</SelectItem>
                        {AGES.map((a) => <SelectItem key={a} value={a}>{t(AGE_LABEL[a])}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">{t("screening.filter.certificate")}</div>
                    <Select value={filters.certificate ?? ALL} onValueChange={(v) => setFilter("certificate", v)}>
                      <SelectTrigger className="w-48" data-testid="select-certificate"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>{t("screening.filter.all")}</SelectItem>
                        <SelectItem value="with">{t("screening.certificate.with")}</SelectItem>
                        <SelectItem value="without">{t("screening.certificate.without")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">{t("screening.filter.district")}</div>
                    <Select value={filters.district ?? ALL} onValueChange={(v) => setFilter("district", v)}>
                      <SelectTrigger className="w-32" data-testid="select-district"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>{t("screening.filter.all")}</SelectItem>
                        {summary.data?.districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    className="ml-auto"
                    data-testid="button-export"
                    disabled={!ine}
                    onClick={() =>
                      ine &&
                      downloadScreeningCsv(ine).catch((e) =>
                        toast({ title: t("toast.errorTitle"), description: userFacing(e, t("screening.exportError")), variant: "destructive" }),
                      )
                    }
                  >
                    <Download className="w-4 h-4 mr-2" /> {t("screening.export")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {list.isLoading || !list.data ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : list.data.rows.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">{t("screening.empty")}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="text-right">{t("screening.col.rank")}</TableHead>
                          <TableHead>{t("screening.col.ref")}</TableHead>
                          <TableHead className="text-right">{t("screening.col.dwellings")}</TableHead>
                          <TableHead className="text-right">{t("screening.col.year")}</TableHead>
                          <TableHead>{t("screening.col.zone")}</TableHead>
                          <TableHead>{t("screening.col.index")}</TableHead>
                          <TableHead>{t("screening.col.certificate")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.data.rows.map((r) => (
                          <TableRow key={r.ref} data-testid={`row-screening-${r.ref}`} className="hover:bg-muted/30">
                            <TableCell className="text-right font-mono">{num(r.rank)}</TableCell>
                            <TableCell className="font-mono">
                              <Link href={`/cribado/${ine}/${r.ref}`} className="text-primary hover:underline">{r.ref}</Link>
                            </TableCell>
                            <TableCell className="text-right">{num(r.dwellings)}</TableCell>
                            <TableCell className="text-right">{r.year === null ? t("screening.unknown") : String(r.year)}</TableCell>
                            <TableCell>{r.zone}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <BandBar b={r.index} />
                                <span className="font-mono text-sm whitespace-nowrap">{bandText(i18n, r.index)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {certificateText(i18n, r)}
                              {!r.censusSection && <span className="block">{t("screening.noCensus")}</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {list.data && list.data.total > 0 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t text-sm">
                    <span className="text-muted-foreground">
                      {t("screening.pageOf", {
                        from: num(page * PAGE_SIZE + 1),
                        to: num(Math.min((page + 1) * PAGE_SIZE, list.data.total)),
                        total: num(list.data.total),
                      })}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                        {t("screening.prev")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(page + 1) * PAGE_SIZE >= list.data.total}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        {t("screening.next")}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}

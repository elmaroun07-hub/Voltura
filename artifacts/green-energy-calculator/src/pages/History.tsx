import { Shell } from "@/components/layout/Shell";
import { useHistory } from "@/hooks/use-calculations";
import { downloadCalculationPdf } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Leaf, Download, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney, type Currency } from "@/lib/money";
import { useI18n, type I18n } from "@/i18n";

// A history row carries no currency column (no DDL); the currency the money was
// computed in rides in renewableMix.currency. A row without it predates that, or
// was for a country with no sourced tariff - and says so rather than guessing one.
function historyMoney(i18n: I18n, item: any, n: number | null | undefined, digits = 0): string {
  if (n == null) return i18n.t("money.pending");
  const currency = item.renewableMix?.currency as Currency | undefined;
  return currency
    ? formatMoney(i18n.locale, n, currency, digits)
    : i18n.t("history.currencyNotRecorded", { n: i18n.num(n, { minimumFractionDigits: digits, maximumFractionDigits: digits }) });
}

// A pending calculation stores tariff 0; the saving being null is what marks it.
function historyTariff(i18n: I18n, item: any): string {
  return item.annualSavingsEur == null ? i18n.t("money.pending") : historyMoney(i18n, item, item.electricityTariff, 3);
}

export default function History() {
  const { data: history, isLoading } = useHistory();
  const i18n = useI18n();
  const { t, num, date } = i18n;

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">{t("history.title")}</h1>
          <p className="text-muted-foreground">{t("history.subtitle")}</p>
        </div>

        <Card className="border-none shadow-lg overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> {t("history.cardTitle")}
            </CardTitle>
            <CardDescription>{t("history.sorted")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !history || history.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Leaf className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>{t("history.empty")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead>{t("history.col.date")}</TableHead>
                      <TableHead>{t("common.location")}</TableHead>
                      <TableHead>{t("history.col.pvBattery")}</TableHead>
                      <TableHead>{t("history.col.tariff")}</TableHead>
                      <TableHead>{t("history.col.efficiency")}</TableHead>
                      <TableHead className="text-right">{t("history.col.savingsKwh")}</TableHead>
                      <TableHead className="text-right">{t("history.col.savings")}</TableHead>
                      <TableHead className="text-right">{t("history.col.co2")}</TableHead>
                      <TableHead className="text-right">{t("history.col.pdf")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow data-testid={`row-history-${item.id}`} key={item.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {item.createdAt && date(new Date(item.createdAt), { day: "2-digit", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell className="font-medium max-w-[140px] truncate" title={item.location}>
                          {item.location}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="font-mono">{t("unit.wCompact", { n: num(item.pvWattage) })}</span>
                          <span className="text-muted-foreground mx-1">/</span>
                          <span className="font-mono">{t("unit.kwhCompact", { n: num(item.batteryCapacity) })}</span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {historyTariff(i18n, item)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {t("unit.percentValue", { n: num(Math.round((item.batteryEfficiency ?? 0.9) * 100)) })}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {t("unit.kwhValue", { n: num(item.savingsKwh) })}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {historyMoney(i18n, item, item.annualSavingsEur)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {t("unit.kgValue", { n: num(item.co2Reduction) })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            data-testid={`button-pdf-${item.id}`}
                            aria-label={t("history.downloadPdf", { id: item.id })}
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary"
                            onClick={() => void downloadCalculationPdf(item.id)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

import { Shell } from "@/components/layout/Shell";
import { useHistory } from "@/hooks/use-calculations";
import { downloadCalculationPdf } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Loader2, Leaf, Download, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function History() {
  const { data: history, isLoading } = useHistory();

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Calculation History</h1>
          <p className="text-muted-foreground">Review your past energy estimates across different scenarios and download PDF reports.</p>
        </div>

        <Card className="border-none shadow-lg overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Past Estimates
            </CardTitle>
            <CardDescription>Sorted by most recent first</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !history || history.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Leaf className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No history yet. Run your first calculation!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead>Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>PV / Battery</TableHead>
                      <TableHead>Tariff</TableHead>
                      <TableHead>Efficiency</TableHead>
                      <TableHead className="text-right">Savings kWh</TableHead>
                      <TableHead className="text-right">€ Savings</TableHead>
                      <TableHead className="text-right">CO₂ Reduced</TableHead>
                      <TableHead className="text-right">PDF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow data-testid={`row-history-${item.id}`} key={item.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {item.createdAt && format(new Date(item.createdAt), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="font-medium max-w-[140px] truncate" title={item.location}>
                          {item.location}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="font-mono">{item.pvWattage.toLocaleString()}W</span>
                          <span className="text-muted-foreground mx-1">/</span>
                          <span className="font-mono">{item.batteryCapacity}kWh</span>
                        </TableCell>
                        <TableCell className="text-sm">
                          €{((item.electricityTariff ?? 0.25)).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {Math.round((item.batteryEfficiency ?? 0.9) * 100)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {item.savingsKwh.toLocaleString()} kWh
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {item.annualSavingsEur != null ? `€${item.annualSavingsEur.toFixed(0)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {item.co2Reduction.toLocaleString()} kg
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            data-testid={`button-pdf-${item.id}`}
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

import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, ReferenceLine, Area, AreaChart,
} from "recharts";
import { type CalculationResponse } from "@/lib/api";
import { irradianceLabel } from "@/lib/provenance";
import { formatMoney, formatMoneyCompact, formatMoneyRange, PENDING_LABEL, type Money } from "@/lib/money";
import { downloadCalculationPdf } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Leaf, TrendingUp, Sun, Download, Banknote, Satellite, AlertTriangle, CalendarCheck } from "lucide-react";

interface ResultsDisplayProps {
  results: CalculationResponse | null;
  calcId?: number | null;
}

const PIE_COLORS = ["#10b981", "#f59e0b", "#e2e8f0"];

/**
 * "Not paid back within the horizon" arrives as a null payback - a state, not a
 * number (D7) - so no comparison with 25 decides it, and the horizon named is
 * the last year of the curve the server computed rather than a literal.
 */
function paybackText(roi: Extract<Money["roi"], { status: "computed" }>): string {
  if (roi.paybackYears !== null) return `${roi.paybackYears}y`;
  const last = roi.curve.length > 0 ? roi.curve[roi.curve.length - 1] : undefined;
  return last ? `not within ${last.year} years` : "not reached";
}

export function ResultsDisplay({ results, calcId }: ResultsDisplayProps) {
  if (!results) {
    return (
      <Card className="h-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-muted/20 border-dashed min-h-[400px]">
        <Sun className="w-16 h-16 mb-4 text-muted-foreground/30" />
        <h3 className="text-xl font-medium mb-2">No Data Yet</h3>
        <p>Enter your system details and click <strong>Calculate Savings</strong> to see your annual solar model.</p>
      </Card>
    );
  }

  const pieData = [
    { name: "Direct Solar", value: results.breakdown.solar },
    { name: "From Battery", value: results.breakdown.battery },
    { name: "Grid Import", value: results.breakdown.grid },
  ];

  // "Surplus not used" is the PV the battery could not take (D52): it explains
  // the gap between Generation and what the house used. Nothing is exported or
  // valued - the engine sells nothing.
  const barData = results.monthlyData.map((m) => ({
    name: m.name,
    Generation: m.generationKwh,
    Savings: m.savingsKwh,
    "Grid Import": m.gridImportKwh,
    "Surplus not used": m.surplusKwh,
  }));

  const trees = Math.round(results.co2Reduction / 20);
  const { money } = results;
  // Every amount below is rendered in the currency the server computed it in.
  // A null currency means the country has no sourced tariff, so there is no amount.
  const fmt = (n: number, digits = 0) => formatMoney(n, money.currency as NonNullable<typeof money.currency>, digits);
  const savingsText = money.annualSavings !== null && money.currency ? fmt(money.annualSavings) : PENDING_LABEL;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-8 duration-700">

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 bg-gradient-to-br from-primary to-emerald-500 text-white border-none shadow-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white/75 text-xs font-medium mb-0.5">Annual Savings</p>
              <h2 data-testid="text-savings-kwh" className="text-3xl font-bold">{results.savingsKwh.toLocaleString()} kWh</h2>
            </div>
            <div className="bg-white/20 p-2.5 rounded-full"><TrendingUp className="w-5 h-5" /></div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span data-testid="text-savings-eur" className="text-2xl font-bold">{savingsText}</span>
            <span className="text-xs opacity-75">{money.annualSavings !== null ? "saved per year" : "money saving not priced"}</span>
          </div>
        </Card>

        <Card className="p-5 border-emerald-200 shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-muted-foreground text-xs font-medium mb-0.5">CO₂ Reduction</p>
              <h2 data-testid="text-co2-reduction" className="text-3xl font-bold text-foreground">{results.co2Reduction.toLocaleString()} kg</h2>
            </div>
            <div className="bg-green-100 p-2.5 rounded-full"><Leaf className="w-5 h-5 text-green-600" /></div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            ≈ <span className="font-bold text-green-600">{trees} trees</span> planted annually
            <span className="ml-2 text-[10px]">@ {(results.carbonIntensity * 1000).toFixed(0)} g/kWh</span>
          </p>
        </Card>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Satellite className="w-3.5 h-3.5" /> Irradiance Source
          </div>
          <p data-testid="text-irradiance-source" className="font-semibold text-sm leading-tight">{irradianceLabel(results.resolution)}</p>
          <p className="text-xs text-muted-foreground">{results.avgIrradiance} kWh/m²/day avg</p>
        </Card>
        <Card className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Banknote className="w-3.5 h-3.5" /> Tariff Used
          </div>
          <p data-testid="text-tariff-used" className="font-semibold text-sm">
            {money.tariff.status === "used" && money.currency ? `${fmt(money.tariff.value, 3)}/kWh` : PENDING_LABEL}
          </p>
          <p data-testid="text-tariff-source" className="text-xs text-muted-foreground">
            {money.tariff.status === "used" ? money.tariff.label : money.tariff.detail}
          </p>
        </Card>
      </div>

      {/* Monthly generation bar chart */}
      <Card className="p-5 shadow-md border-border/50">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-base font-semibold">Monthly Generation vs Consumption</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }}
                  formatter={(val: number) => `${val.toFixed(0)} kWh`}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Generation" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Savings" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Grid Import" fill="#e5e7eb" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Surplus not used" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Energy mix donut */}
      <Card className="p-5 shadow-md border-border/50">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-base font-semibold">Annual Energy Mix</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  formatter={(val: number) => `${val}%`}
                />
                <Legend verticalAlign="bottom" height={32} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ROI Curve */}
      {money.roi.status === "computed" && money.currency && (
        <Card className="p-5 shadow-md border-border/50">
          <CardHeader className="p-0 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">25-Year ROI Curve</CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
                  <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span data-testid="text-payback-years" className="text-xs font-bold text-blue-700">
                    Payback: {paybackText(money.roi)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
                  <Banknote className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">
                    Cost: {money.installCost.status === "used" && money.installCost.source !== "registry_range" ? fmt(money.installCost.amount) : PENDING_LABEL}
                    {money.installCost.status === "used" && money.installCost.source === "registry_band" ? ` (${money.installCost.label})` : ""}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Cumulative savings vs installation cost (+1.5%/yr inflation)</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={money.roi.curve} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="roiGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} label={{ value: "Year", position: "insideBottom", offset: -2, fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatMoneyCompact(v, money.currency!)} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }}
                    formatter={(val: number, name: string) => [fmt(val), name === "cumulativeSavings" ? "Cumulative Savings" : "Net Position"]}
                    labelFormatter={(l) => `Year ${l}`}
                  />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "Break-even", fill: "#ef4444", fontSize: 10, position: "insideTopLeft" }} />
                  <Area
                    type="monotone"
                    dataKey="netPosition"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#roiGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#10b981" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-emerald-500 rounded" /> Net position (savings − cost)</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-400 rounded" style={{ borderStyle: "dashed" }} /> Break-even</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payback and cost, when not computed: said plainly, never a substituted figure. */}
      {money.roi.status === "pending" && (
        <Card className="p-5 shadow-md border-border/50" data-testid="card-roi-pending">
          <CardTitle className="text-base font-semibold mb-2">25-Year ROI and payback</CardTitle>
          <p data-testid="text-payback-years" className="text-sm font-semibold">Payback: {PENDING_LABEL}</p>
          <p className="text-xs text-muted-foreground mt-1">{money.roi.detail}</p>
          {money.installCost.status === "used" && money.installCost.source === "registry_range" && money.currency && (
            <p data-testid="text-install-range" className="text-xs mt-2">
              Install cost ({money.installCost.label}): {formatMoneyRange(money.installCost.low, money.installCost.high, money.currency)}
            </p>
          )}
        </Card>
      )}

      {/* Recommendation + PDF button */}
      <Card className="p-5 bg-emerald-50 border-emerald-200">
        <div className="flex gap-3">
          <Sun className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="font-bold text-emerald-800 mb-1">Recommendation</h4>
            <p data-testid="text-recommendation" className="text-sm text-emerald-700 leading-relaxed">{results.recommendation}</p>
          </div>
        </div>
      </Card>

      {calcId && (
        <Button
          data-testid="button-download-pdf"
          variant="outline"
          className="w-full border-primary text-primary hover:bg-primary hover:text-white transition-colors"
          onClick={() => void downloadCalculationPdf(calcId)}
        >
          <Download className="mr-2 w-4 h-4" /> Download Full PDF Report
        </Button>
      )}
    </div>
  );
}

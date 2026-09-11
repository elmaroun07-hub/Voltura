import { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { useOptimize } from "@/hooks/use-calculations";
import { irradianceLabel } from "@/lib/provenance";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Zap, Satellite, CalendarCheck } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

/**
 * Default usage SHAPE — hourly weights, not kWh.
 *
 * It used to be sent to a language model under the label "24h Energy Pattern
 * (kWh)". It sums to 102, so every recommendation this page produced was sized
 * for a 102 kWh/day household, roughly seven times a normal Spanish one. The
 * server now normalises it to sum 1 and takes the magnitude from the usage
 * field below.
 */
const DEFAULT_PATTERN = [
  2, 2, 2, 2, 3, 5, 8, 8, 6, 4, 3, 3, 3, 3, 4, 5, 7, 10, 8, 5, 3, 2, 2, 2
];

const DEFAULT_USAGE_KWH = 5000;

export default function Optimizer() {
  const [location, setLocation] = useState("San Francisco, CA");
  // A string, so the field can be empty while it is being retyped. An empty
  // field submits NaN, which the schema rejects — it never becomes a default.
  const [usage, setUsage] = useState(String(DEFAULT_USAGE_KWH));
  const optimizeMutation = useOptimize();

  const handleOptimize = () => {
    optimizeMutation.mutate({
      location,
      energyPattern: DEFAULT_PATTERN,
      annualUsageKwh: Number(usage),
    });
  };

  const chartData = DEFAULT_PATTERN.map((val, i) => ({ hour: `${i}:00`, usage: val }));
  const result = optimizeMutation.data;

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">AI Optimizer</h1>
          <p className="text-muted-foreground">
            Your system is sized from NASA POWER satellite irradiance for your location and
            your own annual consumption. The assistant explains the result; it does not
            choose it.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Define your location, your usage and your load profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="optimizer-location">Location</Label>
                  <Input
                    id="optimizer-location"
                    data-testid="input-optimizer-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter city..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="optimizer-usage">Annual electricity use (kWh/year)</Label>
                  <Input
                    id="optimizer-usage"
                    data-testid="input-optimizer-usage"
                    type="number"
                    min={100}
                    max={100000}
                    value={usage}
                    onChange={(e) => setUsage(e.target.value)}
                    placeholder="e.g. 5000"
                  />
                  <p className="text-xs text-muted-foreground">
                    From your bill. The profile below says <em>when</em> you use power; this
                    says how much.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex justify-between">
                    <span>Typical Daily Usage Pattern</span>
                    <span className="text-xs text-muted-foreground italic">Standard Profile</span>
                  </Label>
                  <div className="h-32 w-full border rounded-md p-2 bg-muted/20">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="hour" hide />
                        <YAxis hide />
                        <Tooltip />
                        <Area type="monotone" dataKey="usage" stroke="#10b981" fillOpacity={1} fill="url(#colorUsage)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Relative shape only — the hours, not the kilowatt-hours.
                  </p>
                </div>

                <Button
                  onClick={handleOptimize}
                  className="w-full h-12 text-lg"
                  disabled={optimizeMutation.isPending}
                >
                  {optimizeMutation.isPending ? (
                    <><Loader2 className="mr-2 animate-spin" /> Optimizing...</>
                  ) : (
                    <><Zap className="mr-2 w-4 h-4" /> Run AI Optimization</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {result ? (
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Satellite className="w-6 h-6" /> Recommended Configuration
                  </CardTitle>
                  {/*
                    The provenance line. This tab used to say "Optimal
                    Configuration" beside a green check and cite no source of any
                    kind, while the figures beside it came from a language model's
                    priors. The label map is shared with the calculator's results
                    panel so one enum cannot grow two labels (G7, P5).
                  */}
                  <CardDescription
                    data-testid="text-optimizer-irradiance-source"
                    className="flex items-center gap-1.5 pt-1"
                  >
                    <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {irradianceLabel(result.resolution)} ·{" "}
                      {result.sizing.irradianceKwhM2Day} kWh/m²/day at{" "}
                      {result.resolution.lat}, {result.resolution.lon}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-xl shadow-sm">
                      <p className="text-sm text-muted-foreground mb-1">Recommended PV</p>
                      <p data-testid="text-optimal-pv" className="text-2xl font-bold">
                        {result.optimalPv} W
                      </p>
                      <p className="text-xs text-muted-foreground">{result.sizing.pvKwp} kWp</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl shadow-sm">
                      <p className="text-sm text-muted-foreground mb-1">Battery Storage</p>
                      <p data-testid="text-optimal-battery" className="text-2xl font-bold">
                        {result.optimalBattery} kWh
                      </p>
                      <p className="text-xs text-muted-foreground">
                        covers {result.sizing.nightUsageKwh} kWh overnight
                      </p>
                    </div>
                  </div>

                  {/*
                    What the figures were divided by. A recommended size without
                    its assumptions is not a citation, which is the same argument
                    that put the irradiance period next to the mean.
                  */}
                  <div className="bg-white/50 p-4 rounded-xl text-sm space-y-1">
                    <p className="font-medium mb-1">How this was computed</p>
                    <p className="text-muted-foreground">
                      Sized so a year of generation equals a year of consumption
                      ({Math.round(result.sizing.coverageTarget * 100)}% of{" "}
                      {result.sizing.annualUsageKwh.toLocaleString()} kWh/year, about{" "}
                      {result.sizing.dailyUsageKwh} kWh/day). This is annual energy parity,
                      not off-grid autonomy: generation and demand still fall at different
                      hours.
                    </p>
                    <p className="text-muted-foreground">
                      Assumes a {Math.round(result.sizing.performanceRatio * 100)}% system
                      performance ratio, {Math.round(result.sizing.roundTripEfficiency * 100)}%
                      battery round-trip efficiency and{" "}
                      {Math.round(result.sizing.usableDepthOfDischarge * 100)}% usable depth of
                      discharge. The battery carries the{" "}
                      {result.sizing.darkHours} hours a day the array produces nothing.
                    </p>
                  </div>

                  <div className="bg-white/50 p-4 rounded-xl text-sm leading-relaxed">
                    <p className="font-medium mb-1">Analysis:</p>
                    <p data-testid="text-optimizer-explanation" className="whitespace-pre-line">
                      {result.explanation}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl p-8 text-muted-foreground bg-muted/10">
                <div className="text-center">
                  <Zap className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Run optimization to see the recommended system</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

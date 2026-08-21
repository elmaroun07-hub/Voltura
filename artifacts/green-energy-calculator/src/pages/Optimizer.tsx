import { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { useOptimize } from "@/hooks/use-calculations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Zap, CheckCircle2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// Default usage pattern (hourly % of daily usage)
const DEFAULT_PATTERN = [
  2, 2, 2, 2, 3, 5, 8, 8, 6, 4, 3, 3, 3, 3, 4, 5, 7, 10, 8, 5, 3, 2, 2, 2
];

export default function Optimizer() {
  const [location, setLocation] = useState("San Francisco, CA");
  const optimizeMutation = useOptimize();

  const handleOptimize = () => {
    optimizeMutation.mutate({
      location,
      energyPattern: DEFAULT_PATTERN
    });
  };

  const chartData = DEFAULT_PATTERN.map((val, i) => ({ hour: `${i}:00`, usage: val }));

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">AI Optimizer</h1>
          <p className="text-muted-foreground">
            Our AI analyzes hourly usage patterns and location data to recommend the perfect system size.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Define your location and load profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input 
                    value={location} 
                    onChange={(e) => setLocation(e.target.value)} 
                    placeholder="Enter city..."
                  />
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
            {optimizeMutation.data ? (
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <CheckCircle2 className="w-6 h-6" /> Optimal Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-xl shadow-sm">
                      <p className="text-sm text-muted-foreground mb-1">Recommended PV</p>
                      <p className="text-2xl font-bold">{optimizeMutation.data.optimalPv} W</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl shadow-sm">
                      <p className="text-sm text-muted-foreground mb-1">Battery Storage</p>
                      <p className="text-2xl font-bold">{optimizeMutation.data.optimalBattery} kWh</p>
                    </div>
                  </div>

                  <div className="bg-white/50 p-4 rounded-xl text-sm leading-relaxed">
                    <p className="font-medium mb-1">Analysis:</p>
                    {optimizeMutation.data.explanation}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl p-8 text-muted-foreground bg-muted/10">
                <div className="text-center">
                  <Zap className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Run optimization to see AI recommendations</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

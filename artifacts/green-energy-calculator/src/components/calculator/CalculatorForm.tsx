import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { calculationInputSchema, type CalculationInput } from "@/lib/api";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Sun, Battery, MapPin, Zap, Euro, Gauge, TrendingUp } from "lucide-react";

interface CalculatorFormProps {
  onSubmit: (data: CalculationInput) => void;
  isLoading: boolean;
}

export function CalculatorForm({ onSubmit, isLoading }: CalculatorFormProps) {
  const form = useForm<CalculationInput>({
    resolver: zodResolver(calculationInputSchema),
    defaultValues: {
      location: "",
      energyUsage: 5000,
      pvWattage: 4000,
      batteryCapacity: 10,
      electricityTariff: 0.25,
      batteryEfficiency: 0.9,
      panelOrientation: "south",
      roofAngle: 30,
      installationCostEur: null,
    },
  });

  const pvWattage = form.watch("pvWattage");
  const batteryCapacity = form.watch("batteryCapacity");
  const estimatedCost = Math.round((pvWattage / 1000) * 900 + batteryCapacity * 500 + 1200);

  return (
    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-6">
        <CardTitle className="text-2xl text-primary">System Parameters</CardTitle>
        <CardDescription>Enter your details — irradiance from NASA POWER satellite data</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" /> Location
                  </FormLabel>
                  <FormControl>
                    <Input data-testid="input-location" placeholder="City, Country (e.g. Berlin, Germany)" className="h-11 bg-white/50" {...field} />
                  </FormControl>
                  <FormDescription>Used to look up solar irradiance and carbon intensity</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="energyUsage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" /> Annual Usage (kWh)
                    </FormLabel>
                    <FormControl>
                      <Input data-testid="input-energy-usage" type="number" className="h-11 bg-white/50" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pvWattage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-amber-500" /> PV Size (Watts)
                    </FormLabel>
                    <FormControl>
                      <Input data-testid="input-pv-wattage" type="number" className="h-11 bg-white/50" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="batteryCapacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Battery className="w-4 h-4 text-primary" /> Battery Storage — {field.value} kWh
                  </FormLabel>
                  <FormControl>
                    <Slider
                      data-testid="slider-battery-capacity"
                      min={0} max={50} step={0.5}
                      value={[field.value]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator className="my-1" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Advanced Parameters</p>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="electricityTariff"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Euro className="w-4 h-4 text-green-600" /> Tariff (€/kWh)
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-electricity-tariff"
                        type="number" step="0.01" min="0.01" max="5"
                        className="h-11 bg-white/50"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>e.g. 0.30 for 30 c/kWh</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="batteryEfficiency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-primary" /> Battery Round-Trip Eff. — {Math.round(field.value * 100)}%
                    </FormLabel>
                    <FormControl>
                      <Slider
                        data-testid="slider-battery-efficiency"
                        min={0.5} max={1.0} step={0.01}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        className="mt-3"
                      />
                    </FormControl>
                    <FormDescription>Typical Li-ion: 90–95%</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="panelOrientation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Panel Orientation</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-panel-orientation" className="bg-white/50 h-11">
                          <SelectValue placeholder="Select direction" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="south">South (Best N. Hemisphere)</SelectItem>
                        <SelectItem value="east">East (−13%)</SelectItem>
                        <SelectItem value="west">West (−13%)</SelectItem>
                        <SelectItem value="north">North (−30%)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roofAngle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Panel Tilt Angle — {field.value}°</FormLabel>
                    <FormControl>
                      <Slider
                        data-testid="slider-roof-angle"
                        min={0} max={90} step={5}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        className="py-4"
                      />
                    </FormControl>
                    <FormDescription>Optimal ≈ 35° for mid-latitudes</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="installationCostEur"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" /> Installation Cost (€)
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-installation-cost"
                      type="number"
                      step="100"
                      min="0"
                      className="h-11 bg-white/50"
                      placeholder={`Auto-estimate: €${estimatedCost.toLocaleString()}`}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Leave blank to auto-estimate (panels + battery + install)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              data-testid="button-calculate"
              type="submit"
              className="w-full h-13 text-base font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01]"
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Fetching irradiance & simulating 8760h…</>
              ) : (
                "Calculate Savings"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

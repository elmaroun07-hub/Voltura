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
import { Loader2, Sun, Battery, MapPin, Zap, Banknote, Gauge, TrendingUp } from "lucide-react";
import { useI18n, zodErrorMap } from "@/i18n";

interface CalculatorFormProps {
  onSubmit: (data: CalculationInput) => void;
  isLoading: boolean;
}

export function CalculatorForm({ onSubmit, isLoading }: CalculatorFormProps) {
  const { t, num } = useI18n();
  // Validation messages come from the catalog, in the language chosen when
  // the form validates — the schema itself carries no prose.
  const form = useForm<CalculationInput>({
    resolver: zodResolver(calculationInputSchema, { errorMap: zodErrorMap }),
    defaultValues: {
      location: "",
      energyUsage: 5000,
      pvWattage: 4000,
      batteryCapacity: 10,
      electricityTariff: null,
      batteryEfficiency: 0.9,
      panelOrientation: "south",
      roofAngle: 30,
      installationCost: null,
    },
  });


  return (
    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-6">
        <CardTitle className="text-2xl text-primary">{t("calc.title")}</CardTitle>
        <CardDescription>{t("calc.description")}</CardDescription>
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
                    <MapPin className="w-4 h-4 text-primary" /> {t("common.location")}
                  </FormLabel>
                  <FormControl>
                    <Input data-testid="input-location" placeholder={t("calc.locationPlaceholder")} className="h-11 bg-white/50" {...field} />
                  </FormControl>
                  <FormDescription>{t("calc.locationHelp")}</FormDescription>
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
                      <Zap className="w-4 h-4 text-amber-500" /> {t("calc.annualUsage")}
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
                      <Sun className="w-4 h-4 text-amber-500" /> {t("calc.pvSize")}
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
                    <Battery className="w-4 h-4 text-primary" /> {t("calc.battery", { kwh: num(field.value) })}
                  </FormLabel>
                  <FormControl>
                    <Slider
                      data-testid="slider-battery-capacity"
                      min={0} max={50} step={1}
                      value={[field.value]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator className="my-1" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("calc.advanced")}</p>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="electricityTariff"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-green-600" /> {t("calc.tariff")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-electricity-tariff"
                        type="number" step="0.01" min="0.01" max="5"
                        className="h-11 bg-white/50"
                        placeholder={t("calc.tariffPlaceholder")}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>{t("calc.tariffHelp")}</FormDescription>
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
                      <Gauge className="w-4 h-4 text-primary" /> {t("calc.batteryEff", { pct: num(Math.round(field.value * 100)) })}
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
                    <FormDescription>{t("calc.batteryEffHelp")}</FormDescription>
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
                    <FormLabel>{t("calc.orientation")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-panel-orientation" className="bg-white/50 h-11">
                          <SelectValue placeholder={t("calc.orientationPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="south">{t("calc.orientation.south")}</SelectItem>
                        <SelectItem value="east">{t("calc.orientation.east")}</SelectItem>
                        <SelectItem value="west">{t("calc.orientation.west")}</SelectItem>
                        <SelectItem value="north">{t("calc.orientation.north")}</SelectItem>
                      </SelectContent>
                    </Select>
                      <FormDescription>{t("calc.orientationHelp")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roofAngle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("calc.tilt", { deg: num(field.value) })}</FormLabel>
                    <FormControl>
                      <Slider
                        data-testid="slider-roof-angle"
                        min={0} max={90} step={5}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        className="py-4"
                      />
                    </FormControl>
                    <FormDescription>{t("calc.tiltHelp")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="installationCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" /> {t("calc.installCost")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-installation-cost"
                      type="number"
                      step="100"
                      min="0"
                      className="h-11 bg-white/50"
                      placeholder={t("calc.installCostPlaceholder")}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>{t("calc.installCostHelp")}</FormDescription>
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
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t("calc.submitting")}</>
              ) : (
                t("calc.submit")
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

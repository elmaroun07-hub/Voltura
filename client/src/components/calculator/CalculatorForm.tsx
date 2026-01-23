import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { calculationInputSchema, type CalculationInput } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Sun, Battery, MapPin, Zap } from "lucide-react";

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
      panelOrientation: "south",
      roofAngle: 30,
    },
  });

  return (
    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-8">
        <CardTitle className="text-2xl text-primary">System Parameters</CardTitle>
        <CardDescription>Enter your home details to estimate savings</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" /> Location
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="City, State or Zip Code" className="h-12 bg-white/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="energyUsage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-accent" /> Annual Usage (kWh)
                    </FormLabel>
                    <FormControl>
                      <Input type="number" className="h-12 bg-white/50" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormDescription>Avg US home uses ~10,000 kWh/yr</FormDescription>
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
                      <Sun className="w-4 h-4 text-accent" /> PV System Size (Watts)
                    </FormLabel>
                    <FormControl>
                      <Input type="number" className="h-12 bg-white/50" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormDescription>Standard panel is ~400W</FormDescription>
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
                    <Battery className="w-4 h-4 text-primary" /> Battery Storage (kWh)
                  </FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-4">
                      <Slider 
                        min={0} max={50} step={0.5} 
                        value={[field.value]} 
                        onValueChange={(vals) => field.onChange(vals[0])} 
                        className="flex-1"
                      />
                      <span className="w-16 font-mono font-medium text-right">{field.value} kWh</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <FormField
                control={form.control}
                name="panelOrientation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Panel Orientation</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-white/50 h-12">
                          <SelectValue placeholder="Select direction" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="south">South (Best for N. Hemisphere)</SelectItem>
                        <SelectItem value="east">East</SelectItem>
                        <SelectItem value="west">West</SelectItem>
                        <SelectItem value="north">North</SelectItem>
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
                    <FormLabel>Roof Angle ({field.value}°)</FormLabel>
                    <FormControl>
                      <Slider 
                        min={0} max={90} step={5} 
                        value={[field.value]} 
                        onValueChange={(vals) => field.onChange(vals[0])} 
                        className="py-4"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-[1.01]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculating...
                </>
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

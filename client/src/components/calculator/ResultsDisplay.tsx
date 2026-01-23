import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { type CalculationResponse } from "@shared/routes";
import { Card } from "@/components/ui/card";
import { Leaf, DollarSign, TrendingUp, Sun } from "lucide-react";

interface ResultsDisplayProps {
  results: CalculationResponse | null;
}

const COLORS = ['#10b981', '#fbbf24', '#e2e8f0']; // Green (Solar), Yellow (Battery), Gray (Grid)

export function ResultsDisplay({ results }: ResultsDisplayProps) {
  if (!results) {
    return (
      <Card className="h-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-muted/20 border-dashed">
        <Sun className="w-16 h-16 mb-4 text-muted-foreground/30" />
        <h3 className="text-xl font-medium mb-2">No Data Yet</h3>
        <p>Enter your system details to see your potential savings.</p>
      </Card>
    );
  }

  const mixData = [
    { name: 'Direct Solar', value: results.breakdown.solar },
    { name: 'From Battery', value: results.breakdown.battery },
    { name: 'Grid Import', value: results.breakdown.grid },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Annual Savings Card */}
        <Card className="p-6 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-none shadow-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-primary-foreground/80 font-medium mb-1">Annual Savings</p>
              <h2 className="text-4xl font-display font-bold">{results.savingsKwh.toLocaleString()} kWh</h2>
            </div>
            <div className="bg-white/20 p-3 rounded-full">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold opacity-90">Est. ${Math.round(results.savingsKwh * 0.15).toLocaleString()}</span>
            <span className="text-sm opacity-75">saved per year</span>
          </div>
        </Card>

        {/* CO2 Reduction Card */}
        <Card className="p-6 bg-white border-primary/20 shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-muted-foreground font-medium mb-1">CO₂ Reduction</p>
              <h2 className="text-4xl font-display font-bold text-foreground">{results.co2Reduction.toLocaleString()} kg</h2>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Leaf className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Equivalent to planting <span className="font-bold text-green-600">{Math.round(results.co2Reduction / 20)} trees</span> annually.
          </p>
        </Card>
      </div>

      {/* Energy Mix Chart */}
      <Card className="p-6 shadow-md border-border/50">
        <h3 className="font-display font-semibold text-lg mb-6">Estimated Energy Mix</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={mixData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {mixData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(val: number) => `${val}%`}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* AI Recommendation */}
      <Card className="p-6 bg-accent/10 border-accent/20">
        <div className="flex gap-4">
          <div className="mt-1">
            <Sun className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h4 className="font-bold text-accent-foreground mb-1">Recommendation</h4>
            <p className="text-sm text-accent-foreground/80 leading-relaxed">
              {results.recommendation}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

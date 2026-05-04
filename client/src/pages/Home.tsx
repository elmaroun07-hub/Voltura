import { useState } from "react";
import { motion } from "framer-motion";
import { Shell } from "@/components/layout/Shell";
import { CalculatorForm } from "@/components/calculator/CalculatorForm";
import { ResultsDisplay } from "@/components/calculator/ResultsDisplay";
import { useCalculate } from "@/hooks/use-calculations";
import { type CalculationInput, type CalculationResponse } from "@shared/routes";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export default function Home() {
  const [results, setResults] = useState<CalculationResponse | null>(null);
  const [latestId, setLatestId] = useState<number | null>(null);
  const calculateMutation = useCalculate();

  const { data: history } = useQuery({
    queryKey: [api.calculations.history.path],
    queryFn: async () => {
      const res = await fetch(api.calculations.history.path);
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
  });

  const handleCalculate = async (data: CalculationInput) => {
    const result = await calculateMutation.mutateAsync(data);
    setResults(result);
    // Grab the most-recently-created ID from history (re-fetched after mutation)
  };

  // Sync latest ID from history after each calculation
  const calcId = history && history.length > 0 ? history[0].id : null;

  return (
    <Shell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2"
            >
              Energy Calculator
            </motion.h1>
            <p className="text-muted-foreground max-w-xl">
              Live solar irradiance from NASA POWER · 8760-hour battery simulation · Country carbon intensity lookup
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="xl:col-span-5"
          >
            <CalculatorForm
              onSubmit={handleCalculate}
              isLoading={calculateMutation.isPending}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="xl:col-span-7"
          >
            <ResultsDisplay results={results} calcId={results ? calcId : null} />
          </motion.div>
        </div>
      </div>
    </Shell>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { Shell } from "@/components/layout/Shell";
import { CalculatorForm } from "@/components/calculator/CalculatorForm";
import { ResultsDisplay } from "@/components/calculator/ResultsDisplay";
import { useCalculate } from "@/hooks/use-calculations";
import { type CalculationInput, type CalculationResponse } from "@/lib/api";
import { useI18n } from "@/i18n";

export default function Home() {
  const [results, setResults] = useState<CalculationResponse | null>(null);
  const calculateMutation = useCalculate();
  const { t } = useI18n();

  const handleCalculate = async (data: CalculationInput) => {
    const result = await calculateMutation.mutateAsync(data);
    setResults(result);
  };

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
              {t("brand.name")}
            </motion.h1>
            <p className="text-muted-foreground max-w-xl">
              {t("home.subtitle")}
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
            {/* The id of the row this result was stored as, from the same response.
                Never the newest history row: that is another request, and it can
                still be the previous calculation (D51, D53). */}
            <ResultsDisplay results={results} calcId={results ? results.id : null} />
          </motion.div>
        </div>
      </div>
    </Shell>
  );
}

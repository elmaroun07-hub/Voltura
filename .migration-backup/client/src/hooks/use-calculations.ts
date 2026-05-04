import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CalculationInput, type CalculationResponse } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useHistory() {
  return useQuery({
    queryKey: [api.calculations.history.path],
    queryFn: async () => {
      const res = await fetch(api.calculations.history.path);
      if (!res.ok) throw new Error("Failed to fetch history");
      return api.calculations.history.responses[200].parse(await res.json());
    },
  });
}

export function useCalculate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CalculationInput) => {
      const res = await fetch(api.calculations.create.path, {
        method: api.calculations.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message || "Validation failed");
        }
        throw new Error("Failed to calculate savings");
      }

      return api.calculations.create.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.calculations.history.path] });
      toast({
        title: "Calculation Complete",
        description: "Your energy savings report is ready.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useOptimize() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: { energyPattern: number[], location: string }) => {
      const res = await fetch(api.calculations.optimize.path, {
        method: api.calculations.optimize.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Optimization failed");
      return api.calculations.optimize.responses[200].parse(await res.json());
    },
    onError: (error) => {
      toast({
        title: "Optimization Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CalculationInput, type CalculationResponse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { sessionFetch } from "@/lib/queryClient";
const API_BASE = import.meta.env.VITE_API_URL ?? "";
export function useHistory() {
  return useQuery({
    queryKey: [api.calculations.history.path],
    queryFn: async () => {
      const res = await sessionFetch(API_BASE + api.calculations.history.path);
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
      const res = await sessionFetch(API_BASE + api.calculations.create.path, {
        method: api.calculations.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        // 422 is the geocode failure. It carries a readable message and must
        // reach the toast - a generic "failed" here is the invisible-wrong-answer
        // problem in a different costume.
        if (res.status === 400 || res.status === 422) {
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
      const res = await sessionFetch(API_BASE + api.calculations.optimize.path, {
        method: api.calculations.optimize.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        // The server sends readable prose (e.g. 502 invalid_model_response).
        // Prefer it; fall back to a generic line if the body isn't JSON.
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ?? "Optimization failed. Please try again in a moment.",
        );
      }

      // safeParse, not parse: a ZodError's `message` is a raw JSON dump of its
      // issues, and onError renders it into a toast. That is how validation
      // internals ended up on screen. Log the detail, show the user prose.
      const parsed = api.calculations.optimize.responses[200].safeParse(await res.json());
      if (!parsed.success) {
        console.error("[optimize] response failed validation:", parsed.error.issues);
        throw new Error("The optimizer returned an unexpected response. Please try again.");
      }
      return parsed.data;
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

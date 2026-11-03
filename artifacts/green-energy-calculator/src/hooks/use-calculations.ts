import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CalculationInput, type CalculationResponse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { sessionFetch } from "@/lib/queryClient";
import { tNow, UserMessage, userFacing } from "@/i18n";

export function useHistory() {
  return useQuery({
    queryKey: [api.calculations.history.path],
    queryFn: async () => {
      const res = await sessionFetch(api.calculations.history.path);
      if (!res.ok) throw new UserMessage(tNow()("error.history"));
      return api.calculations.history.responses[200].parse(await res.json());
    },
  });
}

export function useCalculate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CalculationInput) => {
      const res = await sessionFetch(api.calculations.create.path, {
        method: api.calculations.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        // 422 is the geocode failure. It carries a readable message and must
        // reach the toast - a generic "failed" here is the invisible-wrong-answer
        // problem in a different costume.
        // The API writes that message in the language sessionFetch asked for
        // (Accept-Language), so it is the person's text, not a developer's.
        // 503 is NASA POWER unavailable (VPUB): the server's sentence says why
        // there is no result and to try again, so it reaches the toast too.
        if (res.status === 400 || res.status === 422 || res.status === 503) {
          const error = await res.json();
          throw new UserMessage(typeof error?.message === "string" && error.message ? error.message : tNow()("error.validation"));
        }
        throw new UserMessage(tNow()("error.calculate"));
      }

      return api.calculations.create.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.calculations.history.path] });
      const t = tNow();
      toast({
        title: t("toast.calcDoneTitle"),
        description: t("toast.calcDoneBody"),
      });
    },
    onError: (error) => {
      const t = tNow();
      toast({
        title: t("toast.errorTitle"),
        description: userFacing(error, t("error.calculate")),
        variant: "destructive",
      });
    },
  });
}

export function useOptimize() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: {
      energyPattern: number[];
      location: string;
      // H-OPT: required. The 24-entry pattern is a SHAPE; this is the
      // magnitude, and without it the server refuses rather than assuming one.
      annualUsageKwh: number;
    }) => {
      const res = await sessionFetch(api.calculations.optimize.path, {
        method: api.calculations.optimize.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        // The server sends readable prose (e.g. 502 invalid_model_response).
        // Prefer it; fall back to a generic line if the body isn't JSON.
        const body = await res.json().catch(() => null);
        throw new UserMessage(
          typeof body?.message === "string" && body.message ? body.message : tNow()("error.optimize"),
        );
      }

      // safeParse, not parse: a ZodError's `message` is a raw JSON dump of its
      // issues, and onError renders it into a toast. That is how validation
      // internals ended up on screen. Log the detail, show the user prose.
      const parsed = api.calculations.optimize.responses[200].safeParse(await res.json());
      if (!parsed.success) {
        console.error("[optimize] response failed validation:", parsed.error.issues);
        throw new UserMessage(tNow()("error.optimizeUnexpected"));
      }
      return parsed.data;
    },
    onError: (error) => {
      const t = tNow();
      toast({
        title: t("toast.optimizeFailedTitle"),
        description: userFacing(error, t("error.optimize")),
        variant: "destructive",
      });
    },
  });
}

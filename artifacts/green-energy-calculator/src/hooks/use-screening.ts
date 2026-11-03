import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { sessionFetch, type ApiPath } from "@/lib/queryClient";
import { tNow, UserMessage } from "@/i18n";

/**
 * H3.9 — reads of the screening portfolio. Every response is parsed: a shape
 * the page does not expect fails loudly instead of rendering a blank ranking.
 * A 404 with code `screening_not_loaded` is a state of its own, not an error:
 * the municipality simply has nothing loaded yet.
 */

const band = z.object({ low: z.number(), mid: z.number(), high: z.number() });

export const portfolioRowSchema = z.object({
  rank: z.number().int(),
  ref: z.string(),
  dwellings: z.number(),
  year: z.number().nullable(),
  floors: z.number().nullable(),
  zone: z.string(),
  cusec: z.string().nullable(),
  index: band,
  certificateCoverage: z.number(),
  certificateCapped: z.boolean(),
  censusSection: z.boolean(),
});
export type PortfolioRow = z.infer<typeof portfolioRowSchema>;

const municipalitiesSchema = z.object({
  municipalities: z.array(
    z.object({ ine: z.string(), name: z.string(), province: z.string(), runId: z.string(), scored: z.number() }),
  ),
});

const listSchema = z.object({ runId: z.string(), total: z.number(), rows: z.array(portfolioRowSchema) });

const summarySchema = z.object({
  runId: z.string(),
  scored: z.number(),
  dwellings: z.number(),
  certified: z.number(),
  deciles: z.array(
    z.object({ decile: z.number(), buildings: z.number(), dwellings: z.number(), withCertificate: z.number(), medianMid: z.number() }),
  ),
  gap: z.object({ buildings: z.number(), dwellings: z.number() }),
  districts: z.array(z.string()),
});
export type PortfolioSummary = z.infer<typeof summarySchema>;

const traceSchema = z.object({
  runId: z.string(),
  row: z.record(z.unknown()),
  sources: z.array(
    z.object({
      id: z.string(),
      publisher: z.string(),
      dataset: z.string(),
      url: z.string(),
      retrieved_at: z.string(),
      licence: z.string(),
    }),
  ),
});
export type BuildingTrace = z.infer<typeof traceSchema>;

export class NotLoaded extends Error {
  readonly name = "NotLoaded";
}

/**
 * Agency access key (operator ruling 3 Nov 2026). An agency the maintainer
 * works with gets a key; pasted on the screening page it is kept in this
 * browser and sent as X-Agency-Key, and the API then shows every scored
 * building, single-family houses included. A key the API refuses is an error
 * of its own, so the page can say so instead of quietly showing the public view.
 */
export const AGENCY_KEY_STORAGE = "voltura.agencyKey";

export function getAgencyKey(): string | null {
  try {
    return globalThis.localStorage?.getItem(AGENCY_KEY_STORAGE) ?? null;
  } catch {
    return null;
  }
}

export function setAgencyKey(key: string | null): void {
  try {
    if (key) globalThis.localStorage?.setItem(AGENCY_KEY_STORAGE, key);
    else globalThis.localStorage?.removeItem(AGENCY_KEY_STORAGE);
  } catch {
    // Storage can be absent or throw; the key then lasts only until reload.
  }
}

function agencyHeaders(): Record<string, string> {
  const key = getAgencyKey();
  return key ? { "X-Agency-Key": key } : {};
}

/** Part of every screening query key, so adding or removing a key refetches. */
function agencyScopeKey(): string {
  const key = getAgencyKey();
  return key ? `agency:${key.slice(0, 10)}` : "public";
}

export class AgencyKeyInvalid extends Error {
  readonly name = "AgencyKeyInvalid";
}

async function getJson<T>(path: ApiPath, schema: z.ZodType<T>): Promise<T> {
  const res = await sessionFetch(path, { headers: agencyHeaders() });
  if (res.status === 401) {
    const body = await res.json().catch(() => null);
    if (body?.code === "agency_key_invalid") throw new AgencyKeyInvalid(body.message);
  }
  if (res.status === 404) {
    const body = await res.json().catch(() => null);
    if (body?.code === "screening_not_loaded" || body?.code === "building_not_found" || body?.code === "building_not_published") {
      throw new NotLoaded(body.code);
    }
  }
  if (!res.ok) throw new UserMessage(tNow()("screening.loadError"));
  return schema.parse(await res.json());
}

export function useMunicipalities() {
  return useQuery({
    queryKey: ["/api/screening/municipalities"],
    queryFn: () => getJson("/api/screening/municipalities", municipalitiesSchema),
  });
}

export interface Filters {
  age?: "pre-1980" | "1980-2006" | "2007-on" | "unknown";
  certificate?: "with" | "without";
  district?: string;
}

export const PAGE_SIZE = 50;

export function useScreeningList(ine: string | undefined, filters: Filters, page: number) {
  const q = new URLSearchParams();
  if (filters.age) q.set("age", filters.age);
  if (filters.certificate) q.set("certificate", filters.certificate);
  if (filters.district) q.set("district", filters.district);
  q.set("limit", String(PAGE_SIZE));
  q.set("offset", String(page * PAGE_SIZE));
  const path = `/api/screening/${ine}/buildings?${q.toString()}` as ApiPath;
  return useQuery({
    queryKey: [path, agencyScopeKey()],
    queryFn: () => getJson(path, listSchema),
    enabled: Boolean(ine),
    retry: (count, err) => !(err instanceof NotLoaded) && !(err instanceof AgencyKeyInvalid) && count < 2,
  });
}

export function useScreeningSummary(ine: string | undefined) {
  const path = `/api/screening/${ine}/summary` as ApiPath;
  return useQuery({
    queryKey: [path],
    queryFn: () => getJson(path, summarySchema),
    enabled: Boolean(ine),
    retry: (count, err) => !(err instanceof NotLoaded) && !(err instanceof AgencyKeyInvalid) && count < 2,
  });
}

export function useBuildingTrace(ine: string, ref: string) {
  const path = `/api/screening/${ine}/buildings/${ref}` as ApiPath;
  return useQuery({
    queryKey: [path, agencyScopeKey()],
    queryFn: () => getJson(path, traceSchema),
    retry: (count, err) => !(err instanceof NotLoaded) && !(err instanceof AgencyKeyInvalid) && count < 2,
  });
}

const agencySchema = z.object({ agency: z.string() });

/** Which agency the stored key belongs to; disabled when no key is stored. */
export function useAgency(key: string | null) {
  const path = "/api/screening/agency" as ApiPath;
  return useQuery({
    queryKey: [path, key ? key.slice(0, 10) : "none"],
    queryFn: () => getJson(path, agencySchema),
    enabled: Boolean(key),
    retry: false,
  });
}

/** Fetch the CSV through sessionFetch (the one place the API base is applied) and save it. */
export async function downloadScreeningCsv(ine: string): Promise<void> {
  const res = await sessionFetch(`/api/screening/${ine}/export.csv`, { headers: agencyHeaders() });
  if (!res.ok) throw new UserMessage(tNow()("screening.exportError"));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = getAgencyKey() ? `cribado-${ine}-completo.csv` : `cribado-${ine}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

import { QueryClient, QueryFunction } from "@tanstack/react-query";

const SESSION_ID_KEY = "voltura.sessionId";

/**
 * The API origin, applied in exactly one place: sessionFetch, below.
 *
 * In production the web is a static site on its own origin, and its SPA
 * fallback answers any unknown path - /api/history included - with 200 and
 * index.html. A call that misses this prefix does not fail at the network:
 * res.ok is true and the JSON parse throws (D51). The prefix used to be
 * defined three times and added by hand at every call site; one site forgot.
 */
const API_BASE = import.meta.env.VITE_API_URL ?? "";

/**
 * A path as the API routes it: never a full URL, never carrying the base.
 * sessionFetch adds the base, so a caller that adds it too is a type error.
 */
export type ApiPath = `/api/${string}`;

/** Thrown instead of fetching something the API base cannot be applied to. */
export class ApiPathError extends Error {
  readonly name = "ApiPathError";
  constructor(readonly path: string) {
    super(`Not an API path: ${JSON.stringify(path)}. Pass "/api/..."; sessionFetch applies the API base.`);
  }
}

function isApiPath(value: string): value is ApiPath {
  return value.startsWith("/api/");
}

/**
 * The one place an X-Session-Id header is attached, and the one place the API
 * base is applied.
 *
 * Every API call in the app goes through here. Attaching the header or the
 * base at a call site is exactly what this exists to prevent, so nothing below
 * and nothing in the hooks calls `fetch` directly — including getQueryFn,
 * which is installed as the QueryClient's default queryFn and would otherwise
 * serve any useQuery written without its own queryFn, unfiltered.
 *
 * The id is generated once per browser and persisted in localStorage. It is
 * forgeable by design: it closes accidental cross-visitor exposure, it is not
 * authorization.
 */
export async function sessionFetch(path: ApiPath, init?: RequestInit): Promise<Response> {
  // The type already demands "/api/...". This catches a value that arrives
  // typed `any` or cast past the checker, which would otherwise be prefixed blind.
  if (!isApiPath(path)) throw new ApiPathError(path);

  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  const headers = new Headers(init?.headers);
  headers.set("X-Session-Id", sessionId);

  return fetch(API_BASE + path, { ...init, headers });
}

/**
 * Download a calculation's PDF report.
 *
 * Both buttons used to call `window.open("/api/calculate/:id/pdf")`. A browser
 * navigation cannot carry a custom header, which is why that route was left
 * unscoped on the server and became an unauthenticated sequential-id oracle
 * over every calculation ever made (finding F2). Scoping the route without
 * changing this would have shipped a 400 behind both buttons.
 *
 * So: fetch through sessionFetch, then hand the blob to a synthetic anchor.
 * The header rides on the request and the file still lands in Downloads.
 *
 * The object URL is revoked on the next frame rather than immediately —
 * Firefox cancels an in-flight download if the blob is revoked in the same
 * tick as the click.
 */
export async function downloadCalculationPdf(calcId: number): Promise<void> {
  const res = await sessionFetch(`/api/calculate/${calcId}/pdf`);
  await throwIfResNotOk(res);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `energy-report-${calcId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// apiRequest and getQueryFn send no `credentials: "include"`. The API is a
// different origin whose CORS config does not allow credentials (api-server
// app.ts), and nothing here uses a cookie: once these two carry the API base,
// that flag would make the browser refuse every response they receive.
export async function apiRequest(
  method: string,
  path: ApiPath,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await sessionFetch(path, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Nothing static says a queryKey names an API path. Refuse anything that
    // does not, rather than hand it on to be fetched from the wrong origin.
    const path = queryKey.join("/");
    if (!isApiPath(path)) throw new ApiPathError(path);
    const res = await sessionFetch(path);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

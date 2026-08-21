import { QueryClient, QueryFunction } from "@tanstack/react-query";

const SESSION_ID_KEY = "voltura.sessionId";

/**
 * The one place an X-Session-Id header is attached.
 *
 * Every API call in the app goes through here. Attaching the header at a call
 * site is exactly what this exists to prevent, so nothing below and nothing in
 * the hooks calls `fetch` directly — including getQueryFn, which is installed
 * as the QueryClient's default queryFn and would otherwise serve any useQuery
 * written without its own queryFn, unfiltered.
 *
 * The id is generated once per browser and persisted in localStorage. It is
 * forgeable by design: it closes accidental cross-visitor exposure, it is not
 * authorization.
 */
export function sessionFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  const headers = new Headers(init?.headers);
  headers.set("X-Session-Id", sessionId);

  return fetch(input, { ...init, headers });
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await sessionFetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
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
    const res = await sessionFetch(queryKey.join("/") as string, {
      credentials: "include",
    });

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

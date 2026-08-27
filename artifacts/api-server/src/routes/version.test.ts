import { describe, expect, it, afterEach, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * /api/version — closing the gap A12 recorded.
 *
 * `voltura-web` serves a build-sha meta tag, so the web can be proven
 * deployed. `voltura-api` served nothing, so a deploy that changed no
 * observable response could not be distinguished from a stale container.
 * Gate H-S only got its proof by accident, because it happened to change a
 * status code.
 *
 * The property that matters is not "it returns a sha" — it is that it NEVER
 * INVENTS ONE. A version endpoint that reports a placeholder is worse than no
 * endpoint, because the placeholder is believed.
 */

vi.mock("../db", () => ({ db: {}, pool: {} }));

const router = (await import("./index")).default;

async function serve() {
  const app = express();
  app.use("/api", router);
  const httpServer = createServer(app);
  const server = httpServer.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

const ORIGINAL = process.env.RENDER_GIT_COMMIT;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.RENDER_GIT_COMMIT;
  else process.env.RENDER_GIT_COMMIT = ORIGINAL;
});

describe("/api/version", () => {
  it("reports the deployed commit when the platform supplies one", async () => {
    process.env.RENDER_GIT_COMMIT = "b405cfa05bba400e2bb780fd64d20d087de44222";
    const { base, close } = await serve();
    try {
      const res = await fetch(`${base}/api/version`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        sha: "b405cfa",
        shaFull: "b405cfa05bba400e2bb780fd64d20d087de44222",
        source: "render",
      });
    } finally {
      await close();
    }
  });

  it("reports null and 'unknown' rather than inventing a sha", async () => {
    delete process.env.RENDER_GIT_COMMIT;
    const { base, close } = await serve();
    try {
      const res = await fetch(`${base}/api/version`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.sha).toBeNull();
      expect(body.shaFull).toBeNull();
      expect(body.source).toBe("unknown");
    } finally {
      await close();
    }
  });

  it("treats a blank env var as absent, not as a sha", async () => {
    // Render setting the variable to "" is not the same as it setting a
    // commit, and `""` truthiness is exactly the kind of thing that produces a
    // confident empty answer.
    process.env.RENDER_GIT_COMMIT = "   ";
    const { base, close } = await serve();
    try {
      const body = (await (await fetch(`${base}/api/version`)).json()) as any;
      expect(body.sha).toBeNull();
      expect(body.source).toBe("unknown");
    } finally {
      await close();
    }
  });

  it("still serves /api/healthz alongside it", async () => {
    const { base, close } = await serve();
    try {
      const res = await fetch(`${base}/api/healthz`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok" });
    } finally {
      await close();
    }
  });
});

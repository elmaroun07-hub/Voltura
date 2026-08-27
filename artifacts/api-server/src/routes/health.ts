import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/**
 * The build this container is actually running.
 *
 * A12 recorded the gap: `voltura-web` serves a `build-sha` meta tag, so a
 * coding session can prove the web deployed, but `voltura-api` exposed nothing
 * at all. Block R "changed nothing observable in the API's runtime", so there
 * was no way to tell a redeployed container from a stale one. Gate H-S got its
 * proof only by accident — it happened to change a status code — and that does
 * not generalise to a deploy that alters no response.
 *
 * Render sets RENDER_GIT_COMMIT on every runtime. Read at request time rather
 * than baked in at build: the bundle is built once and the env var is what the
 * platform actually deployed, so this reports the container, not the compile.
 *
 * Absent means absent. `sha: null` with `source: "unknown"` — never a
 * placeholder, never a zero sha. A version endpoint that invents a version is
 * worse than none, because it is believed. P2.
 */
router.get("/version", (_req, res) => {
  const raw = process.env.RENDER_GIT_COMMIT;
  const sha = raw && raw.trim() ? raw.trim() : null;

  res.json({
    sha: sha ? sha.slice(0, 7) : null,
    shaFull: sha,
    source: sha ? ("render" as const) : ("unknown" as const),
  });
});

export default router;

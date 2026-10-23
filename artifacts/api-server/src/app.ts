import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

/**
 * The single browser origin allowed to call this API.
 *
 * Bare cors() sent Access-Control-Allow-Origin: * , so any site could read
 * every response. Required, not defaulted: a fallback origin here would either
 * re-open the hole or point at the wrong host silently. Missing it kills the
 * process at boot, the same way PORT and DATABASE_URL do.
 */
const webOrigin = process.env.WEB_ORIGIN;

if (!webOrigin) {
  throw new Error(
    "WEB_ORIGIN environment variable is required but was not provided.",
  );
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin: webOrigin,
    // X-Session-Id is not a CORS-safelisted header, so every session-carrying
    // request is preflighted. Omit it here and the browser rejects the response
    // before the handler is ever reached - every read and write fails at once.
    // Accept-Language (H2b) is CORS-safelisted for the values the web sends
    // ("es", "en"); it is named here anyway so a preflight never depends on that.
    allowedHeaders: ["Content-Type", "X-Session-Id", "Accept-Language"],
  }),
);

// Render terminates TLS at its proxy, so req.ip is the proxy's address unless
// the hop count is declared. Cloudflare sits in front of Render and the hop
// count is not published, so since H-D17 the rate limiters do not depend on it:
// they key on lib/client-key.ts, which reads Cloudflare's CF-Connecting-IP.
// This setting is left as it was for everything else that reads req.ip (the
// request log).
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;

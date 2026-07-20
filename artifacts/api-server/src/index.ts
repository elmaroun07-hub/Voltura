import { createServer } from "http";
import app from "./app";
import { registerRoutes } from "./routes/routes";
import { ensureChatTables } from "./ensure-chat-tables";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

ensureChatTables()
  .then(() => registerRoutes(httpServer, app))
  .then(() => {
  httpServer.listen(port, () => {
    logger.info({ port }, "Server listening");
  });
}).catch((err) => {
  logger.error({ err }, "Error starting server");
  process.exit(1);
});

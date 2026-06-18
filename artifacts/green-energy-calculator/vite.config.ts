import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(async ({ command }) => {
  const isBuild = command === "build";

  // PORT only matters when running a server (dev/preview), NOT for a build.
  let port = 5173;
  if (!isBuild) {
    const rawPort = process.env.PORT;
    if (!rawPort) {
      throw new Error("PORT environment variable is required but was not provided.");
    }
    port = Number(rawPort);
    if (Number.isNaN(port) || port <= 0) {
      throw new Error(`Invalid PORT value: "${rawPort}"`);
    }
  }

  // Default to "/" so a production build at the domain root just works.
  const basePath = process.env.BASE_PATH ?? "/";

  // Replit-only plugins: imported lazily, ONLY inside Replit's dev runtime.
  const isReplitDev =
    process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined;

  const replitPlugins = [];
  if (isReplitDev) {
    const [overlay, cartographer, devBanner] = await Promise.all([
      import("@replit/vite-plugin-runtime-error-modal").then((m) => m.default()),
      import("@replit/vite-plugin-cartographer").then((m) =>
        m.cartographer({ root: path.resolve(import.meta.dirname, "..") }),
      ),
      import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
    ]);
    replitPlugins.push(overlay, cartographer, devBanner);
  }

  return {
    base: basePath,
    plugins: [react(), ...replitPlugins],
    css: {
      postcss: {
        plugins: [
          (await import("autoprefixer")).default(),
          (await import("tailwindcss")).default(),
        ],
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: { port, strictPort: true, host: "0.0.0.0", allowedHosts: true, fs: { strict: true } },
    preview: { port, host: "0.0.0.0", allowedHosts: true },
  };
});

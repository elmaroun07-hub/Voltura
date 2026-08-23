import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execFileSync } from "child_process";

/**
 * Short git SHA of the build, resolved at build time only — no runtime cost and
 * no new dependency.
 *
 * Render sets RENDER_GIT_COMMIT on all runtimes including static sites, which is
 * what voltura-web is. The git fallback covers local builds; a shallow clone
 * still resolves HEAD, but if git or .git is unavailable entirely we degrade to
 * "unknown" rather than failing the build.
 */
function resolveBuildSha(): string {
  const fromRender = process.env.RENDER_GIT_COMMIT;
  if (fromRender && fromRender.trim()) return fromRender.trim().slice(0, 7);

  try {
    const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: import.meta.dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return sha || "unknown";
  } catch {
    return "unknown";
  }
}

/** Replaces the __BUILD_SHA__ placeholder in index.html. */
function buildShaPlugin(sha: string): Plugin {
  return {
    name: "voltura-build-sha",
    transformIndexHtml(html: string) {
      return html.replaceAll("__BUILD_SHA__", sha);
    },
  };
}

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

  return {
    base: basePath,
    plugins: [react(), buildShaPlugin(resolveBuildSha())],
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

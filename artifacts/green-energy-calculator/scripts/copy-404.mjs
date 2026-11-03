// VPUB-SEC: Render serves /404.html, with status 404, for any path that is not
// a file and matches no rewrite rule. The page is the app itself, so an unknown
// address still shows the app's own "not found" screen, but as a real 404
// instead of a 200 from a catch-all rewrite.
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../dist/public/", import.meta.url));
if (!existsSync(out + "index.html")) {
  console.error("copy-404: dist/public/index.html not found; run vite build first");
  process.exit(1);
}
copyFileSync(out + "index.html", out + "404.html");
console.log("copy-404: dist/public/404.html written");

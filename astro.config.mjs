import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";

const mode = process.env.NODE_ENV ?? "production";
const env = loadEnv(mode, process.cwd(), "");
const site = env.PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || "https://example.invalid";

export default defineConfig({
  output: "static",
  site,
  integrations: [
    sitemap({
      filter(page) {
        const pathname = new URL(page).pathname.replace(/\/$/, "") || "/";
        return pathname !== "/admin" && pathname !== "/404";
      },
    }),
  ],
});

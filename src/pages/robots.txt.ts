import type { APIRoute } from "astro";

function createRobotsTxt(site: URL): string {
  const sitemapUrl = new URL("sitemap-index.xml", site);

  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "",
    `Sitemap: ${sitemapUrl.href}`,
    "",
  ].join("\n");
}

export const GET: APIRoute = ({ site }) => {
  const safeSite = site ?? new URL("https://example.invalid");

  return new Response(createRobotsTxt(safeSite), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};

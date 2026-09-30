import { generateSitemaps } from "@/app/sitemap";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

// The sitemap index. Next's generateSitemaps() serves the chunks at
// /sitemap/<id>.xml but emits no index, and a route at app/sitemap.xml
// conflicts with the metadata convention (commit 89a72f9 removed one for that
// reason, leaving /sitemap.xml a 404 from 2026-07-07 to 2026-09-30 while
// robots.txt advertised it). This lives at /sitemap-index.xml and
// next.config.ts rewrites /sitemap.xml here before the filesystem is consulted.
// The ids come from the same generateSitemaps() the chunks use, so the index
// can never list a chunk that does not exist.
export async function GET() {
  const ids = await generateSitemaps();
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    ids.map(({ id }) => `  <sitemap><loc>${SITE_URL}/sitemap/${id}.xml</loc></sitemap>`).join("\n") +
    `\n</sitemapindex>\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

import { domain } from "@/lib/seo/site";
import { CACHE_HEADERS, xmlEscape } from "@/lib/seo/xml";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const lastmod = new Date().toISOString();
  const sitemaps = [
    `${domain}/sitemap-main.xml`,
    `${domain}/sitemap-features.xml`,
    `${domain}/sitemap-pages.xml`,
    `${domain}/sitemap-programmatic.xml`,
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map((loc) => `  <sitemap><loc>${xmlEscape(loc)}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join("\n")}
</sitemapindex>`;

  return new NextResponse(body, { headers: CACHE_HEADERS });
}

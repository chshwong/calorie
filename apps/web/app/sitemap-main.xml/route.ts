import { domain } from "@/lib/seo/site";
import { CACHE_HEADERS, xmlEscape } from "@/lib/seo/xml";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const lastmod = new Date().toISOString();
  const urls = [`${domain}/`];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `  <url><loc>${xmlEscape(loc)}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n")}
</urlset>`;

  return new NextResponse(body, { headers: CACHE_HEADERS });
}

import { MarketingFooter } from "@/components/MarketingFooter";
import { SeoJsonLd } from "@/components/SeoJsonLd";
import { faqPageJsonLd, webPageJsonLd } from "@/lib/seo/jsonld";
import {
    PROGRAMMATIC_PAGES,
    getProgrammaticPage,
    type ProgrammaticPage,
} from "@/lib/seo/programmatic";
import { domain } from "@/lib/seo/site";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return PROGRAMMATIC_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getProgrammaticPage(slug);
  if (!page) return { title: "Not Found" };
  const url = `${domain}/p/${slug}`;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: { url, title: page.title, description: page.description },
  };
}

function PageContent({ page, slug }: { page: ProgrammaticPage; slug: string }) {
  const schemas: object[] = [
    webPageJsonLd({
      name: page.title,
      description: page.description,
      url: `${domain}/p/${slug}`,
    }),
  ];
  if (page.faqs && page.faqs.length > 0) {
    schemas.push(faqPageJsonLd(page.faqs));
  }

  return (
    <>
      <SeoJsonLd schema={schemas} />
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <main
          style={{
            flex: 1,
            maxWidth: 720,
            margin: "0 auto",
            padding: "2rem 1rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.75rem", marginBottom: "1rem" }}>{page.h1}</h1>
          <p style={{ color: "#555", marginBottom: "1.5rem" }}>{page.description}</p>

          <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
            Why use AvoVibe
          </h2>
          <ul style={{ paddingLeft: "1.25rem", marginBottom: "1.5rem" }}>
            {page.benefits.map((b, i) => (
              <li key={i} style={{ marginBottom: "0.25rem" }}>
                {b}
              </li>
            ))}
          </ul>

          <p style={{ marginBottom: "1rem" }}>
            AvoVibe is a free calorie and macro tracker with no paywalls. You can log food,
            set daily targets for calories and macros, track protein and fiber, log water intake,
            and track weight over time. Everything is available without a premium subscription.
          </p>

          {page.faqs && page.faqs.length > 0 && (
            <>
              <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
                Frequently asked questions
              </h2>
              <ul style={{ listStyle: "none", padding: 0, marginBottom: "1.5rem" }}>
                {page.faqs.map((faq, i) => (
                  <li key={i} style={{ marginBottom: "1rem" }}>
                    <strong>{faq.question}</strong>
                    <p style={{ margin: "0.25rem 0 0", color: "#555" }}>{faq.answer}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p style={{ marginTop: "1.5rem" }}>
            <Link href="/" style={{ color: "#B8553F", fontWeight: 600 }}>
              Try AvoVibe →
            </Link>
          </p>
        </main>
        <MarketingFooter />
      </div>
    </>
  );
}

export default async function ProgrammaticPage({ params }: Props) {
  const { slug } = await params;
  const page = getProgrammaticPage(slug);
  if (!page) notFound();
  return <PageContent page={page} slug={slug} />;
}

import { MarketingFooter } from "@/components/MarketingFooter";
import { SeoJsonLd } from "@/components/SeoJsonLd";
import { softwareApplicationJsonLd } from "@/lib/seo/jsonld";
import { domain } from "@/lib/seo/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Protein Tracker",
  description:
    "Track protein intake daily. Free protein tracker with calorie and macro logging. No paywalls.",
  alternates: { canonical: `${domain}/protein-tracker` },
};

export default function ProteinTrackerPage() {
  const schema = softwareApplicationJsonLd({ url: `${domain}/protein-tracker` });
  return (
    <>
      <SeoJsonLd schema={schema} />
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
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Protein Tracker</h1>
          <p style={{ color: "#555", marginBottom: "1rem" }}>
            Hit your protein goals with a simple daily tracker. Free to use.
          </p>
          <p style={{ marginBottom: "1rem" }}>
            Log food and see protein per meal and per day. AvoVibe also tracks calories,
            carbs, fat, fiber, and water so you can manage nutrition in one place.
          </p>
          <Link href="/" style={{ color: "#B8553F", fontWeight: 600 }}>
            Open AvoVibe →
          </Link>
        </main>
        <MarketingFooter />
      </div>
    </>
  );
}

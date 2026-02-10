import { MarketingFooter } from "@/components/MarketingFooter";
import { SeoJsonLd } from "@/components/SeoJsonLd";
import { softwareApplicationJsonLd } from "@/lib/seo/jsonld";
import { domain } from "@/lib/seo/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Water Tracker",
  description:
    "Track water intake daily. Set a goal and log glasses or ml. Free water tracker with no paywalls.",
  alternates: { canonical: `${domain}/water-tracker` },
};

export default function WaterTrackerPage() {
  const schema = softwareApplicationJsonLd({ url: `${domain}/water-tracker` });
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
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Water Tracker</h1>
          <p style={{ color: "#555", marginBottom: "1rem" }}>
            Stay hydrated with a simple daily water tracker. Free to use.
          </p>
          <p style={{ marginBottom: "1rem" }}>
            Set your daily water goal and log intake with quick-add buttons. AvoVibe also
            tracks calories, macros, and weight in one app.
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

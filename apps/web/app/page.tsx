import { MarketingFooter } from "@/components/MarketingFooter";
import { SeoJsonLd } from "@/components/SeoJsonLd";
import { softwareApplicationJsonLd } from "@/lib/seo/jsonld";
import { descriptionDefault, domain, siteName } from "@/lib/seo/site";
import Link from "next/link";

export default function HomePage() {
  const schema = softwareApplicationJsonLd({ url: domain });
  return (
    <>
      <SeoJsonLd schema={schema} />
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <main style={{ flex: 1, maxWidth: 720, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{siteName}</h1>
          <p style={{ color: "#555", marginBottom: "1.5rem" }}>{descriptionDefault}</p>
          <p style={{ marginBottom: "1rem" }}>
            Track calories, macros, protein, fiber, and water with no paywalls. Simple, private, and free.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1.5rem" }}>
            <Link href="/login" style={{ color: "#B8553F", fontWeight: 600 }}>
              Open app →
            </Link>
            <Link href="/calorie-tracker" style={{ color: "#B8553F", fontWeight: 600 }}>
              Calorie Tracker
            </Link>
            <Link href="/about" style={{ color: "#B8553F", fontWeight: 600 }}>
              About
            </Link>
          </div>
        </main>
        <MarketingFooter />
      </div>
    </>
  );
}

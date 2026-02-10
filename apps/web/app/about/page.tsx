import { MarketingFooter } from "@/components/MarketingFooter";
import { domain } from "@/lib/seo/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About AvoVibe",
  description:
    "AvoVibe is a free calorie and macro tracker with no paywalls. Learn about our app and mission.",
  alternates: { canonical: `${domain}/about` },
};

export default function AboutPage() {
  return (
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
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>About AvoVibe</h1>
        <p style={{ color: "#555", marginBottom: "1rem" }}>
          AvoVibe is a free calorie and macro tracker for web and mobile.
        </p>

        <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
          What we do
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          We help you track calories, macros (protein, carbs, fat), fiber, and water intake
          without locking features behind a paywall. The app is designed to be simple and
          useful for everyday use.
        </p>

        <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
          Contact
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          For support or questions, visit our <Link href="/contact" style={{ color: "#B8553F" }}>contact page</Link>.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}

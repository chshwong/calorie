import { MarketingFooter } from "@/components/MarketingFooter";
import { domain } from "@/lib/seo/site";
import type { Metadata } from "next";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "avovibeapp@gmail.com";

export const metadata: Metadata = {
  title: "Contact AvoVibe",
  description:
    "Contact AvoVibe for support, feedback, or questions. We respond to all inquiries.",
  alternates: { canonical: `${domain}/contact` },
};

export default function ContactPage() {
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
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Contact AvoVibe</h1>
        <p style={{ color: "#555", marginBottom: "1rem" }}>
          Get in touch for support, feedback, or questions.
        </p>

        <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
          Email
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#B8553F" }}>
            {SUPPORT_EMAIL}
          </a>
        </p>

        <h2 style={{ fontSize: "1.25rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
          In-app support
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          If you use the app, you can also open support from the settings or help section
          inside the app for account-specific requests.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}

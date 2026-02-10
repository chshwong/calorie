import Link from "next/link";

const footerLinks = [
  { href: "/calorie-tracker", label: "Calorie Tracker" },
  { href: "/macro-tracker", label: "Macro Tracker" },
  { href: "/protein-tracker", label: "Protein Tracker" },
  { href: "/fiber-tracker", label: "Fiber Tracker" },
  { href: "/water-tracker", label: "Water Tracker" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/security", label: "Security" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function MarketingFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid #eee",
        padding: "1.5rem 1rem",
        marginTop: "auto",
        fontFamily: "system-ui, sans-serif",
        fontSize: "0.875rem",
      }}
    >
      <nav aria-label="Explore">
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            justifyContent: "center",
          }}
        >
          {footerLinks.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} style={{ color: "#555", textDecoration: "none" }}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p style={{ textAlign: "center", color: "#888", marginTop: "0.75rem" }}>
        © {new Date().getFullYear()} AvoVibe. Free calorie & macro tracker.
      </p>
    </footer>
  );
}

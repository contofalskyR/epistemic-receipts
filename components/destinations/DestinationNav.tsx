"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const DESTINATIONS = [
  { href: "/congress-trades", label: "Congress Trades" },
  { href: "/retraction-explorer", label: "Retraction Explorer" },
  { href: "/prereq-graph", label: "Evidence Chains" },
  { href: "/foreign-legislation", label: "Global Legislation" },
];

export function DestinationNav() {
  const pathname = usePathname();
  return (
    <nav
      style={{
        background: "#0e0e1c",
        borderBottom: "1px solid #1e1e38",
        padding: "0 2rem",
        display: "flex",
        alignItems: "center",
        gap: "2rem",
        height: "56px",
        position: "sticky",
        top: "48px",
        zIndex: 40,
      }}
    >
      <Link
        href="/"
        style={{
          color: "#f0a000",
          fontWeight: 700,
          fontSize: "1rem",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        ⬡ Epistemic Receipts
      </Link>
      <ul style={{ listStyle: "none", display: "flex", gap: 0, margin: 0, padding: 0 }}>
        {DESTINATIONS.map((d) => {
          const active = pathname === d.href || pathname.startsWith(d.href + "/");
          return (
            <li key={d.href}>
              <Link
                href={d.href}
                style={{
                  color: active ? "#f0a000" : "#888898",
                  textDecoration: "none",
                  fontSize: "0.85rem",
                  padding: "0.4rem 0.9rem",
                  borderRadius: "6px",
                  display: "block",
                  transition: "color 0.15s, background 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {d.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

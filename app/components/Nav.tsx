"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type NavItem = { href: string; label: string; desc?: string };

// Three product buckets. Every existing route is preserved here so nothing is lost —
// flagship destinations carry a one-line description; the long tail stays as plain links.
const GROUPS: { label: string; blurb: string; items: NavItem[] }[] = [
  {
    label: "Explore",
    blurb: "Browse the knowledge graph",
    items: [
      { href: "/settling-curve", label: "Settling Curve", desc: "How a claim settled — or unraveled — over time" },
      { href: "/globe", label: "Globe", desc: "Claims by country, on an animated timeline" },
      { href: "/search", label: "Search", desc: "Full-text across 1.6M claims" },
      { href: "/trajectories", label: "Trajectory Encyclopedia" },
      { href: "/claims", label: "Claims" },
      { href: "/topics", label: "Topics" },
      { href: "/fields", label: "Fields" },
      { href: "/timeline", label: "Timeline" },
      { href: "/historical-events", label: "Events" },
      { href: "/prereq-graph", label: "Evidence Chains" },
      { href: "/books", label: "Books" },
    ],
  },
  {
    label: "Analyze",
    blurb: "Quantitative views & politics",
    items: [
      { href: "/analysis/settling-rate", label: "Settling Rate", desc: "How fast knowledge settles, by decade and over time" },
      { href: "/analysis/representation", label: "Representation Gap", desc: "Constituent opinion vs. how they voted" },
      { href: "/congress-trades", label: "Congress Trades", desc: "Legislator trades vs. their voting record" },
      { href: "/stats", label: "Stats", desc: "Polarization, pass rates, party-line trends" },
      { href: "/analysis/votes", label: "Vote Analysis" },
      { href: "/analysis/topics", label: "Topic Trends" },
      { href: "/votes", label: "Browse Votes" },
      { href: "/members", label: "Members" },
      { href: "/legislation", label: "Legislation" },
      { href: "/foreign-legislation", label: "Global Legislation" },
      { href: "/financial", label: "Financial" },
      { href: "/stats/media-coverage", label: "Media Coverage" },
    ],
  },
  {
    label: "Discover",
    blurb: "What changed & where data comes from",
    items: [
      { href: "/retraction-explorer", label: "Retraction Explorer", desc: "26k+ retractions and who still cites them" },
      { href: "/feed", label: "What's New", desc: "Latest additions to the graph" },
      { href: "/retraction-wall", label: "Retraction Wall" },
      { href: "/drug-arc", label: "Drug Arc" },
      { href: "/opinions", label: "Court Opinions" },
      { href: "/sources", label: "Sources" },
      { href: "/datasets", label: "Datasets" },
      { href: "/pipelines", label: "Pipelines" },
      { href: "/bookmarks", label: "Bookmarks" },
      { href: "/glossary", label: "Glossary" },
      { href: "/about", label: "About" },
    ],
  },
];

function Dropdown({
  label,
  blurb,
  items,
  open,
  onOpen,
  onClose,
}: {
  label: string;
  blurb: string;
  items: NavItem[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button
        type="button"
        onClick={() => (open ? onClose() : onOpen())}
        className={`transition-colors ${open ? "text-white" : "text-gray-400 hover:text-white"}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {label} <span className="text-gray-600 text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-700 bg-gray-900 py-2 shadow-2xl">
          <div className="px-4 pb-2 mb-1 border-b border-gray-800">
            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">{blurb}</span>
          </div>
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              onClick={onClose}
              className="block px-4 py-1.5 hover:bg-gray-800 transition-colors group"
            >
              <span className="block text-sm text-gray-200 group-hover:text-white">{i.label}</span>
              {i.desc && (
                <span className="block text-xs text-gray-500 leading-snug">{i.desc}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Nav() {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <nav
      ref={navRef}
      className="border-b border-gray-800 px-6 py-3 text-sm sticky top-0 z-50 bg-gray-950/70 backdrop-blur"
    >
      <div className="hidden md:flex items-center gap-6">
        <Link href="/" className="font-semibold text-white">
          Epistemic Receipts
        </Link>
        {GROUPS.map((g) => (
          <Dropdown
            key={g.label}
            label={g.label}
            blurb={g.blurb}
            items={g.items}
            open={openGroup === g.label}
            onOpen={() => setOpenGroup(g.label)}
            onClose={() =>
              setOpenGroup((prev) => (prev === g.label ? null : prev))
            }
          />
        ))}
        <div className="flex-1" />
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-1.5 text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
        >
          <span className="text-gray-500">⌕</span> Search
        </Link>
      </div>

      <div className="md:hidden flex items-center justify-between">
        <Link href="/" className="font-semibold text-white">
          Epistemic Receipts
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          className="text-gray-300 hover:text-white text-xl leading-none px-2"
        >
          ☰
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden mt-3 flex flex-col border-t border-gray-800 pt-3">
          <Link
            href="/search"
            onClick={() => setMobileOpen(false)}
            className="block py-2 mb-1 text-gray-200 hover:text-white font-medium transition-colors"
          >
            ⌕ Search 1.6M claims
          </Link>
          {GROUPS.map((g) => (
            <div key={g.label} className="mt-3">
              <div className="text-xs uppercase tracking-wider text-gray-500 py-1.5">
                {g.label}
              </div>
              {g.items.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={() => setMobileOpen(false)}
                  className="block py-1.5 pl-3 text-gray-400 hover:text-white transition-colors"
                >
                  {i.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}

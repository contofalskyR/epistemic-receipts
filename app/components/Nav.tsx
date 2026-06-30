"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

type NavItem = { href: string; label: string; desc?: string };

const GROUPS: { label: string; blurb: string; items: NavItem[]; lab?: boolean }[] = [
  {
    label: "Explore",
    blurb: "Browse the knowledge graph",
    items: [
      { href: "/settling-curve", label: "Settling Curve", desc: "How a claim settled — or unraveled — over time" },
      { href: "/search", label: "Search", desc: "Full-text across 1.6M claims" },
      { href: "/trajectories", label: "Trajectory Encyclopedia" },
      { href: "/fields", label: "Topic Taxonomies" },
      { href: "/prereq-graph", label: "Evidence Chains" },
    ],
  },
  {
    label: "Analyze",
    blurb: "Quantitative views & politics",
    items: [
      { href: "/analysis/settling-rate", label: "Settling Rate", desc: "How fast knowledge settles, by decade and over time" },
      { href: "/congress-trades", label: "Congress Trades", desc: "Legislator trades vs. their voting record" },
      { href: "/votes", label: "Browse Votes" },
      { href: "/members", label: "Members" },
      { href: "/financial", label: "Financial" },
    ],
  },
  {
    label: "Discover",
    blurb: "Flagship destinations",
    items: [
      { href: "/retraction-explorer", label: "Retraction Explorer", desc: "26k+ retractions and who still cites them" },
      { href: "/opinions", label: "Court Opinions" },
      { href: "/law-settler", label: "Law Settler Curve" },
      { href: "/bookmarks", label: "Bookmarks" },
    ],
  },
  {
    label: "Research",
    blurb: "Data sources & reference",
    items: [
      { href: "/feed", label: "What's New", desc: "Latest additions to the graph" },
      { href: "/sources", label: "Sources", desc: "Provenance & methodology for every data pipeline" },
      { href: "/pipelines", label: "Pipelines" },
      { href: "/glossary", label: "Glossary" },
    ],
  },
  {
    label: "Lab",
    blurb: "In development — rough edges expected",
    lab: true,
    items: [
      { href: "/globe", label: "Globe" },
      { href: "/claims", label: "Claims" },
      { href: "/topics", label: "Topics" },
      { href: "/historical-events", label: "Events" },
      { href: "/books", label: "Books" },
      { href: "/stats/media-coverage", label: "Media Coverage" },
      { href: "/foreign-legislation", label: "Global Legislation" },
      { href: "/legislation", label: "Legislation" },
      { href: "/analysis/topics", label: "Topic Trends" },
      { href: "/analysis/votes", label: "Vote Analysis" },
      { href: "/stats", label: "Statistics" },
      { href: "/analysis/representation", label: "Representation" },
      { href: "/analysis/retraction-lag", label: "Retraction Lag" },
      { href: "/retraction-wall", label: "Retraction Wall" },
      { href: "/drug-arc", label: "Drug Arc" },
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
  lab = false,
}: {
  label: string;
  blurb: string;
  items: NavItem[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  lab?: boolean;
}) {
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    onOpen();
  }, [onOpen]);

  const handleMouseLeave = useCallback(() => {
    closeTimer.current = setTimeout(onClose, 180);
  }, [onClose]);

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        type="button"
        onClick={() => (open ? onClose() : onOpen())}
        className={`transition-colors ${open
          ? lab ? "text-amber-400" : "text-white"
          : lab ? "text-amber-600 hover:text-amber-400" : "text-gray-400 hover:text-white"
        }`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {lab && <span className="mr-1 text-[10px]">⚗</span>}
        {label} <span className={`text-xs ${lab ? "text-amber-800" : "text-gray-600"}`}>▾</span>
      </button>
      {open && (
        <div className={`absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border py-2 shadow-2xl ${
          lab
            ? "border-amber-900/50 bg-gray-950"
            : "border-gray-700 bg-gray-900"
        }`}>
          <div className={`px-4 pb-2 mb-1 border-b ${lab ? "border-amber-900/30" : "border-gray-800"}`}>
            <span className={`text-[10px] font-mono uppercase tracking-widest ${lab ? "text-amber-700" : "text-gray-500"}`}>{blurb}</span>
          </div>
          {lab && (
            <div className="px-4 py-1.5 mb-1">
              <span className="text-[10px] text-amber-700/70">Pages below are works-in-progress. Links work; polish does not.</span>
            </div>
          )}
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              onClick={onClose}
              className={`block px-4 py-1.5 transition-colors group ${lab ? "hover:bg-amber-950/30" : "hover:bg-gray-800"}`}
            >
              <span className={`block text-sm group-hover:text-white ${lab ? "text-amber-200/70" : "text-gray-200"}`}>{i.label}</span>
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
      if (e.button !== 0) return; // ignore right-click / middle-click
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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

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
            lab={g.lab}
            open={openGroup === g.label}
            onOpen={() => setOpenGroup(g.label)}
            onClose={() =>
              setOpenGroup((prev) => (prev === g.label ? null : prev))
            }
          />
        ))}
        <Link
          href="/about"
          className="text-gray-400 hover:text-white transition-colors"
        >
          About
        </Link>
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
        <div className="md:hidden mt-3 flex flex-col border-t border-gray-800 pt-3 overflow-y-auto" style={{ maxHeight: "calc(100dvh - 56px)" }}>
          <Link
            href="/search"
            onClick={() => setMobileOpen(false)}
            className="block py-2 mb-1 text-gray-200 hover:text-white font-medium transition-colors"
          >
            ⌕ Search 1.6M claims
          </Link>
          <Link
            href="/about"
            onClick={() => setMobileOpen(false)}
            className="block py-2 mb-1 text-gray-200 hover:text-white font-medium transition-colors"
          >
            About
          </Link>
          {GROUPS.map((g) => (
            <div key={g.label} className="mt-3">
              <div className={`text-xs uppercase tracking-wider py-1.5 ${g.lab ? "text-amber-700" : "text-gray-500"}`}>
                {g.lab && "⚗ "}{g.label}
              </div>
              {g.items.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block py-1.5 pl-3 hover:text-white transition-colors ${g.lab ? "text-amber-700/60" : "text-gray-400"}`}
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

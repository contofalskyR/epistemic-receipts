"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type NavItem = { href: string; label: string };

const PRIMARY: NavItem[] = [
  { href: "/search", label: "Search" },
  { href: "/globe", label: "Globe" },
  { href: "/fields", label: "Fields" },
  { href: "/legislation", label: "Legislation" },
  { href: "/stats", label: "Stats" },
  { href: "/datasets", label: "Datasets" },
];

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Explore",
    items: [
      { href: "/claims", label: "Claims" },
      { href: "/topics", label: "Topics" },
      { href: "/timeline", label: "Timeline" },
      { href: "/historical-events", label: "Events" },
      { href: "/settling-curve", label: "Settling Curve" },
      { href: "/drug-arc", label: "Drug Arc" },
      { href: "/opinions", label: "Court Opinions" },
      { href: "/retraction-wall", label: "Retraction Wall" },
      { href: "/prereq-graph", label: "Evidence Chains" },
      { href: "/foreign-legislation", label: "Global Legislation" },
      { href: "/retractions", label: "Retraction API" },
      { href: "/bookmarks", label: "Bookmarks" },
      { href: "/books", label: "Books" },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/votes", label: "Browse Votes" },
      { href: "/members", label: "Members" },
      { href: "/analysis/votes", label: "Analysis" },
      { href: "/analysis/topics", label: "Topic Trends" },
      { href: "/analysis/representation", label: "Representation" },
      { href: "/stats/media-coverage", label: "Media Coverage" },
      { href: "/financial", label: "Financial" },
      { href: "/congress-trades", label: "Congress Trades" },
      { href: "/retraction-explorer", label: "Retraction Explorer" },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/feed", label: "What's New" },
      { href: "/about", label: "About" },
      { href: "/glossary", label: "Glossary" },
      { href: "/feedback", label: "Feedback" },
      { href: "/pipelines", label: "Pipelines" },
      { href: "/edges", label: "Edges" },
      { href: "/meta-edges", label: "Meta-edges" },
      { href: "/review", label: "Review" },
    ],
  },
];

function Dropdown({
  label,
  items,
  open,
  onOpen,
  onClose,
}: {
  label: string;
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
        className="text-gray-400 hover:text-white transition-colors"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {label} ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 min-w-[10rem] rounded-md border border-gray-700 bg-gray-900 py-1 shadow-lg">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              onClick={onClose}
              className="block py-1.5 px-4 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              {i.label}
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
        {PRIMARY.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {i.label}
          </Link>
        ))}
        {GROUPS.map((g) => (
          <Dropdown
            key={g.label}
            label={g.label}
            items={g.items}
            open={openGroup === g.label}
            onOpen={() => setOpenGroup(g.label)}
            onClose={() =>
              setOpenGroup((prev) => (prev === g.label ? null : prev))
            }
          />
        ))}
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
          {PRIMARY.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              onClick={() => setMobileOpen(false)}
              className="block py-1.5 text-gray-300 hover:text-white transition-colors"
            >
              {i.label}
            </Link>
          ))}
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

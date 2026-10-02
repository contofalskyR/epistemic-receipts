"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isPublicRoute } from "@/lib/publicEdition";

// ─── The front door ──────────────────────────────────────────────────────────
// Six flat links + About (STATUS.md, locked 2026-09-30; AUDIT.md §D). Every
// other public page is surfaced from the homepage and /settling-curve;
// Methodology, Corrections and legal live in the footer (app/layout.tsx).
// `hard`: a plain <a> (full page load), not a client <Link>. /retraction-explorer
// is ISR, and once it has been opened with a query string the client router
// keeps a route-cache entry from hydration that points at that query for the
// 300 s static stale time — a <Link> there landed back on ?q=… (front door
// phase 6; replaceState-on-mount and prefetch={false} cannot clear it).
type NavLink = { href: string; label: string; hard?: boolean };

const TOP_LINKS: NavLink[] = [
  { href: "/settling-curve", label: "Settling Curve" },
  { href: "/search", label: "Search" },
  { href: "/opinions", label: "Opinions" },
  { href: "/retraction-explorer", label: "Retractions", hard: true },
  { href: "/split-ledger", label: "Split Ledger" },
  { href: "/reversals", label: "Reversals" },
];

// ─── The Lab ─────────────────────────────────────────────────────────────────
// One deployment: every page not on the public list (lib/publicEdition.ts) is
// Lab. middleware.ts answers anonymous requests for them with the login gate,
// and this group renders only once GET /api/login confirms the admin session —
// so nav and middleware can never disagree about what is reachable.
type LabSection = { label: string; items: NavLink[] };

const LAB_SECTIONS: LabSection[] = [
  {
    label: "Explore",
    items: [
      { href: "/claims", label: "Claims" },
      { href: "/topics", label: "Topics" },
      { href: "/fields", label: "Topic Taxonomies" },
      { href: "/prereq-graph", label: "Evidence Chains" },
      { href: "/settling-curve/coverage", label: "Coverage" },
      { href: "/settling-curve/overview", label: "Overview" },
    ],
  },
  {
    label: "Analyze",
    items: [
      { href: "/analysis/settling-rate", label: "Settling Rate" },
      { href: "/congress-trades", label: "Congress Trades" },
      { href: "/votes", label: "Browse Votes" },
      { href: "/members", label: "Members" },
      { href: "/financial", label: "Financial" },
      { href: "/analysis/topics", label: "Topic Trends" },
      { href: "/analysis/votes", label: "Vote Analysis" },
      { href: "/analysis/ideology", label: "Ideology (DW-NOMINATE)" },
      { href: "/analysis/representation", label: "Representation" },
      { href: "/analysis/retraction-lag", label: "Retraction Lag" },
      { href: "/stats", label: "Statistics" },
      { href: "/stats/media-coverage", label: "Media Coverage" },
      { href: "/statistics", label: "Statistical Methods" },
    ],
  },
  {
    label: "Discover",
    items: [
      { href: "/meta-edges", label: "Suppression & Amplification" },
      { href: "/retraction-wall", label: "Retraction Wall" },
      { href: "/retractions", label: "Retraction Feeds" },
    ],
  },
  {
    label: "Research",
    items: [
      { href: "/feed", label: "What's New" },
      { href: "/pipelines", label: "Pipelines" },
      { href: "/globe", label: "Globe" },
      { href: "/historical-events", label: "Events" },
      { href: "/legislation", label: "Legislation" },
      { href: "/drug-arc", label: "Drug Arc" },
      { href: "/books", label: "Books" },
    ],
  },
];

// A Lab link that has since been published belongs in TOP_LINKS or on a page,
// not here — keep the group honest by construction.
const LAB_VISIBLE: LabSection[] = LAB_SECTIONS.map((s) => ({
  ...s,
  items: s.items.filter((i) => !isPublicRoute(i.href)),
})).filter((s) => s.items.length > 0);

function LabDropdown({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
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
        className={`transition-colors ${open ? "text-amber-400" : "text-amber-600 hover:text-amber-400"}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="mr-1 text-[10px]">⚗</span>
        Lab <span className="text-xs text-amber-800">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[40rem] max-w-[90vw] rounded-lg border border-amber-900/50 bg-gray-950 py-3 shadow-2xl">
          <div className="px-4 pb-2 mb-1 border-b border-amber-900/30">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-700">
              In development — rough edges expected · admin session only
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 px-2 sm:grid-cols-4">
            {LAB_VISIBLE.map((s) => (
              <div key={s.label} className="py-1">
                <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-widest text-gray-500">{s.label}</div>
                {s.items.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    onClick={onClose}
                    className="block rounded px-2 py-1 text-[13px] text-amber-200/70 transition-colors hover:bg-amber-950/30 hover:text-white"
                  >
                    {i.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Is this browser holding the admin session? The cookie is httpOnly, so ask
 * GET /api/login (one bit, no DB). Defaults to "no" — the Lab group is hidden
 * until the probe says otherwise, never the other way round.
 */
function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    let cancelled = false;
    fetch("/api/login", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { admin: false }))
      .then((d) => { if (!cancelled) setAdmin(d?.admin === true); })
      .catch(() => { if (!cancelled) setAdmin(false); });
    return () => { cancelled = true; };
    // Re-probe on navigation so logging in at /login shows the group on the next page.
  }, [pathname]);
  return admin;
}

/** `claimsCompact` is the derived corpus figure ("1.76M") from app/layout.tsx. */
export default function Nav({ claimsCompact }: { claimsCompact: string }) {
  const [labOpen, setLabOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const isAdmin = useIsAdmin();

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (e.button !== 0) return; // ignore right-click / middle-click
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setLabOpen(false);
        setMobileOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLabOpen(false);
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
        {TOP_LINKS.map((l) =>
          l.hard ? (
            <a key={l.href} href={l.href} className="text-gray-400 hover:text-white transition-colors">
              {l.label}
            </a>
          ) : (
            <Link key={l.href} href={l.href} className="text-gray-400 hover:text-white transition-colors">
              {l.label}
            </Link>
          ),
        )}
        <Link href="/about" className="text-gray-400 hover:text-white transition-colors">
          About
        </Link>
        <div className="flex-1" />
        {isAdmin && (
          <LabDropdown open={labOpen} onOpen={() => setLabOpen(true)} onClose={() => setLabOpen(false)} />
        )}
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
            ⌕ Search {claimsCompact} claims
          </Link>
          {TOP_LINKS.filter((l) => l.href !== "/search").map((l) =>
            l.hard ? (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block py-2 text-gray-300 hover:text-white transition-colors"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block py-2 text-gray-300 hover:text-white transition-colors"
              >
                {l.label}
              </Link>
            ),
          )}
          <Link
            href="/about"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-gray-300 hover:text-white transition-colors"
          >
            About
          </Link>
          {isAdmin && LAB_VISIBLE.map((s) => (
            <div key={s.label} className="mt-3">
              <div className="text-xs uppercase tracking-wider py-1.5 text-amber-700">
                ⚗ Lab · {s.label}
              </div>
              {s.items.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={() => setMobileOpen(false)}
                  className="block py-1.5 pl-3 text-amber-700/60 hover:text-white transition-colors"
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

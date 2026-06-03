"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Region = "Americas" | "Europe" | "Asia-Pacific" | "Africa";
type SpecialView = "us" | "ca" | "nz";
type Outcome = "enacted" | "passed" | "vetoed" | "failed" | "active";
type View = "status" | "outcomes" | "full";

const REGIONS: Region[] = ["Americas", "Europe", "Asia-Pacific", "Africa"];

type BillHit = {
  id: string;
  title: string;
  body: string | null;
  status: string | null;
  billType: string | null;
  billNumber: string | null;
  congress: number | null;
  sourceUrl: string | null;
  introducedDate: string | null;
  updatedAt: string;
  latestActionDate: string | null;
  latestActionText: string | null;
  outcome: Outcome;
  billId: string | null;
  lawType: string | null;
  introducedIn: string | null;
  yearOnly: boolean;
};

type CountryListEntry = {
  code: string;
  label: string;
  flag: string;
  region: Region;
  sourceLabel: string;
  specialView: SpecialView | null;
  count: number;
};

type CountryPayloadEntry = {
  code: string;
  label: string;
  flag: string;
  region: Region;
  sourceLabel: string;
  specialView: SpecialView | null;
};

type BillsResponse = {
  bills: BillHit[];
  total: number;
  page: number;
  limit: number;
  lastRefresh: string | null;
  outcomeCounts?: Record<Outcome, number>;
  countries?: CountryPayloadEntry[];
};

const PAGE_SIZE = 25;
const FULL_PAGE_SIZE = 50;

const CA_STATUSES = [
  { value: "all", label: "All" },
  { value: "in-parliament", label: "In Parliament" },
  { value: "royal-assent", label: "Royal Assent" },
] as const;

const NZ_STATUSES = [
  { value: "all", label: "All" },
  { value: "bills", label: "Bills" },
  { value: "acts", label: "Acts In Force" },
] as const;

const COUNTRY_STATUS_OPTIONS: Record<string, readonly { value: string; label: string }[]> = {
  in: [
    { value: "all", label: "All" },
    { value: "assented", label: "Assented" },
    { value: "other", label: "Other" },
  ],
};

const VIEWS: { value: View; label: string; description: string }[] = [
  { value: "status", label: "By Status", description: "Filter by current bill status" },
  { value: "outcomes", label: "Terminal Outcomes", description: "Bills that reached enacted, vetoed, or failed" },
  { value: "full", label: "Full 119th Record", description: "Every tracked bill, grouped by outcome" },
];

const STATUSES = [
  { value: "all", label: "All" },
  { value: "status-introduced", label: "Introduced" },
  { value: "status-in-progress", label: "In Progress" },
  { value: "status-passed-house", label: "Passed House" },
  { value: "status-passed-senate", label: "Passed Senate" },
  { value: "status-enacted", label: "Enacted" },
  { value: "status-vetoed", label: "Vetoed" },
  { value: "status-failed", label: "Failed" },
] as const;

const TYPES = [
  { value: "all", label: "All types" },
  { value: "hr", label: "House Bills (HR)" },
  { value: "s", label: "Senate Bills (S)" },
  { value: "hjres", label: "Joint Resolutions (HJRES)" },
  { value: "sjres", label: "Joint Resolutions (SJRES)" },
  { value: "hres", label: "House Resolutions" },
  { value: "sres", label: "Senate Resolutions" },
] as const;

const STATUS_STYLE: Record<string, string> = {
  "status-enacted": "bg-green-950 text-green-400 border border-green-900/50",
  "status-passed-house": "bg-blue-950 text-blue-300 border border-blue-900/50",
  "status-passed-senate": "bg-blue-950 text-blue-300 border border-blue-900/50",
  "status-in-progress": "bg-yellow-950 text-yellow-400 border border-yellow-900/50",
  "status-introduced": "bg-gray-800 text-gray-400 border border-gray-700/50",
  "status-vetoed": "bg-red-950 text-red-400 border border-red-900/50",
  "status-failed": "bg-gray-800 text-gray-500 border border-gray-700/50",
};

const STATUS_LABEL: Record<string, string> = {
  "status-enacted": "Enacted",
  "status-passed-house": "Passed House",
  "status-passed-senate": "Passed Senate",
  "status-in-progress": "In Progress",
  "status-introduced": "Introduced",
  "status-vetoed": "Vetoed",
  "status-failed": "Failed",
};

const FOREIGN_STATUS_STYLE = "bg-gray-800 text-gray-400 border border-gray-700/50";

const OUTCOME_LABEL: Record<Outcome, string> = {
  enacted: "Enacted",
  passed: "Passed",
  vetoed: "Vetoed",
  failed: "Failed",
  active: "Still Active",
};

const OUTCOME_BADGE_STYLE: Record<Outcome, string> = {
  enacted: "bg-green-950/60 text-green-300 border border-green-800/60",
  passed: "bg-blue-950/60 text-blue-300 border border-blue-800/60",
  vetoed: "bg-red-950/60 text-red-300 border border-red-800/60",
  failed: "bg-gray-900 text-gray-400 border border-gray-700",
  active: "bg-yellow-950/40 text-yellow-300 border border-yellow-900/40",
};

const OUTCOME_OUTCOME_PROMINENT: Record<Outcome, string> = {
  enacted: "text-green-400",
  passed: "text-blue-300",
  vetoed: "text-red-400",
  failed: "text-gray-400",
  active: "text-yellow-300",
};

const OUTCOME_ORDER: Outcome[] = ["enacted", "passed", "vetoed", "failed", "active"];

const TYPE_LABEL: Record<string, string> = {
  hr: "H.R.",
  s: "S.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
  hres: "H.Res.",
  sres: "S.Res.",
  hconres: "H.Con.Res.",
  sconres: "S.Con.Res.",
};

const SPECIAL_DESCRIPTIONS: Record<SpecialView, { eyebrow: string; title: string; description: string }> = {
  us: {
    eyebrow: "Congress Tracker",
    title: "119th Congress",
    description:
      "Live bill status — sourced from congress.gov. Filter by status, chamber, or search by title or bill number.",
  },
  ca: {
    eyebrow: "Canadian Parliament",
    title: "Bills & Royal Assent",
    description:
      "Live parliamentary bill tracker — current session and historical enacted laws since 35th Parliament (1994). Sourced from LEGISinfo.",
  },
  nz: {
    eyebrow: "New Zealand Parliament",
    title: "Acts and Bills",
    description:
      "Public Acts currently in force and bills before Parliament. Sourced from the Parliamentary Counsel Office legislation API.",
  },
};

function truncate(text: string, n: number): string {
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + "…";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function formatYear(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 4);
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "unknown";
  const diff = Date.now() - t;
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseView(raw: string | null): View {
  if (raw === "outcomes" || raw === "full") return raw;
  return "status";
}

function parseRegion(raw: string | null): Region {
  if (raw === "Europe" || raw === "Asia-Pacific" || raw === "Africa" || raw === "Americas") return raw;
  return "Americas";
}

export default function LegislationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [registry, setRegistry] = useState<CountryListEntry[] | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);

  // Fetch country registry with claim counts on mount.
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/legislation?list=1", { signal: ctrl.signal })
      .then(async r => {
        if (!r.ok) throw new Error(`Registry load failed (${r.status})`);
        return (await r.json()) as { countries: CountryListEntry[] };
      })
      .then(d => setRegistry(d.countries))
      .catch(err => {
        if (err.name === "AbortError") return;
        setRegistryError(err.message || "Failed to load country list");
      });
    return () => ctrl.abort();
  }, []);

  const urlCountryRaw = (searchParams.get("country") ?? "us").toLowerCase();
  const countryEntry = registry?.find(c => c.code === urlCountryRaw) ?? null;
  const urlCountry = countryEntry?.code ?? urlCountryRaw;
  const specialView = countryEntry?.specialView ?? null;

  const urlView = specialView === "us" ? parseView(searchParams.get("view")) : "status";
  const urlStatus = searchParams.get("status") ?? "all";
  const urlType = specialView === "us" ? (searchParams.get("type") ?? "all") : "all";
  const urlQ = searchParams.get("q") ?? "";
  const urlPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const urlRegion: Region = parseRegion(searchParams.get("region") ?? (countryEntry?.region ?? null));

  const pageSize = urlView === "full" ? FULL_PAGE_SIZE : PAGE_SIZE;

  const [input, setInput] = useState(urlQ);
  const [countryFilter, setCountryFilter] = useState("");
  const [data, setData] = useState<BillsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setInput(urlQ);
  }, [urlQ]);

  const pushUrl = useCallback(
    (overrides: Partial<{ country: string; region: Region; view: View; status: string; type: string; q: string; page: number }>) => {
      const next = new URLSearchParams(searchParams.toString());

      if (overrides.country !== undefined) {
        if (overrides.country === "us") next.delete("country");
        else next.set("country", overrides.country);
        next.delete("view");
        next.delete("status");
        next.delete("type");
        next.delete("page");
      }

      if (overrides.region !== undefined) {
        if (overrides.region === "Americas") next.delete("region");
        else next.set("region", overrides.region);
      }

      if (overrides.view !== undefined) {
        if (overrides.view === "status") next.delete("view");
        else next.set("view", overrides.view);
      }
      if (overrides.status !== undefined) {
        if (overrides.status === "all") next.delete("status");
        else next.set("status", overrides.status);
      }
      if (overrides.type !== undefined) {
        if (overrides.type === "all") next.delete("type");
        else next.set("type", overrides.type);
      }
      if (overrides.q !== undefined) {
        if (overrides.q) next.set("q", overrides.q);
        else next.delete("q");
      }
      if (overrides.page !== undefined) {
        if (overrides.page > 1) next.set("page", String(overrides.page));
        else next.delete("page");
      }
      const qs = next.toString();
      router.replace(qs ? `/legislation?${qs}` : "/legislation");
    },
    [router, searchParams],
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const p = new URLSearchParams();
    if (urlCountry !== "us") p.set("country", urlCountry);
    if (urlQ) p.set("q", urlQ);
    if (specialView === "us") {
      if (urlView === "outcomes") {
        p.set("status", "terminal");
      } else if (urlView === "full") {
        p.set("view", "full");
      } else if (urlStatus !== "all") {
        p.set("status", urlStatus);
      }
      if (urlType !== "all") p.set("type", urlType);
    } else if (
      urlStatus !== "all" &&
      (specialView === "ca" || specialView === "nz" || COUNTRY_STATUS_OPTIONS[urlCountry])
    ) {
      p.set("status", urlStatus);
    }
    p.set("page", String(urlPage));
    p.set("limit", String(pageSize));
    fetch(`/api/legislation?${p.toString()}`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return (await r.json()) as BillsResponse;
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load bills");
        setLoading(false);
      });
    return () => controller.abort();
  }, [urlCountry, urlView, urlQ, urlStatus, urlType, urlPage, pageSize, specialView]);

  function onInputChange(v: string) {
    setInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushUrl({ q: v.trim(), page: 1 });
    }, 300);
  }

  const filteredCountries = useMemo(() => {
    if (!registry) return [];
    const term = countryFilter.trim().toLowerCase();
    const inRegion = registry.filter(c => c.region === urlRegion);
    if (!term) return inRegion;
    return inRegion.filter(c =>
      c.label.toLowerCase().includes(term) || c.code.toLowerCase() === term,
    );
  }, [registry, urlRegion, countryFilter]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (urlPage - 1) * pageSize + 1;
  const showingTo = Math.min(total, (urlPage - 1) * pageSize + (data?.bills.length ?? 0));

  const eyebrow = specialView
    ? SPECIAL_DESCRIPTIONS[specialView].eyebrow
    : countryEntry
      ? `${countryEntry.region} · Legislation`
      : "Legislation";
  const title = specialView
    ? SPECIAL_DESCRIPTIONS[specialView].title
    : countryEntry?.label ?? "Loading…";
  const description = specialView
    ? SPECIAL_DESCRIPTIONS[specialView].description
    : countryEntry
      ? `Enacted laws and bills tracked from ${countryEntry.sourceLabel}.`
      : "";

  return (
    <div className="space-y-6">
      {/* Region tabs */}
      <div className="flex items-center gap-1 border-b border-gray-800 overflow-x-auto">
        {REGIONS.map(r => {
          const active = urlRegion === r;
          const regionCount = registry?.filter(c => c.region === r).length ?? 0;
          return (
            <button
              key={r}
              onClick={() => pushUrl({ region: r })}
              className={`text-sm px-3 py-2 border-b-2 transition-colors -mb-px whitespace-nowrap ${
                active
                  ? "border-white text-white font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {r} <span className="text-gray-600 font-mono text-xs ml-1">{regionCount}</span>
            </button>
          );
        })}
      </div>

      {/* Country grid */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            placeholder="Filter countries…"
            className="flex-1 bg-gray-900 border border-gray-700 text-gray-100 text-xs rounded px-3 py-1.5 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
          />
          <span className="text-xs text-gray-600 font-mono">
            {filteredCountries.length}/{registry?.filter(c => c.region === urlRegion).length ?? 0}
          </span>
        </div>

        {registryError && (
          <p className="text-xs text-red-400">{registryError}</p>
        )}

        {!registry && !registryError && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 rounded border border-gray-800 bg-gray-900 animate-pulse" />
            ))}
          </div>
        )}

        {registry && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
            {filteredCountries.map(c => {
              const active = c.code === urlCountry;
              const hasData = c.count > 0;
              return (
                <button
                  key={c.code}
                  onClick={() => pushUrl({ country: c.code, page: 1 })}
                  className={`flex items-center gap-2 text-left rounded border px-3 py-2 transition-colors ${
                    active
                      ? "border-white bg-gray-800 text-white"
                      : hasData
                        ? "border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 hover:text-white"
                        : "border-gray-800 bg-gray-900/40 text-gray-500 hover:border-gray-700"
                  }`}
                >
                  <span className="text-base shrink-0">{c.flag}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs truncate">{c.label}</span>
                    <span className="block text-[10px] font-mono text-gray-500">
                      {c.count.toLocaleString()} {c.count === 1 ? "claim" : "claims"}
                    </span>
                  </span>
                </button>
              );
            })}
            {filteredCountries.length === 0 && registry && (
              <p className="text-xs text-gray-500 col-span-full px-2 py-3">
                No countries match the filter.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Header */}
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold text-white flex items-center gap-2">
          {countryEntry && <span>{countryEntry.flag}</span>}
          <span>{title}</span>
        </h1>
        {description && (
          <p className="mt-2 text-gray-400 max-w-2xl text-sm leading-relaxed">{description}</p>
        )}
      </div>

      {/* Live tracker banner — US + Canada */}
      {specialView === "us" && (
        <AutoUpdateBanner
          lastRefresh={data?.lastRefresh ?? null}
          sourceLabel="Congress.gov API"
          sourceUrl="https://api.congress.gov/"
        />
      )}
      {specialView === "ca" && (
        <AutoUpdateBanner
          lastRefresh={data?.lastRefresh ?? null}
          sourceLabel="LEGISinfo API"
          sourceUrl="https://www.parl.ca/LegisInfo/en/overview"
        />
      )}

      {/* View tabs — US only */}
      {specialView === "us" && (
        <div className="flex items-center gap-1 border-b border-gray-800">
          {VIEWS.map(v => {
            const active = urlView === v.value;
            return (
              <button
                key={v.value}
                onClick={() => pushUrl({ view: v.value, page: 1 })}
                title={v.description}
                className={`text-xs px-3 py-2 border-b-2 transition-colors -mb-px ${
                  active
                    ? "border-white text-white font-medium"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      )}

      {specialView === "us" && urlView === "outcomes" && (
        <p className="text-xs text-gray-500 leading-relaxed">
          Bills that have reached a terminal state — signed into law, vetoed, or formally failed. Sorted by the date they
          were introduced (most recent first); the final-action date is shown alongside the outcome.
        </p>
      )}

      {specialView === "us" && urlView === "full" && data?.outcomeCounts && (() => {
        const counts = data.outcomeCounts;
        return (
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span className="text-gray-600 uppercase tracking-widest">Outcome counts</span>
            {OUTCOME_ORDER.map(o => (
              <span key={o} className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${
                  o === "enacted" ? "bg-green-500" :
                  o === "passed" ? "bg-blue-400" :
                  o === "vetoed" ? "bg-red-500" :
                  o === "failed" ? "bg-gray-400" :
                  "bg-yellow-400"
                }`} />
                <span className="text-gray-400">{OUTCOME_LABEL[o]}</span>
                <span className="font-mono text-gray-500">{counts[o].toLocaleString()}</span>
              </span>
            ))}
          </div>
        );
      })()}

      {/* Filters */}
      <div className="space-y-3">
        <input
          type="text"
          value={input}
          onChange={e => onInputChange(e.target.value)}
          placeholder={
            specialView === "us"
              ? "Search by title or bill number…"
              : specialView === "ca"
                ? "Search by title or bill number…"
                : "Search by title…"
          }
          className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
        />

        {/* Status filter chips — US only, status view only */}
        {specialView === "us" && urlView === "status" && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 uppercase tracking-widest mr-1">Status</span>
            {STATUSES.map(s => {
              const active = urlStatus === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => pushUrl({ status: s.value, page: 1 })}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    active
                      ? "bg-white text-gray-950 border-white font-medium"
                      : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Foreign-country status chips — CA/NZ + per-country (e.g. India) */}
        {(() => {
          const options =
            specialView === "ca"
              ? CA_STATUSES
              : specialView === "nz"
                ? NZ_STATUSES
                : COUNTRY_STATUS_OPTIONS[urlCountry] ?? null;
          if (!options) return null;
          return (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 uppercase tracking-widest mr-1">Status</span>
              {options.map(s => {
                const active = urlStatus === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => pushUrl({ status: s.value, page: 1 })}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      active
                        ? "bg-white text-gray-950 border-white font-medium"
                        : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* Type filter — US only */}
        {specialView === "us" && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 uppercase tracking-widest mr-1">Type</span>
            <select
              value={urlType}
              onChange={e => pushUrl({ type: e.target.value, page: 1 })}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-gray-500 transition-colors"
            >
              {TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && !data && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 animate-pulse"
            >
              <div className="h-3 w-2/3 bg-gray-800 rounded" />
              <div className="mt-2 h-2 w-1/2 bg-gray-800/60 rounded" />
              <div className="mt-3 flex gap-2">
                <div className="h-4 w-16 bg-gray-800 rounded-full" />
                <div className="h-4 w-12 bg-gray-800 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {data && !error && (
        <>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {total === 0
                ? specialView
                  ? "No matching results"
                  : "No data yet — ingesting…"
                : `Showing ${showingFrom.toLocaleString()}–${showingTo.toLocaleString()} of ${total.toLocaleString()}`}
            </span>
            {loading && <span className="text-gray-600">Refreshing…</span>}
          </div>

          {total === 0 && !urlQ && urlStatus === "all" && urlType === "all" && urlView === "status" ? (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-6 py-12 text-center">
              <p className="text-sm text-gray-400">
                {specialView === "us"
                  ? "Bills are being indexed. Check back soon."
                  : countryEntry
                    ? `No data yet for ${countryEntry.label} — the ingester is running in the background.`
                    : "No records available yet. Check back soon."}
              </p>
            </div>
          ) : specialView === "us" && urlView === "full" ? (
            <FullRecordList bills={data.bills} specialView={specialView} sourceLabel={countryEntry?.sourceLabel ?? null} />
          ) : (
            <div className="space-y-2">
              {data.bills.map(b => (
                <BillRow
                  key={b.id}
                  bill={b}
                  prominentOutcome={specialView === "us" && urlView === "outcomes"}
                  specialView={specialView}
                  sourceLabel={countryEntry?.sourceLabel ?? null}
                />
              ))}
            </div>
          )}

          {total > pageSize && (
            <div className="flex items-center gap-3 text-xs text-gray-500 pt-2">
              <button
                onClick={() => pushUrl({ page: Math.max(1, urlPage - 1) })}
                disabled={urlPage <= 1}
                className="hover:text-gray-300 disabled:opacity-30 transition-colors"
              >
                ← Previous
              </button>
              <span className="text-gray-700">·</span>
              <span>
                Page {urlPage.toLocaleString()} of {pageCount.toLocaleString()}
              </span>
              <span className="text-gray-700">·</span>
              <button
                onClick={() => pushUrl({ page: urlPage + 1 })}
                disabled={urlPage >= pageCount}
                className="hover:text-gray-300 disabled:opacity-30 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AutoUpdateBanner({
  lastRefresh,
  sourceLabel,
  sourceUrl,
}: {
  lastRefresh: string | null;
  sourceLabel: string;
  sourceUrl: string;
}) {
  return (
    <div className="rounded-md border border-gray-800 bg-gray-900/40 px-3 py-2 flex items-center gap-3 text-xs">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <span className="text-gray-300">
        <span className="text-gray-100 font-medium">Live tracker</span>
        <span className="text-gray-500"> — auto-refreshes every 12 hours from the </span>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline"
        >
          {sourceLabel}
        </a>
        <span className="text-gray-500">.</span>
      </span>
      <span className="ml-auto font-mono text-gray-500 shrink-0">
        Last pull: {formatRelative(lastRefresh)}
      </span>
    </div>
  );
}

function FullRecordList({
  bills,
  specialView,
  sourceLabel,
}: {
  bills: BillHit[];
  specialView: SpecialView | null;
  sourceLabel: string | null;
}) {
  const grouped = OUTCOME_ORDER.map(outcome => ({
    outcome,
    bills: bills.filter(b => b.outcome === outcome),
  })).filter(g => g.bills.length > 0);

  if (grouped.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-6 py-12 text-center">
        <p className="text-sm text-gray-400">No bills on this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(g => (
        <div key={g.outcome} className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
            <span className={`font-semibold ${OUTCOME_OUTCOME_PROMINENT[g.outcome]}`}>
              {OUTCOME_LABEL[g.outcome]}
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-gray-500 font-mono">{g.bills.length}</span>
          </div>
          <div className="space-y-2">
            {g.bills.map(b => (
              <BillRow
                key={b.id}
                bill={b}
                prominentOutcome
                specialView={specialView}
                sourceLabel={sourceLabel}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BillRow({
  bill,
  prominentOutcome,
  specialView,
  sourceLabel,
}: {
  bill: BillHit;
  prominentOutcome?: boolean;
  specialView: SpecialView | null;
  sourceLabel: string | null;
}) {
  const status = bill.status ?? "status-introduced";
  const isUsStatus = status.startsWith("status-");
  const statusStyle = isUsStatus
    ? (STATUS_STYLE[status] ?? STATUS_STYLE["status-introduced"]!)
    : FOREIGN_STATUS_STYLE;
  const statusLabel = STATUS_LABEL[status] ?? status ?? "Unknown";

  // Bill reference chip
  let billRef: string | null = null;
  if (specialView === "us") {
    const typeLabel = bill.billType ? TYPE_LABEL[bill.billType] ?? bill.billType.toUpperCase() : null;
    billRef = typeLabel && bill.billNumber ? `${typeLabel} ${bill.billNumber}` : null;
  } else if (specialView === "ca" || specialView === "nz") {
    billRef = bill.billNumber ?? null;
  } else {
    billRef = bill.billId ?? bill.billNumber ?? null;
  }

  const outcome = bill.outcome;
  const showOutcomeBadge = prominentOutcome && outcome !== "active";
  const linkLabel = sourceLabel ?? "source";
  const isSpecial = specialView !== null;
  const isGeneric = specialView === null;

  // For generic foreign countries, show status badge whenever status data exists.
  const showGenericStatusBadge = isGeneric && !!bill.status;
  // Avoid duplicating the badge in lawType chip when both equal status.
  const lawTypeChip = isGeneric && bill.lawType && bill.lawType !== bill.status ? bill.lawType : null;

  const dateIso = bill.introducedDate;
  const dateString = isGeneric && bill.yearOnly ? formatYear(dateIso) : formatDate(dateIso);

  return (
    <div className="block rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-600 transition-colors group">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {isSpecial && (
              showOutcomeBadge ? (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${OUTCOME_BADGE_STYLE[outcome]}`}>
                  {OUTCOME_LABEL[outcome]}
                </span>
              ) : (
                bill.status && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${statusStyle}`}>
                    {statusLabel}
                  </span>
                )
              )
            )}
            {showGenericStatusBadge && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${FOREIGN_STATUS_STYLE}`}>
                {bill.status}
              </span>
            )}
            {billRef && (
              <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-gray-800 text-gray-400 border border-gray-700/50">
                {billRef}
              </span>
            )}
            {lawTypeChip && (
              <span className="text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wider bg-gray-800/60 text-gray-400 border border-gray-700/50">
                {lawTypeChip}
              </span>
            )}
            {showOutcomeBadge && isUsStatus && status !== "status-enacted" && status !== "status-vetoed" && status !== "status-failed" && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${statusStyle}`}>
                {statusLabel}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-200 group-hover:text-white leading-snug line-clamp-2">
            {bill.title}
          </p>
          {bill.body && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-1">
              {truncate(bill.body, 180)}
            </p>
          )}
          {isGeneric && bill.introducedIn && (
            <p className="mt-1 text-[11px] text-gray-500">
              <span className="text-gray-600">Introduced in:</span>{" "}
              <span className="text-gray-400">{bill.introducedIn}</span>
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {prominentOutcome ? (
            <>
              <div className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">Last action</div>
              <div className="text-xs text-gray-400 font-mono whitespace-nowrap">
                {formatDate(bill.latestActionDate ?? bill.introducedDate)}
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-500 font-mono whitespace-nowrap">
              {dateString}
            </div>
          )}
          {bill.sourceUrl && (
            <a
              href={bill.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[10px] text-gray-500 hover:text-blue-300 transition-colors uppercase tracking-widest"
            >
              {isGeneric ? "→ source" : `${linkLabel} →`}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

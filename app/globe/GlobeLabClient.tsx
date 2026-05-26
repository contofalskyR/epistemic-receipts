"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { countryFlag } from "@/lib/countryCodeMap";

type DensityRow = {
  countryCode: string;
  countryName: string;
  claimCount: number;
};

type DensityResponse = {
  countries: DensityRow[];
  totalClaimCount: number;
};

type CountryDetail = {
  countryCode: string;
  countryName: string;
  claimCount: number;
  recentClaims: Array<{
    id: string;
    text: string;
    currentStatus: string;
    claimType: string;
    createdAt: string;
    ingestedBy: string;
  }>;
};

type TooltipState = { x: number; y: number; name: string; count: number } | null;

const STATUS_COLORS: Record<string, string> = {
  HARD_FACT: "bg-emerald-900/70 text-emerald-300 border-emerald-700",
  DISPUTED: "bg-amber-900/70 text-amber-300 border-amber-700",
  NEVER_RESOLVES: "bg-gray-800 text-gray-400 border-gray-700",
};

function claimBadge(status: string) {
  return STATUS_COLORS[status] ?? "bg-gray-800 text-gray-400 border-gray-700";
}

const GEOJSON_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

const EARTH_AGE = 4_500_000_000;
const CURRENT_YEAR = 2026;

type Era = {
  name: string;
  emoji: string;
  startYear: number;
  endYear: number;
};

const ERAS: Era[] = [
  { name: "Formation of Earth", emoji: "🌑", startYear: -EARTH_AGE, endYear: -4_000_000_000 },
  { name: "Archean Eon", emoji: "🌋", startYear: -4_000_000_000, endYear: -2_500_000_000 },
  { name: "Proterozoic Eon", emoji: "🦠", startYear: -2_500_000_000, endYear: -540_000_000 },
  { name: "Paleozoic Era", emoji: "🐟", startYear: -540_000_000, endYear: -252_000_000 },
  { name: "Age of Dinosaurs", emoji: "🦕", startYear: -252_000_000, endYear: -66_000_000 },
  { name: "Age of Mammals", emoji: "🦣", startYear: -66_000_000, endYear: -2_600_000 },
  { name: "Ice Ages", emoji: "🧊", startYear: -2_600_000, endYear: -10_000 },
  { name: "Human Civilization", emoji: "🏛️", startYear: -10_000, endYear: -3_000 },
  { name: "Recorded History", emoji: "📜", startYear: -3_000, endYear: CURRENT_YEAR },
];

function getEraForYear(year: number): Era {
  for (const era of ERAS) {
    if (year >= era.startYear && year < era.endYear) {
      return era;
    }
  }
  return ERAS[ERAS.length - 1];
}

function sliderToYear(sliderValue: number): number {
  const t = sliderValue / 1000;
  const logScale = Math.pow(10, t * Math.log10(EARTH_AGE + CURRENT_YEAR));
  const yearsFromEnd = logScale - 1;
  return Math.round(CURRENT_YEAR - yearsFromEnd);
}

function yearToSlider(year: number): number {
  const yearsFromEnd = CURRENT_YEAR - year;
  if (yearsFromEnd <= 0) return 1000;
  const logScale = yearsFromEnd + 1;
  const t = Math.log10(logScale) / Math.log10(EARTH_AGE + CURRENT_YEAR);
  return Math.round(t * 1000);
}

function formatYear(year: number): string {
  if (year >= -3000) {
    if (year < 0) return `${Math.abs(year).toLocaleString()} BCE`;
    return year.toLocaleString();
  }
  const yearsAgo = CURRENT_YEAR - year;
  if (yearsAgo >= 1_000_000_000) {
    return `${(yearsAgo / 1_000_000_000).toFixed(1)} billion years ago`;
  }
  if (yearsAgo >= 1_000_000) {
    return `${(yearsAgo / 1_000_000).toFixed(1)} million years ago`;
  }
  if (yearsAgo >= 1000) {
    return `${Math.round(yearsAgo / 1000).toLocaleString()}k years ago`;
  }
  return `${yearsAgo.toLocaleString()} years ago`;
}

const STATUS_OPTIONS = ["HARD_FACT", "DISPUTED", "NEVER_RESOLVES"];
const TYPE_OPTIONS = ["EMPIRICAL", "INSTITUTIONAL", "INTERPRETIVE", "HYBRID"];

export default function GlobeLabClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoDataRef = useRef<any>(null);

  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [sidebar, setSidebar] = useState<CountryDetail | null>(null);
  const [loadingSidebar, setLoadingSidebar] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [claimFilter, setClaimFilter] = useState("");

  const [sliderValue, setSliderValue] = useState(1000);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(STATUS_OPTIONS));
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(TYPE_OPTIONS));

  const [density, setDensity] = useState<DensityRow[]>([]);
  const [totalClaimCount, setTotalClaimCount] = useState(0);
  const [loadingDensity, setLoadingDensity] = useState(false);

  const currentYear = sliderToYear(sliderValue);
  const currentEra = getEraForYear(currentYear);
  const isAtPresent = sliderValue >= 999;

  const densityMap = useMemo(() => new Map(density.map((d) => [d.countryCode, d])), [density]);
  const maxCount = useMemo(() => Math.max(...density.map((d) => d.claimCount), 1), [density]);

  function countToColor(count: number): string {
    if (count === 0) return "#1c1c2e";
    const t = Math.log(count + 1) / Math.log(maxCount + 1);
    const r = Math.round(30 + t * (245 - 30));
    const g = Math.round(58 + t * (158 - 58));
    const b = Math.round(95 + t * (11 - 95));
    return `rgb(${r},${g},${b})`;
  }

  const filteredClaims = useMemo(() => {
    if (!sidebar) return [];
    const q = claimFilter.trim().toLowerCase();
    if (!q) return sidebar.recentClaims;
    return sidebar.recentClaims.filter((c) => c.text.toLowerCase().includes(q));
  }, [sidebar, claimFilter]);

  const fetchDensity = useCallback(async () => {
    setLoadingDensity(true);
    try {
      const params = new URLSearchParams();

      if (!isAtPresent) {
        params.set("before", currentYear.toString());
      }

      if (selectedStatuses.size < STATUS_OPTIONS.length && selectedStatuses.size > 0) {
        params.set("status", Array.from(selectedStatuses).join(","));
      }

      if (selectedTypes.size < TYPE_OPTIONS.length && selectedTypes.size > 0) {
        params.set("claimType", Array.from(selectedTypes).join(","));
      }

      const url = `/api/globe/density-temporal${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data: DensityResponse = await res.json();
        setDensity(data.countries);
        setTotalClaimCount(data.totalClaimCount);
      }
    } finally {
      setLoadingDensity(false);
    }
  }, [currentYear, isAtPresent, selectedStatuses, selectedTypes]);

  useEffect(() => {
    const timeoutId = setTimeout(fetchDensity, 150);
    return () => clearTimeout(timeoutId);
  }, [fetchDensity]);

  useEffect(() => {
    if (!globeRef.current || !globeReady || !geoDataRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globeRef.current.polygonCapColor((feat: any) => {
      const code = feat.properties?.ISO_A2 ?? feat.properties?.iso_a2;
      const row = densityMap.get(code);
      return countToColor(row?.claimCount ?? 0);
    });
  }, [density, globeReady, densityMap, maxCount]);

  const openSidebar = useCallback(async (code: string) => {
    setLoadingSidebar(true);
    setSidebar(null);
    setClaimFilter("");
    try {
      const res = await fetch(`/api/globe/country/${code}`);
      if (res.ok) setSidebar(await res.json());
    } finally {
      setLoadingSidebar(false);
    }
  }, []);

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let globeInstance: any = null;

    async function init() {
      if (!containerRef.current) return;
      const GlobeGL = (await import("globe.gl")).default;
      const geoRes = await fetch(GEOJSON_URL);
      const geoData = await geoRes.json();

      if (cancelled || !containerRef.current) return;

      geoDataRef.current = geoData;

      const el = containerRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      globeInstance = new (GlobeGL as any)(el)
        .width(el.clientWidth)
        .height(el.clientHeight)
        .backgroundColor("#0a0a0a")
        .atmosphereColor("#1a3a6e")
        .atmosphereAltitude(0.12)
        .polygonsData(geoData.features)
        .polygonCapColor(() => "#1c1c2e")
        .polygonSideColor(() => "rgba(10,10,20,0.6)")
        .polygonStrokeColor(() => "#2a2a4a")
        .polygonAltitude(0.005)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .onPolygonHover((feat: any, _prev: unknown, ev: MouseEvent) => {
          if (!feat) {
            setTooltip(null);
            return;
          }
          const code = feat.properties?.ISO_A2 ?? feat.properties?.iso_a2;
          const name = feat.properties?.NAME ?? feat.properties?.name ?? code;
          const row = densityMap.get(code);
          setTooltip({
            x: ev?.clientX ?? 0,
            y: ev?.clientY ?? 0,
            name,
            count: row?.claimCount ?? 0,
          });
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .onPolygonClick((feat: any) => {
          const code = feat?.properties?.ISO_A2 ?? feat?.properties?.iso_a2;
          if (code && code !== "-99") openSidebar(code);
        });

      globeInstance.controls().autoRotate = true;
      globeInstance.controls().autoRotateSpeed = 0.4;
      globeInstance.controls().addEventListener("start", () => {
        if (globeInstance) globeInstance.controls().autoRotate = false;
      });

      globeRef.current = globeInstance;
      setGlobeReady(true);
    }

    init();
    return () => {
      cancelled = true;
      if (globeInstance) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globeInstance as any)._destructor?.();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onResize() {
      if (globeRef.current && containerRef.current) {
        globeRef.current
          .width(containerRef.current.clientWidth)
          .height(containerRef.current.clientHeight);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="relative" style={{ width: "100%", height: "90vh", background: "#0a0a0a" }}>
      <div ref={containerRef} className="w-full h-full" />

      {!globeReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <p className="text-gray-400 text-sm">Loading globe…</p>
          </div>
        </div>
      )}

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-2 rounded-lg bg-gray-900/95 border border-gray-700 text-sm shadow-xl"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          <span className="font-medium text-white">{tooltip.name}</span>
          {tooltip.count > 0 ? (
            <span className="ml-2 text-amber-400">{tooltip.count.toLocaleString()} claims</span>
          ) : (
            <span className="ml-2 text-gray-500">no claims</span>
          )}
        </div>
      )}

      {/* Lab badge */}
      <div className="fixed top-[52px] left-4 z-40">
        <a
          href="/globe"
          className="flex items-center gap-1.5 px-2 py-1 text-xs bg-gray-900/80 backdrop-blur border border-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors"
        >
          ← Back to Globe
        </a>
        <div className="mt-2 px-2 py-1 text-xs bg-purple-900/50 border border-purple-700/50 rounded text-purple-300">
          🧪 Globe Lab
        </div>
      </div>

      {/* Filter panel */}
      <div className="fixed top-[52px] right-4 z-40">
        <button
          type="button"
          onClick={() => setFilterExpanded((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 text-xs bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
        >
          <span>Filters</span>
          <span className="text-gray-500">{filterExpanded ? "▲" : "▼"}</span>
        </button>

        {filterExpanded && (
          <div className="mt-2 p-3 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-lg w-64 space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">Status</p>
              <div className="flex flex-wrap gap-1">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatus(status)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      selectedStatuses.has(status)
                        ? "bg-amber-900/60 border-amber-700 text-amber-300"
                        : "bg-gray-800 border-gray-700 text-gray-500"
                    }`}
                  >
                    {status.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Type</p>
              <div className="flex flex-wrap gap-1">
                {TYPE_OPTIONS.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      selectedTypes.has(type)
                        ? "bg-amber-900/60 border-amber-700 text-amber-300"
                        : "bg-gray-800 border-gray-700 text-gray-500"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Deep-time slider */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-2xl">
        <div className="bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-6 py-4">
          {/* Era display */}
          <div className="text-center mb-3">
            <div className="text-2xl mb-1">
              <span className="mr-2">{currentEra.emoji}</span>
              <span className="font-semibold text-white">{currentEra.name}</span>
            </div>
            <div className="text-sm text-amber-400 font-medium">
              {formatYear(currentYear)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {loadingDensity ? (
                "Loading…"
              ) : (
                `${totalClaimCount.toLocaleString()} claims visible`
              )}
            </div>
          </div>

          {/* Slider */}
          <div className="relative">
            <input
              type="range"
              min={0}
              max={1000}
              value={sliderValue}
              onChange={(e) => setSliderValue(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gradient-to-r from-purple-900 via-blue-800 via-emerald-700 to-amber-500 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>4.5 Ga</span>
              <span>Now</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="fixed bottom-32 left-6 z-30 flex items-center gap-2 bg-gray-900/80 rounded-lg px-3 py-2 border border-gray-800 text-xs text-gray-400">
        <span>Low</span>
        <div
          className="w-24 h-3 rounded"
          style={{ background: "linear-gradient(to right, #1e3a5f, #f59e0b)" }}
        />
        <span>High</span>
        <span className="ml-2 text-gray-500">claim density</span>
      </div>

      {/* Sidebar */}
      {(loadingSidebar || sidebar) && (
        <div
          className="fixed right-0 w-80 bg-gray-950/95 border-l border-gray-800 flex flex-col shadow-2xl overflow-hidden z-40"
          style={{ top: 45, bottom: 0 }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            {sidebar ? (
              <div>
                <span className="text-2xl mr-2">{countryFlag(sidebar.countryCode)}</span>
                <span className="font-semibold text-white">{sidebar.countryName}</span>
                <span className="ml-2 text-amber-400 text-sm">
                  {sidebar.claimCount.toLocaleString()} claims
                </span>
              </div>
            ) : (
              <span className="text-gray-400 text-sm">Loading…</span>
            )}
            <button
              onClick={() => setSidebar(null)}
              className="text-gray-500 hover:text-white ml-4 text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {sidebar && sidebar.recentClaims.length > 0 && (
            <div className="px-5 py-3 border-b border-gray-800 space-y-2">
              <input
                type="text"
                value={claimFilter}
                onChange={(e) => setClaimFilter(e.target.value)}
                placeholder="Filter claims…"
                className="w-full px-3 py-1.5 text-sm rounded-md bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30"
                aria-label="Filter claims"
              />
              <p className="text-xs text-gray-500">
                {filteredClaims.length} of {sidebar.recentClaims.length} claims
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {loadingSidebar && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
              </div>
            )}
            {filteredClaims.map((claim) => (
              <a
                key={claim.id}
                href={`/claims/${claim.id}`}
                className="block rounded-lg border border-gray-800 bg-gray-900 p-3 hover:border-gray-600 transition-colors"
              >
                <p className="text-sm text-gray-200 line-clamp-3">{claim.text}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded border ${claimBadge(claim.currentStatus)}`}
                  >
                    {claim.currentStatus.replace("_", " ")}
                  </span>
                  <span className="text-xs text-gray-500">{claim.ingestedBy}</span>
                </div>
              </a>
            ))}
            {sidebar && sidebar.recentClaims.length === 0 && (
              <p className="text-gray-500 text-sm py-4 text-center">No claims found for this country.</p>
            )}
            {sidebar && sidebar.recentClaims.length > 0 && filteredClaims.length === 0 && (
              <p className="text-gray-500 text-sm py-4 text-center">No claims match your filter.</p>
            )}
          </div>

          {sidebar && (
            <div className="px-5 py-3 border-t border-gray-800">
              <a
                href={`/search?country=${sidebar.countryCode}`}
                className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                View all claims from {sidebar.countryName} →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

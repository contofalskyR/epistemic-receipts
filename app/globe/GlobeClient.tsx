"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { countryFlag } from "@/lib/countryCodeMap";
import type { OriginPoint } from "@/app/api/globe/origins/route";
import { getGeoJSONForYear, type GeoJSONSelection } from "@/lib/historical-geo";

type DensityRow = {
  countryCode: string;
  countryName: string;
  claimCount: number;
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

type TooltipState = {
  x: number;
  y: number;
  name: string;
  count: number;
  source: "modern" | "historical" | "paleo" | null;
} | null;
type ViewMode = "heatmap" | "origins";

const STATUS_COLORS: Record<string, string> = {
  HARD_FACT: "bg-emerald-900/70 text-emerald-300 border-emerald-700",
  DISPUTED: "bg-amber-900/70 text-amber-300 border-amber-700",
  NEVER_RESOLVES: "bg-gray-800 text-gray-400 border-gray-700",
};

function claimBadge(status: string) {
  return STATUS_COLORS[status] ?? "bg-gray-800 text-gray-400 border-gray-700";
}

const MIN_YEAR = 1789;
const MAX_YEAR = 2026;

function formatYear(year: number): string {
  if (year >= MAX_YEAR) return "Present";
  return `${year}`;
}

export default function GlobeClient({ density }: { density: DensityRow[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoCache = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hoveredFeatRef = useRef<any>(null);
  const viewModeRef = useRef<ViewMode>("heatmap");
  const currentSourceRef = useRef<"modern" | "historical" | "paleo" | null>("modern");
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [sidebar, setSidebar] = useState<CountryDetail | null>(null);
  const [loadingSidebar, setLoadingSidebar] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [claimFilter, setClaimFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("heatmap");

  // Time slider state
  const [currentYear, setCurrentYear] = useState<number>(MAX_YEAR);
  const [isPlaying, setIsPlaying] = useState(false);
  const [densityState, setDensityState] = useState<DensityRow[]>(density);
  const [totalClaimCount, setTotalClaimCount] = useState<number>(
    density.reduce((sum, d) => sum + d.claimCount, 0)
  );
  const [loadingDensity, setLoadingDensity] = useState(false);
  const [originsData, setOriginsData] = useState<OriginPoint[] | null>(null);
  const [loadingOrigins, setLoadingOrigins] = useState(false);
  const [currentGeoSelection, setCurrentGeoSelection] = useState<GeoJSONSelection | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const isAtPresent = currentYear >= MAX_YEAR;

  const sortedDensity = useMemo(
    () => [...densityState].sort((a, b) => b.claimCount - a.claimCount),
    [densityState]
  );

  const densityMap = useMemo(
    () => new Map(densityState.map((d) => [d.countryCode, d])),
    [densityState]
  );
  const maxCount = useMemo(
    () => Math.max(...densityState.map((d) => d.claimCount), 1),
    [densityState]
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return sortedDensity
      .filter(
        (d) =>
          d.countryName.toLowerCase().includes(q) ||
          d.countryCode.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [searchQuery, sortedDensity]);

  const filteredClaims = useMemo(() => {
    if (!sidebar) return [];
    const q = claimFilter.trim().toLowerCase();
    if (!q) return sidebar.recentClaims;
    return sidebar.recentClaims.filter((c) => c.text.toLowerCase().includes(q));
  }, [sidebar, claimFilter]);

  function countToColor(count: number): string {
    if (count === 0) return "#1c1c2e";
    const t = Math.log(count + 1) / Math.log(maxCount + 1);
    const r = Math.round(30 + t * (245 - 30));
    const g = Math.round(58 + t * (158 - 58));
    const b = Math.round(95 + t * (11 - 95));
    return `rgb(${r},${g},${b})`;
  }

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

  const handleSelectResult = useCallback(
    (code: string) => {
      setSearchQuery("");
      setSearchFocused(false);
      openSidebar(code);
    },
    [openSidebar]
  );

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // Debounced density refetch when year changes
  useEffect(() => {
    if (isAtPresent) {
      setDensityState(density);
      setTotalClaimCount(density.reduce((sum, d) => sum + d.claimCount, 0));
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoadingDensity(true);
      try {
        const res = await fetch(`/api/globe/density-temporal?before=${currentYear}`);
        if (!res.ok) return;
        const data: { countries: DensityRow[]; totalClaimCount: number } = await res.json();
        if (cancelled) return;
        setDensityState(data.countries);
        setTotalClaimCount(data.totalClaimCount);
      } finally {
        if (!cancelled) setLoadingDensity(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [currentYear, isAtPresent, density]);

  // Debounced origins refetch when in origins mode + year changes
  useEffect(() => {
    if (viewMode !== "origins") return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoadingOrigins(true);
      try {
        const url = isAtPresent
          ? "/api/globe/origins"
          : `/api/globe/origins?yearTo=${currentYear}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data: OriginPoint[] = await res.json();
        if (cancelled) return;
        setOriginsData(data);
      } finally {
        if (!cancelled) setLoadingOrigins(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [viewMode, currentYear, isAtPresent]);

  // Load historical/modern GeoJSON whenever currentYear changes
  useEffect(() => {
    if (!globeReady || !globeRef.current) return;

    const selection = getGeoJSONForYear(currentYear);
    const cacheKey = selection.path;
    currentSourceRef.current = selection.source;

    const cached = geoCache.current.get(cacheKey);
    if (cached) {
      globeRef.current.polygonsData(cached.features);
      setCurrentGeoSelection(selection);
      return;
    }

    let cancelled = false;
    setLoadingGeo(true);
    (async () => {
      try {
        const res = await fetch(selection.path);
        if (!res.ok) throw new Error(`Failed to fetch ${selection.path}`);
        const data = await res.json();
        if (cancelled) return;
        geoCache.current.set(cacheKey, data);
        if (globeRef.current) {
          globeRef.current.polygonsData(data.features);
        }
        setCurrentGeoSelection(selection);
      } catch (err) {
        console.error("Failed to load GeoJSON:", err);
      } finally {
        if (!cancelled) setLoadingGeo(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentYear, globeReady]);

  // Play/pause animation: advance currentYear every 120ms when playing
  useEffect(() => {
    if (!isPlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      return;
    }
    playIntervalRef.current = setInterval(() => {
      setCurrentYear((y) => {
        if (y >= MAX_YEAR) {
          setIsPlaying(false);
          return MAX_YEAR;
        }
        return y + 1;
      });
    }, 120);
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, [isPlaying]);

  // Initial globe init (modern GeoJSON only — historical is loaded on demand)
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let globeInstance: any = null;

    async function init() {
      if (!containerRef.current) return;
      const GlobeGL = (await import("globe.gl")).default;
      const modernSelection = getGeoJSONForYear(MAX_YEAR);
      const res = await fetch(modernSelection.path);
      const geo = await res.json();

      if (cancelled || !containerRef.current) return;

      geoCache.current.set(modernSelection.path, geo);
      currentSourceRef.current = "modern";

      const el = containerRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      globeInstance = new (GlobeGL as any)(el)
        .width(el.clientWidth)
        .height(el.clientHeight)
        .backgroundColor("#0a0a0a")
        .atmosphereColor("#1a3a6e")
        .atmosphereAltitude(0.12)
        .polygonsData(geo.features)
        .polygonSideColor(() => "rgba(10,10,20,0.6)")
        .polygonAltitude(0.005)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .onPolygonHover((feat: any, _prev: unknown, ev: MouseEvent) => {
          if (!feat) {
            setTooltip(null);
            if (viewModeRef.current === "origins") {
              hoveredFeatRef.current = null;
              if (currentSourceRef.current === "modern") {
                globeRef.current?.polygonCapColor(() => "#1a2035");
              }
            }
            return;
          }
          const code = feat.properties?.ISO_A2 ?? feat.properties?.iso_a2;
          const name = feat.properties?.NAME ?? feat.properties?.name ?? code ?? "Unknown region";
          const row = code ? densityMap.get(code) : undefined;
          setTooltip({
            x: ev?.clientX ?? 0,
            y: ev?.clientY ?? 0,
            name,
            count: row?.claimCount ?? 0,
            source: currentSourceRef.current,
          });
          if (viewModeRef.current === "origins" && currentSourceRef.current === "modern") {
            hoveredFeatRef.current = feat;
            const hovered = feat;
            globeRef.current?.polygonCapColor(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (f: any) => f === hovered ? "#263050" : "#1a2035"
            );
          }
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .onPolygonClick((feat: any) => {
          // Only modern borders carry ISO codes that map to /api/globe/country
          if (currentSourceRef.current !== "modern") return;
          const code = feat?.properties?.ISO_A2 ?? feat?.properties?.iso_a2;
          if (code && code !== "-99") openSidebar(code);
        });

      globeInstance.controls().autoRotate = true;
      globeInstance.controls().autoRotateSpeed = 0.4;
      globeInstance.controls().addEventListener("start", () => {
        if (globeInstance) globeInstance.controls().autoRotate = false;
      });

      globeRef.current = globeInstance;
      setCurrentGeoSelection(modernSelection);
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

  // Resize handler
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

  // Apply view mode + geo source + density colors. This runs whenever any of
  // these change so the globe re-renders consistently when the slider moves.
  useEffect(() => {
    if (!globeRef.current || !globeReady) return;
    hoveredFeatRef.current = null;

    const source = currentGeoSelection?.source ?? "modern";

    if (viewMode === "heatmap") {
      if (source === "modern") {
        globeRef.current
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .polygonCapColor((feat: any) => {
            const code = feat.properties?.ISO_A2 ?? feat.properties?.iso_a2;
            const row = code ? densityMap.get(code) : undefined;
            return countToColor(row?.claimCount ?? 0);
          })
          .polygonStrokeColor(() => "#2a2a4a")
          .polygonSideColor(() => "rgba(10,10,20,0.6)")
          .polygonAltitude(0.005)
          .pointsData([])
          .backgroundColor("#0a0a0a");
      } else {
        // Historical era — sepia/parchment fill; click disabled.
        globeRef.current
          .polygonCapColor(() => "#2e2820")
          .polygonStrokeColor(() => "#5a4a3a")
          .polygonSideColor(() => "rgba(20,15,10,0.6)")
          .polygonAltitude(0.005)
          .pointsData([])
          .backgroundColor("#0a0a0a");
      }
    } else {
      // Origins mode
      const pts = originsData ?? [];
      const maxOrigin = Math.max(...pts.map((d) => d.claimCount), 1);

      if (source === "modern") {
        globeRef.current
          .polygonCapColor(() => "#0d1117")
          .polygonSideColor(() => "rgba(0,0,0,0)")
          .polygonStrokeColor(() => "rgba(80,100,140,0.5)")
          .polygonAltitude(0.001);
      } else {
        globeRef.current
          .polygonCapColor(() => "#1a1610")
          .polygonSideColor(() => "rgba(0,0,0,0)")
          .polygonStrokeColor(() => "rgba(140,110,80,0.5)")
          .polygonAltitude(0.001);
      }

      globeRef.current
        .pointsData(pts)
        .pointLat((d: OriginPoint) => d.lat)
        .pointLng((d: OriginPoint) => d.lon)
        .pointAltitude(0.01)
        .pointRadius((d: OriginPoint) => {
          const t = Math.log(d.claimCount + 1) / Math.log(maxOrigin + 1);
          return 0.15 + t * 1.8;
        })
        .pointColor((d: OriginPoint) => {
          const t = Math.log(d.claimCount + 1) / Math.log(maxOrigin + 1);
          const g = Math.round(180 + t * 75);
          const b = Math.round(t * 80);
          const a = 0.18 + t * 0.32;
          return `rgba(255,${g},${b},${a})`;
        })
        .pointsMerge(true)
        .pointLabel((d: OriginPoint) => `${d.city}: ${d.claimCount.toLocaleString()} claims`)
        .backgroundColor("#050505");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, globeReady, densityMap, maxCount, originsData, currentGeoSelection]);

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
          {tooltip.source === "modern" ? (
            tooltip.count > 0 ? (
              <span className="ml-2 text-amber-400">{tooltip.count.toLocaleString()} claims</span>
            ) : (
              <span className="ml-2 text-gray-500">no claims</span>
            )
          ) : tooltip.source === "historical" ? (
            <span className="ml-2 text-amber-400/70 text-xs">historical entity</span>
          ) : null}
        </div>
      )}

      {/* View mode pill toggle */}
      <div className="fixed top-[52px] right-4 z-40">
        <div className="relative flex items-center bg-gray-900/80 backdrop-blur border border-gray-700 rounded-full p-1">
          <div
            className="absolute top-1 bottom-1 rounded-full bg-amber-500 transition-transform duration-300 ease-in-out"
            style={{
              width: "calc(50% - 4px)",
              transform:
                viewMode === "heatmap"
                  ? "translateX(0)"
                  : "translateX(calc(100% + 8px))",
            }}
          />
          <button
            type="button"
            onClick={() => setViewMode("heatmap")}
            className={`relative z-10 px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 ${
              viewMode === "heatmap" ? "text-gray-900" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Heatmap
          </button>
          <button
            type="button"
            onClick={() => setViewMode("origins")}
            className={`relative z-10 px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 ${
              viewMode === "origins" ? "text-gray-900" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Origins
          </button>
        </div>
      </div>

      {/* Search panel */}
      <div className="fixed top-[52px] left-4 w-64 z-30">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => {
              setTimeout(() => setSearchFocused(false), 120);
            }}
            placeholder="Search countries…"
            className="w-full px-3 py-2 text-sm rounded-lg bg-gray-900/90 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30"
            aria-label="Search countries"
          />
          {searchFocused && searchResults.length > 0 && (
            <ul className="absolute left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-lg bg-gray-950/95 border border-gray-700 shadow-2xl divide-y divide-gray-800/80">
              {searchResults.map((row) => (
                <li key={row.countryCode}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectResult(row.countryCode);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-800/80"
                  >
                    <span className="text-lg">{countryFlag(row.countryCode)}</span>
                    <span className="flex-1 truncate">{row.countryName}</span>
                    <span className="text-xs text-amber-400">
                      {row.claimCount.toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searchFocused && searchQuery.trim() && searchResults.length === 0 && (
            <div className="absolute left-0 right-0 mt-1 px-3 py-2 rounded-lg bg-gray-950/95 border border-gray-700 shadow-2xl text-xs text-gray-500">
              No matching countries
            </div>
          )}
        </div>
      </div>

      {/* Time slider — fixed bottom-center */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-2xl">
        <div className="bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-5 py-3">
          <div className="flex items-center gap-3 mb-2">
            <button
              type="button"
              onClick={() => {
                if (isAtPresent) {
                  // Restart from MIN_YEAR when at the end
                  setCurrentYear(MIN_YEAR);
                  setIsPlaying(true);
                } else {
                  setIsPlaying((p) => !p);
                }
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 text-gray-900 text-xs font-bold transition-colors"
              aria-label={isPlaying ? "Pause" : "Play"}
              title={isPlaying ? "Pause" : "Play through history"}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>
            <div className="flex-1 text-center">
              <div className="text-base font-semibold text-white leading-tight">
                {formatYear(currentYear)}
              </div>
              <div className="text-[11px] text-gray-500 leading-tight">
                {loadingDensity || loadingOrigins ? (
                  "Loading…"
                ) : isAtPresent ? (
                  `${totalClaimCount.toLocaleString()} claims (all time)`
                ) : (
                  `${totalClaimCount.toLocaleString()} claims through ${currentYear}`
                )}
              </div>
              {currentGeoSelection && !isAtPresent && (
                <div className="text-[11px] mt-0.5 flex items-center justify-center gap-1">
                  {loadingGeo && (
                    <div className="w-2.5 h-2.5 rounded-full border border-amber-400 border-t-transparent animate-spin" />
                  )}
                  <span
                    className={
                      currentGeoSelection.source === "historical"
                        ? "text-amber-400/80"
                        : "text-emerald-400/80"
                    }
                  >
                    {currentGeoSelection.label}
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setCurrentYear(MAX_YEAR);
              }}
              disabled={isAtPresent && !isPlaying}
              className="px-2 py-1 text-[11px] rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Reset to present"
            >
              Now
            </button>
          </div>

          <div className="relative">
            <input
              type="range"
              min={MIN_YEAR}
              max={MAX_YEAR}
              step={1}
              value={currentYear}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentYear(parseInt(e.target.value, 10));
              }}
              className="w-full h-2 bg-gradient-to-r from-amber-900 via-amber-700 to-amber-500 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              aria-label="Year"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>{MIN_YEAR}</span>
              <span>1850</span>
              <span>1900</span>
              <span>1950</span>
              <span>2000</span>
              <span>Now</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legend — only in heatmap mode */}
      {viewMode === "heatmap" && currentGeoSelection?.source === "modern" && (
        <div className="fixed bottom-[120px] left-6 z-30 flex items-center gap-2 bg-gray-900/80 rounded-lg px-3 py-2 border border-gray-800 text-xs text-gray-400">
          <span>Low</span>
          <div
            className="w-24 h-3 rounded"
            style={{ background: "linear-gradient(to right, #1e3a5f, #f59e0b)" }}
          />
          <span>High</span>
          <span className="ml-2 text-gray-500">claim density</span>
          <span className="mx-2 text-gray-700">|</span>
          <a
            href="/globe/lab"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            Try Globe Lab
          </a>
        </div>
      )}
      {viewMode === "heatmap" && currentGeoSelection?.source === "historical" && (
        <div className="fixed bottom-[120px] left-6 z-30 flex items-center gap-2 bg-gray-900/80 rounded-lg px-3 py-2 border border-gray-800 text-xs text-gray-400">
          <div className="w-4 h-3 rounded" style={{ background: "#2e2820", border: "1px solid #5a4a3a" }} />
          <span className="text-amber-400">Historical borders</span>
          <span className="text-gray-500">— click disabled</span>
        </div>
      )}

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

"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { countryFlag } from "@/lib/countryCodeMap";
import type { OriginPoint } from "@/app/api/globe/origins/route";

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

type TooltipState = { x: number; y: number; name: string; count: number } | null;
type ViewMode = "heatmap" | "origins";

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

const GEOJSON_50M_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

export default function GlobeClient({ density }: { density: DensityRow[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoData110Ref = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoData50Ref = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hoveredFeatRef = useRef<any>(null);
  const viewModeRef = useRef<ViewMode>("heatmap");

  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [sidebar, setSidebar] = useState<CountryDetail | null>(null);
  const [loadingSidebar, setLoadingSidebar] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [claimFilter, setClaimFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("heatmap");
  const [originsData, setOriginsData] = useState<OriginPoint[] | null>(null);

  const sortedDensity = useMemo(
    () => [...density].sort((a, b) => b.claimCount - a.claimCount),
    [density]
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

  // Build lookup: ISO A2 → claimCount
  const densityMap = new Map(density.map((d) => [d.countryCode, d]));
  const maxCount = Math.max(...density.map((d) => d.claimCount), 1);

  // Log scale color: 0 claims = #1a1a2e, high = #f59e0b
  function countToColor(count: number): string {
    if (count === 0) return "#1c1c2e";
    const t = Math.log(count + 1) / Math.log(maxCount + 1);
    // interpolate dark blue (#1e3a5f) → orange-gold (#f59e0b)
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

  // Keep viewModeRef in sync so globe callbacks can read it without stale closure issues
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // Fetch origins data on first switch to origins mode
  useEffect(() => {
    if (viewMode !== "origins" || originsData !== null) return;
    fetch("/api/globe/origins")
      .then(r => r.ok ? r.json() : [])
      .then((data: OriginPoint[]) => setOriginsData(data))
      .catch(() => setOriginsData([]));
  }, [viewMode, originsData]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let globeInstance: any = null;

    async function init() {
      if (!containerRef.current) return;
      const GlobeGL = (await import("globe.gl")).default;

      // Fetch both resolutions in parallel so toggling is instant
      const [geo110Res, geo50Res] = await Promise.all([
        fetch(GEOJSON_URL),
        fetch(GEOJSON_50M_URL),
      ]);
      const [geo110, geo50] = await Promise.all([
        geo110Res.json(),
        geo50Res.json(),
      ]);

      if (cancelled || !containerRef.current) return;

      geoData110Ref.current = geo110;
      geoData50Ref.current = geo50;

      const el = containerRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      globeInstance = new (GlobeGL as any)(el)
        .width(el.clientWidth)
        .height(el.clientHeight)
        .backgroundColor("#0a0a0a")
        .atmosphereColor("#1a3a6e")
        .atmosphereAltitude(0.12)
        .polygonsData(geo110.features)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .polygonCapColor((feat: any) => {
          const code = feat.properties?.ISO_A2 ?? feat.properties?.iso_a2;
          const row = densityMap.get(code);
          return countToColor(row?.claimCount ?? 0);
        })
        .polygonSideColor(() => "rgba(10,10,20,0.6)")
        .polygonStrokeColor(() => "#2a2a4a")
        .polygonAltitude(0.005)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .onPolygonHover((feat: any, _prev: unknown, ev: MouseEvent) => {
          if (!feat) {
            setTooltip(null);
            if (viewModeRef.current === "origins") {
              hoveredFeatRef.current = null;
              globeRef.current?.polygonCapColor(() => "#1a2035");
            }
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
          if (viewModeRef.current === "origins") {
            hoveredFeatRef.current = feat;
            // Capture the ref value so the closure stays stable
            const hovered = feat;
            globeRef.current?.polygonCapColor(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (f: any) => f === hovered ? "#263050" : "#1a2035"
            );
          }
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .onPolygonClick((feat: any) => {
          const code = feat?.properties?.ISO_A2 ?? feat?.properties?.iso_a2;
          if (code && code !== "-99") openSidebar(code);
        });

      // Auto-rotate
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
          // globe.gl cleanup
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globeInstance as any)._destructor?.();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle resize
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

  // Apply view mode switch to existing globe instance (no reinit)
  useEffect(() => {
    if (!globeRef.current || !globeReady) return;

    hoveredFeatRef.current = null;

    if (viewMode === "heatmap") {
      const data = geoData110Ref.current;
      if (!data) return;
      globeRef.current
        .polygonsData(data.features)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .polygonCapColor((feat: any) => {
          const code = feat.properties?.ISO_A2 ?? feat.properties?.iso_a2;
          const row = densityMap.get(code);
          return countToColor(row?.claimCount ?? 0);
        })
        .polygonStrokeColor(() => "#2a2a4a")
        .polygonAltitude(0.005)
        .polygonSideColor(() => "rgba(10,10,20,0.6)")
        .pointsData([])
        .backgroundColor("#0a0a0a");
    } else {
      // Origins mode — light pollution style, keep country outlines for geography reference
      if (!originsData) return; // wait for data
      const maxCount = Math.max(...originsData.map(d => d.claimCount), 1);
      const data = geoData110Ref.current;

      globeRef.current
        .polygonsData(data?.features ?? [])
        .polygonCapColor(() => "#0d1117")
        .polygonSideColor(() => "rgba(0,0,0,0)")
        .polygonStrokeColor(() => "rgba(80,100,140,0.5)")
        .polygonAltitude(0.001)
        .pointsData(originsData)
        .pointLat((d: OriginPoint) => d.lat)
        .pointLng((d: OriginPoint) => d.lon)
        .pointAltitude(0.01)
        .pointRadius((d: OriginPoint) => {
          const t = Math.log(d.claimCount + 1) / Math.log(maxCount + 1);
          return 0.15 + t * 1.8;
        })
        .pointColor((d: OriginPoint) => {
          const t = Math.log(d.claimCount + 1) / Math.log(maxCount + 1);
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
  }, [viewMode, globeReady, originsData]);

  return (
    <div className="relative" style={{ width: "100%", height: "90vh", background: "#0a0a0a" }}>
      {/* Globe canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {!globeReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <p className="text-gray-400 text-sm">Loading globe…</p>
          </div>
        </div>
      )}

      {/* Tooltip */}
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

      {/* View mode pill toggle — fixed top-right, clears nav */}
      <div className="fixed top-[52px] right-4 z-40">
        <div className="relative flex items-center bg-gray-900/80 backdrop-blur border border-gray-700 rounded-full p-1">
          {/* Sliding active indicator */}
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

      {/* Search panel — fixed top-left, clears nav */}
      <div className="fixed top-[52px] left-4 w-64 z-30">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => {
              // Delay so click on a result registers before blur closes it.
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
                      // Use onMouseDown so it fires before the input's onBlur.
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

      {/* Legend — fixed bottom-left, only in heatmap mode */}
      {viewMode === "heatmap" && (
        <div className="fixed bottom-6 left-6 z-30 flex items-center gap-2 bg-gray-900/80 rounded-lg px-3 py-2 border border-gray-800 text-xs text-gray-400">
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

      {/* Sidebar — fixed right panel, starts below nav */}
      {(loadingSidebar || sidebar) && (
        <div className="fixed right-0 w-80 bg-gray-950/95 border-l border-gray-800 flex flex-col shadow-2xl overflow-hidden z-40"
          style={{ top: 45, bottom: 0 }}>
          {/* Header */}
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

          {/* Claim filter */}
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

          {/* Claims list */}
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

          {/* Footer link */}
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

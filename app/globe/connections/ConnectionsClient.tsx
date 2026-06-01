"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Pair = {
  countryA: string;
  countryB: string;
  countryAName: string;
  countryBName: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  claimCount: number;
  recentClaims: Array<{
    id: string;
    title: string;
    year: number | null;
  }>;
};

type CountryRef = {
  alpha3: string;
  name: string;
  lat: number;
  lng: number;
};

type Payload = {
  pairs: Pair[];
  countries: CountryRef[];
};

const MODERN_GEOJSON =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

export default function ConnectionsClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPair, setSelectedPair] = useState<Pair | null>(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [filter, setFilter] = useState("");

  // Load pair data + globe
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/globe/connections");
        if (!res.ok) throw new Error("Failed to load connections");
        const json: Payload = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Init globe
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let globeInstance: any = null;

    async function init() {
      if (!containerRef.current) return;
      const GlobeGL = (await import("globe.gl")).default;
      const res = await fetch(MODERN_GEOJSON);
      const geo = await res.json();

      if (cancelled || !containerRef.current) return;

      const el = containerRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      globeInstance = new (GlobeGL as any)(el)
        .width(el.clientWidth)
        .height(el.clientHeight)
        .backgroundColor("#050505")
        .atmosphereColor("#1a3a6e")
        .atmosphereAltitude(0.12)
        .polygonsData(geo.features)
        .polygonCapColor(() => "#0d1117")
        .polygonSideColor(() => "rgba(0,0,0,0)")
        .polygonStrokeColor(() => "rgba(80,100,140,0.5)")
        .polygonAltitude(0.001);

      globeInstance.controls().autoRotate = true;
      globeInstance.controls().autoRotateSpeed = 0.3;
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

  // Render arcs whenever data loads or selection changes
  useEffect(() => {
    if (!globeRef.current || !globeReady || !data) return;

    const pairs = data.pairs;
    const maxCount = Math.max(...pairs.map((p) => p.claimCount), 1);

    function arcColor(p: Pair): string {
      const t = Math.log(p.claimCount + 1) / Math.log(maxCount + 1);
      // Soft amber → bright amber based on connection density
      const r = Math.round(140 + t * 115);
      const g = Math.round(90 + t * 70);
      const b = Math.round(20 + t * 11);
      const a = 0.25 + t * 0.6;
      return `rgba(${r},${g},${b},${a})`;
    }

    function isSelected(p: Pair): boolean {
      return Boolean(
        selectedPair &&
          selectedPair.countryA === p.countryA &&
          selectedPair.countryB === p.countryB
      );
    }

    globeRef.current
      .arcsData(pairs)
      .arcStartLat((p: Pair) => p.startLat)
      .arcStartLng((p: Pair) => p.startLng)
      .arcEndLat((p: Pair) => p.endLat)
      .arcEndLng((p: Pair) => p.endLng)
      .arcColor((p: Pair) => (isSelected(p) ? "#fbbf24" : arcColor(p)))
      .arcStroke((p: Pair) => (isSelected(p) ? 1.4 : 0.5 + (p.claimCount / maxCount) * 0.9))
      .arcAltitudeAutoScale(0.35)
      .arcDashLength(0.5)
      .arcDashGap(0.2)
      .arcDashAnimateTime((p: Pair) =>
        isSelected(p) ? 1500 : 4000 - Math.min(2500, p.claimCount * 6)
      )
      .arcLabel(
        (p: Pair) =>
          `<div style="background:#111;border:1px solid #333;border-radius:6px;padding:6px 8px;color:#eee;font-size:12px"><b>${p.countryAName} ↔ ${p.countryBName}</b><br/>${p.claimCount.toLocaleString()} shared claims</div>`
      )
      .onArcClick((p: Pair) => setSelectedPair(p));

    // Also drop a point at each country for legibility
    globeRef.current
      .pointsData(data.countries)
      .pointLat((c: CountryRef) => c.lat)
      .pointLng((c: CountryRef) => c.lng)
      .pointAltitude(0.01)
      .pointRadius(0.25)
      .pointColor(() => "rgba(255,200,80,0.75)")
      .pointLabel((c: CountryRef) => c.name)
      .pointsMerge(true);
  }, [data, globeReady, selectedPair]);

  const sortedPairs = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.pairs;
    return data.pairs.filter(
      (p) =>
        p.countryAName.toLowerCase().includes(q) ||
        p.countryBName.toLowerCase().includes(q) ||
        p.countryA.toLowerCase().includes(q) ||
        p.countryB.toLowerCase().includes(q)
    );
  }, [data, filter]);

  return (
    <div className="relative" style={{ width: "100%", height: "90vh", background: "#050505" }}>
      <div ref={containerRef} className="w-full h-full" />

      {(loading || !globeReady) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#050505]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <p className="text-gray-400 text-sm">Loading connections…</p>
          </div>
        </div>
      )}

      {/* Side panel — pair list */}
      <div
        className="fixed right-0 w-80 bg-gray-950/95 border-l border-gray-800 flex flex-col shadow-2xl overflow-hidden z-40"
        style={{ top: 45, bottom: 0 }}
      >
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Country pairs</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {data ? `${data.pairs.length} pairs, sorted by shared claims` : "Loading…"}
          </p>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by country…"
            className="mt-3 w-full px-3 py-1.5 text-sm rounded-md bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30"
            aria-label="Filter pairs"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {!data && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            </div>
          )}
          {data && sortedPairs.length === 0 && (
            <p className="text-gray-500 text-sm py-4 text-center">No pairs match the filter.</p>
          )}
          {sortedPairs.map((p) => {
            const selected = Boolean(
              selectedPair &&
                selectedPair.countryA === p.countryA &&
                selectedPair.countryB === p.countryB
            );
            return (
              <button
                type="button"
                key={`${p.countryA}::${p.countryB}`}
                onClick={() => setSelectedPair(p)}
                className={`w-full text-left rounded-md px-3 py-2 transition-colors border ${
                  selected
                    ? "border-amber-500/70 bg-amber-500/10 text-amber-100"
                    : "border-transparent text-gray-200 hover:bg-gray-900"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">
                    {p.countryAName} ↔ {p.countryBName}
                  </span>
                  <span className="text-xs text-amber-400 shrink-0">
                    {p.claimCount.toLocaleString()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail drawer (left side) */}
      {selectedPair && (
        <div
          className="fixed left-0 w-96 bg-gray-950/95 border-r border-gray-800 flex flex-col shadow-2xl overflow-hidden z-40"
          style={{ top: 45, bottom: 0 }}
        >
          <div className="flex items-start justify-between px-5 py-4 border-b border-gray-800">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-gray-500">Shared claims</p>
              <h2 className="text-white font-semibold mt-1 truncate">
                {selectedPair.countryAName} ↔ {selectedPair.countryBName}
              </h2>
              <p className="text-xs text-amber-400 mt-1">
                {selectedPair.claimCount.toLocaleString()} total shared claims
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPair(null)}
              className="text-gray-500 hover:text-white ml-3 text-lg leading-none shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {selectedPair.recentClaims.length === 0 && (
              <p className="text-gray-500 text-sm py-4 text-center">
                No claim samples available.
              </p>
            )}
            {selectedPair.recentClaims.map((c) => (
              <Link
                key={c.id}
                href={`/claims/${c.id}`}
                prefetch={false}
                className="block rounded-lg border border-gray-800 bg-gray-900 p-3 hover:border-gray-600 transition-colors cursor-pointer"
              >
                <p className="text-sm text-gray-200 line-clamp-3">{c.title}</p>
                {c.year && (
                  <p className="text-xs text-gray-500 mt-1.5">{c.year}</p>
                )}
              </Link>
            ))}
            <p className="text-[11px] text-gray-600 pt-3">
              Showing up to 5 sample claims. The full count above reflects every claim that
              links to both countries via the polity graph.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

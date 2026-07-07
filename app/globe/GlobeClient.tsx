"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { hexbin as d3Hexbin } from "d3-hexbin";
import { countryFlag } from "@/lib/countryCodeMap";
import type { OriginPoint } from "@/app/api/globe/origins/route";
import { getGeoJSONForYear, type GeoJSONSelection } from "@/lib/historical-geo";
import { CATEGORY_SLUGS, CATEGORY_LABELS, type CategorySlug } from "@/lib/globe-categories";
import {
  LIGHTS_PARAMS,
  buildLightDots,
  createLightsObject,
  createOceanGrid,
  hexDotColor,
  BACKDROP_PATTERN_URI,
  BACKDROP_PATTERN_MASK,
  type AnchorLike,
  type Disposable,
} from "./granular-lights";

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

type ClaimItem = {
  id: string;
  text: string;
  currentStatus: string;
  verificationStatus: string | null;
  ingestedBy: string;
  createdAt: string;
};

type CountryClaimsPage = {
  countryCode: string;
  countryName: string;
  total: number;
  claims: ClaimItem[];
};

type CityCluster = {
  lat: number;
  lon: number;
  city: string | null;
  countryCode: string | null;
  claimCount: number;
};

type CityClaim = {
  id: string;
  title: string | null;
  claimType: string;
  ingestedBy: string;
  epistemicAxis: string | null;
  createdAt: string;
};

type CitySidebarData = {
  city: string | null;
  countryCode: string | null;
  lat: number;
  lon: number;
  total: number;
  claims: CityClaim[];
};

type TooltipState = {
  x: number;
  y: number;
  name: string;
  count: number;
  source: "modern" | "historical" | "paleo" | null;
} | null;
type ViewMode = "heatmap" | "origins" | "cities";

type HexRing = {
  lat: number;
  lng: number;
  maxRadius: number;
  propagationSpeed: number;
  repeatPeriod: number;
};

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

// Hard cap on claims accumulated via "Load more" — beyond this, hand off to /search
// (which is properly paginated) instead of growing the DOM unboundedly.
const MAX_LOADED_CLAIMS = 200;

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

  // Granular "claim lights" rendering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const threeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lightsRef = useRef<({ group: any } & Disposable) | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oceanRef = useRef<({ points: any } & Disposable) | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modernFeaturesRef = useRef<any[] | null>(null);
  const anchorsRef = useRef<AnchorLike[]>([]);
  const lightsSigRef = useRef<string>("");
  const [anchorsVersion, setAnchorsVersion] = useState(0);

  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [sidebar, setSidebar] = useState<CountryDetail | null>(null);
  const [loadingSidebar, setLoadingSidebar] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [claimFilter, setClaimFilter] = useState("");

  // Paginated claims panel
  const [claimsPage, setClaimsPage] = useState<CountryClaimsPage | null>(null);
  const [claimsOffset, setClaimsOffset] = useState(0);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [loadingMoreClaims, setLoadingMoreClaims] = useState(false);
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
  const [citiesData, setCitiesData] = useState<CityCluster[] | null>(null);
  const [loadingCities, setLoadingCities] = useState(false);
  const [citySidebar, setCitySidebar] = useState<CitySidebarData | null>(null);
  const [loadingCitySidebar, setLoadingCitySidebar] = useState(false);
  const [cityClaimsPage, setCityClaimsPage] = useState(1);
  const [loadingMoreCityClaims, setLoadingMoreCityClaims] = useState(false);
  const [currentGeoSelection, setCurrentGeoSelection] = useState<GeoJSONSelection | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategorySlug | null>(null);
  const [hexOverlay, setHexOverlay] = useState(false);

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

  const hexRings = useMemo<HexRing[]>(() => {
    if (!hexOverlay || !citiesData || citiesData.length === 0) return [];
    const hb = d3Hexbin<CityCluster>()
      .x((d) => d.lon)
      .y((d) => d.lat)
      .radius(2);
    const bins = hb(citiesData);
    const maxSum = Math.max(...bins.map((bin) => bin.reduce((s, d) => s + d.claimCount, 0)), 1);
    return bins.map((bin) => {
      const sum = bin.reduce((s, d) => s + d.claimCount, 0);
      const t = Math.log(sum + 1) / Math.log(maxSum + 1);
      return {
        lat: bin.y,
        lng: bin.x,
        maxRadius: 1 + t * 4,
        propagationSpeed: 1.5,
        repeatPeriod: 2000,
      };
    });
  }, [citiesData, hexOverlay]);

  const filteredClaims = useMemo(() => {
    if (!claimsPage) return [];
    const q = claimFilter.trim().toLowerCase();
    if (!q) return claimsPage.claims;
    return claimsPage.claims.filter((c) => c.text.toLowerCase().includes(q));
  }, [claimsPage, claimFilter]);

  const openSidebar = useCallback(async (code: string) => {
    setLoadingSidebar(true);
    setSidebar(null);
    setClaimsPage(null);
    setClaimsOffset(0);
    setClaimFilter("");
    setLoadingClaims(true);
    try {
      const [sidebarRes, claimsRes] = await Promise.all([
        fetch(`/api/globe/country/${code}`),
        fetch(`/api/globe/country-claims?country=${code}&limit=20&offset=0`),
      ]);
      if (sidebarRes.ok) setSidebar(await sidebarRes.json());
      if (claimsRes.ok) setClaimsPage(await claimsRes.json());
    } finally {
      setLoadingSidebar(false);
      setLoadingClaims(false);
    }
  }, []);

  const loadMoreClaims = useCallback(async (code: string, nextOffset: number) => {
    setLoadingMoreClaims(true);
    try {
      const res = await fetch(`/api/globe/country-claims?country=${code}&limit=20&offset=${nextOffset}`);
      if (!res.ok) return;
      const data: CountryClaimsPage = await res.json();
      setClaimsPage((prev) =>
        prev ? { ...prev, claims: [...prev.claims, ...data.claims] } : data
      );
      setClaimsOffset(nextOffset);
    } finally {
      setLoadingMoreClaims(false);
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

  const openCitySidebar = useCallback(async (lat: number, lon: number) => {
    const cityKey = `${Math.round(lat * 10) / 10}_${Math.round(lon * 10) / 10}`;
    setLoadingCitySidebar(true);
    setCitySidebar(null);
    setCityClaimsPage(1);
    try {
      const res = await fetch(`/api/globe/city/${cityKey}`);
      if (res.ok) setCitySidebar(await res.json());
    } finally {
      setLoadingCitySidebar(false);
    }
  }, []);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // Debounced density refetch when year or category changes.
  // Three cases:
  //  (1) at present + no category   → use SSR density (zero network)
  //  (2) at present + category set  → /api/globe/density?category=<slug>
  //  (3) historical                 → /api/globe/density-temporal?before=<year>
  //                                   (category is ignored for v1 historical mode)
  useEffect(() => {
    if (isAtPresent && !categoryFilter) {
      setDensityState(density);
      setTotalClaimCount(density.reduce((sum, d) => sum + d.claimCount, 0));
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoadingDensity(true);
      try {
        const url =
          isAtPresent && categoryFilter
            ? `/api/globe/density?category=${categoryFilter}`
            : `/api/globe/density-temporal?before=${currentYear}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data)) {
          setDensityState(data);
          setTotalClaimCount(data.reduce((sum: number, d: DensityRow) => sum + d.claimCount, 0));
        } else {
          setDensityState(data.countries);
          setTotalClaimCount(data.totalClaimCount);
        }
      } finally {
        if (!cancelled) setLoadingDensity(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [currentYear, isAtPresent, density, categoryFilter]);

  // Fetch city clusters when entering cities mode
  useEffect(() => {
    if (viewMode !== "cities") return;
    if (citiesData !== null) return;
    let cancelled = false;
    setLoadingCities(true);
    (async () => {
      try {
        const res = await fetch("/api/globe/cities");
        if (!res.ok) return;
        const data: CityCluster[] = await res.json();
        if (cancelled) return;
        setCitiesData(data);
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

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
    }, 1000);
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
      const [globeModule, threeModule] = await Promise.all([import("globe.gl"), import("three")]);
      const GlobeGL = globeModule.default;
      threeRef.current = threeModule;
      const modernSelection = getGeoJSONForYear(MAX_YEAR);
      const res = await fetch(modernSelection.path);
      const geo = await res.json();

      if (cancelled || !containerRef.current) return;

      geoCache.current.set(modernSelection.path, geo);
      currentSourceRef.current = "modern";
      modernFeaturesRef.current = geo.features;

      const el = containerRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      globeInstance = new (GlobeGL as any)(el)
        .width(el.clientWidth)
        .height(el.clientHeight)
        .backgroundColor("rgba(0,0,0,0)")
        .showAtmosphere(true)
        .atmosphereColor(LIGHTS_PARAMS.atmosColor)
        .atmosphereAltitude(LIGHTS_PARAMS.atmosAlt)
        .hexPolygonsData(geo.features)
        .hexPolygonResolution(LIGHTS_PARAMS.hexRes)
        .hexPolygonMargin(LIGHTS_PARAMS.hexMargin)
        .hexPolygonAltitude(0.002)
        .hexPolygonColor(() => `rgb(${LIGHTS_PARAMS.hexBase.join(",")})`)
        .polygonsData(geo.features)
        .polygonCapColor(() => "rgba(0,0,0,0)")
        .polygonStrokeColor(() => "rgba(0,0,0,0)")
        .polygonSideColor(() => "rgba(0,0,0,0)")
        .polygonAltitude(0.006)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .onPolygonHover((feat: any, _prev: unknown, ev: MouseEvent) => {
          if (!feat) {
            setTooltip(null);
            if (viewModeRef.current !== "cities") {
              hoveredFeatRef.current = null;
              if (currentSourceRef.current === "modern") {
                globeRef.current?.polygonCapColor(() => "rgba(0,0,0,0)");
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
          if (viewModeRef.current !== "cities" && currentSourceRef.current === "modern") {
            hoveredFeatRef.current = feat;
            const hovered = feat;
            globeRef.current?.polygonCapColor(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (f: any) => (f === hovered ? "rgba(96,116,160,0.16)" : "rgba(0,0,0,0)")
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

      // hexPolygonUseDots exists at runtime but is missing from globe.gl's types.
      const maybeDots = globeInstance as { hexPolygonUseDots?: (v: boolean) => unknown };
      if (typeof maybeDots.hexPolygonUseDots === "function") {
        maybeDots.hexPolygonUseDots(true);
      }
      const globeMat = globeInstance.globeMaterial() as {
        color: { set: (c: string) => void };
        shininess?: number;
      };
      globeMat.color.set(LIGHTS_PARAMS.globeColor);
      if ("shininess" in globeMat) globeMat.shininess = 0;

      oceanRef.current = createOceanGrid(threeModule, globeInstance.getGlobeRadius());
      globeInstance.scene().add(oceanRef.current.points);

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
          lightsRef.current?.dispose();
          oceanRef.current?.dispose();
        } catch {}
        lightsRef.current = null;
        oceanRef.current = null;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globeInstance as any)._destructor?.();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 1: Prefetch origin cities as anchors for the lights
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/globe/origins");
        if (!res.ok) return;
        const data: OriginPoint[] = await res.json();
        if (cancelled) return;
        anchorsRef.current = data.map((o) => ({ lat: o.lat, lon: o.lon, claimCount: o.claimCount }));
        setAnchorsVersion((v) => v + 1);
      } catch {
        // anchors are optional
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Effect 2: Build/rebuild claim-lights point cloud
  useEffect(() => {
    const globe = globeRef.current;
    const THREE = threeRef.current;
    const feats = modernFeaturesRef.current;
    if (!globeReady || !globe || !THREE || !feats) return;

    const source = currentGeoSelection?.source ?? "modern";
    const show = viewMode === "heatmap" && source === "modern";
    if (lightsRef.current) lightsRef.current.group.visible = show;
    if (!show) return;

    const sig = `${totalClaimCount}:${densityState.length}:${categoryFilter ?? "all"}:${anchorsVersion}`;
    if (lightsSigRef.current === sig && lightsRef.current) return;
    lightsSigRef.current = sig;

    const dots = buildLightDots(feats, densityState, anchorsRef.current);
    if (lightsRef.current) {
      globe.scene().remove(lightsRef.current.group);
      lightsRef.current.dispose();
      lightsRef.current = null;
    }
    const lights = createLightsObject(
      THREE,
      (lat: number, lng: number, alt: number) => globe.getCoords(lat, lng, alt),
      dots
    );
    globe.scene().add(lights.group);
    lightsRef.current = lights;
  }, [globeReady, viewMode, densityState, totalClaimCount, currentGeoSelection, categoryFilter, anchorsVersion]);

  // Effect 3: Tint land hex dots by density
  useEffect(() => {
    if (!globeRef.current || !globeReady) return;
    const source = currentGeoSelection?.source ?? "modern";
    if (source !== "modern") return;
    globeRef.current.hexPolygonColor(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (feat: any) => {
        const code = feat.properties?.ISO_A2 ?? feat.properties?.iso_a2;
        const row = code ? densityMap.get(code) : undefined;
        return hexDotColor(row?.claimCount ?? 0, maxCount);
      }
    );
  }, [densityMap, maxCount, globeReady, currentGeoSelection]);

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

    globeRef.current.hexPolygonsData(source === "modern" ? modernFeaturesRef.current ?? [] : []);

    if (viewMode === "heatmap") {
      if (source === "modern") {
        globeRef.current
          .polygonCapColor(() => "rgba(0,0,0,0)")
          .polygonStrokeColor(() => "rgba(0,0,0,0)")
          .polygonSideColor(() => "rgba(0,0,0,0)")
          .polygonAltitude(0.006)
          .pointsData([])
          .ringsData([]);
      } else {
        // Historical era — sepia/parchment fill; click disabled.
        globeRef.current
          .polygonCapColor(() => "#2e2820")
          .polygonStrokeColor(() => "#5a4a3a")
          .polygonSideColor(() => "rgba(20,15,10,0.6)")
          .polygonAltitude(0.005)
          .pointsData([])
          .ringsData([]);
      }
    } else if (viewMode === "origins") {
      // Origins mode
      const pts = originsData ?? [];
      const maxOrigin = Math.max(...pts.map((d) => d.claimCount), 1);

      globeRef.current
        .polygonCapColor(() => "rgba(0,0,0,0)")
        .polygonSideColor(() => "rgba(0,0,0,0)")
        .polygonStrokeColor(() => "rgba(0,0,0,0)")
        .polygonAltitude(0.006);

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
        .ringsData([]);
    } else {
      // Cities mode
      const pts = citiesData ?? [];
      const maxCity = Math.max(...pts.map((d) => d.claimCount), 1);

      globeRef.current
        .polygonCapColor(() => "rgba(0,0,0,0)")
        .polygonSideColor(() => "rgba(0,0,0,0)")
        .polygonStrokeColor(() => "rgba(0,0,0,0)")
        .polygonAltitude(0.006)
        .pointsData(pts)
        .pointLat((d: CityCluster) => d.lat)
        .pointLng((d: CityCluster) => d.lon)
        .pointAltitude(0.01)
        .pointRadius((d: CityCluster) => {
          const t = Math.log(d.claimCount + 1) / Math.log(maxCity + 1);
          return 0.1 + t * 1.1;
        })
        .pointColor((d: CityCluster) => {
          const t = Math.log(d.claimCount + 1) / Math.log(maxCity + 1);
          const alpha = 0.4 + t * 0.6;
          return `rgba(56,189,248,${alpha})`;
        })
        .pointsMerge(false)
        .pointLabel((d: CityCluster) => `${d.city ?? d.countryCode}: ${d.claimCount.toLocaleString()} claims`)
        .onPointClick((d: CityCluster) => openCitySidebar(d.lat, d.lon));

      // Hex density overlay
      if (hexOverlay && hexRings.length > 0) {
        globeRef.current
          .ringsData(hexRings)
          .ringLat((d: HexRing) => d.lat)
          .ringLng((d: HexRing) => d.lng)
          .ringMaxRadius((d: HexRing) => d.maxRadius)
          .ringPropagationSpeed((d: HexRing) => d.propagationSpeed)
          .ringRepeatPeriod((d: HexRing) => d.repeatPeriod)
          .ringColor((_d: HexRing) => (t: number) => `rgba(245,158,11,${(1 - t) * 0.4})`);
      } else {
        globeRef.current.ringsData([]);
      }
    }
     
  }, [viewMode, globeReady, densityMap, maxCount, originsData, currentGeoSelection, citiesData, openCitySidebar, hexOverlay, hexRings]);

  return (
    <div className="relative" style={{ width: "100%", height: "90vh", background: "#050505" }}>
      {/* Decorative ×-pattern backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: BACKDROP_PATTERN_URI,
          WebkitMaskImage: BACKDROP_PATTERN_MASK,
          maskImage: BACKDROP_PATTERN_MASK,
        }}
      />
      <div ref={containerRef} className="w-full h-full relative" />

      {!globeReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#050505]">
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

      {/* View mode pill toggle + category chips */}
      <div className="fixed top-[52px] right-4 z-40 flex flex-col items-end gap-2">
        <div className="relative flex items-center bg-gray-900/80 backdrop-blur border border-gray-700 rounded-full p-1">
          <div
            className="absolute top-1 bottom-1 rounded-full bg-amber-500 transition-transform duration-300 ease-in-out"
            style={{
              width: "calc(33.333% - 4px)",
              transform:
                viewMode === "heatmap"
                  ? "translateX(0)"
                  : viewMode === "origins"
                  ? "translateX(calc(100% + 8px))"
                  : "translateX(calc(200% + 16px))",
            }}
          />
          <button
            type="button"
            onClick={() => setViewMode("heatmap")}
            className={`relative z-10 px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 ${
              viewMode === "heatmap" ? "text-gray-900" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Lights
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
          <button
            type="button"
            onClick={() => setViewMode("cities")}
            className={`relative z-10 px-3 py-1 text-xs font-medium rounded-full transition-colors duration-200 ${
              viewMode === "cities" ? "text-gray-900" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Cities
          </button>
        </div>

        {viewMode === "heatmap" && (
          <div className="flex flex-wrap justify-end gap-1.5 bg-gray-900/80 backdrop-blur border border-gray-700 rounded-full p-1 max-w-[20rem]">
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setCurrentYear(MAX_YEAR);
                setCategoryFilter(null);
              }}
              className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full transition-colors ${
                categoryFilter === null
                  ? "bg-white text-gray-900"
                  : "text-gray-400 hover:text-gray-100"
              }`}
              title="All claim categories"
            >
              All
            </button>
            {CATEGORY_SLUGS.map((slug) => {
              const active = categoryFilter === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentYear(MAX_YEAR);
                    setCategoryFilter(slug);
                  }}
                  className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full transition-colors ${
                    active
                      ? "bg-white text-gray-900"
                      : "text-gray-400 hover:text-gray-100"
                  }`}
                  title={`Filter heatmap to ${CATEGORY_LABELS[slug]} pipelines`}
                >
                  {CATEGORY_LABELS[slug]}
                </button>
              );
            })}
          </div>
        )}
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
                {loadingDensity || loadingOrigins || loadingCities ? (
                  "Loading…"
                ) : isAtPresent && categoryFilter ? (
                  `${totalClaimCount.toLocaleString()} claims in ${CATEGORY_LABELS[categoryFilter]}`
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
            style={{ background: "linear-gradient(to right, #6b2b0d, #f59e0b, #ffd34d)" }}
          />
          <span>High</span>
          <span className="ml-2 text-gray-500">each dot ≈ a cluster of claims</span>
          <span className="mx-2 text-gray-700">|</span>
          <Link
            href="/globe/connections"
            className="text-amber-400 hover:text-amber-300 transition-colors"
          >
            Connections →
          </Link>
        </div>
      )}
      {viewMode === "heatmap" && currentGeoSelection?.source === "historical" && (
        <div className="fixed bottom-[120px] left-6 z-30 flex items-center gap-2 bg-gray-900/80 rounded-lg px-3 py-2 border border-gray-800 text-xs text-gray-400">
          <div className="w-4 h-3 rounded" style={{ background: "#2e2820", border: "1px solid #5a4a3a" }} />
          <span className="text-amber-400">Historical borders</span>
          <span className="text-gray-500">— click disabled</span>
        </div>
      )}

      {viewMode === "cities" && (
        <div className="fixed bottom-[120px] left-6 z-30">
          <button
            type="button"
            onClick={() => setHexOverlay((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-colors ${
              hexOverlay
                ? "bg-amber-900/40 border-amber-600 text-amber-300"
                : "bg-gray-900/80 border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-600"
            }`}
          >
            <span>◈</span>
            <span>Hex density</span>
          </button>
        </div>
      )}

      {/* Sidebar */}
      {(loadingSidebar || sidebar) && viewMode !== "cities" && (
        <div
          className="fixed right-0 w-80 bg-gray-950/95 border-l border-gray-800 flex flex-col shadow-2xl overflow-hidden z-40"
          style={{ top: 45, bottom: 0 }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            {sidebar ? (
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl shrink-0">{countryFlag(sidebar.countryCode)}</span>
                  <span className="font-semibold text-white truncate">{sidebar.countryName}</span>
                </div>
                <div className="mt-0.5 text-xs text-gray-400">
                  {claimsPage ? (
                    <span className="text-amber-400 font-medium">{claimsPage.total.toLocaleString()}</span>
                  ) : (
                    <span className="text-amber-400 font-medium">{sidebar.claimCount.toLocaleString()}</span>
                  )}
                  <span className="ml-1">claims via polity links</span>
                </div>
              </div>
            ) : (
              <span className="text-gray-400 text-sm">Loading…</span>
            )}
            <button
              onClick={() => { setSidebar(null); setClaimsPage(null); setClaimsOffset(0); }}
              className="text-gray-500 hover:text-white ml-4 text-lg leading-none shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {(claimsPage && claimsPage.total > 0) && (
            <div className="px-5 py-3 border-b border-gray-800 space-y-2">
              <input
                type="text"
                value={claimFilter}
                onChange={(e) => setClaimFilter(e.target.value)}
                placeholder="Filter loaded claims…"
                className="w-full px-3 py-1.5 text-sm rounded-md bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30"
                aria-label="Filter claims"
              />
              <p className="text-xs text-gray-500">
                {claimFilter ? `${filteredClaims.length} matching` : `${claimsPage.claims.length} loaded`}
                {" · "}
                {claimsPage.total.toLocaleString()} total
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {(loadingSidebar || loadingClaims) && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
              </div>
            )}
            {!loadingClaims && filteredClaims.map((claim) => (
              <Link
                key={claim.id}
                href={`/claims/${claim.id}`}
                prefetch={false}
                className="block rounded-lg border border-gray-800 bg-gray-900 p-3 hover:border-gray-600 transition-colors cursor-pointer"
              >
                <p className="text-sm text-gray-200 line-clamp-3">{claim.text}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded border ${claimBadge(claim.currentStatus)}`}
                  >
                    {claim.currentStatus.replace("_", " ")}
                  </span>
                  {claim.verificationStatus && (
                    <span className="text-xs px-1.5 py-0.5 rounded border bg-gray-800/60 text-gray-400 border-gray-700">
                      {claim.verificationStatus}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 truncate">{claim.ingestedBy}</span>
                </div>
              </Link>
            ))}
            {!loadingClaims && claimsPage && claimsPage.total === 0 && (
              <p className="text-gray-500 text-sm py-4 text-center">No polity-linked claims found for this country.</p>
            )}
            {!loadingClaims && claimsPage && claimsPage.total > 0 && filteredClaims.length === 0 && claimFilter && (
              <p className="text-gray-500 text-sm py-4 text-center">No loaded claims match your filter.</p>
            )}
            {/* Load more — hard-capped; beyond the cap, hand off to paginated /search */}
            {!loadingClaims && claimsPage && !claimFilter && claimsPage.claims.length < claimsPage.total && (
              claimsPage.claims.length < MAX_LOADED_CLAIMS ? (
                <div className="py-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => sidebar && loadMoreClaims(sidebar.countryCode, claimsOffset + 20)}
                    disabled={loadingMoreClaims}
                    className="px-4 py-1.5 text-xs rounded border border-amber-700/60 text-amber-400 hover:bg-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loadingMoreClaims ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full border border-amber-400 border-t-transparent animate-spin inline-block" />
                        Loading…
                      </span>
                    ) : (
                      `Load more (${(claimsPage.total - claimsPage.claims.length).toLocaleString()} remaining)`
                    )}
                  </button>
                </div>
              ) : (
                <div className="py-3 text-center space-y-1">
                  <p className="text-xs text-gray-500">
                    Showing the first {MAX_LOADED_CLAIMS} of {claimsPage.total.toLocaleString()} claims.
                  </p>
                  <Link
                    href={`/search?country=${claimsPage.countryCode}`}
                    className="inline-block text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    Continue in search — fully paginated →
                  </Link>
                </div>
              )
            )}
          </div>

          {sidebar && (
            <div className="px-5 py-3 border-t border-gray-800">
              <Link
                href={`/search?country=${sidebar.countryCode}`}
                className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                View all claims from {sidebar.countryName} →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* City sidebar */}
      {viewMode === "cities" && (loadingCitySidebar || citySidebar) && (
        <div
          className="fixed right-0 w-80 bg-gray-950/95 border-l border-gray-800 flex flex-col shadow-2xl overflow-hidden z-40"
          style={{ top: 45, bottom: 0 }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            {citySidebar ? (
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  {citySidebar.countryCode && (
                    <span className="text-2xl shrink-0">{countryFlag(citySidebar.countryCode)}</span>
                  )}
                  <span className="font-semibold text-white truncate">
                    {citySidebar.city ?? "Unknown city"}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-gray-400">
                  <span className="text-sky-400 font-medium">{citySidebar.total.toLocaleString()}</span>
                  <span className="ml-1">claims</span>
                </div>
              </div>
            ) : (
              <span className="text-gray-400 text-sm">Loading…</span>
            )}
            <button
              onClick={() => setCitySidebar(null)}
              className="text-gray-500 hover:text-white ml-4 text-lg leading-none shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {loadingCitySidebar && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
              </div>
            )}
            {!loadingCitySidebar && citySidebar && citySidebar.claims.map((claim) => (
              <Link
                key={claim.id}
                href={`/claims/${claim.id}`}
                prefetch={false}
                className="block rounded-lg border border-gray-800 bg-gray-900 p-3 hover:border-gray-600 transition-colors cursor-pointer"
              >
                <p className="text-sm text-gray-200 line-clamp-3">
                  {claim.title ?? claim.claimType}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {claim.epistemicAxis && (
                    <span className="text-xs px-1.5 py-0.5 rounded border bg-sky-900/50 text-sky-300 border-sky-800">
                      {claim.epistemicAxis}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 truncate">{claim.ingestedBy}</span>
                </div>
              </Link>
            ))}
            {!loadingCitySidebar && citySidebar && citySidebar.claims.length === 0 && (
              <p className="text-gray-500 text-sm py-4 text-center">No claims found for this city.</p>
            )}
            {!loadingCitySidebar && citySidebar && citySidebar.claims.length >= MAX_LOADED_CLAIMS && citySidebar.claims.length < citySidebar.total && (
              <div className="py-3 text-center space-y-1">
                <p className="text-xs text-gray-500">
                  Showing the first {MAX_LOADED_CLAIMS} of {citySidebar.total.toLocaleString()} claims.
                </p>
                {citySidebar.countryCode && (
                  <Link
                    href={`/search?country=${citySidebar.countryCode}`}
                    className="inline-block text-xs text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    Continue in search — fully paginated →
                  </Link>
                )}
              </div>
            )}
            {!loadingCitySidebar && citySidebar && citySidebar.claims.length < MAX_LOADED_CLAIMS && citySidebar.claims.length < citySidebar.total && (
              <div className="py-2 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMoreCityClaims}
                  onClick={async () => {
                    if (!citySidebar) return;
                    const nextPage = cityClaimsPage + 1;
                    const cityKey = `${Math.round(citySidebar.lat * 10) / 10}_${Math.round(citySidebar.lon * 10) / 10}`;
                    setLoadingMoreCityClaims(true);
                    try {
                      const res = await fetch(`/api/globe/city/${cityKey}?page=${nextPage}&limit=20`);
                      if (!res.ok) return;
                      const data: CitySidebarData = await res.json();
                      setCitySidebar((prev) =>
                        prev ? { ...prev, claims: [...prev.claims, ...data.claims] } : data
                      );
                      setCityClaimsPage(nextPage);
                    } finally {
                      setLoadingMoreCityClaims(false);
                    }
                  }}
                  className="px-4 py-1.5 text-xs rounded border border-sky-700/60 text-sky-400 hover:bg-sky-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingMoreCityClaims ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border border-sky-400 border-t-transparent animate-spin inline-block" />
                      Loading…
                    </span>
                  ) : (
                    `Load more (${(citySidebar.total - citySidebar.claims.length).toLocaleString()} remaining)`
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

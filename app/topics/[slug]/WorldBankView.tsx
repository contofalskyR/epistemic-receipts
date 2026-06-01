"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import WorldBankChart, { colorForIso3 } from "./WorldBankChart";

type Indicator = { code: string; label: string; unit: string; claimCount: number };
type Country = { iso3: string; name: string; claimCount: number };
type SeriesMap = Record<string, { name: string; points: { year: number; value: number }[] }>;
type ClaimRow = {
  id: string;
  text: string;
  currentStatus: string;
  claimType: string;
  iso3: string;
  countryName: string;
  year: number;
  value: number;
  indicatorCode: string;
  indicatorLabel: string;
};

type Payload = {
  indicator: string;
  indicators: Indicator[];
  countries: Country[];
  countriesTotal: number;
  seriesByIso3: SeriesMap;
  defaultSelectedIso3: string[];
  claims: ClaimRow[];
  page: number;
  pages: number;
  total: number;
  pageSize: number;
};

const STATUS_STYLE: Record<string, string> = {
  HARD_FACT: "bg-green-900 text-green-300",
  NEVER_RESOLVES: "bg-gray-700 text-gray-400",
  DISPUTED: "bg-yellow-900 text-yellow-300",
};

function formatValue(v: number, code: string): string {
  if (code === "NY.GDP.MKTP.CD" || code === "NY.GDP.PCAP.CD") {
    if (Math.abs(v) >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
    if (Math.abs(v) >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
    if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (Math.abs(v) >= 1e3) return "$" + (v / 1e3).toFixed(1) + "k";
    return "$" + v.toFixed(0);
  }
  if (code === "SP.POP.TOTL") {
    if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + "B";
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + "M";
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + "k";
    return v.toLocaleString();
  }
  if (code === "SP.DYN.LE00.IN") return v.toFixed(1) + " yrs";
  if (code === "EN.GHG.CO2.PC.CE.AR5") return v.toFixed(2) + " t";
  return v.toLocaleString();
}

function makeFormatter(code: string): (v: number) => string {
  return (v: number) => formatValue(v, code);
}

export default function WorldBankView({ topicName, topicTotal }: { topicName: string; topicTotal: number }) {
  const [indicator, setIndicator] = useState<string>("NY.GDP.PCAP.CD"); // GDP per capita as default
  const [countryQuery, setCountryQuery] = useState<string>("");
  const [debouncedCountryQuery, setDebouncedCountryQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [selectedIso3, setSelectedIso3] = useState<string[]>([]);
  const [userTouchedSelection, setUserTouchedSelection] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);

  // Debounce country search input
  useEffect(() => {
    const id = setTimeout(() => setDebouncedCountryQuery(countryQuery), 250);
    return () => clearTimeout(id);
  }, [countryQuery]);

  // Fetch payload whenever indicator / search / page changes
  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page) });
    if (indicator) qs.set("indicator", indicator);
    if (debouncedCountryQuery) qs.set("country", debouncedCountryQuery);
    fetch(`/api/topics/world-bank-indicators/data?${qs.toString()}`)
      .then(r => r.json())
      .then((d: Payload) => {
        setData(d);
        // Reset chart selection when indicator changes (unless user has explicitly picked)
        if (!userTouchedSelection || selectedIso3.length === 0) {
          setSelectedIso3(d.defaultSelectedIso3);
        }
      })
      .finally(() => setLoading(false));
  }, [indicator, debouncedCountryQuery, page]); // eslint-disable-line react-hooks/exhaustive-deps

  function switchIndicator(code: string) {
    setIndicator(code);
    setPage(1);
    setUserTouchedSelection(false);
    setSelectedIso3([]); // will be refilled with defaultSelectedIso3 from API
  }

  function toggleCountry(iso3: string) {
    setUserTouchedSelection(true);
    setSelectedIso3(prev =>
      prev.includes(iso3) ? prev.filter(x => x !== iso3) : [...prev, iso3]
    );
  }

  const activeIndicator = useMemo(
    () => data?.indicators.find(i => i.code === indicator) ?? null,
    [data, indicator]
  );

  const chartSeries = useMemo(() => {
    if (!data) return [];
    return selectedIso3
      .map(iso3 => {
        const s = data.seriesByIso3[iso3];
        if (!s) return null;
        return { iso3, name: s.name, points: s.points };
      })
      .filter((s): s is { iso3: string; name: string; points: { year: number; value: number }[] } => s !== null);
  }, [data, selectedIso3]);

  if (!data) {
    return <p className="text-gray-600 text-sm">Loading…</p>;
  }

  const formatter = makeFormatter(indicator);

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
        <Link href="/topics" className="hover:text-gray-300 transition-colors">Topics</Link>
        <span className="text-gray-700">›</span>
        <Link href="/domains/economics" className="hover:text-gray-300 transition-colors">Economics</Link>
        <span className="text-gray-700">›</span>
        <span className="text-gray-300">{topicName}</span>
      </nav>

      {/* Heading */}
      <div className="border-b border-gray-800 pb-6 space-y-2">
        <h1 className="text-xl font-semibold text-white">{topicName}</h1>
        <p className="text-sm text-gray-400">
          Country-year observations from the{" "}
          <a href="https://data.worldbank.org/" target="_blank" rel="noopener noreferrer"
             className="text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline">
            World Bank Open Data API
          </a>
          {" "}— GDP, GDP per capita, population, life expectancy, and CO₂ emissions per capita.
          Time series 1990–2022. Compare countries on a single indicator using the chart below.
        </p>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span>{topicTotal.toLocaleString()} claims</span>
          <span className="text-gray-800">·</span>
          <span>{data.countriesTotal} countries</span>
          <span className="text-gray-800">·</span>
          <Link href="/domains/economics" className="hover:text-gray-300 transition-colors">
            Economics
          </Link>
        </div>
      </div>

      {/* Indicator chips */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Indicator</h2>
        <div className="flex flex-wrap gap-2">
          {data.indicators.map(ind => (
            <button
              key={ind.code}
              onClick={() => switchIndicator(ind.code)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                indicator === ind.code
                  ? "border-blue-500 bg-blue-950 text-blue-200"
                  : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200"
              }`}
            >
              {ind.label}{" "}
              <span className="opacity-60 tabular-nums">({ind.claimCount.toLocaleString()})</span>
            </button>
          ))}
        </div>
      </section>

      {/* Comparison chart */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Compare countries over time
            </h2>
            <p className="text-[11px] text-gray-600 mt-1">
              Click a country below the chart to toggle it on or off. Defaults to a small set of large economies.
            </p>
          </div>
          <button
            onClick={() => {
              setUserTouchedSelection(false);
              setSelectedIso3(data.defaultSelectedIso3);
            }}
            className="text-[11px] text-gray-500 hover:text-gray-300 underline-offset-2 hover:underline"
          >
            Reset to defaults
          </button>
        </div>
        <WorldBankChart
          series={chartSeries}
          unit={activeIndicator?.unit ?? ""}
          indicatorLabel={activeIndicator?.label ?? ""}
          yFormatter={formatter}
          tooltipFormatter={formatter}
        />
      </section>

      {/* Country filter */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Countries</h2>
          <span className="text-[11px] text-gray-600 tabular-nums">
            {data.countries.length} of {data.countriesTotal} countries
          </span>
        </div>
        <input
          type="text"
          value={countryQuery}
          onChange={e => { setCountryQuery(e.target.value); setPage(1); }}
          placeholder="Filter countries by name…"
          className="w-full max-w-md text-xs px-3 py-2 rounded border border-gray-700 bg-gray-900 text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
        />
        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-2">
          {data.countries.map((c) => {
            const isOn = selectedIso3.includes(c.iso3);
            const colorIdx = selectedIso3.indexOf(c.iso3);
            return (
              <button
                key={c.iso3}
                onClick={() => toggleCountry(c.iso3)}
                disabled={!data.seriesByIso3[c.iso3]}
                title={data.seriesByIso3[c.iso3] ? `Toggle ${c.name}` : `No data for ${c.name} on this indicator`}
                className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border transition-colors ${
                  isOn
                    ? "border-gray-300 bg-gray-800 text-white"
                    : "border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                {isOn && (
                  <span
                    className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                    style={{ background: colorForIso3(c.iso3, colorIdx) }}
                  />
                )}
                <span>{c.name}</span>
                <span className="opacity-60 tabular-nums">({c.claimCount})</span>
              </button>
            );
          })}
          {data.countries.length === 0 && (
            <p className="text-[11px] text-gray-600">No countries match &quot;{countryQuery}&quot;.</p>
          )}
        </div>
      </section>

      {/* Claims */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Claims {data.total > 0 && `(${data.total.toLocaleString()})`}
          </h2>
          <p className="text-[11px] text-gray-600">Sorted alphabetically by country, then by year (newest first).</p>
        </div>

        {data.total === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-8 text-center">
            <p className="text-gray-600 text-sm">No claims match the current filter.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.claims.map(c => (
              <Link
                key={c.id}
                href={`/claims/${c.id}`}
                className="block rounded-lg border border-gray-800 bg-gray-900 px-4 py-2.5 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <p className="text-sm text-gray-200 leading-snug">{c.text}</p>
                  <span className="text-[11px] text-gray-500 font-mono tabular-nums whitespace-nowrap">
                    {c.iso3} · {c.year}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[c.currentStatus] ?? STATUS_STYLE.DISPUTED}`}>
                    {c.currentStatus}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">
                    {c.indicatorLabel}
                  </span>
                  <span className="text-[10px] text-gray-500 tabular-nums">
                    {formatter(c.value)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {data.pages > 1 && (
          <div className="flex items-center gap-2 mt-4 text-xs text-gray-600">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="hover:text-gray-400 disabled:opacity-30 transition-colors"
            >
              ← Previous
            </button>
            <span className="text-gray-800">·</span>
            <span>Page {data.page} of {data.pages}</span>
            <span className="text-gray-800">·</span>
            <button
              onClick={() => setPage(p => Math.min(data.pages, p + 1))}
              disabled={page >= data.pages || loading}
              className="hover:text-gray-400 disabled:opacity-30 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

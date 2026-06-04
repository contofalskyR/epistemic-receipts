"use client"

import { useEffect, useMemo, useState } from "react"

interface Headline {
  headline: string
  url: string
  date: string
}

interface BillRow {
  id: number
  claimId: string
  title: string
  externalId: string | null
  billType: string | null
  articleCount: number
  topHeadlines: Headline[]
  searchQuery: string
  lastChecked: string
  topics: string[]
  status: string
  statusLabel: string
}

interface ApiResponse {
  bills: BillRow[]
  stats: {
    total: number
    analyzed?: number
    withCoverage: number
    zeroCoverage: number
    avgArticles: number
    lastRefreshed: string | null
  }
  note?: string
}

const STATUS_COLOR: Record<string, string> = {
  "status-enacted": "bg-green-900/40 text-green-200 border-green-800/60",
  "status-passed-senate": "bg-blue-900/30 text-blue-200 border-blue-800/60",
  "status-passed-house": "bg-blue-900/30 text-blue-200 border-blue-800/60",
  "status-vetoed": "bg-red-900/30 text-red-200 border-red-800/60",
  "status-failed": "bg-red-900/30 text-red-200 border-red-800/60",
  "status-introduced": "bg-zinc-800/60 text-zinc-300 border-zinc-700",
  "status-in-progress": "bg-amber-900/30 text-amber-200 border-amber-800/60",
}

const STATUS_RANK: Record<string, number> = {
  "status-enacted": 0,
  "status-vetoed": 1,
  "status-passed-senate": 2,
  "status-passed-house": 2,
  "status-failed": 3,
  "status-in-progress": 4,
  "status-introduced": 5,
}

function extractTitle(billText: string): string {
  const quoted = billText.match(/[“"]([^“”"]{3,200})[”"]/)
  if (quoted) return quoted[1]!
  const dashSplit = billText.split(/[—–-]\s*/)[0]
  return (dashSplit ?? billText).slice(0, 140)
}

function extractBillLabel(externalId: string | null, fallback: string): string {
  if (!externalId) return fallback
  const m = externalId.match(/_(hr|s|hjres|sjres|hconres|sconres|hres|sres)_(\d+)$/)
  if (!m) return fallback
  const t = m[1]!
  const n = m[2]!
  const display: Record<string, string> = {
    hr: "H.R.", s: "S.",
    hjres: "H.J.Res.", sjres: "S.J.Res.",
    hconres: "H.Con.Res.", sconres: "S.Con.Res.",
    hres: "H.Res.", sres: "S.Res.",
  }
  return `${display[t] ?? t.toUpperCase()} ${n}`
}

function StatusBadge({ slug, label }: { slug: string; label: string }) {
  const cls = STATUS_COLOR[slug] ?? "bg-zinc-800/60 text-zinc-300 border-zinc-700"
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  )
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null
  return (
    <span className="inline-block rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">
      {type}
    </span>
  )
}

function BillCard({ bill, expanded, onToggle, dim }: {
  bill: BillRow
  expanded: boolean
  onToggle: () => void
  dim?: boolean
}) {
  const title = extractTitle(bill.title)
  const billLabel = extractBillLabel(bill.externalId, bill.billType ?? "")
  return (
    <div className={`rounded border border-zinc-800 bg-zinc-950 p-3 space-y-2 ${dim ? "opacity-90" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={bill.billType} />
            <StatusBadge slug={bill.status} label={bill.statusLabel} />
            {billLabel && (
              <span className="text-[11px] font-mono text-zinc-500">{billLabel}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-100">{title}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500 font-mono">
            NYT query: &ldquo;{bill.searchQuery}&rdquo;
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-2xl font-semibold tabular-nums ${bill.articleCount === 0 ? "text-zinc-600" : "text-amber-300"}`}>
            {bill.articleCount.toLocaleString()}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">NYT articles</div>
        </div>
      </div>

      {bill.topHeadlines.length > 0 && (
        <div>
          <button
            type="button"
            onClick={onToggle}
            className="text-xs text-zinc-400 hover:text-blue-300 transition-colors"
          >
            {expanded ? "▾" : "▸"} Top {bill.topHeadlines.length} {bill.topHeadlines.length === 1 ? "headline" : "headlines"}
          </button>
          {expanded && (
            <ul className="mt-1 space-y-1 border-l border-zinc-800 pl-3">
              {bill.topHeadlines.map((h, i) => (
                <li key={i} className="text-xs">
                  {h.url ? (
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-300 hover:text-blue-200 transition-colors"
                    >
                      {h.headline}
                    </a>
                  ) : (
                    <span className="text-zinc-300">{h.headline}</span>
                  )}
                  {h.date && (
                    <span className="ml-2 text-[10px] text-zinc-600 font-mono">
                      {h.date.slice(0, 10)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-24 rounded border border-zinc-800 bg-zinc-950 animate-pulse"
        />
      ))}
    </div>
  )
}

export default function MediaCoveragePage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch("/api/stats/media-coverage?limit=500")
      .then(r => {
        if (!r.ok) throw new Error(`API ${r.status}`)
        return r.json() as Promise<ApiResponse>
      })
      .then(j => { if (active) { setData(j); setLoading(false) } })
      .catch(e => { if (active) { setError(e.message); setLoading(false) } })
    return () => { active = false }
  }, [])

  function toggle(id: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const topCovered = useMemo<BillRow[]>(() => {
    if (!data) return []
    return [...data.bills]
      .filter(b => b.articleCount > 0)
      .sort((a, b) => b.articleCount - a.articleCount)
      .slice(0, 20)
  }, [data])

  const enactedDarkMatter = useMemo<BillRow[]>(() => {
    if (!data) return []
    return [...data.bills].filter(b => b.articleCount === 0 && b.status === "status-enacted")
  }, [data])

  const darkMatter = useMemo<BillRow[]>(() => {
    if (!data) return []
    return [...data.bills]
      .filter(b => b.articleCount === 0 && b.status !== "status-enacted")
      .sort((a, b) => {
        const ra = STATUS_RANK[a.status] ?? 99
        const rb = STATUS_RANK[b.status] ?? 99
        if (ra !== rb) return ra - rb
        return (b.lastChecked ?? "").localeCompare(a.lastChecked ?? "")
      })
      .slice(0, 30)
  }, [data])

  return (
    <div className="space-y-8 text-sm text-zinc-300">
      <header>
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Statistics</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Media Coverage Analysis</h1>
        <p className="mt-2 text-zinc-400">
          Which 119th Congress bills does the NYT cover — and which does it ignore?
        </p>
      </header>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 p-4 text-red-200">
          Failed to load coverage data: {error}
        </div>
      )}

      {loading && <Skeleton />}

      {!loading && data && data.bills.length === 0 && (
        <div className="rounded border border-zinc-800 bg-zinc-950 p-6 text-zinc-400">
          <p className="text-zinc-200 font-medium">Coverage data not yet computed.</p>
          <p className="mt-2 text-xs text-zinc-500">
            Run{" "}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-300 font-mono">
              npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json scripts/populate-bill-coverage.ts --limit 50
            </code>{" "}
            to seed the first batch.
          </p>
          {data.note && <p className="mt-2 text-xs text-zinc-500">{data.note}</p>}
        </div>
      )}

      {!loading && data && data.bills.length > 0 && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Bills tracked" value={data.stats.total.toLocaleString()} sub={data.stats.analyzed != null ? `${data.stats.analyzed.toLocaleString()} analyzed` : undefined} />
            <Stat
              label="With NYT coverage"
              value={`${data.stats.withCoverage.toLocaleString()}`}
              sub={data.stats.analyzed ? `${pctOf(data.stats.withCoverage, data.stats.analyzed)} of analyzed` : undefined}
              accent="text-amber-300"
            />
            <Stat
              label="Dark matter"
              value={`${data.stats.zeroCoverage.toLocaleString()}`}
              sub={data.stats.analyzed ? `${pctOf(data.stats.zeroCoverage, data.stats.analyzed)} of analyzed` : undefined}
              accent="text-zinc-400"
            />
            <Stat
              label="Avg articles / bill"
              value={data.stats.avgArticles.toFixed(2)}
              sub={data.stats.lastRefreshed ? `last refreshed ${data.stats.lastRefreshed.slice(0, 10)}` : undefined}
            />
          </section>

          {enactedDarkMatter.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-white">Laws You Never Heard Of</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  These bills were <span className="text-green-300 font-medium">enacted into law</span> but received{" "}
                  <span className="text-zinc-200 font-medium">zero NYT coverage</span>. They are now on the books.
                </p>
              </div>
              <div className="space-y-2">
                {enactedDarkMatter.map(b => (
                  <BillCard
                    key={b.id}
                    bill={b}
                    expanded={expanded.has(b.id)}
                    onToggle={() => toggle(b.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-white">Most Covered</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Top {topCovered.length} 119th Congress bills by NYT article count.
              </p>
            </div>
            {topCovered.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No bills with coverage in this batch.</p>
            ) : (
              <div className="space-y-2">
                {topCovered.map(b => (
                  <BillCard
                    key={b.id}
                    bill={b}
                    expanded={expanded.has(b.id)}
                    onToggle={() => toggle(b.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-white">Dark Matter</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Bills with <span className="text-zinc-300 font-medium">zero</span> NYT coverage,
                sorted by status (enacted first). These passed Congress&apos; attention but not the
                newspaper of record&apos;s.
              </p>
            </div>
            {darkMatter.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No zero-coverage bills in this batch.</p>
            ) : (
              <div className="space-y-2">
                {darkMatter.map(b => (
                  <BillCard
                    key={b.id}
                    bill={b}
                    expanded={expanded.has(b.id)}
                    onToggle={() => toggle(b.id)}
                    dim
                  />
                ))}
              </div>
            )}
          </section>

          <footer className="border-t border-zinc-800 pt-4 text-[11px] text-zinc-500 font-mono">
            NYT Article Search hit counts. Search query is generated from each bill&apos;s short
            title; relevance varies. Refresh via{" "}
            <code className="text-zinc-400">scripts/populate-bill-coverage.ts</code>.
          </footer>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent ?? "text-white"}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-zinc-500">{sub}</p>}
    </div>
  )
}

function pctOf(n: number, total: number): string {
  if (total <= 0) return "0%"
  return `${((n / total) * 100).toFixed(1)}%`
}

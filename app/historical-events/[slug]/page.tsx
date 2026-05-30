import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { extractPartyCounts } from "@/lib/voteAnalysis";

export const revalidate = 300;

const PAGE_SIZE = 50;

const CATEGORY_COLORS: Record<string, string> = {
  DIPLOMATIC: "bg-blue-900/40 text-blue-300 border-blue-800/60",
  INTELLIGENCE: "bg-purple-900/40 text-purple-300 border-purple-800/60",
  MILITARY: "bg-red-900/40 text-red-300 border-red-800/60",
  LEGISLATIVE: "bg-emerald-900/40 text-emerald-300 border-emerald-800/60",
};

const ROLE_COLORS: Record<string, string> = {
  primary: "bg-emerald-900/40 text-emerald-300 border-emerald-800/60",
  adversary: "bg-red-900/40 text-red-300 border-red-800/60",
  involved: "bg-blue-900/40 text-blue-300 border-blue-800/60",
};

const PARTY_COLORS: Record<string, string> = {
  Democratic: "#3b82f6",
  Republican: "#ef4444",
  Independent: "#a3a3a3",
  Labour: "#dc2626",
  Conservative: "#0ea5e9",
  "Liberal Democrat": "#f59e0b",
  SNP: "#facc15",
};

function partyColor(name: string): string {
  return PARTY_COLORS[name] ?? "#9ca3af";
}

function parseTopics(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

function formatYear(d: Date | null): string {
  if (!d) return "?";
  return String(d.getUTCFullYear());
}

function formatDate(d: Date | null): string {
  if (!d) return "?";
  return d.toISOString().slice(0, 10);
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function HistoricalEventDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const event = await prisma.historicalEvent.findUnique({
    where: { slug },
    include: {
      _count: { select: { claims: true, votes: true, polities: true } },
      polities: {
        include: {
          polity: {
            select: {
              id: true,
              name: true,
              countryCode: true,
              governmentType: true,
              startYear: true,
              endYear: true,
              wikidataId: true,
            },
          },
        },
      },
    },
  });
  if (!event) return notFound();

  const [voteLinks, totalVotes, allVoteSummaries, claimLinks] = await Promise.all([
    prisma.historicalEventVote.findMany({
      where: { eventId: event.id },
      orderBy: { vote: { voteDate: "desc" } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        vote: {
          select: {
            id: true,
            voteDate: true,
            chamber: true,
            result: true,
            yesCount: true,
            noCount: true,
            abstainCount: true,
            dataSource: true,
            topics: true,
            source: { select: { name: true, url: true } },
          },
        },
      },
    }),
    prisma.historicalEventVote.count({ where: { eventId: event.id } }),
    prisma.historicalEventVote.findMany({
      where: { eventId: event.id },
      select: {
        vote: {
          select: {
            voteDate: true,
            result: true,
            chamber: true,
            byPartyJson: true,
          },
        },
      },
    }),
    prisma.claimHistoricalEvent.findMany({
      where: { historicalEventId: event.id },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        claim: {
          select: {
            id: true,
            text: true,
            currentStatus: true,
            verificationStatus: true,
            claimEmergedAt: true,
          },
        },
      },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(totalVotes / PAGE_SIZE));

  // Aggregate result breakdown
  const resultCounts: Record<string, number> = {};
  for (const l of allVoteSummaries) {
    const r = l.vote.result ?? "unknown";
    resultCounts[r] = (resultCounts[r] ?? 0) + 1;
  }
  const passed = resultCounts["passed"] ?? 0;
  const failed = resultCounts["failed"] ?? 0;
  const tied = resultCounts["tied"] ?? 0;
  const otherResult = totalVotes - passed - failed - tied;
  const passRate = totalVotes > 0 ? (passed / totalVotes) * 100 : 0;

  // Yearly timeline
  const yearMap = new Map<number, { passed: number; failed: number; other: number; total: number }>();
  for (const l of allVoteSummaries) {
    const d = l.vote.voteDate;
    if (!d) continue;
    const year = d.getUTCFullYear();
    let b = yearMap.get(year);
    if (!b) {
      b = { passed: 0, failed: 0, other: 0, total: 0 };
      yearMap.set(year, b);
    }
    b.total++;
    if (l.vote.result === "passed") b.passed++;
    else if (l.vote.result === "failed") b.failed++;
    else b.other++;
  }
  // Fill gap years for axis truthfulness
  const timelineEntries = Array.from(yearMap.entries()).sort((a, b) => a[0] - b[0]);
  const minYear = timelineEntries.length > 0 ? timelineEntries[0][0] : null;
  const maxYear = timelineEntries.length > 0 ? timelineEntries[timelineEntries.length - 1][0] : null;
  const timeline: { year: number; passed: number; failed: number; other: number; total: number }[] = [];
  if (minYear != null && maxYear != null) {
    for (let y = minYear; y <= maxYear; y++) {
      const b = yearMap.get(y) ?? { passed: 0, failed: 0, other: 0, total: 0 };
      timeline.push({ year: y, ...b });
    }
  }
  const maxYearTotal = timeline.reduce((m, t) => Math.max(m, t.total), 0);

  // Chamber breakdown
  const chamberMap = new Map<string, { passed: number; failed: number; total: number }>();
  for (const l of allVoteSummaries) {
    const ch = l.vote.chamber || "unknown";
    let b = chamberMap.get(ch);
    if (!b) {
      b = { passed: 0, failed: 0, total: 0 };
      chamberMap.set(ch, b);
    }
    b.total++;
    if (l.vote.result === "passed") b.passed++;
    else if (l.vote.result === "failed") b.failed++;
  }
  const chambers = Array.from(chamberMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([chamber, c]) => ({ chamber, ...c }));

  // Party breakdown
  const partyTotals = new Map<string, { yes: number; no: number; abstain: number; billCount: number }>();
  let partyRowsParsed = 0;
  for (const l of allVoteSummaries) {
    if (!l.vote.byPartyJson) continue;
    let raw: unknown;
    try { raw = JSON.parse(l.vote.byPartyJson); } catch { continue; }
    const parsed = extractPartyCounts(raw);
    if (Object.keys(parsed).length === 0) continue;
    partyRowsParsed++;
    for (const [party, counts] of Object.entries(parsed)) {
      const cur = partyTotals.get(party) ?? { yes: 0, no: 0, abstain: 0, billCount: 0 };
      cur.yes += counts.yes;
      cur.no += counts.no;
      cur.abstain += counts.abstain;
      cur.billCount += 1;
      partyTotals.set(party, cur);
    }
  }
  const parties = Array.from(partyTotals.entries())
    .map(([party, c]) => {
      const total = c.yes + c.no + c.abstain;
      return {
        party,
        yes: c.yes,
        no: c.no,
        abstain: c.abstain,
        total,
        yesPct: total > 0 ? (c.yes / total) * 100 : 0,
        noPct: total > 0 ? (c.no / total) * 100 : 0,
        billCount: c.billCount,
      };
    })
    .filter((p) => p.billCount >= 3)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="border-b border-gray-800 pb-6 space-y-3">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <Link href="/historical-events" className="hover:text-white transition-colors">
            ← Historical events
          </Link>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-white">{event.name}</h1>
          {event.category && (
            <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${CATEGORY_COLORS[event.category] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}>
              {event.category}
            </span>
          )}
        </div>
        <div className="text-sm font-mono text-gray-400">
          {formatDate(event.startDate)} → {formatDate(event.endDate)}
        </div>
        {event.description && (
          <p className="text-sm text-gray-400 leading-relaxed">{event.description}</p>
        )}
        <div className="grid grid-cols-3 gap-3 max-w-md pt-2">
          <div className="rounded border border-gray-800 bg-gray-900/40 px-3 py-2">
            <div className="text-lg font-mono text-white">{event._count.votes.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Linked votes</div>
          </div>
          <div className="rounded border border-gray-800 bg-gray-900/40 px-3 py-2">
            <div className="text-lg font-mono text-white">{event._count.claims.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Linked claims</div>
          </div>
          <div className="rounded border border-gray-800 bg-gray-900/40 px-3 py-2">
            <div className="text-lg font-mono text-white">{event._count.polities}</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Polities</div>
          </div>
        </div>
      </div>

      {/* Polities */}
      {event.polities.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Linked polities</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {event.polities
              .slice()
              .sort((a, b) => {
                const order = (r: string) =>
                  r === "primary" ? 0 : r === "adversary" ? 1 : r === "involved" ? 2 : 3;
                return order(a.role) - order(b.role) || a.polity.name.localeCompare(b.polity.name);
              })
              .map((p) => (
                <div
                  key={p.polityId}
                  className="rounded border border-gray-800 bg-gray-900/40 px-3 py-2 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{p.polity.name}</span>
                      <span className="text-[10px] font-mono text-gray-500">{p.polity.countryCode}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {p.polity.governmentType}
                      {p.polity.startYear != null || p.polity.endYear != null
                        ? ` · ${p.polity.startYear ?? "?"}–${p.polity.endYear ?? "present"}`
                        : ""}
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${ROLE_COLORS[p.role] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}>
                    {p.role}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Result breakdown */}
      {totalVotes > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Vote outcomes</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded border border-gray-800 bg-gray-900/40 px-3 py-2">
              <div className="text-base font-mono text-emerald-400">{passed.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Passed</div>
            </div>
            <div className="rounded border border-gray-800 bg-gray-900/40 px-3 py-2">
              <div className="text-base font-mono text-red-400">{failed.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Failed</div>
            </div>
            <div className="rounded border border-gray-800 bg-gray-900/40 px-3 py-2">
              <div className="text-base font-mono text-amber-400">{tied.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Tied</div>
            </div>
            <div className="rounded border border-gray-800 bg-gray-900/40 px-3 py-2">
              <div className="text-base font-mono text-white">{passRate.toFixed(1)}%</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Pass rate</div>
            </div>
          </div>
          {otherResult > 0 && (
            <p className="text-[11px] text-gray-500">{otherResult.toLocaleString()} other (unknown/null result)</p>
          )}

          {chambers.length > 0 && (
            <div className="rounded border border-gray-800 bg-gray-900/40 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-900/80 text-gray-400 uppercase text-[10px]">
                  <tr>
                    <th className="text-left px-3 py-2">Chamber</th>
                    <th className="text-right px-3 py-2">Votes</th>
                    <th className="text-right px-3 py-2">Passed</th>
                    <th className="text-right px-3 py-2">Failed</th>
                    <th className="text-right px-3 py-2">Pass rate</th>
                  </tr>
                </thead>
                <tbody>
                  {chambers.map((c) => (
                    <tr key={c.chamber} className="border-t border-gray-800/60">
                      <td className="px-3 py-1.5 text-gray-200">{c.chamber}</td>
                      <td className="px-3 py-1.5 text-right text-gray-300 font-mono">{c.total.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right text-emerald-400 font-mono">{c.passed.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right text-red-400 font-mono">{c.failed.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right text-gray-300 font-mono">
                        {c.total > 0 ? ((c.passed / c.total) * 100).toFixed(1) : "0.0"}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Vote timeline</h2>
          <p className="text-[11px] text-gray-500">
            Per-year roll calls during the event window. Green = passed, red = failed, gray = other/unknown.
          </p>
          <div className="rounded border border-gray-800 bg-gray-900/40 p-3">
            <div className="flex items-end gap-0.5 h-32">
              {timeline.map((t) => {
                const pctP = maxYearTotal > 0 ? (t.passed / maxYearTotal) * 100 : 0;
                const pctF = maxYearTotal > 0 ? (t.failed / maxYearTotal) * 100 : 0;
                const pctO = maxYearTotal > 0 ? (t.other / maxYearTotal) * 100 : 0;
                return (
                  <div
                    key={t.year}
                    title={`${t.year}: ${t.total} (${t.passed} passed, ${t.failed} failed, ${t.other} other)`}
                    className="flex-1 min-w-[2px] flex flex-col justify-end"
                  >
                    {t.other > 0 && <div className="bg-gray-600" style={{ height: `${pctO}%` }} />}
                    {t.failed > 0 && <div className="bg-red-500" style={{ height: `${pctF}%` }} />}
                    {t.passed > 0 && <div className="bg-emerald-500" style={{ height: `${pctP}%` }} />}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-mono text-gray-500">
              <span>{timeline[0].year}</span>
              {timeline.length > 4 && (
                <span>{timeline[Math.floor(timeline.length / 2)].year}</span>
              )}
              <span>{timeline[timeline.length - 1].year}</span>
            </div>
          </div>
        </section>
      )}

      {/* Party breakdown */}
      {parties.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Party breakdown</h2>
          <p className="text-[11px] text-gray-500">
            Aggregated across {partyRowsParsed.toLocaleString()} of {totalVotes.toLocaleString()} linked
            votes that carry per-party totals. Parties with fewer than 3 bills omitted.
          </p>
          <div className="rounded border border-gray-800 bg-gray-900/40 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-900/80 text-gray-400 uppercase text-[10px]">
                <tr>
                  <th className="text-left px-3 py-2">Party</th>
                  <th className="text-right px-3 py-2">Bills</th>
                  <th className="text-right px-3 py-2">Yes</th>
                  <th className="text-right px-3 py-2">No</th>
                  <th className="text-right px-3 py-2">Abstain</th>
                  <th className="text-right px-3 py-2">% Yes</th>
                </tr>
              </thead>
              <tbody>
                {parties.map((p) => (
                  <tr key={p.party} className="border-t border-gray-800/60">
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: partyColor(p.party) }}
                        />
                        <span className="text-gray-200">{p.party}</span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-300 font-mono">{p.billCount.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right text-emerald-400 font-mono">{p.yes.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right text-red-400 font-mono">{p.no.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right text-gray-400 font-mono">{p.abstain.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right text-gray-300 font-mono">{p.yesPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Linked votes (paginated) */}
      {voteLinks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-white">
              Linked roll-call votes
              <span className="ml-2 text-xs font-normal text-gray-500">
                {totalVotes.toLocaleString()} total · page {page} of {pageCount}
              </span>
            </h2>
            <div className="flex gap-2 text-xs">
              {page > 1 && (
                <Link
                  href={`/historical-events/${slug}?page=${page - 1}`}
                  className="px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  ← Prev
                </Link>
              )}
              {page < pageCount && (
                <Link
                  href={`/historical-events/${slug}?page=${page + 1}`}
                  className="px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
          <div className="rounded border border-gray-800 bg-gray-900/40 divide-y divide-gray-800/60">
            {voteLinks.map((l) => {
              const v = l.vote;
              const topics = parseTopics(v.topics);
              return (
                <div key={v.id} className="px-3 py-2">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-gray-400 flex-wrap">
                    <span>{formatDate(v.voteDate)}</span>
                    {v.chamber && <span>· {v.chamber}</span>}
                    {v.result && (
                      <span
                        className={
                          v.result === "passed"
                            ? "text-emerald-400"
                            : v.result === "failed"
                            ? "text-red-400"
                            : "text-gray-400"
                        }
                      >
                        · {v.result}
                      </span>
                    )}
                    {v.yesCount != null && v.noCount != null && (
                      <span>
                        · {v.yesCount}–{v.noCount}
                        {v.abstainCount != null && v.abstainCount > 0 ? `–${v.abstainCount}` : ""}
                      </span>
                    )}
                    {v.dataSource && <span className="text-gray-500">· {v.dataSource}</span>}
                  </div>
                  <div className="mt-1 text-sm text-gray-200 leading-snug">
                    {v.source?.url ? (
                      <a
                        href={v.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-200 hover:text-white hover:underline"
                      >
                        {v.source.name ?? "(untitled vote)"}
                      </a>
                    ) : (
                      v.source?.name ?? "(untitled vote)"
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {topics.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono"
                      >
                        {t}
                      </span>
                    ))}
                    <span className="text-[10px] text-gray-600 font-mono">match: {l.matchReason}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 text-xs">
            {page > 1 && (
              <Link
                href={`/historical-events/${slug}?page=${page - 1}`}
                className="px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                ← Prev
              </Link>
            )}
            {page < pageCount && (
              <Link
                href={`/historical-events/${slug}?page=${page + 1}`}
                className="px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Next →
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Linked claims */}
      {claimLinks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">
            Recent linked claims
            <span className="ml-2 text-xs font-normal text-gray-500">
              {event._count.claims.toLocaleString()} total
            </span>
          </h2>
          <div className="rounded border border-gray-800 bg-gray-900/40 divide-y divide-gray-800/60">
            {claimLinks.map((l) => (
              <Link
                key={l.claim.id}
                href={`/claims/${l.claim.id}`}
                className="block px-3 py-2 hover:bg-gray-900/70 transition-colors"
              >
                <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500">
                  <span>{l.claim.currentStatus}</span>
                  {l.claim.verificationStatus && <span>· {l.claim.verificationStatus}</span>}
                  {l.claim.claimEmergedAt && (
                    <span>· {l.claim.claimEmergedAt.toISOString().slice(0, 10)}</span>
                  )}
                </div>
                <div className="mt-0.5 text-sm text-gray-200 line-clamp-2">{l.claim.text}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

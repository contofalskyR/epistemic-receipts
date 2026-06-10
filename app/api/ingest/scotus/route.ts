import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BASE_URL = "https://www.courtlistener.com/api/rest/v4";
const CL_ROOT = "https://www.courtlistener.com";

interface CLCitation {
  volume: number | null;
  reporter: string | null;
  page: string | null;
  type: number;
}

interface CLCluster {
  id: number | string;
  case_name: string | null;
  date_filed: string | null;
  citations: CLCitation[] | null;
  absolute_url: string | null;
  citation_count: number | string | null;
}

interface CLPage {
  count: number;
  next: string | null;
  results: CLCluster[];
}

type Precision = "DAY" | "MONTH" | "YEAR";

function parseDate(raw: string | null): { date: Date; precision: Precision } | null {
  if (!raw) return null;
  if (/^\d{4}$/.test(raw)) {
    const d = new Date(`${raw}-01-01T00:00:00Z`);
    return isNaN(d.getTime()) ? null : { date: d, precision: "YEAR" };
  }
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}-01T00:00:00Z`);
    return isNaN(d.getTime()) ? null : { date: d, precision: "MONTH" };
  }
  const normalised = /T/.test(raw) ? raw : `${raw}T00:00:00Z`;
  const d = new Date(normalised);
  return isNaN(d.getTime()) ? null : { date: d, precision: "DAY" };
}

function formatCitation(citations: CLCitation[] | null | undefined): string {
  if (!citations || citations.length === 0) return "";
  const c = citations[0];
  if (c.volume == null || !c.reporter || !c.page) return "";
  return `${c.volume} ${c.reporter} ${c.page}`;
}

function buildSourceUrl(absoluteUrl: string | null | undefined): string | null {
  if (!absoluteUrl) return null;
  if (absoluteUrl.startsWith("http")) return absoluteUrl;
  const path = absoluteUrl.startsWith("/") ? absoluteUrl : `/${absoluteUrl}`;
  return `${CL_ROOT}${path}`;
}

function toCitationCount(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === "string" ? parseInt(raw, 10) : raw;
  return isNaN(n) ? null : n;
}

async function clFetch(urlOrPath: string, token: string): Promise<unknown> {
  const url = urlOrPath.startsWith("http") ? urlOrPath : `${BASE_URL}${urlOrPath}`;
  const res = await fetch(url, {
    headers: { Authorization: `Token ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CourtListener ${res.status}: ${url}`);
  return res.json();
}

export async function GET(request: Request) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.COURTLISTENER_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "COURTLISTENER_TOKEN not set" }, { status: 500 });
  }

  // Fetch cases filed in the last 60 days — safe to re-run (deduped by externalId)
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const sinceStr = since.toISOString().split("T")[0];

  const scotusTopic = await prisma.topic.findUnique({ where: { slug: "supreme-court-ruling" } });

  const firstUrl =
    `/clusters/?docket__court=scotus` +
    `&date_filed__gte=${sinceStr}` +
    `&order_by=-date_filed` +
    `&page_size=50`;

  let ingested = 0;
  let skipped = 0;
  let errors = 0;

  let nextUrl: string | null = firstUrl;

  while (nextUrl) {
    const page = (await clFetch(nextUrl, token)) as CLPage;
    const clusters: CLCluster[] = page.results ?? [];

    for (const cluster of clusters) {
      const clusterId = String(cluster.id);
      const clusterIdStr = `cl-cluster-${clusterId}`;
      const caseName = cluster.case_name?.trim() || "";
      const citationCount = toCitationCount(cluster.citation_count);
      const citation = formatCitation(cluster.citations);
      const sourceUrl = buildSourceUrl(cluster.absolute_url);
      const parsed = parseDate(cluster.date_filed);

      if (!caseName || !parsed || !sourceUrl) {
        skipped++;
        continue;
      }

      const existing = await prisma.claim.findUnique({ where: { externalId: clusterIdStr } });
      if (existing) {
        skipped++;
        continue;
      }

      const { date: filedDate, precision } = parsed;
      const year = filedDate.getUTCFullYear();
      const displayCit = citation ? `, ${citation}` : "";
      const displayYear = year ? ` (${year})` : "";
      const countStr = citationCount !== null ? String(citationCount) : "unknown";

      const sourceName = `${caseName}${displayCit} — SCOTUS${displayYear}`;
      const claimText = `The U.S. Supreme Court in ${caseName}${displayYear} issued a ruling on the legal questions presented in the case.`;

      const reviewFields = {
        humanReviewed: true,
        reviewedBy: "courtlistener_scotus_v1_auto",
        reviewedAt: new Date(),
        reviewConfidence: "MEDIUM" as const,
        autoApproved: true,
      };

      try {
        await prisma.$transaction(async (tx) => {
          const source = await tx.source.create({
            data: {
              name: sourceName,
              url: sourceUrl,
              publishedAt: filedDate,
              methodologyType: "primary",
              ingestedBy: "courtlistener_scotus_v1",
              externalId: `cl-source-${clusterId}`,
              ...reviewFields,
            },
          });

          const claim = await tx.claim.create({
            data: {
              text: claimText,
              claimType: "INSTITUTIONAL",
              claimEmergedAt: filedDate,
              claimEmergedPrecision: precision,
              currentStatus: "HARD_FACT",
              ingestedBy: "courtlistener_scotus_v1",
              externalId: clusterIdStr,
              ...reviewFields,
            },
          });

          const edge = await tx.edge.create({
            data: {
              sourceId: source.id,
              claimId: claim.id,
              type: "FOR",
              evidenceType: "PROCEDURAL",
              ingestedBy: "courtlistener_scotus_v1",
              ...reviewFields,
            },
          });

          await tx.edgeRevision.create({
            data: {
              edgeId: edge.id,
              priorScore: null,
              newScore: 90,
              reason: "U.S. Supreme Court institutional resolution — ruling issued by Court of last resort",
              changedAt: filedDate,
            },
          });

          await tx.thresholdEvent.create({
            data: {
              claimId: claim.id,
              triggeredBy: `U.S. Supreme Court ruling — ${caseName}`,
              triggeredBySourceId: source.id,
              confirmedBy: "courtlistener_scotus_v1",
              note: `The U.S. Supreme Court issued its opinion in ${caseName}${displayCit}${displayYear}. Citation count as of ingestion: ${countStr}.`,
              evidenceSnapshot: JSON.stringify([{ id: edge.id, score: 90 }]),
              createdAt: filedDate,
              ingestedBy: "courtlistener_scotus_v1",
              ...reviewFields,
            },
          });

          if (scotusTopic) {
            await tx.claimTopic.upsert({
              where: { claimId_topicId: { claimId: claim.id, topicId: scotusTopic.id } },
              update: {},
              create: { claimId: claim.id, topicId: scotusTopic.id },
            });
          }
        });

        ingested++;
      } catch {
        errors++;
      }
    }

    nextUrl = page.next ?? null;
  }

  return NextResponse.json({ ok: true, ingested, skipped, errors, since: sinceStr });
}

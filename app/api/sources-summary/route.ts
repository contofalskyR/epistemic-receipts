import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corpusCountByPipeline } from "@/lib/corpus";
import { PIPELINES, CATEGORY_ORDER, type SourceCategory } from "@/lib/pipelines/registry";

export const revalidate = 300;

type Category = SourceCategory;

interface SourceMeta {
  label: string;
  sourceUrl: string;
  category: Category;
}

// ingestedBy → source-level metadata, derived from the ONE pipeline registry
// (lib/pipelines/registry.ts, front door phase 3). This file used to carry its
// own 185-row SOURCE_REGISTRY that disagreed with the data cards and /pipelines.
const SOURCE_REGISTRY: Record<string, SourceMeta> = Object.fromEntries(
  PIPELINES.map((p) => [p.tag, { label: p.name, sourceUrl: p.upstreamUrl ?? "", category: p.category }]),
);

interface SourceEntry {
  ingestedBy: string;
  label: string;
  sourceUrl: string;
  count: number;
}

interface CategoryBucket {
  name: Category;
  totalCount: number;
  sourceCount: number;
  sources: SourceEntry[];
}

export interface SourcesSummary {
  /** The site-wide corpus total (lib/corpus.ts: deleted = false) — the per-source
      rows below are the same query grouped by ingestedBy, so they sum to it. */
  totalClaims: number;
  /** Claims counted above whose verificationStatus is still NULL (never classified).
      Disclosed, not excluded: the corpus total counts them everywhere. */
  unclassifiedClaims: number;
  totalSources: number;
  generatedAt: string;
  categories: CategoryBucket[];
  unmapped: SourceEntry[];
}

export async function loadSourcesSummary(): Promise<SourcesSummary> {
  const [rows, unclassifiedClaims] = await Promise.all([
    // One per-pipeline query site-wide (lib/corpus.ts), so this census, the
    // homepage tiles and /pipelines can never disagree. It used to exclude the
    // 182 DEPRECATED rows here alone; the corpus total counts them (and /stats
    // says so), so the census does too.
    corpusCountByPipeline(),
    prisma.claim.count({ where: { deleted: false, verificationStatus: null } }),
  ]);

  const buckets = new Map<Category, SourceEntry[]>();
  const unmapped: SourceEntry[] = [];
  let totalClaims = 0;

  for (const row of rows) {
    const count = Number(row.count);
    totalClaims += count;
    const meta: SourceMeta | undefined =
      SOURCE_REGISTRY[row.ingestedBy] ??
      (row.ingestedBy.startsWith("book-analysis:")
        ? { label: "Book analysis (reader extraction)", sourceUrl: "", category: "Editorial / Curated" }
        : undefined);
    if (!meta) {
      unmapped.push({ ingestedBy: row.ingestedBy, label: row.ingestedBy, sourceUrl: "", count });
      continue;
    }
    const entry: SourceEntry = { ingestedBy: row.ingestedBy, label: meta.label, sourceUrl: meta.sourceUrl, count };
    const list = buckets.get(meta.category) ?? [];
    list.push(entry);
    buckets.set(meta.category, list);
  }

  const categories: CategoryBucket[] = CATEGORY_ORDER
    .map((name) => {
      const sources = (buckets.get(name) ?? []).sort((a, b) => b.count - a.count);
      const totalCount = sources.reduce((s, x) => s + x.count, 0);
      return { name, totalCount, sourceCount: sources.length, sources };
    })
    .filter((b) => b.sources.length > 0);

  const totalSources = categories.reduce((s, c) => s + c.sourceCount, 0);

  return {
    totalClaims,
    unclassifiedClaims,
    totalSources,
    generatedAt: new Date().toISOString(),
    categories,
    // Raw internal tags (enrich:*, seed:*, one-off ids) are ops detail, not
    // public provenance — dev builds show them; production omits the list
    // entirely so it never ships in the payload. (PUBLISH-CHECKLIST.md P0,
    // same rule as /pipelines' unregistered-tags section.)
    unmapped:
      process.env.NODE_ENV === "development"
        ? unmapped.sort((a, b) => b.count - a.count)
        : [],
  };
}

export async function GET() {
  return NextResponse.json(await loadSourcesSummary());
}

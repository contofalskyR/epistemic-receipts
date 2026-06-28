import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const field = sp.get("field") ?? "all";
  const reason = sp.get("reason") ?? "all";
  const q = (sp.get("q") ?? "").trim();
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const conditions: string[] = [
    `c."ingestedBy" = 'crossref_retractions_v1'`,
    `c.deleted = false`,
  ];

  // User input is passed as bind parameters ($1, ...), never interpolated
  // into the SQL string. LIKE wildcards are escaped so they match literally.
  const params: unknown[] = [];
  const likeParam = (value: string): string => {
    const escaped = value.replace(/[\\%_]/g, (m) => `\\${m}`);
    params.push(`%${escaped}%`);
    return `$${params.length}`;
  };

  if (reason !== "all") {
    conditions.push(`c.metadata->>'updateType' ILIKE ${likeParam(reason)}`);
  }

  if (q) {
    const p = likeParam(q);
    conditions.push(
      `(c.metadata->>'title' ILIKE ${p} OR c.metadata->>'journal' ILIKE ${p} OR c.metadata->>'firstAuthor' ILIKE ${p})`
    );
  }

  if (field !== "all") {
    // All retraction claims share a single "retracted-papers" topic, so topic-slug
    // filtering returns nothing useful. Derive the field from journal-name keywords
    // instead — this is approximate but matches the only field signal we actually have.
    const journalKeywords: Record<string, string[]> = {
      Medicine: [
        "medic", "clinical", "surg", "lancet", "nejm", "jama", "antimicrobial",
        "infect", "oncolog", "cardio", "pharma", "therapeutic", "diabet", "obstetric",
        "pediatr", "neurolog", "radio", "anesth", "immun", "vaccin", "vir", "hepat",
      ],
      Psychology: ["psycholog", "psychiatr", "behavior", "behaviour", "cognit", "mental health", "mental disord"],
      Biology: [
        "biolog", "biochem", "molecular", "cell", "genom", "genet", "microbi",
        "ecolog", "evolution", "physiolog", "neurosci", "protein", "rna ", "dna ",
      ],
      Physics: ["physic", "astrophys", "quantum", "applied physics", "physical review"],
      Chemistry: ["chemi", "polymer", "catalysis", "spectro", "electrochem", "organomet"],
    };
    const kws = journalKeywords[field];
    if (kws && kws.length) {
      const ors = kws
        .map((kw) => `c.metadata->>'journal' ILIKE '%${kw.replace(/'/g, "''")}%'`)
        .join(" OR ");
      conditions.push(`(${ors})`);
    } else {
      // Unknown field — return 0 rows rather than ignoring silently.
      conditions.push(`FALSE`);
    }
  }

  const where = conditions.join(" AND ");

  const [rows, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<
      Array<{
        id: string;
        text: string;
        metadata: unknown;
        claimEmergedAt: Date | null;
      }>
    >(
      `SELECT c.id, c.text, c.metadata, c."claimEmergedAt"
       FROM "Claim" c
       WHERE ${where}
       ORDER BY c."claimEmergedAt" DESC NULLS LAST, c."createdAt" DESC
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      ...params
    ),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "Claim" c WHERE ${where}`,
      ...params
    ),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  const papers = rows.map((r) => {
    const m = r.metadata as Record<string, unknown>;
    const retractionDate = r.claimEmergedAt;
    const year = retractionDate
      ? new Date(retractionDate).getFullYear()
      : null;
    return {
      id: r.id,
      title: (m?.title as string) ?? r.text.slice(0, 120),
      firstAuthor: (m?.firstAuthor as string) ?? null,
      journal: (m?.journal as string) ?? null,
      publisher: (m?.publisher as string) ?? null,
      doi: (m?.doi as string) ?? null,
      updateType: (m?.updateType as string) ?? "Retraction",
      retractionDate: retractionDate ? retractionDate.toISOString().slice(0, 10) : null,
      year,
      summary: (m?.summary as string) ?? null,
    };
  });

  return NextResponse.json({ total, papers, page, pageSize: PAGE_SIZE });
}

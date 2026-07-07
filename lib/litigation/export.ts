import "server-only";
import { createHash } from "crypto";
import { createGzip } from "zlib";
import { Readable, PassThrough } from "stream";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { prisma } from "@/lib/prisma";

const BATCH_SIZE = 500;

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

const R2_BUCKET = process.env.R2_BUCKET ?? "epistemic-receipts-snapshots";

export type ClaimExportRow = {
  claimId: string;
  claimText: string;
  epistemicAxis: string | null;
  epistemicStatus: string | null;
  claimEmergedAt: string | null;
  statusHistory: Array<{
    toAxis: string;
    community: string;
    occurredAt: string;
    datePrecision: string | null;
    reason: string | null;
  }>;
  sources: Array<{
    id: string;
    name: string;
    url: string | null;
    publishedAt: string | null;
    edgeType: string;
  }>;
  addedToMatter: string;
  relevanceTag: string | null;
  notes: string | null;
};

async function* fetchClaimRows(matterId: string): AsyncGenerator<ClaimExportRow> {
  let cursor: string | undefined;

  while (true) {
    const rows = await prisma.matterClaim.findMany({
      where: { matterId },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
      include: {
        claim: {
          include: {
            statusHistory: {
              orderBy: { occurredAt: "asc" },
            },
            edges: {
              where: { deleted: false },
              include: {
                source: { select: { id: true, name: true, url: true, publishedAt: true } },
              },
            },
          },
        },
      },
    });

    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      yield {
        claimId: row.claim.id,
        claimText: row.claim.text,
        epistemicAxis: row.claim.epistemicAxis ?? null,
        epistemicStatus: row.claim.epistemicStatus ?? null,
        claimEmergedAt: row.claim.claimEmergedAt?.toISOString() ?? null,
        statusHistory: row.claim.statusHistory.map((h) => ({
          toAxis: h.toAxis,
          community: h.community,
          occurredAt: h.occurredAt.toISOString(),
          datePrecision: h.datePrecision ?? null,
          reason: h.reason ?? null,
        })),
        sources: row.claim.edges.map((e) => ({
          id: e.source.id,
          name: e.source.name,
          url: e.source.url ?? null,
          publishedAt: e.source.publishedAt?.toISOString() ?? null,
          edgeType: e.type,
        })),
        addedToMatter: row.addedAt.toISOString(),
        relevanceTag: row.relevanceTag ?? null,
        notes: row.notes ?? null,
      };
    }

    if (rows.length < BATCH_SIZE) break;
  }
}

function claimToCSVRow(row: ClaimExportRow): string {
  const fields = [
    row.claimId,
    row.claimText.replace(/"/g, '""'),
    row.epistemicAxis ?? "",
    row.epistemicStatus ?? "",
    row.claimEmergedAt ?? "",
    row.statusHistory.length.toString(),
    row.statusHistory.at(-1)?.toAxis ?? "",
    row.sources.length.toString(),
    row.addedToMatter,
    row.relevanceTag ?? "",
    row.notes?.replace(/"/g, '""') ?? "",
  ];
  return fields.map((f) => `"${f}"`).join(",");
}

const CSV_HEADER =
  '"claimId","claimText","epistemicAxis","epistemicStatus","claimEmergedAt",' +
  '"statusHistoryCount","latestAxis","sourceCount","addedToMatter","relevanceTag","notes"\n';

export type ExportResult = { r2Key: string; sha256: string };

export async function exportMatteAsJSONL(matterId: string, exportId: string): Promise<ExportResult> {
  const r2Key = `litigation/${matterId}/${exportId}.jsonl.gz`;
  return streamToR2(matterId, r2Key, "jsonl");
}

export async function exportMatterAsCSV(matterId: string, exportId: string): Promise<ExportResult> {
  const r2Key = `litigation/${matterId}/${exportId}.csv.gz`;
  return streamToR2(matterId, r2Key, "csv");
}

async function streamToR2(
  matterId: string,
  r2Key: string,
  format: "jsonl" | "csv",
): Promise<ExportResult> {
  const hash = createHash("sha256");
  const passthrough = new PassThrough();
  const gzip = createGzip();

  let firstRow = true;

  async function pump() {
    try {
      if (format === "csv") {
        passthrough.write(CSV_HEADER);
      }
      for await (const row of fetchClaimRows(matterId)) {
        let line: string;
        if (format === "jsonl") {
          line = JSON.stringify(row) + "\n";
        } else {
          line = claimToCSVRow(row) + "\n";
          if (firstRow) firstRow = false;
        }
        passthrough.write(line);
      }
      passthrough.end();
    } catch (err) {
      passthrough.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  }

  passthrough.pipe(gzip);
  gzip.on("data", (chunk: Buffer) => hash.update(chunk));

  pump();

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: gzip,
      ContentType: "application/gzip",
      ContentEncoding: "gzip",
    },
  });

  await upload.done();

  return { r2Key, sha256: hash.digest("hex") };
}

// Re-export streaming helpers for PDF stub
export async function exportMatterAsPDFStub(): Promise<{ status: string; message: string }> {
  return { status: "not_implemented", message: "PDF export coming soon" };
}

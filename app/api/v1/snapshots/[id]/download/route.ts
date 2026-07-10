import { NextRequest } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { verifyApiKey, isAuthError, rfc7807 } from "@/lib/v1/auth";
import { v1Error, v1Json } from "@/lib/v1/respond";
import { resolveEffectiveTier, tierAtLeast } from "@/lib/billing/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

const R2_BUCKET = process.env.R2_BUCKET ?? "epistemic-receipts-snapshots";

/**
 * GET /v1/snapshots/{id}/download
 *
 * Returns a short-lived (5-min) R2 signed URL for full-corpus snapshot downloads.
 * Requires tier >= pro. Free-tier keys may access the sample snapshot (id=sample).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Sample snapshot is always public — no auth required
  if (id === "sample") {
    return redirectToSample(id);
  }

  const auth = await verifyApiKey(req, "snapshots");
  if (isAuthError(auth)) return v1Error(auth.body, auth.headers);

  const { effectiveTier } = await resolveEffectiveTier(auth.keyId);

  if (!tierAtLeast(effectiveTier, "pro")) {
    return v1Error(
      rfc7807(
        403,
        "Forbidden",
        "Full snapshot downloads require a Pro or higher plan. See https://epistemic-receipts.app/pricing",
      ),
    );
  }

  // Reject anything that isn't a plain snapshot slug before it reaches the R2
  // key template (`snapshots/${id}.jsonl.gz`). Without this, an id like
  // "../other-bucket-object" or one containing slashes could point the signed
  // URL at a different object.
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(id)) {
    return v1Error(
      rfc7807(400, "Bad Request", "Invalid snapshot id."),
    );
  }

  const key = `snapshots/${id}.jsonl.gz`;

  let url: string;
  try {
    const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
    url = await getSignedUrl(s3, cmd, { expiresIn: SIGNED_URL_TTL_SECONDS });
  } catch (err) {
    console.error(`[v1/snapshots/download] Failed to generate signed URL for ${key}:`, err);
    return v1Error(
      rfc7807(404, "Not Found", `Snapshot '${id}' not found or not yet available.`),
    );
  }

  return v1Json({ url, expiresInSeconds: SIGNED_URL_TTL_SECONDS });
}

async function redirectToSample(_id: string) {
  const sampleUrl = `https://epistemic-receipts.app/data/sample-snapshot.jsonl.gz`;
  return v1Json({ url: sampleUrl, expiresInSeconds: null, note: "Sample snapshot — no auth required" });
}

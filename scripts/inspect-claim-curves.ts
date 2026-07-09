/**
 * inspect-claim-curves.ts — READ-ONLY dump of one or more claims' settling
 * curves, by claim id or externalId. A terminal stand-in for the /claims/<id>
 * visual eyeball when a browser isn't handy: prints each transition (from→to,
 * date + precision, ratifying community, marker source) so you can confirm an
 * arc reads honestly without opening the site.
 *
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/inspect-claim-curves.ts <id-or-externalId> [more ...]
 *
 * Writes nothing.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
// Same guard as the other read scripts: a stale/empty shell DATABASE_URL
// shadows .env.local; prefer the direct connection for a read.
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "—");
const clip = (s: string | null | undefined, n: number) =>
  s ? (s.length > n ? s.slice(0, n).trimEnd() + "…" : s) : "";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));

async function dump(key: string) {
  // externalIds in this repo carry a namespace colon (trajectory:…, openalex_W…);
  // bare cuid/uuid claim ids do not. Match on whichever the key looks like.
  const where = key.includes(":") || /^openalex_/i.test(key)
    ? { externalId: key }
    : { id: key };

  const claim = await prisma.claim.findFirst({
    where,
    select: {
      id: true, externalId: true, text: true, epistemicAxis: true,
      claimEmergedAt: true, claimEmergedPrecision: true, humanReviewed: true,
      statusHistory: {
        orderBy: [{ seq: "asc" }, { occurredAt: "asc" }, { createdAt: "asc" }],
        select: {
          seq: true, fromAxis: true, toAxis: true, occurredAt: true,
          datePrecision: true, community: true, reason: true,
          markerSource: { select: { name: true, url: true, publishedAt: true, methodologyType: true } },
        },
      },
    },
  });

  console.log(`\n${"=".repeat(78)}`);
  if (!claim) { console.log(`NOT FOUND: ${key}`); return; }
  console.log(`${claim.externalId ?? claim.id}`);
  console.log(`  id=${claim.id}`);
  console.log(`  ${clip(claim.text, 120)}`);
  console.log(`  axis=${claim.epistemicAxis}  emerged=${day(claim.claimEmergedAt)} (${claim.claimEmergedPrecision})  humanReviewed=${claim.humanReviewed}`);
  console.log(`  -- curve (${claim.statusHistory.length} points) --`);

  let prevDate = "";
  for (const h of claim.statusHistory) {
    const d = day(h.occurredAt);
    const tie = d === prevDate ? "  ⟵ same date as prior point" : "";
    prevDate = d;
    console.log(`    seq=${h.seq}  ${h.fromAxis ?? "∅"} → ${h.toAxis}  @ ${d} (${h.datePrecision}) [${h.community}]${tie}`);
    if (h.markerSource) {
      console.log(`        marker: ${clip(h.markerSource.name, 90)}`);
      console.log(`                ${h.markerSource.url}  pub=${day(h.markerSource.publishedAt)} · ${h.markerSource.methodologyType}`);
    } else {
      console.log(`        marker: NONE`);
    }
    console.log(`        reason: ${clip(h.reason, 130)}`);
  }
}

async function main() {
  if (args.length === 0) {
    console.log("usage: inspect-claim-curves.ts <id-or-externalId> [more ...]");
    return;
  }
  for (const key of args) await dump(key);
  console.log();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

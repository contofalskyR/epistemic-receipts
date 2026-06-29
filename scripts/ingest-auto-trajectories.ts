/**
 * Layer-1 trajectory generator — deterministic, no LLM.
 *
 * For each pipeline that has a known epistemic template, creates
 * ClaimStatusHistory rows from existing claim dates and relations.
 * Resumes from a cursor file so it can be run repeatedly / interrupted.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-auto-trajectories.ts [--pipeline <name>] [--batch <n>] [--dry-run]
 */

import { PrismaClient, RatifyingCommunity } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const CURSOR_FILE = path.join(__dirname, "../logs/auto-trajectories-cursor.json");
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "500");
const DRY_RUN = process.argv.includes("--dry-run");
const PIPELINE_FILTER = (() => {
  const idx = process.argv.indexOf("--pipeline");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ── Template registry ──────────────────────────────────────────────────────────
// Each entry maps an ingestedBy key to:
//   toAxis    — the epistemic status this claim represents
//   community — which community ratified this
//   reason    — human-readable reason for the transition
//   dateField — "claimEmergedAt" (always, for now)
type Template = {
  toAxis: string;
  community: RatifyingCommunity;
  reason: string;
};

const PIPELINE_TEMPLATES: Record<string, Template> = {
  // ── Retractions ─────────────────────────────────────────────────────────────
  crossref_retractions_v1: {
    toAxis: "REVERSED",
    community: "EXPERT_LITERATURE",
    reason: "Paper formally retracted by journal publisher.",
  },

  // ── FDA / Pharma ─────────────────────────────────────────────────────────────
  drugsatfda_v1: {
    toAxis: "SETTLED",
    community: "INSTITUTIONAL",
    reason: "FDA granted NDA approval, establishing institutional consensus on safety and efficacy.",
  },

  // ── US Federal Legislative ───────────────────────────────────────────────────
  congress_v1: {
    toAxis: "SETTLED",
    community: "INSTITUTIONAL",
    reason: "Bill enacted into law, entering the settled US legal record.",
  },
  voteview_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Congressional roll-call vote officially recorded.",
  },
  congress_stock_act_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Financial disclosure filed under STOCK Act reporting requirements.",
  },
  fr_rules_v1: {
    toAxis: "SETTLED",
    community: "INSTITUTIONAL",
    reason: "Federal rule finalized through EO 12866 regulatory review process.",
  },

  // ── Courts ───────────────────────────────────────────────────────────────────
  courtlistener_scotus_v1: {
    toAxis: "SETTLED",
    community: "JUDICIAL",
    reason: "US Supreme Court issued opinion — highest judicial authority in the US.",
  },
  courtlistener_circuits_v1: {
    toAxis: "SETTLED",
    community: "JUDICIAL",
    reason: "Federal Circuit Court of Appeals issued ruling.",
  },
  courtlistener_state_supreme_v1: {
    toAxis: "SETTLED",
    community: "JUDICIAL",
    reason: "State Supreme Court issued opinion, settling the legal question in that jurisdiction.",
  },
  courtlistener_bia_v1: {
    toAxis: "SETTLED",
    community: "JUDICIAL",
    reason: "Board of Immigration Appeals issued precedent decision.",
  },
  courtlistener_tax_v1: {
    toAxis: "SETTLED",
    community: "JUDICIAL",
    reason: "US Tax Court or Court of Federal Claims issued ruling.",
  },

  // ── International / Intergovernmental ────────────────────────────────────────
  ofac_sdn_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Entity designated on OFAC Specially Designated Nationals list.",
  },
  who_gho_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Health indicator officially recorded by WHO Global Health Observatory.",
  },
  worldbank_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Economic indicator officially recorded by World Bank.",
  },
  vdem_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Political indicator recorded in V-Dem expert-coded democracy dataset.",
  },
  sipri_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Military expenditure officially recorded by SIPRI.",
  },
  ucdp_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Armed conflict data recorded by UCDP/PRIO conflict dataset.",
  },
  icsid_v1: {
    toAxis: "SETTLED",
    community: "JUDICIAL",
    reason: "Investment dispute settled through ICSID international arbitration.",
  },

  // ── Archives ─────────────────────────────────────────────────────────────────
  nara_catalog_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Document officially catalogued in US National Archives.",
  },
  jacar_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Document officially catalogued in Japan Center for Asian Historical Records.",
  },

  // ── Science ──────────────────────────────────────────────────────────────────
  openalex_v1: {
    toAxis: "RECORDED",
    community: "EXPERT_LITERATURE",
    reason: "Research findings entered the expert literature via peer-reviewed publication.",
  },
  openalex_journals_v1: {
    toAxis: "RECORDED",
    community: "EXPERT_LITERATURE",
    reason: "Journal article entered the expert literature record.",
  },
  chebi_v1: {
    toAxis: "RECORDED",
    community: "EXPERT_LITERATURE",
    reason: "Chemical entity officially recorded in ChEBI ontology.",
  },
  openfda_labels_v1: {
    toAxis: "RECORDED",
    community: "INSTITUTIONAL",
    reason: "Drug label officially recorded in FDA drug labeling database.",
  },
  clinical_trials_v1: {
    toAxis: "CONTESTED",
    community: "EXPERT_LITERATURE",
    reason: "Registered clinical trial — findings under active investigation.",
  },

  // ── Legislation (country-specific) ───────────────────────────────────────────
  argentina_legislation_v1:  { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Argentine law." },
  austria_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Austrian law." },
  belgium_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Belgian law." },
  brazil_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Brazilian law." },
  canada_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Canadian law." },
  chile_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Chilean law." },
  colombia_legislation_v1:   { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Colombian law." },
  czech_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Czech law." },
  estonia_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Estonian law." },
  eu_legislation_v1:         { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "EU regulation or directive adopted into European law." },
  germany_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into German law." },
  hungary_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Hungarian law." },
  india_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Indian law." },
  italy_legislation_v1:      { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Italian law." },
  latvia_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Latvian law." },
  mexico_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Mexican law." },
  nz_legislation_v1:         { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into New Zealand law." },
  pakistan_code_v1:          { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation encoded in Pakistani legal code." },
  peru_legislation_v1:       { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Peruvian law." },
  philippines_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Philippine law." },
  poland_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Polish law." },
  romania_legislation_v1:    { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Romanian law." },
  slovakia_legislation_v1:   { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Slovak law." },
  slovenia_legislation_v1:   { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Slovenian law." },
  sweden_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Swedish law." },
  taiwan_legislation_v1:     { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Taiwanese law." },
  uk_legislation_v1:         { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into UK law." },
  us_legislation_v1:         { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into US federal law." },
  bundestag_v1:              { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation passed by the German Bundestag." },
  riksdag_v1:                { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation passed by the Swedish Riksdag." },
  costa_rica_legislation_v1: { toAxis: "SETTLED", community: "INSTITUTIONAL", reason: "Legislation enacted into Costa Rican law." },
  openparliament_ca_v1:      { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "Canadian parliamentary vote officially recorded." },
  uk_commons_v1:             { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "UK House of Commons vote officially recorded." },
  howtheyvote_eu_v1:         { toAxis: "RECORDED", community: "INSTITUTIONAL", reason: "European Parliament vote officially recorded." },
};

// ── Cursor management ─────────────────────────────────────────────────────────
function loadCursor(): Record<string, string | null> {
  try {
    if (fs.existsSync(CURSOR_FILE)) {
      return JSON.parse(fs.readFileSync(CURSOR_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveCursor(cursors: Record<string, string | null>) {
  fs.mkdirSync(path.dirname(CURSOR_FILE), { recursive: true });
  fs.writeFileSync(CURSOR_FILE, JSON.stringify(cursors, null, 2));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function processPipeline(
  pipeline: string,
  template: Template,
  cursors: Record<string, string | null>
): Promise<number> {
  let cursor = cursors[pipeline] ?? undefined;
  let totalAdded = 0;
  let page = 0;

  while (true) {
    // Fetch a batch of claims from this pipeline that have no status history
    const claims = await prisma.claim.findMany({
      where: {
        ingestedBy: pipeline,
        deleted: false,
        verificationStatus: { not: "DEPRECATED" },
        claimEmergedAt: { not: null },
        statusHistory: { none: {} },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: {
        id: true,
        claimEmergedAt: true,
        claimEmergedPrecision: true,
        text: true,
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    });

    if (claims.length === 0) {
      // Pipeline exhausted — clear cursor
      cursors[pipeline] = null;
      break;
    }

    if (!DRY_RUN) {
      await prisma.claimStatusHistory.createMany({
        data: claims.map((c) => ({
          claimId: c.id,
          fromAxis: null, // first recorded event
          toAxis: template.toAxis,
          community: template.community,
          reason: template.reason,
          occurredAt: c.claimEmergedAt!,
          datePrecision: c.claimEmergedPrecision ?? "DAY",
        })),
        skipDuplicates: true,
      });
    }

    totalAdded += claims.length;
    cursor = claims[claims.length - 1].id;
    cursors[pipeline] = cursor;
    page++;

    const pct = DRY_RUN ? " [dry-run]" : "";
    console.log(
      `[${pipeline}] page ${page}: +${claims.length} (total ${totalAdded})${pct}`
    );

    // Save cursor after every batch so we can resume
    if (!DRY_RUN) saveCursor(cursors);
  }

  return totalAdded;
}

async function main() {
  const pipelines = PIPELINE_FILTER
    ? { [PIPELINE_FILTER]: PIPELINE_TEMPLATES[PIPELINE_FILTER] }
    : PIPELINE_TEMPLATES;

  if (PIPELINE_FILTER && !PIPELINE_TEMPLATES[PIPELINE_FILTER]) {
    console.error(`Unknown pipeline: ${PIPELINE_FILTER}`);
    console.log("Known pipelines:", Object.keys(PIPELINE_TEMPLATES).join(", "));
    process.exit(1);
  }

  const cursors = loadCursor();
  let grandTotal = 0;

  for (const [pipeline, template] of Object.entries(pipelines)) {
    // Skip pipelines where cursor is explicitly null (already exhausted)
    if (cursors[pipeline] === null) {
      console.log(`[${pipeline}] already exhausted — skipping`);
      continue;
    }

    console.log(
      `\n=== ${pipeline} → ${template.toAxis} (${template.community}) ===`
    );
    const added = await processPipeline(pipeline, template, cursors);
    grandTotal += added;
    console.log(`[${pipeline}] done. Added ${added} history entries.`);
  }

  console.log(`\n✓ Grand total: ${grandTotal} ClaimStatusHistory rows created.`);
  if (DRY_RUN) console.log("(dry-run — no rows written)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

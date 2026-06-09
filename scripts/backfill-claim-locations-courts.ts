import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 1000;

interface LocationInfo {
  city: string;
  lat: number;
  lon: number;
  countryCode: string;
}

// Static pipeline → location mapping (court_seat, CITY precision)
const PIPELINE_LOCATIONS: Record<string, LocationInfo> = {
  // SCOTUS
  courtlistener_scotus_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  // BIA - Board of Immigration Appeals (Falls Church, VA)
  courtlistener_bia_v1: { city: 'Falls Church', lat: 38.8763, lon: -77.1745, countryCode: 'US' },
  // US Tax Court
  courtlistener_tax_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  // ICJ
  icj_judgments_v1: { city: 'The Hague', lat: 52.0833, lon: 4.3167, countryCode: 'NL' },
  // ICC
  icc_judgments_v1: { city: 'The Hague', lat: 52.0833, lon: 4.3167, countryCode: 'NL' },
  icc_cases_v1: { city: 'The Hague', lat: 52.0833, lon: 4.3167, countryCode: 'NL' },
  // ECHR
  echr_judgments_v1: { city: 'Strasbourg', lat: 48.5734, lon: 7.7521, countryCode: 'FR' },
  echr_v1: { city: 'Strasbourg', lat: 48.5734, lon: 7.7521, countryCode: 'FR' },
  // ICSID (World Bank arbitration, Washington DC)
  icsid_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  // African Court on Human and Peoples' Rights
  african_court_v1: { city: 'Arusha', lat: -3.3869, lon: 36.6830, countryCode: 'TZ' },
  // UN Security Council
  un_sc_resolutions_v1: { city: 'New York', lat: 40.7489, lon: -73.9680, countryCode: 'US' },
  // UN General Assembly
  un_ga_resolutions_v1: { city: 'New York', lat: 40.7489, lon: -73.9680, countryCode: 'US' },
  un_ga_v1: { city: 'New York', lat: 40.7489, lon: -73.9680, countryCode: 'US' },
  // UN Treaties
  un_treaties_v1: { city: 'New York', lat: 40.7489, lon: -73.9680, countryCode: 'US' },
  // NATO
  nato_official_texts_v1: { city: 'Brussels', lat: 50.8503, lon: 4.3517, countryCode: 'BE' },
  // WTO
  wto_disputes_v1: { city: 'Geneva', lat: 46.2044, lon: 6.1432, countryCode: 'CH' },
  // WIPO
  wipo_lex_v1: { city: 'Geneva', lat: 46.2044, lon: 6.1432, countryCode: 'CH' },
  // SEC EDGAR
  sec_edgar_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  // OFAC
  ofac_sdn_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  // DOJ FARA
  doj_fara_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  // Federal Register
  fr_rules_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  // Congress
  congress_bills_tracker_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  congress_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  congress_stock_act_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  congress_votes_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  // FEC
  fec_finance_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  fec_finance_pac_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  openfec_ie_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  openfec_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  // NARA
  nara_catalog_v1: { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  // NIH Reporter (Bethesda, MD)
  nih_reporter_v1: { city: 'Bethesda', lat: 39.0004, lon: -77.1023, countryCode: 'US' },
  // FRED (Federal Reserve Bank of St. Louis)
  fred_v1: { city: 'St. Louis', lat: 38.6270, lon: -90.1994, countryCode: 'US' },
};

// Circuit → seat city (for courtlistener_circuits_v1, circuit parsed from claim text)
const CIRCUIT_LOCATIONS: Record<string, LocationInfo> = {
  '1st': { city: 'Boston', lat: 42.3601, lon: -71.0589, countryCode: 'US' },
  '2nd': { city: 'New York', lat: 40.7489, lon: -73.9680, countryCode: 'US' },
  '2d':  { city: 'New York', lat: 40.7489, lon: -73.9680, countryCode: 'US' },
  '3rd': { city: 'Philadelphia', lat: 39.9526, lon: -75.1652, countryCode: 'US' },
  '3d':  { city: 'Philadelphia', lat: 39.9526, lon: -75.1652, countryCode: 'US' },
  '4th': { city: 'Richmond', lat: 37.5407, lon: -77.4360, countryCode: 'US' },
  '5th': { city: 'New Orleans', lat: 29.9511, lon: -90.0715, countryCode: 'US' },
  '6th': { city: 'Cincinnati', lat: 39.1031, lon: -84.5120, countryCode: 'US' },
  '7th': { city: 'Chicago', lat: 41.8827, lon: -87.6233, countryCode: 'US' },
  '8th': { city: 'St. Louis', lat: 38.6270, lon: -90.1994, countryCode: 'US' },
  '9th': { city: 'San Francisco', lat: 37.7749, lon: -122.4194, countryCode: 'US' },
  '10th': { city: 'Denver', lat: 39.7392, lon: -104.9903, countryCode: 'US' },
  '11th': { city: 'Atlanta', lat: 33.7490, lon: -84.3880, countryCode: 'US' },
  'D.C.': { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
  'Fed.': { city: 'Washington, D.C.', lat: 38.8899, lon: -77.0091, countryCode: 'US' },
};

// Parse the circuit abbreviation from claim text, e.g. "(1st Cir." → "1st"
function parseCircuit(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/\((\S+) Cir\./);
  return m ? m[1] : null;
}

interface InsertRow {
  claimId: string;
  lat: number;
  lon: number;
  city: string;
  countryCode: string;
  source: string;
  precision: string;
}

async function backfillPipeline(
  ingestedBy: string,
  location: LocationInfo,
  alreadyDone: Set<string>
): Promise<number> {
  const total = await prisma.claim.count({
    where: { ingestedBy, deleted: false },
  });
  console.log(`  [${ingestedBy}] Total claims: ${total}`);

  let offset = 0;
  let inserted = 0;

  while (true) {
    const claims = await prisma.claim.findMany({
      where: { ingestedBy, deleted: false },
      select: { id: true },
      skip: offset,
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
    });

    if (claims.length === 0) break;

    const toInsert: InsertRow[] = claims
      .filter((c) => !alreadyDone.has(c.id))
      .map((c) => ({
        claimId: c.id,
        lat: location.lat,
        lon: location.lon,
        city: location.city,
        countryCode: location.countryCode,
        source: 'court_seat',
        precision: 'CITY',
      }));

    if (toInsert.length > 0) {
      await prisma.$transaction(
        async (tx) => {
          await tx.claimLocation.createMany({ data: toInsert, skipDuplicates: true });
        },
        { timeout: 30000 }
      );
      inserted += toInsert.length;
    }

    offset += claims.length;
    if (claims.length < BATCH_SIZE) break;
  }

  console.log(`  [${ingestedBy}] Inserted: ${inserted}`);
  return inserted;
}

async function backfillCircuits(alreadyDone: Set<string>): Promise<number> {
  const total = await prisma.claim.count({
    where: { ingestedBy: 'courtlistener_circuits_v1', deleted: false },
  });
  console.log(`  [courtlistener_circuits_v1] Total claims: ${total}`);

  let offset = 0;
  let inserted = 0;
  let unmatched = 0;

  while (true) {
    const claims = await prisma.claim.findMany({
      where: { ingestedBy: 'courtlistener_circuits_v1', deleted: false },
      select: { id: true, text: true },
      skip: offset,
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
    });

    if (claims.length === 0) break;

    const toInsert: InsertRow[] = [];

    for (const claim of claims) {
      if (alreadyDone.has(claim.id)) continue;

      const circuitKey = parseCircuit(claim.text);
      const location = circuitKey ? CIRCUIT_LOCATIONS[circuitKey] : null;

      if (!location) {
        unmatched++;
        continue;
      }

      toInsert.push({
        claimId: claim.id,
        lat: location.lat,
        lon: location.lon,
        city: location.city,
        countryCode: location.countryCode,
        source: 'court_seat',
        precision: 'CITY',
      });
    }

    if (toInsert.length > 0) {
      await prisma.$transaction(
        async (tx) => {
          await tx.claimLocation.createMany({ data: toInsert, skipDuplicates: true });
        },
        { timeout: 30000 }
      );
      inserted += toInsert.length;
    }

    offset += claims.length;
    if (claims.length < BATCH_SIZE) break;
  }

  console.log(`  [courtlistener_circuits_v1] Inserted: ${inserted}, Unmatched (no circuit in text): ${unmatched}`);
  return inserted;
}

async function main() {
  console.log('Starting courts/federal ClaimLocation backfill (Stage 3)...\n');

  // Load all already-backfilled claim IDs for court_seat source
  const alreadyDone = new Set(
    (
      await prisma.claimLocation.findMany({
        where: { source: 'court_seat' },
        select: { claimId: true },
      })
    ).map((r) => r.claimId)
  );
  console.log(`Already backfilled (court_seat): ${alreadyDone.size}\n`);

  let totalInserted = 0;

  // Static pipeline mappings
  for (const [pipeline, location] of Object.entries(PIPELINE_LOCATIONS)) {
    const n = await backfillPipeline(pipeline, location, alreadyDone);
    totalInserted += n;
  }

  // Circuit courts (need per-claim text parsing)
  totalInserted += await backfillCircuits(alreadyDone);

  console.log(`\n✓ Stage 3 complete. Total ClaimLocation rows inserted: ${totalInserted}`);
  return totalInserted;
}

main()
  .then((n) => {
    console.log(`Final count: ${n}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

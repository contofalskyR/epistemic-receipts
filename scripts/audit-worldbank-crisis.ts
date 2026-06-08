import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL!);

// Crisis indicator codes added by the worldbank expansion run
const CRISIS_INDICATOR_CODES = [
  'NY.GDP.MKTP.KD.ZG',  // GDP growth → recession
  'SL.UEM.TOTL.ZS',     // Unemployment → high-unemployment
  'FP.CPI.TOTL.ZG',     // Inflation → high-inflation / hyperinflation
  'GC.DOD.TOTL.GD.ZS',  // Central gov debt → high-debt
];

async function run() {
  console.log('=== WORLDBANK + CRISIS DETECTOR AUDIT ===\n');
  console.log('Schema note: polity linkage is via PolityClaim join table, not a direct column.');
  console.log('ingestedBy = worldbank_v1 (not pipelineTag)\n');

  // ── Q1: worldbank_v1 total / with PolityClaim / without ──────────────────
  console.log('─── Q1: worldbank_v1 polityId coverage (via PolityClaim) ───');
  const q1total = await sql`SELECT COUNT(*) as total FROM "Claim" WHERE "ingestedBy" = 'worldbank_v1'`;
  const q1with = await sql`
    SELECT COUNT(DISTINCT c.id) as with_polity
    FROM "Claim" c
    JOIN "PolityClaim" pc ON c.id = pc."claimId"
    WHERE c."ingestedBy" = 'worldbank_v1'
  `;
  const total = Number(q1total[0].total);
  const withPolity = Number(q1with[0].with_polity);
  console.log(`Total worldbank_v1 claims:   ${total}`);
  console.log(`With PolityClaim entry:       ${withPolity}`);
  console.log(`Without PolityClaim entry:    ${total - withPolity}`);
  console.log(`Coverage:                     ${((withPolity / total) * 100).toFixed(1)}%`);

  // ── Q2: Crisis-indicator claims WITH PolityClaim ──────────────────────────
  console.log('\n─── Q2: Crisis-indicator worldbank_v1 claims WITH PolityClaim ───');
  const q2 = await sql`
    SELECT
      COUNT(DISTINCT c.id) as crisis_with_polity,
      SUM(CASE WHEN (c.metadata->>'indicatorCode') = 'SL.UEM.TOTL.ZS' THEN 1 ELSE 0 END)::int as high_unemployment,
      SUM(CASE WHEN (c.metadata->>'indicatorCode') = 'GC.DOD.TOTL.GD.ZS' THEN 1 ELSE 0 END)::int as high_debt,
      SUM(CASE WHEN (c.metadata->>'indicatorCode') = 'NY.GDP.MKTP.KD.ZG' THEN 1 ELSE 0 END)::int as recession_gdp,
      SUM(CASE WHEN (c.metadata->>'indicatorCode') = 'FP.CPI.TOTL.ZG' THEN 1 ELSE 0 END)::int as inflation
    FROM "Claim" c
    JOIN "PolityClaim" pc ON c.id = pc."claimId"
    WHERE c."ingestedBy" = 'worldbank_v1'
      AND (c.metadata->>'indicatorCode') = ANY(ARRAY[
        'NY.GDP.MKTP.KD.ZG','SL.UEM.TOTL.ZS','FP.CPI.TOTL.ZG','GC.DOD.TOTL.GD.ZS'
      ])
  `;
  console.log(JSON.stringify(q2[0], null, 2));

  // ── Q3: Crisis-indicator claims WITHOUT PolityClaim ───────────────────────
  console.log('\n─── Q3: Crisis-indicator worldbank_v1 claims WITHOUT PolityClaim ───');
  const q3total = await sql`
    SELECT
      COUNT(*) as crisis_total,
      SUM(CASE WHEN (metadata->>'indicatorCode') = 'SL.UEM.TOTL.ZS' THEN 1 ELSE 0 END)::int as high_unemployment,
      SUM(CASE WHEN (metadata->>'indicatorCode') = 'GC.DOD.TOTL.GD.ZS' THEN 1 ELSE 0 END)::int as high_debt,
      SUM(CASE WHEN (metadata->>'indicatorCode') = 'NY.GDP.MKTP.KD.ZG' THEN 1 ELSE 0 END)::int as recession_gdp,
      SUM(CASE WHEN (metadata->>'indicatorCode') = 'FP.CPI.TOTL.ZG' THEN 1 ELSE 0 END)::int as inflation
    FROM "Claim"
    WHERE "ingestedBy" = 'worldbank_v1'
      AND (metadata->>'indicatorCode') = ANY(ARRAY[
        'NY.GDP.MKTP.KD.ZG','SL.UEM.TOTL.ZS','FP.CPI.TOTL.ZG','GC.DOD.TOTL.GD.ZS'
      ])
  `;
  const q3without = await sql`
    SELECT COUNT(DISTINCT c.id) as crisis_with_polity
    FROM "Claim" c
    JOIN "PolityClaim" pc ON c.id = pc."claimId"
    WHERE c."ingestedBy" = 'worldbank_v1'
      AND (c.metadata->>'indicatorCode') = ANY(ARRAY[
        'NY.GDP.MKTP.KD.ZG','SL.UEM.TOTL.ZS','FP.CPI.TOTL.ZG','GC.DOD.TOTL.GD.ZS'
      ])
  `;
  const crisisTotal = Number(q3total[0].crisis_total);
  const crisisWithPolity = Number(q3without[0].crisis_with_polity);
  console.log(`Crisis-indicator claims total:   ${crisisTotal}`);
  console.log(`  breakdown by indicator:`);
  console.log(`    high_unemployment (SL.UEM.TOTL.ZS): ${q3total[0].high_unemployment}`);
  console.log(`    high_debt (GC.DOD.TOTL.GD.ZS):      ${q3total[0].high_debt}`);
  console.log(`    recession/GDP growth (NY.GDP.MKTP.KD.ZG): ${q3total[0].recession_gdp}`);
  console.log(`    inflation (FP.CPI.TOTL.ZG):          ${q3total[0].inflation}`);
  console.log(`With PolityClaim:    ${crisisWithPolity}`);
  console.log(`Without PolityClaim: ${crisisTotal - crisisWithPolity}`);

  // ── Q4: Top 10 polities by worldbank_v1 claim count ──────────────────────
  console.log('\n─── Q4: Top 10 polities by worldbank_v1 claim count ───');
  const q4 = await sql`
    SELECT pol.name, pol."countryCode", COUNT(c.id) as claim_count
    FROM "Claim" c
    JOIN "PolityClaim" pc ON c.id = pc."claimId"
    JOIN "Polity" pol ON pc."polityId" = pol.id
    WHERE c."ingestedBy" = 'worldbank_v1'
    GROUP BY pol.id, pol.name, pol."countryCode"
    ORDER BY claim_count DESC
    LIMIT 10
  `;
  if (q4.length === 0) {
    console.log('  No worldbank_v1 claims linked to polities via PolityClaim.');
    // Fallback: count by metadata.countryIso3
    console.log('  Fallback: top 10 by metadata.countryIso3:');
    const q4b = await sql`
      SELECT metadata->>'countryIso3' as iso3, metadata->>'countryName' as country, COUNT(*) as claim_count
      FROM "Claim"
      WHERE "ingestedBy" = 'worldbank_v1'
      GROUP BY metadata->>'countryIso3', metadata->>'countryName'
      ORDER BY claim_count DESC
      LIMIT 10
    `;
    q4b.forEach(r => console.log(`    ${r.iso3} (${r.country}): ${r.claim_count} claims`));
  } else {
    q4.forEach(r => console.log(`  ${r.name} (${r.countryCode}): ${r.claim_count}`));
  }

  // ── Q5: Distinct polities covered by worldbank_v1 claims ─────────────────
  console.log('\n─── Q5: Distinct polities in worldbank_v1 (via PolityClaim) ───');
  const q5 = await sql`
    SELECT COUNT(DISTINCT pol.id) as distinct_polities
    FROM "Claim" c
    JOIN "PolityClaim" pc ON c.id = pc."claimId"
    JOIN "Polity" pol ON pc."polityId" = pol.id
    WHERE c."ingestedBy" = 'worldbank_v1'
  `;
  console.log(`Distinct polities (PolityClaim): ${q5[0].distinct_polities}`);
  // Fallback by metadata
  const q5b = await sql`
    SELECT COUNT(DISTINCT metadata->>'countryIso3') as distinct_iso3
    FROM "Claim"
    WHERE "ingestedBy" = 'worldbank_v1'
  `;
  console.log(`Distinct countries (by metadata.countryIso3): ${q5b[0].distinct_iso3}`);

  // ── Q6: Crisis-flagged ClaimRelations — do their target worldbank claims have polity? ──
  console.log('\n─── Q6: Crisis-flagged ECONOMIC_CONTEXT relations ───');
  const q6count = await sql`
    SELECT COUNT(*) as total_with_crisis
    FROM "ClaimRelation"
    WHERE "relationType" = 'ECONOMIC_CONTEXT'
      AND "followUpContext" IS NOT NULL
      AND "followUpContext"->>'crisisContext' IS NOT NULL
  `;
  console.log(`ECONOMIC_CONTEXT relations with crisisContext set: ${q6count[0].total_with_crisis}`);

  // Sample a crisis relation
  console.log('\n  Sample crisis ClaimRelation:');
  const q6sample = await sql`
    SELECT id, "fromClaimId", "toClaimId", "followUpContext"
    FROM "ClaimRelation"
    WHERE "relationType" = 'ECONOMIC_CONTEXT'
      AND "followUpContext"->>'crisisContext' IS NOT NULL
    LIMIT 1
  `;
  if (q6sample.length > 0) console.log(JSON.stringify(q6sample[0], null, 2));

  // Check if the toClaimId (worldbank claim) has a PolityClaim entry
  const q6polity = await sql`
    SELECT
      COUNT(*) as flagged_relations,
      SUM(CASE WHEN pc.id IS NOT NULL THEN 1 ELSE 0 END)::int as with_polity,
      SUM(CASE WHEN pc.id IS NULL THEN 1 ELSE 0 END)::int as without_polity
    FROM "ClaimRelation" cr
    LEFT JOIN "PolityClaim" pc ON cr."toClaimId" = pc."claimId"
    WHERE cr."relationType" = 'ECONOMIC_CONTEXT'
      AND cr."followUpContext"->>'crisisContext' IS NOT NULL
    LIMIT 1
  `;
  console.log('\n  Polity coverage on crisis-flagged target claims:');
  console.log(JSON.stringify(q6polity[0], null, 2));

  // Also check via followUpContext having crisis tags
  const q6tags = await sql`
    SELECT
      jsonb_array_elements_text("followUpContext"->'crisisContext'->'tags') as tag,
      COUNT(*) as relation_count
    FROM "ClaimRelation"
    WHERE "relationType" = 'ECONOMIC_CONTEXT'
      AND "followUpContext"->'crisisContext'->'tags' IS NOT NULL
    GROUP BY tag
    ORDER BY relation_count DESC
    LIMIT 10
  `;
  if (q6tags.length > 0) {
    console.log('\n  Crisis tags breakdown in ClaimRelation.followUpContext:');
    q6tags.forEach(r => console.log(`    ${r.tag}: ${r.relation_count}`));
  }

  // ── Q7: FUNDED_BY relations ───────────────────────────────────────────────
  console.log('\n─── Q7: FUNDED_BY ClaimRelation count ───');
  const q7 = await sql`
    SELECT COUNT(*) as total_funded_by FROM "ClaimRelation" WHERE "relationType" = 'FUNDED_BY'
  `;
  console.log(`Total FUNDED_BY relations: ${q7[0].total_funded_by}`);
  if (Number(q7[0].total_funded_by) > 0) {
    const q7sample = await sql`
      SELECT cr.id, cr."fromClaimId", cr."toClaimId", cr."createdAt",
             c1."ingestedBy" as from_pipeline, c2."ingestedBy" as to_pipeline
      FROM "ClaimRelation" cr
      JOIN "Claim" c1 ON cr."fromClaimId" = c1.id
      JOIN "Claim" c2 ON cr."toClaimId" = c2.id
      WHERE cr."relationType" = 'FUNDED_BY'
      ORDER BY cr."createdAt" DESC LIMIT 7
    `;
    console.log('  Sample FUNDED_BY relations:');
    q7sample.forEach(r => console.log(`    from=${r.from_pipeline} → to=${r.to_pipeline} (${r.createdAt})`));
  }

  // ── Q8: Recent FUNDED_BY (last 24h) ──────────────────────────────────────
  console.log('\n─── Q8: Recent FUNDED_BY relations (last 24h) ───');
  const q8 = await sql`
    SELECT cr."relationType", c."ingestedBy", COUNT(*) as cnt, MAX(cr."createdAt") as latest
    FROM "ClaimRelation" cr
    JOIN "Claim" c ON cr."fromClaimId" = c.id
    WHERE cr."relationType" = 'FUNDED_BY'
      AND cr."createdAt" > NOW() - INTERVAL '24 hours'
    GROUP BY cr."relationType", c."ingestedBy"
  `;
  if (q8.length === 0) console.log('  No FUNDED_BY relations created in the last 24h');
  else q8.forEach(r => console.log(JSON.stringify(r)));

  // ── Q9: AcademicField — claims linked ────────────────────────────────────
  console.log('\n─── Q9: AcademicField table and claim linkage ───');
  const q9a = await sql`SELECT COUNT(*) as total_academic_fields FROM "AcademicField"`;
  console.log(`AcademicField total rows: ${q9a[0].total_academic_fields}`);

  const q9b = await sql`
    SELECT COUNT(*) as claims_with_field
    FROM "Claim"
    WHERE "academicFieldId" IS NOT NULL
  `;
  console.log(`Claims with academicFieldId set: ${q9b[0].claims_with_field}`);

  // Check for separate join tables
  const q9c = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name ILIKE '%academic%'
    ORDER BY table_name
  `;
  console.log(`Academic-related tables: ${q9c.map(r => r.table_name).join(', ')}`);

  // ── Q10: Geographic coverage ──────────────────────────────────────────────
  console.log('\n─── Q10: Top 20 countries by total claim count (ALL claims via PolityClaim) ───');
  const q10top = await sql`
    SELECT pol.name, pol."countryCode", COUNT(c.id) as claim_count
    FROM "Claim" c
    JOIN "PolityClaim" pc ON c.id = pc."claimId"
    JOIN "Polity" pol ON pc."polityId" = pol.id
    WHERE c.deleted = false
    GROUP BY pol.id, pol.name, pol."countryCode"
    ORDER BY claim_count DESC
    LIMIT 20
  `;
  q10top.forEach((r, i) => console.log(`  ${i+1}. ${r.name} (${r.countryCode}): ${r.claim_count}`));

  console.log('\n─── Q10: Bottom 20 populated polities (at least 1 claim) ───');
  const q10bottom = await sql`
    SELECT pol.name, pol."countryCode", COUNT(c.id) as claim_count
    FROM "Claim" c
    JOIN "PolityClaim" pc ON c.id = pc."claimId"
    JOIN "Polity" pol ON pc."polityId" = pol.id
    WHERE c.deleted = false
    GROUP BY pol.id, pol.name, pol."countryCode"
    HAVING COUNT(c.id) >= 1
    ORDER BY claim_count ASC
    LIMIT 20
  `;
  q10bottom.forEach((r, i) => console.log(`  ${i+1}. ${r.name} (${r.countryCode}): ${r.claim_count}`));

  // Bonus: total polities with at least 1 claim
  const q10total = await sql`
    SELECT COUNT(DISTINCT pol.id) as polities_with_claims
    FROM "Claim" c
    JOIN "PolityClaim" pc ON c.id = pc."claimId"
    JOIN "Polity" pol ON pc."polityId" = pol.id
    WHERE c.deleted = false
  `;
  console.log(`\nTotal polities with at least 1 claim: ${q10total[0].polities_with_claims}`);

  // Overall summary stats
  console.log('\n─── BONUS: ECONOMIC_CONTEXT relation totals ───');
  const ecTotal = await sql`SELECT COUNT(*) as total FROM "ClaimRelation" WHERE "relationType" = 'ECONOMIC_CONTEXT'`;
  const ecWithCrisis = await sql`
    SELECT COUNT(*) as total FROM "ClaimRelation"
    WHERE "relationType" = 'ECONOMIC_CONTEXT'
      AND "followUpContext"->>'crisisContext' IS NOT NULL
  `;
  console.log(`Total ECONOMIC_CONTEXT relations: ${ecTotal[0].total}`);
  console.log(`With crisis tags (crisisContext set): ${ecWithCrisis[0].total}`);

  console.log('\n=== AUDIT COMPLETE ===');
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

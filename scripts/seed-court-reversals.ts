// Seed: landmark court-overruling trajectories (Settling Curve — Phase B1).
//
// Each entry is a constitutional/Convention doctrine that was SETTLED by a court
// and later REVERSED when that court overruled itself. Both transitions are
// ratified by the JUDICIAL community. These carry `trajectory:*` externalIds and
// therefore JOIN the hero switcher served by GET /api/trajectories.
//
// Marker sources resolve in priority order:
//   1. `existingClaimExternalId` — link to a real opinion already in the DB
//      (courtlistener_* or echr_*) by reusing its primary Source. Preferred when
//      the opinion is present.
//   2. otherwise upsert a curated Source with a real, verifiable citation URL
//      (Justia / HUDOC). Curated sources use `src:*` externalIds.
//
// Idempotent: Claims upsert on externalId; curated Sources upsert on externalId;
// each ClaimStatusHistory row upserts on a deterministic id `${externalId}:${i}`.
//
// Run:     npx dotenv-cli -e .env.local -- npx tsx scripts/seed-court-reversals.ts --live
// Dry-run: npx dotenv-cli -e .env.local -- npx tsx scripts/seed-court-reversals.ts   (default)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const LIVE = process.argv.includes("--live");
const DRY_RUN = !LIVE;

type FactStatus = "RECORDED" | "SETTLED" | "CONTESTED" | "OPEN" | "UNRESOLVABLE" | "REVERSED" | "ABANDONED";
type RatifyingCommunity = "EXPERT_LITERATURE" | "INSTITUTIONAL" | "JUDICIAL" | "PUBLIC" | "MARKET";
type DatePrecision = "DAY" | "MONTH" | "QUARTER" | "YEAR";

interface CuratedSource {
  externalId: string;
  name: string;
  url: string;
  publishedAt: string;
  methodologyType: "primary" | "derivative" | "opinion";
}

interface Marker {
  // Prefer linking to an existing opinion claim already in the DB.
  existingClaimExternalId?: string;
  // Fallback: a curated Source minted with a real citation URL.
  curated?: CuratedSource;
}

interface Transition {
  fromAxis: FactStatus | null;
  toAxis: FactStatus;
  community: RatifyingCommunity;
  occurredAt: string;
  datePrecision: DatePrecision;
  reason: string;
  marker: Marker;
}

interface Trajectory {
  externalId: string;
  text: string;
  claimType: "EMPIRICAL" | "INSTITUTIONAL" | "INTERPRETIVE" | "HYBRID";
  claimEmergedAt: string;
  claimEmergedPrecision: DatePrecision;
  currentAxis: "RECORDED" | "SETTLED" | "CONTESTED" | "OPEN" | "UNRESOLVABLE";
  transitions: Transition[];
}

const TRAJECTORIES: Trajectory[] = [
  // 1. Plessy → Brown: separate-but-equal in public schools.
  {
    externalId: "trajectory:plessy-brown",
    text: "Racial segregation in public schools is constitutional.",
    claimType: "INTERPRETIVE",
    claimEmergedAt: "1896-05-18",
    claimEmergedPrecision: "DAY",
    currentAxis: "CONTESTED",
    transitions: [
      {
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        occurredAt: "1896-05-18",
        datePrecision: "DAY",
        reason: 'Plessy v. Ferguson establishes the "separate but equal" doctrine, upholding state-mandated racial segregation.',
        marker: {
          curated: {
            externalId: "src:plessy-v-ferguson-1896",
            name: "Plessy v. Ferguson, 163 U.S. 537 (1896).",
            url: "https://supreme.justia.com/cases/federal/us/163/537/",
            publishedAt: "1896-05-18",
            methodologyType: "primary",
          },
        },
      },
      {
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        occurredAt: "1954-05-17",
        datePrecision: "DAY",
        reason: "Brown v. Board of Education holds that segregated public schools are inherently unequal, overruling Plessy in the education context.",
        marker: {
          curated: {
            externalId: "src:brown-v-board-1954",
            name: "Brown v. Board of Education of Topeka, 347 U.S. 483 (1954).",
            url: "https://supreme.justia.com/cases/federal/us/347/483/",
            publishedAt: "1954-05-17",
            methodologyType: "primary",
          },
        },
      },
    ],
  },

  // 2. Adkins → West Coast Hotel: liberty of contract vs. minimum wage.
  {
    externalId: "trajectory:adkins-west-coast-hotel",
    text: "Minimum wage laws for women violate the liberty of contract protected by the Due Process Clause.",
    claimType: "INTERPRETIVE",
    claimEmergedAt: "1923-04-09",
    claimEmergedPrecision: "DAY",
    currentAxis: "CONTESTED",
    transitions: [
      {
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        occurredAt: "1923-04-09",
        datePrecision: "DAY",
        reason: "Adkins v. Children's Hospital strikes a D.C. minimum-wage law for women as a violation of freedom of contract.",
        marker: {
          curated: {
            externalId: "src:adkins-v-childrens-hospital-1923",
            name: "Adkins v. Children's Hospital, 261 U.S. 525 (1923).",
            url: "https://supreme.justia.com/cases/federal/us/261/525/",
            publishedAt: "1923-04-09",
            methodologyType: "primary",
          },
        },
      },
      {
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        occurredAt: "1937-03-29",
        datePrecision: "DAY",
        reason: "West Coast Hotel Co. v. Parrish upholds a state minimum-wage law and expressly overrules Adkins, ending the Lochner era.",
        marker: {
          curated: {
            externalId: "src:west-coast-hotel-v-parrish-1937",
            name: "West Coast Hotel Co. v. Parrish, 300 U.S. 379 (1937).",
            url: "https://supreme.justia.com/cases/federal/us/300/379/",
            publishedAt: "1937-03-29",
            methodologyType: "primary",
          },
        },
      },
    ],
  },

  // 3. Bowers → Lawrence: criminalization of same-sex intimacy.
  {
    externalId: "trajectory:bowers-lawrence",
    text: "States may criminalize private, consensual same-sex sexual conduct.",
    claimType: "INTERPRETIVE",
    claimEmergedAt: "1986-06-30",
    claimEmergedPrecision: "DAY",
    currentAxis: "CONTESTED",
    transitions: [
      {
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        occurredAt: "1986-06-30",
        datePrecision: "DAY",
        reason: "Bowers v. Hardwick holds that the Constitution confers no right to engage in homosexual sodomy, upholding a Georgia criminal statute.",
        marker: {
          curated: {
            externalId: "src:bowers-v-hardwick-1986",
            name: "Bowers v. Hardwick, 478 U.S. 186 (1986).",
            url: "https://supreme.justia.com/cases/federal/us/478/186/",
            publishedAt: "1986-06-30",
            methodologyType: "primary",
          },
        },
      },
      {
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        occurredAt: "2003-06-26",
        datePrecision: "DAY",
        reason: "Lawrence v. Texas holds such statutes unconstitutional under the Due Process Clause and expressly overrules Bowers.",
        marker: {
          curated: {
            externalId: "src:lawrence-v-texas-2003",
            name: "Lawrence v. Texas, 539 U.S. 558 (2003).",
            url: "https://supreme.justia.com/cases/federal/us/539/558/",
            publishedAt: "2003-06-26",
            methodologyType: "primary",
          },
        },
      },
    ],
  },

  // 4. Abood → Janus: public-sector union agency fees.
  {
    externalId: "trajectory:abood-janus",
    text: "Public-sector unions may charge agency fees to non-member employees they represent.",
    claimType: "INTERPRETIVE",
    claimEmergedAt: "1977-05-23",
    claimEmergedPrecision: "DAY",
    currentAxis: "CONTESTED",
    transitions: [
      {
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        occurredAt: "1977-05-23",
        datePrecision: "DAY",
        reason: "Abood v. Detroit Board of Education upholds agency-shop fees for public employees to fund collective-bargaining activities.",
        marker: {
          curated: {
            externalId: "src:abood-v-detroit-boe-1977",
            name: "Abood v. Detroit Board of Education, 431 U.S. 209 (1977).",
            url: "https://supreme.justia.com/cases/federal/us/431/209/",
            publishedAt: "1977-05-23",
            methodologyType: "primary",
          },
        },
      },
      {
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        occurredAt: "2018-06-27",
        datePrecision: "DAY",
        reason: "Janus v. AFSCME holds that compelled agency fees violate the First Amendment and expressly overrules Abood.",
        marker: {
          curated: {
            externalId: "src:janus-v-afscme-2018",
            name: "Janus v. American Federation of State, County, and Municipal Employees, 585 U.S. 878 (2018).",
            url: "https://supreme.justia.com/cases/federal/us/585/16-1466/",
            publishedAt: "2018-06-27",
            methodologyType: "primary",
          },
        },
      },
    ],
  },

  // 5. Chevron → Loper Bright: judicial deference to agency interpretation.
  // SETTLED marker links to the existing CourtListener Chevron opinion.
  {
    externalId: "trajectory:chevron-loper-bright",
    text: "Courts must defer to a federal agency's reasonable interpretation of an ambiguous statute it administers.",
    claimType: "INTERPRETIVE",
    claimEmergedAt: "1984-06-25",
    claimEmergedPrecision: "DAY",
    currentAxis: "CONTESTED",
    transitions: [
      {
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        occurredAt: "1984-06-25",
        datePrecision: "DAY",
        reason: "Chevron U.S.A. v. NRDC establishes the two-step deference framework requiring courts to defer to reasonable agency statutory interpretations.",
        marker: { existingClaimExternalId: "cl-cluster-111221" },
      },
      {
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        occurredAt: "2024-06-28",
        datePrecision: "DAY",
        reason: "Loper Bright Enterprises v. Raimondo overrules Chevron, holding that courts must exercise independent judgment in interpreting statutes.",
        marker: {
          curated: {
            externalId: "src:loper-bright-v-raimondo-2024",
            name: "Loper Bright Enterprises v. Raimondo, 603 U.S. 369 (2024).",
            url: "https://supreme.justia.com/cases/federal/us/603/22-451/",
            publishedAt: "2024-06-28",
            methodologyType: "primary",
          },
        },
      },
    ],
  },

  // 6. Roe → Dobbs: constitutional right to abortion.
  // SETTLED marker links to the existing CourtListener Roe v. Wade opinion.
  {
    externalId: "trajectory:roe-dobbs",
    text: "The Constitution protects a woman's right to choose to have an abortion.",
    claimType: "INTERPRETIVE",
    claimEmergedAt: "1973-01-22",
    claimEmergedPrecision: "DAY",
    currentAxis: "CONTESTED",
    transitions: [
      {
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        occurredAt: "1973-01-22",
        datePrecision: "DAY",
        reason: "Roe v. Wade recognizes a constitutional right to abortion grounded in the Due Process Clause; reaffirmed by Planned Parenthood v. Casey (1992).",
        marker: { existingClaimExternalId: "cl-cluster-108713" },
      },
      {
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        occurredAt: "2022-06-24",
        datePrecision: "DAY",
        reason: "Dobbs v. Jackson Women's Health Organization overrules Roe and Casey, holding the Constitution confers no right to abortion.",
        marker: {
          curated: {
            externalId: "src:dobbs-v-jackson-2022",
            name: "Dobbs v. Jackson Women's Health Organization, 597 U.S. 215 (2022).",
            url: "https://supreme.justia.com/cases/federal/us/597/215/",
            publishedAt: "2022-06-24",
            methodologyType: "primary",
          },
        },
      },
    ],
  },

  // 7. Korematsu → Trump v. Hawaii: race-based wartime internment.
  {
    externalId: "trajectory:korematsu-trump-hawaii",
    text: "Military necessity can justify the race-based exclusion and internment of citizens.",
    claimType: "INTERPRETIVE",
    claimEmergedAt: "1944-12-18",
    claimEmergedPrecision: "DAY",
    currentAxis: "CONTESTED",
    transitions: [
      {
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        occurredAt: "1944-12-18",
        datePrecision: "DAY",
        reason: "Korematsu v. United States upholds the WWII exclusion order interning Japanese Americans on grounds of military necessity.",
        marker: {
          curated: {
            externalId: "src:korematsu-v-us-1944",
            name: "Korematsu v. United States, 323 U.S. 214 (1944).",
            url: "https://supreme.justia.com/cases/federal/us/323/214/",
            publishedAt: "1944-12-18",
            methodologyType: "primary",
          },
        },
      },
      {
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        occurredAt: "2018-06-26",
        datePrecision: "DAY",
        reason: 'Trump v. Hawaii states that Korematsu was "gravely wrong the day it was decided" and "has been overruled in the court of history," repudiating it.',
        marker: {
          curated: {
            externalId: "src:trump-v-hawaii-2018",
            name: "Trump v. Hawaii, 585 U.S. 667 (2018).",
            url: "https://supreme.justia.com/cases/federal/us/585/17-965/",
            publishedAt: "2018-06-26",
            methodologyType: "primary",
          },
        },
      },
    ],
  },

  // 8. Rees → Christine Goodwin (ECHR): legal recognition of gender reassignment.
  // Both markers link to existing echr_* opinions already in the DB.
  {
    externalId: "trajectory:rees-goodwin-echr",
    text: "The Convention imposes no obligation on a State to legally recognise a transgender person's reassigned gender.",
    claimType: "INTERPRETIVE",
    claimEmergedAt: "1986-10-17",
    claimEmergedPrecision: "DAY",
    currentAxis: "CONTESTED",
    transitions: [
      {
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        occurredAt: "1986-10-17",
        datePrecision: "DAY",
        reason: "Rees v. United Kingdom holds that Article 8 does not require the UK to legally recognise an applicant's post-operative gender.",
        marker: { existingClaimExternalId: "echr_001-57564" },
      },
      {
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        occurredAt: "2002-07-11",
        datePrecision: "DAY",
        reason: "Christine Goodwin v. United Kingdom departs from Rees, holding that Articles 8 and 12 now require legal recognition of gender reassignment.",
        marker: { existingClaimExternalId: "echr_001-60596" },
      },
    ],
  },
];

const REVIEW = {
  ingestedBy: "seed-court-reversals",
  humanReviewed: true,
  reviewConfidence: "HIGH" as const,
  reviewedBy: "robert",
};

// Resolve a marker to a real Source id.
//  - existingClaimExternalId: reuse that claim's first non-deleted Edge's Source.
//  - curated: upsert a curated Source.
// Throws if an existing claim/source cannot be found (never invents a marker).
async function resolveMarker(marker: Marker): Promise<{ sourceId: string; label: string }> {
  if (marker.existingClaimExternalId) {
    const claim = await prisma.claim.findUnique({
      where: { externalId: marker.existingClaimExternalId },
      select: {
        externalId: true,
        edges: {
          where: { deleted: false },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { sourceId: true, source: { select: { name: true } } },
        },
      },
    });
    if (!claim) throw new Error(`existing claim not found: ${marker.existingClaimExternalId}`);
    const edge = claim.edges[0];
    if (!edge?.sourceId) throw new Error(`existing claim has no source edge: ${marker.existingClaimExternalId}`);
    return { sourceId: edge.sourceId, label: `link→${marker.existingClaimExternalId} (${edge.source?.name?.slice(0, 50)})` };
  }
  if (marker.curated) {
    const def = marker.curated;
    if (DRY_RUN) return { sourceId: `dry:${def.externalId}`, label: `curated ${def.externalId}` };
    const s = await prisma.source.upsert({
      where: { externalId: def.externalId },
      create: {
        externalId: def.externalId,
        name: def.name,
        url: def.url,
        publishedAt: new Date(def.publishedAt),
        methodologyType: def.methodologyType,
        ...REVIEW,
        reviewedAt: new Date(),
      },
      update: { name: def.name, url: def.url, publishedAt: new Date(def.publishedAt), methodologyType: def.methodologyType },
    });
    return { sourceId: s.id, label: `curated ${def.externalId}` };
  }
  throw new Error("marker has neither existingClaimExternalId nor curated source");
}

async function seed(traj: Trajectory): Promise<{ nullMarkers: number }> {
  console.log(`\n▸ ${traj.externalId}`);
  console.log(`  "${traj.text}"`);

  let claimId = `dry:${traj.externalId}`;
  if (!DRY_RUN) {
    const claim = await prisma.claim.upsert({
      where: { externalId: traj.externalId },
      create: {
        externalId: traj.externalId,
        text: traj.text,
        claimType: traj.claimType,
        claimEmergedAt: new Date(traj.claimEmergedAt),
        claimEmergedPrecision: traj.claimEmergedPrecision,
        epistemicAxis: traj.currentAxis,
        ...REVIEW,
        reviewedAt: new Date(),
      },
      update: {
        text: traj.text,
        claimType: traj.claimType,
        claimEmergedAt: new Date(traj.claimEmergedAt),
        claimEmergedPrecision: traj.claimEmergedPrecision,
        epistemicAxis: traj.currentAxis,
      },
    });
    claimId = claim.id;
  }

  let nullMarkers = 0;
  for (let i = 0; i < traj.transitions.length; i++) {
    const t = traj.transitions[i];
    const { sourceId, label } = await resolveMarker(t.marker);
    if (!sourceId) nullMarkers++;
    const historyId = `${traj.externalId}:${i}`;
    console.log(`  [${i}] ${t.fromAxis ?? "∅"} → ${t.toAxis}  (${t.community}, ${t.occurredAt})  marker: ${label}`);
    if (DRY_RUN) continue;
    await prisma.claimStatusHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
        claimId,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId,
      },
    });
  }
  return { nullMarkers };
}

async function main() {
  console.log(`=== Seed Court Reversals ${DRY_RUN ? "(DRY RUN — no writes)" : "(LIVE)"} ===`);
  const transitionCount = TRAJECTORIES.reduce((n, t) => n + t.transitions.length, 0);
  console.log(`${TRAJECTORIES.length} overruling trajectories, ${transitionCount} transitions`);

  let totalNullMarkers = 0;
  for (const traj of TRAJECTORIES) {
    const { nullMarkers } = await seed(traj);
    totalNullMarkers += nullMarkers;
  }

  console.log(`\n✓ Done${DRY_RUN ? " (dry run)" : ""}. Null markers: ${totalNullMarkers} (must be 0).`);
  if (totalNullMarkers > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

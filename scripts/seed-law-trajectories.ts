/**
 * seed-law-trajectories.ts
 *
 * Seeds 5 landmark U.S. constitutional-law trajectories into the settling curve
 * system. Each becomes a Claim with externalId "trajectory:<id>" and a series
 * of ClaimStatusHistory records tracing the doctrine's epistemic arc.
 *
 * Run (dry):
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/seed-law-trajectories.ts
 * Run (write):
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/seed-law-trajectories.ts
 */

import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const DRY = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");

type Milestone = {
  date: string;          // YYYY-MM-DD (or YYYY-01-01 when month unknown)
  precision: string;     // DAY | MONTH | YEAR
  fromAxis: string | null;
  toAxis: string;
  community: string;
  reason: string;
  sourceName: string;
  sourceUrl: string;
};

type LawTrajectory = {
  id: string;             // used as externalId "trajectory:<id>" and ?t= param
  claim: string;
  emergedAt: string;      // ISO date of first milestone
  milestones: Milestone[];
};

const TRAJECTORIES: LawTrajectory[] = [
  {
    id: "separate-but-equal",
    claim:
      "The doctrine of 'separate but equal' permits racial segregation in public facilities under the Equal Protection Clause of the Fourteenth Amendment.",
    emergedAt: "1896-05-18",
    milestones: [
      {
        date: "1896-05-18",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Plessy v. Ferguson (163 U.S. 537, 18 May 1896): The Supreme Court upholds Louisiana's Separate Car Act 7–1, holding that 'separate but equal' accommodations do not violate the Fourteenth Amendment. Justice Harlan dissents, calling the Constitution 'color-blind.' The ruling becomes the legal foundation for Jim Crow legislation across the South for nearly six decades.",
        sourceName: "Plessy v. Ferguson, 163 U.S. 537 (1896)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/163/537/",
      },
      {
        date: "1938-12-12",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Missouri ex rel. Gaines v. Canada (305 U.S. 337, 12 December 1938): The Supreme Court rules 6–2 that Missouri cannot satisfy the Fourteenth Amendment by paying Black residents to attend out-of-state law schools — the state must provide an equal in-state option. The ruling does not overturn Plessy but marks the first successful NAACP legal challenge and signals the Court will scrutinise whether 'equal' is actually provided.",
        sourceName: "Missouri ex rel. Gaines v. Canada, 305 U.S. 337 (1938)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/305/337/",
      },
      {
        date: "1950-06-05",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Sweatt v. Painter (339 U.S. 629, 5 June 1950): A unanimous Court holds that the hastily-built Texas State University law school for Black students is demonstrably unequal — in faculty, library, prestige, and alumni network — to the University of Texas Law School. The ruling does not explicitly overturn Plessy but makes it legally impossible for segregated professional schools to claim genuine equality, effectively hollowing out the doctrine.",
        sourceName: "Sweatt v. Painter, 339 U.S. 629 (1950)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/339/629/",
      },
      {
        date: "1954-05-17",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          `Brown v. Board of Education (347 U.S. 483, 17 May 1954): A unanimous Supreme Court overrules Plessy — 'We conclude that, in the field of public education, the doctrine of "separate but equal" has no place. Separate educational facilities are inherently unequal.' Chief Justice Warren delivers the opinion for a unanimous nine-justice Court, ending 58 years of separate-but-equal as constitutional doctrine in the public school context.`,
        sourceName: "Brown v. Board of Education, 347 U.S. 483 (1954)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/347/483/",
      },
    ],
  },

  {
    id: "abortion-constitutional-right",
    claim:
      "The U.S. Constitution's implied right to privacy protects a woman's decision to terminate a pregnancy, particularly before fetal viability.",
    emergedAt: "1965-06-07",
    milestones: [
      {
        date: "1965-06-07",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "Griswold v. Connecticut (381 U.S. 479, 7 June 1965): The Supreme Court holds 7–2 that a Connecticut law banning contraceptives violates a marital right to privacy found in the 'penumbras' of the Bill of Rights. Justice Douglas's majority opinion does not mention abortion, but establishes the constitutional privacy doctrine that Roe will later invoke. The dissents by Black and Stewart deny any such unenumerated right exists.",
        sourceName: "Griswold v. Connecticut, 381 U.S. 479 (1965)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/381/479/",
      },
      {
        date: "1973-01-22",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Roe v. Wade (410 U.S. 113, 22 January 1973): A 7–2 majority holds that the constitutional right to privacy encompasses a woman's decision to terminate a pregnancy, subject to state interests that increase with gestational age. The trimester framework divides pregnancy into three phases, with essentially no permissible state regulation in the first trimester. The decision instantly becomes the most contested constitutional ruling of the twentieth century.",
        sourceName: "Roe v. Wade, 410 U.S. 113 (1973)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/410/113/",
      },
      {
        date: "1989-07-03",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Webster v. Reproductive Health Services (492 U.S. 490, 3 July 1989): A fractured 5–4 Court upholds Missouri restrictions on abortion without formally overturning Roe, but four justices signal willingness to do so. Justice Scalia criticises the majority for not overruling Roe directly. The ruling signals that a majority may be assembled to restrict or reverse Roe and triggers a flood of state legislative activity.",
        sourceName: "Webster v. Reproductive Health Services, 492 U.S. 490 (1989)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/492/490/",
      },
      {
        date: "1992-06-29",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Planned Parenthood of Southeastern Pa. v. Casey (505 U.S. 833, 29 June 1992): A 5–4 majority reaffirms the 'essential holding' of Roe but replaces the trimester framework with an 'undue burden' standard. Justices O'Connor, Kennedy, and Souter author a joint plurality. The right to abortion before viability is preserved, but the doctrinal basis is significantly weakened and states gain wider latitude to regulate.",
        sourceName: "Planned Parenthood v. Casey, 505 U.S. 833 (1992)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/505/833/",
      },
      {
        date: "2022-06-24",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "Dobbs v. Jackson Women's Health Organization (597 U.S. 215, 24 June 2022): A 6–3 majority explicitly overrules Roe v. Wade and Planned Parenthood v. Casey, holding that the Constitution confers no right to abortion. Justice Alito's majority opinion concludes neither Roe nor Casey can be sustained under any rational-basis or substantive due process analysis. The ruling immediately triggers abortion bans in 13 states and ends 49 years of federal constitutional protection.",
        sourceName: "Dobbs v. Jackson Women's Health Organization, 597 U.S. 215 (2022)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/597/215/",
      },
    ],
  },

  {
    id: "miranda-rights",
    claim:
      "Police must inform suspects in custody of their constitutional rights — including the right to remain silent and to have an attorney — before conducting a custodial interrogation.",
    emergedAt: "1964-06-22",
    milestones: [
      {
        date: "1964-06-22",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "Escobedo v. Illinois (378 U.S. 478, 22 June 1964): A 5–4 Court holds that a suspect's Sixth Amendment right to counsel attaches when the investigation shifts from general inquiry to focused accusation. The police denied Escobedo access to his attorney during interrogation. The ruling is narrow and confusing but signals the Court's readiness to regulate custodial interrogation practices — a direct precursor to Miranda.",
        sourceName: "Escobedo v. Illinois, 378 U.S. 478 (1964)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/378/478/",
      },
      {
        date: "1966-06-13",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Miranda v. Arizona (384 U.S. 436, 13 June 1966): A 5–4 majority holds that the Fifth Amendment privilege against self-incrimination requires police to warn suspects in custody that they have the right to remain silent, that anything said may be used against them, and that they have the right to an attorney before and during questioning. Chief Justice Warren's majority opinion creates a bright-line procedural safeguard. Dissents by Clark, Harlan, White, and Stewart argue the Court has no authority to impose such prophylactic rules.",
        sourceName: "Miranda v. Arizona, 384 U.S. 436 (1966)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/384/436/",
      },
      {
        date: "1984-06-12",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "New York v. Quarles (467 U.S. 649, 12 June 1984): A 5–4 majority carves a 'public safety' exception to Miranda: police may ask questions reasonably prompted by concern for officer or public safety before administering warnings. The Court holds that unwarned answers obtained under this exception are admissible. Justice O'Connor concurs in part and dissents in part, warning the exception may swallow the rule. The ruling opens doctrinal space for further Miranda erosion.",
        sourceName: "New York v. Quarles, 467 U.S. 649 (1984)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/467/649/",
      },
      {
        date: "2000-06-26",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Dickerson v. United States (530 U.S. 428, 26 June 2000): A 7–2 majority strikes down 18 U.S.C. § 3501, a 1968 statute that sought to overrule Miranda by making voluntariness the sole test for admissibility. Chief Justice Rehnquist — himself a longtime Miranda critic — holds that Miranda announced a constitutional rule that only the Supreme Court can modify or overrule, and that it has become embedded in routine police practice. The ruling conclusively settles Miranda's constitutional status.",
        sourceName: "Dickerson v. United States, 530 U.S. 428 (2000)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/530/428/",
      },
    ],
  },

  {
    id: "same-sex-marriage-us",
    claim:
      "Same-sex couples have a fundamental constitutional right to marry under the Due Process and Equal Protection Clauses of the Fourteenth Amendment.",
    emergedAt: "1972-10-10",
    milestones: [
      {
        date: "1972-10-10",
        precision: "DAY",
        fromAxis: null,
        toAxis: "OPEN",
        community: "JUDICIAL",
        reason:
          "Baker v. Nelson (409 U.S. 810, 10 October 1972): The Supreme Court dismisses a same-sex couple's marriage-rights appeal 'for want of a substantial federal question,' issuing only a one-line order. Under then-existing jurisdictional rules this constitutes a binding precedent on the merits. For two decades it forecloses federal constitutional claims for same-sex marriage, signalling that the Court does not recognise the issue as raising any serious constitutional question.",
        sourceName: "Baker v. Nelson, 409 U.S. 810 (1972)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/409/810/",
      },
      {
        date: "1996-09-21",
        precision: "DAY",
        fromAxis: "OPEN",
        toAxis: "CONTESTED",
        community: "INSTITUTIONAL",
        reason:
          "Defense of Marriage Act (DOMA), Pub. L. 104-199 (21 September 1996): President Clinton signs DOMA, which defines marriage as between a man and a woman for all federal purposes (§ 3) and permits states to refuse recognition of same-sex marriages performed in other states (§ 2). Congress passes the law 342–67 in the House and 85–14 in the Senate. The legislation converts a previously non-salient question into an explicit political and legal battleground.",
        sourceName: "Defense of Marriage Act, Pub. L. 104-199 (1996)",
        sourceUrl: "https://www.govinfo.gov/content/pkg/PLAW-104publ199/pdf/PLAW-104publ199.pdf",
      },
      {
        date: "2003-06-26",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Lawrence v. Texas (539 U.S. 558, 26 June 2003): A 6–3 majority overrules Bowers v. Hardwick and strikes down Texas's anti-sodomy law, holding that consenting adults have a constitutional liberty interest in private sexual conduct. Justice Kennedy's majority opinion avoids the word 'marriage,' but Justice Scalia's dissent warns the ruling's logic cannot be limited: 'If, as the Court asserts, the promotion of majoritarian sexual morality is not even a legitimate state interest … what justification could there possibly be for denying the benefits of marriage to homosexual couples?' Scalia's question becomes the plaintiffs' argument in every subsequent marriage case.",
        sourceName: "Lawrence v. Texas, 539 U.S. 558 (2003)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/539/558/",
      },
      {
        date: "2013-06-26",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "United States v. Windsor (570 U.S. 744, 26 June 2013): A 5–4 majority strikes down DOMA § 3, holding that the federal definition of marriage as opposite-sex violates the Fifth Amendment's guarantee of equal liberty. Justice Kennedy's majority does not establish a fundamental right to same-sex marriage, but invalidates the federal exclusion on both due process and equal protection grounds. The ruling entitles Windsor to a $363,000 estate-tax refund and requires the federal government to recognise same-sex marriages where legal. Twelve states now permit same-sex marriage.",
        sourceName: "United States v. Windsor, 570 U.S. 744 (2013)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/570/744/",
      },
      {
        date: "2015-06-26",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Obergefell v. Hodges (576 U.S. 644, 26 June 2015): A 5–4 majority holds that the Fourteenth Amendment requires all states to license and recognise same-sex marriages. Justice Kennedy's majority opinion holds that marriage is a fundamental right under both the Due Process and Equal Protection Clauses: 'No union is more profound than marriage … [The petitioners] ask for equal dignity in the eyes of the law. The Constitution grants them that right.' Chief Justice Roberts and Justices Scalia, Thomas, and Alito each file separate dissents. The decision makes same-sex marriage the law in all 50 states.",
        sourceName: "Obergefell v. Hodges, 576 U.S. 644 (2015)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/576/644/",
      },
    ],
  },

  {
    id: "fourth-amendment-digital-privacy",
    claim:
      "The Fourth Amendment's protection against unreasonable searches extends to digital communications and electronic location data, even when held by third-party service providers.",
    emergedAt: "1967-12-18",
    milestones: [
      {
        date: "1967-12-18",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "Katz v. United States (389 U.S. 347, 18 December 1967): A 7–1 majority holds that the Fourth Amendment 'protects people, not places' — attaching to any area where a person has a 'reasonable expectation of privacy.' FBI agents listened to a pay-phone call without a warrant, and the Court rules this was an unconstitutional search. Justice Harlan's concurrence formulates the two-prong reasonable-expectation-of-privacy test that governs Fourth Amendment analysis for the next half-century and is the foundational case for all digital-privacy doctrine.",
        sourceName: "Katz v. United States, 389 U.S. 347 (1967)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/389/347/",
      },
      {
        date: "1979-06-20",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Smith v. Maryland (442 U.S. 735, 20 June 1979): A 5–3 majority holds that installing a pen register (recording numbers dialled from a phone) without a warrant does not violate the Fourth Amendment because phone users voluntarily convey dialled numbers to the telephone company and therefore have no reasonable expectation of privacy in that information. This 'third-party doctrine' becomes the principal obstacle to extending Fourth Amendment protection to data held by internet service providers, phone companies, and other digital intermediaries.",
        sourceName: "Smith v. Maryland, 442 U.S. 735 (1979)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/442/735/",
      },
      {
        date: "2012-01-23",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "United States v. Jones (565 U.S. 400, 23 January 2012): A unanimous Court holds that attaching a GPS device to a vehicle and tracking its movements for 28 days constitutes a Fourth Amendment search. The majority relies on the common-law trespass test. Five justices in concurrence signal — but do not hold — that long-term aggregated location surveillance implicates privacy interests independent of trespass, directly challenging the third-party doctrine as applied to digital tracking.",
        sourceName: "United States v. Jones, 565 U.S. 400 (2012)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/565/400/",
      },
      {
        date: "2014-06-25",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Riley v. California (573 U.S. 373, 25 June 2014): A unanimous Court holds that police must obtain a warrant before searching the digital contents of a cell phone seized incident to arrest. Chief Justice Roberts's opinion reasons that the data held on a modern smartphone is categorically different from physical items: 'The fact that technology now allows an individual to carry such information in his hand does not make the information any less worthy of the protection for which the Founders fought.' The ruling is the first unambiguous holding that digital data warrants full Fourth Amendment protection.",
        sourceName: "Riley v. California, 573 U.S. 373 (2014)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/573/373/",
      },
      {
        date: "2018-06-22",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Carpenter v. United States (585 U.S. 296, 22 June 2018): A 5–4 majority holds that accessing seven days or more of cell-site location information (CSLI) from a carrier constitutes a Fourth Amendment search requiring a warrant, even though the data is held by a third party. Chief Justice Roberts's majority carves a narrow exception to the third-party doctrine for 'seismic shifts in digital technology,' reasoning that CSLI gives the government 'near perfect surveillance' of a person's past movements. The ruling substantially limits Smith v. Maryland's reach in the digital age.",
        sourceName: "Carpenter v. United States, 585 U.S. 296 (2018)",
        sourceUrl: "https://supreme.justia.com/cases/federal/us/585/296/",
      },
    ],
  },
];

async function main() {
  console.log(`DRY_RUN=${DRY}. Pass ALLOW_EDITS=true to write.`);

  for (const traj of TRAJECTORIES) {
    const externalId = `trajectory:${traj.id}`;

    // Check for existing
    const existing = await p.claim.findUnique({ where: { externalId } });
    if (existing) {
      console.log(`SKIP ${traj.id} — already exists (id=${existing.id})`);
      continue;
    }

    if (DRY) {
      console.log(`DRY would create: ${externalId}`);
      for (const m of traj.milestones) {
        console.log(`  ${m.date} ${m.toAxis} (${m.community})`);
      }
      continue;
    }

    const claim = await p.claim.create({
      data: {
        text: traj.claim,
        externalId,
        ingestedBy: "law-settler",
        autoApproved: true,
        humanReviewed: false,
        deleted: false,
        claimType: "INSTITUTIONAL",
        epistemicAxis: traj.milestones[traj.milestones.length - 1].toAxis,
        claimEmergedAt: new Date(traj.emergedAt),
        claimEmergedPrecision: "DAY",
      },
    });
    console.log(`CREATED claim ${claim.id} for ${traj.id}`);

    for (const m of traj.milestones) {
      const src = await p.source.create({
        data: {
          name: m.sourceName,
          url: m.sourceUrl,
          publishedAt: new Date(m.date),
          methodologyType: "primary",
          ingestedBy: "law-settler",
          autoApproved: true,
          humanReviewed: false,
        },
      });

      await p.claimStatusHistory.create({
        data: {
          claimId: claim.id,
          fromAxis: m.fromAxis,
          toAxis: m.toAxis,
          community: m.community as any,
          reason: m.reason,
          occurredAt: new Date(m.date),
          datePrecision: m.precision,
          sourceId: src.id,
        },
      });
      console.log(`  + ${m.date} ${m.toAxis} (${m.community})`);
    }
  }

  console.log("Done.");
  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});

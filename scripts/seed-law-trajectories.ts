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
  methodologyType?: string; // defaults to "primary" if omitted
};

type LawTrajectory = {
  id: string;             // used as externalId "trajectory:<id>" and ?t= param
  claim: string;
  emergedAt: string;      // ISO date of first milestone
  emergedPrecision?: string; // defaults to "DAY" if omitted
  claimType?: string;     // defaults to "INSTITUTIONAL" if omitted
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

  {
    id: "judicial-review-marbury-1803",
    claim:
      "The U.S. Supreme Court held in Marbury v. Madison, decided 24 February 1803, that it is the province and duty of the federal judiciary to say what the law is and to declare an act of Congress that conflicts with the Constitution void — establishing the power of judicial review.",
    emergedAt: "1803-02-24",
    milestones: [
      {
        date: "1803-02-24",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Marbury v. Madison (5 U.S. 137, 24 Feb 1803): Chief Justice Marshall, writing for a unanimous Court, held that Section 13 of the Judiciary Act of 1789 unconstitutionally expanded the Court's original jurisdiction and was therefore void — 'a legislative act contrary to the constitution is not law.' The decision resolved the previously open question of whether courts could invalidate acts of Congress, asserting judicial review as a core judicial function.",
        sourceName: "Marshall CJ. Marbury v. Madison, 5 U.S. (1 Cranch) 137 (1803). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/5/137",
      },
      {
        date: "1958-09-29",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Cooper v. Aaron (358 U.S. 1, 29 Sep 1958): Facing Arkansas's resistance to school desegregation, all nine justices individually signed an opinion reaffirming that Marbury established 'the basic principle that the federal judiciary is supreme in the exposition of the law of the Constitution,' binding on state officials under Article VI. The ruling cemented judicial supremacy as a permanent, indispensable feature of the constitutional system 155 years after Marbury.",
        sourceName: "Supreme Court of the United States. Cooper v. Aaron, 358 U.S. 1 (1958). Per curiam opinion signed by all nine Justices.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/358/1",
      },
    ],
  },

  {
    id: "implied-powers-mcculloch-1819",
    claim:
      "The U.S. Supreme Court held in McCulloch v. Maryland, decided 6 March 1819, that Congress has implied powers under the Necessary and Proper Clause to charter a national bank and that a state may not tax a federal instrumentality — establishing broad national authority over the states.",
    emergedAt: "1819-03-06",
    milestones: [
      {
        date: "1819-03-06",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "McCulloch v. Maryland (17 U.S. 316, 6 Mar 1819): A unanimous Court led by Chief Justice Marshall held that the Necessary and Proper Clause grants Congress discretion to choose any means rationally related to an enumerated power ('let the end be legitimate ... all means which are appropriate ... are constitutional'), upholding the Second Bank of the United States. It also struck Maryland's tax on the Bank, reasoning that 'the power to tax involves the power to destroy.' The decision settled the long-disputed scope of federal implied powers and the supremacy of federal instrumentalities over state interference.",
        sourceName: "Marshall CJ. McCulloch v. Maryland, 17 U.S. (4 Wheat.) 316 (1819). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/17/316",
      },
    ],
  },

  {
    id: "exclusionary-rule-1914",
    claim:
      "U.S. courts must exclude evidence obtained in violation of the Fourth Amendment's guarantee against unreasonable searches and seizures — a rule first established for federal courts in Weeks v. United States (1914).",
    emergedAt: "1914-02-24",
    milestones: [
      {
        date: "1914-02-24",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Weeks v. United States (232 U.S. 383, 24 Feb 1914): A unanimous Court held that letters seized from Weeks's home by a federal officer without a warrant had to be returned and could not be used against him, because admitting illegally seized evidence would render the Fourth Amendment's protections meaningless. The ruling established the federal exclusionary rule as the enforcement mechanism for the Fourth Amendment.",
        sourceName: "Day J. Weeks v. United States, 232 U.S. 383 (1914). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/232/383",
      },
      {
        date: "1949-06-27",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Wolf v. Colorado (338 U.S. 25, 27 Jun 1949): The Court held that the Fourth Amendment's core protection is enforceable against the states through the Fourteenth Amendment, but declined to require the exclusionary rule in state prosecutions, holding that states could rely on alternative remedies such as civil suits and police discipline. This split the right from its federal remedy and left contested whether exclusion was constitutionally compelled.",
        sourceName: "Frankfurter J. Wolf v. Colorado, 338 U.S. 25 (1949). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/338/25",
      },
      {
        date: "1961-06-19",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Mapp v. Ohio (367 U.S. 643, 19 Jun 1961): A 6–3 Court overruled Wolf, holding that 'all evidence obtained by searches and seizures in violation of the Constitution is, by that same authority, inadmissible in a state court.' The decision extended the exclusionary rule to the states, making it a uniform, constitutionally required remedy and resolving the federal/state inconsistency Wolf had created.",
        sourceName: "Clark J. Mapp v. Ohio, 367 U.S. 643 (1961). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/367/643",
      },
      {
        date: "1984-07-05",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "United States v. Leon (468 U.S. 897, 5 Jul 1984): The Court created a 'good-faith' exception, holding that evidence seized by officers in objectively reasonable reliance on a warrant later found defective need not be excluded. By reframing the exclusionary rule as a judicially created deterrent remedy rather than a personal constitutional right, Leon reopened contestation over the rule's scope and triggered decades of further narrowing (e.g., Herring, Davis).",
        sourceName: "White J. United States v. Leon, 468 U.S. 897 (1984). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/468/897",
      },
    ],
  },

  {
    id: "brady-disclosure-doctrine-1963",
    claim:
      "Due process requires the prosecution to disclose to the defense evidence favorable and material to guilt or punishment — the Brady disclosure duty established in Brady v. Maryland (1963).",
    emergedAt: "1963-05-13",
    milestones: [
      {
        date: "1963-05-13",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Brady v. Maryland (373 U.S. 83, 13 May 1963): The Court held that 'the suppression by the prosecution of evidence favorable to an accused upon request violates due process where the evidence is material either to guilt or to punishment, irrespective of the good faith or bad faith of the prosecution.' The ruling established an affirmative constitutional disclosure obligation on prosecutors as a component of the fair-trial guarantee.",
        sourceName: "Douglas J. Brady v. Maryland, 373 U.S. 83 (1963). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/373/83",
      },
      {
        date: "1985-07-02",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "United States v. Bagley (473 U.S. 667, 2 Jul 1985): The Court unified the standard for Brady violations around a single materiality test — evidence is material only if there is 'a reasonable probability that, had the evidence been disclosed, the result of the proceeding would have been different.' By conditioning the constitutional violation on this outcome-based standard rather than the fact of suppression, Bagley made the doctrine's application uncertain and heavily litigated.",
        sourceName: "Blackmun J. United States v. Bagley, 473 U.S. 667 (1985). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/473/667",
      },
      {
        date: "1995-04-19",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Kyles v. Whitley (514 U.S. 419, 19 Apr 1995): The Court clarified that Brady materiality is assessed by the cumulative effect of all suppressed favorable evidence, not item by item, and that the prosecution bears an inescapable duty to learn of and disclose favorable evidence known to police even if not communicated to the prosecutor. The decision stabilized the Bagley standard into a workable, enforceable rule.",
        sourceName: "Souter J. Kyles v. Whitley, 514 U.S. 419 (1995). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/514/419",
      },
    ],
  },

  {
    id: "prigg-fugitive-slave-federal-power-1842",
    claim:
      "The U.S. Supreme Court held in Prigg v. Pennsylvania, decided 1 March 1842, that the Constitution's Fugitive Slave Clause and the 1793 Fugitive Slave Act vested exclusive federal power over the recapture of fugitive slaves, rendering state personal-liberty laws that interfered with rendition unconstitutional.",
    emergedAt: "1842-03-01",
    milestones: [
      {
        date: "1842-03-01",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Prigg v. Pennsylvania (41 U.S. 539, 1 Mar 1842): Justice Story, for the Court, held that the Fugitive Slave Clause guaranteed a slaveholder's right of recaption, that Congress had constitutional power to enact the 1793 Fugitive Slave Act, and that federal power over rendition was exclusive — so Pennsylvania's 1826 personal-liberty law was void and Prigg's conviction for kidnapping was reversed. The ruling settled the constitutional supremacy of federal fugitive-slave enforcement over conflicting state protections.",
        sourceName: "Story J. Prigg v. Pennsylvania, 41 U.S. (16 Pet.) 539 (1842). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/41/539",
      },
      {
        date: "1865-12-06",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "INSTITUTIONAL",
        reason:
          "Thirteenth Amendment (ratified 6 Dec 1865): The abolition of slavery and involuntary servitude extinguished the legal category of 'fugitive slave' and mooted the Fugitive Slave Clause of Article IV, nullifying the constitutional foundation of Prigg's holding. The federal fugitive-rendition regime that Prigg had made supreme ceased to have any lawful subject, ending the doctrine by constitutional amendment.",
        sourceName: "U.S. Constitution, Amendment XIII (ratified 6 December 1865). Abolition of slavery and involuntary servitude.",
        sourceUrl: "https://www.law.cornell.edu/constitution/amendmentxiii",
      },
    ],
  },

  {
    id: "strict-products-liability-1963",
    claim:
      "A manufacturer is strictly liable in tort for injuries caused by a defective product it places on the market, without proof of negligence or contractual privity — adopted by the California Supreme Court in Greenman v. Yuba Power Products, Inc. (24 January 1963).",
    emergedAt: "1944-07-05",
    milestones: [
      {
        date: "1944-07-05",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "Escola v. Coca-Cola Bottling Co. of Fresno (24 Cal.2d 453, 5 July 1944): The majority decided the exploding-bottle case on res ipsa loquitur negligence grounds, but Justice Roger Traynor's concurrence argued that a manufacturer should incur absolute liability when a product it markets, knowing it will be used without inspection, proves defective and causes injury. The theory of strict products liability was thereby recorded in a leading opinion, but it was not yet law — it commanded only a single concurring vote.",
        sourceName:
          "Traynor J. (concurring). Escola v. Coca-Cola Bottling Co. of Fresno, 24 Cal.2d 453, 150 P.2d 436 (1944).",
        sourceUrl:
          "https://law.justia.com/cases/california/supreme-court/2d/24/453.html",
      },
      {
        date: "1963-01-24",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Greenman v. Yuba Power Products, Inc. (59 Cal.2d 57, 24 January 1963): Justice Traynor, now writing for a unanimous California Supreme Court, held that 'a manufacturer is strictly liable in tort when an article he places on the market, knowing that it is to be used without inspection for defects, proves to have a defect that causes injury.' The concurrence's theory from Escola became binding doctrine, freeing product-injury plaintiffs from warranty privity and notice requirements.",
        sourceName:
          "Traynor J. Greenman v. Yuba Power Products, Inc., 59 Cal.2d 57, 377 P.2d 897 (1963). Opinion of the Court.",
        sourceUrl:
          "https://law.justia.com/cases/california/supreme-court/2d/59/57.html",
      },
      {
        date: "1965-01-01",
        precision: "YEAR",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "EXPERT_LITERATURE",
        reason:
          "Restatement (Second) of Torts § 402A (approved by the American Law Institute in 1964, published 1965): The ALI adopted as black-letter law the rule that one who sells a product 'in a defective condition unreasonably dangerous' is liable for resulting physical harm even though the seller exercised all possible care and the user has no contractual relation with the seller. Section 402A converted Greenman's California holding into a national template that most state high courts adopted within a decade, settling strict products liability across American tort law.",
        sourceName:
          "American Law Institute. Restatement (Second) of Torts § 402A: Special Liability of Seller of Product for Physical Harm to User or Consumer (1965).",
        sourceUrl:
          "https://biotech.law.lsu.edu/cases/products/402a-b.htm",
      },
    ],
  },

  {
    id: "comparative-negligence-california-1975",
    claim:
      "A plaintiff whose own negligence contributed to the injury is completely barred from recovering damages (the contributory-negligence bar), a common-law rule originating in Butterfield v. Forrester (King's Bench, 1809) and abolished for California in Li v. Yellow Cab Co. (31 March 1975).",
    emergedAt: "1809-01-01",
    milestones: [
      {
        date: "1809-01-01",
        precision: "YEAR",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Butterfield v. Forrester (11 East 60, 103 Eng. Rep. 926, K.B. 1809): Lord Ellenborough held that a rider who galloped into an obstruction he could have avoided could not recover, establishing contributory negligence as an absolute defense. The rule that any negligence by the plaintiff completely bars recovery — however slight the plaintiff's fault — became settled common law and was received throughout American jurisdictions, including California.",
        sourceName:
          "Lord Ellenborough CJ. Butterfield v. Forrester, 11 East 60, 103 Eng. Rep. 926 (K.B. 1809).",
        sourceUrl:
          "https://en.wikipedia.org/wiki/Butterfield_v_Forrester",
      },
      {
        date: "1975-03-31",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "Li v. Yellow Cab Co. (13 Cal.3d 804, 31 March 1975): The California Supreme Court abandoned the all-or-nothing contributory-negligence bar and replaced it with a system of pure comparative negligence, apportioning damages in proportion to each party's fault. The court held the harsh common-law rule — under which a plaintiff even 1% at fault recovered nothing — was no longer defensible, reversing 166 years of settled doctrine in the state.",
        sourceName:
          "Sullivan J. Li v. Yellow Cab Co. of California, 13 Cal.3d 804, 532 P.2d 1226 (1975). Opinion of the Court.",
        sourceUrl:
          "https://scocal.stanford.edu/opinion/li-v-yellow-cab-co-27850",
      },
    ],
  },

  {
    id: "market-share-liability-1980",
    claim:
      "When a plaintiff cannot identify which manufacturer of a fungible, identically-formulated product (DES) caused her injury, liability may be apportioned among the defendant makers according to their share of the relevant market — the market-share liability doctrine adopted by the California Supreme Court in Sindell v. Abbott Laboratories (20 March 1980).",
    emergedAt: "1948-01-01",
    milestones: [
      {
        date: "1948-01-01",
        precision: "YEAR",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "Summers v. Tice (33 Cal.2d 80, 199 P.2d 1, 1948): Where two hunters negligently fired toward the plaintiff but only one pellet caused the eye injury, the California Supreme Court shifted the burden of proving causation onto the two negligent defendants under the theory of alternative liability. The decision recorded the principle that a plaintiff's inability to identify which of several wrongdoers caused the harm need not defeat recovery — the conceptual seed later extended to many manufacturers.",
        sourceName:
          "Carter J. Summers v. Tice, 33 Cal.2d 80, 199 P.2d 1 (1948). Opinion of the Court.",
        sourceUrl:
          "https://law.justia.com/cases/california/supreme-court/2d/33/80.html",
      },
      {
        date: "1980-03-20",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Sindell v. Abbott Laboratories (26 Cal.3d 588, 20 March 1980): In a 4–3 opinion by Justice Mosk, the court held that a DES-injured plaintiff who could not identify the specific manufacturer of the drug her mother took — because DES was a fungible generic made by many firms years earlier — could sue makers representing a substantial share of the market, each liable for the percentage of damages matching its market share. This adapted Summers-style burden-shifting into a new market-share liability doctrine for fungible-product injuries, settling it as California law.",
        sourceName:
          "Mosk J. Sindell v. Abbott Laboratories, 26 Cal.3d 588, 607 P.2d 924 (1980). Opinion of the Court.",
        sourceUrl:
          "https://law.justia.com/cases/california/supreme-court/3d/26/588.html",
      },
    ],
  },

  {
    id: "unconscionability-contract-doctrine-1965",
    claim:
      "A court may decline to enforce a contract or any clause it finds unconscionable — the modern unconscionability defense, codified in UCC § 2-302 and given its operative common-law form in Williams v. Walker-Thomas Furniture Co. (D.C. Cir., 11 August 1965).",
    emergedAt: "1952-01-01",
    milestones: [
      {
        date: "1952-01-01",
        precision: "YEAR",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "INSTITUTIONAL",
        reason:
          "Uniform Commercial Code § 2-302 (promulgated by the American Law Institute and the National Conference of Commissioners on Uniform State Laws, 1952): The provision authorized a court that finds a contract or clause 'to have been unconscionable at the time it was made' to refuse enforcement or limit its application. The concept was recorded as black-letter model law, but § 2-302 deliberately supplied no definition of 'unconscionable,' leaving the operative standard unsettled pending judicial elaboration.",
        sourceName:
          "American Law Institute & NCCUSL. Uniform Commercial Code § 2-302: Unconscionable Contract or Clause (1952).",
        sourceUrl:
          "https://www.law.cornell.edu/ucc/2/2-302",
      },
      {
        date: "1965-08-11",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Williams v. Walker-Thomas Furniture Co. (350 F.2d 445, D.C. Cir., 11 August 1965): Judge J. Skelly Wright, reviewing a furniture installment contract whose cross-collateral clause let the seller repossess everything a buyer had ever purchased upon any default, embraced UCC § 2-302's principle as an expression of common law even where not yet enacted. He supplied its enduring test — unconscionability as 'an absence of meaningful choice on the part of one of the parties together with contract terms which are unreasonably favorable to the other party' — giving the doctrine its settled modern form and remanding for its application.",
        sourceName:
          "Wright J. Williams v. Walker-Thomas Furniture Co., 350 F.2d 445 (D.C. Cir. 1965). Opinion of the Court.",
        sourceUrl:
          "https://law.resource.org/pub/us/case/reporter/F2/350/350.F2d.445.18604.18605_1.html",
      },
    ],
  },

  {
    id: "chevron-deference-rise-fall-1984",
    claim:
      "U.S. courts must defer to a federal agency's reasonable interpretation of a statute it administers whenever the statutory text is silent or ambiguous on the precise question — the deference framework established by the U.S. Supreme Court in Chevron U.S.A., Inc. v. NRDC, decided 25 June 1984, and overruled in Loper Bright Enterprises v. Raimondo, decided 28 June 2024.",
    emergedAt: "1984-06-25",
    milestones: [
      {
        date: "1984-06-25",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Chevron U.S.A., Inc. v. Natural Resources Defense Council (467 U.S. 837, 25 June 1984): A unanimous Court (6–0, three justices not participating) upheld the EPA's 'bubble' definition of stationary source and announced a two-step test — if Congress has not directly addressed the precise question and the statute is silent or ambiguous, courts must accept 'a permissible construction of the statute' offered by the administering agency. The decision became the single most-cited case in American administrative law and the default rule of judicial review of agency action for four decades.",
        sourceName:
          "Stevens J. Chevron U.S.A., Inc. v. Natural Resources Defense Council, Inc., 467 U.S. 837 (1984). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/467/837",
      },
      {
        date: "2015-06-25",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "King v. Burwell (576 U.S. 473, 25 June 2015): A 6–3 majority, per Chief Justice Roberts, upheld ACA tax credits on federal exchanges but pointedly declined to apply Chevron, reasoning that whether the credits were available was 'a question of deep economic and political significance' that Congress would not have implicitly delegated to the IRS. By carving major questions out of Chevron's domain and interpreting the statute de novo, the Court signalled from within that Chevron's scope was no longer settled, foreshadowing the doctrine's contraction.",
        sourceName:
          "Roberts CJ. King v. Burwell, 576 U.S. 473 (2015). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/14-114",
      },
      {
        date: "2024-06-28",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "Loper Bright Enterprises v. Raimondo (603 U.S. 369, 28 June 2024): A 6–3 majority, per Chief Justice Roberts, held that 'Chevron is overruled,' concluding that the Administrative Procedure Act's command that reviewing courts 'decide all relevant questions of law' forbids deferring to an agency merely because a statute is ambiguous. Courts must now exercise independent judgment on questions of statutory meaning, ending forty years of Chevron deference as the governing standard of review.",
        sourceName:
          "Roberts CJ. Loper Bright Enterprises v. Raimondo, 603 U.S. 369 (2024). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/22-451",
      },
    ],
  },

  {
    id: "major-questions-doctrine-2022",
    claim:
      "When an agency claims the power to decide a question of vast economic and political significance, it must point to clear congressional authorization rather than relying on ambiguous or ancillary statutory language — the 'major questions doctrine' first articulated by the U.S. Supreme Court in FDA v. Brown & Williamson (21 March 2000) and formally named and adopted in West Virginia v. EPA (30 June 2022).",
    emergedAt: "2000-03-21",
    milestones: [
      {
        date: "2000-03-21",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "FDA v. Brown & Williamson Tobacco Corp. (529 U.S. 120, 21 March 2000): A 5–4 majority, per Justice O'Connor, held that the FDA lacked authority to regulate tobacco, reasoning that courts should hesitate to read a long-extant statute as an implicit delegation of authority over an issue of enormous 'economic and political significance' — 'Congress could not have intended to delegate a decision of such economic and political significance to an agency in so cryptic a fashion.' The reasoning recorded the interpretive principle later systematized as the major questions doctrine, though the Court did not yet name it as a distinct canon.",
        sourceName:
          "O'Connor J. FDA v. Brown & Williamson Tobacco Corp., 529 U.S. 120 (2000). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/529/120",
      },
      {
        date: "2022-06-30",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "West Virginia v. EPA (597 U.S. 697, 30 June 2022): A 6–3 majority, per Chief Justice Roberts, expressly labelled the case 'a major questions case' and held that the EPA's Clean Air Act § 111(d) authority did not extend to compelling generation-shifting across the power sector. The Court adopted the major questions doctrine by name as a settled rule of statutory construction: in 'extraordinary cases' of vast economic and political significance, an agency must point to 'clear congressional authorization.' The ruling converted a recurring interpretive theme into an operative, named doctrine binding on lower courts.",
        sourceName:
          "Roberts CJ. West Virginia v. EPA, 597 U.S. 697 (2022). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/20-1530",
      },
    ],
  },

  {
    id: "auer-seminole-rock-deference-1945",
    claim:
      "A federal court must give controlling weight to an agency's interpretation of its own ambiguous regulation unless that interpretation is plainly erroneous or inconsistent with the regulation — the deference rule established by the U.S. Supreme Court in Bowles v. Seminole Rock (4 June 1945), reaffirmed in Auer v. Robbins (19 February 1997), and sharply narrowed in Kisor v. Wilkie (26 June 2019).",
    emergedAt: "1945-06-04",
    milestones: [
      {
        date: "1945-06-04",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Bowles v. Seminole Rock & Sand Co. (325 U.S. 410, 4 June 1945): The Court held that in construing an administrative regulation, 'the ultimate criterion is the administrative interpretation, which becomes of controlling weight unless it is plainly erroneous or inconsistent with the regulation.' The ruling established what became known as Seminole Rock deference — courts defer to an agency's reading of its own rules — settling the standard for judicial review of an agency's interpretation of its regulations.",
        sourceName:
          "Murphy J. Bowles v. Seminole Rock & Sand Co., 325 U.S. 410 (1945). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/325/410",
      },
      {
        date: "1997-02-19",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Auer v. Robbins (519 U.S. 452, 19 February 1997): A unanimous Court, per Justice Scalia, applied Seminole Rock to uphold the Secretary of Labor's interpretation of his own FLSA 'salary basis' regulation, holding the reading controlling because it was not 'plainly erroneous or inconsistent with the regulation' — even when advanced for the first time in an amicus brief. The decision reaffirmed and re-anchored the doctrine, which thereafter carried Scalia's name as 'Auer deference' and remained the settled rule for interpreting agency regulations.",
        sourceName:
          "Scalia J. Auer v. Robbins, 519 U.S. 452 (1997). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/519/452",
      },
      {
        date: "2019-06-26",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Kisor v. Wilkie (588 U.S. 558, 26 June 2019): A fractured Court declined to overrule Auer and Seminole Rock but sharply cabined the doctrine, per Justice Kagan, holding that deference applies only after a court exhausts all interpretive tools and finds the regulation 'genuinely ambiguous,' and only where the agency's reading is authoritative, reflects its substantive expertise, and represents its 'fair and considered judgment.' Four justices (Gorsuch, concurring in the judgment) would have overruled the doctrine outright, describing what survived as a 'zombie.' The ruling left Auer deference formally alive but doctrinally contested and greatly restricted.",
        sourceName:
          "Kagan J. Kisor v. Wilkie, 588 U.S. 558 (2019). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/18-15",
      },
    ],
  },

  {
    id: "patent-monopoly-limited-term-1624",
    claim:
      "English law established that Crown-granted monopolies are void at common law, but time-limited patents for genuinely new inventions are lawful — the Case of Monopolies (Darcy v. Allein, King's Bench, 1602) and the Statute of Monopolies (Parliament, 29 May 1624), which voided monopolies generally but preserved 14-year patents for the true and first inventor of any new manufacture.",
    emergedAt: "1602-01-01",
    milestones: [
      {
        date: "1602-01-01",
        precision: "YEAR",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "Darcy v. Allein, the Case of Monopolies (11 Co. Rep. 84b, 77 Eng. Rep. 1260, K.B. Trinity Term 1602): the Court of Queen's/King's Bench held that the Crown's grant to Edward Darcy of an exclusive monopoly over the making and importing of playing cards was void at common law, because monopolies deprive tradesmen of their livelihood, raise prices, and injure the commonwealth. The ruling recorded the principle that royal monopoly grants over ordinary trades are unlawful, laying the groundwork for distinguishing them from legitimate invention patents.",
        sourceName:
          "Court of King's Bench. Darcy v. Allein (Case of Monopolies), 11 Co. Rep. 84b, 77 Eng. Rep. 1260 (K.B. 1602).",
        sourceUrl: "https://en.wikipedia.org/wiki/Darcy_v_Allein",
      },
      {
        date: "1624-05-29",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "INSTITUTIONAL",
        reason:
          "The Statute of Monopolies (21 Jas. 1 c. 3), which received royal assent on 29 May 1624, declared all monopolies, grants, and letters patent 'utterly void and of none effect,' but section 6 carved out an exception preserving letters patent 'for the term of fourteen years or under' for 'the sole working or making of any manner of new manufactures' to 'the true and first inventor.' Parliament thereby settled the enduring distinction between unlawful monopolies and lawful, time-limited patent property — the statutory foundation of modern patent law.",
        sourceName:
          "Parliament of England. Statute of Monopolies 1623, 21 Jas. 1 c. 3 (royal assent 29 May 1624).",
        sourceUrl: "https://www.legislation.gov.uk/aep/Ja1/21/3/contents",
      },
    ],
  },

  {
    id: "perpetual-common-law-copyright-1774",
    claim:
      "The claim that authors hold a perpetual common-law copyright in their published works, surviving beyond the limited statutory term — an open question after the Statute of Anne (in force 10 April 1710), held true by the King's Bench in Millar v. Taylor (1769), and definitively rejected by the House of Lords in Donaldson v. Beckett (22 February 1774).",
    emergedAt: "1710-04-10",
    milestones: [
      {
        date: "1710-04-10",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "INSTITUTIONAL",
        reason:
          "The Statute of Anne (8 Ann. c. 21), 'An Act for the Encouragement of Learning,' came into force on 10 April 1710, vesting in authors and their assigns a copyright of 14 years (renewable for a further 14) in newly published books, with 21 years for works already in print. By granting only a limited term, the statute recorded but left unresolved the central question the booksellers would press for six decades: whether authors also retained a separate, perpetual copyright at common law that survived the statutory term.",
        sourceName:
          "Parliament of Great Britain. Statute of Anne, 8 Ann. c. 21 (in force 10 April 1710).",
        sourceUrl: "https://en.wikipedia.org/wiki/Statute_of_Anne",
      },
      {
        date: "1769-04-20",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Millar v. Taylor (4 Burr. 2303, 98 Eng. Rep. 201, K.B. 20 April 1769): a divided Court of King's Bench, per Lord Mansfield, held 3–1 that authors possessed a perpetual common-law copyright in their works that existed independently of, and survived, the limited term of the Statute of Anne — meaning published works would never fall into the public domain. The ruling settled (within the King's Bench) the booksellers' theory of perpetual literary property.",
        sourceName:
          "Court of King's Bench. Millar v. Taylor, 4 Burr. 2303, 98 Eng. Rep. 201 (K.B. 1769).",
        sourceUrl: "https://en.wikipedia.org/wiki/Millar_v_Taylor",
      },
      {
        date: "1774-02-22",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "Donaldson v. Beckett (2 Bro. P.C. 129, 1 Eng. Rep. 837; 4 Burr. 2408, 98 Eng. Rep. 257, H.L. 22 February 1774): the House of Lords reversed the effect of Millar v. Taylor, holding that whatever common-law copyright an author held before publication was superseded on publication by the Statute of Anne, so that copyright in published works is not perpetual but limited to the statutory term. The decision extinguished the doctrine of perpetual common-law copyright and established the public domain as a permanent feature of copyright law.",
        sourceName:
          "House of Lords. Donaldson v. Beckett, 2 Bro. P.C. 129, 1 Eng. Rep. 837 (H.L. 1774).",
        sourceUrl: "https://en.wikipedia.org/wiki/Donaldson_v_Becket",
      },
    ],
  },

  {
    id: "just-compensation-takings-1791",
    claim:
      "The principle that government may take private property only for public use and only upon payment of just compensation, and that a legislature may not simply divest one person of property and vest it in another — constitutionalized by the Takings Clause of the Fifth Amendment (ratified 15 December 1791) and given its foundational federal judicial articulation in Vanhorne's Lessee v. Dorrance (U.S. Circuit Court, D. Pa., 1795).",
    emergedAt: "1791-12-15",
    milestones: [
      {
        date: "1791-12-15",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "INSTITUTIONAL",
        reason:
          "The Fifth Amendment to the U.S. Constitution was ratified on 15 December 1791 as part of the Bill of Rights, its final clause providing 'nor shall private property be taken for public use, without just compensation.' The Takings Clause recorded as fundamental federal law the requirement that the sovereign compensate owners for property appropriated for public purposes, converting a natural-rights principle into an enforceable constitutional command.",
        sourceName:
          "U.S. Constitution, Amendment V (Takings Clause), ratified 15 December 1791.",
        sourceUrl: "https://www.law.cornell.edu/constitution/fifth_amendment",
      },
      {
        date: "1795-04-01",
        precision: "MONTH",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Vanhorne's Lessee v. Dorrance (2 U.S. (2 Dall.) 304, U.S. Circuit Court for the District of Pennsylvania, April Term 1795): Justice William Paterson, riding circuit, charged the jury that a Pennsylvania statute divesting owners of land and vesting it in others without adequate compensation was void as contrary to the 'inherent and unalienable rights of man' and the state constitution's protection of property, holding that the legislature cannot take one person's property and give it to another and that any taking requires just compensation. The opinion settled, in an authoritative federal judicial voice, the just-compensation principle as a limit on legislative power.",
        sourceName:
          "Paterson J. Vanhorne's Lessee v. Dorrance, 2 U.S. (2 Dall.) 304 (C.C.D. Pa. 1795). Charge to the jury.",
        sourceUrl:
          "https://www.fjc.gov/history/exhibits/circuit-court-opinions/Vanhorne-v-Dorrance",
      },
    ],
  },

  {
    id: "private-property-inviolable-entick-1765",
    claim:
      "The principle that private property is inviolable against the state and that government officers may enter or search private property only under specific positive legal authority — every unauthorized invasion of property being a trespass — established in Entick v. Carrington (Court of King's Bench, 2 November 1765) and enshrined in American constitutional law in Boyd v. United States (1886).",
    emergedAt: "1765-11-02",
    milestones: [
      {
        date: "1765-11-02",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Entick v. Carrington (19 Howell's State Trials 1029; 95 Eng. Rep. 807, K.B. 2 November 1765): Lord Camden (Chief Justice Pratt), for the Court of King's Bench, held that a Secretary of State's general warrant authorizing the King's messengers to break into John Entick's house and seize his papers was unlawful, because the officers could point to no statute or common-law authority for the intrusion. Camden declared that 'every invasion of private property, be it ever so minute, is a trespass,' settling the principle that the state may act against private property only where positive law expressly permits it.",
        sourceName:
          "Camden LCJ. Entick v. Carrington, 19 Howell's State Trials 1029, 95 Eng. Rep. 807 (K.B. 1765).",
        sourceUrl: "https://en.wikipedia.org/wiki/Entick_v_Carrington",
      },
      {
        date: "1886-02-01",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Boyd v. United States (116 U.S. 616, 1 February 1886): Justice Bradley, for the Court, drew directly on Entick v. Carrington — calling Lord Camden's judgment 'one of the landmarks of English liberty' and 'a permanent monument of the British constitution' — to hold that compelled production of a person's private papers violates the Fourth and Fifth Amendments. The opinion transplanted Entick's property-inviolability principle into American constitutional law, reaffirming across more than a century that private property and papers are protected against government seizure absent specific legal authority.",
        sourceName:
          "Bradley J. Boyd v. United States, 116 U.S. 616 (1886). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/116/616",
      },
    ],
  },

  {
    id: "nondelegation-intelligible-principle-1928",
    claim:
      "Congress may delegate broad rulemaking and policymaking authority to executive agencies without violating the separation of powers so long as it supplies an 'intelligible principle' to guide the exercise of that authority — the permissive non-delegation standard set by the U.S. Supreme Court in J.W. Hampton, Jr. & Co. v. United States (9 April 1928) and thrown back into contest by Gundy v. United States (20 June 2019).",
    emergedAt: "1928-04-09",
    milestones: [
      {
        date: "1928-04-09",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "J.W. Hampton, Jr. & Co. v. United States (276 U.S. 394, 9 April 1928): Chief Justice Taft, for a unanimous Court, upheld a delegation letting the President adjust tariff rates and announced the governing test — 'If Congress shall lay down by legislative act an intelligible principle to which the person or body authorized to fix such rates is directed to conform, such legislative action is not a forbidden delegation of legislative power.' The 'intelligible principle' formula settled the permissive standard under which delegations to the executive would be sustained.",
        sourceName:
          "Taft CJ. J.W. Hampton, Jr. & Co. v. United States, 276 U.S. 394 (1928). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/276/394",
      },
      {
        date: "1935-05-27",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "A.L.A. Schechter Poultry Corp. v. United States (295 U.S. 495, 27 May 1935): A unanimous Court struck down the National Industrial Recovery Act's code-making provisions as 'an unconstitutional delegation of legislative power,' finding the statute's 'fair competition' codes conferred a standardless 'roving commission' on the President. Together with Panama Refining Co. v. Ryan earlier that year, Schechter briefly gave the non-delegation doctrine real teeth, contesting the permissive intelligible-principle regime and showing that some delegations could fail constitutional muster.",
        sourceName:
          "Hughes CJ. A.L.A. Schechter Poultry Corp. v. United States, 295 U.S. 495 (1935). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/295/495",
      },
      {
        date: "1989-01-18",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Mistretta v. United States (488 U.S. 361, 18 January 1989): A 7–1 Court, per Justice Blackmun, rejected a non-delegation challenge to the U.S. Sentencing Commission, holding that Congress had supplied 'more than merely an intelligible principle.' Coming after five decades in which the Court never again invalidated a delegation, Mistretta re-settled the highly permissive intelligible-principle standard as governing law; only Justice Scalia dissented, presaging later revival efforts.",
        sourceName:
          "Blackmun J. Mistretta v. United States, 488 U.S. 361 (1989). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/488/361",
      },
      {
        date: "2019-06-20",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Gundy v. United States (588 U.S. 128, 20 June 2019): A four-justice plurality, per Justice Kagan, upheld SORNA's delegation to the Attorney General under the intelligible-principle test, but the doctrine's stability collapsed at the margins: Justice Gorsuch, joined by Roberts and Thomas, dissented calling for a more demanding non-delegation standard, and Justice Alito concurred only in the judgment while stating he would support reconsidering the Court's 84-year approach 'if a majority were willing.' With four justices signalling openness to revival, the permissive standard returned to open contestation for the first time since the New Deal.",
        sourceName:
          "Kagan J. (plurality). Gundy v. United States, 588 U.S. 128 (2019). Plurality opinion; Gorsuch J., dissenting.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/17-6086",
      },
    ],
  },

  {
    id: "labor-conspiracy-doctrine-1842",
    claim:
      "American courts held that combinations of workers to raise wages were indictable criminal conspiracies at common law — a doctrine established in Commonwealth v. Pullis (Philadelphia Mayor's Court, 1806) and rejected by the Massachusetts Supreme Judicial Court in Commonwealth v. Hunt, decided March 1842.",
    emergedAt: "1806-01-01",
    emergedPrecision: "YEAR",
    milestones: [
      {
        date: "1806-01-01",
        precision: "YEAR",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Commonwealth v. Pullis (Philadelphia Mayor's Court, 1806), the Philadelphia Cordwainers case, convicted eight journeyman shoemakers of criminal conspiracy for combining to raise their wages, holding that a combination to raise wages was an indictable conspiracy at common law. It was the first reported U.S. labor-combination prosecution and settled, for the early republic, that concerted worker action to set wages was per se criminal.",
        sourceName:
          "Philadelphia Mayor's Court. Commonwealth v. Pullis (Philadelphia Cordwainers), 1806.",
        sourceUrl: "https://en.wikipedia.org/wiki/Commonwealth_v._Pullis",
        methodologyType: "derivative",
      },
      {
        date: "1842-03-01",
        precision: "MONTH",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "Commonwealth v. Hunt, 45 Mass. (4 Met.) 111 (March 1842): Chief Justice Lemuel Shaw, for the Massachusetts Supreme Judicial Court, held that a labor combination organized for lawful purposes by lawful means is not a criminal conspiracy, rejecting the blanket English/Pullis rule that worker combinations to set wages were per se indictable. The ruling reversed the criminal-conspiracy doctrine and became the leading American authority legitimizing peaceful unions.",
        sourceName:
          "Shaw CJ. Commonwealth v. Hunt, 45 Mass. (4 Met.) 111 (Mass. 1842). Opinion of the Court.",
        sourceUrl: "https://en.wikipedia.org/wiki/Commonwealth_v._Hunt",
        methodologyType: "derivative",
      },
    ],
  },

  {
    id: "liberty-of-contract-lochner-1905",
    claim:
      "The Fourteenth Amendment's Due Process Clause was held to protect a 'liberty of contract' barring states from enacting maximum-hours and minimum-wage labor laws — the Lochner-era doctrine established by the U.S. Supreme Court in Lochner v. New York (17 April 1905) and abandoned in West Coast Hotel Co. v. Parrish (29 March 1937).",
    emergedAt: "1905-04-17",
    milestones: [
      {
        date: "1905-04-17",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Lochner v. New York (198 U.S. 45, 17 April 1905): a 5–4 majority, per Justice Peckham, struck down New York's law capping bakers' hours at 60 per week as an 'unreasonable, unnecessary and arbitrary interference' with the Fourteenth Amendment liberty of contract between employer and employee. The decision settled substantive-due-process 'liberty of contract' as a constitutional limit on protective labor legislation, giving its name to the Lochner era.",
        sourceName:
          "Peckham J. Lochner v. New York, 198 U.S. 45 (1905). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/198/45",
      },
      {
        date: "1908-02-24",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Muller v. Oregon (208 U.S. 412, 24 February 1908): a unanimous Court upheld Oregon's ten-hour maximum-hours law for women, distinguishing Lochner on the basis of women's 'physical structure' and relying on Louis Brandeis's sociological 'Brandeis brief.' By sustaining a hours law only three years after Lochner, the ruling opened the doctrine to contestation and signaled that liberty of contract would yield to sufficiently justified protective legislation.",
        sourceName:
          "Brewer J. Muller v. Oregon, 208 U.S. 412 (1908). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/208/412",
      },
      {
        date: "1923-04-09",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Adkins v. Children's Hospital (261 U.S. 525, 9 April 1923): a 5–3 majority (Brandeis recused), per Justice Sutherland, struck down a District of Columbia minimum-wage law for women as a 'price-fixing' violation of liberty of contract, holding that freedom of contract is 'the general rule and restraint the exception.' The decision re-entrenched Lochner-era doctrine and extended it from hours to wages, reaffirming the constitutional bar on minimum-wage legislation.",
        sourceName:
          "Sutherland J. Adkins v. Children's Hospital, 261 U.S. 525 (1923). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/261/525",
      },
      {
        date: "1937-03-29",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "West Coast Hotel Co. v. Parrish (300 U.S. 379, 29 March 1937): a 5–4 majority, per Chief Justice Hughes, upheld Washington's minimum-wage law for women and expressly overruled Adkins, holding that liberty is 'subject to the restraints of due process' and reasonable regulation in the community's interest. The 'switch in time' abandoned the Lochner liberty-of-contract doctrine and ended judicial invalidation of economic and labor legislation on substantive-due-process grounds.",
        sourceName:
          "Hughes CJ. West Coast Hotel Co. v. Parrish, 300 U.S. 379 (1937). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/300/379",
      },
    ],
  },

  {
    id: "yellow-dog-contracts-1908",
    claim:
      "'Yellow-dog contracts' — agreements conditioning employment on a promise not to join a labor union — were held constitutionally protected by liberty of contract, invalidating statutes that banned them, in Adair v. United States (1908) and Coppage v. Kansas (1915); Congress reversed the doctrine by declaring such contracts unenforceable and contrary to public policy in the Norris-LaGuardia Act (1932).",
    emergedAt: "1908-01-27",
    milestones: [
      {
        date: "1908-01-27",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Adair v. United States (208 U.S. 161, 27 January 1908): the Court, per Justice Harlan, struck down Section 10 of the Erdman Act, which barred interstate railroads from firing employees for union membership, holding that it violated Fifth Amendment liberty of contract and exceeded the commerce power. The ruling settled that legislatures could not prohibit yellow-dog contracts or anti-union discharges.",
        sourceName:
          "Harlan J. Adair v. United States, 208 U.S. 161 (1908). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/208/161",
      },
      {
        date: "1915-01-25",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Coppage v. Kansas (236 U.S. 1, 25 January 1915): a 6–3 majority, per Justice Pitney, extended Adair to the states, striking down a Kansas statute criminalizing yellow-dog contracts as an unconstitutional interference with Fourteenth Amendment liberty of contract. The decision hardened and nationalized the doctrine, invalidating comparable worker-protective laws in numerous states.",
        sourceName:
          "Pitney J. Coppage v. Kansas, 236 U.S. 1 (1915). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/236/1",
      },
      {
        date: "1932-03-23",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "INSTITUTIONAL",
        reason:
          "Norris-LaGuardia Act (47 Stat. 70, enacted 23 March 1932; 29 U.S.C. § 103): Congress declared that yellow-dog contracts — promises not to join or to withdraw upon joining a labor organization — are 'contrary to the public policy of the United States,' unenforceable in any federal court, and no basis for legal or equitable relief. The statute reversed the Adair–Coppage doctrine, and the following years' Wagner Act and West Coast Hotel confirmed that yellow-dog prohibitions were now valid.",
        sourceName:
          "U.S. Congress. Norris-LaGuardia Act, 47 Stat. 70 (1932), codified at 29 U.S.C. § 103.",
        sourceUrl: "https://www.law.cornell.edu/uscode/text/29/103",
      },
    ],
  },

  {
    id: "nlra-collective-bargaining-1935",
    claim:
      "The National Labor Relations Act (Wagner Act, signed 5 July 1935) guarantees private-sector workers a federally protected right to organize and bargain collectively and is a valid exercise of the Commerce Clause — its constitutionality doubted at enactment and upheld by the U.S. Supreme Court in NLRB v. Jones & Laughlin Steel Corp. (12 April 1937).",
    emergedAt: "1935-07-05",
    milestones: [
      {
        date: "1935-07-05",
        precision: "DAY",
        fromAxis: null,
        toAxis: "CONTESTED",
        community: "INSTITUTIONAL",
        reason:
          "The National Labor Relations Act (Wagner Act, 49 Stat. 449), signed by President Roosevelt on 5 July 1935, guaranteed employees the right to self-organization, to form unions, and to bargain collectively, and created the National Labor Relations Board to enforce those rights. Its constitutionality was immediately and widely doubted: under then-prevailing narrow Commerce Clause precedent (e.g., Carter v. Carter Coal, 1936) many lower courts and employers presumed federal regulation of manufacturing labor relations exceeded congressional power, leaving the Act's core premise contested.",
        sourceName:
          "U.S. Congress. National Labor Relations Act (Wagner Act), 49 Stat. 449 (5 July 1935).",
        sourceUrl:
          "https://www.nlrb.gov/guidance/key-reference-materials/national-labor-relations-act",
      },
      {
        date: "1937-04-12",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "NLRB v. Jones & Laughlin Steel Corp. (301 U.S. 1, 12 April 1937): a 5–4 majority, per Chief Justice Hughes, upheld the Wagner Act, holding that labor relations in manufacturing bearing a 'close and substantial relation to interstate commerce' are within the commerce power and that employees have a 'fundamental right' to organize and choose representatives. The ruling settled the Act's constitutionality, ratified the federal right to collective bargaining, and marked the Court's decisive expansion of the Commerce Clause.",
        sourceName:
          "Hughes CJ. NLRB v. Jones & Laughlin Steel Corp., 301 U.S. 1 (1937). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/301/1",
      },
    ],
  },

  {
    id: "customary-international-law-part-of-us-law-1900",
    claim:
      "The U.S. Supreme Court held in The Paquete Habana, decided 8 January 1900, that customary international law is part of United States law and must be ascertained and applied by federal courts as questions of right depending on it arise.",
    emergedAt: "1900-01-08",
    milestones: [
      {
        date: "1900-01-08",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "The Paquete Habana (175 U.S. 677, 8 Jan 1900): Justice Gray, for the Court, condemned the wartime seizure of two coastal fishing vessels as a prize, holding that a settled rule of customary international law exempts unarmed coastal fishing boats from capture. The opinion declared that 'international law is part of our law, and must be ascertained and administered by the courts of justice of appropriate jurisdiction,' settling that federal courts directly apply customary international law where no controlling treaty, statute, or executive act displaces it.",
        sourceName:
          "Gray J. The Paquete Habana, 175 U.S. 677 (1900). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/175/677",
      },
      {
        date: "1997-01-01",
        precision: "YEAR",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "EXPERT_LITERATURE",
        reason:
          "Curtis A. Bradley & Jack L. Goldsmith, 'Customary International Law as Federal Common Law: A Critique of the Modern Position,' 110 Harv. L. Rev. 815 (1997): the authors argued that the post-Erie assumption — that customary international law automatically has the status of self-executing federal common law binding on courts — lacks constitutional and historical foundation and improperly bypasses the political branches. The heavily-cited article reopened as contested a proposition widely treated as settled since The Paquete Habana, triggering a sustained 'revisionist' debate in the foreign-relations-law literature.",
        sourceName:
          "Bradley, Curtis A. & Goldsmith, Jack L. Customary International Law as Federal Common Law: A Critique of the Modern Position. 110 Harvard Law Review 815 (1997).",
        sourceUrl: "https://scholarship.law.duke.edu/faculty_scholarship/1186/",
      },
      {
        date: "2004-06-29",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Sosa v. Alvarez-Machain (542 U.S. 692, 29 June 2004): the Court held that the Alien Tort Statute is jurisdictional but that federal courts may recognize a narrow category of claims under customary international law — norms with 'definite content and acceptance among civilized nations' comparable to the 18th-century paradigms of piracy, safe-conducts, and offenses against ambassadors. By affirming, with caution, that customary international law remains part of the federal common law that courts enforce, Sosa re-settled the core Paquete Habana principle while cabining its reach.",
        sourceName:
          "Souter J. Sosa v. Alvarez-Machain, 542 U.S. 692 (2004). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/03-339",
      },
    ],
  },

  {
    id: "treaty-power-missouri-holland-1920",
    claim:
      "The U.S. Supreme Court held in Missouri v. Holland, decided 19 April 1920, that a valid treaty and its implementing statute may regulate subjects (migratory birds) otherwise reserved to the states under the Tenth Amendment, so the treaty power can support federal legislation beyond Congress's independently enumerated powers.",
    emergedAt: "1920-04-19",
    milestones: [
      {
        date: "1920-04-19",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Missouri v. Holland (252 U.S. 416, 19 April 1920): Justice Holmes, for a 7–2 Court, upheld the Migratory Bird Treaty Act as necessary and proper to implement a 1916 treaty with Great Britain, rejecting Missouri's Tenth Amendment challenge. Holmes reasoned that 'there may be matters of the sharpest exigency for the national well being that an act of Congress could not deal with but that a treaty followed by such an act could,' settling that the treaty power can authorize federal legislation on matters otherwise reserved to the states.",
        sourceName:
          "Holmes J. Missouri v. Holland, 252 U.S. 416 (1920). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/252/416",
      },
      {
        date: "1957-06-10",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Reid v. Covert (354 U.S. 1, 10 June 1957): a plurality led by Justice Black held that no international agreement can confer power on the government that is 'free from the restraints of the Constitution,' invalidating military trials of civilian dependents abroad despite executive agreements. The decision refined rather than overturned Holland — the treaty power remains capable of expanding federal legislative reach, but is now firmly bounded by the Bill of Rights and other constitutional limits — leaving Holland's core holding settled while clarifying its outer limit.",
        sourceName:
          "Black J. (plurality). Reid v. Covert, 354 U.S. 1 (1957).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/354/1",
      },
      {
        date: "2014-06-02",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Bond v. United States (572 U.S. 844, 2 June 2014): the Court avoided the constitutional question by construing the Chemical Weapons Convention Implementation Act narrowly so as not to reach a purely local assault, but Justices Scalia, Thomas, and Alito, concurring in the judgment, attacked Holland directly — Scalia calling its treaty-power reasoning an 'unreasoned' ipse dixit and urging that Congress cannot expand its enumerated powers through the treaty power. With three Justices openly inviting reconsideration, Holland's scope returned to active contestation.",
        sourceName:
          "Roberts CJ. Bond v. United States, 572 U.S. 844 (2014). Opinion of the Court; Scalia J., concurring in the judgment.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/12-158",
      },
    ],
  },

  {
    id: "treaty-statute-last-in-time-head-money-1884",
    claim:
      "The U.S. Supreme Court held in the Head Money Cases (Edye v. Robertson), decided 8 December 1884, that a treaty stands on equal constitutional footing with an act of Congress, so that when the two conflict the later-in-date enactment controls, and that a treaty confers judicially enforceable private rights only insofar as it is self-executing.",
    emergedAt: "1884-12-08",
    milestones: [
      {
        date: "1884-12-08",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Head Money Cases / Edye v. Robertson (112 U.S. 580, 8 Dec 1884): Justice Miller, for the Court, upheld a federal head-tax on arriving immigrants against the claim that it violated existing commercial treaties, holding that the Constitution gives a treaty 'no superiority over an act of congress,' that the later of the two controls, and that a treaty is enforceable in court like a statute only when its terms are self-executing. The ruling settled the co-equal status of treaties and statutes and the 'last-in-time' rule.",
        sourceName:
          "Miller J. Head Money Cases (Edye v. Robertson), 112 U.S. 580 (1884). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/112/580",
      },
      {
        date: "1888-01-09",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Whitney v. Robertson (124 U.S. 190, 9 Jan 1888): Justice Field, for a unanimous Court, applied and crystallized the doctrine, holding that where a treaty and a statute 'are inconsistent, the one last in date will control the other, provided always the stipulation of the treaty on the subject is self-executing.' By restating the rule as a fixed formula and coupling it to the self-execution requirement, Whitney entrenched the Head Money principle as the stable governing rule for treaty-statute conflicts.",
        sourceName:
          "Field J. Whitney v. Robertson, 124 U.S. 190 (1888). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/124/190",
      },
    ],
  },

  {
    id: "plenary-power-exclude-aliens-chae-chan-ping-1889",
    claim:
      "The U.S. Supreme Court held in Chae Chan Ping v. United States (the Chinese Exclusion Case), decided 13 May 1889, that the power to exclude foreigners is an inherent, plenary incident of national sovereignty vested in the political branches, so Congress may bar the entry of aliens even in contravention of a prior treaty.",
    emergedAt: "1889-05-13",
    milestones: [
      {
        date: "1889-05-13",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Chae Chan Ping v. United States (130 U.S. 581, 13 May 1889): Justice Field, for a unanimous Court, upheld the Scott Act's exclusion of a returning Chinese laborer despite the Burlingame Treaty, holding that 'the jurisdiction of the nation within its own territory is necessarily exclusive and absolute' and that the power to exclude aliens is an inherent attribute of sovereignty that Congress may exercise as the 'last expression of the sovereign will,' overriding conflicting treaties. The ruling settled the plenary-power doctrine over immigration.",
        sourceName:
          "Field J. Chae Chan Ping v. United States (Chinese Exclusion Case), 130 U.S. 581 (1889). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/130/581",
      },
      {
        date: "1893-05-15",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Fong Yue Ting v. United States (149 U.S. 698, 15 May 1893): a 6–3 Court, per Justice Gray, extended the plenary-power doctrine from exclusion to deportation, holding that 'the power to exclude or to expel aliens' is 'vested in the political departments of the government' as an incident of sovereignty and largely beyond judicial review. By applying Chae Chan Ping to the expulsion of resident aliens, the decision hardened and broadened the doctrine into the enduring foundation of federal immigration power.",
        sourceName:
          "Gray J. Fong Yue Ting v. United States, 149 U.S. 698 (1893). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/149/698",
      },
    ],
  },

  {
    id: "at-will-employment-1877",
    claim:
      "American employment is presumed terminable at will by either party for any reason — the presumption articulated in Horace Gray Wood's 1877 treatise on master and servant, adopted by courts such as Payne v. Western & Atlantic Railroad (Tennessee, 1884), and later qualified by a public-policy exception first recognized in Petermann v. International Brotherhood of Teamsters (California, 1959).",
    emergedAt: "1877-01-01",
    emergedPrecision: "YEAR",
    milestones: [
      {
        date: "1877-01-01",
        precision: "YEAR",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "EXPERT_LITERATURE",
        reason:
          "Horace Gray Wood's treatise A Treatise on the Law of Master and Servant (1877) articulated 'Wood's Rule': where a hiring is of indefinite duration, it is presumed terminable at will by either party, and the burden falls on the employee to prove any fixed term. The formulation recorded the American at-will presumption as a stated doctrine, displacing the older English default of a presumed one-year hiring.",
        sourceName:
          "Horace Gray Wood. A Treatise on the Law of Master and Servant, § 134 (1877).",
        sourceUrl: "https://en.wikipedia.org/wiki/At-will_employment",
        methodologyType: "derivative",
      },
      {
        date: "1884-01-01",
        precision: "YEAR",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Payne v. Western & Atlantic Railroad (81 Tenn. 507, 1884): the Tennessee Supreme Court adopted the at-will presumption in its strongest form, holding that an employer may discharge employees 'for good cause, for no cause, or even for cause morally wrong' just as it may refuse to deal with anyone. Widely cited as the leading judicial endorsement of Wood's Rule, it settled at-will termination as the American default employment relationship.",
        sourceName:
          "Tennessee Supreme Court. Payne v. Western & Atlantic Railroad Co., 81 Tenn. 507 (1884).",
        sourceUrl: "https://en.wikipedia.org/wiki/At-will_employment",
        methodologyType: "derivative",
      },
      {
        date: "1959-01-01",
        precision: "YEAR",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Petermann v. International Brotherhood of Teamsters, Local 396 (174 Cal.App.2d 184, 1959): a California Court of Appeal held that an at-will employee stated a claim for wrongful discharge where he was fired for refusing to commit perjury before a legislative committee, because permitting such a discharge would contravene public policy. Recognized as the first public-policy exception to at-will employment, it reopened the previously settled rule to contestation and seeded the modern wrongful-discharge doctrine.",
        sourceName:
          "California Court of Appeal. Petermann v. International Brotherhood of Teamsters, Local 396, 174 Cal.App.2d 184, 344 P.2d 25 (1959).",
        sourceUrl: "https://en.wikipedia.org/wiki/At-will_employment",
        methodologyType: "derivative",
      },
    ],
  },

  {
    id: "horizontal-price-fixing-per-se-1927",
    claim:
      "Agreements among competitors to fix, raise, or stabilize prices are per se illegal under Section 1 of the Sherman Act, regardless of whether the prices set are reasonable, as the U.S. Supreme Court held definitively in United States v. Socony-Vacuum Oil Co. (6 May 1940).",
    emergedAt: "1927-02-21",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1927-02-21",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "United States v. Trenton Potteries Co. (273 U.S. 392, 21 February 1927): Justice Stone, for the Court, held that a combination of sanitary-pottery makers controlling 82% of the market that agreed to fix prices violated the Sherman Act, and that a jury need not inquire whether the prices were reasonable. The ruling recorded the principle that the power to fix prices—reasonable today, unreasonable tomorrow—is itself the evil the Act forbids, establishing price-fixing as unlawful without a reasonableness inquiry.",
        sourceName:
          "Supreme Court of the United States. United States v. Trenton Potteries Co., 273 U.S. 392 (1927).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/273/392",
      },
      {
        date: "1940-05-06",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "United States v. Socony-Vacuum Oil Co. (310 U.S. 150, 6 May 1940): After Appalachian Coals, Inc. v. United States (1933) had briefly suggested some cooperative price coordination might survive under the rule of reason, Justice Douglas's majority opinion resolved the doubt, holding that 'any combination which tampers with price structures is engaged in an unlawful activity' and that price-fixing is illegal per se 'without the necessity of minute inquiry.' The decision cemented an absolute, industry-neutral per se rule that remains the governing standard.",
        sourceName:
          "Supreme Court of the United States. United States v. Socony-Vacuum Oil Co., 310 U.S. 150 (1940).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/310/150",
      },
    ],
  },

  {
    id: "vertical-nonprice-restraints-per-se-1967",
    claim:
      "Non-price vertical restraints—a manufacturer's post-sale restrictions on the territories or customers of its distributors—were held per se illegal under Section 1 of the Sherman Act by the U.S. Supreme Court in United States v. Arnold, Schwinn & Co. (12 June 1967), a rule the Court overruled ten years later.",
    emergedAt: "1967-06-12",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1967-06-12",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "United States v. Arnold, Schwinn & Co. (388 U.S. 365, 12 June 1967): The Supreme Court held that once a manufacturer parts with title and risk to its goods, post-sale restrictions confining distributors to assigned territories or customers are a per se violation of Section 1. The ruling settled a bright-line prohibition on non-price vertical restraints, distinguishing only consignment/agency arrangements where the manufacturer retained ownership.",
        sourceName:
          "Supreme Court of the United States. United States v. Arnold, Schwinn & Co., 388 U.S. 365 (1967).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/388/365",
      },
      {
        date: "1977-06-23",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "Continental T.V., Inc. v. GTE Sylvania Inc. (433 U.S. 36, 23 June 1977): Justice Powell's majority expressly held that 'the per se rule stated in Schwinn must be overruled,' ruling that vertical non-price restraints must be judged under the rule of reason with attention to their actual interbrand-competitive effects. The reversal marked the Court's turn toward economic analysis in antitrust and repudiated the formalistic title-passing distinction of Schwinn.",
        sourceName:
          "Supreme Court of the United States. Continental T.V., Inc. v. GTE Sylvania Inc., 433 U.S. 36 (1977).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/433/36",
      },
    ],
  },

  {
    id: "section-2-monopolization-standard-1920",
    claim:
      "The offense of monopolization under Section 2 of the Sherman Act consists of the possession of monopoly power in a relevant market together with the willful acquisition or maintenance of that power—a standard that evolved from the U.S. Steel 'mere size is no offense' rule (1920) through Alcoa (1945) to the two-element test settled in United States v. Grinnell Corp. (13 June 1966).",
    emergedAt: "1920-03-01",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1920-03-01",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "United States v. United States Steel Corp. (251 U.S. 417, 1 March 1920): The Supreme Court declined to dissolve U.S. Steel despite its roughly 50% market share, holding that 'the law does not make mere size an offense, or the existence of unexerted power an offense'—the Act 'requires overt acts.' This settled an early, permissive monopolization standard under which dominant market position alone, absent abusive conduct, was lawful.",
        sourceName:
          "Supreme Court of the United States. United States v. United States Steel Corp., 251 U.S. 417 (1920).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/251/417",
      },
      {
        date: "1945-03-12",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "United States v. Aluminum Co. of America (148 F.2d 416, 2d Cir., 12 March 1945): Judge Learned Hand, writing for a Second Circuit panel designated as the court of last resort after the Supreme Court lacked a quorum, held that Alcoa's ~90% share of the virgin-ingot market constituted monopoly power and that its practice of progressively 'embracing each new opportunity' to expand capacity was the willful maintenance the statute condemned—monopoly is lawful only if 'thrust upon' the firm. The opinion sharply contested the U.S. Steel size-is-no-offense approach and reoriented Section 2 toward market structure and intent.",
        sourceName:
          "U.S. Court of Appeals for the Second Circuit. United States v. Aluminum Co. of America, 148 F.2d 416 (2d Cir. 1945).",
        sourceUrl:
          "https://www.courtlistener.com/opinion/1503668/united-states-v-aluminum-co-of-america/",
      },
      {
        date: "1966-06-13",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "United States v. Grinnell Corp. (384 U.S. 563, 13 June 1966): Justice Douglas synthesized the competing strands into the canonical two-element test—'(1) the possession of monopoly power in the relevant market and (2) the willful acquisition or maintenance of that power as distinguished from growth or development as a consequence of a superior product, business acumen, or historic accident.' Grinnell's 87% share established the power element, and the formulation has governed Section 2 monopolization analysis ever since.",
        sourceName:
          "Supreme Court of the United States. United States v. Grinnell Corp., 384 U.S. 563 (1966).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/384/563",
      },
    ],
  },

  {
    id: "merger-structural-presumption-1962",
    claim:
      "A merger that produces a firm controlling an undue share of a relevant market and significantly increases concentration is presumptively unlawful under Section 7 of the Clayton Act (as amended by the Celler-Kefauver Act of 1950)—a structural presumption established in United States v. Philadelphia National Bank (17 June 1963) and later made rebuttable in United States v. General Dynamics (1974).",
    emergedAt: "1962-06-25",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1962-06-25",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "Brown Shoe Co. v. United States (370 U.S. 294, 25 June 1962): In one of the first cases interpreting Section 7 as amended by the 1950 Celler-Kefauver Act, the Court blocked the Brown–Kinney shoe merger, emphasizing Congress's intent to arrest concentration 'at its outset and before it gathered momentum' and looking to industry integration trends rather than share alone. The decision recorded that incipient anticompetitive tendencies in both horizontal and vertical mergers were now judicially cognizable.",
        sourceName:
          "Supreme Court of the United States. Brown Shoe Co. v. United States, 370 U.S. 294 (1962).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/370/294",
      },
      {
        date: "1963-06-17",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "United States v. Philadelphia National Bank (374 U.S. 321, 17 June 1963): Justice Brennan held that a merger producing 'an undue percentage share of the relevant market' and a significant increase in concentration 'is so inherently likely to lessen competition substantially that it must be enjoined in the absence of evidence clearly showing that the merger is not likely to have such anticompetitive effects.' The resulting bank would hold ~30% of the four-county market, with the top two banks rising from 44% to 59%. This settled the structural presumption that made market-share statistics presumptively dispositive.",
        sourceName:
          "Supreme Court of the United States. United States v. Philadelphia National Bank, 374 U.S. 321 (1963).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/374/321",
      },
      {
        date: "1974-03-19",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "United States v. General Dynamics Corp. (415 U.S. 486, 19 March 1974): Justice Stewart held that market-share statistics 'while of great significance, were not conclusive indicators of anticompetitive effects,' and upheld dismissal because the acquired coal producer's depleted reserves meant its statistical share overstated its future competitive significance. By allowing the government's prima facie structural case to be rebutted by industry-specific evidence, the ruling contested the near-automatic presumption of Philadelphia National Bank and opened merger analysis to functional, forward-looking inquiry.",
        sourceName:
          "Supreme Court of the United States. United States v. General Dynamics Corp., 415 U.S. 486 (1974).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/415/486",
      },
    ],
  },

  {
    id: "platform-monopoly-maintenance-microsoft-2001",
    claim:
      "A dominant software platform violates Section 2 of the Sherman Act when it uses anticompetitive means—not competition on the merits—to maintain its operating-system monopoly against nascent 'middleware' threats, as the en banc U.S. Court of Appeals for the D.C. Circuit held in United States v. Microsoft Corp. (28 June 2001).",
    emergedAt: "2000-04-03",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "2000-04-03",
        precision: "DAY",
        fromAxis: null,
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "United States v. Microsoft Corp. (87 F. Supp. 2d 30, D.D.C., 3 April 2000): Judge Thomas Penfield Jackson's conclusions of law found that Microsoft had illegally maintained its Windows monopoly and unlawfully tied Internet Explorer to the operating system, and he subsequently ordered the company split into two. The sweeping structural remedy and the per se treatment of software tying made the platform-monopolization theory intensely contested pending appeal.",
        sourceName:
          "U.S. Court of Appeals for the D.C. Circuit. United States v. Microsoft Corp., 253 F.3d 34 (D.C. Cir. 2001) (recounting the April 2000 district-court judgment and remedy).",
        sourceUrl: "https://www.law.berkeley.edu/files/US_v_Microsoft3.pdf",
      },
      {
        date: "2001-06-28",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "United States v. Microsoft Corp. (253 F.3d 34, D.C. Cir., 28 June 2001): The en banc court unanimously affirmed that Microsoft had unlawfully maintained its operating-system monopoly under Section 2 through exclusionary dealings with OEMs and its handling of the browser and Java, applying a rule-of-reason framework; it reversed the per se tying holding and vacated the breakup remedy for further proceedings. The decision settled the modern analytic framework for platform monopolization—monopoly maintenance judged by anticompetitive effect versus procompetitive justification—that structures antitrust scrutiny of digital platforms today.",
        sourceName:
          "U.S. Court of Appeals for the D.C. Circuit. United States v. Microsoft Corp., 253 F.3d 34 (D.C. Cir. 2001) (en banc).",
        sourceUrl: "https://www.law.berkeley.edu/files/US_v_Microsoft3.pdf",
      },
    ],
  },

  {
    id: "parental-rights-fundamental-liberty-2000",
    claim:
      "The U.S. Supreme Court recognized in Troxel v. Granville (decided 5 June 2000) that the Fourteenth Amendment's Due Process Clause protects a fit parent's fundamental liberty interest in the care, custody, and control of their children, requiring courts to give special weight to a fit parent's decisions — a doctrine rooted in Meyer v. Nebraska (1923) and Pierce v. Society of Sisters (1925).",
    emergedAt: "1923-06-04",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1923-06-04",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "Meyer v. Nebraska (262 U.S. 390, 4 June 1923): The Court struck down a Nebraska law forbidding the teaching of foreign languages to young children, holding that the Fourteenth Amendment 'liberty' includes the right of parents to control the education and upbringing of their children. The opinion first recorded parental child-rearing authority as a constitutionally protected liberty interest, though as one strand of a broader substantive-due-process liberty rather than a settled stand-alone doctrine.",
        sourceName:
          "McReynolds J. Meyer v. Nebraska, 262 U.S. 390 (1923). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/262/390",
      },
      {
        date: "1925-06-01",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Pierce v. Society of Sisters (268 U.S. 510, 1 June 1925): A unanimous Court struck down Oregon's Compulsory Education Act, which required nearly all children to attend public schools, holding that it 'unreasonably interferes with the liberty of parents and guardians to direct the upbringing and education of children under their control' — 'the child is not the mere creature of the state.' The decision settled parental authority over a child's education and upbringing as a judicially enforceable constitutional right.",
        sourceName:
          "McReynolds J. Pierce v. Society of Sisters, 268 U.S. 510 (1925). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/268/510",
      },
      {
        date: "2000-06-05",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Troxel v. Granville (530 U.S. 57, 5 June 2000): A plurality per Justice O'Connor held Washington's expansive grandparent-visitation statute unconstitutional as applied, reaffirming that 'the Due Process Clause protects the fundamental right of parents to make decisions concerning the care, custody, and control of their children' and that a fit parent's decisions are entitled to special weight. The decision re-anchored the Meyer–Pierce doctrine as settled fundamental-rights law in the modern era, applying it against third-party custody and visitation claims.",
        sourceName:
          "O'Connor J. (plurality). Troxel v. Granville, 530 U.S. 57 (2000).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/99-138",
      },
    ],
  },

  {
    id: "marital-rape-exemption-abolished-1984",
    claim:
      "The common-law rule that a husband could not be criminally liable for raping his wife (the marital rape exemption), treated as settled doctrine since Sir Matthew Hale's 1736 treatise, was held to violate the Equal Protection Clause and abolished for New York by the Court of Appeals in People v. Liberta (decided 20 December 1984).",
    emergedAt: "1736-01-01",
    emergedPrecision: "YEAR",
    milestones: [
      {
        date: "1736-01-01",
        precision: "YEAR",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "EXPERT_LITERATURE",
        reason:
          "Sir Matthew Hale, Historia Placitorum Coronae (The History of the Pleas of the Crown), published posthumously in 1736, stated that 'the husband cannot be guilty of a rape committed by himself upon his lawful wife, for by their mutual matrimonial consent and contract the wife hath given up herself in this kind unto her husband, which she cannot retract.' This treatise formulation was received as settled common law throughout Anglo-American jurisdictions, including New York, and was written into most American rape statutes as a spousal exemption.",
        sourceName:
          "Hale, Sir Matthew. Historia Placitorum Coronae (The History of the Pleas of the Crown), vol. 1 (1736). Marital rape exemption doctrine.",
        sourceUrl: "https://en.wikipedia.org/wiki/Marital_rape_(United_States_law)",
        methodologyType: "derivative",
      },
      {
        date: "1984-12-20",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "People v. Liberta (64 N.Y.2d 152, 475 N.E.2d 1058, 20 December 1984): The New York Court of Appeals held that the marital exemption in the state's rape statute, and the statute's female-only exemption, lacked any rational basis and violated the Equal Protection Clause. Rather than void the statute, the court excised the unconstitutional exemptions and extended criminal liability to all rapists including husbands. It was a leading state high-court decision that reversed the centuries-old Hale doctrine and catalyzed abolition of marital-rape exemptions nationwide.",
        sourceName:
          "Wachtler J. People v. Liberta, 64 N.Y.2d 152, 475 N.E.2d 1058 (N.Y. 1984). Opinion of the Court.",
        sourceUrl: "https://www.courtlistener.com/opinion/2609501/people-v-liberta/",
      },
    ],
  },

  {
    id: "frozen-embryo-legal-status-2024",
    claim:
      "The legal status of cryopreserved human embryos — whether persons, property, or an interim category — is contested in U.S. law: the Tennessee Supreme Court in Davis v. Davis (1992) held preembryos are neither persons nor property, whereas the Alabama Supreme Court in LePage v. Center for Reproductive Medicine (decided 16 February 2024) held frozen embryos are 'children' under the Wrongful Death of a Minor Act.",
    emergedAt: "1992-06-01",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1992-06-01",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "Davis v. Davis (842 S.W.2d 588, Tenn., 1 June 1992): In the first American appellate decision on disputed frozen embryos, the Tennessee Supreme Court held that cryopreserved preembryos are neither 'persons' nor 'property' but occupy an 'interim category' entitled to special respect for their potential for human life, and that the gamete-providers hold decisional authority over disposition. The ruling recorded the dominant framework — embryos as a special interim category governed by the progenitors' constitutional interests in procreation — that most jurisdictions followed for three decades.",
        sourceName:
          "Daughtrey J. Davis v. Davis, 842 S.W.2d 588 (Tenn. 1992). Opinion of the Court (per ASU Embryo Project Encyclopedia).",
        sourceUrl: "https://embryo.asu.edu/pages/davis-v-davis-1992",
        methodologyType: "derivative",
      },
      {
        date: "2024-02-16",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "LePage v. Center for Reproductive Medicine (SC-2022-0515, Ala., 16 February 2024): The Alabama Supreme Court held that cryopreserved extrauterine embryos are 'children' or 'unborn children' covered by Alabama's Wrongful Death of a Minor Act, allowing parents to sue an IVF clinic for the destruction of embryos — the first U.S. decision applying a wrongful-death statute to embryos outside a uterus. By treating embryos as legal children, the ruling directly contested the settled Davis 'interim category' framework and threw the legal status of frozen embryos into open dispute, prompting IVF clinics in the state to suspend services.",
        sourceName:
          "Mitchell J. LePage v. Center for Reproductive Medicine, No. SC-2022-0515 (Ala. 2024). Alabama Supreme Court (per State Court Report case tracker).",
        sourceUrl:
          "https://statecourtreport.org/case-tracker/lepage-v-center-reproductive-medicine",
        methodologyType: "derivative",
      },
      {
        date: "2024-03-06",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "CONTESTED",
        community: "INSTITUTIONAL",
        reason:
          "Alabama Senate Bill 159, signed by Governor Kay Ivey on 6 March 2024: Reacting to the disruption caused by LePage, the Alabama legislature granted civil and criminal immunity to providers and patients for the damage or death of an embryo during IVF services. The statute allowed clinics to resume treatment but deliberately declined to resolve the underlying question of embryonic personhood, leaving the legal status of frozen embryos unsettled and actively contested between judicial, legislative, and public arenas.",
        sourceName:
          "Alabama SB159 (2024) — IVF provider immunity law signed by Gov. Kay Ivey, 6 March 2024. PBS NewsHour.",
        sourceUrl:
          "https://www.pbs.org/newshour/politics/alabama-governor-signs-legislation-protecting-ivf-providers-from-prosecution-and-lawsuits",
        methodologyType: "derivative",
      },
    ],
  },

  {
    id: "aca-contraceptive-mandate-religious-exemption-2014",
    claim:
      "The U.S. Supreme Court held that the Affordable Care Act's contraceptive-coverage mandate must yield to employers' religious objections under the Religious Freedom Restoration Act — first for closely held for-profit corporations in Burwell v. Hobby Lobby Stores (decided 30 June 2014), then by upholding broad agency-created religious and moral exemptions in Little Sisters of the Poor v. Pennsylvania (decided 8 July 2020).",
    emergedAt: "2014-06-30",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "2014-06-30",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Burwell v. Hobby Lobby Stores, Inc. (573 U.S. 682, 30 June 2014): A 5–4 majority per Justice Alito held that the HHS contraceptive mandate, as applied to closely held for-profit corporations whose owners have sincere religious objections to certain contraceptives, violates the Religious Freedom Restoration Act because it is not the least restrictive means of advancing the government's interest. The decision settled that RFRA protects closely held corporations and carved the first major religious exemption from the ACA contraceptive mandate.",
        sourceName:
          "Alito J. Burwell v. Hobby Lobby Stores, Inc., 573 U.S. 682 (2014). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/13-354",
      },
      {
        date: "2020-07-08",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Little Sisters of the Poor Saints Peter and Paul Home v. Pennsylvania (591 U.S. 657, 8 July 2020): A 7–2 Court (Justices Kagan and Breyer concurring in the judgment) upheld federal agencies' statutory authority under the ACA to promulgate broad religious and moral exemptions from the contraceptive mandate, reversing lower courts that had enjoined the rules. The decision extended and stabilized the Hobby Lobby line, confirming that the executive may exempt religious objectors — including nonprofit orders like the Little Sisters — from the mandate, and settling the mandate's subordination to religious-liberty accommodations.",
        sourceName:
          "Thomas J. Little Sisters of the Poor Saints Peter and Paul Home v. Pennsylvania, 591 U.S. 657 (2020). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/19-431",
      },
    ],
  },

  {
    id: "sixth-amendment-appointed-counsel-gideon-1963",
    claim:
      "The U.S. Supreme Court held in Gideon v. Wainwright, decided 18 March 1963, that the Sixth Amendment right to counsel is a fundamental right made obligatory on the states by the Fourteenth Amendment, so states must appoint counsel for indigent defendants in felony prosecutions.",
    emergedAt: "1932-11-07",
    milestones: [
      {
        date: "1932-11-07",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "Powell v. Alabama (287 U.S. 45, 7 Nov 1932): reviewing the Scottsboro Boys capital convictions, the Court held that in a capital case where the defendant is unable to employ counsel and incapable of defending himself, due process requires the trial court to appoint effective counsel. The ruling first recorded a federal constitutional right to appointed counsel, but confined it to capital cases and 'special circumstances,' leaving open whether the right extended to ordinary felony prosecutions.",
        sourceName:
          "Sutherland J. Powell v. Alabama, 287 U.S. 45 (1932). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/287/45",
      },
      {
        date: "1942-06-01",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Betts v. Brady (316 U.S. 455, 1 Jun 1942): a 6–3 Court held that the Fourteenth Amendment does not impose a blanket requirement that states appoint counsel for indigent defendants in non-capital cases, and that the right depends on a case-by-case assessment of whether the absence of counsel produced a fundamentally unfair trial. By rejecting a categorical right and substituting an ad hoc 'special circumstances' test, Betts left the scope of the right contested and unpredictable for two decades.",
        sourceName:
          "Roberts J. Betts v. Brady, 316 U.S. 455 (1942). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/316/455",
      },
      {
        date: "1963-03-18",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Gideon v. Wainwright (372 U.S. 335, 18 Mar 1963): a unanimous Court overruled Betts v. Brady, holding that the Sixth Amendment right to counsel is fundamental and essential to a fair trial and is therefore obligatory on the states through the Fourteenth Amendment. Justice Black's opinion established that any indigent defendant charged with a felony in state court must be provided appointed counsel, settling the categorical right that Powell had recorded and Betts had contested.",
        sourceName:
          "Black J. Gideon v. Wainwright, 372 U.S. 335 (1963). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/372/335",
      },
    ],
  },

  {
    id: "dred-scott-black-citizenship-1857",
    claim:
      "The U.S. Supreme Court held in Dred Scott v. Sandford, decided 6 March 1857, that persons of African descent whose ancestors were sold as slaves could not be citizens of the United States and that Congress had no power to prohibit slavery in the federal territories, rendering the Missouri Compromise unconstitutional.",
    emergedAt: "1857-03-06",
    milestones: [
      {
        date: "1857-03-06",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Dred Scott v. Sandford (60 U.S. 393, 6 Mar 1857): Chief Justice Taney, for a 7–2 Court, held that Black people, whether enslaved or free, were not and could never be 'citizens' within the meaning of the Constitution, and that the Fifth Amendment's protection of property in slaves barred Congress from prohibiting slavery in the territories, making the Missouri Compromise void. The decision judicially settled the exclusion of Black Americans from national citizenship and the constitutional protection of slavery in the territories.",
        sourceName:
          "Taney CJ. Dred Scott v. Sandford, 60 U.S. (19 How.) 393 (1857). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/60/393",
      },
      {
        date: "1866-04-09",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "INSTITUTIONAL",
        reason:
          "Civil Rights Act of 1866 (14 Stat. 27, enacted 9 Apr 1866 over President Johnson's veto): Congress declared that all persons born in the United States and not subject to any foreign power are citizens, directly repudiating Dred Scott's citizenship holding by statute. Because the Act's constitutionality under the existing Constitution was doubted — a doubt that motivated the drafting of a constitutional amendment — it placed Dred Scott's holding in open contestation rather than conclusively overturning it.",
        sourceName:
          "Civil Rights Act of 1866, 14 Stat. 27 (April 9, 1866).",
        sourceUrl: "https://www.loc.gov/item/llsl-v14/",
      },
      {
        date: "1868-07-09",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "REVERSED",
        community: "INSTITUTIONAL",
        reason:
          "Fourteenth Amendment (ratified 9 Jul 1868): the Citizenship Clause declared that all persons born or naturalized in the United States are citizens of the United States and of the state in which they reside, constitutionally overruling Dred Scott's holding that Black Americans could not be citizens. The amendment extinguished the doctrinal foundation of the decision, definitively reversing it by constitutional amendment.",
        sourceName:
          "U.S. Constitution, Amendment XIV, Section 1 (ratified 9 July 1868). Citizenship Clause.",
        sourceUrl: "https://www.law.cornell.edu/constitution/amendmentxiv",
      },
    ],
  },

  {
    id: "terry-stop-and-frisk-reasonable-suspicion-1968",
    claim:
      "The U.S. Supreme Court held in Terry v. Ohio, decided 10 June 1968, that a police officer may stop and briefly detain a person and conduct a limited pat-down for weapons on 'reasonable suspicion' — specific and articulable facts short of probable cause — without violating the Fourth Amendment.",
    emergedAt: "1968-06-10",
    milestones: [
      {
        date: "1968-06-10",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Terry v. Ohio (392 U.S. 1, 10 Jun 1968): an 8–1 Court held that a brief investigative stop and a protective frisk for weapons are 'searches' and 'seizures' governed by the Fourth Amendment's reasonableness clause, but may be justified on reasonable, articulable suspicion rather than probable cause. Chief Justice Warren's opinion created the reasonable-suspicion standard as a permanent, distinct tier of Fourth Amendment justification, settling the constitutionality of stop-and-frisk policing.",
        sourceName:
          "Warren CJ. Terry v. Ohio, 392 U.S. 1 (1968). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/392/1",
      },
      {
        date: "2000-01-12",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Illinois v. Wardlow (528 U.S. 119, 12 Jan 2000): a 5–4 Court held that unprovoked flight upon seeing police in a high-crime area gives rise to reasonable suspicion justifying a Terry stop, applying and reaffirming the Terry framework more than three decades later. The ruling confirmed reasonable suspicion as a settled, operative standard while refining its application to ambiguous, context-dependent conduct.",
        sourceName:
          "Rehnquist CJ. Illinois v. Wardlow, 528 U.S. 119 (2000). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/528/119",
      },
    ],
  },

  {
    id: "confrontation-clause-reliability-test-crawford-2004",
    claim:
      "Under Ohio v. Roberts (1980), an absent witness's out-of-court statement could be admitted against a criminal defendant if the witness was unavailable and the statement bore 'adequate indicia of reliability' — a reliability-based test for the Sixth Amendment Confrontation Clause that Crawford v. Washington overruled in 2004.",
    emergedAt: "1980-06-25",
    milestones: [
      {
        date: "1980-06-25",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Ohio v. Roberts (448 U.S. 56, 25 Jun 1980): the Court held that the Confrontation Clause permits admission of an unavailable witness's hearsay statement if it bears 'adequate indicia of reliability,' either by falling within a firmly rooted hearsay exception or by showing particularized guarantees of trustworthiness. The decision settled a reliability-based framework that governed confrontation analysis for nearly a quarter-century.",
        sourceName:
          "Blackmun J. Ohio v. Roberts, 448 U.S. 56 (1980). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/448/56",
      },
      {
        date: "2004-03-08",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "Crawford v. Washington (541 U.S. 36, 8 Mar 2004): Justice Scalia, for the Court, overruled Ohio v. Roberts as applied to testimonial statements, holding that the Confrontation Clause bars admission of testimonial out-of-court statements against a criminal defendant unless the declarant is unavailable and the defendant had a prior opportunity for cross-examination. The Court rejected judicial reliability determinations as a substitute for confrontation, reversing the Roberts framework and grounding the Clause in its historical meaning.",
        sourceName:
          "Scalia J. Crawford v. Washington, 541 U.S. 36 (2004). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/541/36",
      },
    ],
  },

  {
    id: "peremptory-strikes-systematic-exclusion-batson-1986",
    claim:
      "Under Swain v. Alabama (1965), a defendant alleging racial discrimination in the prosecution's peremptory challenges had to prove a pattern of systematic exclusion across many cases — an evidentiary burden that made the equal-protection claim virtually unprovable until Batson v. Kentucky overruled it in 1986.",
    emergedAt: "1965-03-08",
    milestones: [
      {
        date: "1965-03-08",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Swain v. Alabama (380 U.S. 202, 8 Mar 1965): the Court held that while purposeful racial discrimination in jury selection violates equal protection, a defendant challenging peremptory strikes must show the prosecutor's systematic use of peremptories to exclude a racial group 'in case after case' over time, not merely in the defendant's own trial. The decision settled an evidentiary standard so demanding that it effectively insulated single-case peremptory discrimination from review.",
        sourceName:
          "White J. Swain v. Alabama, 380 U.S. 202 (1965). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/380/202",
      },
      {
        date: "1986-04-30",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "Batson v. Kentucky (476 U.S. 79, 30 Apr 1986): a 7–2 Court overruled Swain's evidentiary standard, holding that a defendant may establish a prima facie case of purposeful racial discrimination from the peremptory strikes in his own trial alone, shifting the burden to the prosecutor to offer race-neutral reasons. By discarding the cross-case systematic-exclusion requirement, Batson reversed Swain and made the equal-protection challenge to peremptory strikes practically enforceable.",
        sourceName:
          "Powell J. Batson v. Kentucky, 476 U.S. 79 (1986). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/476/79",
      },
    ],
  },

  {
    id: "slaughterhouse-privileges-immunities-gutted-1873",
    claim:
      "In the Slaughter-House Cases (83 U.S. 36), decided 14 April 1873, the U.S. Supreme Court held that the Fourteenth Amendment's Privileges or Immunities Clause protects only the narrow class of rights of national (United States) citizenship and not the ordinary civil rights of state citizenship, effectively removing that clause as a source of substantive federal rights.",
    emergedAt: "1873-04-14",
    milestones: [
      {
        date: "1873-04-14",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "A 5–4 majority per Justice Miller held that the Privileges or Immunities Clause reaches only rights owing their existence to the federal government and its national character, leaving the great body of civil rights under state control. The Court rejected the New Orleans butchers' claim that a state slaughterhouse monopoly abridged their federal right to pursue a lawful trade. The decision drained the Privileges or Immunities Clause of independent force and channeled later Fourteenth Amendment litigation into the Due Process and Equal Protection Clauses.",
        sourceName:
          "Miller J. Slaughter-House Cases, 83 U.S. (16 Wall.) 36 (1873). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/83/36",
      },
      {
        date: "2010-06-28",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In McDonald v. City of Chicago (561 U.S. 742), the Court incorporated the Second Amendment against the states through the Due Process Clause and expressly declined the petitioners' invitation to overrule the Slaughter-House Cases and revive the Privileges or Immunities Clause (only Justice Thomas would have done so in concurrence). The refusal confirmed that Slaughter-House's narrow reading of the clause remains settled law 137 years later. It marks the doctrine's durability despite sustained academic and litigant pressure to reverse it.",
        sourceName:
          "Alito J. McDonald v. City of Chicago, 561 U.S. 742 (2010). Slip opinion, No. 08-1521.",
        sourceUrl: "https://www.supremecourt.gov/opinions/09pdf/08-1521.pdf",
      },
    ],
  },

  {
    id: "civil-rights-cases-state-action-1883",
    claim:
      "In the Civil Rights Cases (109 U.S. 3), decided 15 October 1883, the U.S. Supreme Court struck down the public-accommodations provisions of the Civil Rights Act of 1875 and held that the Fourteenth Amendment prohibits only discriminatory state action, not private acts of racial discrimination by individuals such as innkeepers, theater owners, and railroads.",
    emergedAt: "1883-10-15",
    milestones: [
      {
        date: "1883-10-15",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "An 8–1 majority per Justice Bradley held that Sections 1 and 2 of the Civil Rights Act of 1875 exceeded Congress's enforcement power because the Fourteenth Amendment is directed at state action, not the 'wrongful acts of individuals, unsupported by state authority.' Justice Harlan dissented alone. The decision established the state-action doctrine that has defined the reach of the Reconstruction Amendments ever since and left private racial discrimination beyond federal constitutional reach for decades.",
        sourceName:
          "Bradley J. The Civil Rights Cases, 109 U.S. 3 (1883). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/109/3",
      },
      {
        date: "2000-05-15",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In United States v. Morrison (529 U.S. 598), the Court invalidated the civil-remedy provision of the Violence Against Women Act, holding that under the Civil Rights Cases the Fourteenth Amendment enforcement power reaches only state action and cannot regulate purely private conduct. The Court reaffirmed the Civil Rights Cases by name as controlling authority. The ruling confirmed that the 1883 state-action doctrine remains settled constitutional law, even though private discrimination in public accommodations was separately reached through the Commerce Clause in 1964.",
        sourceName:
          "Rehnquist CJ. United States v. Morrison, 529 U.S. 598 (2000). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/529/598",
      },
    ],
  },

  {
    id: "yick-wo-discriminatory-enforcement-1886",
    claim:
      "In Yick Wo v. Hopkins (118 U.S. 356), decided 10 May 1886, the U.S. Supreme Court held that a law fair on its face but administered with 'an evil eye and an unequal hand' to discriminate against Chinese laundry operators violates the Fourteenth Amendment's Equal Protection Clause, and that the clause protects all persons within the jurisdiction regardless of citizenship or race.",
    emergedAt: "1886-05-10",
    milestones: [
      {
        date: "1886-05-10",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "A unanimous Court per Justice Matthews held that San Francisco's facially neutral laundry-permit ordinance was enforced so as to deny permits to essentially all Chinese applicants while granting them to nearly all non-Chinese applicants, and that such discriminatory administration is a denial of equal protection. The Court also held that the Equal Protection Clause reaches 'all persons,' including resident non-citizens. The decision established that discriminatory application of a neutral law is itself unconstitutional.",
        sourceName:
          "Matthews J. Yick Wo v. Hopkins, 118 U.S. 356 (1886). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/118/356",
      },
      {
        date: "1976-06-07",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Washington v. Davis (426 U.S. 229), the Court refined the Yick Wo principle by holding that discriminatory administrative impact alone is insufficient and that an equal-protection violation requires proof of discriminatory purpose, while reaffirming Yick Wo as the foundational case for challenging the discriminatory application of neutral laws. The ruling both cabined and confirmed Yick Wo's continuing authority. It settled the modern intent-based framework in which Yick Wo's 'evil eye and unequal hand' standard still operates.",
        sourceName:
          "White J. Washington v. Davis, 426 U.S. 229 (1976). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/426/229",
      },
    ],
  },

  {
    id: "buck-v-bell-compulsory-sterilization-1927",
    claim:
      "In Buck v. Bell (274 U.S. 200), decided 2 May 1927, the U.S. Supreme Court upheld Virginia's compulsory sterilization of the institutionalized 'feebleminded' against Fourteenth Amendment due-process and equal-protection challenges, with Justice Holmes writing 'three generations of imbeciles are enough.'",
    emergedAt: "1927-05-02",
    milestones: [
      {
        date: "1927-05-02",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "An 8–1 majority per Justice Holmes upheld Virginia's Eugenical Sterilization Act, holding that compelled sterilization of Carrie Buck did not violate due process given the statute's procedural safeguards, and did not deny equal protection merely because it reached only institutionalized persons. The decision constitutionalized eugenic sterilization and was cited to justify some 60,000 sterilizations across the United States. It settled, for a generation, that states could compel sterilization in the name of public welfare.",
        sourceName:
          "Holmes J. Buck v. Bell, 274 U.S. 200 (1927). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/274/200",
      },
      {
        date: "1942-06-01",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "In Skinner v. Oklahoma (316 U.S. 535), the Court struck down compulsory sterilization of 'habitual criminals' under the Equal Protection Clause, describing procreation as 'one of the basic civil rights of man' and applying strict scrutiny. Though the Court distinguished rather than overruled Buck v. Bell, Skinner reframed procreation as a fundamental right and is widely regarded as having gravely weakened Buck's precedential force. The decision put the constitutionality of eugenic sterilization into open doubt.",
        sourceName:
          "Douglas J. Skinner v. Oklahoma, 316 U.S. 535 (1942). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/316/535",
      },
      {
        date: "1974-01-01",
        precision: "YEAR",
        fromAxis: "CONTESTED",
        toAxis: "ABANDONED",
        community: "INSTITUTIONAL",
        reason:
          "Virginia repealed the compulsory-sterilization procedures of its Eugenical Sterilization Act in 1974, part of a nationwide legislative abandonment of eugenic sterilization statutes; Virginia's current law authorizes only voluntary sterilization of consenting adults. Although the Supreme Court has never formally overruled Buck v. Bell — scholar G. Edward White wrote that the Court 'distinguished the case out of existence' — no jurisdiction enforces its holding and it is treated as anti-canonical. The doctrine has been abandoned without formal judicial reversal.",
        sourceName:
          "Buck v. Bell — repeal of Virginia's eugenic sterilization procedures (1974) and scholarly assessment that the case was never formally overruled (Wikipedia, 'Buck v. Bell', citing G. Edward White).",
        sourceUrl: "https://en.wikipedia.org/wiki/Buck_v._Bell",
        methodologyType: "derivative",
      },
    ],
  },

  {
    id: "bradwell-women-profession-1873",
    claim:
      "In Bradwell v. Illinois (83 U.S. 130), decided 15 April 1873, the U.S. Supreme Court held that the Fourteenth Amendment's Privileges or Immunities Clause did not protect a woman's right to be admitted to the practice of law, upholding Illinois's exclusion of Myra Bradwell from the bar on account of her sex.",
    emergedAt: "1873-04-15",
    milestones: [
      {
        date: "1873-04-15",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "The Court, per Justice Miller and relying on the prior day's Slaughter-House holding, ruled that admission to a state bar is not a privilege of national citizenship and so is unprotected by the Fourteenth Amendment. Justice Bradley's concurrence declared that 'the paramount destiny and mission of woman are to fulfil the noble and benign offices of wife and mother.' The decision settled that states could constitutionally exclude women from professions and set the baseline that sex-based classifications received essentially no constitutional scrutiny.",
        sourceName:
          "Miller J. (Bradley J., concurring). Bradwell v. Illinois, 83 U.S. (16 Wall.) 130 (1873). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/83/130",
      },
      {
        date: "1971-11-22",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "In Reed v. Reed (404 U.S. 71), the Court for the first time struck down a state law for discriminating on the basis of sex, holding that an Idaho statute preferring men over women as estate administrators lacked a rational basis under the Equal Protection Clause. The ruling directly contested Bradwell's premise that sex classifications escape constitutional review. It opened the modern era of heightened judicial scrutiny of sex-based laws.",
        sourceName:
          "Burger CJ. Reed v. Reed, 404 U.S. 71 (1971). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/404/71",
      },
      {
        date: "1973-05-14",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "ABANDONED",
        community: "JUDICIAL",
        reason:
          "In Frontiero v. Richardson (411 U.S. 677), a plurality applied strict scrutiny to sex classifications and expressly repudiated the 'romantic paternalism' exemplified by Bradwell, noting that such attitudes had put women 'not on a pedestal, but in a cage.' Together with the intermediate-scrutiny standard later fixed in Craig v. Boren (1976), the decision abandoned Bradwell's rule that states may freely exclude women from professions and occupations. Bradwell was never formally overruled but its doctrine is defunct.",
        sourceName:
          "Brennan J. Frontiero v. Richardson, 411 U.S. 677 (1973). Plurality opinion.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/411/677",
      },
    ],
  },

  {
    id: "products-privity-requirement-abolished-1960",
    claim:
      "The requirement of contractual privity bars a consumer injured by a defective product from recovering against a remote manufacturer — a common-law rule reversed for negligence by MacPherson v. Buick Motor Co. (N.Y. 1916) and abolished for implied warranty of merchantability, with the manufacturer's standardized disclaimer held void as against public policy, by the New Jersey Supreme Court in Henningsen v. Bloomfield Motors, Inc. (9 May 1960).",
    emergedAt: "1842-01-01",
    emergedPrecision: "YEAR",
    milestones: [
      {
        date: "1842-01-01",
        precision: "YEAR",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Winterbottom v. Wright (10 M. & W. 109, 152 Eng. Rep. 402, Exchequer of Pleas, 1842): the court denied recovery to a mail-coach driver injured by a defectively maintained coach because he had no contract with the repairer, reasoning that allowing suits by non-parties would open the door to 'unlimited actions.' The decision established the privity-of-contract requirement as settled law, insulating manufacturers and suppliers from liability to anyone lacking a direct contractual relationship for most of the nineteenth century.",
        sourceName:
          "Court of Exchequer. Winterbottom v. Wright, 10 M. & W. 109, 152 Eng. Rep. 402 (Ex. 1842).",
        sourceUrl: "https://en.wikipedia.org/wiki/Winterbottom_v_Wright",
        methodologyType: "derivative",
      },
      {
        date: "1916-03-14",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "MacPherson v. Buick Motor Co. (217 N.Y. 382, 111 N.E. 1050, 14 March 1916): Judge Cardozo, for the New York Court of Appeals, held that a manufacturer owes a duty of care in negligence to any foreseeable user of a product that is 'reasonably certain to place life and limb in peril when negligently made,' regardless of privity. The ruling dismantled the privity bar in negligence and was adopted nationwide, but left the requirement intact for warranty (contract) claims — converting a once-settled doctrine into a contested, partially-repudiated rule.",
        sourceName:
          "Cardozo J. MacPherson v. Buick Motor Co., 217 N.Y. 382, 111 N.E. 1050 (1916). Opinion of the Court.",
        sourceUrl:
          "https://law.justia.com/cases/new-york/court-of-appeals/1916/217-n-y-382-0.html",
      },
      {
        date: "1960-05-09",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "Henningsen v. Bloomfield Motors, Inc. (32 N.J. 358, 161 A.2d 69, 9 May 1960): the New Jersey Supreme Court held that an automobile manufacturer's implied warranty of merchantability runs to a consumer and his family despite the absence of privity, and that the standardized disclaimer of that warranty imposed on a take-it-or-leave-it basis was void as against public policy. By eliminating privity in the warranty context and striking the boilerplate disclaimer, Henningsen completed the reversal of the privity fortress and became a principal doorway to modern products liability.",
        sourceName:
          "Francis J. Henningsen v. Bloomfield Motors, Inc., 32 N.J. 358, 161 A.2d 69 (1960). Opinion of the Court.",
        sourceUrl:
          "https://law.justia.com/cases/new-jersey/supreme-court/1960/32-n-j-358-0.html",
      },
    ],
  },

  {
    id: "bystander-emotional-distress-recovery-1968",
    claim:
      "A bystander who is outside the zone of physical danger may recover for negligent infliction of emotional distress caused by contemporaneously witnessing negligent injury to a close relative, under a foreseeability test — established by the California Supreme Court in Dillon v. Legg (21 June 1968).",
    emergedAt: "1968-06-21",
    milestones: [
      {
        date: "1968-06-21",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Dillon v. Legg (68 Cal.2d 728, 441 P.2d 912, 21 June 1968): the California Supreme Court, over dissent, overruled Amaya v. Home Ice, Fuel & Supply Co. (59 Cal.2d 295, 1963) and rejected the 'zone of danger' requirement, holding that a mother who watched her child be killed by a negligent driver could recover for emotional distress even though she herself was never in physical peril. The court substituted a foreseeability analysis turning on the plaintiff's proximity to the accident, contemporaneous sensory observation, and close relationship to the victim, newly establishing bystander NIED recovery.",
        sourceName:
          "Tobriner J. Dillon v. Legg, 68 Cal.2d 728, 441 P.2d 912 (1968). Opinion of the Court.",
        sourceUrl:
          "https://law.justia.com/cases/california/supreme-court/2d/68/728.html",
      },
      {
        date: "1989-01-01",
        precision: "YEAR",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Thing v. La Chusa (48 Cal.3d 644, 771 P.2d 814, 1989): responding to two decades of unpredictable application of Dillon's flexible foreseeability approach, the California Supreme Court replaced it with fixed, bright-line elements — the plaintiff must be closely related to the victim, present at the scene and aware that it is causing injury, and suffer serious emotional distress. The ruling preserved but sharply cabined bystander recovery, stabilizing the doctrine into a predictable, settled rule.",
        sourceName:
          "Eagleson J. Thing v. La Chusa, 48 Cal.3d 644, 771 P.2d 814 (1989). Opinion of the Court.",
        sourceUrl:
          "https://law.justia.com/cases/california/supreme-court/3d/48/644.html",
      },
    ],
  },

  {
    id: "implied-warranty-of-habitability-1970",
    claim:
      "Residential leases contain an implied warranty of habitability measured by the housing code, and the tenant's obligation to pay rent is dependent on the landlord maintaining habitable conditions — abolishing the common-law caveat lessee and independent-covenants rules; established by the U.S. Court of Appeals for the D.C. Circuit in Javins v. First National Realty Corp. (7 May 1970).",
    emergedAt: "1970-05-07",
    milestones: [
      {
        date: "1970-05-07",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Javins v. First National Realty Corp. (428 F.2d 1071, D.C. Cir., 7 May 1970): Judge J. Skelly Wright held that a warranty of habitability, measured by the D.C. Housing Regulations, is implied by law into leases of urban dwelling units, and that the tenant's covenant to pay rent is mutually dependent on the landlord's covenant to keep the premises habitable — so housing-code violations are a defense to eviction for nonpayment. The decision rejected the feudal treatment of a lease as a mere conveyance, discarding the caveat lessee doctrine and the independent-covenants rule, and became the leading precedent for the implied warranty of habitability adopted across American jurisdictions.",
        sourceName:
          "Wright J. Javins v. First National Realty Corp., 428 F.2d 1071 (D.C. Cir. 1970). Opinion of the Court.",
        sourceUrl:
          "https://law.justia.com/cases/federal/appellate-courts/F2/428/1071/",
      },
    ],
  },

  {
    id: "promissory-estoppel-subcontractor-bids-1958",
    claim:
      "A subcontractor's bid is a revocable offer that the general contractor cannot enforce if it is withdrawn before acceptance, and the general's reliance does not make the bid irrevocable — the traditional rule of James Baird Co. v. Gimbel Bros. (2d Cir. 1933), reversed by the California Supreme Court in Drennan v. Star Paving Co. (31 December 1958), which used promissory estoppel (Restatement of Contracts § 90) to bind the bid.",
    emergedAt: "1933-01-01",
    emergedPrecision: "YEAR",
    milestones: [
      {
        date: "1933-01-01",
        precision: "YEAR",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "James Baird Co. v. Gimbel Bros. (64 F.2d 344, 2d Cir. 1933): Judge Learned Hand held that a subcontractor's bid was an ordinary offer that could be revoked at any time before acceptance, and that the general contractor's use of the bid in computing its own proposal was not an acceptance and did not, through promissory estoppel, render the offer irrevocable. The decision settled the classical-consideration rule that reliance on an unaccepted bid gives the general no enforceable claim.",
        sourceName:
          "Hand L., J. James Baird Co. v. Gimbel Bros., Inc., 64 F.2d 344 (2d Cir. 1933). Opinion of the Court.",
        sourceUrl:
          "https://law.justia.com/cases/federal/appellate-courts/F2/64/344/",
      },
      {
        date: "1958-12-31",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "Drennan v. Star Paving Co. (51 Cal.2d 409, 333 P.2d 757, 31 December 1958): Justice Traynor, for the California Supreme Court, rejected James Baird and held that a general contractor's reasonable and foreseeable reliance on a subcontractor's bid makes that bid irrevocable under Restatement of Contracts § 90, even without consideration or acceptance, so the subcontractor could not withdraw after the general used the bid to win the prime contract. The decision reversed the classical rule for bid cases and became the dominant American approach, later codified in Restatement (Second) of Contracts § 87(2).",
        sourceName:
          "Traynor J. Drennan v. Star Paving Co., 51 Cal.2d 409, 333 P.2d 757 (1958). Opinion of the Court.",
        sourceUrl:
          "https://law.justia.com/cases/california/supreme-court/2d/51/409.html",
      },
    ],
  },

  {
    id: "learned-hand-negligence-formula-1947",
    claim:
      "The negligence standard of care can be expressed algebraically: a defendant is negligent for failing to take a precaution whenever the burden of that precaution (B) is less than the probability of harm (P) multiplied by the gravity of the resulting injury (L) — the B < PL formula stated by Judge Learned Hand for the U.S. Court of Appeals for the Second Circuit in United States v. Carroll Towing Co. (9 January 1947).",
    emergedAt: "1947-01-09",
    claimType: "HYBRID",
    milestones: [
      {
        date: "1947-01-09",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "United States v. Carroll Towing Co. (159 F.2d 169, 2d Cir., 9 January 1947): assessing whether a barge owner was negligent for leaving a moored barge unattended, Judge Learned Hand reduced the duty of reasonable care to an algebraic relation — liability turns on whether the burden of taking a precaution (B) is less than the probability that harm will occur (P) multiplied by the magnitude of the resulting loss (L). The formulation recorded a cost-benefit conception of the negligence standard in a leading opinion; it became the canonical analytic statement of breach in American tort law and legal-economic scholarship, though it functions as an influential gloss on the reasonable-person standard rather than a universally binding test.",
        sourceName:
          "Hand L., J. United States v. Carroll Towing Co., 159 F.2d 169 (2d Cir. 1947). Opinion of the Court.",
        sourceUrl:
          "https://law.justia.com/cases/federal/appellate-courts/F2/159/169/",
      },
    ],
  },

  {
    id: "hard-look-arbitrary-capricious-review-1983",
    claim:
      "A federal court reviewing agency action under the APA's arbitrary-and-capricious standard must take a 'hard look,' and an agency rescinding an existing rule must supply a reasoned analysis that examines the relevant data and considers significant alternatives — the standard the U.S. Supreme Court settled in Motor Vehicle Manufacturers Ass'n v. State Farm Mutual Automobile Insurance Co., decided 24 June 1983.",
    emergedAt: "1971-03-02",
    milestones: [
      {
        date: "1971-03-02",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "Citizens to Preserve Overton Park, Inc. v. Volpe (401 U.S. 402, 2 March 1971): The Court held that although agency action carries a presumption of regularity, that presumption must 'not shield his action from a thorough, probing, in-depth review,' and directed courts to determine whether the agency's choice was 'arbitrary, capricious, an abuse of discretion, or otherwise not in accordance with law.' The decision recorded the searching 'hard look' conception of arbitrary-and-capricious review but did not yet fix how it applied to an agency's reversal of its own policy.",
        sourceName:
          "Marshall J. Citizens to Preserve Overton Park, Inc. v. Volpe, 401 U.S. 402 (1971). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/401/402",
      },
      {
        date: "1983-06-24",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Motor Vehicle Manufacturers Ass'n v. State Farm Mutual Automobile Insurance Co. (463 U.S. 29, 24 June 1983): A Court led by Justice White held that an agency rescinding a rule (here, the NHTSA passive-restraint standard) is judged by the same arbitrary-and-capricious standard as promulgation and 'is obligated to supply a reasoned analysis for the change,' faulting the agency for failing to consider an airbags-only alternative. The ruling settled 'hard look' review as the operative test for deregulatory action and became the canonical statement of arbitrary-and-capricious review of agency rulemaking.",
        sourceName:
          "White J. Motor Vehicle Mfrs. Ass'n v. State Farm Mutual Automobile Ins. Co., 463 U.S. 29 (1983). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/463/29",
      },
    ],
  },

  {
    id: "independent-agency-removal-protection-2020",
    claim:
      "Congress may shield the heads of independent federal agencies from at-will presidential removal by permitting removal only for cause — the separation-of-powers principle established by the U.S. Supreme Court in Humphrey's Executor v. United States (27 May 1935) and progressively constricted by Free Enterprise Fund v. PCAOB (28 June 2010) and Seila Law LLC v. CFPB (29 June 2020).",
    emergedAt: "1935-05-27",
    milestones: [
      {
        date: "1935-05-27",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Humphrey's Executor v. United States (295 U.S. 602, 27 May 1935): A unanimous Court upheld the FTC Act's provision limiting removal of commissioners to 'inefficiency, neglect of duty, or malfeasance in office,' reasoning that a quasi-legislative and quasi-judicial body may be insulated from presidential control. The decision cabined Myers v. United States and settled that Congress may create independent agencies whose heads enjoy for-cause tenure protection.",
        sourceName:
          "Sutherland J. Humphrey's Executor v. United States, 295 U.S. 602 (1935). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/295/602",
      },
      {
        date: "2010-06-28",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Free Enterprise Fund v. Public Company Accounting Oversight Board (561 U.S. 477, 28 June 2010): A 5–4 majority, per Chief Justice Roberts, held that two layers of for-cause removal protection — PCAOB members removable only for cause by SEC Commissioners who are themselves removable only for cause — 'contravene[d] the Constitution's separation of powers' by stripping the President of adequate control. By invalidating a removal structure built atop Humphrey's Executor, the Court reopened contestation over how far Congress may insulate agency officials from the President.",
        sourceName:
          "Roberts CJ. Free Enterprise Fund v. Public Company Accounting Oversight Board, 561 U.S. 477 (2010). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/08-861",
      },
      {
        date: "2020-06-29",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Seila Law LLC v. Consumer Financial Protection Bureau (591 U.S. 197, 29 June 2020): A 6–3 majority, per Chief Justice Roberts, held that vesting substantial executive power in a single CFPB Director removable only for cause violated the separation of powers, expressly declining to extend Humphrey's Executor (which it confined to multimember expert bodies) or Morrison v. Olson to this 'novel' structure. The ruling deepened the contest over Humphrey's Executor itself, leaving the foundational for-cause principle intact in name but doctrinally embattled and narrowed.",
        sourceName:
          "Roberts CJ. Seila Law LLC v. Consumer Financial Protection Bureau, 591 U.S. 197 (2020). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/19-7",
      },
    ],
  },

  {
    id: "public-rights-agency-adjudication-no-jury-1977",
    claim:
      "Congress may assign the adjudication of statutory 'public rights' civil-penalty claims to a federal administrative agency without a jury trial — the Seventh Amendment principle settled by the U.S. Supreme Court in Atlas Roofing Co. v. OSHRC (23 March 1977) and sharply narrowed by SEC v. Jarkesy (27 June 2024), which held that fraud-based civil penalties must be tried to a jury in an Article III court.",
    emergedAt: "1977-03-23",
    milestones: [
      {
        date: "1977-03-23",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Atlas Roofing Co. v. Occupational Safety and Health Review Commission (430 U.S. 442, 23 March 1977): A unanimous Court held that the Seventh Amendment 'does not prohibit Congress from assigning the factfinding function and initial adjudication to an administrative forum with which the jury would be incompatible' when Congress creates new statutory 'public rights.' The decision settled the constitutional foundation for agency in-house adjudication of civil penalties without juries, enabling the modern administrative-enforcement state.",
        sourceName:
          "White J. Atlas Roofing Co. v. Occupational Safety & Health Review Commission, 430 U.S. 442 (1977). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/430/442",
      },
      {
        date: "2024-06-27",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "SEC v. Jarkesy (603 U.S. 109, 27 June 2024): A 6–3 majority, per Chief Justice Roberts, held that when the SEC seeks civil penalties for securities fraud, the Seventh Amendment entitles the defendant to a jury trial in an Article III court, because the antifraud claims replicate common-law fraud and the penalty is a 'legal' remedy that falls outside the public-rights exception. By confining Atlas Roofing and requiring Article III juries for a broad class of agency penalty actions, the ruling destabilized the settled premise that Congress may route such adjudications to in-house ALJs.",
        sourceName:
          "Roberts CJ. Securities and Exchange Commission v. Jarkesy, 603 U.S. 109 (2024). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/22-859",
      },
    ],
  },

  {
    id: "apa-limitations-accrual-injury-2024",
    claim:
      "A plaintiff's facial challenge to a federal agency rule under the Administrative Procedure Act accrues under 28 U.S.C. § 2401(a) when the plaintiff is first injured by final agency action, not when the rule is promulgated — the rule the U.S. Supreme Court established in Corner Post, Inc. v. Board of Governors of the Federal Reserve System, decided 1 July 2024.",
    emergedAt: "2024-07-01",
    milestones: [
      {
        date: "2024-07-01",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Corner Post, Inc. v. Board of Governors of the Federal Reserve System (603 U.S. 799, 1 July 2024): A 6–3 majority, per Justice Barrett, held that an APA claim 'accrues' — and the six-year § 2401(a) limitations clock begins — only 'when the plaintiff is injured by final agency action,' not when the rule is issued, allowing a business that opened in 2018 to challenge a 2011 debit-interchange regulation. The decision displaced the longstanding contrary consensus of the courts of appeals and settled that later-arriving regulated parties retain a fresh window to bring facial APA challenges.",
        sourceName:
          "Barrett J. Corner Post, Inc. v. Board of Governors of the Federal Reserve System, 603 U.S. 799 (2024). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/22-1008",
      },
    ],
  },

  {
    id: "quia-emptores-free-alienation-1290",
    claim:
      "The Statute Quia Emptores (18 Edw. 1 c. 1), enacted by the Parliament of England at Westminster in 1290, established that every free tenant may freely alienate his lands in fee simple provided the purchaser holds directly of the chief lord by the same services, thereby permitting free substitution and abolishing further subinfeudation.",
    emergedAt: "1290-01-01",
    emergedPrecision: "YEAR",
    milestones: [
      {
        date: "1290-01-01",
        precision: "YEAR",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "INSTITUTIONAL",
        reason:
          "Before 1290, free tenants commonly alienated land by subinfeudation — creating new sub-tenures that deprived chief lords of feudal incidents such as wardship, marriage, and escheat — and the clash between tenants' desire to alienate and lords' claim to those incidents was unsettled. The Parliament of England resolved it in the Statute Quia Emptores by permitting free alienation through substitution while abolishing further subinfeudation, so that a purchaser held directly of the superior lord by the prior services. The Act settled the free alienability of the fee simple, a cornerstone of English and later American property law that remains in force.",
        sourceName:
          "Parliament of England. Statute Quia Emptores 1290, 18 Edw. 1 c. 1 (Westminster, 1290).",
        sourceUrl: "https://www.legislation.gov.uk/aep/Edw1/18/1",
      },
    ],
  },

  {
    id: "tenures-abolition-socage-1660",
    claim:
      "The Tenures Abolition Act 1660 (12 Cha. 2 c. 24), enacted by the English Parliament in 1660, abolished feudal military tenures — knight-service, tenure in capite, and the Court of Wards and Liveries with its incidents of wardship and marriage — and converted all such tenures into free and common socage.",
    emergedAt: "1660-01-01",
    emergedPrecision: "YEAR",
    milestones: [
      {
        date: "1660-01-01",
        precision: "YEAR",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "INSTITUTIONAL",
        reason:
          "Feudal tenures held of the Crown carried burdensome incidents — wardship of minor heirs, control of their marriages, and primer seisin — administered through the resented fiscal machinery of the Court of Wards and Liveries. In 1660 the English Parliament abolished these military tenures and the Court of Wards, converting them into free and common socage subject only to nominal services. The Act completed the transition of English landholding from feudal service tenure toward modern freehold ownership, and its core conversion to socage remains part of English property law.",
        sourceName:
          "Parliament of England. Tenures Abolition Act 1660, 12 Cha. 2 c. 24.",
        sourceUrl: "https://www.legislation.gov.uk/aep/Cha2/12/24",
      },
    ],
  },

  {
    id: "statute-of-frauds-writing-land-1677",
    claim:
      "The Statute of Frauds 1677 (29 Cha. 2 c. 3), enacted by the English Parliament in 1677, required that conveyances of and interests in land, and declarations of trust of land, be evidenced by a signed writing, rendering unwritten transfers of interests in land unenforceable.",
    emergedAt: "1677-01-01",
    emergedPrecision: "YEAR",
    milestones: [
      {
        date: "1677-01-01",
        precision: "YEAR",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "INSTITUTIONAL",
        reason:
          "Before 1677, interests in land could be created or transferred by parol livery of seisin and oral agreement, leaving titles vulnerable to fraud and perjured testimony about verbal grants. The Statute of Frauds required leases, assignments, surrenders, and declarations of trust concerning land to be in signed writing to be enforceable. It settled the durable rule — carried into American law and later re-enacted in the Law of Property Act 1925 — that transfers of interests in land must be documented in writing.",
        sourceName:
          "Parliament of England. Statute of Frauds 1677, 29 Cha. 2 c. 3 ('An Act for prevention of Frauds and Perjuryes').",
        sourceUrl: "https://www.legislation.gov.uk/aep/Cha2/29/3",
      },
    ],
  },

  {
    id: "northwest-ordinance-just-compensation-1787",
    claim:
      "The Northwest Ordinance, enacted by the Confederation Congress on 13 July 1787, guaranteed in Article 2 that no person in the Northwest Territory be deprived of property but by judgment of peers or the law of the land, and that full compensation be made whenever public exigencies required taking a person's property — the first codification of a just-compensation requirement for takings in United States federal organic law, predating the Fifth Amendment.",
    emergedAt: "1787-07-13",
    milestones: [
      {
        date: "1787-07-13",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "INSTITUTIONAL",
        reason:
          "Governing the territory north of the Ohio River, the Confederation Congress adopted a compact of fundamental 'articles' binding on the future states, Article 2 of which required 'full compensation' whenever public exigencies made it necessary to take private property. Enacted more than four years before the Fifth Amendment's Takings Clause was ratified on 15 December 1791, it placed a just-compensation guarantee into federal organic law for the first time. It recorded, as settled territorial law, the principle later constitutionalized nationally — that the sovereign owes compensation for property taken for public use.",
        sourceName:
          "Confederation Congress. An Ordinance for the Government of the Territory of the United States North-West of the River Ohio (Northwest Ordinance), 13 July 1787. Avalon Project, Yale Law School.",
        sourceUrl: "https://avalon.law.yale.edu/18th_century/nworder.asp",
      },
    ],
  },

  {
    id: "swift-tyson-federal-general-common-law-1842",
    claim:
      "The U.S. Supreme Court held in Swift v. Tyson (January Term 1842) that federal courts sitting in diversity are not bound by state courts' decisions on questions of general commercial law and may apply an independent 'general common law' — a doctrine overruled in Erie Railroad Co. v. Tompkins (25 April 1938), which declared there is no federal general common law.",
    emergedAt: "1842-01-01",
    emergedPrecision: "MONTH",
    milestones: [
      {
        date: "1842-01-01",
        precision: "MONTH",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Swift v. Tyson, 41 U.S. (16 Pet.) 1 (January Term 1842): Justice Story, for the Court, read the Rules of Decision Act's reference to 'the laws of the several states' to reach only local statutes and settled local usages, not judicial decisions on matters of general commercial law. Federal courts could therefore apply their own view of general commercial law — here, that a pre-existing debt makes one a bona fide holder of a negotiable instrument — creating a body of federal general common law that governed diversity cases for nearly a century.",
        sourceName:
          "Story J. Swift v. Tyson, 41 U.S. (16 Pet.) 1 (1842). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/41/1",
      },
      {
        date: "1938-04-25",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "Erie Railroad Co. v. Tompkins, 304 U.S. 64 (25 April 1938): Justice Brandeis, for the Court, expressly overruled Swift v. Tyson, holding that 'there is no federal general common law' and that except in matters governed by the Constitution or federal statutes, federal courts sitting in diversity must apply the substantive law of the state, whether declared by its legislature or its highest court. The decision reversed the Swift doctrine as both an erroneous construction of the Rules of Decision Act and an unconstitutional assumption of power.",
        sourceName:
          "Brandeis J. Erie Railroad Co. v. Tompkins, 304 U.S. 64 (1938). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/304/64",
      },
    ],
  },

  {
    id: "barron-bill-of-rights-states-1833",
    claim:
      "The U.S. Supreme Court held in Barron v. Baltimore (January Term 1833) that the Bill of Rights — specifically the Fifth Amendment's Just Compensation Clause — restrains only the federal government and not the states; that holding as to takings was reversed in Chicago, Burlington & Quincy Railroad Co. v. City of Chicago (1 March 1897), which required states to pay just compensation under the Fourteenth Amendment.",
    emergedAt: "1833-02-01",
    emergedPrecision: "MONTH",
    milestones: [
      {
        date: "1833-02-01",
        precision: "MONTH",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Barron v. Baltimore, 32 U.S. (7 Pet.) 243 (January Term 1833): Chief Justice Marshall, for the Court, held that the Fifth Amendment's guarantee that private property shall not be taken for public use without just compensation 'is intended solely as a limitation on the exercise of power by the government of the United States, and is not applicable to the legislation of the states.' The ruling settled that the Bill of Rights constrained only the federal government, leaving state action outside its reach and dismissing the suit for want of jurisdiction.",
        sourceName:
          "Marshall CJ. Barron v. Baltimore, 32 U.S. (7 Pet.) 243 (1833). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/32/243",
      },
      {
        date: "1897-03-01",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "Chicago, Burlington & Quincy Railroad Co. v. City of Chicago, 166 U.S. 226 (1 March 1897): Justice Harlan, for the Court, held that a state's taking of private property for public use without just compensation is 'wanting in the due process of law required by the Fourteenth Amendment.' By treating just compensation as an essential element of Fourteenth Amendment due process binding on the states, the decision reversed Barron's rule as applied to takings and became the first instance of incorporating a Bill of Rights guarantee against the states.",
        sourceName:
          "Harlan J. Chicago, Burlington & Quincy Railroad Co. v. City of Chicago, 166 U.S. 226 (1897). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/166/226",
      },
    ],
  },

  {
    id: "gibbons-ogden-commerce-clause-1824",
    claim:
      "The U.S. Supreme Court held in Gibbons v. Ogden (2 March 1824) that Congress's power to regulate interstate commerce is broad and extends to navigation, invalidating New York's steamboat monopoly; the reach of that power was narrowed in United States v. E.C. Knight Co. (1895) and then broadly reaffirmed in Wickard v. Filburn (1942).",
    emergedAt: "1824-03-02",
    milestones: [
      {
        date: "1824-03-02",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Gibbons v. Ogden, 22 U.S. (9 Wheat.) 1 (2 March 1824): Chief Justice Marshall, for the Court, held that the commerce power extends to the regulation of navigation and reaches commerce 'among the several states,' not stopping at a state's external boundary. The decision struck down New York's grant of an exclusive steamboat monopoly as repugnant to a federal coasting license, settling a broad conception of congressional authority over interstate commerce.",
        sourceName:
          "Marshall CJ. Gibbons v. Ogden, 22 U.S. (9 Wheat.) 1 (1824). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/22/1",
      },
      {
        date: "1895-01-21",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "United States v. E.C. Knight Co., 156 U.S. 1 (21 January 1895): Chief Justice Fuller, for the Court, held that a sugar-refining monopoly controlling roughly 98% of U.S. manufacture was beyond the Sherman Act's reach because 'commerce succeeds to manufacture, and is not a part of it.' By sharply distinguishing manufacturing from commerce and reserving the former to state police power, the decision cabined Gibbons's broad commerce power and left its scope contested for decades.",
        sourceName:
          "Fuller CJ. United States v. E.C. Knight Co., 156 U.S. 1 (1895). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/156/1",
      },
      {
        date: "1942-11-09",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Wickard v. Filburn, 317 U.S. 111 (9 November 1942): Justice Jackson, for a unanimous Court, upheld federal wheat-production quotas as applied to wheat a farmer grew for his own consumption, holding that even local, non-commercial activity may be reached if it exerts a 'substantial economic effect on interstate commerce' when aggregated. Abandoning the direct/indirect and manufacture/commerce distinctions, the decision restored and extended Gibbons's expansive commerce power, resettling the doctrine.",
        sourceName:
          "Jackson J. Wickard v. Filburn, 317 U.S. 111 (1942). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/317/111",
      },
    ],
  },

  {
    id: "griggs-disparate-impact-title-vii-1971",
    claim:
      "The U.S. Supreme Court held in Griggs v. Duke Power Co. (8 March 1971) that Title VII forbids facially neutral employment practices that have a disparate impact on protected groups unless justified by business necessity; the burden allocation was weakened in Wards Cove Packing Co. v. Atonio (1989) and then restored by the Civil Rights Act of 1991.",
    emergedAt: "1971-03-08",
    milestones: [
      {
        date: "1971-03-08",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Griggs v. Duke Power Co., 401 U.S. 424 (8 March 1971): Chief Justice Burger, for a unanimous Court, held that Title VII 'proscribes not only overt discrimination but also practices that are fair in form, but discriminatory in operation,' striking down high-school-diploma and testing requirements that disqualified Black applicants at higher rates and were not shown to be job-related. The ruling settled disparate-impact liability and the business-necessity standard as core employment-discrimination doctrine.",
        sourceName:
          "Burger CJ. Griggs v. Duke Power Co., 401 U.S. 424 (1971). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/401/424",
      },
      {
        date: "1989-06-05",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Wards Cove Packing Co. v. Atonio, 490 U.S. 642 (5 June 1989): a 5–4 Court held that a disparate-impact plaintiff bears the burden of persuasion on business justification at all times, recasting the employer's obligation as a mere burden of production rather than proof. By reallocating the burden away from the employer, the decision unsettled Griggs's framework and drew sharp criticism as a retreat from disparate-impact enforcement.",
        sourceName:
          "White J. Wards Cove Packing Co. v. Atonio, 490 U.S. 642 (1989). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/490/642",
      },
      {
        date: "1991-11-21",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "INSTITUTIONAL",
        reason:
          "Civil Rights Act of 1991 (Pub. L. 102-166, 105 Stat. 1071, enacted 21 November 1991): Congress codified disparate-impact liability in Title VII and, expressly responding to Wards Cove, placed the burden of persuasion on business necessity back on the employer and restored the pre-Wards Cove meaning of 'business necessity.' The statute overrode the Court's reallocation and re-settled the Griggs framework as a matter of legislative command.",
        sourceName:
          "U.S. Congress. Civil Rights Act of 1991, Pub. L. 102-166, 105 Stat. 1071 (1991).",
        sourceUrl: "https://www.govinfo.gov/app/details/STATUTE-105/STATUTE-105-Pg1071",
      },
    ],
  },

  {
    id: "loewe-lawlor-labor-antitrust-1908",
    claim:
      "The U.S. Supreme Court held in Loewe v. Lawlor (the Danbury Hatters case, 3 February 1908) that the Sherman Antitrust Act applies to labor unions whose secondary boycotts restrain interstate trade; Congress attempted a labor exemption in the Clayton Act (1914), the Court narrowly construed it in Duplex Printing Press Co. v. Deering (1921), and a broad statutory labor exemption was finally recognized in United States v. Hutcheson (1941).",
    emergedAt: "1908-02-03",
    milestones: [
      {
        date: "1908-02-03",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Loewe v. Lawlor, 208 U.S. 274 (3 February 1908): Chief Justice Fuller, for the Court, held that a nationwide union boycott aimed at forcing a hat manufacturer to unionize was a 'combination in restraint of trade or commerce among the several states' within the Sherman Act, rejecting any implied labor exemption. The ruling settled that unions were subject to federal antitrust liability, later exposing individual members to treble damages.",
        sourceName:
          "Fuller CJ. Loewe v. Lawlor, 208 U.S. 274 (1908). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/208/274",
      },
      {
        date: "1914-10-15",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "INSTITUTIONAL",
        reason:
          "Clayton Antitrust Act, § 6 (38 Stat. 730, enacted 15 October 1914; 15 U.S.C. § 17): Congress declared that 'the labor of a human being is not a commodity or article of commerce' and that the antitrust laws shall not forbid the existence and operation of labor organizations or hold them to be illegal combinations in restraint of trade. Hailed by Samuel Gompers as labor's 'Magna Carta,' the provision was intended to override Loewe and open to contestation whether unions remained subject to the Sherman Act.",
        sourceName:
          "U.S. Congress. Clayton Antitrust Act § 6, 38 Stat. 730 (1914), codified at 15 U.S.C. § 17.",
        sourceUrl: "https://www.law.cornell.edu/uscode/text/15/17",
      },
      {
        date: "1921-01-03",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Duplex Printing Press Co. v. Deering, 254 U.S. 443 (3 January 1921): Justice Pitney, for the Court, narrowly construed the Clayton Act's labor provisions to protect only parties 'proximately and substantially concerned as parties to an actual dispute respecting the terms or conditions of their own employment,' leaving secondary boycotts subject to antitrust liability and injunction. The decision gutted the hoped-for exemption and re-settled that unions remained reachable under the Sherman Act.",
        sourceName:
          "Pitney J. Duplex Printing Press Co. v. Deering, 254 U.S. 443 (1921). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/254/443",
      },
      {
        date: "1941-02-03",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "United States v. Hutcheson, 312 U.S. 219 (3 February 1941): Justice Frankfurter, for the Court, read the Clayton Act and the Norris-LaGuardia Act together to grant labor a broad statutory exemption, holding that peaceful union self-interest activity — strikes, picketing, and boycotts — falls outside the Sherman Act so long as the union does not combine with non-labor groups. The decision reversed the Loewe–Duplex line and established the modern statutory labor exemption from federal antitrust law.",
        sourceName:
          "Frankfurter J. United States v. Hutcheson, 312 U.S. 219 (1941). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/312/219",
      },
    ],
  },

  {
    id: "foreign-affairs-sole-organ-curtiss-wright-1936",
    claim:
      "The U.S. Supreme Court held in United States v. Curtiss-Wright Export Corp., decided 21 December 1936, that the federal government's power over external affairs is inherent in national sovereignty rather than derived solely from enumerated powers, that the President is the 'sole organ' of the nation in foreign relations, and that Congress may delegate broader discretion to the President in the foreign than in the domestic sphere.",
    emergedAt: "1936-12-21",
    milestones: [
      {
        date: "1936-12-21",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In United States v. Curtiss-Wright Export Corp. (299 U.S. 304), Justice Sutherland, for the Court, upheld Congress's delegation to the President of authority to embargo arms sales to Bolivia and Paraguay. The opinion held that sovereignty over external affairs vested in the national government as a whole (not carved from the states), that the President is 'the sole organ of the nation in its external relations,' and that delegation doctrine is relaxed in the foreign-affairs field, settling a broad conception of inherent and largely unreviewable executive foreign-affairs power.",
        sourceName:
          "Sutherland J. United States v. Curtiss-Wright Export Corp., 299 U.S. 304 (1936). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/299/304",
      },
      {
        date: "2015-06-08",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "In Zivotofsky v. Kerry (576 U.S. 1), Justice Kennedy, for the Court, expressly declined to endorse Curtiss-Wright's 'sole organ' formulation, characterizing its sweeping description of presidential supremacy as dictum 'not necessary to the holding' and refusing to acknowledge 'unbounded power' free from Congress's lawmaking authority in international relations. By repudiating the doctrinal foundation on which decades of executive-power arguments had rested, the decision reopened the scope of inherent presidential foreign-affairs power as contested.",
        sourceName:
          "Kennedy J. Zivotofsky v. Kerry, 576 U.S. 1 (2015). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/13-628",
      },
    ],
  },

  {
    id: "act-of-state-doctrine-underhill-1897",
    claim:
      "The U.S. Supreme Court held in Underhill v. Hernandez, decided 29 November 1897, that the courts of one country will not sit in judgment on the acts of the government of another sovereign done within its own territory, establishing the act of state doctrine in American law.",
    emergedAt: "1897-11-29",
    milestones: [
      {
        date: "1897-11-29",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Underhill v. Hernandez (168 U.S. 250), Chief Justice Fuller, for a unanimous Court, dismissed a U.S. citizen's damages suit against a Venezuelan revolutionary general for acts done while consolidating a recognized government, holding that 'every sovereign state is bound to respect the independence of every other sovereign state, and the courts of one country will not sit in judgment on the acts of the government of another done within its own territory.' The ruling settled the act of state doctrine as a rule of judicial abstention.",
        sourceName:
          "Fuller C.J. Underhill v. Hernandez, 168 U.S. 250 (1897). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/168/250",
      },
      {
        date: "1964-03-23",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Banco Nacional de Cuba v. Sabbatino (376 U.S. 398), Justice Harlan, for the Court, reaffirmed the act of state doctrine while relocating its foundation from international comity to the constitutional separation of powers and federal common law, holding that U.S. courts will not examine the validity of Cuba's expropriation of property within its territory. The decision re-settled and modernized Underhill's rule, confirming its continued force even as it prompted Congress's partial Second Hickenlooper Amendment response.",
        sourceName:
          "Harlan J. Banco Nacional de Cuba v. Sabbatino, 376 U.S. 398 (1964). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/376/398",
      },
    ],
  },

  {
    id: "foreign-judgment-comity-reciprocity-hilton-guyot-1895",
    claim:
      "The U.S. Supreme Court held in Hilton v. Guyot, decided 3 June 1895, that recognition of foreign judgments rests on international comity, that such judgments are generally conclusive only where the foreign nation would give reciprocal effect to American judgments, and that absent reciprocity a foreign judgment is merely prima facie evidence subject to reexamination.",
    emergedAt: "1895-06-03",
    milestones: [
      {
        date: "1895-06-03",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Hilton v. Guyot (159 U.S. 113), Justice Gray, for the Court, framed the enforcement of foreign judgments as a matter of comity — 'the recognition which one nation allows within its territory to the legislative, executive, or judicial acts of another' — and held that conclusive effect depends on reciprocal recognition by the foreign forum, so that a French judgment against U.S. citizens was only prima facie evidence. The ruling settled comity and a reciprocity requirement as the governing federal framework.",
        sourceName:
          "Gray J. Hilton v. Guyot, 159 U.S. 113 (1895). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/159/113",
      },
      {
        date: "1938-04-25",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "In Erie Railroad Co. v. Tompkins (304 U.S. 64), Justice Brandeis, for the Court, abolished general federal common law and held that 'there is no federal general common law,' so that recognition of foreign judgments in diversity became a question of state rather than uniform federal law. Because state courts (led by New York) had already declined to follow Hilton's reciprocity requirement, Erie unsettled Hilton's status as a binding national rule, leaving the reciprocity element contested and non-uniform across U.S. jurisdictions.",
        sourceName:
          "Brandeis J. Erie Railroad Co. v. Tompkins, 304 U.S. 64 (1938). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/304/64",
      },
    ],
  },

  {
    id: "extradition-doctrine-of-specialty-rauscher-1886",
    claim:
      "The U.S. Supreme Court held in United States v. Rauscher, decided 6 December 1886, that a person surrendered to the United States under an extradition treaty may be tried only for the offense for which extradition was granted, establishing the doctrine of specialty as an enforceable limit implied in extradition treaties.",
    emergedAt: "1886-12-06",
    milestones: [
      {
        date: "1886-12-06",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In United States v. Rauscher (119 U.S. 407), Justice Miller, for the Court, held that a fugitive extradited from Great Britain on a murder charge could not be tried for a different offense (cruel and unusual punishment of the victim), because 'a person who has been brought within the jurisdiction of the court by virtue of proceedings under an extradition treaty can only be tried for one of the offenses described in that treaty.' The ruling settled the doctrine of specialty in American extradition law.",
        sourceName:
          "Miller J. United States v. Rauscher, 119 U.S. 407 (1886). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/119/407",
      },
      {
        date: "1992-06-15",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In United States v. Alvarez-Machain (504 U.S. 655), Chief Justice Rehnquist, for the Court, held that a forcible abduction of a defendant from Mexico did not violate the extradition treaty and did not bar prosecution, while expressly distinguishing and reaffirming Rauscher: the doctrine of specialty governs when a defendant is delivered through the treaty's extradition process. The decision confirmed Rauscher's continued authority for formal extraditions by marking the boundary between treaty-based surrender and extra-treaty abduction.",
        sourceName:
          "Rehnquist C.J. United States v. Alvarez-Machain, 504 U.S. 655 (1992). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/504/655",
      },
    ],
  },

  {
    id: "territorial-incorporation-insular-downes-bidwell-1901",
    claim:
      "The U.S. Supreme Court held in Downes v. Bidwell, decided 27 May 1901, that Puerto Rico, acquired by the Treaty of Paris, was a territory 'belonging to' but not 'a part of' the United States within the Constitution's revenue clauses, so that Congress could impose duties on its goods without observing the uniformity requirement — the origin of the doctrine that the Constitution does not fully follow the flag to unincorporated territories.",
    emergedAt: "1901-05-27",
    milestones: [
      {
        date: "1901-05-27",
        precision: "DAY",
        fromAxis: null,
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "In Downes v. Bidwell (182 U.S. 244), a fractured 5–4 Court upheld the Foraker Act's duties on Puerto Rican goods, but produced no majority opinion: Justice Brown announced the judgment while Justice White's concurrence advanced the 'territorial incorporation' theory. Because the controlling rationale rested only in a concurrence, the constitutional status of newly acquired territories was left genuinely unsettled and openly contested among the Justices.",
        sourceName:
          "Brown J. (judgment); White J. (concurring). Downes v. Bidwell, 182 U.S. 244 (1901).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/182/244",
      },
      {
        date: "1922-04-10",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Balzac v. Porto Rico (258 U.S. 298), Chief Justice Taft, for the Court, adopted the territorial incorporation doctrine as the Court's governing rule, holding that Puerto Rico remained unincorporated even after the 1917 Jones Act and that unincorporated territories receive only 'fundamental' constitutional guarantees (denying a jury-trial right). By converting White's Downes concurrence into a majority holding, Balzac settled the incorporation doctrine.",
        sourceName:
          "Taft C.J. Balzac v. Porto Rico, 258 U.S. 298 (1922). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/258/298",
      },
      {
        date: "2022-04-21",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "In United States v. Vaello Madero (596 U.S. 159), the Court decided the case without relying on the Insular Cases, but Justice Gorsuch's concurrence declared that the Insular Cases 'have no foundation in the Constitution and rest instead on racial stereotypes' and urged the Court to overrule them, while Justice Sotomayor separately criticized them. With Justices openly calling for their abandonment, the incorporation doctrine's continued validity returned to active contestation.",
        sourceName:
          "Gorsuch J. (concurring). United States v. Vaello Madero, 596 U.S. 159 (2022).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/20-303",
      },
    ],
  },

  {
    id: "bostock-title-vii-sexual-orientation-gender-identity-2020",
    claim:
      "The U.S. Supreme Court held in Bostock v. Clayton County (590 U.S. 644, decided 15 June 2020) that Title VII of the Civil Rights Act of 1964's prohibition on employment discrimination 'because of sex' necessarily encompasses discrimination based on an individual's sexual orientation or gender identity.",
    emergedAt: "2017-04-04",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "2017-04-04",
        precision: "DAY",
        fromAxis: null,
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "The Seventh Circuit, sitting en banc in Hively v. Ivy Tech Community College (853 F.3d 339), held that discrimination on the basis of sexual orientation violates Title VII, breaking with decades of appellate precedent to the contrary. This created an open circuit split with the Eleventh Circuit's contemporaneous Evans v. Georgia Regional Hospital, converting a long-settled negative reading of Title VII into a genuinely contested federal question ripe for Supreme Court review.",
        sourceName:
          "U.S. Court of Appeals for the Seventh Circuit (en banc). Hively v. Ivy Tech Community College. 853 F.3d 339. 2017.",
        sourceUrl: "https://en.wikipedia.org/wiki/Hively_v._Ivy_Tech_Community_College",
        methodologyType: "derivative",
      },
      {
        date: "2020-06-15",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "A 6–3 Supreme Court majority per Justice Gorsuch resolved the circuit split, holding that an employer who fires an individual merely for being homosexual or transgender discriminates 'because of sex' in violation of Title VII. The textualist reasoning settled the statutory question nationwide and extended federal employment protection to LGBT workers.",
        sourceName:
          "Supreme Court of the United States. Bostock v. Clayton County. 590 U.S. 644. 2020.",
        sourceUrl: "https://www.supremecourt.gov/opinions/19pdf/17-1618_hfci.pdf",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "partial-birth-ban-health-exception-unconstitutional-2000",
    claim:
      "The U.S. Supreme Court held in Stenberg v. Carhart (530 U.S. 914, decided 28 June 2000) that a statutory ban on the 'partial-birth' (intact D&E) abortion procedure is unconstitutional where it lacks an exception to preserve the woman's health, a rule the Court effectively abandoned seven years later in Gonzales v. Carhart.",
    emergedAt: "2000-06-28",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "2000-06-28",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "A 5–4 majority per Justice Breyer struck down Nebraska's partial-birth abortion ban because it lacked any exception for the woman's health and was drafted broadly enough to reach the more common D&E procedure. The decision settled, under the Casey undue-burden framework, that such bans require a health exception.",
        sourceName:
          "Supreme Court of the United States. Stenberg v. Carhart. 530 U.S. 914. 2000.",
        sourceUrl: "https://en.wikipedia.org/wiki/Stenberg_v._Carhart",
        methodologyType: "derivative",
      },
      {
        date: "2007-04-18",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "A 5–4 majority per Justice Kennedy in Gonzales v. Carhart (550 U.S. 124) upheld the federal Partial-Birth Abortion Ban Act of 2003 despite its lack of a health exception, formally 'distinguishing' but in practical effect reversing Stenberg's rule. The Court held that facial invalidation for want of a health exception was inappropriate where medical uncertainty existed, marking a decisive doctrinal shift toward permitting abortion-method bans.",
        sourceName:
          "Supreme Court of the United States. Gonzales v. Carhart. 550 U.S. 124. 2007.",
        sourceUrl: "https://www.law.cornell.edu/supct/html/05-380.ZS.html",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "undue-burden-benefit-cost-balancing-hellerstedt-2016",
    claim:
      "The U.S. Supreme Court held in Whole Woman's Health v. Hellerstedt (579 U.S. 582, decided 27 June 2016) that Texas's HB2 admitting-privileges and ambulatory-surgical-center requirements imposed an unconstitutional undue burden, and that courts applying the undue-burden standard must independently weigh a law's asserted health benefits against the burdens it imposes on abortion access.",
    emergedAt: "2016-06-27",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "2016-06-27",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "A 5–3 majority per Justice Breyer struck down both Texas HB2 provisions, rejecting deferential rational-basis review and holding that courts must balance a regulation's genuine health benefits against the obstacles it places before women seeking pre-viability abortions. This settled a benefit-burden balancing gloss on Casey's undue-burden test and invalidated the TRAP-law model nationwide.",
        sourceName:
          "Supreme Court of the United States. Whole Woman's Health v. Hellerstedt. 579 U.S. 582. 2016.",
        sourceUrl: "https://en.wikipedia.org/wiki/Whole_Woman%27s_Health_v._Hellerstedt",
        methodologyType: "derivative",
      },
      {
        date: "2022-06-24",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "In Dobbs v. Jackson Women's Health Organization (597 U.S. 215) the Court overruled Roe and Casey and eliminated the constitutional right to abortion, thereby repudiating the entire undue-burden framework — including Hellerstedt's benefit-burden balancing test — which has not been good law since. The balancing standard was left with no constitutional foundation to operate on.",
        sourceName:
          "Supreme Court of the United States. Dobbs v. Jackson Women's Health Organization. 597 U.S. 215. 2022.",
        sourceUrl: "https://en.wikipedia.org/wiki/Dobbs_v._Jackson_Women%27s_Health_Organization",
        methodologyType: "derivative",
      },
    ],
  },

  {
    id: "parental-termination-clear-and-convincing-evidence-1982",
    claim:
      "The U.S. Supreme Court held in Santosky v. Kramer (455 U.S. 745, decided 24 March 1982) that the Due Process Clause of the Fourteenth Amendment requires a State to support its allegations by at least clear and convincing evidence before it may permanently terminate the rights of natural parents in their child.",
    emergedAt: "1982-03-24",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1982-03-24",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "A 5–4 majority per Justice Blackmun struck down New York's 'fair preponderance of the evidence' standard for parental-rights termination, holding that the fundamental liberty interest of natural parents in the care and custody of their children demands a heightened clear-and-convincing burden of proof. The decision set the constitutional floor for evidentiary standards in state termination proceedings and remains controlling law.",
        sourceName:
          "Supreme Court of the United States. Santosky v. Kramer. 455 U.S. 745. 1982.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/455/745",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "clear-and-present-danger-to-imminent-lawless-action-1919",
    claim:
      "The U.S. Supreme Court held in Schenck v. United States (249 U.S. 47, decided 3 March 1919) that speech may be criminally punished when the words create a 'clear and present danger' of bringing about substantive evils Congress has a right to prevent.",
    emergedAt: "1919-03-03",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1919-03-03",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Schenck v. United States, a unanimous Court per Justice Holmes upheld Espionage Act convictions and announced that the First Amendment does not protect speech creating a 'clear and present danger' of substantive evils. The formulation became the governing test for subversive-advocacy prosecutions and was reinforced in Whitney v. California (1927), establishing a permissive standard under which mere advocacy could be punished.",
        sourceName:
          "Supreme Court of the United States. Schenck v. United States. 249 U.S. 47. 1919.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/249/47",
        methodologyType: "primary",
      },
      {
        date: "1969-06-09",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "In Brandenburg v. Ohio (395 U.S. 444), a per curiam Court held that the state may not punish advocacy unless it is 'directed to inciting or producing imminent lawless action and is likely to incite or produce such action,' and expressly overruled Whitney v. California. This replaced the more permissive clear-and-present-danger standard with the far more speech-protective imminent-lawless-action test.",
        sourceName:
          "Supreme Court of the United States. Brandenburg v. Ohio. 395 U.S. 444. 1969.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/395/444",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "lemon-establishment-clause-test-1971",
    claim:
      "The U.S. Supreme Court held in Lemon v. Kurtzman (403 U.S. 602, decided 28 June 1971) that a law survives the Establishment Clause only if it has a secular purpose, a primary effect that neither advances nor inhibits religion, and does not foster excessive government entanglement with religion.",
    emergedAt: "1971-06-28",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1971-06-28",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Lemon v. Kurtzman the Court struck down state salary supplements to religious-school teachers and articulated a three-part test (secular purpose, primary secular effect, no excessive entanglement) for Establishment Clause challenges. For decades the 'Lemon test' became the dominant framework for church-state disputes over aid, displays, and school programs.",
        sourceName:
          "Supreme Court of the United States. Lemon v. Kurtzman. 403 U.S. 602. 1971.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/403/602",
        methodologyType: "primary",
      },
      {
        date: "2022-06-27",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "ABANDONED",
        community: "JUDICIAL",
        reason:
          "In Kennedy v. Bremerton School District (597 U.S. 507), a 6–3 Court ruled for a public-school football coach who prayed on the field and declared that it had 'long ago abandoned' the Lemon test as 'abstract' and 'ahistorical.' The Court instructed that the Establishment Clause must instead be interpreted by reference to 'historical practices and understandings,' formally retiring Lemon without a single overruling case.",
        sourceName:
          "Supreme Court of the United States. Kennedy v. Bremerton School District. 597 U.S. 507. 2022.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/21-418",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "free-exercise-compelling-interest-to-neutral-law-1963",
    claim:
      "The U.S. Supreme Court held in Sherbert v. Verner (374 U.S. 398, decided 17 June 1963) that government may substantially burden religious exercise only if it shows a compelling state interest pursued by the least restrictive means.",
    emergedAt: "1963-06-17",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1963-06-17",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Sherbert v. Verner the Court held that denying unemployment benefits to a Seventh-day Adventist who would not work on Saturday violated free exercise, and required the state to justify burdens on religion with a compelling interest. This 'Sherbert test' governed free-exercise adjudication and was extended in Wisconsin v. Yoder (1972).",
        sourceName:
          "Supreme Court of the United States. Sherbert v. Verner. 374 U.S. 398. 1963.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/374/398",
        methodologyType: "primary",
      },
      {
        date: "1990-04-17",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "In Employment Division v. Smith (494 U.S. 872), the Court per Justice Scalia held that neutral, generally applicable laws that incidentally burden religion (there, a peyote ban applied to sacramental use) need not satisfy the compelling-interest test. This displaced Sherbert's strict-scrutiny regime and prompted Congress to enact RFRA (1993) in response.",
        sourceName:
          "Supreme Court of the United States. Employment Division v. Smith. 494 U.S. 872. 1990.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/494/872",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "actual-malice-public-official-defamation-1964",
    claim:
      "The U.S. Supreme Court held in New York Times Co. v. Sullivan (376 U.S. 254, decided 9 March 1964) that a public official may not recover damages for a defamatory falsehood about his official conduct unless he proves the statement was made with 'actual malice' — knowledge of falsity or reckless disregard for the truth.",
    emergedAt: "1964-03-09",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1964-03-09",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In New York Times Co. v. Sullivan the Court unanimously reversed an Alabama libel judgment and constitutionalized defamation law, requiring public officials to prove 'actual malice.' The rule was extended to public figures in Curtis Publishing Co. v. Butts (1967) and became bedrock First Amendment press doctrine for over half a century.",
        sourceName:
          "Supreme Court of the United States. New York Times Co. v. Sullivan. 376 U.S. 254. 1964.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/376/254",
        methodologyType: "primary",
      },
      {
        date: "2019-02-19",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "In a concurrence to the denial of certiorari in McKee v. Cosby (586 U.S. ___), Justice Thomas urged the Court to reconsider Sullivan and its progeny, calling them 'policy-driven decisions masquerading as constitutional law.' Joined later by Justice Gorsuch in Berisha v. Lawson (2021), this reopened the question of the actual-malice standard's constitutional footing, moving a long-settled doctrine into active contestation on the Court.",
        sourceName:
          "Thomas, J., concurring. McKee v. Cosby, 586 U.S. ___ (No. 17-1542), denial of certiorari. 2019.",
        sourceUrl: "https://www.supremecourt.gov/opinions/18pdf/17-1542_ihdk.pdf",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "school-prayer-establishment-clause-engel-1962",
    claim:
      "The U.S. Supreme Court held in Engel v. Vitale (370 U.S. 421, decided 25 June 1962) that a state-composed, state-sponsored prayer recited in public schools violates the Establishment Clause, even when participation is voluntary.",
    emergedAt: "1962-06-25",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1962-06-25",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Engel v. Vitale the Court held 6–1 that New York's Regents' Prayer program breached the Establishment Clause, declaring it 'no part of the business of government to compose official prayers.' The ruling established that government-directed devotional exercises in public schools are unconstitutional.",
        sourceName:
          "Supreme Court of the United States. Engel v. Vitale. 370 U.S. 421. 1962.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/370/421",
        methodologyType: "primary",
      },
      {
        date: "1963-06-17",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "One year later, Abington School District v. Schempp (374 U.S. 203) extended and cemented Engel by striking down state-mandated Bible reading and the Lord's Prayer in public schools, articulating a secular-purpose-and-effect standard. Together the two decisions durably settled the prohibition on state-sponsored public-school devotional exercises, a rule reaffirmed through Lee v. Weisman (1992) and Santa Fe v. Doe (2000).",
        sourceName:
          "Supreme Court of the United States. Abington School District v. Schempp. 374 U.S. 203. 1963.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/374/203",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "expressive-vendor-first-amendment-same-sex-wedding-303creative-2023",
    claim:
      "The U.S. Supreme Court held in 303 Creative LLC v. Elenis (600 U.S. 570, decided 30 June 2023) that the First Amendment's free-speech guarantee bars a State from compelling a business offering expressive, custom services to create speech — such as same-sex wedding websites — that conveys a message the creator disagrees with, resolving a question the Court had earlier left open in Masterpiece Cakeshop.",
    emergedAt: "2018-06-04",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "2018-06-04",
        precision: "DAY",
        fromAxis: null,
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "In Masterpiece Cakeshop v. Colorado Civil Rights Commission (584 U.S. 617) a 7–2 Court ruled narrowly for the baker on religious-neutrality grounds while explicitly declining to decide whether public-accommodation laws may compel creative services for same-sex weddings, stating the question 'must await further elaboration in the courts.' This left the compelled-speech-versus-antidiscrimination conflict openly unresolved.",
        sourceName:
          "Supreme Court of the United States. Masterpiece Cakeshop v. Colorado Civil Rights Commission. 584 U.S. 617. 2018.",
        sourceUrl: "https://en.wikipedia.org/wiki/Masterpiece_Cakeshop_v._Colorado_Civil_Rights_Commission",
        methodologyType: "derivative",
      },
      {
        date: "2023-06-30",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "A 6–3 majority per Justice Gorsuch held that Colorado could not use its public-accommodation law to force a website designer to create custom expressive designs celebrating same-sex marriage, because the First Amendment protects against compelled speech even for commercial expressive services. The ruling settled the question Masterpiece had reserved, carving a free-speech limit on antidiscrimination law as applied to expressive vendors.",
        sourceName:
          "Supreme Court of the United States. 303 Creative LLC v. Elenis. 600 U.S. 570. 2023.",
        sourceUrl: "https://en.wikipedia.org/wiki/303_Creative_LLC_v._Elenis",
        methodologyType: "derivative",
      },
    ],
  },

  {
    id: "double-jeopardy-incorporation-palko-benton-1937",
    claim:
      "The U.S. Supreme Court held in Palko v. Connecticut (302 U.S. 319, decided 6 December 1937) that the Fifth Amendment's guarantee against double jeopardy is not binding on the states through the Fourteenth Amendment because it is not among the rights 'of the very essence of a scheme of ordered liberty' — a holding overruled by Benton v. Maryland (395 U.S. 784, 23 June 1969).",
    emergedAt: "1937-12-06",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1937-12-06",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Palko v. Connecticut the Court, per Justice Cardozo, held that Connecticut could retry and secure a first-degree conviction after appealing an acquittal-adjacent verdict without violating the Fourteenth Amendment, because the double jeopardy guarantee is not 'implicit in the concept of ordered liberty.' The decision settled the selective-incorporation framework and squarely held the double jeopardy clause did not bind the states.",
        sourceName: "Cardozo J. Palko v. Connecticut, 302 U.S. 319 (1937). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/302/319",
      },
      {
        date: "1969-06-23",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "In Benton v. Maryland the Court, per Justice Marshall, held that 'the Double Jeopardy Clause of the Fifth Amendment is applicable to the States through the Fourteenth Amendment' and expressly declared that 'insofar as it is inconsistent with this holding, Palko v. Connecticut is overruled.' The ruling reversed Palko and rejected its 'watered-down' approach to state application of Bill of Rights guarantees.",
        sourceName: "Marshall J. Benton v. Maryland, 395 U.S. 784 (1969). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/395/784",
      },
    ],
  },

  {
    id: "self-incrimination-incorporation-malloy-1964",
    claim:
      "The U.S. Supreme Court held in Twining v. New Jersey (211 U.S. 78, 9 November 1908) and again in Adamson v. California (332 U.S. 46, 23 June 1947) that the Fifth Amendment privilege against self-incrimination does not bind the states — a rule overruled by Malloy v. Hogan (378 U.S. 1, 15 June 1964), which incorporated the privilege against the states through the Fourteenth Amendment.",
    emergedAt: "1908-11-09",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1908-11-09",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Twining v. New Jersey the Court held that the exemption from compulsory self-incrimination is neither a privilege or immunity of national citizenship nor a due-process requirement binding on the states, allowing New Jersey to permit adverse comment on a defendant's failure to testify. This settled that the Fifth Amendment privilege was a matter of state, not federal constitutional, law.",
        sourceName: "Moody J. Twining v. New Jersey, 211 U.S. 78 (1908). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/211/78",
      },
      {
        date: "1947-06-23",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "In Adamson v. California a 5–4 Court reaffirmed Twining, holding California could comment on a defendant's silence because the self-incrimination privilege was not protected against the states. But Justice Black's landmark dissent, joined by three justices, argued the Fourteenth Amendment was intended to incorporate the entire Bill of Rights against the states — opening a sustained doctrinal contest over selective versus total incorporation.",
        sourceName: "Reed J. (Black J., dissenting). Adamson v. California, 332 U.S. 46 (1947).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/332/46",
      },
      {
        date: "1964-06-15",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "In Malloy v. Hogan the Court expressly reconsidered and overruled Twining and Adamson, holding that 'the Fifth Amendment's exception from compulsory self-incrimination is also protected by the Fourteenth Amendment against abridgment by the States.' The decision incorporated the privilege and applied the same federal standard to state proceedings, resolving the contest in favor of incorporation.",
        sourceName: "Brennan J. Malloy v. Hogan, 378 U.S. 1 (1964). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/378/1",
      },
    ],
  },

  {
    id: "jury-trial-incorporation-duncan-1968",
    claim:
      "The U.S. Supreme Court held in Duncan v. Louisiana (391 U.S. 145, decided 20 May 1968) that the Sixth Amendment right to trial by jury in serious criminal cases is fundamental and binding on the states through the Fourteenth Amendment, overturning the earlier rule of Maxwell v. Dow (176 U.S. 581, 1900) that jury trial was not a required incident of state criminal procedure.",
    emergedAt: "1900-02-26",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1900-02-26",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Maxwell v. Dow the Court held that neither the Privileges and Immunities Clause nor the Due Process Clause of the Fourteenth Amendment required states to provide trial by a twelve-person jury, upholding Utah's use of an eight-member jury and a prosecution by information. This settled that the Sixth Amendment jury-trial guarantee did not bind the states.",
        sourceName: "Peckham J. Maxwell v. Dow, 176 U.S. 581 (1900). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/176/581",
      },
      {
        date: "1968-05-20",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "In Duncan v. Louisiana the Court held that 'trial by jury in criminal cases is fundamental to the American scheme of justice' and is guaranteed by the Fourteenth Amendment in all state criminal cases that would fall within the Sixth Amendment if tried federally, reversing a conviction for a crime carrying a two-year maximum. The ruling overturned the Maxwell v. Dow position and incorporated the jury-trial right against the states.",
        sourceName: "White J. Duncan v. Louisiana, 391 U.S. 145 (1968). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/391/145",
      },
    ],
  },

  {
    id: "contract-clause-state-grant-fletcher-peck-1810",
    claim:
      "The U.S. Supreme Court held in Fletcher v. Peck (10 U.S. (6 Cranch) 87, decided March 1810) that a state legislature cannot constitutionally rescind a completed land grant because doing so impairs the obligation of contracts under Article I, Section 10 — the first time the Court struck down a state statute as unconstitutional.",
    emergedAt: "1810-03-16",
    emergedPrecision: "MONTH",
    milestones: [
      {
        date: "1810-03-16",
        precision: "MONTH",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Fletcher v. Peck, arising from the Yazoo land fraud, Chief Justice Marshall held that Georgia's 1796 repeal of an earlier land grant could not divest title held by innocent purchasers, because an executed grant is a contract and the Contract Clause bars states from impairing it. This was the first Supreme Court decision invalidating a state law as unconstitutional, establishing the Contract Clause as a robust limit on state legislative power.",
        sourceName: "Marshall CJ. Fletcher v. Peck, 10 U.S. (6 Cranch) 87 (1810). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/10/87",
      },
      {
        date: "1934-01-08",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "In Home Building & Loan Association v. Blaisdell the Court, per Chief Justice Hughes, upheld Minnesota's Depression-era mortgage moratorium against a Contract Clause challenge, reasoning that an emergency may furnish the occasion for temporary, reasonable restraints on contract enforcement to protect community welfare. By subordinating the Fletcher-era absolutism to the state's reserved police power, Blaisdell reopened contestation over how far the Contract Clause constrains state economic regulation.",
        sourceName: "Hughes CJ. Home Building & Loan Association v. Blaisdell, 290 U.S. 398 (1934). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/290/398",
      },
    ],
  },

  {
    id: "scotus-appellate-review-of-state-courts-martin-1816",
    claim:
      "The U.S. Supreme Court held in Martin v. Hunter's Lessee (14 U.S. (1 Wheat.) 304, decided 20 March 1816) that Section 25 of the Judiciary Act of 1789 is constitutional and that the Court has appellate jurisdiction to review and reverse the judgments of state courts on questions of federal law.",
    emergedAt: "1816-03-20",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1816-03-20",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "After the Virginia Court of Appeals defied the Supreme Court's earlier judgment and denied it any power to review state courts, Justice Story held that the appellate power of the United States extends to cases pending in state courts and that Section 25 of the Judiciary Act of 1789 was supported by the letter and spirit of the Constitution. The decision established the Supreme Court's supremacy over state courts on federal questions, essential to uniform national law.",
        sourceName: "Story J. Martin v. Hunter's Lessee, 14 U.S. (1 Wheat.) 304 (1816). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/14/304",
      },
      {
        date: "1821-03-03",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Cohens v. Virginia Chief Justice Marshall extended Martin's principle to state criminal judgments, holding that the Supreme Court may review a state court's criminal conviction where a federal question is raised and rejecting Virginia's argument that state sovereignty or the Eleventh Amendment barred such review. The decision consolidated and reaffirmed federal appellate supremacy over state courts across both civil and criminal cases.",
        sourceName: "Marshall CJ. Cohens v. Virginia, 19 U.S. (6 Wheat.) 264 (1821). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/19/264",
      },
    ],
  },

  {
    id: "strauder-jury-exclusion-equal-protection-1880",
    claim:
      "The U.S. Supreme Court held in Strauder v. West Virginia (100 U.S. 303, decided 1 March 1880) that a state statute barring Black men from serving on juries denies Black defendants the equal protection of the laws guaranteed by the Fourteenth Amendment.",
    emergedAt: "1880-03-01",
    milestones: [
      {
        date: "1880-03-01",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Strauder v. West Virginia, a 7–2 Supreme Court, per Justice Strong, struck down a West Virginia law limiting jury service to white men, holding that excluding citizens from juries solely because of race 'is practically a brand upon them' and denies equal protection under the Fourteenth Amendment. It was the Court's first substantive application of the Equal Protection Clause to invalidate a racially discriminatory state law. The ruling settled that racial exclusion from jury service is unconstitutional.",
        sourceName: "Strong J. Strauder v. West Virginia, 100 U.S. 303 (1880). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/100/303",
      },
      {
        date: "1986-04-30",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Batson v. Kentucky (476 U.S. 79, 30 April 1986), the Court reaffirmed Strauder as the foundational authority on racial discrimination in jury selection, quoting its holding that the Equal Protection Clause forbids a State from excluding jurors on account of race. By grounding its modern peremptory-challenge framework in Strauder's century-old principle, the Court confirmed that Strauder's core rule remains settled and controlling law. The reaffirmation demonstrates the doctrine's durability across 106 years.",
        sourceName: "Powell J. Batson v. Kentucky, 476 U.S. 79 (1986). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/476/79",
      },
    ],
  },

  {
    id: "white-primary-equal-protection-nixon-herndon-1927",
    claim:
      "The U.S. Supreme Court held in Nixon v. Herndon (273 U.S. 536, decided 7 March 1927) that a Texas statute barring Black citizens from voting in the Democratic Party primary violates the Fourteenth Amendment's Equal Protection Clause; after the doctrine was narrowed in Grovey v. Townsend (1935), it was definitively settled in Smith v. Allwright (1944).",
    emergedAt: "1927-03-07",
    milestones: [
      {
        date: "1927-03-07",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Nixon v. Herndon, a unanimous Court, per Justice Holmes, struck down Texas's statutory 'white primary' law, holding that 'color cannot be made the basis of a statutory classification affecting the right' to vote and that the statute plainly violated the Fourteenth Amendment's Equal Protection Clause. Holmes deemed the equal-protection violation so clear that the Court did not reach the Fifteenth Amendment claim. The ruling settled that a State may not by statute exclude voters from a primary on account of race.",
        sourceName: "Holmes J. Nixon v. Herndon, 273 U.S. 536 (1927). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/273/536",
      },
      {
        date: "1935-04-01",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "In Grovey v. Townsend (295 U.S. 45, 1 April 1935), a unanimous Court upheld the Texas white primary once it was imposed by the state Democratic Party's own convention resolution rather than by statute, holding that a political party's exclusion of Black voters was private action beyond the reach of the Fourteenth and Fifteenth Amendments. The decision reopened the question Herndon had appeared to settle, allowing white primaries to persist for another decade. It made the constitutional status of racial exclusion from primaries newly contested.",
        sourceName: "Roberts J. Grovey v. Townsend, 295 U.S. 45 (1935). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/295/45",
      },
      {
        date: "1944-04-03",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Smith v. Allwright (321 U.S. 649, 3 April 1944), an 8–1 Court expressly overruled Grovey v. Townsend, holding that where a State delegates the conduct of primaries to a party, the party's racial exclusion is state action that violates the Fifteenth Amendment: 'the state makes the action of the party the action of the state.' The decision definitively settled that racially exclusionary primaries are unconstitutional regardless of whether the exclusion is imposed by statute or party rule. It closed the state-action loophole Grovey had opened.",
        sourceName: "Reed J. Smith v. Allwright, 321 U.S. 649 (1944). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/321/649",
      },
    ],
  },

  {
    id: "racial-covenants-state-action-corrigan-buckley-1926",
    claim:
      "The U.S. Supreme Court held in Corrigan v. Buckley (271 U.S. 323, decided 24 May 1926) that racially restrictive property covenants are private contracts not prohibited by the Fifth, Thirteenth, or Fourteenth Amendments — a doctrine permitting judicial enforcement of such covenants until it was reversed in Shelley v. Kraemer (1948).",
    emergedAt: "1926-05-24",
    milestones: [
      {
        date: "1926-05-24",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Corrigan v. Buckley, a unanimous Court, per Justice Sanford, dismissed a challenge to a Washington, D.C. racially restrictive covenant for want of a substantial constitutional question, reasoning that the Fourteenth Amendment's prohibitions 'have reference to State action exclusively, and not to any action of private individuals,' and that the amendments did not bar private owners from restricting the disposition of their property by race. The ruling settled that racially restrictive covenants were private agreements outside constitutional reach. It let courts enforce such covenants across the country for the next two decades.",
        sourceName: "Sanford J. Corrigan v. Buckley, 271 U.S. 323 (1926). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/271/323",
      },
      {
        date: "1948-05-03",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "In Shelley v. Kraemer (334 U.S. 1, 3 May 1948), a unanimous Court (6–0) held that judicial enforcement of racially restrictive covenants by state courts is itself state action that violates the Equal Protection Clause of the Fourteenth Amendment: 'but for the active intervention of the state courts … petitioners would have been free to occupy the properties.' The decision reversed Corrigan's premise by locating unconstitutional state action in the enforcement rather than the covenant itself. It rendered racially restrictive covenants judicially unenforceable nationwide.",
        sourceName: "Vinson C.J. Shelley v. Kraemer, 334 U.S. 1 (1948). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/334/1",
      },
    ],
  },

  {
    id: "racial-zoning-unconstitutional-buchanan-warley-1917",
    claim:
      "The U.S. Supreme Court held in Buchanan v. Warley (245 U.S. 60, decided 5 November 1917) that a municipal ordinance forbidding Black or white persons from occupying homes on blocks where the other race predominated violates the Fourteenth Amendment by depriving property owners of the right to sell and dispose of their property.",
    emergedAt: "1917-11-05",
    milestones: [
      {
        date: "1917-11-05",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Buchanan v. Warley, a unanimous Court, per Justice Day, struck down Louisville's racial residential-zoning ordinance, holding that it deprived owners of the constitutionally protected right 'to acquire, use, and dispose of' property and could not be justified as a police-power measure to preserve public peace or property values. The Court held the ordinance violated the Fourteenth Amendment despite the segregation permitted by Plessy. The ruling settled that government-mandated racial zoning of residential property is unconstitutional.",
        sourceName: "Day J. Buchanan v. Warley, 245 U.S. 60 (1917). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/245/60",
      },
      {
        date: "1930-05-19",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In City of Richmond v. Deans (281 U.S. 704, 19 May 1930), the Court summarily affirmed, on the authority of Buchanan v. Warley, the invalidation of a Richmond ordinance that sought to accomplish racial residential segregation by tying occupancy to prohibited intermarriage. The per curiam affirmance confirmed that cities could not evade Buchanan through re-drafted racial zoning schemes. It cemented Buchanan as settled and durable law against government racial zoning.",
        sourceName: "Per Curiam. City of Richmond v. Deans, 281 U.S. 704 (1930).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/281/704",
      },
    ],
  },

  {
    id: "rowland-christian-landowner-unitary-duty-1968",
    claim:
      "The California Supreme Court held in Rowland v. Christian (69 Cal.2d 108, 8 August 1968) that a possessor of land owes a uniform duty of ordinary care to all persons on the premises, so that the common-law categories of trespasser, licensee, and invitee no longer control the scope of that duty.",
    emergedAt: "1968-08-08",
    milestones: [
      {
        date: "1968-08-08",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Rowland v. Christian, the California Supreme Court, per Justice Peters, abolished the rigid common-law trichotomy of trespasser, licensee, and invitee that had graduated a landowner's duty by the entrant's status, holding instead that liability is governed by the general negligence standard of California Civil Code section 1714 — whether the possessor acted as a reasonable person in view of the probability of injury to others. A guest injured by a concealed defective faucet the host knew of could therefore recover. The decision converted a settled, status-based rule into a unitary duty of ordinary care and became the leading premises-liability precedent, adopted in whole or part by roughly half the states.",
        sourceName:
          "Peters J. Rowland v. Christian, 69 Cal.2d 108, 443 P.2d 561 (1968). Opinion of the Court.",
        sourceUrl:
          "https://scocal.stanford.edu/opinion/rowland-v-christian-30100",
      },
    ],
  },

  {
    id: "tarasoff-therapist-duty-to-protect-1976",
    claim:
      "The California Supreme Court held in Tarasoff v. Regents of the University of California (17 Cal.3d 425, 1 July 1976) that a psychotherapist who determines, or under professional standards reasonably should determine, that a patient presents a serious danger of violence to a foreseeable victim bears a duty to exercise reasonable care to protect that victim.",
    emergedAt: "1974-12-23",
    milestones: [
      {
        date: "1974-12-23",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "In its first decision (Tarasoff I, 13 Cal.3d 177), the California Supreme Court held that a therapist whose patient (Prosenjit Poddar) had confided an intent to kill Tatiana Tarasoff owed a 'duty to warn' the foreseeable victim, recognizing for the first time that the confidential therapist-patient relationship could give rise to an affirmative duty toward an identifiable third person. The novel duty was recorded in a leading opinion but immediately drew objection from the mental-health bar and the state, and the court took the unusual step of granting rehearing.",
        sourceName:
          "Tobriner J. Tarasoff v. Regents of the University of California, 13 Cal.3d 177, 529 P.2d 553 (1974) (Tarasoff I).",
        sourceUrl:
          "https://law.justia.com/cases/california/supreme-court/3d/13/177.html",
      },
      {
        date: "1976-07-01",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "On rehearing (Tarasoff II, 17 Cal.3d 425), the court vacated its 1974 opinion and reframed the obligation as a broader 'duty to protect' — reasonable care to protect the foreseeable victim, which might be discharged by warning the victim, notifying police, or other steps as circumstances require — while confirming that this duty overrides the therapist's confidentiality when necessary to avert danger. The reformulation settled the modern doctrine, which was subsequently adopted, codified, or modified by most U.S. jurisdictions.",
        sourceName:
          "Tobriner J. Tarasoff v. Regents of the University of California, 17 Cal.3d 425, 551 P.2d 334 (1976). Opinion of the Court.",
        sourceUrl:
          "https://scocal.stanford.edu/opinion/tarasoff-v-regents-university-california-30278",
      },
    ],
  },

  {
    id: "canterbury-spence-informed-consent-reasonable-patient-1972",
    claim:
      "The U.S. Court of Appeals for the D.C. Circuit held in Canterbury v. Spence (464 F.2d 772, 19 May 1972) that a physician's duty to disclose the risks of a proposed treatment is measured by what a reasonable person in the patient's position would find material to the decision, not by the custom of the medical profession.",
    emergedAt: "1972-05-19",
    milestones: [
      {
        date: "1972-05-19",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Canterbury v. Spence, Judge Spottswood Robinson III rejected the traditional 'professional custom' standard, under which the adequacy of a physician's disclosure was judged by what other physicians customarily revealed, and held that the scope of disclosure is fixed by the patient's informational needs: a risk is 'material,' and must be disclosed, when a reasonable person in the patient's position would likely attach significance to it in deciding whether to undergo the therapy. The ruling established the patient-centered ('reasonable patient' / 'prudent patient') standard of informed consent, became a canonical precedent, and split American jurisdictions, with roughly half adopting it and others retaining the physician-based standard.",
        sourceName:
          "Robinson J. Canterbury v. Spence, 464 F.2d 772 (D.C. Cir. 1972). Opinion of the Court.",
        sourceUrl:
          "https://law.justia.com/cases/federal/appellate-courts/cadc/22099/22099.html",
      },
    ],
  },

  {
    id: "seely-economic-loss-rule-products-1965",
    claim:
      "The California Supreme Court held in Seely v. White Motor Co. (63 Cal.2d 9, 23 June 1965) that strict products liability in tort permits recovery for personal injury and physical damage to other property but not for purely economic losses such as lost profits and repair costs, which remain governed by the law of warranty.",
    emergedAt: "1965-06-23",
    milestones: [
      {
        date: "1965-06-23",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Seely v. White Motor Co., Chief Justice Traynor — the architect of strict products liability in Greenman — cabined the doctrine he had created, holding that strict liability in tort exists to protect against physical injury to person or property, not to compensate a buyer for a product that simply fails to perform as bargained for. A truck buyer's lost profits and repair costs were therefore recoverable, if at all, only under warranty (the UCC), not tort. The decision established the 'economic loss rule' and rejected the contrary approach of New Jersey's Santor v. A & M Karagheusian, drawing the tort/contract boundary in products liability.",
        sourceName:
          "Traynor C.J. Seely v. White Motor Co., 63 Cal.2d 9, 403 P.2d 145 (1965). Opinion of the Court.",
        sourceUrl:
          "https://scocal.stanford.edu/opinion/seely-v-white-motor-co-27248",
      },
      {
        date: "1986-06-16",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In East River Steamship Corp. v. Transamerica Delaval Inc. (476 U.S. 858), the U.S. Supreme Court, resolving the long-running split between Seely and Santor, adopted Seely's economic loss rule for admiralty and general products liability, holding that no products-liability tort claim lies when a commercial party's only injury is to the defective product itself, causing purely economic loss. The decision nationalized Seely's tort/contract boundary and made the economic loss rule the dominant American doctrine.",
        sourceName:
          "Blackmun J. East River Steamship Corp. v. Transamerica Delaval Inc., 476 U.S. 858 (1986). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/476/858",
      },
    ],
  },

  {
    id: "hoffman-red-owl-promissory-estoppel-negotiations-1965",
    claim:
      "The Wisconsin Supreme Court held in Hoffman v. Red Owl Stores, Inc. (26 Wis.2d 683, 2 March 1965) that promissory estoppel under Restatement of Contracts § 90 can support recovery of reliance damages for promises made during precontractual negotiations, even where the parties never reached a complete and definite agreement and no enforceable contract was ever formed.",
    emergedAt: "1965-03-02",
    milestones: [
      {
        date: "1965-03-02",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Hoffman v. Red Owl Stores, a prospective franchisee sold his bakery and grocery, moved, and made payments in reliance on the chain's repeated assurances that $18,000 would secure a store, only to have the terms escalated until the deal collapsed. The Wisconsin Supreme Court held that promissory estoppel under Restatement § 90 is not confined to promises that would otherwise be offers, and applied it to promises made during negotiations that never ripened into a contract, allowing recovery of reliance damages to prevent injustice. The decision extended promissory estoppel beyond enforcing bargains (as in the subcontractor-bid line) into precontractual liability, and became a leading precedent informing Restatement (Second) of Contracts § 90.",
        sourceName:
          "Currie C.J. Hoffman v. Red Owl Stores, Inc., 26 Wis.2d 683, 133 N.W.2d 267 (1965). Opinion of the Court.",
        sourceUrl:
          "https://law.justia.com/cases/wisconsin/supreme-court/1965/26-wis-2d-683-6.html",
      },
    ],
  },

  {
    id: "state-farm-hard-look-arbitrary-capricious-1983",
    claim:
      "When a federal agency promulgates or rescinds a rule, a reviewing court applies 'arbitrary and capricious' review that requires the agency to examine the relevant data and articulate a satisfactory explanation drawing a rational connection between the facts found and the choice made — the reasoned-decisionmaking ('hard look') standard established by the U.S. Supreme Court in Motor Vehicle Manufacturers Association v. State Farm Mutual Automobile Insurance Co., decided 24 June 1983.",
    emergedAt: "1983-06-24",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1983-06-24",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Motor Vehicle Mfrs. Ass'n v. State Farm (463 U.S. 29), a unanimous Court on the core standard, per Justice White, held that the National Highway Traffic Safety Administration's rescission of its passive-restraint (airbag/automatic-seatbelt) rule was arbitrary and capricious because the agency failed to supply a reasoned analysis for abandoning the rule. The Court settled that rescinding a rule is subject to the same reasoned-explanation demand as issuing one, and that an agency must consider significant alternatives and 'articulate a satisfactory explanation' with 'a rational connection between the facts found and the choice made.' This crystallized the modern 'hard look' standard that has governed judicial review of agency rulemaking ever since.",
        sourceName:
          "White J. Motor Vehicle Mfrs. Ass'n v. State Farm Mut. Auto. Ins. Co., 463 U.S. 29 (1983). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/463/29",
      },
    ],
  },

  {
    id: "mead-chevron-step-zero-2001",
    claim:
      "An agency's statutory interpretation qualifies for Chevron deference only when Congress delegated authority to the agency to make rules carrying the force of law and the agency acted pursuant to that authority (e.g., notice-and-comment rulemaking or formal adjudication); otherwise the interpretation earns only the weaker, persuasion-based Skidmore respect — the 'Chevron step zero' framework established by the U.S. Supreme Court in United States v. Mead Corp., decided 18 June 2001.",
    emergedAt: "2001-06-18",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "2001-06-18",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In United States v. Mead Corp. (533 U.S. 218), an 8–1 majority per Justice Souter held that U.S. Customs tariff-classification ruling letters, issued without notice-and-comment procedure, did not command Chevron deference but could still earn Skidmore respect according to their power to persuade. Mead settled a threshold 'step zero' inquiry — Chevron applies only where Congress delegated law-making authority and the agency exercised it — sorting agency pronouncements into a Chevron tier and a Skidmore tier. The framework became the standard gatekeeper for deference doctrine, though Justice Scalia's lone dissent warned it would produce unpredictable, ad hoc line-drawing.",
        sourceName:
          "Souter J. United States v. Mead Corp., 533 U.S. 218 (2001). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/533/218",
      },
      {
        date: "2024-06-28",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "In Loper Bright Enterprises v. Raimondo (603 U.S. 369), a 6–3 majority per Chief Justice Roberts overruled Chevron and held that courts must exercise independent judgment on questions of statutory meaning. Because Mead's step-zero framework existed only to decide when the now-defunct Chevron deference applied, the ruling stripped that framework of its operative function without formally overruling Mead by name, leaving its status unsettled (its Skidmore tier survives, but the Chevron-sorting exercise no longer has an object).",
        sourceName:
          "Roberts CJ. Loper Bright Enterprises v. Raimondo, 603 U.S. 369 (2024). Opinion of the Court.",
        sourceUrl: "https://www.supremecourt.gov/opinions/23pdf/22-451_7m58.pdf",
      },
    ],
  },

  {
    id: "massachusetts-v-epa-greenhouse-gases-air-pollutants-2007",
    claim:
      "Greenhouse gases such as carbon dioxide fall within the Clean Air Act's capacious definition of 'air pollutant,' so the Environmental Protection Agency has statutory authority to regulate motor-vehicle greenhouse-gas emissions and may decline to do so only on grounds tied to the statute — the U.S. Supreme Court's holding in Massachusetts v. EPA, decided 2 April 2007.",
    emergedAt: "2007-04-02",
    emergedPrecision: "DAY",
    claimType: "HYBRID",
    milestones: [
      {
        date: "2007-04-02",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Massachusetts v. EPA (549 U.S. 497), a 5–4 majority per Justice Stevens held that at least one petitioner (Massachusetts) had standing to sue over harms from climate change and that greenhouse gases 'without a doubt' fit the Clean Air Act's § 7602(g) definition of 'air pollutant,' giving EPA authority to regulate them under § 202(a). The Court further held EPA could refuse to regulate only by grounding its decision in the statute, not in policy preferences. The decision settled the statutory-coverage question that anchored all subsequent federal greenhouse-gas regulation.",
        sourceName:
          "Stevens J. Massachusetts v. Environmental Protection Agency, 549 U.S. 497 (2007). Opinion of the Court.",
        sourceUrl:
          "https://tile.loc.gov/storage-services/service/ll/usrep/usrep549/usrep549497/usrep549497.pdf",
      },
    ],
  },

  {
    id: "axon-cochran-structural-challenges-district-court-2023",
    claim:
      "A party subject to an SEC or FTC administrative enforcement proceeding may bring a structural constitutional challenge to the agency (e.g., that its administrative law judges are unconstitutionally insulated from removal, or that it unconstitutionally combines prosecutorial and adjudicatory functions) directly in federal district court, because the agencies' statutory review schemes do not displace ordinary federal-question jurisdiction over such claims — the U.S. Supreme Court's holding in Axon Enterprise, Inc. v. FTC / SEC v. Cochran, decided 14 April 2023.",
    emergedAt: "2023-04-14",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "2023-04-14",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Axon Enterprise, Inc. v. FTC, consolidated with SEC v. Cochran (598 U.S. 175), a unanimous Court per Justice Kagan held that the review schemes in the Securities Exchange Act and the FTC Act do not strip district courts of federal-question jurisdiction over challenges to the very structure or existence of the agencies. Applying the Thunder Basin factors, the Court reasoned that such structural claims are collateral to the agencies' subject-matter expertise and would go unremedied if a party had to endure the allegedly unconstitutional proceeding first. The ruling settled that regulated parties may obtain immediate Article III review of separation-of-powers attacks on agency adjudication rather than being funneled through the agency scheme.",
        sourceName:
          "Kagan J. Axon Enterprise, Inc. v. Federal Trade Commission, 598 U.S. 175 (2023). Opinion of the Court.",
        sourceUrl: "https://www.supremecourt.gov/opinions/22pdf/21-86_l5gm.pdf",
      },
    ],
  },

  {
    id: "muller-oregon-protective-labor-women-1908",
    claim:
      "The U.S. Supreme Court held in Muller v. Oregon, 208 U.S. 412 (decided February 24, 1908), that a state may impose maximum-hours limits on women workers, sustaining sex-specific protective labor legislation on the basis of women's physical differences and maternal function.",
    emergedAt: "1908-02-24",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1908-02-24",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "A unanimous Supreme Court, persuaded by Louis Brandeis's sociological 'Brandeis Brief,' upheld Oregon's ten-hour limit for women in laundries, distinguishing Lochner v. New York (1905). The decision settled that sex-based protective labor regulation was constitutionally permissible and legitimized the use of empirical social data in constitutional adjudication.",
        sourceName:
          "Supreme Court of the United States. Muller v. Oregon. 208 U.S. 412. 1908.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/208/412",
        methodologyType: "primary",
      },
      {
        date: "1971-11-22",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "ABANDONED",
        community: "JUDICIAL",
        reason:
          "In Reed v. Reed, 404 U.S. 71, the Supreme Court for the first time held that the Equal Protection Clause bars differential treatment based on sex, launching the sex-equality jurisprudence that repudiated Muller's premise that women may be singled out for special protection. Muller was never formally overruled, but its separate-protection rationale was abandoned as sex classifications became subject to heightened scrutiny.",
        sourceName:
          "Supreme Court of the United States. Reed v. Reed. 404 U.S. 71. 1971.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/404/71",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "federal-labor-injunction-debs-1895",
    claim:
      "The U.S. Supreme Court held in In re Debs, 158 U.S. 564 (decided May 27, 1895), that federal courts possess equity jurisdiction to enjoin strikes obstructing interstate commerce and the mails, and to punish violations as contempt without a jury trial.",
    emergedAt: "1895-05-27",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1895-05-27",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Arising from the 1894 Pullman strike, the Supreme Court unanimously affirmed the contempt conviction of Eugene Debs and endorsed the federal government's power to obtain sweeping injunctions against strikes interfering with interstate commerce and mail delivery. The decision settled the 'labor injunction' as the government's primary anti-strike weapon for the next three decades.",
        sourceName:
          "Supreme Court of the United States. In re Debs. 158 U.S. 564. 1895.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/158/564",
        methodologyType: "primary",
      },
      {
        date: "1932-03-23",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "INSTITUTIONAL",
        reason:
          "Congress enacted the Norris-LaGuardia Act (signed March 23, 1932), stripping federal courts of jurisdiction to issue injunctions in non-violent labor disputes and voiding yellow-dog contracts. The statute directly overturned the Debs-era injunction regime, reversing the settled doctrine of federal judicial power over strikes.",
        sourceName:
          "U.S. Congress. Norris-LaGuardia Act (Act of March 23, 1932, 47 Stat. 70). govinfo COMPS-5312. 1932.",
        sourceUrl: "https://www.govinfo.gov/content/pkg/COMPS-5312/pdf/COMPS-5312.pdf",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "pregnancy-not-sex-discrimination-gilbert-1976",
    claim:
      "The U.S. Supreme Court held in General Electric Co. v. Gilbert, 429 U.S. 125 (decided December 7, 1976), that an employer's exclusion of pregnancy-related disabilities from a benefits plan is not sex discrimination prohibited by Title VII of the Civil Rights Act of 1964.",
    emergedAt: "1976-12-07",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1976-12-07",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In a 6-3 decision the Supreme Court imported the reasoning of the constitutional case Geduldig v. Aiello into Title VII, holding that distinguishing on the basis of pregnancy is not facial gender discrimination. The ruling settled, as a matter of federal statutory law, that pregnancy exclusions did not violate Title VII.",
        sourceName:
          "Supreme Court of the United States. General Electric Co. v. Gilbert. 429 U.S. 125. 1976.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/429/125",
        methodologyType: "primary",
      },
      {
        date: "1978-10-31",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "INSTITUTIONAL",
        reason:
          "Congress enacted the Pregnancy Discrimination Act (Pub. L. 95-555, signed October 31, 1978), amending Title VII to define discrimination 'because of sex' to include discrimination on the basis of pregnancy, childbirth, or related medical conditions. The Act was passed expressly to reverse Gilbert, overturning the settled holding by statute.",
        sourceName:
          "U.S. Congress. Pregnancy Discrimination Act of 1978 (Pub. L. 95-555, 92 Stat. 2076). EEOC. 1978.",
        sourceUrl: "https://www.eeoc.gov/statutes/pregnancy-discrimination-act-1978",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "hostile-environment-sexual-harassment-meritor-1986",
    claim:
      "The U.S. Supreme Court held in Meritor Savings Bank v. Vinson, 477 U.S. 57 (decided June 19, 1986), that a hostile-environment sexual harassment claim is actionable sex discrimination under Title VII even absent economic or tangible job loss.",
    emergedAt: "1981-01-12",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1981-01-12",
        precision: "DAY",
        fromAxis: null,
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "In Bundy v. Jackson, 641 F.2d 934, the D.C. Circuit became the first federal appeals court to recognize that a discriminatorily hostile or abusive work environment, without any tangible loss of job benefits, can itself violate Title VII. This opened a contested question, as lower courts split over whether non-economic harassment was cognizable discrimination.",
        sourceName:
          "U.S. Court of Appeals, D.C. Circuit. Bundy v. Jackson. 641 F.2d 934. 1981.",
        sourceUrl: "https://law.justia.com/cases/federal/appellate-courts/F2/641/934/25673/",
        methodologyType: "primary",
      },
      {
        date: "1986-06-19",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "A unanimous Supreme Court, relying in part on the EEOC's 1980 sexual-harassment guidelines, held that Title VII is not limited to 'economic' or 'tangible' discrimination and that a sufficiently severe or pervasive hostile environment is actionable sex discrimination. The decision settled the circuit split and established hostile-environment harassment as a recognized Title VII claim.",
        sourceName:
          "Supreme Court of the United States. Meritor Savings Bank v. Vinson. 477 U.S. 57. 1986.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/477/57",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "charter-strict-construction-charles-river-bridge-1837",
    claim:
      "The U.S. Supreme Court held in Proprietors of the Charles River Bridge v. Proprietors of the Warren Bridge, 36 U.S. (11 Pet.) 420 (decided February 14, 1837), that public grants and corporate charters are strictly construed against the grantee and confer no exclusive privilege by implication, so a legislature's later charter of a competing bridge did not impair the Contract Clause.",
    emergedAt: "1837-02-14",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1837-02-14",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Chief Justice Taney, writing for a 5-2 Court, rejected the Charles River Bridge proprietors' claim to an implied monopoly, holding that ambiguities in a public grant are resolved in favor of the public and that nothing passes by implication. The decision resolved the contested expansive reading of vested charter rights suggested by the Marshall-era Dartmouth College and Fletcher v. Peck line, settling the rule that charters are narrowly construed to favor economic development and public interest.",
        sourceName:
          "Supreme Court of the United States. Proprietors of the Charles River Bridge v. Proprietors of the Warren Bridge. 36 U.S. 420. 1837.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/36/420",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "milligan-military-commissions-civilians-1866",
    claim:
      "The U.S. Supreme Court held in Ex parte Milligan, 71 U.S. (4 Wall.) 2 (order announced 3 April 1866, opinions delivered 17 December 1866), that military commissions have no jurisdiction to try civilians where the civil courts are open and functioning, and that martial law is confined to theaters of actual war in which the courts are actually closed.",
    emergedAt: "1866-04-03",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1866-04-03",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Ex parte Milligan the Supreme Court ordered the discharge of a civilian condemned to death by a military commission in Indiana during the Civil War, holding the tribunal unconstitutional. Justice Davis's opinion (delivered 17 December 1866) declared that 'martial rule can never exist where the courts are open,' settling as a JUDICIAL matter that military commissions cannot try civilians while civil courts function — a foundational limit on war-powers military justice.",
        sourceName:
          "Davis J. Ex parte Milligan, 71 U.S. (4 Wall.) 2 (1866). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/71/2",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "geofroy-riggs-treaty-power-scope-1890",
    claim:
      "The U.S. Supreme Court held in Geofroy v. Riggs, 133 U.S. 258 (decided 3 February 1890), that the treaty power extends to all proper subjects of negotiation between the United States and foreign nations — including overriding state inheritance and property law — subject only to the narrow limits that a treaty may not authorize what the Constitution forbids, alter the character of the government, or cede state territory without consent.",
    emergedAt: "1890-02-03",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1890-02-03",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Geofroy v. Riggs the Court upheld an 1853 U.S.–France consular convention permitting French citizens to inherit District of Columbia real estate against a state-law disability. Justice Field's opinion held the treaty power reaches 'all proper subjects of negotiation between our government and the governments of other nations,' with only narrow constitutional limits, settling the broad-but-bounded scope of the federal treaty power.",
        sourceName:
          "Field J. Geofroy v. Riggs, 133 U.S. 258 (1890). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/133/258",
        methodologyType: "primary",
      },
      {
        date: "1920-04-19",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Missouri v. Holland (252 U.S. 416, 19 April 1920) built on Geofroy's premise that treaties reach proper subjects of international negotiation, with Justice Holmes holding that a valid treaty (the Migratory Bird Treaty) and its implementing statute could regulate matters otherwise arguably reserved to the states. The decision entrenched and extended Geofroy's expansive conception of the treaty power, keeping the doctrine settled.",
        sourceName:
          "Holmes J. Missouri v. Holland, 252 U.S. 416 (1920). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/252/416",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "jones-sovereignty-political-question-1890",
    claim:
      "The U.S. Supreme Court held in Jones v. United States, 137 U.S. 202 (decided 24 November 1890), that the question of which nation holds sovereignty (de jure or de facto) over a territory is a political, not judicial, question, so that the determination of the legislative and executive departments — here the recognition of U.S. jurisdiction over Navassa Island under the Guano Islands Act of 1856 — conclusively binds the courts.",
    emergedAt: "1890-11-24",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1890-11-24",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Reviewing a murder conviction for acts on guano-bearing Navassa Island, the Court upheld the Guano Islands Act and, per Justice Gray, held that 'who is the sovereign... of a territory is not a judicial, but a political, question,' whose resolution by the political branches conclusively binds the judiciary. The ruling settled that judicial recognition of territorial sovereignty follows the executive's foreign-relations determinations.",
        sourceName:
          "Gray J. Jones v. United States, 137 U.S. 202 (1890). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/137/202",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "terlinden-ames-treaty-continuity-political-question-1902",
    claim:
      "The U.S. Supreme Court held in Terlinden v. Ames, 184 U.S. 270 (decided 24 February 1902), that the 1852 Prussian–U.S. extradition treaty remained in force despite Prussia's absorption into the German Empire in 1871, and that whether a treaty survives a change in the foreign state's form of government is a political question committed to the executive and not subject to judicial revision.",
    emergedAt: "1902-02-24",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1902-02-24",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Denying a habeas challenge to extradition, the Court, per Chief Justice Fuller, held the 1852 Prussia–U.S. extradition treaty still operative because both governments had continued to honor it, and that the continued force of a treaty after a change in a foreign government's constitution 'is not a judicial but a political question.' The decision settled that treaty-continuity determinations rest with the political branches.",
        sourceName:
          "Fuller C.J. Terlinden v. Ames, 184 U.S. 270 (1902). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/184/270",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "in-re-ross-constitution-abroad-consular-courts-1891",
    claim:
      "The U.S. Supreme Court held in In re Ross, 140 U.S. 453 (decided 25 May 1891), that the Constitution's grand-jury and jury-trial guarantees do not protect a U.S. citizen tried abroad by a U.S. consular court exercising extraterritorial jurisdiction under treaty, on the theory that the Constitution 'can have no operation in another country' — a doctrine later repudiated by Reid v. Covert (1957).",
    emergedAt: "1891-05-25",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1891-05-25",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Upholding a seaman's murder conviction by a U.S. consular court in Japan under an extraterritoriality treaty, the Court, per Justice Field, held that the constitutional guarantees of indictment and jury trial 'apply only to citizens... within the United States, and not to residents or temporary sojourners abroad,' because the Constitution can have no operation in another country. This settled that the Constitution did not follow the citizen abroad in treaty-based consular tribunals.",
        sourceName:
          "Field J. In re Ross, 140 U.S. 453 (1891). Opinion of the Court.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/140/453",
        methodologyType: "primary",
      },
      {
        date: "1957-06-10",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "In Reid v. Covert, 354 U.S. 1 (10 June 1957), Justice Black's plurality repudiated Ross, declaring its rationale 'a fundamental misconception,' stating 'the Ross approach that the Constitution has no applicability abroad has long since been directly repudiated,' and holding that constitutional protections do follow U.S. citizens abroad when the government exercises power over them. This reversed the Ross doctrine of a territorially bounded Constitution.",
        sourceName:
          "Black J. Reid v. Covert, 354 U.S. 1 (1957). Plurality opinion.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/354/1",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "sherman-act-rule-of-reason-1911",
    claim:
      "The U.S. Supreme Court held in Standard Oil Co. of New Jersey v. United States (decided 15 May 1911) that Section 1 of the Sherman Antitrust Act condemns only unreasonable restraints of trade, identified under a 'rule of reason,' rather than every restraint read literally, and ordered dissolution of the Standard Oil combination by divesting its holdings in 37 subsidiary corporations.",
    emergedAt: "1890-07-02",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1890-07-02",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "INSTITUTIONAL",
        reason:
          "Congress enacted the Sherman Antitrust Act, declaring illegal 'every contract, combination... or conspiracy, in restraint of trade or commerce among the several States.' The literal breadth of 'every' placed on the record an unresolved interpretive question: whether the Act reached all restraints or only some, and how courts would distinguish lawful from unlawful combinations.",
        sourceName:
          "U.S. Congress. Sherman Antitrust Act, 26 Stat. 209 (2 July 1890), codified at 15 U.S.C. §§ 1–7.",
        sourceUrl: "https://www.law.cornell.edu/uscode/text/15/1",
        methodologyType: "primary",
      },
      {
        date: "1911-05-15",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Chief Justice White, for the Court, held that the Sherman Act reaches only unreasonable restraints of trade, to be identified through a 'rule of reason' applied case by case, rejecting a purely literal reading, and affirmed the decree dissolving Standard Oil's 37-subsidiary combination. The decision established the interpretive framework that has governed Section 1 analysis ever since.",
        sourceName:
          "Supreme Court of the United States. Standard Oil Co. of New Jersey v. United States, 221 U.S. 1 (1911).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/221/1",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "resale-price-maintenance-dr-miles-leegin-1911",
    claim:
      "The U.S. Supreme Court held in Dr. Miles Medical Co. v. John D. Park & Sons Co. (decided 3 April 1911) that vertical minimum resale price maintenance agreements are per se illegal under Section 1 of the Sherman Act — a rule the Court expressly overruled in Leegin Creative Leather Products, Inc. v. PSKS, Inc. (decided 28 June 2007), replacing it with rule-of-reason analysis.",
    emergedAt: "1911-04-03",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1911-04-03",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Justice Hughes, for the Court, held Dr. Miles's system of contracts fixing minimum resale prices void under the common law and the Sherman Act, reasoning that once title passes a manufacturer cannot restrain the prices at which purchasers resell. The ruling settled a bright-line per se prohibition on vertical minimum resale price maintenance that governed for nearly a century.",
        sourceName:
          "Supreme Court of the United States. Dr. Miles Medical Co. v. John D. Park & Sons Co., 220 U.S. 373 (1911).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/220/373",
        methodologyType: "primary",
      },
      {
        date: "2007-06-28",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "Justice Kennedy, for a 5–4 Court, expressly overruled Dr. Miles, holding that vertical minimum resale price agreements must be judged under the rule of reason rather than condemned per se, because such restraints can have procompetitive effects. The decision reversed a 96-year-old rule and completed the Court's turn toward economic analysis of vertical restraints.",
        sourceName:
          "Supreme Court of the United States. Leegin Creative Leather Products, Inc. v. PSKS, Inc., 551 U.S. 877 (2007) (syllabus).",
        sourceUrl: "https://www.law.cornell.edu/supct/html/06-480.ZS.html",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "two-sided-platform-market-definition-amex-2018",
    claim:
      "Federal antitrust courts held that the relevant market for a two-sided credit-card transaction platform must be defined to encompass both the merchant and cardholder sides — a framework adopted by the Second Circuit in United States v. American Express Co. (26 September 2016) and affirmed by the U.S. Supreme Court in Ohio v. American Express Co. (decided 25 June 2018).",
    emergedAt: "2016-09-26",
    emergedPrecision: "DAY",
    claimType: "HYBRID",
    milestones: [
      {
        date: "2016-09-26",
        precision: "DAY",
        fromAxis: null,
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "The Second Circuit reversed the Eastern District of New York's February 2015 finding that American Express's anti-steering rules restrained trade, holding that the credit-card business is a single two-sided market and that the district court erred by weighing only merchant-side effects while discounting cardholder interests. The novel single-market framing broke from the trial court and drew sharp scholarly criticism, leaving the two-sided-market doctrine contested.",
        sourceName:
          "U.S. Court of Appeals for the Second Circuit. United States v. American Express Co., 838 F.3d 179 (2d Cir. 2016).",
        sourceUrl:
          "https://law.justia.com/cases/federal/appellate-courts/ca2/15-1672/15-1672-2016-09-26.html",
        methodologyType: "primary",
      },
      {
        date: "2018-06-25",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Justice Thomas, for a 5–4 Court, affirmed, holding that for a two-sided transaction platform the relevant market includes both sides and that plaintiffs must prove net anticompetitive harm across the entire platform; the plaintiffs had not shown that Amex's anti-steering provisions caused such harm. The decision settled the two-sided transaction-platform framework that now structures antitrust analysis of digital platforms.",
        sourceName:
          "Supreme Court of the United States. Ohio v. American Express Co., 585 U.S. 529 (2018).",
        sourceUrl: "https://www.supremecourt.gov/opinions/17pdf/16-1454_5h26.pdf",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "monopolist-refusal-to-deal-aspen-trinko-1985",
    claim:
      "The U.S. Supreme Court held in Aspen Skiing Co. v. Aspen Highlands Skiing Corp. (decided 19 June 1985) that a monopolist's refusal to deal with a rival can violate Section 2 of the Sherman Act when it abandons a profitable prior course of dealing to exclude a competitor — a duty-to-deal doctrine the Court sharply narrowed in Verizon Communications Inc. v. Law Offices of Curtis V. Trinko, LLP (decided 13 January 2004).",
    emergedAt: "1985-06-19",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1985-06-19",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Justice Stevens, for the Court, held that although a monopolist has no general duty to cooperate with rivals, its unilateral refusal to deal can constitute unlawful monopolization under Section 2 where it terminates an established, profitable cooperative arrangement (the all-Aspen ski ticket) without valid business justification and to harm a smaller competitor. The ruling settled that unilateral refusals to deal are actionable in defined circumstances.",
        sourceName:
          "Supreme Court of the United States. Aspen Skiing Co. v. Aspen Highlands Skiing Corp., 472 U.S. 585 (1985).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/472/585",
        methodologyType: "primary",
      },
      {
        date: "2004-01-13",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Justice Scalia, for the Court, held there is generally 'no duty to aid competitors' under Section 2, characterized Aspen Skiing as 'at or near the outer boundary of § 2 liability,' and confined the refusal-to-deal exception to its facts (prior voluntary dealing, an existing retail product, sacrifice of short-run profits). By cabining rather than overruling Aspen, the decision left the scope of any duty to deal newly contested — a question now central to digital-platform antitrust debates.",
        sourceName:
          "Supreme Court of the United States. Verizon Communications Inc. v. Law Offices of Curtis V. Trinko, LLP, 540 U.S. 398 (2004).",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/540/398",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "botiller-dominguez-treaty-not-self-executing-1889",
    claim:
      "The U.S. Supreme Court held in Botiller v. Dominguez (130 U.S. 238, decided April 1, 1889) that the Treaty of Guadalupe Hidalgo was not self-executing as to Spanish and Mexican land grants, so Congress could validly require every such claim—perfected or inchoate—to be confirmed by the board of land commissioners under the Act of 1851 and treat unpresented claims as public domain.",
    emergedAt: "1889-04-01",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1889-04-01",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Landowners argued that a perfected grant under the Treaty of Guadalupe Hidalgo was protected by the treaty itself and could not be forfeited for failure to file under the 1851 Act. A unanimous Court, per Justice Miller, rejected this, holding the treaty's land-grant guarantees were not self-executing and that Congress's confirmation procedure controlled—settling that the political branches, not the treaty's bare terms, governed how Mexican-era titles were secured.",
        sourceName:
          "U.S. Supreme Court (Miller, J.). Botiller v. Dominguez. 130 U.S. 238. 1889.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/130/238",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "arjona-define-and-punish-law-of-nations-1887",
    claim:
      "The U.S. Supreme Court held in United States v. Arjona (120 U.S. 479, decided March 7, 1887) that Congress's Article I power to 'define and punish offenses against the law of nations' authorizes it to criminalize counterfeiting the notes and securities of foreign governments and banks, because international obligations of due diligence to prevent such acts make them offenses against the law of nations even absent an express treaty.",
    emergedAt: "1887-03-07",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1887-03-07",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "The defendant challenged federal statutes punishing the counterfeiting of foreign bank notes, arguing Congress lacked power to reach conduct not tied to an express treaty. A unanimous Court, per Chief Justice Waite, upheld the statutes under the Define-and-Punish Clause, reasoning that a nation's duty of due diligence to suppress such counterfeiting is itself part of the law of nations—settling that customary international obligations supply a constitutional basis for federal criminal legislation.",
        sourceName:
          "U.S. Supreme Court (Waite, C.J.). United States v. Arjona. 120 U.S. 479. 1887.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/120/479",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "ker-illinois-abduction-does-not-bar-jurisdiction-1886",
    claim:
      "The U.S. Supreme Court held in Ker v. Illinois (119 U.S. 436, decided December 6, 1886) that a defendant forcibly abducted from a foreign country (Peru) and brought to trial acquires no personal right of asylum under the extradition treaty and may be tried, because the treaty's procedures were never invoked and the manner of his seizure does not defeat the court's jurisdiction.",
    emergedAt: "1886-12-06",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1886-12-06",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Ker argued that his kidnapping from Peru, in a country with which the U.S. had an extradition treaty, tainted the state court's power to try him. A unanimous Court, per Justice Miller, held the treaty conferred no individual right where its process was never used and that forcible abduction is no bar to trial—establishing the male captus/'Ker-Frisbie' rule, decided the same day as and doctrinally opposite to United States v. Rauscher's specialty holding.",
        sourceName:
          "U.S. Supreme Court (Miller, J.). Ker v. Illinois. 119 U.S. 436. 1886.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/119/436",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "hamilton-kentucky-distilleries-war-power-after-armistice-1919",
    claim:
      "The U.S. Supreme Court held in Hamilton v. Kentucky Distilleries & Warehouse Co. (251 U.S. 146, decided December 15, 1919) that the War-Time Prohibition Act remained a valid exercise of Congress's war power after the November 1918 armistice, because the war was not legally terminated until demobilization was complete and a peace treaty ratified, so the war power extends through the emergency's aftermath.",
    emergedAt: "1919-12-15",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1919-12-15",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "Distillers argued the war power could no longer support wartime prohibition once fighting stopped at the armistice. A unanimous Court, per Justice Brandeis, upheld the Act, holding that Congress retained broad discretion to judge when war conditions ceased and that the war power persisted until formal peace—settling that the constitutional war power outlasts the cessation of hostilities.",
        sourceName:
          "U.S. Supreme Court (Brandeis, J.). Hamilton v. Kentucky Distilleries & Warehouse Co. 251 U.S. 146. 1919.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/251/146",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "wong-kim-ark-birthright-citizenship-fourteenth-amendment-1898",
    claim:
      "The U.S. Supreme Court held in United States v. Wong Kim Ark (169 U.S. 649, decided March 28, 1898) that a child born on U.S. soil to Chinese-subject parents who are lawfully domiciled residents is a citizen at birth under the Fourteenth Amendment's Citizenship Clause, adopting the common-law and law-of-nations rule of jus soli subject only to narrow exceptions for children of diplomats and hostile occupiers.",
    emergedAt: "1898-03-28",
    emergedPrecision: "DAY",
    milestones: [
      {
        date: "1898-03-28",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "After Elk v. Wilkins (1884) had narrowed 'subject to the jurisdiction thereof' for tribal Native Americans, it was contested whether children of non-citizen aliens were birthright citizens, especially amid Chinese-exclusion politics. A 6–2 Court, per Justice Gray, traced the English common-law and law-of-nations rule of birth within the realm and held Wong Kim Ark a citizen—settling that the Fourteenth Amendment guarantees jus soli citizenship to the U.S.-born children of resident aliens.",
        sourceName:
          "U.S. Supreme Court (Gray, J.). United States v. Wong Kim Ark. 169 U.S. 649. 1898.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/169/649",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "search-engine-monopolization-google-2024",
    claim:
      "The U.S. District Court for the District of Columbia held in United States v. Google LLC (memorandum opinion, 5 August 2024) that Google unlawfully maintained monopolies in general search services and general search text advertising in violation of Section 2 of the Sherman Act, through exclusive default-placement agreements with browser makers, device manufacturers, and carriers.",
    emergedAt: "2020-10-20",
    emergedPrecision: "DAY",
    claimType: "HYBRID",
    milestones: [
      {
        date: "2020-10-20",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "INSTITUTIONAL",
        reason:
          "The U.S. Department of Justice and eleven state attorneys general filed a Section 2 complaint alleging that Google unlawfully maintained its general-search monopoly through exclusive default-search agreements with firms including Apple, Samsung, Mozilla, and wireless carriers. The monopolization claim was formally lodged on the litigation record, opening the first major U.S. digital-platform monopolization case since Microsoft.",
        sourceName:
          "U.S. Department of Justice, Antitrust Division. Complaint, United States et al. v. Google LLC, No. 1:20-cv-03010 (D.D.C. filed 20 Oct. 2020).",
        sourceUrl:
          "https://www.justice.gov/atr/case/us-and-plaintiff-states-v-google-llc-2020",
        methodologyType: "primary",
      },
      {
        date: "2024-08-05",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "Judge Amit Mehta's memorandum opinion found that Google possessed monopoly power (roughly 89.2% of general search, 94.9% on mobile) and had willfully maintained it through exclusionary default agreements, concluding that 'Google is a monopolist, and it has acted as one to maintain its monopoly.' The first-instance Section 2 liability finding against a dominant digital platform remains contested pending Google's appeal to the D.C. Circuit, following the September 2025 remedies ruling.",
        sourceName:
          "U.S. District Court for the District of Columbia. Memorandum Opinion, United States et al. v. Google LLC, No. 1:20-cv-03010 (D.D.C. 5 Aug. 2024) (Mehta, J.).",
        sourceUrl:
          "https://www.justice.gov/atr/case/us-and-plaintiff-states-v-google-llc-2020",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "predatory-pricing-recoupment-1993",
    claim:
      "Below-cost pricing is unlawful predatory pricing under the Sherman Act and the Robinson-Patman Act only where the plaintiff proves the defendant had a reasonable prospect of recouping its below-cost investment through later supracompetitive prices — a recoupment requirement the U.S. Supreme Court established in Brooke Group Ltd. v. Brown & Williamson Tobacco Corp. (21 June 1993), displacing the permissive primary-line liability standard of Utah Pie Co. v. Continental Baking Co. (1967).",
    emergedAt: "1967-04-24",
    emergedPrecision: "DAY",
    claimType: "HYBRID",
    milestones: [
      {
        date: "1967-04-24",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "In Utah Pie Co. v. Continental Baking Co., the U.S. Supreme Court reversed a directed verdict and allowed a primary-line price-discrimination claim to proceed on evidence of a 'drastically declining price structure,' holding that competitive injury need not involve the immediate destruction of a competitor. The decision recorded a permissive predatory-pricing standard under which aggressive price-cutting by larger rivals could itself support Robinson-Patman liability, largely without economic scrutiny of whether the predator could ever profit.",
        sourceName:
          "Supreme Court of the United States. Utah Pie Co. v. Continental Baking Co., 386 U.S. 685. 1967.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/386/685",
        methodologyType: "primary",
      },
      {
        date: "1986-03-26",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "In Matsushita Electric Industrial Co. v. Zenith Radio Corp., the U.S. Supreme Court held on summary judgment that predatory-pricing conspiracies are economically implausible because conspirators must have 'a reasonable expectation of recovering, in the form of later monopoly profits, more than the losses suffered,' making such schemes 'self-deterring.' By importing the recoupment logic of Chicago-School economics, the Court cast the permissive Utah Pie approach into doubt and opened the predatory-pricing standard to sustained contestation.",
        sourceName:
          "Supreme Court of the United States. Matsushita Elec. Indus. Co. v. Zenith Radio Corp., 475 U.S. 574. 1986.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/475/574",
        methodologyType: "primary",
      },
      {
        date: "1993-06-21",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Brooke Group Ltd. v. Brown & Williamson Tobacco Corp., the U.S. Supreme Court held that a predatory-pricing plaintiff, whether under the Sherman Act or the Robinson-Patman Act, must prove both below-cost pricing and 'a reasonable prospect...of recouping its investment in below-cost prices,' reasoning that without recoupment low prices merely enhance consumer welfare. The decision settled recoupment as an indispensable element of any predatory-pricing claim, the governing federal standard ever since.",
        sourceName:
          "Supreme Court of the United States. Brooke Group Ltd. v. Brown & Williamson Tobacco Corp., 509 U.S. 209. 1993.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/509/209",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "patent-tying-market-power-presumption-2006",
    claim:
      "In a tying arrangement, the mere fact that the tying product is patented no longer creates a presumption that the seller possesses market power — the U.S. Supreme Court, in Illinois Tool Works Inc. v. Independent Ink, Inc. (1 March 2006), unanimously abandoned the presumption of market power from patents that it had established in International Salt Co. v. United States (1947) and United States v. Loew's Inc. (1962), requiring plaintiffs to prove market power by evidence.",
    emergedAt: "1947-11-10",
    emergedPrecision: "DAY",
    claimType: "HYBRID",
    milestones: [
      {
        date: "1947-11-10",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In International Salt Co. v. United States, the U.S. Supreme Court held it a per se violation of Section 1 of the Sherman Act and Section 3 of the Clayton Act for the country's largest industrial-salt producer to require lessees of its patented salt-processing machines to buy only its unpatented salt. The decision treated the patent on the tying machine as itself sufficient to establish the economic power needed to condemn the tie, settling a presumption that a patent confers market power in tying analysis.",
        sourceName:
          "Supreme Court of the United States. International Salt Co. v. United States, 332 U.S. 392. 1947.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/332/392",
        methodologyType: "primary",
      },
      {
        date: "2006-03-01",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "In Illinois Tool Works Inc. v. Independent Ink, Inc., a unanimous U.S. Supreme Court held that 'in all cases involving a tying arrangement, the plaintiff must prove that the defendant has market power in the tying product,' expressly rejecting the presumption that a patent confers such power. The Court traced the presumption's migration from patent-misuse law into antitrust via International Salt and Loew's and repudiated it, aligning tying doctrine with modern economic learning and Congress's 1988 patent-misuse amendments.",
        sourceName:
          "Supreme Court of the United States. Illinois Tool Works Inc. v. Independent Ink, Inc., 547 U.S. 28. 2006.",
        sourceUrl:
          "https://caselaw.findlaw.com/court/us-supreme-court/547/28.html",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "vertical-maximum-price-fixing-albrecht-khan-1997",
    claim:
      "A seller's agreement setting a maximum resale price for its distributors is judged under the rule of reason rather than condemned per se under Section 1 of the Sherman Act — the U.S. Supreme Court unanimously overruled its contrary per se rule from Albrecht v. Herald Co. (1968) in State Oil Co. v. Khan (4 November 1997).",
    emergedAt: "1968-03-04",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1968-03-04",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Albrecht v. Herald Co., the U.S. Supreme Court held that a newspaper publisher's arrangement forcing a carrier to observe a maximum resale price was, 'without more, an illegal restraint of trade' per se unlawful under Section 1 of the Sherman Act, rejecting any distinction between maximum and minimum resale price fixing. The decision settled a bright-line per se prohibition on vertical maximum price fixing.",
        sourceName:
          "Supreme Court of the United States. Albrecht v. Herald Co., 390 U.S. 145. 1968.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/390/145",
        methodologyType: "primary",
      },
      {
        date: "1997-11-04",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "In State Oil Co. v. Khan, a unanimous Court per Justice O'Connor held 'Albrecht is overruled,' concluding that vertical maximum price fixing should be evaluated under the rule of reason because such restraints can benefit consumers by preventing dealers from exploiting downstream market power. Grounded in the intervening economic critiques and the Court's Sylvania-line turn to effects-based analysis, the decision reversed a 29-year-old per se rule and reoriented vertical maximum price restraints toward case-by-case competitive scrutiny.",
        sourceName:
          "Supreme Court of the United States. State Oil Co. v. Khan, 522 U.S. 3. 1997.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/522/3",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "ncaa-amateurism-antitrust-deference-2021",
    claim:
      "The NCAA's rules restraining student-athlete compensation are subject to ordinary rule-of-reason antitrust scrutiny with no special judicial deference to amateurism — the U.S. Supreme Court applied the rule of reason to NCAA restraints in NCAA v. Board of Regents (27 June 1984) while suggesting in dicta that amateurism rules were presumptively procompetitive, a deference the Court unanimously rejected in NCAA v. Alston (21 June 2021).",
    emergedAt: "1984-06-27",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1984-06-27",
        precision: "DAY",
        fromAxis: null,
        toAxis: "RECORDED",
        community: "JUDICIAL",
        reason:
          "In NCAA v. Board of Regents of the University of Oklahoma, the U.S. Supreme Court struck down the NCAA's television-broadcast restraints under the rule of reason rather than a per se rule, reasoning that some horizontal cooperation is essential for the product to exist. In dicta, the Court observed that NCAA rules preserving amateurism 'may be' procompetitive and 'entirely consistent' with the Sherman Act — language lower courts read for decades as commanding deference to amateurism restrictions, recording an ambiguous presumption of validity.",
        sourceName:
          "Supreme Court of the United States. NCAA v. Board of Regents of the University of Oklahoma, 468 U.S. 85. 1984.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/468/85",
        methodologyType: "primary",
      },
      {
        date: "2021-06-21",
        precision: "DAY",
        fromAxis: "RECORDED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In NCAA v. Alston, a unanimous Court per Justice Gorsuch affirmed the invalidation of NCAA caps on education-related benefits, holding that nothing about the NCAA or amateur sports warrants departing from ordinary rule-of-reason analysis and that a party cannot 'relabel a restraint as a product feature and declare it immune.' The decision settled that the Board of Regents amateurism dicta conferred no special antitrust deference, subjecting NCAA compensation restraints to full rule-of-reason scrutiny.",
        sourceName:
          "Supreme Court of the United States. National Collegiate Athletic Assn. v. Alston, 594 U.S. 69 (No. 20-512). 2021.",
        sourceUrl:
          "https://www.supremecourt.gov/opinions/20pdf/20-512_gfbh.pdf",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "abortion-funding-no-constitutional-obligation-1980",
    claim:
      "The U.S. Supreme Court held in Harris v. McRae (448 U.S. 297, decided 30 June 1980) that the Hyde Amendment's bar on federal Medicaid reimbursement for most abortions violates neither the Due Process nor equal protection component of the Fifth Amendment, establishing that a woman's constitutional right to choose abortion imposes no correlative obligation on government to fund it.",
    emergedAt: "1976-09-30",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1976-09-30",
        precision: "DAY",
        fromAxis: null,
        toAxis: "CONTESTED",
        community: "INSTITUTIONAL",
        reason:
          "Congress enacted the first Hyde Amendment as a rider to the FY1977 Labor-HEW appropriations bill on 30 September 1976, barring the use of federal funds for most abortions. Following Roe v. Wade's recognition of an abortion right, this opened a sharply contested question — litigated in lower courts that enjoined enforcement — over whether the Constitution required government to subsidize the exercise of that right.",
        sourceName:
          "Hyde Amendment (rider to Departments of Labor and HEW Appropriations Act, 1977). Enacted 30 September 1976.",
        sourceUrl: "https://en.wikipedia.org/wiki/Hyde_Amendment",
        methodologyType: "derivative",
      },
      {
        date: "1980-06-30",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "A 5–4 majority per Justice Stewart upheld the Hyde Amendment, holding that neither Title XIX nor the Constitution compels funding of medically necessary abortions, since government 'need not remove obstacles not of its own creation' such as indigency. The decision settled that the abortion right is a liberty from governmental interference, not an entitlement to public subsidy — a funding doctrine that has remained good law and gained further force after Dobbs.",
        sourceName:
          "Supreme Court of the United States. Harris v. McRae. 448 U.S. 297. 1980.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/448/297",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "title-x-abortion-counseling-gag-rule-1991",
    claim:
      "The U.S. Supreme Court held in Rust v. Sullivan (500 U.S. 173, decided 23 May 1991) that HHS regulations prohibiting Title X family-planning grantees from counseling, referring for, or advocating abortion do not violate the First or Fifth Amendments, because government's selective funding of one activity over another is not viewpoint discrimination or an unconstitutional condition.",
    emergedAt: "1988-02-02",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1988-02-02",
        precision: "DAY",
        fromAxis: null,
        toAxis: "CONTESTED",
        community: "INSTITUTIONAL",
        reason:
          "HHS promulgated regulations (53 Fed. Reg. 2922) barring Title X projects from providing abortion counseling or referral — the 'gag rule.' Grantees challenged the rules as viewpoint-based compelled silence and an unconstitutional condition on funding, producing conflicting rulings in the lower federal courts over whether selective subsidy could restrict speech within a government program.",
        sourceName:
          "Supreme Court of the United States. Rust v. Sullivan (recounting the 1988 HHS Title X regulations, 53 Fed. Reg. 2922). 500 U.S. 173. 1991.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/500/173",
        methodologyType: "derivative",
      },
      {
        date: "1991-05-23",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "A 5–4 majority per Chief Justice Rehnquist upheld the regulations, reasoning that 'the Government has not discriminated on the basis of viewpoint; it has merely chosen to fund one activity to the exclusion of another.' The decision settled the constitutional doctrine that government may attach content-based conditions to what it subsidizes; while the gag-rule policy itself has since oscillated across administrations, Rust's unconstitutional-conditions holding remains controlling law.",
        sourceName:
          "Supreme Court of the United States. Rust v. Sullivan. 500 U.S. 173. 1991.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/500/173",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "biological-father-marital-presumption-1989",
    claim:
      "The U.S. Supreme Court held in Michael H. v. Gerald D. (491 U.S. 110, decided 15 June 1989) that a biological father has no constitutionally protected liberty interest in establishing paternity of, or a relationship with, a child born to a woman married to and living with another man, upholding California's conclusive marital presumption of legitimacy.",
    emergedAt: "1989-06-15",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1989-06-15",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "A plurality per Justice Scalia upheld California Evidence Code § 621's conclusive presumption that a child born to a married, cohabiting woman is her husband's, holding that an adulterous natural father — despite a 98.07% probability of paternity — lacks any liberty interest protected by substantive due process, because the Nation's traditions protect the 'unitary family,' not the disruptive claims of a biological outsider. The decision (with its famous footnote 6 directing that tradition be defined at the most specific level) settled the outer limit of unwed and biological fathers' constitutional parenting claims and remains cited in modern substantive-due-process disputes.",
        sourceName:
          "Supreme Court of the United States. Michael H. v. Gerald D. 491 U.S. 110. 1989.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/491/110",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "foster-agency-religious-exemption-same-sex-2021",
    claim:
      "The U.S. Supreme Court held in Fulton v. City of Philadelphia (593 U.S. 522, decided 17 June 2021) that Philadelphia violated the Free Exercise Clause by refusing to contract with a Catholic foster-care agency unless it agreed to certify same-sex couples as foster parents, because the city's nondiscrimination requirement contained a discretionary-exemption mechanism that made it not generally applicable and thus subject to strict scrutiny.",
    emergedAt: "2021-06-17",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "2021-06-17",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "After Masterpiece Cakeshop (2018) left open how antidiscrimination duties apply to religious objectors and litigants urged overruling Employment Division v. Smith, a unanimous Court per Chief Justice Roberts ruled for Catholic Social Services on narrow grounds: because the foster contract let the Commissioner grant exemptions 'in his/her sole discretion,' the policy was not generally applicable, triggering strict scrutiny the city could not satisfy. The decision settled that discretionary-exemption regimes forfeit Smith's deference, resolving this church-state foster-care conflict while declining to overrule Smith.",
        sourceName:
          "Supreme Court of the United States. Fulton v. City of Philadelphia. 593 U.S. 522. 2021.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/19-123",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "gender-affirming-care-minors-equal-protection-2025",
    claim:
      "The U.S. Supreme Court held in United States v. Skrmetti (605 U.S. 495, decided 18 June 2025) that Tennessee's ban on puberty blockers and hormone therapy for the treatment of gender dysphoria in minors classifies only on the bases of age and medical use — not sex or transgender status — and therefore does not trigger heightened equal-protection scrutiny, surviving rational-basis review.",
    emergedAt: "2023-09-28",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "2023-09-28",
        precision: "DAY",
        fromAxis: null,
        toAxis: "CONTESTED",
        community: "JUDICIAL",
        reason:
          "The Sixth Circuit (Chief Judge Sutton) in L.W. v. Skrmetti reversed district-court injunctions and upheld the Tennessee and Kentucky bans applying deferential rational-basis review, deepening a conflict with courts that had subjected such bans to heightened scrutiny as sex- or transgender-status-based classifications. The split over the correct level of equal-protection review made the constitutionality of gender-affirming-care bans an openly contested federal question, prompting the Supreme Court to grant certiorari.",
        sourceName:
          "U.S. Court of Appeals for the Sixth Circuit. L.W. v. Skrmetti. 83 F.4th 460. 2023.",
        sourceUrl: "https://www.supremecourt.gov/opinions/24pdf/23-477_2cp3.pdf",
        methodologyType: "derivative",
      },
      {
        date: "2025-06-18",
        precision: "DAY",
        fromAxis: "CONTESTED",
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "A 6–3 majority per Chief Justice Roberts affirmed the Sixth Circuit, holding that Tennessee's law draws only age- and medical-use lines that do not warrant heightened scrutiny under the Equal Protection Clause, and that the ban survives rational-basis review given legislative and medical uncertainty. The decision settled the federal constitutional question, leaving bans in roughly 25 states in force and foreclosing heightened-scrutiny challenges to gender-affirming-care restrictions for minors.",
        sourceName:
          "Supreme Court of the United States. United States v. Skrmetti. 605 U.S. 495. 2025.",
        sourceUrl: "https://www.supremecourt.gov/opinions/24pdf/23-477_2cp3.pdf",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "free-speech-incorporation-gitlow-1925",
    claim:
      "The U.S. Supreme Court held in Gitlow v. New York (268 U.S. 652, decided 8 June 1925) that freedom of speech and of the press are among the fundamental liberties protected by the Due Process Clause of the Fourteenth Amendment and therefore bind the states, not merely Congress.",
    emergedAt: "1925-06-08",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1925-06-08",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Gitlow v. New York the Court, per Justice Sanford, upheld a criminal-anarchy conviction but 'assumed' that freedom of speech and press are 'among the fundamental personal rights and liberties protected by the due process clause of the Fourteenth Amendment from impairment by the States.' This first extended First Amendment speech protection beyond the federal government established in Barron v. Baltimore (1833), opening the path of selective incorporation of the free-speech guarantee against the states.",
        sourceName:
          "Supreme Court of the United States. Gitlow v. New York. 268 U.S. 652. 1925.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/268/652",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "prior-restraint-press-near-1931",
    claim:
      "The U.S. Supreme Court held in Near v. Minnesota (283 U.S. 697, decided 1 June 1931) that a state statute permitting prior suppression of 'malicious, scandalous and defamatory' newspapers is an unconstitutional prior restraint, and that freedom of the press is protected against the states by the Fourteenth Amendment.",
    emergedAt: "1931-06-01",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1931-06-01",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Near v. Minnesota, Chief Justice Hughes for a 5–4 Court struck down Minnesota's 'gag law,' holding that the chief purpose of press liberty is to prevent 'previous restraints upon publication' and that 'it is no longer open to doubt that the liberty of the press... is within the liberty safeguarded by the due process clause of the Fourteenth Amendment.' The decision constitutionalized a strong presumption against prior restraints and applied press freedom to the states, becoming the doctrinal foundation later invoked in New York Times Co. v. United States (1971).",
        sourceName:
          "Supreme Court of the United States. Near v. Minnesota. 283 U.S. 697. 1931.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/283/697",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "compelled-flag-salute-barnette-1943",
    claim:
      "The U.S. Supreme Court held in Minersville School District v. Gobitis (310 U.S. 586, decided 3 June 1940) that public schools may compel students to salute the flag despite religious objection; three years later West Virginia State Board of Education v. Barnette (319 U.S. 624, decided 14 June 1943) expressly overruled Gobitis and held such compelled expression unconstitutional.",
    emergedAt: "1940-06-03",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1940-06-03",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Minersville School District v. Gobitis, Justice Frankfurter for an 8–1 Court held that a mandatory flag-salute requirement applied to Jehovah's Witness schoolchildren did not violate the First Amendment, reasoning that 'national unity is the basis of national security' and that religious conviction did not relieve citizens of a generally applicable civic duty. The decision settled, for a time, that the state's interest in fostering patriotism could override individual conscience.",
        sourceName:
          "Supreme Court of the United States. Minersville School District v. Gobitis. 310 U.S. 586. 1940.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/310/586",
        methodologyType: "primary",
      },
      {
        date: "1943-06-14",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "In West Virginia State Board of Education v. Barnette, Justice Jackson for a 6–3 Court expressly overruled Gobitis, holding that compelling a flag salute violates the First Amendment because 'no official, high or petty, can prescribe what shall be orthodox in politics, nationalism, religion, or other matters of opinion or force citizens to confess by word or act their faith therein.' Decided on Flag Day only three years after Gobitis, Barnette established the compelled-speech doctrine and marked a rare rapid self-reversal of a recent constitutional precedent.",
        sourceName:
          "Supreme Court of the United States. West Virginia State Board of Education v. Barnette. 319 U.S. 624. 1943.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/319/624",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "establishment-clause-incorporation-everson-1947",
    claim:
      "The U.S. Supreme Court held in Everson v. Board of Education (330 U.S. 1, decided 10 February 1947) that the First Amendment's Establishment Clause applies to the states through the Fourteenth Amendment and erects 'a wall of separation between church and state.'",
    emergedAt: "1947-02-10",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1947-02-10",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Everson v. Board of Education, Justice Black for a 5–4 Court held that the Establishment Clause binds the states via the Fourteenth Amendment and, quoting Jefferson, declared that the clause 'was intended to erect a wall of separation between church and State.' Although the Court upheld New Jersey's reimbursement of parents for bus fares to parochial schools, its incorporation of the Establishment Clause and separationist framing became the foundation of all modern church-state jurisprudence, including the later Lemon test.",
        sourceName:
          "Supreme Court of the United States. Everson v. Board of Education. 330 U.S. 1. 1947.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/330/1",
        methodologyType: "primary",
      },
    ],
  },

  {
    id: "obscenity-standard-roth-miller-1957",
    claim:
      "The U.S. Supreme Court held in Roth v. United States (354 U.S. 476, decided 24 June 1957) that obscenity is not protected by the First Amendment and defined it by whether material appeals to 'prurient interest'; that definitional standard (as elaborated in Memoirs v. Massachusetts) was replaced by the three-part test of Miller v. California (413 U.S. 15, decided 21 June 1973).",
    emergedAt: "1957-06-24",
    emergedPrecision: "DAY",
    claimType: "INSTITUTIONAL",
    milestones: [
      {
        date: "1957-06-24",
        precision: "DAY",
        fromAxis: null,
        toAxis: "SETTLED",
        community: "JUDICIAL",
        reason:
          "In Roth v. United States, Justice Brennan for the Court held that 'obscenity is not within the area of constitutionally protected speech or press,' and set the test as whether, to the average person applying contemporary community standards, the dominant theme of the material taken as a whole appeals to prurient interest. Roth settled that obscenity is an unprotected category and supplied the governing definitional standard, later restated in Memoirs v. Massachusetts (1966) as requiring material 'utterly without redeeming social value.'",
        sourceName:
          "Supreme Court of the United States. Roth v. United States. 354 U.S. 476. 1957.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/354/476",
        methodologyType: "primary",
      },
      {
        date: "1973-06-21",
        precision: "DAY",
        fromAxis: "SETTLED",
        toAxis: "REVERSED",
        community: "JUDICIAL",
        reason:
          "In Miller v. California, Chief Justice Burger for a 5–4 Court replaced the Roth-Memoirs formulation with a new three-part test: whether the average person applying contemporary community standards would find the work appeals to prurient interest, whether it depicts sexual conduct in a patently offensive way as defined by state law, and whether it lacks serious literary, artistic, political, or scientific value. The Court expressly rejected the 'utterly without redeeming social value' standard as 'abandoned as unworkable,' reworking the constitutional definition of unprotected obscenity that governs to this day.",
        sourceName:
          "Supreme Court of the United States. Miller v. California. 413 U.S. 15. 1973.",
        sourceUrl: "https://www.law.cornell.edu/supremecourt/text/413/15",
        methodologyType: "primary",
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
        claimType: traj.claimType ?? "INSTITUTIONAL",
        epistemicAxis: traj.milestones[traj.milestones.length - 1].toAxis,
        claimEmergedAt: new Date(traj.emergedAt),
        claimEmergedPrecision: traj.emergedPrecision ?? "DAY",
      },
    });
    console.log(`CREATED claim ${claim.id} for ${traj.id}`);

    for (const m of traj.milestones) {
      const src = await p.source.create({
        data: {
          name: m.sourceName,
          url: m.sourceUrl,
          publishedAt: new Date(m.date),
          methodologyType: m.methodologyType ?? "primary",
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

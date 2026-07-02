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

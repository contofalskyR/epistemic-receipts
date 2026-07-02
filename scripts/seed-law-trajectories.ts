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

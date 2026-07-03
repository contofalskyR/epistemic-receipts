import type { Theory, Family } from "./data";

// ── Family 11: White-Collar, Organized & Emerging ───────────────────────────

const WHITE_COLLAR_FAMILY: Family = {
  slug: "white-collar-organized-emerging",
  name: "White-Collar, Organized & Emerging",
  blurb: "Crime by the powerful and the networked — corporate fraud, organized crime, cybercrime, and illicit markets.",
  color: "slate",
  theories: [
    {
      name: "White-collar crime",
      description: "Crime committed by persons of respectability and high social status in the course of their occupations — Sutherland's foundational concept.",
      tags: ["c20", "foundational"],
      tenet: "Crime is not confined to the lower classes; persons of respectability and high social status commit serious crimes in the course of their occupations.",
      lineage: { parents: ["Differential association"], divergence: "application: Sutherland applied his own learning theory to explain why respectable businesspeople commit fraud and regulatory violations" },
      figures: ["Edwin Sutherland"],
      era: ["c20"],
      coreTenets: [
        "White-collar crime causes greater financial harm than street crime but receives less enforcement and lighter punishment.",
        "It is learned behavior — corporate cultures transmit definitions favorable to legal violation just as street cultures transmit definitions favorable to theft.",
        "The criminal justice system applies different standards to the powerful, reflecting class bias in law enforcement.",
      ],
      keyThinkers: [
        "Edwin Sutherland — White Collar Crime (1949)",
        "Gilbert Geis — White-Collar Criminal (1968)",
      ],
      historicalInstances: [
        "Enron scandal (2001)",
        "Savings and loan crisis (1980s-90s)",
        "Volkswagen emissions fraud (2015)",
      ],
      principalCritiques: [
        "Definitional debates persist: should white-collar crime be defined by offender status (Sutherland) or by offense type (Edelhertz)?",
        "Critics argue the concept conflates very different behaviors — individual fraud, corporate negligence, regulatory violations — under a single label.",
      ],
    },
    {
      name: "Corporate crime",
      description: "Illegal acts committed by corporations or their agents on behalf of the organization — distinct from individual occupational crime.",
      tags: ["c20", "c21"],
      tenet: "Corporate crime is committed by organizations — not just individuals — pursuing profit; organizational structure, culture, and incentives are the criminogenic factors.",
      lineage: { parents: ["White-collar crime"], divergence: "organizational focus: shifts unit of analysis from the individual offender to the corporation as criminal actor" },
      figures: ["Marshall Clinard", "Peter Yeager", "John Braithwaite"],
      era: ["c20", "c21"],
      coreTenets: [
        "Corporations as organizations can be criminal actors — the criminogenic factor is organizational structure, not individual pathology.",
        "Corporate crime causes more death, injury, and financial loss than street crime — workplace deaths, toxic exposure, fraud.",
        "Regulatory capture — industries influencing their own regulators — undermines enforcement of corporate crime.",
      ],
      keyThinkers: [
        "Marshall Clinard & Peter Yeager — Corporate Crime (1980)",
        "John Braithwaite — Corporate Crime in the Pharmaceutical Industry (1984)",
      ],
      historicalInstances: [
        "Ford Pinto case — cost-benefit analysis of human lives",
        "BP Deepwater Horizon oil spill (2010)",
        "Purdue Pharma and the opioid crisis",
      ],
      principalCritiques: [
        "Critics note that prosecuting corporations is difficult because proving organizational mens rea challenges traditional criminal law concepts.",
        "Some argue that fines are simply a cost of doing business for large corporations and that individual prosecution is more effective.",
      ],
    },
    {
      name: "Occupational crime",
      description: "Crimes committed by individuals in the course of their occupations for personal gain — embezzlement, theft, fraud by employees.",
      tags: ["c20"],
      tenet: "Occupational crime is committed by individuals exploiting their occupational position for personal gain — distinct from corporate crime, which benefits the organization.",
      lineage: { parents: ["White-collar crime"], divergence: "individual focus: distinguishes crimes committed for personal gain in an occupational context from crimes committed on behalf of organizations" },
      figures: ["Gary Green", "Gerald Mars"],
      era: ["c20"],
      coreTenets: [
        "Occupational crime spans all social classes — from employee theft to physician fraud to insider trading.",
        "Opportunity structures in the workplace — access, trust, autonomy — create the conditions for occupational offending.",
        "Techniques of neutralization are central: occupational offenders rationalize their behavior as normal, deserved, or victimless.",
      ],
      keyThinkers: [
        "Gary Green — Occupational Crime (1990)",
        "Gerald Mars — Cheats at Work (1982)",
      ],
      principalCritiques: [
        "The boundary between occupational crime and everyday workplace misconduct (padding expenses, taking supplies) is unclear.",
        "Enforcement is uneven — lower-status occupational crime (employee theft) is punished far more consistently than higher-status occupational crime (professional fraud).",
      ],
    },
    {
      name: "State crime and state-corporate crime",
      description: "Illegal or harmful acts committed by states or by states acting in partnership with corporations.",
      tags: ["c20", "c21"],
      tenet: "States are major perpetrators of crime — genocide, torture, corruption — and state-corporate partnerships produce harms that neither would accomplish alone.",
      lineage: { parents: ["Conflict criminology", "Corporate crime"], divergence: "sovereignty challenge: applies criminological concepts to state actors who typically define what counts as crime" },
      figures: ["Penny Green", "Tony Ward", "Raymond Michalowski", "Ronald Kramer"],
      era: ["c20", "c21"],
      coreTenets: [
        "State crime includes genocide, torture, corruption, illegal surveillance, and violations of international law by state agents.",
        "State-corporate crime occurs when state agencies and corporations jointly produce harm — regulatory failure enabling corporate disasters.",
        "The study of state crime challenges criminology's state-centric foundations, since the state defines legality.",
      ],
      keyThinkers: [
        "Penny Green & Tony Ward — State Crime: Governments, Violence and Corruption (2004)",
        "Raymond Michalowski & Ronald Kramer — State-Corporate Crime (2006)",
      ],
      historicalInstances: [
        "My Lai massacre (Vietnam War)",
        "Abu Ghraib torture (Iraq War)",
        "Space Shuttle Challenger disaster as state-corporate crime (Kramer)",
      ],
      principalCritiques: [
        "Critics argue that labeling state actions as 'crime' without legal conviction stretches the concept beyond its useful boundaries.",
        "Realists contend that state crime is effectively unenforceable against powerful states, making it a moral category rather than a legal one.",
      ],
    },
    {
      name: "Organized crime",
      description: "Continuing criminal enterprises that use systematic violence, corruption, and structure to provide illicit goods and services.",
      tags: ["c20", "c21"],
      tenet: "Organized crime consists of continuing enterprises that use systematic violence, corruption, and organizational structure to provide illicit goods, services, and markets.",
      lineage: { parents: [], divergence: "root — distinct from individual crime by its organizational continuity, use of corruption, and market provision" },
      figures: ["Donald Cressey", "Klaus von Lampe", "Letizia Paoli"],
      era: ["c20", "c21"],
      coreTenets: [
        "Organized crime provides illicit goods and services — drugs, gambling, prostitution, protection — that have market demand.",
        "It uses violence (or its threat) and corruption of public officials to maintain monopoly power and avoid enforcement.",
        "Organizational forms range from hierarchical (traditional Mafia model) to loose networks (modern transnational trafficking).",
      ],
      keyThinkers: [
        "Donald Cressey — Theft of the Nation (1969)",
        "Letizia Paoli — Mafia Brotherhoods (2003)",
        "Klaus von Lampe — Organized Crime: Analyzing Illegal Activities, Criminal Structures, and Extra-Legal Governance (2016)",
      ],
      historicalInstances: [
        "Italian-American Mafia (Cosa Nostra)",
        "Russian organized crime (post-Soviet era)",
        "Mexican drug trafficking organizations",
        "Japanese Yakuza",
      ],
      principalCritiques: [
        "Critics argue the 'alien conspiracy' model (Cressey) overstated Mafia hierarchy and underestimated the role of local corruption and market demand.",
        "Modern scholarship emphasizes that organized crime is a set of activities and relationships, not a fixed organizational type.",
      ],
    },
    {
      name: "Illicit markets and trafficking",
      description: "Transnational markets in drugs, arms, humans, wildlife, and counterfeit goods — driven by demand, enabled by globalization.",
      tags: ["c20", "c21", "transnational"],
      tenet: "Illicit markets are driven by demand for prohibited goods and services; globalization, technology, and governance gaps enable transnational trafficking networks.",
      lineage: { parents: ["Organized crime"], divergence: "market focus: shifts from organizational structure to the economic logic of illicit supply and demand" },
      figures: ["Moises Naim", "Phil Williams"],
      era: ["c20", "c21"],
      coreTenets: [
        "Illicit markets operate according to economic principles — supply, demand, price, and competition — just like legal markets.",
        "Globalization — open borders, containerized shipping, digital communication — has dramatically expanded the scale and reach of trafficking.",
        "Human trafficking, wildlife trafficking, and arms trafficking each have distinct market structures, actors, and governance challenges.",
      ],
      keyThinkers: [
        "Moises Naim — Illicit: How Smugglers, Traffickers, and Copycats Are Hijacking the Global Economy (2005)",
        "Phil Williams — Transnational Criminal Networks (2001)",
      ],
      principalCritiques: [
        "Critics argue that framing trafficking as a market problem naturalizes it and obscures the coercion, violence, and exploitation at its core.",
        "Enforcement-focused approaches are criticized for targeting supply while ignoring demand and the structural conditions that produce vulnerability to trafficking.",
      ],
    },
    {
      name: "Gangs",
      description: "Street gangs as organized groups involved in crime — varying from informal peer groups to highly structured enterprises.",
      tags: ["c20", "c21"],
      tenet: "Street gangs are durable, street-oriented groups whose involvement in crime is integral to their identity — ranging from informal peer networks to organized criminal enterprises.",
      lineage: { parents: ["Subcultural theories", "Organized crime"], divergence: "meso-level: bridges subcultural theory and organized crime; studies group dynamics, territory, and identity" },
      figures: ["Frederic Thrasher", "Malcolm Klein", "James Diego Vigil"],
      era: ["c20", "c21"],
      coreTenets: [
        "Gangs vary enormously in structure, from loose, informal peer groups to hierarchical organizations with defined roles.",
        "Gang membership substantially increases individual involvement in violence and other crime, beyond pre-existing risk factors.",
        "Gang formation is driven by social marginalization, neighborhood context, identity needs, and the search for protection and belonging.",
      ],
      keyThinkers: [
        "Frederic Thrasher — The Gang (1927)",
        "Malcolm Klein — The American Street Gang (1995)",
        "James Diego Vigil — A Rainbow of Gangs (2002)",
      ],
      principalCritiques: [
        "Definitional problems plague gang research — who counts as a gang member and what counts as a gang varies across studies and jurisdictions.",
        "Critics argue that gang databases and suppression strategies disproportionately target minority youth and can deepen the very marginalization that produces gangs.",
      ],
    },
    {
      name: "Cybercrime",
      description: "Criminal activity enabled by or targeting digital technology — from hacking and ransomware to online fraud and exploitation.",
      tags: ["c21", "emerging"],
      tenet: "Cybercrime exploits digital connectivity to commit offenses at scale, across borders, and with relative anonymity — creating novel challenges for detection, attribution, and prosecution.",
      lineage: { parents: [], divergence: "root — technologically enabled crime category that challenges traditional criminological frameworks built around physical space" },
      figures: ["David Wall", "Majid Yar"],
      era: ["c21"],
      coreTenets: [
        "Cybercrime includes cyber-dependent offenses (hacking, malware, DDoS) and cyber-enabled offenses (fraud, harassment, exploitation conducted online).",
        "The internet's architecture — anonymity, borderlessness, scalability — creates opportunity structures unlike those for traditional crime.",
        "Attribution, jurisdiction, and enforcement lag far behind the pace of technological change.",
      ],
      keyThinkers: [
        "David Wall — Cybercrime: The Transformation of Crime in the Information Age (2007)",
        "Majid Yar — Cybercrime and Society (2006)",
      ],
      historicalInstances: [
        "WannaCry ransomware attack (2017)",
        "Equifax data breach (2017)",
        "Colonial Pipeline ransomware attack (2021)",
      ],
      principalCritiques: [
        "Critics argue most cybercrime theories simply apply traditional frameworks (routine activity, rational choice) to a new context without genuinely new theoretical insight.",
        "Measurement is extremely difficult — much cybercrime goes unreported, and estimates of financial loss vary by orders of magnitude.",
      ],
    },
    {
      name: "Financial and economic crime",
      description: "Crimes involving financial systems — fraud, money laundering, insider trading, tax evasion — causing massive aggregate harm.",
      tags: ["c20", "c21"],
      tenet: "Financial crimes — fraud, money laundering, insider trading, tax evasion — exploit economic systems for illicit gain and cause harm that dwarfs conventional property crime.",
      lineage: { parents: ["White-collar crime"], divergence: "systemic focus: emphasizes harms to financial systems and economies rather than individual victims" },
      figures: ["Michael Levi", "Petrus van Duyne"],
      era: ["c20", "c21"],
      coreTenets: [
        "Financial crime is structurally facilitated by complex financial instruments, offshore jurisdictions, and regulatory fragmentation.",
        "Money laundering connects all serious crime to the financial system, making anti-money-laundering (AML) a cross-cutting enforcement priority.",
        "The aggregate cost of financial crime vastly exceeds that of street crime but receives disproportionately fewer criminal justice resources.",
      ],
      keyThinkers: [
        "Michael Levi — Regulating Fraud (1987)",
        "Petrus van Duyne — Money Laundering in Europe (2003)",
      ],
      historicalInstances: [
        "Bernie Madoff Ponzi scheme ($65 billion, 2008)",
        "LIBOR manipulation scandal (2012)",
        "Panama Papers revelations (2016)",
      ],
      principalCritiques: [
        "Critics argue that the complexity of financial crime makes prosecution dependent on regulatory expertise that criminal justice systems often lack.",
        "Anti-money-laundering regimes are criticized as producing enormous compliance costs with limited demonstrated effectiveness at reducing crime.",
      ],
    },
  ],
};

// ── SECTION C: CRIMINAL JUSTICE SYSTEM ──────────────────────────────────────

const POLICING_FAMILY: Family = {
  slug: "policing",
  name: "Policing",
  blurb: "Models, strategies, and theories of police organization, practice, and reform.",
  color: "sky",
  theories: [
    {
      name: "Professional model of policing",
      description: "The reform-era model: centralized, hierarchical, technology-driven, and insulated from political influence.",
      tags: ["c20"],
      tenet: "Effective policing requires centralized command, hierarchical organization, rapid response, and professional insulation from political interference.",
      lineage: { parents: [], divergence: "root — the dominant police organizational model from the 1930s through the 1970s" },
      figures: ["August Vollmer", "O.W. Wilson", "J. Edgar Hoover"],
      era: ["c20"],
      coreTenets: [
        "Police should be organized on a military model with clear chains of command and professional standards.",
        "Random preventive patrol and rapid response to calls are the core tactics.",
        "Science and technology — fingerprinting, forensics, radio dispatch — replace the beat cop's local knowledge.",
      ],
      keyThinkers: [
        "August Vollmer — pioneer of professional policing",
        "O.W. Wilson — Police Administration (1950)",
      ],
      principalCritiques: [
        "The Kansas City Preventive Patrol Experiment (1974) found that random patrol did not reduce crime or increase citizen satisfaction.",
        "Critics argue the professional model created an isolated, car-bound police force disconnected from communities.",
      ],
    },
    {
      name: "Community policing",
      description: "Police and community as co-producers of public safety — decentralized, proactive, relationship-focused.",
      tags: ["c20", "c21", "policy-relevant"],
      tenet: "Public safety is best produced through partnership between police and communities — decentralized, proactive, and focused on building trust and solving problems together.",
      lineage: { parents: ["Professional model of policing"], divergence: "reform reaction: emerged from dissatisfaction with the professional model's isolation from communities" },
      figures: ["Herman Goldstein", "Robert Trojanowicz"],
      era: ["c20", "c21"],
      coreTenets: [
        "Police legitimacy depends on community trust; trust is built through regular, non-enforcement contact.",
        "Officers should be assigned to fixed neighborhoods to develop local knowledge and relationships.",
        "Community members should participate in identifying priorities and co-producing solutions.",
      ],
      keyThinkers: [
        "Herman Goldstein — Problem-Oriented Policing (1990)",
        "Robert Trojanowicz & Bonnie Bucqueroux — Community Policing (1990)",
      ],
      historicalInstances: [
        "Chicago Alternative Policing Strategy (CAPS)",
        "COPS program (USA, 1994)",
      ],
      principalCritiques: [
        "Critics argue community policing has been widely adopted in rhetoric but rarely in practice — most departments remain incident-driven.",
        "Scholars note that 'community' is not homogeneous; police-community partnerships often engage only the most organized and privileged residents.",
      ],
    },
    {
      name: "Problem-oriented policing",
      description: "Police should identify and address the underlying conditions that produce recurring crime problems, not just respond to incidents.",
      tags: ["c20", "policy-relevant", "evidence-based"],
      tenet: "Police should systematically identify recurring crime problems, analyze their underlying conditions, and develop tailored responses — not just respond to individual incidents.",
      lineage: { parents: ["Community policing"], divergence: "analytical focus: shifts from relationship-building to systematic problem analysis using the SARA model" },
      figures: ["Herman Goldstein"],
      era: ["c20"],
      coreTenets: [
        "The basic unit of police work should be the problem (a cluster of related incidents), not the individual incident.",
        "The SARA model — Scanning, Analysis, Response, Assessment — provides a systematic framework for problem-solving.",
        "Responses should be tailored to specific problems and may involve actors beyond the police (city agencies, community groups, businesses).",
      ],
      keyThinkers: [
        "Herman Goldstein — Improving Policing: A Problem-Oriented Approach (1979)",
        "John Eck & William Spelman — Problem-Solving: Problem-Oriented Policing in Newport News (1987)",
      ],
      principalCritiques: [
        "Implementation research finds that most police problem-solving efforts are shallow — officers skip analysis and jump to familiar responses.",
        "Critics argue problem-oriented policing remains police-centric and does not genuinely empower communities.",
      ],
    },
    {
      name: "Procedural justice and police legitimacy",
      description: "People obey the law when they perceive legal authorities as fair and legitimate — compliance follows from respectful, transparent processes.",
      tags: ["c20", "c21", "policy-relevant"],
      tenet: "People obey the law primarily because they perceive legal authorities as legitimate; legitimacy is built through procedural fairness — voice, neutrality, respect, and trustworthiness.",
      lineage: { parents: ["Community policing"], divergence: "psychological mechanism: explains why community policing works — through perceived fairness, not just presence" },
      figures: ["Tom Tyler"],
      era: ["c20", "c21"],
      coreTenets: [
        "Procedural justice has four elements: voice (being heard), neutrality (unbiased decisions), respect (dignified treatment), and trustworthiness (benevolent intent).",
        "When people perceive the process as fair, they are more likely to comply with outcomes even when those outcomes are unfavorable.",
        "Perceived illegitimacy of police — especially in minority communities — undermines compliance and cooperation.",
      ],
      keyThinkers: [
        "Tom Tyler — Why People Obey the Law (1990)",
        "Tom Tyler & Yuen Huo — Trust in the Law (2002)",
      ],
      principalCritiques: [
        "Critics argue procedural justice is insufficient when the substantive outcomes of policing are systematically unjust (racial profiling, excessive force).",
        "Some scholars contend that legitimacy research overestimates the malleability of trust — communities with long histories of police abuse require structural change, not better manners.",
      ],
    },
    {
      name: "Evidence-based policing",
      description: "Police strategies should be guided by the best available research evidence, particularly from randomized controlled trials.",
      tags: ["c21", "evidence-based"],
      tenet: "Police strategies should be guided by rigorous research evidence — especially randomized controlled trials and systematic reviews — rather than tradition, intuition, or politics.",
      lineage: { parents: ["Problem-oriented policing", "Hot spots policing"], divergence: "methodological turn: demands experimental evidence as the basis for police practice" },
      figures: ["Lawrence Sherman", "David Weisburd", "Cynthia Lum"],
      era: ["c21"],
      coreTenets: [
        "Police should use the best available evidence to determine what works, what does not work, and what is promising.",
        "Randomized controlled trials (RCTs) are the gold standard for evaluating police interventions.",
        "Evidence-based policing is not a strategy but a decision-making framework that can be applied to any strategy.",
      ],
      keyThinkers: [
        "Lawrence Sherman — Evidence-Based Policing (1998)",
        "Cynthia Lum & Christopher Koper — Evidence-Based Policing (2017)",
      ],
      principalCritiques: [
        "Critics argue that RCTs are difficult and expensive to conduct in policing contexts, and that overreliance on experiments ignores valuable qualitative and contextual knowledge.",
        "Community advocates contend evidence-based policing can legitimize aggressive tactics (hot spots, stop-and-frisk) if evidence of crime reduction is prioritized over community harm.",
      ],
    },
  ],
};

// ── Courts & Sentencing ─────────────────────────────────────────────────────

const COURTS_FAMILY: Family = {
  slug: "courts-sentencing",
  name: "Courts & Sentencing",
  blurb: "Theories of judicial process, sentencing philosophy, and disparities in criminal adjudication.",
  color: "indigo",
  theories: [
    {
      name: "Sentencing disparity",
      description: "Systematic differences in sentences based on race, class, gender, and geography — not legally relevant case factors.",
      tags: ["c20", "c21", "empirical"],
      tenet: "Sentencing outcomes are influenced by legally irrelevant factors — race, class, gender, geography — producing systematic disparities that undermine equal justice.",
      lineage: { parents: [], divergence: "root — empirical finding that motivates both sentencing reform and critical analysis of judicial discretion" },
      figures: ["Cassia Spohn", "Darrell Steffensmeier"],
      era: ["c20", "c21"],
      coreTenets: [
        "Black and Hispanic defendants receive harsher sentences than white defendants for comparable offenses, even after controlling for legally relevant factors.",
        "Gender disparities also exist: women generally receive more lenient sentences than men for comparable conduct.",
        "Geographic variation — between jurisdictions, between judges within jurisdictions — introduces a 'justice lottery' element.",
      ],
      keyThinkers: [
        "Cassia Spohn — How Do Judges Decide? (2002)",
        "Darrell Steffensmeier et al. — The Interaction of Race, Gender, and Age in Criminal Sentencing (1998)",
      ],
      principalCritiques: [
        "Methodological critics note that controlling for all legally relevant factors is impossible with available data — unobserved variables may explain apparent disparities.",
        "Some scholars argue that disparities reflect real differences in case characteristics rather than judicial bias.",
      ],
    },
    {
      name: "Determinate vs. indeterminate sentencing",
      description: "The debate between fixed sentences (determinate) and judge/parole board discretion (indeterminate) in setting punishment.",
      tags: ["c20", "policy-relevant"],
      tenet: "The choice between determinate sentencing (fixed terms set by statute) and indeterminate sentencing (discretionary terms set by judges and parole boards) reflects fundamental disagreements about the purpose of punishment.",
      lineage: { parents: ["Sentencing disparity"], divergence: "policy response: determinate sentencing emerged as a reform to reduce the disparities produced by indeterminate discretion" },
      figures: ["Andrew von Hirsch", "Marvin Frankel"],
      era: ["c20"],
      coreTenets: [
        "Indeterminate sentencing gives judges and parole boards broad discretion, supposedly tailoring punishment to the individual — but producing unequal outcomes.",
        "Determinate sentencing — including sentencing guidelines and mandatory minimums — aims to reduce disparity through uniformity.",
        "The shift from indeterminate to determinate sentencing in the 1970s-80s was driven by both liberal concerns about disparity and conservative demands for toughness.",
      ],
      keyThinkers: [
        "Marvin Frankel — Criminal Sentences: Law Without Order (1973)",
        "Andrew von Hirsch — Doing Justice (1976)",
      ],
      historicalInstances: [
        "US Sentencing Guidelines (1987)",
        "Three-strikes laws (California, 1994)",
        "Mandatory minimum sentences for drug offenses",
      ],
      principalCritiques: [
        "Critics of determinate sentencing argue it transfers discretion from judges to prosecutors (through charge bargaining) without reducing it.",
        "Mandatory minimums are criticized for producing unjustly harsh sentences for low-level offenders while contributing to mass incarceration.",
      ],
    },
    {
      name: "Plea bargaining",
      description: "Negotiated disposition of criminal cases — the dominant method of adjudication in American criminal justice, resolving over 95% of cases.",
      tags: ["c20", "c21"],
      tenet: "Plea bargaining resolves over 95% of criminal cases in the United States — making it the actual system of adjudication, not the trial the Constitution envisions.",
      lineage: { parents: [], divergence: "root — emerged as a practical necessity of overburdened courts; now the dominant form of criminal case disposition" },
      figures: ["Albert Alschuler", "George Fisher"],
      era: ["c20", "c21"],
      coreTenets: [
        "Plea bargaining is driven by case-processing pressures — courts cannot try more than a fraction of cases.",
        "Charge bargaining and sentence bargaining give prosecutors enormous leverage, especially when defendants face severe mandatory minimums.",
        "The trial penalty — the significantly harsher sentence defendants receive if they go to trial and lose — coerces guilty pleas.",
      ],
      keyThinkers: [
        "Albert Alschuler — The Defense Attorney's Role in Plea Bargaining (1975)",
        "George Fisher — Plea Bargaining's Triumph (2003)",
      ],
      principalCritiques: [
        "Critics argue plea bargaining is inherently coercive — innocent defendants may plead guilty to avoid the risk of a much harsher sentence at trial.",
        "Defense advocates contend that the indigent defense crisis means most defendants who plead guilty never received adequate legal representation.",
      ],
    },
  ],
};

// ── SECTION D: PENOLOGY & CORRECTIONS ───────────────────────────────────────

const PUNISHMENT_FAMILY: Family = {
  slug: "punishment-philosophy",
  name: "Punishment Philosophy",
  blurb: "Why punish? Retribution, deterrence, incapacitation, rehabilitation — the competing justifications for criminal punishment.",
  color: "fuchsia",
  theories: [
    {
      name: "Retribution",
      description: "Punishment is deserved — offenders ought to suffer in proportion to their moral culpability, regardless of consequences.",
      tags: ["foundational", "philosophy"],
      tenet: "Punishment is morally deserved — offenders have a just claim to suffer in proportion to the seriousness of their offense and their moral culpability.",
      lineage: { parents: [], divergence: "root — deontological justification: punishment is right because it is deserved, not because it produces good consequences" },
      figures: ["Immanuel Kant", "Andrew von Hirsch", "Michael Moore"],
      era: ["c18", "c20"],
      coreTenets: [
        "Punishment is justified because the offender deserves it — not as a means to deterrence, incapacitation, or reform.",
        "Proportionality is the limiting principle: punishment must fit the crime in seriousness.",
        "Retribution respects the offender as a rational moral agent responsible for their choices.",
      ],
      keyThinkers: [
        "Immanuel Kant — The Metaphysics of Morals (1797)",
        "Andrew von Hirsch — Doing Justice (1976)",
        "Michael Moore — Placing Blame (1997)",
      ],
      principalCritiques: [
        "Consequentialists argue that punishment inflicts suffering and must be justified by its beneficial effects, not by abstract desert.",
        "Critics contend that proportionality is indeterminate — there is no objective scale for matching punishment to offense seriousness.",
      ],
    },
    {
      name: "Rehabilitation",
      description: "Punishment should reform the offender — through treatment, education, and cognitive change — to reduce reoffending.",
      tags: ["c20", "policy-relevant"],
      tenet: "The purpose of criminal sanctions is to change offenders so they do not reoffend — through education, treatment, vocational training, and cognitive-behavioral intervention.",
      lineage: { parents: [], divergence: "root — consequentialist justification: punishment is justified by its capacity to reform the offender and reduce future crime" },
      figures: ["Francis Allen", "Robert Martinson", "Don Andrews", "James Bonta"],
      era: ["c20"],
      coreTenets: [
        "Offenders can change — criminogenic needs (antisocial attitudes, substance abuse, lack of skills) are modifiable risk factors.",
        "The Risk-Need-Responsivity (RNR) model matches treatment intensity to risk level and targets criminogenic needs with responsive methods.",
        "Rehabilitation reduces reoffending more effectively than incarceration alone, producing both public safety and cost benefits.",
      ],
      keyThinkers: [
        "Don Andrews & James Bonta — The Psychology of Criminal Conduct (1994)",
        "Francis Allen — The Decline of the Rehabilitative Ideal (1981)",
      ],
      historicalInstances: [
        "Rehabilitative ideal dominant in American corrections (1950s-70s)",
        "Martinson's 'Nothing Works' (1974) and its misinterpretation",
        "Revival of rehabilitation through evidence-based practices (1990s-present)",
      ],
      principalCritiques: [
        "Retributivists argue rehabilitation treats offenders as patients to be fixed rather than moral agents to be held accountable.",
        "Critics note Martinson's 'Nothing Works' review (later partly retracted) undermined rehabilitation's credibility for decades.",
      ],
    },
    {
      name: "Incapacitation",
      description: "Punishment prevents crime by physically removing offenders from society — through imprisonment, they cannot offend against the public.",
      tags: ["c20", "policy-relevant"],
      tenet: "Imprisonment prevents crime by physically removing offenders from society — while incarcerated, they cannot commit crimes against the general public.",
      lineage: { parents: [], divergence: "root — consequentialist justification focused on preventing crime through physical containment rather than deterrence or reform" },
      figures: ["James Q. Wilson", "Peter Greenwood"],
      era: ["c20"],
      coreTenets: [
        "Collective incapacitation: imprisoning more offenders for longer reduces the total crime rate.",
        "Selective incapacitation: targeting high-rate offenders for long sentences achieves the greatest crime reduction per prison bed.",
        "The effectiveness of incapacitation depends on the replacement rate — whether imprisoning one offender creates opportunity for another.",
      ],
      keyThinkers: [
        "James Q. Wilson — Thinking About Crime (1975)",
        "Peter Greenwood — Selective Incapacitation (1982)",
      ],
      principalCritiques: [
        "Mass incarceration research shows diminishing returns: as the prison population expands, additional imprisonment has smaller crime-reduction effects.",
        "Selective incapacitation relies on prediction instruments that produce high false-positive rates, imprisoning many who would not reoffend.",
        "The enormous human and fiscal costs of incapacitation — $35,000+ per prisoner per year — raise proportionality and efficiency concerns.",
      ],
    },
    {
      name: "Restorative justice",
      description: "Crime harms relationships; justice should repair harm by bringing together victims, offenders, and communities in facilitated dialogue.",
      tags: ["c20", "c21", "policy-relevant"],
      tenet: "Crime is fundamentally a violation of people and relationships; justice requires bringing together victims, offenders, and communities to repair the harm done.",
      lineage: { parents: ["Reintegrative shaming"], divergence: "practice-focused: builds on shaming theory to develop concrete processes (conferencing, circles, mediation) for repairing harm" },
      figures: ["Howard Zehr", "John Braithwaite", "Kay Pranis"],
      era: ["c20", "c21"],
      coreTenets: [
        "Crime harms victims, communities, and offenders — justice should address the needs of all three.",
        "Victims need information, participation, reparation, and vindication — needs the adversarial system largely ignores.",
        "Offenders should take responsibility, understand the impact of their actions, and make amends — not merely be punished.",
      ],
      keyThinkers: [
        "Howard Zehr — Changing Lenses (1990)",
        "John Braithwaite — Restorative Justice and Responsive Regulation (2002)",
      ],
      historicalInstances: [
        "Victim-offender mediation programmes (USA, Europe)",
        "Family group conferencing (New Zealand, since 1989)",
        "South Africa's Truth and Reconciliation Commission (restorative justice at scale)",
      ],
      principalCritiques: [
        "Critics argue restorative justice is inappropriate for serious violence — particularly domestic violence and sexual assault — where power imbalances make 'voluntary' participation problematic.",
        "Retributivists contend restorative justice is too lenient and fails to express the moral condemnation that serious crime deserves.",
      ],
    },
  ],
};

// ── Mass Incarceration & Alternatives ───────────────────────────────────────

const CORRECTIONS_FAMILY: Family = {
  slug: "corrections-alternatives",
  name: "Incarceration & Alternatives",
  blurb: "Mass incarceration, its consequences, and alternatives — probation, parole, diversion, and decarceration.",
  color: "emerald",
  theories: [
    {
      name: "Mass incarceration",
      description: "The unprecedented expansion of imprisonment in the United States — from 300,000 in 1970 to over 2 million by 2000.",
      tags: ["c20", "c21", "USA"],
      tenet: "The United States incarcerates more people than any nation in history — a policy transformation driven by politics, not crime rates, with devastating consequences for communities of color.",
      lineage: { parents: ["Incapacitation", "Drug offenses"], divergence: "critical analysis: examines how political choices (not crime trends) produced the world's largest prison population" },
      figures: ["Michelle Alexander", "Todd Clear", "Bruce Western"],
      era: ["c20", "c21"],
      coreTenets: [
        "The US incarceration rate quintupled between 1972 and 2008 — from ~160 to ~760 per 100,000 — driven primarily by policy changes, not crime rate increases.",
        "Drug enforcement, mandatory minimums, three-strikes laws, and truth-in-sentencing policies are the proximate causes.",
        "Mass incarceration has devastating collateral consequences — disenfranchisement, family disruption, employment barriers, concentrated disadvantage in communities of color.",
      ],
      keyThinkers: [
        "Michelle Alexander — The New Jim Crow (2010)",
        "Bruce Western — Punishment and Inequality in America (2006)",
        "Todd Clear — Imprisoning Communities (2007)",
      ],
      principalCritiques: [
        "Some scholars argue crime reduction from incapacitation contributed significantly to the crime decline of the 1990s, complicating the 'mass incarceration was unnecessary' narrative.",
        "International comparisons suggest the US is an outlier but that other countries are also increasing incarceration, suggesting broader forces at work.",
      ],
    },
    {
      name: "Collateral consequences of conviction",
      description: "The civil penalties that follow criminal conviction — loss of voting rights, housing, employment, education, and public benefits.",
      tags: ["c20", "c21", "policy-relevant"],
      tenet: "Criminal conviction triggers thousands of collateral consequences — restrictions on voting, housing, employment, and benefits — that extend punishment far beyond the sentence.",
      lineage: { parents: ["Mass incarceration"], divergence: "downstream effects: examines how formal and informal penalties beyond the sentence perpetuate disadvantage" },
      figures: ["Jeremy Travis", "Devah Pager"],
      era: ["c20", "c21"],
      coreTenets: [
        "There are over 44,000 collateral consequences of criminal conviction in US federal and state law.",
        "Criminal records create permanent barriers to employment, housing, and civic participation — even after sentence completion.",
        "Collateral consequences fall disproportionately on communities of color, compounding the effects of mass incarceration.",
      ],
      keyThinkers: [
        "Jeremy Travis — But They All Come Back (2005)",
        "Devah Pager — Marked: Race, Crime, and Finding Work in an Era of Mass Incarceration (2003)",
      ],
      principalCritiques: [
        "Advocates for victims argue some collateral consequences (sex offender registries, barring violent offenders from certain jobs) serve legitimate public safety functions.",
        "Critics note that ban-the-box and record-sealing reforms are incomplete solutions if background check technology enables private actors to circumvent them.",
      ],
    },
    {
      name: "Diversion and alternatives to incarceration",
      description: "Programmes that redirect offenders from traditional criminal processing — drug courts, mental health courts, community service, electronic monitoring.",
      tags: ["c20", "c21", "policy-relevant"],
      tenet: "Many offenders can be more effectively and cheaply managed outside prison — through drug courts, mental health courts, community service, and electronic monitoring.",
      lineage: { parents: ["Rehabilitation", "Restorative justice"], divergence: "system reform: creates alternative pathways through the criminal justice system for appropriate cases" },
      figures: ["various programme developers"],
      era: ["c20", "c21"],
      coreTenets: [
        "Diversion programmes interrupt the cycle of incarceration, stigma, and reoffending for low-risk offenders.",
        "Specialty courts (drug courts, mental health courts, veterans courts) address underlying conditions that drive offending.",
        "Community-based alternatives cost substantially less than incarceration while producing comparable or better recidivism outcomes.",
      ],
      keyThinkers: [
        "National Association of Drug Court Professionals",
        "Vera Institute of Justice — alternatives to incarceration research",
      ],
      historicalInstances: [
        "First drug court (Miami-Dade County, 1989)",
        "Mental health courts (first in Broward County, FL, 1997)",
        "Electronic monitoring / ankle bracelet programmes",
      ],
      principalCritiques: [
        "Net-widening: diversion programmes may bring people under criminal justice supervision who would otherwise have been left alone.",
        "Critics argue many alternatives extend state surveillance and control into the community without reducing the fundamental coerciveness of the system.",
      ],
    },
    {
      name: "Abolition and decarceration",
      description: "The criminal justice system — especially prisons — should be abolished or radically reduced, replaced by community-based responses to harm.",
      tags: ["c20", "c21", "contested"],
      tenet: "Prisons do not reduce crime; they warehouse the marginalized, reproduce violence, and should be abolished or radically reduced in favor of community-based responses to harm.",
      lineage: { parents: ["Marxist / Radical criminology", "Peacemaking criminology"], divergence: "radical: rejects reform of the prison system in favor of its abolition and replacement" },
      figures: ["Angela Davis", "Ruth Wilson Gilmore", "Thomas Mathiesen"],
      era: ["c20", "c21"],
      flagged: true,
      coreTenets: [
        "Prisons are institutions of racial and class control — not crime control — that produce more harm than they prevent.",
        "Abolition is not just the absence of prisons but the presence of alternative institutions for addressing harm (transformative justice, community accountability).",
        "Incremental reforms that expand the prison system's reach (reformism) should be distinguished from reforms that shrink it (non-reformist reforms).",
      ],
      keyThinkers: [
        "Angela Davis — Are Prisons Obsolete? (2003)",
        "Ruth Wilson Gilmore — Golden Gulag (2007)",
        "Thomas Mathiesen — The Politics of Abolition (1974)",
      ],
      principalCritiques: [
        "Critics argue abolitionists have not demonstrated viable alternatives for managing serious violent offenders who pose ongoing public safety risks.",
        "Pragmatic reformers contend that abolition's 'all or nothing' framing undermines achievable improvements in prison conditions and sentencing policy.",
      ],
    },
  ],
};

// ── SECTION E: VICTIMOLOGY ──────────────────────────────────────────────────

const VICTIMOLOGY_FAMILY: Family = {
  slug: "victimology",
  name: "Victimology",
  blurb: "The study of crime victims — who is victimized, why, and how the justice system does and should respond.",
  color: "pink",
  theories: [
    {
      name: "Victim precipitation theory",
      description: "Some victims contribute to their own victimization through provocation, negligence, or lifestyle — a contested framework.",
      tags: ["c20", "contested"],
      tenet: "Some crime victims contribute to their own victimization through behavior that provokes, facilitates, or precipitates the criminal event.",
      lineage: { parents: [], divergence: "root — earliest victimological framework; shifted attention from offender to victim characteristics and behavior" },
      figures: ["Hans von Hentig", "Marvin Wolfgang", "Benjamin Mendelsohn"],
      era: ["c20"],
      flagged: true,
      coreTenets: [
        "Victim-offender interaction is dynamic — victims are not always passive recipients of crime.",
        "Certain behaviors (provocation, displaying wealth, substance use in risky settings) increase victimization risk.",
        "Wolfgang found that a significant percentage of homicides involved victim precipitation — the victim struck the first blow.",
      ],
      keyThinkers: [
        "Hans von Hentig — The Criminal and His Victim (1948)",
        "Marvin Wolfgang — Patterns in Criminal Homicide (1958)",
        "Benjamin Mendelsohn — The Victimology (1956)",
      ],
      principalCritiques: [
        "Feminist scholars argue victim precipitation theory blames victims — especially victims of sexual assault — for their own victimization.",
        "Critics contend the concept conflates correlation (risky behavior and victimization) with causation and moral responsibility.",
      ],
    },
    {
      name: "Lifestyle-exposure theory",
      description: "Victimization risk is shaped by lifestyle patterns — daily routines, leisure activities, and social associations.",
      tags: ["c20", "empirical"],
      tenet: "Victimization risk is not random but is shaped by lifestyle patterns — daily routines, associations, and activities that increase or decrease exposure to potential offenders.",
      lineage: { parents: ["Victim precipitation theory", "Routine activity theory"], divergence: "structural: replaces individual blame with demographic and structural explanations for differential victimization risk" },
      figures: ["Michael Hindelang", "Michael Gottfredson", "James Garofalo"],
      era: ["c20"],
      coreTenets: [
        "Demographic characteristics (age, gender, race, income) shape lifestyle patterns that affect exposure to crime.",
        "Young, male, urban, low-income individuals have lifestyles that produce higher exposure to offenders and risky situations.",
        "Victimization is concentrated among the same populations that produce disproportionate offending — not coincidentally.",
      ],
      keyThinkers: [
        "Michael Hindelang, Michael Gottfredson & James Garofalo — Victims of Personal Crime (1978)",
      ],
      principalCritiques: [
        "Critics argue lifestyle-exposure theory is tautological — it predicts that those most exposed to crime are most victimized, which is definitionally true.",
        "Feminist scholars note the theory can still be used to blame victims for 'choosing' risky lifestyles without accounting for constrained choices.",
      ],
    },
    {
      name: "Victims' rights movement",
      description: "A social and legal movement to give crime victims a formal role in criminal proceedings — notification, participation, restitution.",
      tags: ["c20", "c21", "policy-relevant"],
      tenet: "Crime victims have been systematically excluded from the criminal justice process; they deserve notification, participation, protection, and restitution as a matter of right.",
      lineage: { parents: [], divergence: "root — advocacy movement that transformed the victim's role from passive witness to rights-bearing participant" },
      figures: ["Frank Carrington", "Marlene Young"],
      era: ["c20", "c21"],
      coreTenets: [
        "Victims should be notified of proceedings, consulted before plea agreements, and allowed to make impact statements at sentencing.",
        "Victim compensation programmes and restitution orders should provide financial recovery.",
        "The adversarial system's focus on the offender systematically neglects the needs and interests of the person harmed.",
      ],
      keyThinkers: [
        "Frank Carrington — The Victims (1975)",
        "President's Task Force on Victims of Crime (1982)",
      ],
      historicalInstances: [
        "Victim Impact Statements (Payne v. Tennessee, 1991)",
        "Crime Victims' Rights Act (USA, 2004)",
        "State constitutional amendments for victims' rights",
      ],
      principalCritiques: [
        "Defense advocates argue victims' rights expansion can undermine defendants' due process protections and fair trial guarantees.",
        "Critical scholars contend the victims' rights movement has been co-opted by law-and-order politics to justify harsher sentencing.",
      ],
    },
  ],
};

// ── SECTION F: MEASUREMENT ──────────────────────────────────────────────────

const MEASUREMENT_FAMILY: Family = {
  slug: "measurement",
  name: "Crime Measurement",
  blurb: "How crime is counted — official statistics, victimization surveys, self-reports, and the dark figure.",
  color: "gray",
  theories: [
    {
      name: "Uniform Crime Reports / NIBRS",
      description: "The FBI's official crime statistics programme — the primary source of national crime data in the United States since 1930.",
      tags: ["measurement", "USA"],
      tenet: "The UCR (and its successor NIBRS) provide the official national record of crimes known to police — the most widely used but systematically incomplete measure of crime.",
      lineage: { parents: [], divergence: "root — the foundational official crime measurement system in the United States" },
      figures: ["FBI", "International Association of Chiefs of Police"],
      era: ["c20", "c21"],
      coreTenets: [
        "UCR collects data on crimes known to police and arrests from participating agencies; NIBRS provides incident-level detail.",
        "The UCR Crime Index (Part I offenses) has been the standard measure for tracking crime trends.",
        "Limitations: only crimes reported to and recorded by police are counted; the 'dark figure' of unreported crime is substantial.",
      ],
      keyThinkers: [
        "FBI — Uniform Crime Reports (annually since 1930)",
        "James Lynch & Lynn Addington — Understanding Crime Statistics (2007)",
      ],
      principalCritiques: [
        "UCR data undercount crime because many offenses are never reported to police — particularly sexual assault, domestic violence, and property crime.",
        "Police recording practices vary across jurisdictions and over time, introducing measurement artifacts into trend analyses.",
      ],
    },
    {
      name: "National Crime Victimization Survey (NCVS)",
      description: "A household survey measuring criminal victimization whether or not crimes were reported to police — complementing official statistics.",
      tags: ["measurement", "USA", "empirical"],
      tenet: "The NCVS captures victimization experiences regardless of police reporting, revealing the 'dark figure' of unreported crime and providing a complementary measure to official statistics.",
      lineage: { parents: ["Uniform Crime Reports / NIBRS"], divergence: "methodological complement: measures crime from the victim's perspective, independent of police recording" },
      figures: ["Bureau of Justice Statistics"],
      era: ["c20", "c21"],
      coreTenets: [
        "The NCVS surveys approximately 240,000 individuals annually about their victimization experiences.",
        "It reveals that a substantial proportion of crimes — especially sexual assault and household theft — are never reported to police.",
        "Comparison of NCVS and UCR trends provides a more complete picture of crime than either source alone.",
      ],
      keyThinkers: [
        "Bureau of Justice Statistics — National Crime Victimization Survey",
        "Janet Lauritsen & Maribeth Rezey — Measuring the Prevalence of Crime with the NCVS (2013)",
      ],
      principalCritiques: [
        "The NCVS cannot measure homicide (victims are dead), crimes against businesses, or victimless offenses.",
        "Survey limitations include telescoping (reporting events from outside the reference period), memory decay, and reluctance to disclose sensitive victimization.",
      ],
    },
    {
      name: "The dark figure of crime",
      description: "The gap between crime that actually occurs and crime recorded in official statistics — the fundamental measurement problem in criminology.",
      tags: ["measurement", "foundational"],
      tenet: "Official crime statistics capture only a fraction of crime that actually occurs — the 'dark figure' of unreported and unrecorded crime is criminology's fundamental measurement challenge.",
      lineage: { parents: ["Uniform Crime Reports / NIBRS"], divergence: "critical concept: names the systematic gap between crime occurrence and official measurement" },
      figures: ["Adolphe Quetelet", "various criminologists"],
      era: ["c19", "c20"],
      coreTenets: [
        "Crime goes unreported for many reasons: victims fear retaliation, distrust police, consider the event trivial, or feel shame.",
        "Even reported crime may not be recorded by police — discretionary decisions about whether to file a report add another filter.",
        "The dark figure is not random but systematically biased — certain crimes, victims, and communities are more underrepresented than others.",
      ],
      keyThinkers: [
        "Adolphe Quetelet — early statistical analysis of crime data (1830s)",
        "Various — the concept is foundational to criminological methodology",
      ],
      principalCritiques: [
        "Some scholars argue the dark figure concept is used to dismiss official statistics without offering equally reliable alternatives.",
        "Others note that self-report and victimization surveys each have their own dark figures — there is no perfectly transparent measure of crime.",
      ],
    },
  ],
};

export const FAMILIES_CD: Family[] = [
  WHITE_COLLAR_FAMILY,
  POLICING_FAMILY,
  COURTS_FAMILY,
  PUNISHMENT_FAMILY,
  CORRECTIONS_FAMILY,
  VICTIMOLOGY_FAMILY,
  MEASUREMENT_FAMILY,
];

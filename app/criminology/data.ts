export type Theory = {
  name: string;
  description: string;
  tags: string[];
  tenet: string;
  lineage: { parents: string[]; divergence: string; contested?: boolean };
  figures: string[];
  era: string[];
  coreTenets: string[];
  keyThinkers: string[];
  historicalInstances?: string[];
  principalCritiques: string[];
  broadFamily?: boolean;
  flagged?: boolean;
};

export type Family = {
  slug: string;
  name: string;
  blurb: string;
  color: string;
  theories: Theory[];
  broadFamily?: boolean;
};

// ── SECTION A: THEORIES OF CRIME ────────────────────────────────────────────

// ── Family 1: Classical & Rational Choice ───────────────────────────────────

const CLASSICAL_RATIONAL_FAMILY: Family = {
  slug: "classical-rational",
  name: "Classical & Rational Choice",
  blurb: "Crime as rational calculation — offenders weigh costs against benefits before acting.",
  color: "blue",
  theories: [
    {
      name: "Classical criminology",
      description: "Crime is a rational choice; punishment must be proportionate, certain, and swift to deter.",
      tags: ["c18", "foundational"],
      tenet: "Crime results from free will and rational calculation; proportionate punishment deters rational actors.",
      lineage: { parents: [], divergence: "root — Enlightenment rejection of arbitrary justice and superstitious explanations of crime" },
      figures: ["Cesare Beccaria", "Jeremy Bentham"],
      era: ["c18"],
      coreTenets: [
        "Individuals possess free will and choose crime after weighing pleasure against pain.",
        "Punishment must be proportionate to the offense — severe enough to outweigh the gain, but no more.",
        "Certainty and swiftness of punishment deter more effectively than severity alone.",
      ],
      keyThinkers: [
        "Cesare Beccaria — On Crimes and Punishments (1764)",
        "Jeremy Bentham — An Introduction to the Principles of Morals and Legislation (1789)",
      ],
      historicalInstances: [
        "Beccaria's influence on Enlightenment penal reform across Europe",
        "Bentham's Panopticon prison design as applied deterrence",
        "Foundation of modern criminal law codification",
      ],
      principalCritiques: [
        "Positivists argue classical theory ignores biological, psychological, and social causes of crime that constrain free will.",
        "Critical criminologists contend the model assumes a level playing field, ignoring how poverty and inequality shape criminal opportunity.",
      ],
    },
    {
      name: "Rational choice theory",
      description: "Offenders make cost-benefit decisions shaped by situational factors and perceived opportunities.",
      tags: ["c20", "policy-relevant"],
      tenet: "Crime is a purposive decision in which offenders evaluate expected costs, benefits, and situational opportunities.",
      lineage: { parents: ["Classical criminology"], divergence: "modernized: adds bounded rationality and situational decision-making to classical cost-benefit framework" },
      figures: ["Derek Cornish", "Ronald Clarke"],
      era: ["c20"],
      coreTenets: [
        "Offenders are reasoning decision-makers, though their rationality is bounded and imperfect.",
        "Criminal decisions are event-specific — shaped by the immediate situation, not just general disposition.",
        "Crime prevention should increase perceived costs and reduce perceived benefits at the point of decision.",
      ],
      keyThinkers: [
        "Derek Cornish & Ronald Clarke — The Reasoning Criminal (1986)",
        "Gary Becker — Crime and Punishment: An Economic Approach (1968)",
      ],
      principalCritiques: [
        "Critics argue the model overstates rationality; many crimes are impulsive, emotional, or committed under the influence of substances.",
        "Structural criminologists contend it ignores how inequality and deprivation constrain the range of choices available.",
      ],
    },
    {
      name: "Routine activity theory",
      description: "Crime occurs when a motivated offender meets a suitable target in the absence of a capable guardian.",
      tags: ["c20", "policy-relevant", "spatial"],
      tenet: "Crime requires the convergence in time and space of a motivated offender, a suitable target, and the absence of capable guardianship.",
      lineage: { parents: ["Classical criminology"], divergence: "shifts focus from offender motivation to the situational opportunity structure" },
      figures: ["Lawrence Cohen", "Marcus Felson"],
      era: ["c20"],
      coreTenets: [
        "Crime is a normal event that requires opportunity, not pathology.",
        "Changes in routine activities — commuting, shopping, leisure — alter crime rates by changing target-guardian convergence.",
        "Reducing opportunities through guardianship and target hardening is more effective than trying to change motivation.",
      ],
      keyThinkers: [
        "Lawrence Cohen & Marcus Felson — Social Change and Crime Rate Trends (1979)",
        "Marcus Felson — Crime and Everyday Life",
      ],
      historicalInstances: [
        "Post-WWII crime increases explained by changing routine activities (more empty homes, portable electronics)",
        "Application to cybercrime opportunity structures",
      ],
      principalCritiques: [
        "Critics argue the theory takes offender motivation as given, offering no explanation of why some people are motivated to offend.",
        "Feminist criminologists note it can implicitly blame victims for failing to be adequately guarded.",
      ],
    },
    {
      name: "Deterrence theory",
      description: "The threat of punishment prevents crime through its certainty, severity, and swiftness.",
      tags: ["c18", "c20", "policy-relevant"],
      tenet: "The threat of punishment prevents crime when punishment is perceived as certain, severe, and swift.",
      lineage: { parents: ["Classical criminology"], divergence: "focused elaboration of classical punishment logic into general and specific deterrence" },
      figures: ["Cesare Beccaria", "Jeremy Bentham", "Daniel Nagin"],
      era: ["c18", "c20"],
      coreTenets: [
        "General deterrence operates on the population: publicized punishment discourages potential offenders.",
        "Specific deterrence operates on the individual: experienced punishment discourages reoffending.",
        "Certainty of punishment has a stronger deterrent effect than severity.",
      ],
      keyThinkers: [
        "Daniel Nagin — Deterrence in the Twenty-First Century (2013)",
        "Jack Gibbs — Crime, Punishment, and Deterrence (1975)",
      ],
      principalCritiques: [
        "Empirical research finds that increasing severity of punishment (e.g., longer sentences) has diminishing or negligible deterrent effects.",
        "Labeling theorists argue that punishment can increase reoffending by marginalizing the punished (a criminogenic effect).",
      ],
    },
    {
      name: "Situational crime prevention",
      description: "Reduce crime by altering the immediate environment — increase effort, increase risk, reduce reward.",
      tags: ["c20", "policy-relevant", "applied"],
      tenet: "Crime can be prevented by systematically altering the situation to increase effort, increase risk, and reduce rewards for offending.",
      lineage: { parents: ["Rational choice theory", "Routine activity theory"], divergence: "applied synthesis: translates rational choice and routine activity into 25 techniques of opportunity reduction" },
      figures: ["Ronald Clarke", "Ross Homel"],
      era: ["c20"],
      coreTenets: [
        "Crime is highly specific — prevention must target particular crime types in particular settings.",
        "Twenty-five techniques organized under five headings: increase effort, increase risk, reduce rewards, reduce provocations, remove excuses.",
        "Displacement is typically partial, not complete; prevention often produces a diffusion of benefits to nearby areas.",
      ],
      keyThinkers: [
        "Ronald Clarke — Situational Crime Prevention: Successful Case Studies (1997)",
        "Ross Homel — The Politics and Practice of Situational Crime Prevention (1996)",
      ],
      historicalInstances: [
        "Steering column locks reducing car theft",
        "CCTV in parking lots reducing vehicle crime",
        "Suicide prevention through means restriction (gas detoxification, bridge barriers)",
      ],
      principalCritiques: [
        "Critics argue situational prevention merely displaces crime to other times, places, or methods rather than reducing it.",
        "Critical criminologists contend it ignores root causes and produces a fortress society that protects the privileged.",
      ],
    },
  ],
};

// ── Family 2: Biological & Biosocial ────────────────────────────────────────

const BIOLOGICAL_FAMILY: Family = {
  slug: "biological-biosocial",
  name: "Biological & Biosocial",
  blurb: "Biological factors — genetics, neurology, physiology — as contributors to criminal behavior.",
  color: "green",
  theories: [
    {
      name: "Lombroso's born criminal",
      description: "Criminals are evolutionary throwbacks identifiable by physical stigmata — historically foundational but scientifically refuted.",
      tags: ["c19", "foundational", "refuted"],
      tenet: "The born criminal is an atavistic throwback to an earlier evolutionary stage, identifiable by physical anomalies.",
      lineage: { parents: [], divergence: "root — first systematic positivist criminology; shifted focus from the crime to the criminal" },
      figures: ["Cesare Lombroso"],
      era: ["c19"],
      flagged: true,
      coreTenets: [
        "Some individuals are born criminals — biological throwbacks to a more primitive human type.",
        "Physical stigmata (cranial asymmetry, protruding jaws, etc.) can identify the born criminal type.",
        "Crime has biological roots and cannot be explained solely by free will or social conditions.",
      ],
      keyThinkers: [
        "Cesare Lombroso — Criminal Man (L'Uomo Delinquente, 1876)",
        "Enrico Ferri — Criminal Sociology",
        "Raffaele Garofalo — Criminology",
      ],
      historicalInstances: [
        "Italian positivist school of criminology",
        "Lombrosian criminal anthropology measurements in prisons",
      ],
      principalCritiques: [
        "Lombroso's atavism thesis and physical stigmata have been thoroughly refuted by modern biology and genetics.",
        "Critics note the theory was used to justify racist and eugenic programmes targeting marginalized populations.",
        "Charles Goring's statistical study The English Convict (1913) found no significant physical differences between criminals and non-criminals.",
      ],
    },
    {
      name: "Twin and adoption studies",
      description: "Behavioral genetics research finding moderate heritable component in antisocial behavior.",
      tags: ["c20", "empirical"],
      tenet: "Twin and adoption studies demonstrate a moderate but significant heritable component in antisocial and criminal behavior.",
      lineage: { parents: ["Lombroso's born criminal"], divergence: "modern: replaces atavism with statistical behavioral genetics; acknowledges gene-environment interaction" },
      figures: ["Karl Christiansen", "Sarnoff Mednick", "Terrie Moffitt"],
      era: ["c20"],
      coreTenets: [
        "Monozygotic twins show higher concordance for criminality than dizygotic twins, indicating heritable influence.",
        "Adoption studies find that biological parents' criminality predicts adoptees' offending more than adoptive parents' criminality.",
        "Heritability is moderate (approximately 40-60% of variance); environmental factors remain substantial.",
      ],
      keyThinkers: [
        "Sarnoff Mednick — The Causes of Crime: New Biological Approaches (1987)",
        "Terrie Moffitt — Adolescence-Limited and Life-Course-Persistent Antisocial Behavior (1993)",
      ],
      principalCritiques: [
        "Critics argue twin studies cannot fully separate genetic from shared environmental effects.",
        "Sociologists contend that even a heritable predisposition requires social triggers and should not be used to biologize crime.",
      ],
    },
    {
      name: "Neurocriminology",
      description: "Brain structure, function, and neurochemistry as factors in violent and antisocial behavior.",
      tags: ["c20", "c21", "empirical"],
      tenet: "Variations in brain structure, neurochemistry, and function contribute to the propensity for violence and antisocial behavior.",
      lineage: { parents: ["Twin and adoption studies"], divergence: "neuroimaging era: locates biological risk in specific brain regions and neurotransmitter systems" },
      figures: ["Adrian Raine", "Kent Kiehl"],
      era: ["c20", "c21"],
      coreTenets: [
        "Prefrontal cortex deficits are associated with impulsivity, poor decision-making, and violent behavior.",
        "Amygdala dysfunction contributes to reduced fear conditioning and empathy deficits in psychopathy.",
        "Neurotransmitter imbalances (especially low serotonin, high dopamine) are associated with aggression.",
      ],
      keyThinkers: [
        "Adrian Raine — The Anatomy of Violence (2013)",
        "Kent Kiehl — The Psychopath Whisperer (2014)",
      ],
      principalCritiques: [
        "Critics argue neurocriminology risks biological determinism and premature application to criminal justice policy.",
        "Methodological concerns include small sample sizes, reverse causation, and the ecological fallacy of inferring individual behavior from group-level brain differences.",
      ],
    },
    {
      name: "Biosocial criminology",
      description: "Gene-environment interaction: biological predispositions interact with social environments to produce criminal behavior.",
      tags: ["c20", "c21", "integrative"],
      tenet: "Criminal behavior emerges from the interaction of biological predispositions with social and environmental conditions.",
      lineage: { parents: ["Twin and adoption studies", "Neurocriminology"], divergence: "integrative: insists on gene-environment interaction rather than biological or social determinism alone" },
      figures: ["Terrie Moffitt", "Kevin Beaver", "John Paul Wright"],
      era: ["c20", "c21"],
      coreTenets: [
        "Neither biology nor environment alone explains crime; the interaction between the two is the causal mechanism.",
        "The MAOA gene variant combined with childhood maltreatment significantly increases risk of antisocial behavior (Caspi et al., 2002).",
        "Prenatal exposure to toxins, poor nutrition, and early-life adversity alter neurological development in ways that increase criminogenic risk.",
      ],
      keyThinkers: [
        "Avshalom Caspi & Terrie Moffitt — Role of Genotype in the Cycle of Violence (2002)",
        "Kevin Beaver — Biosocial Criminology (2009)",
      ],
      principalCritiques: [
        "Critical criminologists argue biosocial research can be co-opted to justify surveillance, profiling, or eugenic policies targeting disadvantaged populations.",
        "Methodological critics note candidate gene studies (like the MAOA finding) have often failed to replicate in larger samples.",
      ],
    },
  ],
};

// ── Family 3: Psychological & Developmental ─────────────────────────────────

const PSYCHOLOGICAL_FAMILY: Family = {
  slug: "psychological-developmental",
  name: "Psychological & Developmental",
  blurb: "Individual psychology — personality, cognition, moral development — as explanations for offending.",
  color: "purple",
  theories: [
    {
      name: "Psychoanalytic criminology",
      description: "Criminal behavior as expression of unconscious conflict, unresolved developmental fixation, or defective superego.",
      tags: ["c20", "clinical"],
      tenet: "Crime expresses unconscious psychic conflict — a weak superego, unresolved Oedipal dynamics, or the pleasure principle overriding reality.",
      lineage: { parents: [], divergence: "root — applies Freudian psychoanalysis to criminal behavior" },
      figures: ["Sigmund Freud", "August Aichhorn", "Kate Friedlander"],
      era: ["c20"],
      coreTenets: [
        "Criminal behavior results from an underdeveloped or defective superego that fails to internalize societal norms.",
        "Unconscious guilt may drive some individuals to commit crime in order to invite punishment.",
        "Early childhood experiences — particularly disrupted attachment — shape the personality structures that predispose to offending.",
      ],
      keyThinkers: [
        "August Aichhorn — Wayward Youth (1925)",
        "Kate Friedlander — The Psycho-Analytical Approach to Juvenile Delinquency (1947)",
      ],
      principalCritiques: [
        "Critics argue psychoanalytic explanations are unfalsifiable — any behavior can be retroactively explained by unconscious dynamics.",
        "Empirical criminologists contend the theory lacks testable predictions and has little predictive validity.",
      ],
    },
    {
      name: "Personality and trait theories",
      description: "Stable personality dimensions — extraversion, neuroticism, psychoticism — predispose to criminal behavior.",
      tags: ["c20", "empirical"],
      tenet: "Criminal behavior is associated with measurable personality traits, particularly high extraversion, high neuroticism, and high psychoticism.",
      lineage: { parents: ["Psychoanalytic criminology"], divergence: "empirical shift: replaces psychoanalytic constructs with measurable personality dimensions" },
      figures: ["Hans Eysenck"],
      era: ["c20"],
      coreTenets: [
        "Criminals score higher on extraversion (sensation-seeking), neuroticism (emotional instability), and psychoticism (tough-mindedness).",
        "These traits have a biological basis in cortical arousal and autonomic nervous system functioning.",
        "Personality-based conditioning explains why some individuals fail to learn social rules that deter crime.",
      ],
      keyThinkers: [
        "Hans Eysenck — Crime and Personality (1964)",
      ],
      principalCritiques: [
        "Meta-analyses show only modest correlations between Eysenck's personality dimensions and criminal behavior.",
        "Sociological critics argue personality approaches ignore the social structures that create the conditions for crime.",
      ],
    },
    {
      name: "Cognitive-developmental theories",
      description: "Criminal behavior linked to arrested moral reasoning — offenders stuck at preconventional moral stages.",
      tags: ["c20", "developmental"],
      tenet: "Offenders operate at lower stages of moral reasoning, failing to progress beyond self-interested or approval-seeking moral logic.",
      lineage: { parents: ["Psychoanalytic criminology"], divergence: "cognitive turn: replaces drive theory with stages of moral reasoning and cognitive processing" },
      figures: ["Lawrence Kohlberg", "John Gibbs", "Samuel Yochelson", "Stanton Samenow"],
      era: ["c20"],
      coreTenets: [
        "Moral reasoning develops through invariant stages; offenders are disproportionately found at preconventional stages.",
        "Criminal thinking involves systematic cognitive distortions — externalizing blame, assuming the worst, minimizing consequences.",
        "Cognitive-behavioral interventions that restructure thinking patterns can reduce reoffending.",
      ],
      keyThinkers: [
        "Lawrence Kohlberg — Essays on Moral Development (1981)",
        "Samuel Yochelson & Stanton Samenow — The Criminal Personality (1976)",
      ],
      historicalInstances: [
        "Moral Reconation Therapy (MRT) in corrections",
        "Reasoning and Rehabilitation (R&R) programme",
      ],
      principalCritiques: [
        "Critics note that many offenders reason at conventional moral levels but offend anyway — the gap between moral judgment and moral action.",
        "Cultural critics argue Kohlberg's stages reflect Western liberal values and may not generalize cross-culturally.",
      ],
    },
    {
      name: "Psychopathy",
      description: "A personality construct characterized by callousness, manipulativeness, impulsivity, and shallow affect — distinct from general antisocial behavior.",
      tags: ["c20", "c21", "clinical", "empirical"],
      tenet: "Psychopathy is a distinct personality construct — characterized by callous-unemotional traits and instrumental aggression — with neurobiological substrates.",
      lineage: { parents: ["Personality and trait theories"], divergence: "clinical specialization: identifies a distinct subtype of antisocial personality with unique affective and interpersonal features" },
      figures: ["Hervey Cleckley", "Robert Hare"],
      era: ["c20", "c21"],
      coreTenets: [
        "Psychopathy involves interpersonal (grandiosity, manipulation), affective (shallow emotion, callousness), and behavioral (impulsivity, irresponsibility) dimensions.",
        "The Psychopathy Checklist-Revised (PCL-R) reliably measures the construct and predicts violent recidivism.",
        "Psychopathy is associated with amygdala dysfunction, reduced fear conditioning, and impaired empathic processing.",
      ],
      keyThinkers: [
        "Hervey Cleckley — The Mask of Sanity (1941)",
        "Robert Hare — Without Conscience (1993)",
      ],
      principalCritiques: [
        "Critics argue the PCL-R is overused in forensic settings and risks labeling individuals as untreatable based on a checklist score.",
        "Some researchers contend psychopathy may not be a discrete category but rather the extreme end of normal personality variation.",
      ],
    },
  ],
};

// ── Family 4: Social Disorganization & Strain ───────────────────────────────

const STRAIN_FAMILY: Family = {
  slug: "social-disorganization-strain",
  name: "Social Disorganization & Strain",
  blurb: "Crime as product of social structure — disorganized communities, blocked opportunities, and institutional failure.",
  color: "amber",
  theories: [
    {
      name: "Chicago School / Social disorganization",
      description: "Crime concentrates in transitional urban zones where community institutions have broken down.",
      tags: ["c20", "foundational", "spatial"],
      tenet: "Crime concentrates in disorganized neighborhoods characterized by poverty, residential instability, and ethnic heterogeneity that weaken informal social control.",
      lineage: { parents: [], divergence: "root — first systematic ecological study of crime; locates cause in place, not person" },
      figures: ["Clifford Shaw", "Henry McKay", "Robert Park", "Ernest Burgess"],
      era: ["c20"],
      coreTenets: [
        "Crime rates are a property of places, not of the people who live there — when populations turn over, crime rates in zones of transition remain high.",
        "Rapid urbanization, residential instability, poverty, and ethnic heterogeneity undermine community institutions.",
        "Weakened informal social controls (neighbors, churches, civic groups) fail to regulate behavior, leading to higher crime.",
      ],
      keyThinkers: [
        "Clifford Shaw & Henry McKay — Juvenile Delinquency and Urban Areas (1942)",
        "Robert Sampson & W. Byron Groves — Community Structure and Crime (1989)",
      ],
      historicalInstances: [
        "Concentric zone studies of Chicago (1920s-30s)",
        "Project on Human Development in Chicago Neighborhoods (PHDCN)",
      ],
      principalCritiques: [
        "Critics argue the theory assumes a consensus on values and overlooks how power and inequality produce disorganization.",
        "Collective efficacy research (Sampson) refined the theory by showing that poverty does not automatically produce disorganization where residents maintain mutual trust and willingness to intervene.",
      ],
    },
    {
      name: "Anomie / Strain theory (Merton)",
      description: "Crime results from the gap between culturally prescribed goals and the legitimate means to achieve them.",
      tags: ["c20", "foundational"],
      tenet: "When society emphasizes success goals (wealth) but restricts legitimate means for many, the resulting strain produces deviance.",
      lineage: { parents: [], divergence: "root — applies Durkheim's anomie concept to American class structure and the success ethic" },
      figures: ["Emile Durkheim", "Robert K. Merton"],
      era: ["c20"],
      coreTenets: [
        "American culture universalizes the goal of material success while structurally limiting legitimate means (education, jobs) for the lower class.",
        "The disjunction between goals and means produces strain, to which individuals adapt through conformity, innovation, ritualism, retreatism, or rebellion.",
        "Innovation — accepting the goal but using illegitimate means — is the adaptation most associated with crime.",
      ],
      keyThinkers: [
        "Robert K. Merton — Social Structure and Anomie (1938)",
        "Emile Durkheim — The Division of Labor in Society (1893) and Suicide (1897)",
      ],
      principalCritiques: [
        "The theory cannot explain why most strained individuals do not turn to crime, nor why middle-class and white-collar crime exists.",
        "Critics note it is culturally specific to the United States and its particular achievement ideology.",
      ],
    },
    {
      name: "General strain theory",
      description: "Crime results from negative emotions — anger, frustration — produced by strainful experiences and relationships.",
      tags: ["c20", "integrative"],
      tenet: "Strain produces negative emotions (especially anger), which create pressure for corrective action, including crime.",
      lineage: { parents: ["Anomie / Strain theory (Merton)"], divergence: "expanded: moves beyond blocked goals to include multiple sources of strain and emotional mechanisms" },
      figures: ["Robert Agnew"],
      era: ["c20"],
      coreTenets: [
        "Three types of strain: failure to achieve positively valued goals, loss of positive stimuli, and presentation of negative stimuli.",
        "Strain produces negative emotions — anger, frustration, depression — that create pressure for corrective action.",
        "Crime is one possible coping response; whether strain leads to crime depends on coping resources, social support, and the nature of the strain.",
      ],
      keyThinkers: [
        "Robert Agnew — Foundation for a General Strain Theory of Crime and Delinquency (1992)",
        "Robert Agnew — Pressured into Crime (2006)",
      ],
      principalCritiques: [
        "Critics argue the theory is so broad that almost any negative experience counts as strain, reducing its falsifiability.",
        "Empirical tests find modest effect sizes; strain explains some but not most of the variation in offending.",
      ],
    },
    {
      name: "Institutional anomie theory",
      description: "Crime is high when economic institutions dominate non-economic institutions (family, education, polity) that normally restrain it.",
      tags: ["c20", "macro-level"],
      tenet: "High crime rates result when the economy dominates and weakens non-economic institutions — family, education, polity — that normally restrain crime.",
      lineage: { parents: ["Anomie / Strain theory (Merton)"], divergence: "macro-institutional: shifts from individual adaptation to institutional balance across the entire social structure" },
      figures: ["Steven Messner", "Richard Rosenfeld"],
      era: ["c20"],
      coreTenets: [
        "The American Dream's emphasis on monetary success devalues non-economic institutional roles and norms.",
        "When economic logic colonizes family, education, and politics, these institutions lose their capacity to restrain crime.",
        "Cross-national variation in crime rates reflects variation in the balance between economic and non-economic institutions.",
      ],
      keyThinkers: [
        "Steven Messner & Richard Rosenfeld — Crime and the American Dream (1994)",
      ],
      principalCritiques: [
        "Critics argue the theory is difficult to test empirically because measuring 'institutional dominance' is methodologically challenging.",
        "Some scholars contend it overgeneralizes from the American case and does not account for high-crime societies with weak market economies.",
      ],
    },
    {
      name: "Subcultural theories",
      description: "Delinquent subcultures arise in lower-class communities as collective solutions to status frustration and blocked opportunity.",
      tags: ["c20"],
      tenet: "Lower-class youth form delinquent subcultures that provide alternative status systems and collective solutions to structural disadvantage.",
      lineage: { parents: ["Anomie / Strain theory (Merton)", "Chicago School / Social disorganization"], divergence: "group-level: explains how strain produces collective cultural responses, not just individual adaptations" },
      figures: ["Albert Cohen", "Richard Cloward", "Lloyd Ohlin", "Walter Miller"],
      era: ["c20"],
      coreTenets: [
        "Lower-class youth experience status frustration when judged by middle-class standards they cannot meet (Cohen).",
        "Delinquent subcultures form as collective solutions — providing alternative criteria for status and respect.",
        "Differential opportunity structures determine the type of subculture that emerges — criminal, conflict, or retreatist (Cloward & Ohlin).",
      ],
      keyThinkers: [
        "Albert Cohen — Delinquent Boys (1955)",
        "Richard Cloward & Lloyd Ohlin — Delinquency and Opportunity (1960)",
        "Walter Miller — Lower Class Culture as a Generating Milieu of Gang Delinquency (1958)",
      ],
      historicalInstances: [
        "Mobilization for Youth programme (NYC, 1960s) — policy application of Cloward & Ohlin",
      ],
      principalCritiques: [
        "Critics argue subcultural theories assume lower-class youth reject middle-class values, when they may hold them simultaneously (Matza's drift theory).",
        "Feminist criminologists note these theories focus exclusively on male delinquency and ignore girls' experiences.",
      ],
    },
  ],
};

// ── Family 5: Social Learning & Control ─────────────────────────────────────

const LEARNING_CONTROL_FAMILY: Family = {
  slug: "social-learning-control",
  name: "Social Learning & Control",
  blurb: "Crime learned through association with others — or unleashed when social bonds and self-control fail.",
  color: "teal",
  theories: [
    {
      name: "Differential association",
      description: "Criminal behavior is learned through intimate social interaction — primarily definitions favorable to law violation.",
      tags: ["c20", "foundational"],
      tenet: "Criminal behavior is learned in interaction with intimate personal groups; a person becomes criminal when definitions favorable to law violation exceed definitions unfavorable.",
      lineage: { parents: [], divergence: "root — first systematic sociological learning theory of crime; crime is normal learned behavior, not pathology" },
      figures: ["Edwin Sutherland"],
      era: ["c20"],
      coreTenets: [
        "Criminal behavior is learned, not inherited or invented; it is learned through communication in intimate groups.",
        "Learning includes techniques of committing crime and the motives, drives, rationalizations, and attitudes that support it.",
        "A person becomes criminal when definitions favorable to violation of law exceed definitions unfavorable — the principle of differential association.",
      ],
      keyThinkers: [
        "Edwin Sutherland — Principles of Criminology (1947, 4th ed.)",
      ],
      principalCritiques: [
        "Critics argue the theory is difficult to test because 'definitions favorable to law violation' are hard to operationalize and measure.",
        "The theory cannot easily explain crimes committed by individuals without obvious criminal associations (e.g., isolated offenders).",
      ],
    },
    {
      name: "Social learning theory (Akers)",
      description: "Crime is learned through differential association, definitions, differential reinforcement, and imitation.",
      tags: ["c20", "integrative"],
      tenet: "Criminal behavior is acquired and sustained through four mechanisms: differential association, definitions, differential reinforcement, and imitation.",
      lineage: { parents: ["Differential association"], divergence: "expanded: adds behavioral learning mechanisms (reinforcement, imitation) to Sutherland's symbolic framework" },
      figures: ["Ronald Akers", "Robert Burgess"],
      era: ["c20"],
      coreTenets: [
        "Differential association provides the social context in which learning occurs.",
        "Definitions (attitudes, rationalizations) are the cognitive orientations that define behavior as right or wrong.",
        "Differential reinforcement — the balance of anticipated and actual rewards versus punishments — sustains or extinguishes criminal behavior.",
      ],
      keyThinkers: [
        "Ronald Akers — Social Learning and Social Structure (1998)",
        "Robert Burgess & Ronald Akers — A Differential Association-Reinforcement Theory of Criminal Behavior (1966)",
      ],
      principalCritiques: [
        "Critics argue the theory is tautological — people learn crime from criminals and become criminals because they learned crime.",
        "Structural criminologists contend it underemphasizes how social inequality shapes the learning environment.",
      ],
    },
    {
      name: "Social bond / control theory",
      description: "People refrain from crime because of their bonds to conventional society — attachment, commitment, involvement, belief.",
      tags: ["c20", "foundational"],
      tenet: "The question is not why people commit crime but why they conform; conformity results from strong social bonds to conventional society.",
      lineage: { parents: [], divergence: "root — inverts the usual question; assumes universal motivation to offend and asks what constrains it" },
      figures: ["Travis Hirschi"],
      era: ["c20"],
      coreTenets: [
        "Attachment to parents, teachers, and peers creates emotional stakes in conformity.",
        "Commitment to conventional activities (education, career) creates rational stakes — too much to lose.",
        "Involvement in conventional activities reduces time available for deviance; belief in moral validity of rules provides internal control.",
      ],
      keyThinkers: [
        "Travis Hirschi — Causes of Delinquency (1969)",
      ],
      principalCritiques: [
        "Critics argue the theory cannot explain white-collar crime by well-bonded individuals or crime committed in groups with strong internal bonds.",
        "Labeling theorists contend that the theory ignores how the criminal justice system itself weakens social bonds.",
      ],
    },
    {
      name: "Self-control theory / General Theory of Crime",
      description: "Low self-control — established by age 8 through ineffective parenting — is the primary individual cause of crime across all types.",
      tags: ["c20", "foundational"],
      tenet: "Low self-control, established in early childhood through ineffective parenting, is the primary individual-level cause of crime at all ages.",
      lineage: { parents: ["Social bond / control theory"], divergence: "radical simplification: replaces four bonds with a single trait (self-control) established by age 8" },
      figures: ["Michael Gottfredson", "Travis Hirschi"],
      era: ["c20"],
      coreTenets: [
        "Low self-control manifests as impulsivity, insensitivity, risk-seeking, short-sightedness, and preference for simple tasks.",
        "Self-control is established by age 6-8 and remains relatively stable thereafter; ineffective parenting (poor monitoring, inconsistent discipline) is the primary cause of low self-control.",
        "Low self-control explains not only crime but analogous behaviors — smoking, drinking, risky sex, accidents — that provide immediate gratification.",
      ],
      keyThinkers: [
        "Michael Gottfredson & Travis Hirschi — A General Theory of Crime (1990)",
      ],
      principalCritiques: [
        "Critics argue the theory is tautological if self-control is measured by the very behaviors it is supposed to explain.",
        "Research shows self-control does change over the life course, contradicting the stability thesis; situational and peer factors also matter.",
      ],
    },
    {
      name: "Techniques of neutralization",
      description: "Offenders maintain conventional values but temporarily neutralize moral constraints through rationalizations before offending.",
      tags: ["c20"],
      tenet: "Delinquents share conventional values but use rationalizations — techniques of neutralization — to temporarily suspend moral inhibitions before offending.",
      lineage: { parents: ["Differential association"], divergence: "challenges subcultural theory: delinquents do not reject mainstream values but neutralize them situationally" },
      figures: ["Gresham Sykes", "David Matza"],
      era: ["c20"],
      coreTenets: [
        "Five techniques: denial of responsibility, denial of injury, denial of the victim, condemnation of condemners, appeal to higher loyalties.",
        "Neutralizations precede the criminal act and make it psychologically possible for otherwise conventional individuals.",
        "Delinquents drift between conformity and delinquency rather than committing fully to a delinquent subculture.",
      ],
      keyThinkers: [
        "Gresham Sykes & David Matza — Techniques of Neutralization (1957)",
        "David Matza — Delinquency and Drift (1964)",
      ],
      principalCritiques: [
        "Empirical research is divided on whether neutralizations precede offending (enabling it) or follow it (rationalizing it).",
        "Critics note the theory does not explain why some individuals neutralize and offend while others in the same situation do not.",
      ],
    },
  ],
};

// ── Family 6: Labeling Theory ───────────────────────────────────────────────

const LABELING_FAMILY: Family = {
  slug: "labeling-theory",
  name: "Labeling Theory",
  blurb: "Crime as social construct — deviance is created by the social response to behavior, not by the behavior itself.",
  color: "rose",
  theories: [
    {
      name: "Primary and secondary deviance",
      description: "Initial deviance is normalized; secondary deviance emerges when the individual reorganizes identity around the deviant label.",
      tags: ["c20", "foundational"],
      tenet: "Primary deviance is common and causes little identity change; secondary deviance occurs when the societal reaction to the label reorganizes the person's identity and social role.",
      lineage: { parents: [], divergence: "root — distinguishes between acts of deviance and the identity transformation that follows labeling" },
      figures: ["Edwin Lemert"],
      era: ["c20"],
      coreTenets: [
        "Primary deviance is widespread and has little impact on the individual's self-concept or social role.",
        "Societal reaction — arrest, stigma, exclusion — transforms the meaning of deviance for the individual.",
        "Secondary deviance emerges as the individual reorganizes their identity and behavior around the deviant role imposed by others.",
      ],
      keyThinkers: [
        "Edwin Lemert — Social Pathology (1951)",
        "Edwin Lemert — Human Deviance, Social Problems and Social Control (1967)",
      ],
      principalCritiques: [
        "Critics argue the theory does not explain why primary deviance occurs in the first place.",
        "Empirical evidence for the primary-to-secondary deviance sequence is limited and difficult to establish causally.",
      ],
    },
    {
      name: "Labeling theory (Becker)",
      description: "Deviance is not a quality of the act but a consequence of the application of rules and sanctions by others.",
      tags: ["c20", "foundational"],
      tenet: "Deviance is not inherent in any act; it is created when social groups make rules whose infraction constitutes deviance, and apply those rules to particular people, labeling them as outsiders.",
      lineage: { parents: ["Primary and secondary deviance"], divergence: "generalized: shifts the study of deviance from the actor to the process of rule-making and rule-enforcement" },
      figures: ["Howard Becker"],
      era: ["c20"],
      coreTenets: [
        "Social groups create deviance by making the rules whose infraction constitutes deviance.",
        "Moral entrepreneurs campaign to have their definitions of deviance enacted into law and enforced.",
        "The deviant is one to whom the label has been successfully applied; deviant behavior is behavior that people so label.",
      ],
      keyThinkers: [
        "Howard Becker — Outsiders: Studies in the Sociology of Deviance (1963)",
      ],
      principalCritiques: [
        "Critics argue labeling theory cannot explain why some behaviors are universally condemned (murder, for instance) — not all deviance is socially constructed.",
        "Conservative critics contend the theory romanticizes offenders and ignores the real harm caused by criminal acts.",
      ],
    },
    {
      name: "Dramatization of evil",
      description: "Making a child the thing he is described as being — the first formulation of the labeling process.",
      tags: ["c20"],
      tenet: "The process of tagging, defining, identifying, segregating, and making self-conscious transforms a child into the thing described — the dramatization of evil makes the criminal.",
      lineage: { parents: [], divergence: "root — earliest formulation of the labeling process, preceding Lemert and Becker" },
      figures: ["Frank Tannenbaum"],
      era: ["c20"],
      coreTenets: [
        "The community's response to juvenile misbehavior shifts from tolerating play to defining the child as evil.",
        "The dramatization of evil — the process of public identification and stigmatization — becomes a self-fulfilling prophecy.",
        "The harder the community works to reform the evil, the more it consolidates the criminal identity.",
      ],
      keyThinkers: [
        "Frank Tannenbaum — Crime and the Community (1938)",
      ],
      principalCritiques: [
        "Critics argue Tannenbaum's account is impressionistic and lacks systematic empirical support.",
        "The theory does not specify the conditions under which dramatization succeeds or fails in producing criminal identity.",
      ],
    },
    {
      name: "Reintegrative shaming",
      description: "Shaming that is followed by reintegration reduces crime; shaming that stigmatizes increases it.",
      tags: ["c20", "policy-relevant"],
      tenet: "Shaming that is reintegrative — expressing disapproval of the act while maintaining bonds with the offender — reduces crime; stigmatizing shaming increases it.",
      lineage: { parents: ["Labeling theory (Becker)"], divergence: "constructive turn: identifies conditions under which social disapproval reduces rather than amplifies crime" },
      figures: ["John Braithwaite"],
      era: ["c20"],
      coreTenets: [
        "All societies shame; the critical variable is whether shaming is followed by gestures of reacceptance or permanent exclusion.",
        "Reintegrative shaming maintains the offender's bonds to conventional society and promotes desistance.",
        "Stigmatizing shaming severs bonds, creates outcast groups, and pushes offenders toward criminal subcultures.",
      ],
      keyThinkers: [
        "John Braithwaite — Crime, Shame and Reintegration (1989)",
      ],
      historicalInstances: [
        "Restorative justice conferencing (Australia, New Zealand)",
        "Japanese criminal justice practices as model of reintegrative shaming",
      ],
      principalCritiques: [
        "Critics argue the theory idealizes communitarian societies and may not generalize to individualistic, heterogeneous ones.",
        "Empirical evaluations of reintegrative shaming programs show mixed results — effective for some offenses and populations, not others.",
      ],
    },
    {
      name: "Defiance theory",
      description: "Sanctions increase crime when offenders perceive them as unfair and are weakly bonded to the sanctioning community.",
      tags: ["c20"],
      tenet: "Sanctions increase crime (defiance) when the offender perceives the sanction as illegitimate and is alienated from the sanctioning community.",
      lineage: { parents: ["Labeling theory (Becker)", "Reintegrative shaming"], divergence: "conditional model: specifies when sanctions deter, are irrelevant, or backfire" },
      figures: ["Lawrence Sherman"],
      era: ["c20"],
      coreTenets: [
        "Sanctions deter when offenders see them as legitimate and maintain bonds to the community imposing them.",
        "Sanctions provoke defiance when offenders perceive them as unfair, disrespectful, or stigmatizing.",
        "The effect of sanctions is not uniform — it depends on the interaction of sanction type, offender bonds, and perceived legitimacy.",
      ],
      keyThinkers: [
        "Lawrence Sherman — Defiance, Deterrence, and Irrelevance: A Theory of the Criminal Sanction (1993)",
      ],
      principalCritiques: [
        "Critics argue the theory is difficult to test because perceived legitimacy and bond strength are hard to measure prospectively.",
        "The theory's predictions overlap with multiple other frameworks (labeling, deterrence, procedural justice), making unique contributions hard to isolate.",
      ],
    },
    {
      name: "Moral panic",
      description: "Exaggerated social reaction to perceived threats amplifies deviance and produces disproportionate control responses.",
      tags: ["c20"],
      tenet: "Moral panics occur when media, public, and authorities amplify a perceived threat beyond its objective seriousness, producing disproportionate social control responses.",
      lineage: { parents: ["Labeling theory (Becker)"], divergence: "macro-level application: extends labeling from individual deviance to societal-level overreaction" },
      figures: ["Stanley Cohen", "Stuart Hall"],
      era: ["c20"],
      coreTenets: [
        "A condition, episode, person, or group becomes defined as a threat to societal values and interests.",
        "Media amplification, moral entrepreneurs, and political actors escalate concern beyond the objective threat level.",
        "Disproportionate control responses — new laws, heavy policing — may worsen the problem they claim to solve.",
      ],
      keyThinkers: [
        "Stanley Cohen — Folk Devils and Moral Panics (1972)",
        "Stuart Hall et al. — Policing the Crisis (1978)",
      ],
      historicalInstances: [
        "Mods and Rockers panic (UK, 1960s)",
        "Mugging panic (UK, 1970s)",
        "Satanic ritual abuse panic (USA/UK, 1980s-90s)",
      ],
      principalCritiques: [
        "Critics argue the concept is used too loosely — not every public concern about crime is a moral panic.",
        "Some scholars contend the concept implicitly dismisses legitimate public fears about real harms.",
      ],
    },
    {
      name: "Social construction of crime",
      description: "What counts as 'crime' is not natural or self-evident but is defined through social, political, and historical processes.",
      tags: ["c20", "c21"],
      tenet: "Crime is not an objective category but a social construction — what is criminalized reflects power, interests, and cultural values rather than inherent harmfulness.",
      lineage: { parents: ["Labeling theory (Becker)"], divergence: "philosophical extension: from labeling individuals as deviant to questioning the category of 'crime' itself" },
      figures: ["Howard Becker", "Nils Christie"],
      era: ["c20", "c21"],
      coreTenets: [
        "The boundaries of 'crime' vary across time, place, and culture — acts move in and out of criminalization.",
        "Criminalization reflects the power of dominant groups to impose their definitions on others.",
        "The study of crime must include the study of why certain acts (not others) are defined as criminal.",
      ],
      keyThinkers: [
        "Nils Christie — A Suitable Amount of Crime (2004)",
        "Howard Becker — Outsiders (1963)",
      ],
      principalCritiques: [
        "Critics argue extreme constructionism undermines the reality of victimization — rape and murder cause real harm regardless of social definitions.",
        "Realist criminologists contend that constructionism leads to policy paralysis by questioning the very category it seeks to address.",
      ],
    },
  ],
};

// ── Family 7: Critical, Conflict, Marxist & Feminist ────────────────────────

const CRITICAL_FAMILY: Family = {
  slug: "critical-conflict-feminist",
  name: "Critical, Conflict, Marxist & Feminist",
  blurb: "Crime as product of power, inequality, and structural domination — who defines crime and who bears its costs.",
  color: "red",
  broadFamily: true,
  theories: [
    {
      name: "Conflict criminology",
      description: "Criminal law reflects the interests of powerful groups; crime is defined by those with the power to make and enforce law.",
      tags: ["c20", "foundational"],
      tenet: "Criminal law is a tool of the powerful; crime is defined and enforced in ways that serve dominant group interests.",
      lineage: { parents: [], divergence: "root — applies conflict theory (power, group interest) to the study of crime and law" },
      figures: ["George Vold", "Austin Turk", "William Chambliss"],
      era: ["c20"],
      coreTenets: [
        "Society is characterized by group conflict over scarce resources; law reflects the outcome of this conflict.",
        "Those with economic and political power define what is criminal and direct enforcement against the powerless.",
        "Crime statistics reflect policing priorities and power dynamics, not the objective distribution of harmful behavior.",
      ],
      keyThinkers: [
        "George Vold — Theoretical Criminology (1958)",
        "Austin Turk — Criminality and Legal Order (1969)",
        "William Chambliss — The Saints and the Roughnecks (1973)",
      ],
      principalCritiques: [
        "Consensus theorists argue most criminal law reflects broadly shared values (e.g., prohibitions on murder, theft) rather than elite interests alone.",
        "Critics contend conflict theory underexplains interpersonal violence within disadvantaged communities that cannot be reduced to elite manipulation.",
      ],
    },
    {
      name: "Marxist / Radical criminology",
      description: "Crime is a product of capitalist social relations — both street crime (produced by immiseration) and state/corporate crime (produced by profit seeking).",
      tags: ["c20"],
      tenet: "Capitalism produces crime — both the crimes of the powerless (driven by poverty) and the crimes of the powerful (driven by profit).",
      lineage: { parents: ["Conflict criminology"], divergence: "materialist: roots conflict in capitalist mode of production and class struggle specifically" },
      figures: ["Willem Bonger", "Ian Taylor", "Paul Walton", "Jock Young"],
      era: ["c20"],
      coreTenets: [
        "Capitalist relations of production generate both the conditions for street crime (poverty, alienation) and the motivations for corporate crime (profit maximization).",
        "Criminal law protects property and capital while criminalizing the survival strategies of the poor.",
        "A just society requires fundamental transformation of capitalist relations, not better policing or punishment.",
      ],
      keyThinkers: [
        "Willem Bonger — Criminality and Economic Conditions (1916)",
        "Ian Taylor, Paul Walton & Jock Young — The New Criminology (1973)",
      ],
      principalCritiques: [
        "Critics note that socialist states also had crime, sometimes at high rates, undermining the claim that capitalism is the root cause.",
        "Left realists argue radical criminology romanticizes offenders and ignores the real victimization of the working class by intra-class crime.",
      ],
    },
    {
      name: "Left realism",
      description: "Take working-class crime seriously — it disproportionately victimizes the poor and demands practical progressive responses.",
      tags: ["c20", "policy-relevant"],
      tenet: "Crime is a real problem for the working class and must be taken seriously by the left, not dismissed as a construction of the powerful.",
      lineage: { parents: ["Marxist / Radical criminology"], divergence: "pragmatic turn: rejects romanticization of offenders; centers the reality of working-class victimization" },
      figures: ["Jock Young", "John Lea"],
      era: ["c20"],
      coreTenets: [
        "The 'square of crime' — offender, victim, police, public — must all be analyzed together.",
        "Working-class communities suffer disproportionately from crime; ignoring this abandons them to right-wing 'law and order' politics.",
        "Progressive crime policy requires combining social justice with effective, accountable policing.",
      ],
      keyThinkers: [
        "Jock Young & John Lea — What Is to Be Done about Law and Order? (1984)",
        "Jock Young — The Exclusive Society (1999)",
      ],
      principalCritiques: [
        "Radical criminologists argue left realism concedes too much to conventional criminology and abandons structural critique.",
        "Administrative criminologists contend left realism offers few practical tools beyond what evidence-based prevention already provides.",
      ],
    },
    {
      name: "Feminist criminology",
      description: "Gender is central to understanding crime — both female offending, neglected by mainstream theory, and male violence against women.",
      tags: ["c20", "c21"],
      tenet: "Mainstream criminology is built on male experience; gender — as structure, process, and identity — is central to understanding crime, victimization, and justice.",
      lineage: { parents: ["Conflict criminology"], divergence: "gender focus: exposes the male-centeredness of criminological theory and centers women's experience as offenders and victims" },
      figures: ["Carol Smart", "Kathleen Daly", "Meda Chesney-Lind", "Frances Heidensohn"],
      era: ["c20", "c21"],
      coreTenets: [
        "Mainstream criminological theories were built on male subjects and cannot simply be 'added' to women — they must be rethought.",
        "Patriarchal structures shape both female pathways to crime (abuse, economic marginalization) and male violence against women.",
        "The criminal justice system treats women differently — sometimes more leniently, sometimes more punitively — based on gender norms.",
      ],
      keyThinkers: [
        "Carol Smart — Women, Crime and Criminology (1976)",
        "Kathleen Daly & Meda Chesney-Lind — Feminism and Criminology (1988)",
      ],
      principalCritiques: [
        "Critics argue feminist criminology is internally divided — liberal, radical, socialist, and postmodern feminisms offer incompatible analyses.",
        "Some scholars contend the focus on gender neglects how race and class intersect with gender to shape criminal justice outcomes.",
      ],
    },
    {
      name: "Gender gap and generalizability problem",
      description: "Why do men commit far more crime than women, and can theories developed from male samples explain female offending?",
      tags: ["c20", "c21"],
      tenet: "The gender gap in offending — men commit far more crime, especially violence — is criminology's most robust finding and demands theoretical explanation.",
      lineage: { parents: ["Feminist criminology"], divergence: "theoretical puzzle: tests whether mainstream theories explain female offending or require gender-specific models" },
      figures: ["Darrell Steffensmeier", "Eileen Allan", "Meda Chesney-Lind"],
      era: ["c20", "c21"],
      coreTenets: [
        "The gender gap exists across time, culture, and crime type, though it varies in size by offense category.",
        "The generalizability problem asks: do the same causal factors (strain, control, learning) work the same way for women as for men?",
        "Gendered pathways research finds that women's routes to crime are often shaped by abuse, relationship dependency, and economic marginalization in ways not captured by general theories.",
      ],
      keyThinkers: [
        "Darrell Steffensmeier & Eileen Allan — Gender and Crime (1996)",
        "Meda Chesney-Lind — The Female Offender (1997)",
      ],
      principalCritiques: [
        "Some scholars argue the gender gap is narrowing as social conditions equalize, challenging essentialist explanations.",
        "Critics contend gendered pathways research risks reinforcing stereotypes about women as passive victims rather than agents.",
      ],
    },
    {
      name: "Intersectionality in criminology",
      description: "Race, class, gender, and other axes of inequality interact — no single dimension explains criminal justice outcomes alone.",
      tags: ["c20", "c21"],
      tenet: "Race, class, gender, sexuality, and other axes of inequality intersect and interact to shape experiences of crime, victimization, and justice — no single axis is sufficient.",
      lineage: { parents: ["Feminist criminology"], divergence: "multi-axis: extends feminist critique beyond gender alone to interlocking systems of domination" },
      figures: ["Kimberle Crenshaw", "Hillary Potter", "Beth Richie"],
      era: ["c20", "c21"],
      coreTenets: [
        "Experiences of crime and justice cannot be understood through a single lens — race, class, and gender intersect.",
        "Black women, for example, face a combination of racial profiling, gendered violence, and class disadvantage that single-axis analysis misses.",
        "Criminal justice policies affect multiply-marginalized groups differently than they affect people disadvantaged on only one dimension.",
      ],
      keyThinkers: [
        "Kimberle Crenshaw — Mapping the Margins (1991)",
        "Hillary Potter — Intersectionality and Criminology (2015)",
      ],
      principalCritiques: [
        "Critics argue intersectionality can become an unfalsifiable framework where any outcome is explained by adding another axis of identity.",
        "Quantitative researchers note the methodological difficulty of modeling three-way and four-way interactions with available data.",
      ],
    },
    {
      name: "Cultural criminology",
      description: "Crime and its control are cultural products — meaning, media representation, and subcultural style are central.",
      tags: ["c20", "c21"],
      tenet: "Crime and crime control are cultural phenomena — shaped by meaning, representation, emotion, and the interplay of subcultures with mainstream media.",
      lineage: { parents: ["Marxist / Radical criminology", "Labeling theory (Becker)"], divergence: "cultural turn: centers meaning, media, emotion, and subculture rather than structure alone" },
      figures: ["Jeff Ferrell", "Keith Hayward", "Jock Young"],
      era: ["c20", "c21"],
      coreTenets: [
        "Crime is a cultural product — its meanings are constructed through subcultural practice and media representation.",
        "The 'thrill' and 'edgework' of crime — risk, transgression, emotional intensity — are central to understanding why people offend.",
        "Media and criminal justice institutions co-produce crime spectacles that shape public perception and policy.",
      ],
      keyThinkers: [
        "Jeff Ferrell, Keith Hayward & Jock Young — Cultural Criminology: An Invitation (2008)",
        "Jack Katz — Seductions of Crime (1988)",
      ],
      principalCritiques: [
        "Positivist criminologists argue cultural criminology lacks methodological rigor and makes claims that cannot be empirically tested.",
        "Realist critics contend the emphasis on meaning and emotion neglects the material conditions that structure both crime and its control.",
      ],
    },
    {
      name: "Peacemaking criminology",
      description: "Crime is suffering; the criminal justice system should heal rather than punish — drawing on religious and humanistic traditions.",
      tags: ["c20"],
      tenet: "Crime is a form of suffering; the response to crime should be healing and reconciliation, not punishment that reproduces the violence it claims to address.",
      lineage: { parents: ["Conflict criminology"], divergence: "nonviolent turn: draws on religious (Quaker, Buddhist) and feminist traditions to oppose punitive justice" },
      figures: ["Harold Pepinsky", "Richard Quinney"],
      era: ["c20"],
      coreTenets: [
        "The criminal justice system is itself violent — imprisonment, capital punishment, and coercive policing reproduce the harm they claim to address.",
        "Justice should be transformative — healing relationships, restoring communities, and addressing the suffering that produces crime.",
        "Meditation, dialogue, compassion, and social justice are more effective responses to crime than punishment.",
      ],
      keyThinkers: [
        "Harold Pepinsky & Richard Quinney — Criminology as Peacemaking (1991)",
      ],
      principalCritiques: [
        "Critics argue peacemaking criminology is utopian and offers no practical framework for dealing with serious violent offenders.",
        "Realist criminologists contend it ignores the legitimate protective function of punishment and incapacitation.",
      ],
    },
    {
      name: "Green criminology",
      description: "Extend criminological analysis to environmental harms — pollution, species destruction, toxic waste — whether or not they are legally defined as crimes.",
      tags: ["c20", "c21"],
      tenet: "Environmental harms — pollution, species destruction, toxic dumping, deforestation — should be studied as crimes regardless of legal definition, because they cause massive harm.",
      lineage: { parents: ["Marxist / Radical criminology"], divergence: "ecological expansion: extends the scope of criminology beyond legally defined crimes to include environmental harms" },
      figures: ["Rob White", "Nigel South", "Avi Brisman"],
      era: ["c20", "c21"],
      coreTenets: [
        "Environmental harm often exceeds the damage of conventional crime but is under-criminalized because it serves powerful economic interests.",
        "Green criminology uses a harm-based rather than a law-based definition of its subject matter.",
        "Environmental justice issues — who bears the costs of pollution, climate change, and resource extraction — are criminological questions.",
      ],
      keyThinkers: [
        "Rob White — Crimes Against Nature (2008)",
        "Nigel South — A Green Field for Criminology? (1998)",
      ],
      principalCritiques: [
        "Critics argue that extending 'crime' beyond legal definitions risks politicizing criminology and conflating moral disapproval with criminal culpability.",
        "Methodological critics note that measuring environmental harm is far more complex than measuring conventional crime.",
      ],
    },
    {
      name: "Convict criminology",
      description: "Former prisoners bring insider knowledge to criminological research — challenging mainstream academic assumptions about incarceration.",
      tags: ["c21"],
      tenet: "Formerly incarcerated scholars bring experiential knowledge that challenges the assumptions of mainstream criminology and exposes the realities of the carceral system.",
      lineage: { parents: ["Conflict criminology"], divergence: "standpoint epistemology: privileges the knowledge produced by lived experience of incarceration" },
      figures: ["Jeffrey Ian Ross", "Stephen Richards"],
      era: ["c21"],
      coreTenets: [
        "Academic criminology produced by outsiders misses or distorts the lived reality of incarceration.",
        "Formerly incarcerated scholars offer a necessary corrective — insider knowledge of prison culture, reentry, and the failures of the system.",
        "The goal is to humanize the criminological enterprise and center the voices of those most affected by the justice system.",
      ],
      keyThinkers: [
        "Jeffrey Ian Ross & Stephen Richards — Beyond Bars: Rejoining Society After Prison (2009)",
        "Jeffrey Ian Ross & Stephen Richards — Convict Criminology (2003)",
      ],
      principalCritiques: [
        "Critics argue that lived experience, while valuable, does not automatically produce reliable generalizable knowledge.",
        "Some scholars contend convict criminology risks romanticizing incarceration experience and producing advocacy rather than scholarship.",
      ],
    },
  ],
};

// ── Family 8: Life-Course, Developmental & Integrated ───────────────────────

const LIFECOURSE_FAMILY: Family = {
  slug: "life-course-developmental",
  name: "Life-Course, Developmental & Integrated",
  blurb: "Crime across the lifespan — onset, persistence, escalation, and desistance from adolescence to old age.",
  color: "violet",
  theories: [
    {
      name: "Life-course criminology (Sampson & Laub)",
      description: "Informal social controls — quality marriages, stable employment, military service — explain desistance from crime regardless of early risk factors.",
      tags: ["c20", "foundational", "integrative"],
      tenet: "Turning points — quality marriage, stable employment, military service — create new social bonds that redirect trajectories away from crime, regardless of childhood risk.",
      lineage: { parents: ["Social bond / control theory"], divergence: "longitudinal: extends control theory across the full life course; emphasizes change and turning points rather than stability" },
      figures: ["Robert Sampson", "John Laub"],
      era: ["c20"],
      coreTenets: [
        "Crime peaks in late adolescence and declines with age for virtually all offenders — the age-crime curve is universal.",
        "Turning points — events that create new social bonds and routine activities — explain desistance even for high-risk individuals.",
        "Childhood risk factors matter but do not deterministically predict adult outcomes; human agency and contingency play roles.",
      ],
      keyThinkers: [
        "Robert Sampson & John Laub — Crime in the Making (1993)",
        "John Laub & Robert Sampson — Shared Beginnings, Divergent Lives (2003)",
      ],
      historicalInstances: [
        "Glueck longitudinal study (500 delinquent boys followed to age 70)",
      ],
      principalCritiques: [
        "Moffitt and others argue that a subgroup of life-course-persistent offenders exists for whom turning points do not easily redirect behavior.",
        "Critics note the theory does not specify why some individuals encounter turning points and others do not — the distribution of opportunity is itself structured by inequality.",
      ],
    },
    {
      name: "Developmental taxonomy (Moffitt)",
      description: "Two types of offenders: adolescence-limited (normative, temporary) and life-course-persistent (neuropsychological deficits + adverse environment).",
      tags: ["c20", "foundational"],
      tenet: "There are two fundamentally distinct types of antisocial behavior: adolescence-limited (normative) and life-course-persistent (pathological, rooted in early neuropsychological deficits).",
      lineage: { parents: ["Life-course criminology (Sampson & Laub)"], divergence: "typological: challenges universal age-crime curve by positing qualitatively distinct developmental pathways" },
      figures: ["Terrie Moffitt"],
      era: ["c20"],
      coreTenets: [
        "Life-course-persistent offenders have neuropsychological deficits (temperament, cognition) compounded by adverse rearing environments.",
        "Adolescence-limited offenders engage in temporary antisocial behavior to close the maturity gap — mimicking adult autonomy before achieving it legitimately.",
        "The two groups have different etiologies, prognoses, and appropriate interventions.",
      ],
      keyThinkers: [
        "Terrie Moffitt — Adolescence-Limited and Life-Course-Persistent Antisocial Behavior (1993)",
      ],
      principalCritiques: [
        "Longitudinal studies have identified additional groups (e.g., late-onset offenders, desisters) that do not fit the two-group taxonomy.",
        "Critics argue the life-course-persistent category risks biologizing crime by emphasizing neuropsychological deficits in disadvantaged populations.",
      ],
    },
    {
      name: "Turning points and desistance",
      description: "The study of why and how people stop offending — marriage, employment, identity transformation, aging.",
      tags: ["c20", "c21", "policy-relevant"],
      tenet: "Desistance from crime is a process, not an event — involving structural turning points, identity transformation, and the development of agency.",
      lineage: { parents: ["Life-course criminology (Sampson & Laub)"], divergence: "desistance focus: shifts from explaining onset and persistence to explaining why people stop offending" },
      figures: ["Shadd Maruna", "Robert Sampson", "John Laub", "Peggy Giordano"],
      era: ["c20", "c21"],
      coreTenets: [
        "Desistance involves both structural changes (employment, relationships) and subjective changes (identity, narrative, agency).",
        "Desisters construct 'redemption scripts' — reinterpreting their past as leading to a transformed, prosocial self.",
        "Desistance is gradual, often involving setbacks, rather than an abrupt cessation of offending.",
      ],
      keyThinkers: [
        "Shadd Maruna — Making Good: How Ex-Convicts Reform and Rebuild Their Lives (2001)",
        "Peggy Giordano et al. — Gender, Crime, and Desistance (2002)",
      ],
      principalCritiques: [
        "Critics note that the definition and measurement of desistance is contested — how long must someone be crime-free to count as a desister?",
        "Structural theorists argue identity-focused accounts underestimate the role of employment, housing, and social services in enabling desistance.",
      ],
    },
    {
      name: "Cumulative disadvantage",
      description: "Early deviance and criminal justice contact trigger cascading disadvantages that deepen involvement in crime over the life course.",
      tags: ["c20"],
      tenet: "Criminal behavior and criminal justice involvement create cascading disadvantages — damaged social bonds, blocked opportunities, stigma — that accumulate over the life course.",
      lineage: { parents: ["Life-course criminology (Sampson & Laub)"], divergence: "mechanism specification: explains how early deviance becomes self-reinforcing through institutional responses" },
      figures: ["Robert Sampson", "John Laub"],
      era: ["c20"],
      coreTenets: [
        "Arrest, incarceration, and criminal records damage employment prospects, relationships, and community ties.",
        "These damaged bonds reduce the very social controls that might promote desistance — a vicious cycle.",
        "Disadvantage accumulates disproportionately for those already marginalized by race and class.",
      ],
      keyThinkers: [
        "Robert Sampson & John Laub — Crime in the Making (1993)",
        "Devah Pager — Marked: Race, Crime, and Finding Work in an Era of Mass Incarceration (2003)",
      ],
      principalCritiques: [
        "Critics argue cumulative disadvantage is difficult to distinguish empirically from population heterogeneity — perhaps those who accumulate disadvantage were already more crime-prone.",
        "The theory does not fully specify what interrupts the cumulative process for those who desist despite heavy disadvantage.",
      ],
    },
    {
      name: "Interactional theory",
      description: "Delinquency and its causes are reciprocally related — weakened bonds lead to delinquent peers, which further weaken bonds, in a dynamic spiral.",
      tags: ["c20", "integrative"],
      tenet: "Delinquency and its causes are reciprocally related over time — weakened bonds lead to delinquent associations, which further weaken bonds, in a dynamic developmental spiral.",
      lineage: { parents: ["Social bond / control theory", "Differential association"], divergence: "dynamic integration: combines control and learning theories into a reciprocal causal model that changes across developmental stages" },
      figures: ["Terence Thornberry"],
      era: ["c20"],
      coreTenets: [
        "Weakened bonds to family and school precede association with delinquent peers.",
        "Delinquent peer association and the adoption of delinquent values in turn further weaken conventional bonds.",
        "The relative importance of different causal factors shifts across developmental stages (early adolescence, mid-adolescence, early adulthood).",
      ],
      keyThinkers: [
        "Terence Thornberry — Toward an Interactional Theory of Delinquency (1987)",
        "Terence Thornberry & Marvin Krohn — The Self-Report Method for Measuring Delinquency and Crime (2000)",
      ],
      principalCritiques: [
        "Critics argue that reciprocal causation models are methodologically difficult to test and identify — the causal arrows are hard to untangle.",
        "Some scholars contend interactional theory adds complexity without substantially improving prediction over simpler models.",
      ],
    },
    {
      name: "Integrated theories",
      description: "Theoretical integration attempts to combine elements from multiple criminological theories into unified frameworks.",
      tags: ["c20", "integrative"],
      tenet: "No single theory explains crime; theoretical integration combines the strongest elements of competing perspectives into more comprehensive models.",
      lineage: { parents: ["Social bond / control theory", "Differential association", "Anomie / Strain theory (Merton)"], divergence: "meta-theoretical: combines elements from learning, control, and strain theories into unified frameworks" },
      figures: ["Delbert Elliott", "Robert Agnew", "Terence Thornberry"],
      era: ["c20"],
      broadFamily: true,
      coreTenets: [
        "Different theories explain different aspects or stages of criminal behavior and can be combined to increase explanatory power.",
        "Integration can be end-to-end (sequential), side-by-side (parallel), or up-and-down (cross-level).",
        "The challenge is achieving genuine theoretical synthesis rather than simply listing variables from different traditions.",
      ],
      keyThinkers: [
        "Delbert Elliott et al. — Explaining Delinquency and Drug Use (1985)",
        "Robert Agnew — Toward a Unified Criminology (2011)",
      ],
      principalCritiques: [
        "Critics argue that integration often produces atheoretical 'variable soup' rather than genuine conceptual synthesis.",
        "Hirschi argued that integration is impossible when theories rest on incompatible assumptions about human nature.",
      ],
    },
  ],
};

// ── Family 9: Environmental, Opportunity & Spatial ──────────────────────────

const ENVIRONMENTAL_FAMILY: Family = {
  slug: "environmental-spatial",
  name: "Environmental, Opportunity & Spatial",
  blurb: "Crime in context — how places, designs, and spatial patterns shape criminal opportunity.",
  color: "cyan",
  theories: [
    {
      name: "Environmental criminology (Brantingham)",
      description: "Crime is patterned by the built environment — offenders' awareness spaces, activity nodes, and travel paths shape where crime occurs.",
      tags: ["c20", "spatial"],
      tenet: "Crime is not randomly distributed; it is patterned by the spatial structure of offenders' and victims' routine activities, awareness spaces, and urban form.",
      lineage: { parents: ["Routine activity theory"], divergence: "spatial specification: maps crime events onto the built environment and offender activity spaces" },
      figures: ["Patricia Brantingham", "Paul Brantingham"],
      era: ["c20"],
      coreTenets: [
        "Crime occurs at the intersection of offender awareness spaces, activity nodes, and travel paths.",
        "Environmental backcloth — the physical, social, and temporal characteristics of places — shapes crime concentration.",
        "Understanding spatial crime patterns enables prediction and targeted prevention.",
      ],
      keyThinkers: [
        "Patricia & Paul Brantingham — Environmental Criminology (1981)",
        "Patricia & Paul Brantingham — Patterns in Crime (1984)",
      ],
      principalCritiques: [
        "Critics argue environmental criminology focuses on crime events while ignoring the social structural causes of offender motivation.",
        "The approach is difficult to apply to non-spatial crimes (cybercrime, financial fraud).",
      ],
    },
    {
      name: "Crime pattern theory",
      description: "Crime concentrates at nodes, along paths, and at edges where different land uses meet — shaped by offenders' cognitive maps.",
      tags: ["c20", "spatial"],
      tenet: "Crime concentrates at activity nodes, along paths between nodes, and at edges between land uses, following the geometry of offenders' and targets' daily movements.",
      lineage: { parents: ["Environmental criminology (Brantingham)"], divergence: "formalized: provides a geometric framework for understanding where crime events cluster" },
      figures: ["Patricia Brantingham", "Paul Brantingham"],
      era: ["c20"],
      coreTenets: [
        "Crime generators are places that attract large numbers of people for non-criminal purposes (malls, transit hubs) but produce crime through sheer convergence.",
        "Crime attractors are places with reputations for criminal opportunity that draw motivated offenders.",
        "Crime concentrates at the edges between different activity spaces and land uses.",
      ],
      keyThinkers: [
        "Patricia & Paul Brantingham — Criminality of Place: Crime Generators and Crime Attractors (1995)",
      ],
      principalCritiques: [
        "Critics note the theory describes where crime occurs but does not fully explain why some nodes become crime generators/attractors and others do not.",
        "The framework is most applicable to street crime and may not extend to offenses with diffuse spatial patterns.",
      ],
    },
    {
      name: "CPTED (Crime Prevention Through Environmental Design)",
      description: "Design the physical environment to reduce crime opportunity — natural surveillance, access control, territorial reinforcement.",
      tags: ["c20", "applied", "policy-relevant"],
      tenet: "The proper design and effective use of the built environment can reduce the incidence and fear of crime and improve quality of life.",
      lineage: { parents: ["Environmental criminology (Brantingham)", "Defensible space"], divergence: "applied design: translates environmental criminology into architectural and urban planning principles" },
      figures: ["C. Ray Jeffery", "Timothy Crowe"],
      era: ["c20"],
      coreTenets: [
        "Natural surveillance: design spaces so that legitimate users can see and be seen.",
        "Natural access control: guide movement through placement of entrances, exits, fencing, and landscaping.",
        "Territorial reinforcement: design features that define ownership and encourage maintenance of spaces.",
      ],
      keyThinkers: [
        "C. Ray Jeffery — Crime Prevention Through Environmental Design (1971)",
        "Timothy Crowe — Crime Prevention Through Environmental Design (1991)",
      ],
      historicalInstances: [
        "Redesign of public housing developments",
        "CPTED audits in municipal planning worldwide",
      ],
      principalCritiques: [
        "Critics argue CPTED can produce 'fortress' environments that prioritize security over livability and exclude marginalized populations.",
        "Evidence for CPTED effectiveness is mixed; effects depend heavily on implementation quality and community engagement.",
      ],
    },
    {
      name: "Defensible space",
      description: "Architectural design that allows residents to control areas around their homes reduces crime in residential environments.",
      tags: ["c20", "applied"],
      tenet: "Residential environments can be designed so that inhabitants feel a sense of ownership and responsibility for surrounding spaces, deterring outsiders from criminal behavior.",
      lineage: { parents: [], divergence: "root — architectural approach to crime prevention; precursor to CPTED" },
      figures: ["Oscar Newman"],
      era: ["c20"],
      coreTenets: [
        "Real and symbolic barriers define zones of influence — private, semi-private, semi-public, public — that residents control.",
        "Natural surveillance from windows and entrances allows residents to monitor outdoor spaces.",
        "Building design (low-rise, defined entries, limited access) fosters territoriality and informal social control.",
      ],
      keyThinkers: [
        "Oscar Newman — Defensible Space (1972)",
      ],
      historicalInstances: [
        "Pruitt-Igoe housing project (St. Louis) — cited as failure of non-defensible design",
        "Newman's comparative studies of New York public housing",
      ],
      principalCritiques: [
        "Critics argue Newman overstated the role of design and understated the effects of poverty, social isolation, and management quality.",
        "Subsequent research found that social cohesion among residents mattered more than architectural design alone.",
      ],
    },
    {
      name: "Broken windows theory",
      description: "Visible disorder — broken windows, graffiti, litter — signals that no one cares, encouraging escalation to serious crime.",
      tags: ["c20", "policy-relevant", "contested"],
      tenet: "Visible signs of disorder and minor incivilities signal a lack of social control, emboldening offenders and leading to an escalation from disorder to serious crime.",
      lineage: { parents: ["Social bond / control theory"], divergence: "environmental application: links physical and social disorder to crime through informal social control breakdown", contested: true },
      figures: ["James Q. Wilson", "George Kelling"],
      era: ["c20"],
      flagged: true,
      coreTenets: [
        "Untended disorder — broken windows, graffiti, panhandling — signals that a community cannot or will not enforce norms.",
        "This signal attracts more disorder and crime in a self-reinforcing spiral.",
        "Aggressive policing of minor disorder (order-maintenance policing) can prevent serious crime.",
      ],
      keyThinkers: [
        "James Q. Wilson & George Kelling — Broken Windows (1982, Atlantic Monthly)",
      ],
      historicalInstances: [
        "New York City 'zero tolerance' policing under Bratton/Giuliani (1990s)",
        "Stop-and-frisk policing justified by broken windows logic",
      ],
      principalCritiques: [
        "The causal link between disorder and serious crime has not been reliably established — Sampson and Raudenbush (1999) found both were driven by concentrated disadvantage.",
        "Order-maintenance policing produces racial disparities, erodes police-community trust, and raises civil liberties concerns.",
        "The NYC crime decline coincided with national trends, making it impossible to attribute the drop to broken windows policing specifically.",
      ],
    },
    {
      name: "Hot spots policing",
      description: "Crime concentrates at micro-places — a few addresses and street segments generate most crime; targeting police resources there reduces crime.",
      tags: ["c20", "c21", "policy-relevant", "evidence-based"],
      tenet: "A small number of micro-places (street segments, addresses) generate a disproportionate share of crime; concentrating police resources at these hot spots reduces crime.",
      lineage: { parents: ["Environmental criminology (Brantingham)", "Routine activity theory"], divergence: "evidence-based: uses empirical crime mapping to direct police resources to highest-concentration locations" },
      figures: ["Lawrence Sherman", "David Weisburd"],
      era: ["c20", "c21"],
      coreTenets: [
        "Crime is concentrated at micro-places: approximately 5% of street segments produce 50% of crime in a city.",
        "Increased police presence at hot spots reduces crime without substantial displacement to nearby areas.",
        "Hot spots policing is one of the most evidence-supported crime prevention strategies available.",
      ],
      keyThinkers: [
        "Lawrence Sherman et al. — Hot Spots of Predatory Crime (1989)",
        "David Weisburd — The Law of Crime Concentration (2015)",
      ],
      historicalInstances: [
        "Minneapolis Hot Spots Patrol Experiment (1989)",
        "Multiple randomized controlled trials in US cities",
      ],
      principalCritiques: [
        "Critics argue hot spots policing can produce aggressive, intrusive policing in disadvantaged communities.",
        "Some scholars contend micro-place focus ignores the structural causes of why certain communities become hot spots.",
      ],
    },
    {
      name: "Repeat and near-repeat victimization",
      description: "Past victimization is the strongest predictor of future victimization — crimes cluster in time and space around prior incidents.",
      tags: ["c20", "c21", "empirical"],
      tenet: "Victimization is the strongest predictor of future victimization; crimes cluster in time and space around prior incidents, creating a predictive window for prevention.",
      lineage: { parents: ["Routine activity theory"], divergence: "victim-centered: focuses on the temporal and spatial clustering of victimization rather than offender behavior" },
      figures: ["Graham Farrell", "Ken Pease", "Shane Johnson"],
      era: ["c20", "c21"],
      coreTenets: [
        "Victims and locations that have been victimized once face elevated risk of victimization again, especially soon after the initial event.",
        "Near-repeat patterns extend the elevated risk to addresses and targets near the initial victim.",
        "Prevention strategies can exploit the predictive window — intensifying protection immediately after a crime event.",
      ],
      keyThinkers: [
        "Graham Farrell & Ken Pease — Once Bitten, Twice Bitten (1993)",
        "Shane Johnson et al. — Space-Time Patterns of Risk (2007)",
      ],
      historicalInstances: [
        "Kirkholt Burglary Prevention Project (UK) — reduced repeat burglary by 80%",
      ],
      principalCritiques: [
        "Critics note that repeat victimization research focuses on property crime and has been less consistently applied to violent crime.",
        "The reasons for repeat victimization vary (target attractiveness vs. proximity to offender) and prevention must be tailored accordingly.",
      ],
    },
    {
      name: "Displacement and diffusion of benefits",
      description: "Crime prevention may displace crime to other targets — but often produces a bonus: benefits diffuse to non-targeted areas.",
      tags: ["c20", "policy-relevant"],
      tenet: "Crime prevention may displace some crime, but displacement is typically partial, and prevention often produces a diffusion of benefits to untreated areas beyond the target zone.",
      lineage: { parents: ["Situational crime prevention"], divergence: "evaluation focus: addresses the key objection to situational prevention — that it merely moves crime rather than reducing it" },
      figures: ["Robert Barr", "Ken Pease", "Rene Hesseling"],
      era: ["c20"],
      coreTenets: [
        "Displacement can occur across time, place, target, method, or crime type — but it is rarely 100%.",
        "Meta-analyses show displacement is typically partial; a net reduction in crime is achieved.",
        "Diffusion of benefits — crime reduction spreading beyond the targeted area — is at least as common as displacement.",
      ],
      keyThinkers: [
        "Rene Hesseling — Displacement: A Review of the Empirical Literature (1994)",
        "Rob Guerette & Kate Bowers — Assessing the Extent of Crime Displacement and Diffusion of Benefits (2009)",
      ],
      principalCritiques: [
        "Critics argue displacement is difficult to measure comprehensively — crime may shift to unmonitored areas or crime types.",
        "Structural criminologists contend that as long as root causes persist, some form of displacement is inevitable.",
      ],
    },
  ],
};

// ── SECTION B: TYPES OF CRIME ───────────────────────────────────────────────

// ── Family 10: Offense Categories ───────────────────────────────────────────

const OFFENSE_CATEGORIES_FAMILY: Family = {
  slug: "offense-categories",
  name: "Offense Categories",
  blurb: "Major categories of criminal offenses — violent, property, public-order, and hate crimes.",
  color: "orange",
  broadFamily: true,
  theories: [
    {
      name: "Violent crime",
      description: "Offenses involving force or threat of force against persons — homicide, assault, robbery, sexual offenses.",
      tags: ["category", "UCR"],
      tenet: "Violent crimes involve the use or threat of physical force against persons and are universally regarded as among the most serious offenses.",
      lineage: { parents: [], divergence: "root — umbrella category for offenses involving force or threat against persons" },
      figures: ["FBI Uniform Crime Reports", "Bureau of Justice Statistics"],
      era: ["c20", "c21"],
      broadFamily: true,
      coreTenets: [
        "Violent crime encompasses homicide, aggravated assault, robbery, and forcible sexual offenses as tracked by the UCR/NIBRS.",
        "Rates have declined substantially in the US since the early 1990s, though the reasons are debated.",
        "Violent crime is concentrated among young males, in urban areas, and in neighborhoods marked by concentrated disadvantage.",
      ],
      keyThinkers: [
        "Uniform Crime Reports / NIBRS — FBI",
        "National Crime Victimization Survey — BJS",
      ],
      principalCritiques: [
        "Official statistics undercount violent crime due to non-reporting; victimization surveys provide complementary but imperfect estimates.",
        "The category aggregates very different behaviors (domestic violence vs. stranger robbery) that may have different causes and require different responses.",
      ],
    },
    {
      name: "Homicide",
      description: "The unlawful killing of a human being — the most reliably measured crime and the one most studied cross-nationally.",
      tags: ["category", "UCR"],
      tenet: "Homicide is the unlawful killing of another person and is the most reliably measured crime because it produces a body — making it the benchmark for cross-national comparison.",
      lineage: { parents: ["Violent crime"], divergence: "most serious subcategory: uniquely reliable measure due to difficulty of concealment" },
      figures: ["Marvin Wolfgang", "Franklin Zimring"],
      era: ["c20", "c21"],
      coreTenets: [
        "Homicide rates vary enormously across nations and within nations, driven by gun availability, inequality, and cultural factors.",
        "Most homicides involve people who know each other; stranger homicide is relatively rare.",
        "The US has a homicide rate far exceeding other developed nations, largely attributable to gun violence.",
      ],
      keyThinkers: [
        "Marvin Wolfgang — Patterns in Criminal Homicide (1958)",
        "Franklin Zimring — American Youth Violence (1998)",
      ],
      principalCritiques: [
        "Even homicide data are imperfect — some deaths are misclassified as accidents or suicides, and clearance rates vary.",
        "Cross-national comparison is complicated by differences in legal definitions, recording practices, and medical emergency response capacity.",
      ],
    },
    {
      name: "Assault",
      description: "The intentional infliction or threat of bodily harm — ranges from minor altercations to aggravated assault with weapons.",
      tags: ["category", "UCR"],
      tenet: "Assault encompasses a range of intentional harms from threats and minor physical altercations to aggravated assault involving weapons or serious injury.",
      lineage: { parents: ["Violent crime"], divergence: "broad subcategory: ranges from misdemeanor to felony depending on weapon use, injury severity, and intent" },
      figures: ["Bureau of Justice Statistics"],
      era: ["c20", "c21"],
      coreTenets: [
        "Aggravated assault (with weapon or serious injury) is distinguished from simple assault in official statistics.",
        "Assault is far more common than homicide; the ratio of assaults to homicides has increased as emergency medicine improves.",
        "Domestic and intimate-partner assault is substantially underreported relative to stranger assault.",
      ],
      keyThinkers: [
        "Richard Felson — Violence and Gender Reexamined (2002)",
      ],
      principalCritiques: [
        "Reporting and recording practices vary widely, making trend analysis unreliable for assault compared to homicide.",
        "The boundary between aggravated and simple assault is legally and operationally ambiguous.",
      ],
    },
    {
      name: "Robbery",
      description: "Taking property from a person by force or threat — the quintessential street crime combining theft with interpersonal violence.",
      tags: ["category", "UCR"],
      tenet: "Robbery is the taking of property from a person by force or threat of force — a hybrid offense combining elements of violent crime and property crime.",
      lineage: { parents: ["Violent crime"], divergence: "hybrid offense: uniquely combines personal confrontation with property taking" },
      figures: ["Philip Cook"],
      era: ["c20", "c21"],
      coreTenets: [
        "Robbery requires confrontation with the victim, distinguishing it from burglary and larceny-theft.",
        "Armed robbery (especially with firearms) carries substantially higher risk of victim injury and death.",
        "Robbery is concentrated in urban areas and disproportionately committed by young males.",
      ],
      keyThinkers: [
        "Philip Cook — Robbery Violence (1987)",
        "Richard Wright & Scott Decker — Armed Robbers in Action (1997)",
      ],
      principalCritiques: [
        "Official robbery statistics conflate very different events — from armed bank robbery to playground shakedowns — complicating analysis.",
        "Research on robbers' decision-making may suffer from selection bias, as studies typically rely on incarcerated samples.",
      ],
    },
    {
      name: "Sexual offenses",
      description: "Offenses involving non-consensual sexual contact or conduct — among the most underreported crimes.",
      tags: ["category", "UCR"],
      tenet: "Sexual offenses involve non-consensual sexual contact or conduct and are among the most underreported crimes, with estimates suggesting only 20-40% reach police.",
      lineage: { parents: ["Violent crime"], divergence: "distinct subcategory: characterized by extreme underreporting, gendered victimization patterns, and contested definitions" },
      figures: ["Diana Russell", "Mary Koss"],
      era: ["c20", "c21"],
      coreTenets: [
        "Sexual offenses are dramatically underreported — the 'dark figure' is larger than for almost any other serious crime.",
        "Most sexual offenses are committed by someone known to the victim, not by strangers.",
        "Legal definitions of sexual offenses have expanded over time to include marital rape, date rape, and consent-based frameworks.",
      ],
      keyThinkers: [
        "Diana Russell — The Politics of Rape (1975)",
        "Mary Koss — Hidden Rape (1987)",
      ],
      principalCritiques: [
        "Definitional disagreements (what constitutes consent, how to classify statutory offenses) complicate measurement and cross-jurisdictional comparison.",
        "Critics note that criminal justice responses to sexual offenses remain plagued by attrition — most reported cases do not result in prosecution or conviction.",
      ],
    },
    {
      name: "Property crime",
      description: "Offenses involving taking or destroying property without force against persons — burglary, larceny-theft, motor vehicle theft, arson.",
      tags: ["category", "UCR"],
      tenet: "Property crime involves the taking or destruction of property without the use or threat of force against a person — the most common category of serious crime.",
      lineage: { parents: [], divergence: "root — umbrella category for offenses against property; distinguished from violent crime by absence of personal confrontation" },
      figures: ["FBI Uniform Crime Reports"],
      era: ["c20", "c21"],
      broadFamily: true,
      coreTenets: [
        "Property crime includes burglary, larceny-theft, motor vehicle theft, and arson.",
        "Property crime rates have declined substantially in developed nations since the 1990s, partly due to improved security technology.",
        "Property offending is more evenly distributed across social classes than violent offending.",
      ],
      keyThinkers: [
        "Marcus Felson — Crime and Everyday Life (2002)",
      ],
      principalCritiques: [
        "Property crime receives less scholarly attention than violent crime despite its much higher volume and substantial cumulative harm.",
        "Insurance and consumer costs from property crime are difficult to quantify and likely underestimated.",
      ],
    },
    {
      name: "Burglary",
      description: "Unlawful entry of a structure to commit a felony or theft — a property crime with elements of invasion and risk.",
      tags: ["category", "UCR"],
      tenet: "Burglary is the unlawful entry of a structure to commit a felony or theft, combining property loss with the psychological violation of having one's space invaded.",
      lineage: { parents: ["Property crime"], divergence: "specific offense: distinguished by entry into a structure — adding elements of invasion and confrontation risk" },
      figures: ["Neal Shover", "Richard Wright"],
      era: ["c20", "c21"],
      coreTenets: [
        "Residential burglary causes disproportionate psychological harm relative to financial loss due to the invasion of private space.",
        "Burglars are often rational opportunists who assess risk, target suitability, and guardianship before acting.",
        "Repeat victimization is pronounced in burglary — burgled homes face elevated risk of re-burglary, especially soon after the initial event.",
      ],
      keyThinkers: [
        "Neal Shover — Great Pretenders: Pursuits and Careers of Persistent Thieves (1996)",
        "Richard Wright & Scott Decker — Burglars on the Job (1994)",
      ],
      principalCritiques: [
        "Official burglary rates undercount the offense because many burglaries are not reported to police.",
        "Research on burglars' decision-making is largely based on active or incarcerated offenders, raising questions about generalizability.",
      ],
    },
    {
      name: "Public-order and victimless offenses",
      description: "Offenses against public morality or order — drug use, prostitution, gambling, public intoxication — where the 'victim' is contested.",
      tags: ["category", "contested"],
      tenet: "Public-order offenses involve behavior deemed harmful to public morality or order rather than to specific victims — their criminalization is among the most contested issues in criminal justice.",
      lineage: { parents: [], divergence: "root — contested category: whether these behaviors should be criminal is a fundamental normative question" },
      figures: ["Edwin Schur", "Norval Morris"],
      era: ["c20", "c21"],
      coreTenets: [
        "These offenses lack a direct, identifiable victim in the traditional sense — leading some to call them 'victimless crimes.'",
        "Criminalization of these behaviors is debated: liberals argue for decriminalization, while social conservatives defend enforcement of moral standards.",
        "Enforcement of public-order offenses disproportionately targets racial minorities and the poor.",
      ],
      keyThinkers: [
        "Edwin Schur — Crimes Without Victims (1965)",
        "Norval Morris & Gordon Hawkins — The Honest Politician's Guide to Crime Control (1970)",
      ],
      principalCritiques: [
        "Abolitionists argue criminalization of consensual behavior wastes resources, fills prisons, and produces worse outcomes than regulation.",
        "Moralists contend that labeling these offenses 'victimless' ignores indirect harms to families, communities, and public health.",
      ],
    },
    {
      name: "Drug offenses",
      description: "Manufacture, distribution, and possession of controlled substances — the driver of mass incarceration in the United States.",
      tags: ["category", "policy-relevant"],
      tenet: "Drug offenses — possession, manufacture, and distribution of controlled substances — have been the primary driver of incarceration growth in the United States since the 1980s.",
      lineage: { parents: ["Public-order and victimless offenses"], divergence: "specific policy domain: drug criminalization has had uniquely large effects on incarceration, racial disparity, and international policy" },
      figures: ["Harry Anslinger", "Michelle Alexander"],
      era: ["c20", "c21"],
      coreTenets: [
        "The War on Drugs (1971-present) dramatically expanded drug criminalization, policing, and incarceration.",
        "Enforcement falls disproportionately on racial minorities despite similar rates of drug use across racial groups.",
        "Debate centers on whether drug policy should emphasize criminalization or public health approaches (harm reduction, decriminalization, treatment).",
      ],
      keyThinkers: [
        "Michelle Alexander — The New Jim Crow (2010)",
        "Alfred Blumstein — Racial Disproportionality of US Prison Populations Revisited (1993)",
      ],
      historicalInstances: [
        "Nixon declares War on Drugs (1971)",
        "Crack-cocaine sentencing disparity (100:1 ratio until 2010 Fair Sentencing Act)",
        "Portugal drug decriminalization (2001)",
      ],
      principalCritiques: [
        "Drug war critics argue criminalization has failed to reduce drug use while producing mass incarceration and racial injustice.",
        "Enforcement advocates contend that weakening drug laws increases addiction, public disorder, and associated crime.",
      ],
    },
    {
      name: "Hate crimes",
      description: "Offenses motivated by bias against a victim's race, religion, ethnicity, sexual orientation, or other protected characteristic.",
      tags: ["category", "c20", "c21"],
      tenet: "Hate crimes are offenses motivated by prejudice against a victim's identity group; they cause harm beyond the individual victim by terrorizing entire communities.",
      lineage: { parents: ["Violent crime"], divergence: "motive-specific: defines a cross-cutting category based on offender bias rather than offense type" },
      figures: ["Jack McDevitt", "Jack Levin"],
      era: ["c20", "c21"],
      coreTenets: [
        "Hate crimes cause disproportionate harm because they target victims based on immutable or core identity characteristics.",
        "The message crime effect — an attack on one signals threat to all who share the characteristic — justifies enhanced penalties.",
        "Measurement is challenging: many hate crimes go unreported, and establishing bias motivation is legally and empirically difficult.",
      ],
      keyThinkers: [
        "Jack McDevitt, Jack Levin & Susan Bennett — Hate Crime Offenders (2002)",
        "Frederick Lawrence — Punishing Hate: Bias Crimes Under American Law (1999)",
      ],
      historicalInstances: [
        "Hate Crime Statistics Act (USA, 1990)",
        "Matthew Shepard and James Byrd Jr. Hate Crimes Prevention Act (2009)",
      ],
      principalCritiques: [
        "Civil libertarians argue hate crime laws punish thought and motive rather than conduct, raising First Amendment concerns.",
        "Empirical researchers note hate crime data are unreliable due to inconsistent police reporting and definitional variation across jurisdictions.",
      ],
    },
  ],
};

export const FAMILIES: Family[] = [
  CLASSICAL_RATIONAL_FAMILY,
  BIOLOGICAL_FAMILY,
  PSYCHOLOGICAL_FAMILY,
  STRAIN_FAMILY,
  LEARNING_CONTROL_FAMILY,
  LABELING_FAMILY,
  CRITICAL_FAMILY,
  LIFECOURSE_FAMILY,
  ENVIRONMENTAL_FAMILY,
  OFFENSE_CATEGORIES_FAMILY,
];

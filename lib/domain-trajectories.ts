// Editorial mapping: domain field slug → verified trajectory slugs.
// Every slug here is confirmed in the DB (see scripts/verify-domain-trajectories.ts).
// Fields with no seeded trajectory are absent — they get banner + discovery links only.
// Do not add a slug unless it resolves to a live, non-deprecated trajectory: claim.

export const DOMAIN_TRAJECTORIES: Readonly<Record<string, readonly string[]>> = {
  medicine: [
    "semaglutide-glp1",
    "smoking-lung-cancer",
    "hpylori-ulcers",
    "stress-acid-ulcers",
    "dietary-fat-heart",
    "oxycontin-reduced-abuse-liability-1995",
  ],
  pharmacology: [
    "semaglutide-glp1",
    "dietary-fat-heart",
    "oxycontin-reduced-abuse-liability-1995",
  ],
  "public-health": [
    "smoking-lung-cancer",
    "dietary-fat-heart",
    "semaglutide-glp1",
  ],
  "earth-sciences": ["continental-drift"],
  geology:          ["continental-drift"],
  physics:          ["cold-fusion"],
  chemistry:        ["cold-fusion", "cfc-ozone-depletion"],
  "environmental-science": ["cfc-ozone-depletion", "clean-air-act-1970"],
  astronomy:        ["pluto-discovery-1930"],
  law:              ["civil-rights-act-1964", "clean-air-act-1970", "voting-rights-act-1965"],
  history:          ["civil-rights-act-1964", "voting-rights-act-1965", "clean-air-act-1970"],
};

// Flagship trajectory per field — used for the FieldGuideBanner deep-link.
export const DOMAIN_FLAGSHIP: Readonly<Record<string, { slug: string; label: string }>> = {
  medicine:               { slug: "semaglutide-glp1",      label: "Semaglutide / GLP-1" },
  pharmacology:           { slug: "semaglutide-glp1",      label: "Semaglutide / GLP-1" },
  "public-health":        { slug: "smoking-lung-cancer",   label: "Smoking & lung cancer" },
  "earth-sciences":       { slug: "continental-drift",     label: "Continental drift" },
  geology:                { slug: "continental-drift",     label: "Continental drift" },
  physics:                { slug: "cold-fusion",           label: "Cold fusion" },
  chemistry:              { slug: "cfc-ozone-depletion",   label: "CFCs & ozone depletion" },
  "environmental-science":{ slug: "cfc-ozone-depletion",   label: "CFCs & ozone depletion" },
  astronomy:              { slug: "pluto-discovery-1930",  label: "Pluto's demotion (2006)" },
  law:                    { slug: "civil-rights-act-1964", label: "Civil Rights Act (1964)" },
  history:                { slug: "civil-rights-act-1964", label: "Civil Rights Act (1964)" },
};

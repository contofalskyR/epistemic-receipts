// In-code curation for the homepage hero — no DB schema changes.
//
// The page fetches live milestone data from ClaimStatusHistory by `id`; if that
// fetch returns nothing (e.g. the DB is briefly unavailable, or the trajectory was
// renamed) it falls back to the embedded `milestones`/`claim` below so the hero
// never renders empty. Array order = the hero's auto-rotation order.
//
// To re-curate the hero, edit this list. Each `id` maps to a real trajectory:
//   externalId  "trajectory:<id>"   →   /settling-curve?t=<id>

export type FeaturedMilestone = {
  year: number;
  axis: string; // RECORDED | CONTESTED | SETTLED | REVERSED | ABANDONED | OPEN | ...
  community: string;
  reason: string | null;
};

export type FeaturedTrajectory = {
  id: string;
  eyebrow: string; // short narrative tag, e.g. "THE RISE"
  eyebrowColor: string; // tailwind text-* class
  hook: string; // one-line, owner-curated hook drawn from the real arc
  claim: string; // fallback claim text (DB value wins when present)
  milestones: FeaturedMilestone[]; // fallback milestones (DB values win when present)
};

export const FEATURED_TRAJECTORIES: FeaturedTrajectory[] = [
  {
    id: "semaglutide-glp1",
    eyebrow: "THE RISE",
    eyebrowColor: "text-emerald-300",
    hook: "How a 1996 experiment on appetite became Ozempic — and the most-watched drug of the decade.",
    claim:
      "Semaglutide (a GLP-1 receptor agonist) reduces blood glucose and body weight in humans.",
    milestones: [
      { year: 1996, axis: "RECORDED", community: "EXPERT_LITERATURE", reason: "GLP-1 receptor agonism established as a viable appetite-control target." },
      { year: 2001, axis: "RECORDED", community: "EXPERT_LITERATURE", reason: "First proof a long-acting GLP-1 agonist drives lasting weight loss." },
      { year: 2010, axis: "RECORDED", community: "EXPERT_LITERATURE", reason: "First-in-human Phase 1 trial of semaglutide registered." },
      { year: 2015, axis: "CONTESTED", community: "EXPERT_LITERATURE", reason: "First full discovery paper puts the once-weekly design on the record." },
      { year: 2017, axis: "SETTLED", community: "INSTITUTIONAL", reason: "FDA approves Ozempic for type 2 diabetes." },
      { year: 2021, axis: "SETTLED", community: "INSTITUTIONAL", reason: "FDA approves Wegovy — the obesity indication." },
    ],
  },
  {
    id: "pluto-discovery-1930",
    eyebrow: "THE DEMOTION",
    eyebrowColor: "text-sky-300",
    hook: "Pluto was the ninth planet for 76 years. One 2006 vote redrew the Solar System.",
    claim:
      "Pluto, discovered in 1930 and classified as the ninth planet for 76 years, was reclassified as a dwarf planet by the IAU in 2006.",
    milestones: [
      { year: 1930, axis: "RECORDED", community: "EXPERT_LITERATURE", reason: "Tombaugh identifies a moving trans-Neptunian object at Lowell Observatory." },
      { year: 1930, axis: "SETTLED", community: "INSTITUTIONAL", reason: "Named 'Pluto' and taught universally as the ninth planet." },
      { year: 2006, axis: "REVERSED", community: "INSTITUTIONAL", reason: "IAU's orbit-clearing definition removes Pluto from the planet list." },
      { year: 2006, axis: "SETTLED", community: "INSTITUTIONAL", reason: "Minor-planet designation 134340 makes dwarf-planet status official." },
    ],
  },
  {
    id: "oxycontin-reduced-abuse-liability-1995",
    eyebrow: "THE REVERSAL",
    eyebrowColor: "text-rose-300",
    hook: "OxyContin was approved as “less prone to abuse.” It took 18 years and a guilty plea to undo that claim.",
    claim:
      "The FDA approved OxyContin in 1995 with labeling stating its controlled-release formulation was believed to reduce the drug's abuse liability.",
    milestones: [
      { year: 1995, axis: "SETTLED", community: "INSTITUTIONAL", reason: "FDA approves OxyContin; label asserts reduced abuse liability — untested." },
      { year: 2001, axis: "CONTESTED", community: "INSTITUTIONAL", reason: "FDA's first corrective action: boxed warning amid abuse and overdose reports." },
      { year: 2007, axis: "CONTESTED", community: "JUDICIAL", reason: "Purdue pleads guilty to misbranding; the abuse-liability claim ruled false." },
      { year: 2013, axis: "REVERSED", community: "INSTITUTIONAL", reason: "FDA finds the original formulation withdrawn for safety — premise repudiated." },
    ],
  },
];

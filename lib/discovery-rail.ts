// Curated "start here" entry points for the homepage discovery rail.
//
// Narrative hooks, not bare labels — each points at a real route (a verified
// trajectory on /settling-curve, or a destination page). Kept deliberately distinct
// from the hero's FEATURED_TRAJECTORIES so the two rows don't echo each other.
// All trajectory ids below are confirmed present in the DB.

export type DiscoveryHook = {
  eyebrow: string;
  eyebrowColor: string; // tailwind text-* class
  title: string;
  blurb: string;
  href: string;
};

export const DISCOVERY_HOOKS: DiscoveryHook[] = [
  {
    eyebrow: "REVERSAL",
    eyebrowColor: "text-amber-300",
    title: "Ulcers aren't caused by stress",
    blurb: "A bacterium overturned 80 years of medical dogma — and won a Nobel.",
    href: "/settling-curve?t=helicobacter-pylori-peptic-ulcer-causation-1984",
  },
  {
    eyebrow: "SETTLED",
    eyebrowColor: "text-emerald-300",
    title: "Continents really do drift",
    blurb: "Ridiculed in 1912, plate tectonics was settled science by 1968.",
    href: "/settling-curve?t=plate-tectonics-accepted-1968",
  },
  {
    eyebrow: "FRAUD",
    eyebrowColor: "text-red-300",
    title: "The stem-cell fraud that fooled Science",
    blurb: "Hwang Woo-suk's cloned-cell claims — recorded, then reversed.",
    href: "/settling-curve?t=hwang-woosuk-stem-cell-fraud-2006",
  },
  {
    // Was "Senate votes vs. public opinion" → /analysis/representation, a Lab page.
    eyebrow: "OPEN QUESTION",
    eyebrowColor: "text-sky-300",
    title: "The longest-contested claims",
    blurb: "Fifty claims stamped CONTESTED and left there — dormancy is information.",
    href: "/open-questions",
  },
  {
    eyebrow: "RETRACTED",
    eyebrowColor: "text-rose-300",
    title: "Retracted papers, still cited",
    blurb: "26k+ retractions — and the live citations that never got the memo.",
    href: "/retraction-explorer",
  },
  {
    // Was "Senators trading what they regulate" → /congress-trades, a Lab page.
    eyebrow: "CANON",
    eyebrowColor: "text-blue-300",
    title: "The most-cited papers, audited",
    blurb: "Papers with 5,000+ citations, each carrying its epistemic status.",
    href: "/canon",
  },
];

import type { AtcMainGroup } from "./types";

// The 14 WHO ATC anatomical main groups (Level 1).
export const ATC_MAIN_GROUPS: { code: AtcMainGroup; name: string }[] = [
  { code: "A", name: "Alimentary tract & metabolism" },
  { code: "B", name: "Blood & blood-forming organs" },
  { code: "C", name: "Cardiovascular system" },
  { code: "D", name: "Dermatologicals" },
  { code: "G", name: "Genito-urinary system & sex hormones" },
  { code: "H", name: "Systemic hormonal preparations (excl. sex hormones & insulins)" },
  { code: "J", name: "Anti-infectives for systemic use" },
  { code: "L", name: "Antineoplastic & immunomodulating agents" },
  { code: "M", name: "Musculo-skeletal system" },
  { code: "N", name: "Nervous system" },
  { code: "P", name: "Antiparasitic products, insecticides & repellents" },
  { code: "R", name: "Respiratory system" },
  { code: "S", name: "Sensory organs" },
  { code: "V", name: "Various" },
];

// Selected Level-2 therapeutic subgroup labels used in the taxonomy — not exhaustive.
// A drug-utilisation classification, not a strict pharmacological ontology.
export const ATC_L2_LABELS: Record<string, string> = {
  A02: "Drugs for acid-related disorders",
  A03: "Drugs for functional GI disorders",
  A04: "Antiemetics & antinauseants",
  A06: "Laxatives",
  A07: "Antidiarrheals, intestinal anti-inflammatories/anti-infectives",
  A10: "Drugs used in diabetes",
  A14: "Anabolic agents for systemic use",
  B01: "Antithrombotic agents",
  B02: "Antihemorrhagics",
  B03: "Antianemic preparations",
  C01: "Cardiac therapy",
  C02: "Antihypertensives",
  C03: "Diuretics",
  C07: "Beta blocking agents",
  C08: "Calcium channel blockers",
  C09: "Agents acting on the renin-angiotensin system",
  C10: "Lipid-modifying agents",
  D01: "Antifungals for dermatological use",
  D05: "Antipsoriatics",
  D07: "Corticosteroids, dermatological preparations",
  D08: "Antiseptics & disinfectants",
  D10: "Anti-acne preparations",
  D11: "Other dermatological preparations",
  G03: "Sex hormones & modulators of the genital system",
  G04: "Urologicals",
  H01: "Pituitary & hypothalamic hormones and analogues",
  H02: "Corticosteroids for systemic use",
  H03: "Thyroid therapy",
  J01: "Antibacterials for systemic use",
  J02: "Antimycotics for systemic use",
  J04: "Antimycobacterials",
  J05: "Antivirals for systemic use",
  J06: "Immune sera & immunoglobulins",
  L01: "Antineoplastic agents",
  L02: "Endocrine therapy (antineoplastic)",
  L03: "Immunostimulants",
  L04: "Immunosuppressants",
  M01: "Anti-inflammatory & antirheumatic products",
  M03: "Muscle relaxants",
  M05: "Drugs for treatment of bone diseases",
  N01: "Anesthetics",
  N02: "Analgesics",
  N03: "Antiepileptics",
  N04: "Anti-Parkinson drugs",
  N05: "Psycholeptics",
  N06: "Psychoanaleptics",
  N07: "Other nervous system drugs",
  P01: "Antiprotozoals",
  P02: "Anthelmintics",
  R01: "Nasal preparations",
  R03: "Drugs for obstructive airway diseases",
  R05: "Cough & cold preparations",
  R06: "Antihistamines for systemic use",
  S01: "Ophthalmologicals",
  S02: "Otologicals",
  V03: "All other therapeutic products",
};

// Color per ATC main group so the tree reads as the WHO system, independent of family colors.
export const ATC_GROUP_COLOR: Record<AtcMainGroup, { bg: string; border: string; text: string }> = {
  A: { bg: "#3d2914", border: "#d97706", text: "#fde68a" }, // amber — alimentary
  B: { bg: "#450a0a", border: "#dc2626", text: "#fecaca" }, // red — blood
  C: { bg: "#3f1d1d", border: "#9f1239", text: "#fecdd3" }, // rose — cardio
  D: { bg: "#422006", border: "#a16207", text: "#fde68a" }, // dark amber — derm
  G: { bg: "#831843", border: "#ec4899", text: "#fbcfe8" }, // pink — GU
  H: { bg: "#064e3b", border: "#10b981", text: "#a7f3d0" }, // emerald — hormones
  J: { bg: "#1e3a5f", border: "#3b82f6", text: "#bfdbfe" }, // blue — anti-infectives
  L: { bg: "#4c1d95", border: "#a855f7", text: "#e9d5ff" }, // purple — oncology
  M: { bg: "#78350f", border: "#b45309", text: "#fed7aa" }, // orange — musculoskeletal
  N: { bg: "#2e1065", border: "#8b5cf6", text: "#ddd6fe" }, // violet — nervous
  P: { bg: "#064e3b", border: "#059669", text: "#a7f3d0" }, // teal-green — antiparasitic
  R: { bg: "#164e63", border: "#06b6d4", text: "#a5f3fc" }, // cyan — respiratory
  S: { bg: "#134e4a", border: "#14b8a6", text: "#99f6e4" }, // teal — sensory
  V: { bg: "#1f2937", border: "#6b7280", text: "#d1d5db" }, // gray — various
};

export function atcMainGroupOf(code: string): AtcMainGroup | null {
  if (!code) return null;
  const c = code.charAt(0).toUpperCase() as AtcMainGroup;
  return ATC_MAIN_GROUPS.some((g) => g.code === c) ? c : null;
}

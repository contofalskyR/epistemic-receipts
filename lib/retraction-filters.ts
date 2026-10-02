// The retraction explorer's filters — one list for /api/retractions, which
// whitelists its cache-key arguments against it (front door phase 6), and for
// RetractionExplorerClient, which renders it. Pure data: safe in a client bundle.

/** Field → journal-name keywords. All retraction claims share one
 *  "retracted-papers" topic, so the field is derived from the journal name —
 *  approximate, but the only field signal the data has. */
export const JOURNAL_KEYWORDS = {
  Medicine: [
    "medic", "clinical", "surg", "lancet", "nejm", "jama", "antimicrobial",
    "infect", "oncolog", "cardio", "pharma", "therapeutic", "diabet", "obstetric",
    "pediatr", "neurolog", "radio", "anesth", "immun", "vaccin", "vir", "hepat",
  ],
  Psychology: ["psycholog", "psychiatr", "behavior", "behaviour", "cognit", "mental health", "mental disord"],
  Biology: [
    "biolog", "biochem", "molecular", "cell", "genom", "genet", "microbi",
    "ecolog", "evolution", "physiolog", "neurosci", "protein", "rna ", "dna ",
  ],
  Physics: ["physic", "astrophys", "quantum", "applied physics", "physical review"],
  Chemistry: ["chemi", "polymer", "catalysis", "spectro", "electrochem", "organomet"],
} as const satisfies Record<string, readonly string[]>;

export type RetractionField = keyof typeof JOURNAL_KEYWORDS;
export const FIELD_OPTIONS = ["all", ...Object.keys(JOURNAL_KEYWORDS)] as ("all" | RetractionField)[];

export const REASON_OPTIONS = ["all", "Retraction", "Withdrawal", "Correction", "Reinstatement"] as const;
export type RetractionReason = (typeof REASON_OPTIONS)[number];

/** Own keys only: `field=constructor` must not reach Object.prototype. */
export const isRetractionField = (v: string): v is "all" | RetractionField =>
  v === "all" || Object.hasOwn(JOURNAL_KEYWORDS, v);
export const isRetractionReason = (v: string): v is RetractionReason =>
  (REASON_OPTIONS as readonly string[]).includes(v);

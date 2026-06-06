export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref =
  | "history"
  | "linguistics"
  | "biology"
  | "sociology"
  | "psychology"
  | "philosophy"
  | "economics"
  | "ideologies"
  | "governance"
  | "medicine"
  | "geology"
  | "statistics"
  | "finance";

export type Status = "open" | "landmark" | "refuted" | "contested" | "revised";

export type AnthEntry = {
  name: string;
  description: string;
  keyFact: string;
  region?: string;
  date?: string;
  ethnographer?: string;
  example?: string;
  tags: string[];
  xref?: Xref[];
  status?: Status;
};

export type ColorKey =
  | "violet"
  | "indigo"
  | "blue"
  | "sky"
  | "cyan"
  | "teal"
  | "emerald"
  | "green"
  | "amber"
  | "rose";

export type Family = {
  slug: string;
  number: number;
  name: string;
  blurb: string;
  section: Section;
  color: ColorKey;
  entries: AnthEntry[];
};

// ────────────────────────────────────────────────────────────────────────────
// Hominin timeline data
// ────────────────────────────────────────────────────────────────────────────

export type HomininClade = "australopith" | "early-homo" | "erectine" | "archaic-sapiens" | "sapiens" | "other";

export type HomininSpecies = {
  name: string;          // taxonomic name
  common?: string;       // shorthand / nickname
  clade: HomininClade;
  startMya: number;      // millions of years ago — first appearance
  endMya: number;        // last appearance (0 = extant)
  brainCC?: number;      // representative endocranial volume (cc)
  region: string;        // discovery region
  keySite?: string;      // type locality
  note: string;          // one-line distinguishing fact
  contested?: boolean;   // taxonomy debated (e.g., naledi, floresiensis)
};

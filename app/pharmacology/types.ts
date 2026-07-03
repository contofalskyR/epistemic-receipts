export type Section = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type Xref =
  | "medicine"
  | "public-health"
  | "statistics"
  | "chemistry"
  | "biology"
  | "mathematics"
  | "psychology"
  | "law"
  | "finance"
  | "environmental-science";

export type EntryKind = "drug" | "concept";

export type Status = "needs-verification" | "in-flux" | "contested";

export type PharmEntry = {
  name: string;
  description: string;
  kind: EntryKind;
  // Pharmacological class or concept category (e.g. "beta-lactam antibiotic", "PK parameter"). Filterable.
  className?: string;
  // For drug entries — mechanism of action (searchable core).
  mechanism?: string;
  // For drug entries — principal approved/reference therapeutic uses.
  indications?: string;
  // For drug entries — WHO ATC code(s) that position the entry in the ATC tree.
  atc?: string[];
  // For concept entries — the defining equation or definition, in LaTeX (searchable core).
  formula?: string;
  // Representative agent or canonical application (reference level only).
  example?: string;
  // Principal critiques / cautions — quarantined evaluation (adverse-effect classes, boxed warnings, resistance).
  cautions?: string;
  // Controlled-substance scheduling / governance (reference level).
  schedule?: string;
  // Status flag for volatile / contested / needs-verification entries.
  status?: Status;
  tags: string[];
  xref?: Xref[];
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
  | "rose"
  | "gray";

export type Family = {
  slug: string;
  number: number;
  name: string;
  blurb: string;
  section: Section;
  color: ColorKey;
  dataSource: string;
  entries: PharmEntry[];
};

// WHO ATC anatomical main groups — the 14 roots of the drug-class tree.
export type AtcMainGroup =
  | "A" | "B" | "C" | "D" | "G" | "H" | "J" | "L" | "M" | "N" | "P" | "R" | "S" | "V";

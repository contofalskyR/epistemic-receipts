export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref =
  | "governance"
  | "political-science"
  | "statistics"
  | "history"
  | "ideologies"
  | "sociology"
  | "psychology"
  | "communication"
  | "computer-science"
  | "engineering"
  | "finance"
  | "law"
  | "astronomy";

export type Status = "open" | "resolved" | "refuted";

export type LineageParent = {
  name: string;
  edgeLabel?: string;
};

export type SecEntry = {
  name: string;
  description: string;
  // Core searchable field ("Doctrine/principle:" / "Concept:").
  keyFact: string;
  // Schools/theorist entries carry lineage + figures + era; concepts may too.
  lineage?: string;
  // Parent nodes for the descent DAG (names must match a sibling entry's `name`).
  lineageParents?: LineageParent[];
  figures?: string;
  era?: string;
  example?: string;
  // Quarantined evaluation (all critical assessment lives here, not in the main voice).
  critiques?: string;
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
  // Data-source line naming the pipeline(s) or corpora this family absorbs.
  dataSource: string;
  entries: SecEntry[];
};

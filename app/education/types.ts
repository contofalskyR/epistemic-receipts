export type Section = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type Xref =
  | "statistics"
  | "psychology"
  | "sociology"
  | "communication"
  | "public-health"
  | "neuroscience"
  | "economics"
  | "linguistics"
  | "mathematics"
  | "computer-science"
  | "governance"
  | "law"
  | "ideologies";

export type Status = "open" | "resolved" | "refuted";

export type EducationEntry = {
  name: string;
  description: string;
  principle: string;
  lineage?: string;
  figures?: string[];
  era?: string;
  example?: string;
  principalCritiques?: string;
  tags: string[];
  xref?: Xref[];
  status?: Status;
};

export type ColorKey =
  | "amber"
  | "yellow"
  | "blue"
  | "sky"
  | "emerald"
  | "green"
  | "teal"
  | "cyan"
  | "violet"
  | "indigo"
  | "orange"
  | "pink"
  | "rose";

export type Family = {
  slug: string;
  number: number;
  name: string;
  blurb: string;
  section: Section;
  color: ColorKey;
  entries: EducationEntry[];
};

export type LineageEdge = {
  from: string;
  to: string;
  kind: "descends-from" | "reacts-against" | "extends";
};

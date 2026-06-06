export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref =
  | "neuroscience"
  | "biology"
  | "chemistry"
  | "medicine"
  | "psychology"
  | "statistics"
  | "physics";

export type Status = "open" | "landmark" | "refuted" | "contested";

export type OrgSystem =
  | "cardiovascular"
  | "respiratory"
  | "nervous"
  | "endocrine"
  | "digestive"
  | "renal"
  | "musculoskeletal"
  | "immune"
  | "reproductive"
  | "cellular";

export type PhysEntry = {
  name: string;
  description: string;
  keyFact: string;
  formula?: string;
  researcher?: string;
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
  systems: OrgSystem[];
  entries: PhysEntry[];
};

export type SystemInfo = {
  label: string;
  color: string;
  border: string;
  text: string;
  bg: string;
};

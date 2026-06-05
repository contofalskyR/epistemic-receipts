export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref = "chemistry" | "statistics";

export type Status = "landmark" | "open" | "refuted" | "contested";

export type MedEntry = {
  name: string;
  description: string;
  keyFact: string;
  example?: string;
  tags: string[];
  xref?: Xref[];
  status?: Status;
  organSystem?: OrganSystemKey;
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
  entries: MedEntry[];
};

export type OrganSystemKey =
  | "cardiovascular"
  | "respiratory"
  | "gastrointestinal"
  | "neurological"
  | "musculoskeletal"
  | "endocrine"
  | "immune"
  | "reproductive"
  | "renal"
  | "dermatological"
  | "psychiatric"
  | "hematological";

export type OrganSystem = {
  key: OrganSystemKey;
  name: string;
  blurb: string;
  organs: string[];
  diseases: string[];
};

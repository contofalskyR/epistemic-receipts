export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref =
  | "historical-events"
  | "ideologies"
  | "philosophy"
  | "governance"
  | "law"
  | "economics"
  | "biology"
  | "astronomy";

export type Status = "landmark" | "contested" | "open" | "revised";

export type HistEntry = {
  name: string;
  description: string;
  keyFact: string;
  date?: string;
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
  entries: HistEntry[];
};

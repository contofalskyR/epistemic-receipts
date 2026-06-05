export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref = "law" | "finance" | "economics" | "governance" | "statistics";

export type Status = "landmark" | "open" | "contested" | "overruled";

export type TaxEntry = {
  name: string;
  description: string;
  keyPrinciple: string;
  citation?: string;
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
  entries: TaxEntry[];
};

export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref = "law" | "governance" | "finance" | "economics" | "computer-science";

export type Status = "landmark" | "open" | "overruled" | "contested";

export type IpEntry = {
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
  | "orange"
  | "rose"
  | "red"
  | "pink"
  | "fuchsia";

export type Family = {
  slug: string;
  number: number;
  name: string;
  blurb: string;
  section: Section;
  color: ColorKey;
  entries: IpEntry[];
};

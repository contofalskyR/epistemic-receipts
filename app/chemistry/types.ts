export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref = "mathematics" | "statistics";

export type Status = "open" | "resolved" | "refuted";

export type Transform = { from: string; to: string };

export type ChemEntry = {
  name: string;
  description: string;
  keyFact: string;
  formula?: string;
  reaction?: string;
  transforms?: Transform[];
  example?: string;
  tags: string[];
  xref?: Xref[];
  status?: Status;
};

export type ColorKey = "violet" | "indigo" | "blue" | "sky" | "cyan" | "teal" | "emerald" | "green" | "amber" | "rose";

export type Family = {
  slug: string;
  number: number;
  name: string;
  blurb: string;
  section: Section;
  color: ColorKey;
  entries: ChemEntry[];
};

export type Block = "s" | "p" | "d" | "f";

export type ElementCategory =
  | "alkali-metal"
  | "alkaline-earth-metal"
  | "transition-metal"
  | "post-transition-metal"
  | "metalloid"
  | "reactive-nonmetal"
  | "noble-gas"
  | "lanthanide"
  | "actinide"
  | "unknown";

export type PeriodicElement = {
  symbol: string;
  name: string;
  atomicNumber: number;
  group: number;
  period: number;
  block: Block;
  category: ElementCategory;
  standardAtomicWeight: number | null;
  disputedPlacement?: string;
};

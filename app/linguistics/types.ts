export type Section = "A" | "B" | "C" | "D" | "E";

export type Xref = "philosophy" | "computer-science" | "statistics" | "mathematics";

export type Status = "open" | "resolved" | "contested" | "refuted";

export type LingEntry = {
  name: string;
  description: string;
  keyFact: string;
  notation?: string;
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
  entries: LingEntry[];
};

// IPA chart types — analogous to PeriodicElement in chemistry.

export type IpaCategory =
  | "plosive"
  | "nasal"
  | "trill"
  | "tap"
  | "fricative"
  | "lateral-fricative"
  | "approximant"
  | "lateral-approximant"
  | "vowel"
  | "click"
  | "implosive"
  | "ejective";

export type IpaSymbol = {
  ipa: string;
  name: string;
  type: "consonant" | "vowel";
  category: IpaCategory;
  // Consonant axes: place × voicing
  place?: string;
  voicing?: "voiceless" | "voiced";
  // Vowel axes: height × backness × rounding
  height?: "close" | "near-close" | "close-mid" | "mid" | "open-mid" | "near-open" | "open";
  backness?: "front" | "central" | "back";
  rounded?: boolean;
  example: string;
  description: string;
};

// Language family tree types

export type Language = {
  name: string;
  family: string;
  branch?: string;
  speakers?: number;
  iso639?: string;
  notes?: string;
};

export type LanguageFamily = {
  slug: string;
  name: string;
  approxSpeakers: number;
  branches: { name: string; languages: Language[] }[];
  notes?: string;
};

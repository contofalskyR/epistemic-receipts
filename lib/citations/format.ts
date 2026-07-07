// Citation formatting — BibTeX, CSL-JSON, RIS
// Field mapping decisions documented in lib/citations/mappings.md

export type CitationFormat = "bibtex" | "csl-json" | "ris";

export type CitationSource = {
  key: string;       // unique within the export (BibTeX citation key)
  title: string;
  url?: string | null;
  year?: number | null;
  month?: number | null;
  publisher?: string | null;
  journal?: string | null;
  volume?: string | null;
  issue?: string | null;
  doi?: string | null;
  authors?: string[];
  entryType?: "misc" | "article" | "techreport" | "legislation"; // default: misc
  note?: string | null;
};

function escapeBib(s: string): string {
  return s.replace(/[{}\\]/g, (c) => `\\${c}`);
}

export function formatBibTeX(sources: CitationSource[]): string {
  const lines: string[] = [
    "% BibTeX export — Epistemic Receipts",
    "% Field mapping: lib/citations/mappings.md",
    "",
  ];

  for (const s of sources) {
    const type =
      s.entryType === "article"
        ? "article"
        : s.entryType === "techreport"
        ? "techreport"
        : "misc";

    const fields: string[] = [];

    if (s.authors && s.authors.length > 0) {
      fields.push(`  author       = {${s.authors.map(escapeBib).join(" and ")}}`);
    }
    fields.push(`  title        = {${escapeBib(s.title)}}`);
    if (s.url) fields.push(`  howpublished = {\\url{${s.url}}}`);
    if (s.year) fields.push(`  year         = {${s.year}}`);
    if (s.month) fields.push(`  month        = {${s.month}}`);
    if (s.journal) fields.push(`  journal      = {${escapeBib(s.journal)}}`);
    if (s.volume) fields.push(`  volume       = {${s.volume}}`);
    if (s.issue) fields.push(`  number       = {${s.issue}}`);
    if (s.doi) fields.push(`  doi          = {${s.doi}}`);
    if (s.publisher) fields.push(`  publisher    = {${escapeBib(s.publisher)}}`);
    if (s.note) fields.push(`  note         = {${escapeBib(s.note)}}`);

    lines.push(`@${type}{${s.key},`);
    lines.push(fields.join(",\n"));
    lines.push("}");
    lines.push("");
  }

  return lines.join("\n");
}

export function formatRIS(sources: CitationSource[]): string {
  const blocks: string[] = [];

  for (const s of sources) {
    const ty =
      s.entryType === "article"
        ? "JOUR"
        : s.entryType === "techreport"
        ? "RPRT"
        : s.entryType === "legislation"
        ? "STAT"
        : "ELEC";

    const rows: string[] = [`TY  - ${ty}`, `TI  - ${s.title}`];

    if (s.authors) {
      for (const a of s.authors) rows.push(`AU  - ${a}`);
    }
    if (s.url) rows.push(`UR  - ${s.url}`);
    if (s.doi) rows.push(`DO  - ${s.doi}`);
    if (s.journal) rows.push(`JO  - ${s.journal}`);
    if (s.volume) rows.push(`VL  - ${s.volume}`);
    if (s.issue) rows.push(`IS  - ${s.issue}`);
    if (s.publisher) rows.push(`PB  - ${s.publisher}`);
    if (s.year) {
      const m = s.month ? String(s.month).padStart(2, "0") : "01";
      rows.push(`Y1  - ${s.year}/${m}/01`);
    }
    if (s.note) rows.push(`N1  - ${s.note}`);
    rows.push("ER  - ");

    blocks.push(rows.join("\n"));
  }

  return blocks.join("\n\n");
}

export type CslItem = {
  id: string;
  type: string;
  title: string;
  URL?: string;
  DOI?: string;
  issued?: { "date-parts": [[number, number?, number?]] };
  author?: { literal?: string; family?: string; given?: string }[];
  "container-title"?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  note?: string;
};

export function formatCSLJSON(sources: CitationSource[]): string {
  const items: CslItem[] = sources.map((s) => {
    const type =
      s.entryType === "article"
        ? "article-journal"
        : s.entryType === "techreport"
        ? "report"
        : s.entryType === "legislation"
        ? "legislation"
        : "webpage";

    const item: CslItem = { id: s.key, type, title: s.title };
    if (s.url) item.URL = s.url;
    if (s.doi) item.DOI = s.doi;
    if (s.year) {
      const parts: [number, number?, number?] = [s.year];
      if (s.month) parts.push(s.month);
      item.issued = { "date-parts": [parts] };
    }
    if (s.authors && s.authors.length > 0) {
      item.author = s.authors.map((a) => ({ literal: a }));
    }
    if (s.journal) item["container-title"] = s.journal;
    if (s.publisher) item.publisher = s.publisher;
    if (s.volume) item.volume = s.volume;
    if (s.issue) item.issue = s.issue;
    if (s.note) item.note = s.note;

    return item;
  });

  return JSON.stringify(items, null, 2);
}

export function renderCitation(
  format: CitationFormat,
  sources: CitationSource[],
): { body: string; contentType: string; ext: string } {
  switch (format) {
    case "bibtex":
      return {
        body: formatBibTeX(sources),
        contentType: "text/plain; charset=utf-8",
        ext: "bib",
      };
    case "ris":
      return {
        body: formatRIS(sources),
        contentType: "application/x-research-info-systems; charset=utf-8",
        ext: "ris",
      };
    case "csl-json":
      return {
        body: formatCSLJSON(sources),
        contentType: "application/json; charset=utf-8",
        ext: "json",
      };
  }
}

// Derive entry type from source metadata
export function inferEntryType(
  url: string | null | undefined,
  methodologyType: string | null | undefined,
): CitationSource["entryType"] {
  if (methodologyType === "peer_reviewed") return "article";
  if (methodologyType === "legislation") return "legislation";
  if (methodologyType === "official_record") return "techreport";

  if (url) {
    const legislationDomains = [
      "congress.gov",
      "legislation.gov.uk",
      "legifrance.gouv.fr",
      "bundesgesetzblatt.de",
      "eur-lex.europa.eu",
    ];
    if (legislationDomains.some((d) => url.includes(d))) return "legislation";
  }

  return "misc";
}

// Build a BibTeX-safe citation key
export function makeCitationKey(prefix: string, title: string, year: number | null | undefined, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  const y = year ?? "nd";
  return `er_${prefix}_${slug}_${y}_${index + 1}`;
}

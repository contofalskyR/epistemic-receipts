import { describe, it, expect } from "vitest";
import {
  formatBibTeX,
  formatRIS,
  formatCSLJSON,
  inferEntryType,
  makeCitationKey,
  renderCitation,
  type CitationSource,
} from "@/lib/citations/format";

const sampleSource: CitationSource = {
  key: "er_test_2024_1",
  title: "FDA Approves Drug XYZ",
  url: "https://www.fda.gov/drugs/xyz",
  year: 2024,
  month: 3,
  entryType: "misc",
  note: "Evidence for: Drug XYZ is approved. Relation: FOR.",
};

const paperSource: CitationSource = {
  key: "er_paper_2023_1",
  title: "Climate Change and Health: A Meta-Analysis",
  url: "https://doi.org/10.1234/cc2023",
  year: 2023,
  month: 6,
  authors: ["Smith, Jane", "Doe, John"],
  journal: "The Lancet",
  volume: "401",
  issue: "10379",
  doi: "10.1234/cc2023",
  entryType: "article",
  note: "Peer-reviewed.",
};

describe("inferEntryType", () => {
  it("maps peer_reviewed methodology to article", () => {
    expect(inferEntryType(null, "peer_reviewed")).toBe("article");
  });

  it("maps legislation methodology to legislation", () => {
    expect(inferEntryType(null, "legislation")).toBe("legislation");
  });

  it("maps official_record to techreport", () => {
    expect(inferEntryType(null, "official_record")).toBe("techreport");
  });

  it("infers legislation from congress.gov URL", () => {
    expect(inferEntryType("https://www.congress.gov/bill/xyz", null)).toBe("legislation");
  });

  it("defaults to misc for unknown types", () => {
    expect(inferEntryType("https://example.com", "primary")).toBe("misc");
  });

  it("returns misc when both url and methodologyType are null", () => {
    expect(inferEntryType(null, null)).toBe("misc");
  });
});

describe("makeCitationKey", () => {
  it("generates a safe key with prefix, slug, year, index", () => {
    const key = makeCitationKey("claim", "FDA Approves Drug XYZ", 2024, 0);
    expect(key).toBe("er_claim_fda_approves_drug_xyz_2024_1");
  });

  it("uses nd when year is null", () => {
    const key = makeCitationKey("src", "Some Title", null, 2);
    expect(key).toMatch(/er_src_.*_nd_3/);
  });

  it("slugs are capped at 30 chars", () => {
    const key = makeCitationKey("col", "A very long title that exceeds the maximum allowed slug length in the key", 2023, 0);
    const slug = key.split("_").slice(2, -2).join("_");
    expect(slug.length).toBeLessThanOrEqual(30);
  });
});

describe("formatBibTeX", () => {
  it("outputs @misc entry for basic source", () => {
    const bib = formatBibTeX([sampleSource]);
    expect(bib).toContain("@misc{er_test_2024_1,");
    expect(bib).toContain("title        = {FDA Approves Drug XYZ}");
    expect(bib).toContain("howpublished = {\\url{https://www.fda.gov/drugs/xyz}}");
    expect(bib).toContain("year         = {2024}");
  });

  it("outputs @article entry for paper", () => {
    const bib = formatBibTeX([paperSource]);
    expect(bib).toContain("@article{er_paper_2023_1,");
    expect(bib).toContain("author       = {Smith, Jane and Doe, John}");
    expect(bib).toContain("journal      = {The Lancet}");
    expect(bib).toContain("doi          = {10.1234/cc2023}");
  });

  it("omits author field when no authors provided", () => {
    const bib = formatBibTeX([sampleSource]);
    expect(bib).not.toContain("author");
  });

  it("escapes curly braces in title", () => {
    const src: CitationSource = { ...sampleSource, title: "Test {braces} in title" };
    const bib = formatBibTeX([src]);
    expect(bib).not.toContain("{braces}");
  });

  it("handles multiple sources", () => {
    const bib = formatBibTeX([sampleSource, paperSource]);
    expect(bib).toContain("@misc{er_test_2024_1");
    expect(bib).toContain("@article{er_paper_2023_1");
  });
});

describe("formatRIS", () => {
  it("outputs ELEC type for misc source", () => {
    const ris = formatRIS([sampleSource]);
    expect(ris).toContain("TY  - ELEC");
    expect(ris).toContain("TI  - FDA Approves Drug XYZ");
    expect(ris).toContain("UR  - https://www.fda.gov/drugs/xyz");
    expect(ris).toContain("ER  - ");
  });

  it("outputs JOUR type for article", () => {
    const ris = formatRIS([paperSource]);
    expect(ris).toContain("TY  - JOUR");
    expect(ris).toContain("JO  - The Lancet");
    expect(ris).toContain("AU  - Smith, Jane");
    expect(ris).toContain("AU  - Doe, John");
  });

  it("outputs STAT type for legislation", () => {
    const src: CitationSource = { ...sampleSource, entryType: "legislation" };
    const ris = formatRIS([src]);
    expect(ris).toContain("TY  - STAT");
  });

  it("outputs RPRT type for techreport", () => {
    const src: CitationSource = { ...sampleSource, entryType: "techreport" };
    const ris = formatRIS([src]);
    expect(ris).toContain("TY  - RPRT");
  });

  it("formats year correctly", () => {
    const ris = formatRIS([sampleSource]);
    expect(ris).toContain("Y1  - 2024/03/01");
  });
});

describe("formatCSLJSON", () => {
  it("outputs valid JSON array", () => {
    const json = formatCSLJSON([sampleSource]);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
  });

  it("sets correct CSL type for webpage", () => {
    const parsed = JSON.parse(formatCSLJSON([sampleSource]));
    expect(parsed[0].type).toBe("webpage");
  });

  it("sets correct CSL type for article-journal", () => {
    const parsed = JSON.parse(formatCSLJSON([paperSource]));
    expect(parsed[0].type).toBe("article-journal");
  });

  it("includes DOI when provided", () => {
    const parsed = JSON.parse(formatCSLJSON([paperSource]));
    expect(parsed[0].DOI).toBe("10.1234/cc2023");
  });

  it("formats issued date-parts correctly", () => {
    const parsed = JSON.parse(formatCSLJSON([sampleSource]));
    expect(parsed[0].issued["date-parts"][0]).toEqual([2024, 3]);
  });
});

describe("renderCitation", () => {
  it("bibtex: correct content-type and ext", () => {
    const result = renderCitation("bibtex", [sampleSource]);
    expect(result.contentType).toContain("text/plain");
    expect(result.ext).toBe("bib");
  });

  it("ris: correct content-type and ext", () => {
    const result = renderCitation("ris", [sampleSource]);
    expect(result.contentType).toContain("research-info-systems");
    expect(result.ext).toBe("ris");
  });

  it("csl-json: correct content-type and ext", () => {
    const result = renderCitation("csl-json", [sampleSource]);
    expect(result.contentType).toContain("application/json");
    expect(result.ext).toBe("json");
  });
});

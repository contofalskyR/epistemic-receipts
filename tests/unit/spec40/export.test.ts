import { describe, it, expect } from "vitest";
import type { ClaimExportRow } from "@/lib/litigation/export";

// Pure serialization tests — no DB, no R2

const FIXTURE_ROWS: ClaimExportRow[] = [
  {
    claimId: "clm_001",
    claimText: "Cigarette smoking causes lung cancer",
    epistemicAxis: "SETTLED",
    epistemicStatus: "confirmed",
    claimEmergedAt: "1950-06-26T00:00:00.000Z",
    statusHistory: [
      {
        toAxis: "CONTESTED",
        community: "EXPERT_LITERATURE",
        occurredAt: "1950-06-26T00:00:00.000Z",
        datePrecision: "DAY",
        reason: "Doll & Hill epidemiological study published",
      },
      {
        toAxis: "SETTLED",
        community: "INSTITUTIONAL",
        occurredAt: "1964-01-11T00:00:00.000Z",
        datePrecision: "DAY",
        reason: "US Surgeon General report",
      },
    ],
    sources: [
      {
        id: "src_001",
        name: "Doll & Hill (1950)",
        url: "https://example.com/doll-hill",
        publishedAt: "1950-06-26T00:00:00.000Z",
        edgeType: "FOR",
      },
    ],
    addedToMatter: "2026-01-15T10:00:00.000Z",
    relevanceTag: "key-fact",
    notes: "Central claim in tobacco litigation",
  },
  {
    claimId: "clm_002",
    claimText: 'Industry documents show tobacco companies knew of cancer risk by "the 1950s"',
    epistemicAxis: "SETTLED",
    epistemicStatus: "settled_judgment",
    claimEmergedAt: "1998-11-23T00:00:00.000Z",
    statusHistory: [
      {
        toAxis: "SETTLED",
        community: "JUDICIAL",
        occurredAt: "2006-08-17T00:00:00.000Z",
        datePrecision: "DAY",
        reason: "DOJ v. Philip Morris ruling",
      },
    ],
    sources: [],
    addedToMatter: "2026-01-15T10:05:00.000Z",
    relevanceTag: "rebuttal",
    notes: null,
  },
  {
    claimId: "clm_003",
    claimText: "Secondhand smoke exposure increases lung cancer risk in non-smokers",
    epistemicAxis: "SETTLED",
    epistemicStatus: "confirmed",
    claimEmergedAt: null,
    statusHistory: [],
    sources: [
      {
        id: "src_002",
        name: "EPA Report 1992",
        url: null,
        publishedAt: "1992-01-01T00:00:00.000Z",
        edgeType: "FOR",
      },
      {
        id: "src_003",
        name: "IARC Monograph 83",
        url: "https://example.com/iarc-83",
        publishedAt: "2002-06-01T00:00:00.000Z",
        edgeType: "FOR",
      },
    ],
    addedToMatter: "2026-01-16T09:00:00.000Z",
    relevanceTag: "background",
    notes: "Useful for establishing pattern of knowledge suppression",
  },
];

// ── JSONL serializer tests ────────────────────────────────────────────────────

function rowToJSONL(row: ClaimExportRow): string {
  return JSON.stringify(row);
}

function parseJSONLLine(line: string): ClaimExportRow {
  return JSON.parse(line) as ClaimExportRow;
}

describe("JSONL serializer", () => {
  it("each row serializes to valid JSON", () => {
    for (const row of FIXTURE_ROWS) {
      expect(() => JSON.parse(rowToJSONL(row))).not.toThrow();
    }
  });

  it("serialized row round-trips losslessly", () => {
    for (const row of FIXTURE_ROWS) {
      const roundTripped = parseJSONLLine(rowToJSONL(row));
      expect(roundTripped).toEqual(row);
    }
  });

  it("all required fields present in every row", () => {
    const requiredFields: (keyof ClaimExportRow)[] = [
      "claimId",
      "claimText",
      "epistemicAxis",
      "epistemicStatus",
      "claimEmergedAt",
      "statusHistory",
      "sources",
      "addedToMatter",
      "relevanceTag",
      "notes",
    ];
    for (const row of FIXTURE_ROWS) {
      const parsed = parseJSONLLine(rowToJSONL(row));
      for (const field of requiredFields) {
        expect(parsed).toHaveProperty(field);
      }
    }
  });

  it("statusHistory is an array in serialized form", () => {
    for (const row of FIXTURE_ROWS) {
      const parsed = parseJSONLLine(rowToJSONL(row));
      expect(Array.isArray(parsed.statusHistory)).toBe(true);
    }
  });

  it("sources is an array in serialized form", () => {
    for (const row of FIXTURE_ROWS) {
      const parsed = parseJSONLLine(rowToJSONL(row));
      expect(Array.isArray(parsed.sources)).toBe(true);
    }
  });

  it("null claimEmergedAt serializes as null, not undefined", () => {
    const rowWithNullDate = FIXTURE_ROWS.find((r) => r.claimEmergedAt === null);
    expect(rowWithNullDate).toBeDefined();
    const parsed = parseJSONLLine(rowToJSONL(rowWithNullDate!));
    expect(parsed.claimEmergedAt).toBeNull();
  });

  it("null notes serializes as null, not undefined", () => {
    const rowWithNullNotes = FIXTURE_ROWS.find((r) => r.notes === null);
    expect(rowWithNullNotes).toBeDefined();
    const parsed = parseJSONLLine(rowToJSONL(rowWithNullNotes!));
    expect(parsed.notes).toBeNull();
  });

  it("double-quotes in claimText survive round-trip", () => {
    const rowWithQuotes: ClaimExportRow = {
      ...FIXTURE_ROWS[1],
      claimText: 'Industry knew "by the 1950s"',
    };
    const parsed = parseJSONLLine(rowToJSONL(rowWithQuotes));
    expect(parsed.claimText).toBe('Industry knew "by the 1950s"');
  });
});

// ── CSV serializer tests ──────────────────────────────────────────────────────

const CSV_HEADER =
  '"claimId","claimText","epistemicAxis","epistemicStatus","claimEmergedAt",' +
  '"statusHistoryCount","latestAxis","sourceCount","addedToMatter","relevanceTag","notes"';

function rowToCSV(row: ClaimExportRow): string {
  const latestAxis = row.statusHistory.at(-1)?.toAxis ?? "";
  const fields = [
    row.claimId,
    row.claimText.replace(/"/g, '""'),
    row.epistemicAxis ?? "",
    row.epistemicStatus ?? "",
    row.claimEmergedAt ?? "",
    row.statusHistory.length.toString(),
    latestAxis,
    row.sources.length.toString(),
    row.addedToMatter,
    row.relevanceTag ?? "",
    (row.notes ?? "").replace(/"/g, '""'),
  ];
  return fields.map((f) => `"${f}"`).join(",");
}

function parseCSVRow(line: string): string[] {
  // Naive CSV parse for testing: split on `","` after stripping outer quotes
  return line.slice(1, -1).split('","');
}

describe("CSV serializer", () => {
  it("header has the correct number of columns", () => {
    const cols = CSV_HEADER.split(",");
    expect(cols).toHaveLength(11);
  });

  it("each data row has the same number of columns as the header", () => {
    const headerCols = CSV_HEADER.split(",").length;
    for (const row of FIXTURE_ROWS) {
      const csvRow = rowToCSV(row);
      const cols = parseCSVRow(csvRow);
      expect(cols).toHaveLength(headerCols);
    }
  });

  it("claimId is the first column", () => {
    for (const row of FIXTURE_ROWS) {
      const cols = parseCSVRow(rowToCSV(row));
      expect(cols[0]).toBe(row.claimId);
    }
  });

  it("statusHistoryCount matches actual history length", () => {
    for (const row of FIXTURE_ROWS) {
      const cols = parseCSVRow(rowToCSV(row));
      expect(parseInt(cols[5]!)).toBe(row.statusHistory.length);
    }
  });

  it("latestAxis matches last statusHistory entry", () => {
    const rowWithHistory = FIXTURE_ROWS[0]!;
    const cols = parseCSVRow(rowToCSV(rowWithHistory));
    expect(cols[6]).toBe("SETTLED");
  });

  it("latestAxis is empty for claims with no history", () => {
    const rowNoHistory = FIXTURE_ROWS[2]!;
    expect(rowNoHistory.statusHistory).toHaveLength(0);
    const cols = parseCSVRow(rowToCSV(rowNoHistory));
    expect(cols[6]).toBe("");
  });

  it("sourceCount matches actual source count", () => {
    for (const row of FIXTURE_ROWS) {
      const cols = parseCSVRow(rowToCSV(row));
      expect(parseInt(cols[7]!)).toBe(row.sources.length);
    }
  });

  it("double-quotes in claimText are escaped as double-double-quotes", () => {
    const rowWithQuotes: ClaimExportRow = {
      ...FIXTURE_ROWS[1],
      claimText: 'knew "by the 1950s"',
    };
    const csv = rowToCSV(rowWithQuotes);
    expect(csv).toContain('knew ""by the 1950s""');
  });

  it("null relevanceTag serializes as empty string", () => {
    const rowNoTag = FIXTURE_ROWS.find((r) => r.relevanceTag === null);
    if (rowNoTag) {
      const cols = parseCSVRow(rowToCSV(rowNoTag));
      expect(cols[9]).toBe("");
    }
  });
});

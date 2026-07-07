import { describe, it, expect, vi } from "vitest";

// lib/search.ts imports these at module load; mock so the pure SQL builders
// can be tested without a DB connection or OpenAI key.
vi.mock("@/lib/embeddings", () => ({
  embedText3Small: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
}));

import { buildTsvectorSql, buildVectorSql, type SearchFilters } from "@/lib/search";

const NO_FILTERS: SearchFilters = {};
const AXIS_ONLY: SearchFilters = { axis: "empirical" };
const PIPELINES_ONLY: SearchFilters = { pipelines: ["sec-edgar", "scotus"] };
const BOTH: SearchFilters = { axis: "empirical", pipelines: ["sec-edgar", "scotus"] };

const CASES: Array<[string, SearchFilters]> = [
  ["no filters", NO_FILTERS],
  ["axis only", AXIS_ONLY],
  ["pipelines only", PIPELINES_ONLY],
  ["axis + pipelines", BOTH],
];

function assertValidPlaceholders(sql: string, params: unknown[]) {
  // $0 is never a valid Postgres parameter
  expect(sql).not.toMatch(/\$0\b/);

  // Every placeholder must be within 1..params.length
  const placeholders = [...sql.matchAll(/\$(\d+)/g)].map(m => Number(m[1]));
  expect(placeholders.length).toBeGreaterThan(0);
  for (const n of placeholders) {
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(params.length);
  }

  // The highest placeholder must equal the param count (no unused trailing params)
  expect(Math.max(...placeholders)).toBe(params.length);
}

describe("buildTsvectorSql", () => {
  for (const [name, filters] of CASES) {
    it(`produces valid parameter indexes (${name})`, () => {
      const { sql, params } = buildTsvectorSql("test query", filters, 25, 0);
      assertValidPlaceholders(sql, params);
      // limit/offset are the last two params
      expect(params[params.length - 2]).toBe(25);
      expect(params[params.length - 1]).toBe(0);
      expect(sql).toMatch(new RegExp(`LIMIT \\$${params.length - 1} OFFSET \\$${params.length}`));
    });
  }
});

describe("buildVectorSql", () => {
  for (const [name, filters] of CASES) {
    it(`produces valid parameter indexes (${name})`, () => {
      const { sql, params } = buildVectorSql("[0.1,0.2]", filters, 25, 10);
      assertValidPlaceholders(sql, params);
      expect(params[params.length - 2]).toBe(25);
      expect(params[params.length - 1]).toBe(10);
      expect(sql).toMatch(new RegExp(`LIMIT \\$${params.length - 1} OFFSET \\$${params.length}`));
    });
  }
});

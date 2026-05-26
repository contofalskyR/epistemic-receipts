/**
 * Maps a year to the best available GeoJSON file for displaying borders/coastlines.
 *
 * Time ranges:
 * - Geological (>1 Ma ago): Use GPlates paleogeographic coastlines
 * - Historical (123000 BCE to 2010 CE): Use historical-basemaps political boundaries
 * - Modern (2010+): Use Natural Earth current borders
 */

export type GeoSource = "paleo" | "historical" | "modern";

export type GeoJSONSelection = {
  path: string;
  source: GeoSource;
  label: string;
  snapshotYear: number | null; // null for paleo (uses Ma instead)
  snapshotMa: number | null; // null for historical/modern
};

// Paleogeographic snapshots (millions of years ago)
const PALEO_SNAPSHOTS = [
  { ma: 500, file: "coastlines_500ma.geojson", label: "500 Ma (Late Cambrian)" },
  { ma: 400, file: "coastlines_400ma.geojson", label: "400 Ma (Devonian)" },
  { ma: 300, file: "coastlines_300ma.geojson", label: "300 Ma (Carboniferous)" },
  { ma: 250, file: "coastlines_250ma.geojson", label: "250 Ma (Permian - Pangaea)" },
  { ma: 200, file: "coastlines_200ma.geojson", label: "200 Ma (Triassic)" },
  { ma: 150, file: "coastlines_150ma.geojson", label: "150 Ma (Jurassic)" },
  { ma: 66, file: "coastlines_66ma.geojson", label: "66 Ma (K-Pg Extinction)" },
  { ma: 34, file: "coastlines_34ma.geojson", label: "34 Ma (Eocene-Oligocene)" },
  { ma: 5, file: "coastlines_5ma.geojson", label: "5 Ma (Pliocene)" },
  { ma: 2, file: "coastlines_2ma.geojson", label: "2 Ma (Pleistocene)" },
  { ma: 1, file: "coastlines_1ma.geojson", label: "1 Ma (Early Ice Age)" },
];

// Historical snapshots (year CE, negative = BCE)
const HISTORICAL_SNAPSHOTS = [
  { year: -123000, file: "world_bc123000.geojson", label: "~123,000 BCE" },
  { year: -10000, file: "world_bc10000.geojson", label: "~10,000 BCE" },
  { year: -8000, file: "world_bc8000.geojson", label: "~8,000 BCE" },
  { year: -5000, file: "world_bc5000.geojson", label: "~5,000 BCE" },
  { year: -4000, file: "world_bc4000.geojson", label: "~4,000 BCE" },
  { year: -3000, file: "world_bc3000.geojson", label: "~3,000 BCE" },
  { year: -2000, file: "world_bc2000.geojson", label: "~2,000 BCE" },
  { year: -1500, file: "world_bc1500.geojson", label: "~1,500 BCE" },
  { year: -1000, file: "world_bc1000.geojson", label: "~1,000 BCE" },
  { year: -700, file: "world_bc700.geojson", label: "~700 BCE" },
  { year: -500, file: "world_bc500.geojson", label: "~500 BCE" },
  { year: -400, file: "world_bc400.geojson", label: "~400 BCE" },
  { year: -323, file: "world_bc323.geojson", label: "323 BCE" },
  { year: -300, file: "world_bc300.geojson", label: "~300 BCE" },
  { year: -200, file: "world_bc200.geojson", label: "~200 BCE" },
  { year: -100, file: "world_bc100.geojson", label: "~100 BCE" },
  { year: -1, file: "world_bc1.geojson", label: "1 BCE" },
  { year: 100, file: "world_100.geojson", label: "100 CE" },
  { year: 200, file: "world_200.geojson", label: "200 CE" },
  { year: 300, file: "world_300.geojson", label: "300 CE" },
  { year: 400, file: "world_400.geojson", label: "400 CE" },
  { year: 500, file: "world_500.geojson", label: "500 CE" },
  { year: 600, file: "world_600.geojson", label: "600 CE" },
  { year: 700, file: "world_700.geojson", label: "700 CE" },
  { year: 800, file: "world_800.geojson", label: "800 CE" },
  { year: 900, file: "world_900.geojson", label: "900 CE" },
  { year: 1000, file: "world_1000.geojson", label: "1000 CE" },
  { year: 1100, file: "world_1100.geojson", label: "1100 CE" },
  { year: 1200, file: "world_1200.geojson", label: "1200 CE" },
  { year: 1279, file: "world_1279.geojson", label: "1279 CE" },
  { year: 1300, file: "world_1300.geojson", label: "1300 CE" },
  { year: 1400, file: "world_1400.geojson", label: "1400 CE" },
  { year: 1492, file: "world_1492.geojson", label: "1492 CE" },
  { year: 1500, file: "world_1500.geojson", label: "1500 CE" },
  { year: 1530, file: "world_1530.geojson", label: "1530 CE" },
  { year: 1600, file: "world_1600.geojson", label: "1600 CE" },
  { year: 1650, file: "world_1650.geojson", label: "1650 CE" },
  { year: 1700, file: "world_1700.geojson", label: "1700 CE" },
  { year: 1715, file: "world_1715.geojson", label: "1715 CE" },
  { year: 1783, file: "world_1783.geojson", label: "1783 CE" },
  { year: 1800, file: "world_1800.geojson", label: "1800 CE" },
  { year: 1815, file: "world_1815.geojson", label: "1815 CE" },
  { year: 1880, file: "world_1880.geojson", label: "1880 CE" },
  { year: 1900, file: "world_1900.geojson", label: "1900 CE" },
  { year: 1914, file: "world_1914.geojson", label: "1914 CE" },
  { year: 1920, file: "world_1920.geojson", label: "1920 CE" },
  { year: 1930, file: "world_1930.geojson", label: "1930 CE" },
  { year: 1938, file: "world_1938.geojson", label: "1938 CE" },
  { year: 1945, file: "world_1945.geojson", label: "1945 CE" },
  { year: 1960, file: "world_1960.geojson", label: "1960 CE" },
  { year: 1994, file: "world_1994.geojson", label: "1994 CE" },
  { year: 2000, file: "world_2000.geojson", label: "2000 CE" },
  { year: 2010, file: "world_2010.geojson", label: "2010 CE" },
];

const MODERN_GEOJSON_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

const CURRENT_YEAR = 2026;

/**
 * Convert year CE to millions of years ago (Ma)
 * @param yearCE Year in CE (negative = BCE)
 * @returns Millions of years ago
 */
function yearToMa(yearCE: number): number {
  const yearsAgo = CURRENT_YEAR - yearCE;
  return yearsAgo / 1_000_000;
}

/**
 * Find the nearest snapshot in an array by comparing to a target value
 */
function findNearestPaleo(snapshots: typeof PALEO_SNAPSHOTS, target: number) {
  let nearest = snapshots[0];
  let minDiff = Math.abs(snapshots[0].ma - target);

  for (const snapshot of snapshots) {
    const diff = Math.abs(snapshot.ma - target);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = snapshot;
    }
  }

  return nearest;
}

function findNearestHistorical(snapshots: typeof HISTORICAL_SNAPSHOTS, target: number) {
  let nearest = snapshots[0];
  let minDiff = Math.abs(snapshots[0].year - target);

  for (const snapshot of snapshots) {
    const diff = Math.abs(snapshot.year - target);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = snapshot;
    }
  }

  return nearest;
}

/**
 * Get the appropriate GeoJSON file for a given year
 * @param yearCE Year in CE (negative = BCE)
 * @returns GeoJSON file path and metadata
 */
export function getGeoJSONForYear(yearCE: number): GeoJSONSelection {
  const ma = yearToMa(yearCE);

  // Deep geological time: use paleogeographic data (>1 Ma ago)
  if (ma >= 1) {
    const nearest = findNearestPaleo(PALEO_SNAPSHOTS, ma);
    return {
      path: `/geo/paleo/${nearest.file}`,
      source: "paleo",
      label: `Paleogeography: ${nearest.label}`,
      snapshotYear: null,
      snapshotMa: nearest.ma,
    };
  }

  // Modern time: use Natural Earth (after 2010)
  if (yearCE > 2010) {
    return {
      path: MODERN_GEOJSON_URL,
      source: "modern",
      label: "Present-day borders",
      snapshotYear: CURRENT_YEAR,
      snapshotMa: null,
    };
  }

  // Historical time: use historical basemaps
  const nearest = findNearestHistorical(HISTORICAL_SNAPSHOTS, yearCE);
  return {
    path: `/geo/historical/${nearest.file}`,
    source: "historical",
    label: `Borders: ${nearest.label}`,
    snapshotYear: nearest.year,
    snapshotMa: null,
  };
}

/**
 * Check if a path is a remote URL
 */
export function isRemoteUrl(path: string): boolean {
  return path.startsWith("http://") || path.startsWith("https://");
}

/**
 * Get all available historical snapshot years (for UI display)
 */
export function getHistoricalSnapshots() {
  return HISTORICAL_SNAPSHOTS.map((s) => ({ year: s.year, label: s.label }));
}

/**
 * Get all available paleo snapshot times (for UI display)
 */
export function getPaleoSnapshots() {
  return PALEO_SNAPSHOTS.map((s) => ({ ma: s.ma, label: s.label }));
}

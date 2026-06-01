// Country centroids keyed by ISO 3166-1 alpha-3.
// Coordinates are approximate visual centers (decimal degrees) — good enough for
// drawing arcs between country pairs on a globe. Names match common usage.
//
// Subset covers all alpha-3 codes referenced from PIPELINE_COUNTRY +
// ALPHA2_TO_ALPHA3 in app/api/globe/country-claims/route.ts plus a few major
// jurisdictions that show up via PoliticalContext.country resolution.

export type CountryCentroid = {
  alpha3: string;
  alpha2: string;
  name: string;
  lat: number;
  lng: number;
};

export const COUNTRY_CENTROIDS: Record<string, CountryCentroid> = {
  USA: { alpha3: "USA", alpha2: "US", name: "United States", lat: 39.8283, lng: -98.5795 },
  GBR: { alpha3: "GBR", alpha2: "GB", name: "United Kingdom", lat: 54.0, lng: -2.0 },
  DEU: { alpha3: "DEU", alpha2: "DE", name: "Germany", lat: 51.1657, lng: 10.4515 },
  FRA: { alpha3: "FRA", alpha2: "FR", name: "France", lat: 46.6034, lng: 1.8883 },
  ITA: { alpha3: "ITA", alpha2: "IT", name: "Italy", lat: 41.8719, lng: 12.5674 },
  ESP: { alpha3: "ESP", alpha2: "ES", name: "Spain", lat: 40.4637, lng: -3.7492 },
  PRT: { alpha3: "PRT", alpha2: "PT", name: "Portugal", lat: 39.3999, lng: -8.2245 },
  NLD: { alpha3: "NLD", alpha2: "NL", name: "Netherlands", lat: 52.1326, lng: 5.2913 },
  BEL: { alpha3: "BEL", alpha2: "BE", name: "Belgium", lat: 50.5039, lng: 4.4699 },
  SWE: { alpha3: "SWE", alpha2: "SE", name: "Sweden", lat: 60.1282, lng: 18.6435 },
  DNK: { alpha3: "DNK", alpha2: "DK", name: "Denmark", lat: 56.2639, lng: 9.5018 },
  FIN: { alpha3: "FIN", alpha2: "FI", name: "Finland", lat: 61.9241, lng: 25.7482 },
  NOR: { alpha3: "NOR", alpha2: "NO", name: "Norway", lat: 60.472, lng: 8.4689 },
  AUT: { alpha3: "AUT", alpha2: "AT", name: "Austria", lat: 47.5162, lng: 14.5501 },
  CHE: { alpha3: "CHE", alpha2: "CH", name: "Switzerland", lat: 46.8182, lng: 8.2275 },
  IRL: { alpha3: "IRL", alpha2: "IE", name: "Ireland", lat: 53.4129, lng: -8.2439 },
  POL: { alpha3: "POL", alpha2: "PL", name: "Poland", lat: 51.9194, lng: 19.1451 },
  CZE: { alpha3: "CZE", alpha2: "CZ", name: "Czechia", lat: 49.8175, lng: 15.473 },
  HUN: { alpha3: "HUN", alpha2: "HU", name: "Hungary", lat: 47.1625, lng: 19.5033 },
  SVK: { alpha3: "SVK", alpha2: "SK", name: "Slovakia", lat: 48.669, lng: 19.699 },
  SVN: { alpha3: "SVN", alpha2: "SI", name: "Slovenia", lat: 46.1512, lng: 14.9955 },
  HRV: { alpha3: "HRV", alpha2: "HR", name: "Croatia", lat: 45.1, lng: 15.2 },
  ROU: { alpha3: "ROU", alpha2: "RO", name: "Romania", lat: 45.9432, lng: 24.9668 },
  BGR: { alpha3: "BGR", alpha2: "BG", name: "Bulgaria", lat: 42.7339, lng: 25.4858 },
  SRB: { alpha3: "SRB", alpha2: "RS", name: "Serbia", lat: 44.0165, lng: 21.0059 },
  EST: { alpha3: "EST", alpha2: "EE", name: "Estonia", lat: 58.5953, lng: 25.0136 },
  LVA: { alpha3: "LVA", alpha2: "LV", name: "Latvia", lat: 56.8796, lng: 24.6032 },
  LTU: { alpha3: "LTU", alpha2: "LT", name: "Lithuania", lat: 55.1694, lng: 23.8813 },
  CYP: { alpha3: "CYP", alpha2: "CY", name: "Cyprus", lat: 35.1264, lng: 33.4299 },
  MLT: { alpha3: "MLT", alpha2: "MT", name: "Malta", lat: 35.9375, lng: 14.3754 },
  ISL: { alpha3: "ISL", alpha2: "IS", name: "Iceland", lat: 64.9631, lng: -19.0208 },
  LUX: { alpha3: "LUX", alpha2: "LU", name: "Luxembourg", lat: 49.8153, lng: 6.1296 },
  GEO: { alpha3: "GEO", alpha2: "GE", name: "Georgia", lat: 42.3154, lng: 43.3569 },
  RUS: { alpha3: "RUS", alpha2: "RU", name: "Russia", lat: 61.524, lng: 105.3188 },
  CAN: { alpha3: "CAN", alpha2: "CA", name: "Canada", lat: 56.1304, lng: -106.3468 },
  MEX: { alpha3: "MEX", alpha2: "MX", name: "Mexico", lat: 23.6345, lng: -102.5528 },
  BRA: { alpha3: "BRA", alpha2: "BR", name: "Brazil", lat: -14.235, lng: -51.9253 },
  ARG: { alpha3: "ARG", alpha2: "AR", name: "Argentina", lat: -38.4161, lng: -63.6167 },
  CHL: { alpha3: "CHL", alpha2: "CL", name: "Chile", lat: -35.6751, lng: -71.543 },
  COL: { alpha3: "COL", alpha2: "CO", name: "Colombia", lat: 4.5709, lng: -74.2973 },
  PER: { alpha3: "PER", alpha2: "PE", name: "Peru", lat: -9.19, lng: -75.0152 },
  URY: { alpha3: "URY", alpha2: "UY", name: "Uruguay", lat: -32.5228, lng: -55.7658 },
  CRI: { alpha3: "CRI", alpha2: "CR", name: "Costa Rica", lat: 9.7489, lng: -83.7534 },
  JAM: { alpha3: "JAM", alpha2: "JM", name: "Jamaica", lat: 18.1096, lng: -77.2975 },
  TTO: { alpha3: "TTO", alpha2: "TT", name: "Trinidad and Tobago", lat: 10.6918, lng: -61.2225 },
  JPN: { alpha3: "JPN", alpha2: "JP", name: "Japan", lat: 36.2048, lng: 138.2529 },
  KOR: { alpha3: "KOR", alpha2: "KR", name: "South Korea", lat: 35.9078, lng: 127.7669 },
  CHN: { alpha3: "CHN", alpha2: "CN", name: "China", lat: 35.8617, lng: 104.1954 },
  IND: { alpha3: "IND", alpha2: "IN", name: "India", lat: 20.5937, lng: 78.9629 },
  IDN: { alpha3: "IDN", alpha2: "ID", name: "Indonesia", lat: -0.7893, lng: 113.9213 },
  MYS: { alpha3: "MYS", alpha2: "MY", name: "Malaysia", lat: 4.2105, lng: 101.9758 },
  SGP: { alpha3: "SGP", alpha2: "SG", name: "Singapore", lat: 1.3521, lng: 103.8198 },
  THA: { alpha3: "THA", alpha2: "TH", name: "Thailand", lat: 15.87, lng: 100.9925 },
  PHL: { alpha3: "PHL", alpha2: "PH", name: "Philippines", lat: 12.8797, lng: 121.774 },
  AUS: { alpha3: "AUS", alpha2: "AU", name: "Australia", lat: -25.2744, lng: 133.7751 },
  TWN: { alpha3: "TWN", alpha2: "TW", name: "Taiwan", lat: 23.6978, lng: 120.9605 },
  LKA: { alpha3: "LKA", alpha2: "LK", name: "Sri Lanka", lat: 7.8731, lng: 80.7718 },
  PAK: { alpha3: "PAK", alpha2: "PK", name: "Pakistan", lat: 30.3753, lng: 69.3451 },
  BGD: { alpha3: "BGD", alpha2: "BD", name: "Bangladesh", lat: 23.685, lng: 90.3563 },
  BRN: { alpha3: "BRN", alpha2: "BN", name: "Brunei", lat: 4.5353, lng: 114.7277 },
  ARE: { alpha3: "ARE", alpha2: "AE", name: "United Arab Emirates", lat: 23.4241, lng: 53.8478 },
  KEN: { alpha3: "KEN", alpha2: "KE", name: "Kenya", lat: -0.0236, lng: 37.9062 },
  ZAF: { alpha3: "ZAF", alpha2: "ZA", name: "South Africa", lat: -30.5595, lng: 22.9375 },
  ISR: { alpha3: "ISR", alpha2: "IL", name: "Israel", lat: 31.0461, lng: 34.8516 },
  UKR: { alpha3: "UKR", alpha2: "UA", name: "Ukraine", lat: 48.3794, lng: 31.1656 },
  TUR: { alpha3: "TUR", alpha2: "TR", name: "Turkey", lat: 38.9637, lng: 35.2433 },
  EGY: { alpha3: "EGY", alpha2: "EG", name: "Egypt", lat: 26.8206, lng: 30.8025 },
  SAU: { alpha3: "SAU", alpha2: "SA", name: "Saudi Arabia", lat: 23.8859, lng: 45.0792 },
  IRN: { alpha3: "IRN", alpha2: "IR", name: "Iran", lat: 32.4279, lng: 53.688 },
  IRQ: { alpha3: "IRQ", alpha2: "IQ", name: "Iraq", lat: 33.2232, lng: 43.6793 },
  NZL: { alpha3: "NZL", alpha2: "NZ", name: "New Zealand", lat: -40.9006, lng: 174.886 },
  VNM: { alpha3: "VNM", alpha2: "VN", name: "Vietnam", lat: 14.0583, lng: 108.2772 },
  CUB: { alpha3: "CUB", alpha2: "CU", name: "Cuba", lat: 21.5218, lng: -77.7812 },
};

export const COUNTRY_CENTROIDS_BY_ALPHA2: Record<string, CountryCentroid> =
  Object.fromEntries(
    Object.values(COUNTRY_CENTROIDS).map((c) => [c.alpha2, c])
  );

export function getCentroid(alpha3OrAlpha2: string): CountryCentroid | null {
  const key = alpha3OrAlpha2.toUpperCase();
  return COUNTRY_CENTROIDS[key] ?? COUNTRY_CENTROIDS_BY_ALPHA2[key] ?? null;
}

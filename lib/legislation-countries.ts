export type Region = "Americas" | "Europe" | "Asia-Pacific" | "Africa";

export const REGIONS: Region[] = ["Americas", "Europe", "Asia-Pacific", "Africa"];

export type SpecialView = "us" | "ca" | "nz";

export type CountryEntry = {
  code: string;
  label: string;
  flag: string;
  region: Region;
  ingestedBy: string;
  scriptSlug: string;
  sourceLabel: string;
  specialView?: SpecialView;
};

export const COUNTRY_REGISTRY: CountryEntry[] = [
  // Americas
  { code: "us", label: "United States", flag: "🇺🇸", region: "Americas", ingestedBy: "congress_bills_v1", scriptSlug: "congress-bills", sourceLabel: "congress.gov", specialView: "us" },
  { code: "ca", label: "Canada", flag: "🇨🇦", region: "Americas", ingestedBy: "canada_bills_v1", scriptSlug: "canada-bills", sourceLabel: "parl.ca", specialView: "ca" },
  { code: "ar", label: "Argentina", flag: "🇦🇷", region: "Americas", ingestedBy: "argentina_legislation_v1", scriptSlug: "argentina", sourceLabel: "congreso.gob.ar" },
  { code: "br", label: "Brazil", flag: "🇧🇷", region: "Americas", ingestedBy: "brazil_legislation_v1", scriptSlug: "brazil", sourceLabel: "camara.leg.br" },
  { code: "cl", label: "Chile", flag: "🇨🇱", region: "Americas", ingestedBy: "chile_legislation_v1", scriptSlug: "chile", sourceLabel: "bcn.cl" },
  { code: "co", label: "Colombia", flag: "🇨🇴", region: "Americas", ingestedBy: "colombia_legislation_v1", scriptSlug: "colombia", sourceLabel: "secretariasenado.gov.co" },
  { code: "cr", label: "Costa Rica", flag: "🇨🇷", region: "Americas", ingestedBy: "costa_rica_legislation_v1", scriptSlug: "costa-rica", sourceLabel: "asamblea.go.cr" },
  { code: "mx", label: "Mexico", flag: "🇲🇽", region: "Americas", ingestedBy: "mexico_legislation_v1", scriptSlug: "mexico", sourceLabel: "diputados.gob.mx" },

  // Europe
  { code: "eu", label: "European Union", flag: "🇪🇺", region: "Europe", ingestedBy: "eu_legislation_v1", scriptSlug: "eu", sourceLabel: "eur-lex.europa.eu" },
  { code: "be", label: "Belgium", flag: "🇧🇪", region: "Europe", ingestedBy: "belgium_legislation_v1", scriptSlug: "belgium", sourceLabel: "lachambre.be" },
  { code: "bg", label: "Bulgaria", flag: "🇧🇬", region: "Europe", ingestedBy: "bulgaria_legislation_v1", scriptSlug: "bulgaria", sourceLabel: "parliament.bg" },
  { code: "hr", label: "Croatia", flag: "🇭🇷", region: "Europe", ingestedBy: "croatia_legislation_v1", scriptSlug: "croatia", sourceLabel: "sabor.hr" },
  { code: "cy", label: "Cyprus", flag: "🇨🇾", region: "Europe", ingestedBy: "cyprus_legislation_v1", scriptSlug: "cyprus", sourceLabel: "parliament.cy" },
  { code: "cz", label: "Czechia", flag: "🇨🇿", region: "Europe", ingestedBy: "czech_legislation_v1", scriptSlug: "czech", sourceLabel: "psp.cz" },
  { code: "dk", label: "Denmark", flag: "🇩🇰", region: "Europe", ingestedBy: "denmark_legislation_v1", scriptSlug: "denmark", sourceLabel: "ft.dk" },
  { code: "ee", label: "Estonia", flag: "🇪🇪", region: "Europe", ingestedBy: "estonia_legislation_v1", scriptSlug: "estonia", sourceLabel: "riigikogu.ee" },
  { code: "fi", label: "Finland", flag: "🇫🇮", region: "Europe", ingestedBy: "finland_legislation_v1", scriptSlug: "finland", sourceLabel: "eduskunta.fi" },
  { code: "fr", label: "France", flag: "🇫🇷", region: "Europe", ingestedBy: "france_legislation_v1", scriptSlug: "france", sourceLabel: "assemblee-nationale.fr" },
  { code: "hu", label: "Hungary", flag: "🇭🇺", region: "Europe", ingestedBy: "hungary_legislation_v1", scriptSlug: "hungary", sourceLabel: "parlament.hu" },
  { code: "is", label: "Iceland", flag: "🇮🇸", region: "Europe", ingestedBy: "iceland_legislation_v1", scriptSlug: "iceland", sourceLabel: "althingi.is" },
  { code: "it", label: "Italy", flag: "🇮🇹", region: "Europe", ingestedBy: "italy_legislation_v1", scriptSlug: "italy", sourceLabel: "camera.it" },
  { code: "lv", label: "Latvia", flag: "🇱🇻", region: "Europe", ingestedBy: "latvia_legislation_v1", scriptSlug: "latvia", sourceLabel: "likumi.lv" },
  { code: "lt", label: "Lithuania", flag: "🇱🇹", region: "Europe", ingestedBy: "lithuania_legislation_v1", scriptSlug: "lithuania", sourceLabel: "lrs.lt" },
  { code: "lu", label: "Luxembourg", flag: "🇱🇺", region: "Europe", ingestedBy: "luxembourg_legislation_v1", scriptSlug: "luxembourg", sourceLabel: "legilux.public.lu" },
  { code: "mt", label: "Malta", flag: "🇲🇹", region: "Europe", ingestedBy: "malta_legislation_v1", scriptSlug: "malta", sourceLabel: "parlament.mt" },
  { code: "no", label: "Norway", flag: "🇳🇴", region: "Europe", ingestedBy: "norway_legislation_v1", scriptSlug: "norway", sourceLabel: "stortinget.no" },
  { code: "pl", label: "Poland", flag: "🇵🇱", region: "Europe", ingestedBy: "poland_legislation_v1", scriptSlug: "poland", sourceLabel: "sejm.gov.pl" },
  { code: "pt", label: "Portugal", flag: "🇵🇹", region: "Europe", ingestedBy: "portugal_legislation_v1", scriptSlug: "portugal", sourceLabel: "parlamento.pt" },
  { code: "ro", label: "Romania", flag: "🇷🇴", region: "Europe", ingestedBy: "romania_legislation_v1", scriptSlug: "romania", sourceLabel: "cdep.ro" },
  { code: "ru", label: "Russia", flag: "🇷🇺", region: "Europe", ingestedBy: "russia_legislation_v1", scriptSlug: "russia", sourceLabel: "duma.gov.ru" },
  { code: "scotland", label: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", region: "Europe", ingestedBy: "scotland_legislation_v1", scriptSlug: "scotland", sourceLabel: "parliament.scot" },
  { code: "rs", label: "Serbia", flag: "🇷🇸", region: "Europe", ingestedBy: "serbia_legislation_v1", scriptSlug: "serbia", sourceLabel: "parlament.rs" },
  { code: "sk", label: "Slovakia", flag: "🇸🇰", region: "Europe", ingestedBy: "slovakia_legislation_v1", scriptSlug: "slovakia", sourceLabel: "nrsr.sk" },
  { code: "si", label: "Slovenia", flag: "🇸🇮", region: "Europe", ingestedBy: "slovenia_legislation_v1", scriptSlug: "slovenia", sourceLabel: "dz-rs.si" },
  { code: "es", label: "Spain", flag: "🇪🇸", region: "Europe", ingestedBy: "spain_legislation_v1", scriptSlug: "spain", sourceLabel: "boe.es" },
  { code: "ch", label: "Switzerland", flag: "🇨🇭", region: "Europe", ingestedBy: "switzerland_legislation_v1", scriptSlug: "switzerland", sourceLabel: "parlament.ch" },
  { code: "gb", label: "United Kingdom", flag: "🇬🇧", region: "Europe", ingestedBy: "uk_legislation_v1", scriptSlug: "uk", sourceLabel: "legislation.gov.uk" },

  // Asia-Pacific
  { code: "nz", label: "New Zealand", flag: "🇳🇿", region: "Asia-Pacific", ingestedBy: "nz_legislation_v1", scriptSlug: "nz-bills", sourceLabel: "legislation.govt.nz", specialView: "nz" },
  { code: "au", label: "Australia", flag: "🇦🇺", region: "Asia-Pacific", ingestedBy: "australia_legislation_v1", scriptSlug: "australia", sourceLabel: "aph.gov.au" },
  { code: "bd", label: "Bangladesh", flag: "🇧🇩", region: "Asia-Pacific", ingestedBy: "bangladesh_legislation_v1", scriptSlug: "bangladesh", sourceLabel: "parliament.gov.bd" },
  { code: "in", label: "India", flag: "🇮🇳", region: "Asia-Pacific", ingestedBy: "india_legislation_v1", scriptSlug: "india", sourceLabel: "prsindia.org" },
  { code: "id", label: "Indonesia", flag: "🇮🇩", region: "Asia-Pacific", ingestedBy: "indonesia_legislation_v1", scriptSlug: "indonesia", sourceLabel: "dpr.go.id" },
  { code: "jp", label: "Japan", flag: "🇯🇵", region: "Asia-Pacific", ingestedBy: "japan_legislation_v1", scriptSlug: "japan", sourceLabel: "shugiin.go.jp" },
  { code: "kr", label: "South Korea", flag: "🇰🇷", region: "Asia-Pacific", ingestedBy: "korea_legislation_v1", scriptSlug: "korea", sourceLabel: "assembly.go.kr" },
  { code: "my", label: "Malaysia", flag: "🇲🇾", region: "Asia-Pacific", ingestedBy: "malaysia_legislation_v1", scriptSlug: "malaysia", sourceLabel: "parlimen.gov.my" },
  { code: "pk", label: "Pakistan", flag: "🇵🇰", region: "Asia-Pacific", ingestedBy: "pakistan_legislation_v1", scriptSlug: "pakistan", sourceLabel: "na.gov.pk" },
  { code: "ph", label: "Philippines", flag: "🇵🇭", region: "Asia-Pacific", ingestedBy: "philippines_legislation_v1", scriptSlug: "philippines", sourceLabel: "congress.gov.ph" },
  { code: "sg", label: "Singapore", flag: "🇸🇬", region: "Asia-Pacific", ingestedBy: "singapore_legislation_v1", scriptSlug: "singapore", sourceLabel: "parliament.gov.sg" },
  { code: "tw", label: "Taiwan", flag: "🇹🇼", region: "Asia-Pacific", ingestedBy: "taiwan_legislation_v1", scriptSlug: "taiwan", sourceLabel: "ly.gov.tw" },
  { code: "th", label: "Thailand", flag: "🇹🇭", region: "Asia-Pacific", ingestedBy: "thailand_legislation_v1", scriptSlug: "thailand", sourceLabel: "parliament.go.th" },

  // Africa
  { code: "ke", label: "Kenya", flag: "🇰🇪", region: "Africa", ingestedBy: "kenya_legislation_v1", scriptSlug: "kenya", sourceLabel: "parliament.go.ke" },
  { code: "za", label: "South Africa", flag: "🇿🇦", region: "Africa", ingestedBy: "south_africa_legislation_v1", scriptSlug: "south-africa", sourceLabel: "parliament.gov.za" },
];

export const COUNTRY_BY_CODE: Record<string, CountryEntry> = Object.fromEntries(
  COUNTRY_REGISTRY.map(c => [c.code, c]),
);

export const ALL_INGESTED_BY: string[] = COUNTRY_REGISTRY.map(c => c.ingestedBy);

export function countriesInRegion(region: Region): CountryEntry[] {
  return COUNTRY_REGISTRY.filter(c => c.region === region);
}

export function isValidCountryCode(code: string): boolean {
  return code in COUNTRY_BY_CODE;
}

"use client";
import { useEffect, useState } from "react";

type Category = "Legislation" | "Science" | "Clinical" | "Courts" | "Finance" | "Health" | "International" | "Other";

interface PipelineMeta {
  label: string;
  description: string;
  sourceUrl: string;
  category: Category;
  country?: string;
  flag?: string;
}

const PIPELINE_META: Record<string, PipelineMeta> = {
  // ── US Federal ────────────────────────────────────────────────────────────────
  congress_v1: { label: "US Congress Bills", description: "Federal enacted laws from the 97th Congress onward via Congress.gov API", sourceUrl: "https://www.congress.gov", category: "Legislation", country: "United States", flag: "🇺🇸" },
  congress_bills_v1: { label: "US Congress Bills (legacy)", description: "Early Congress.gov ingestion run, superseded by congress_v1", sourceUrl: "https://www.congress.gov", category: "Legislation", country: "United States", flag: "🇺🇸" },
  congress_votes_v1: { label: "US Congress Votes", description: "Roll-call vote records for US federal legislation", sourceUrl: "https://voteview.com", category: "Legislation", country: "United States", flag: "🇺🇸" },
  fr_rules_v1: { label: "US Federal Register", description: "Significant final rules (EO 12866) from EPA, FDA, OSHA, CMS, DEA, FTC, FCC since 1994", sourceUrl: "https://www.federalregister.gov", category: "Legislation", country: "United States", flag: "🇺🇸" },
  sec_edgar_v1: { label: "SEC EDGAR", description: "Historically significant filings — Enron, WorldCom, Lehman, Boeing 737 MAX, GE Power", sourceUrl: "https://www.sec.gov/edgar", category: "Finance", country: "United States", flag: "🇺🇸" },
  courtlistener_scotus_v1: { label: "SCOTUS Opinions", description: "US Supreme Court opinions via CourtListener", sourceUrl: "https://www.courtlistener.com", category: "Courts", country: "United States", flag: "🇺🇸" },

  // ── European Parliament / EU ───────────────────────────────────────────────────
  eu_legislation_v1: { label: "EU Legislation", description: "Regulations and directives from EUR-Lex", sourceUrl: "https://eur-lex.europa.eu", category: "Legislation", country: "European Union", flag: "🇪🇺" },
  eu_parliament_v1: { label: "EU Parliament", description: "European Parliament resolutions and votes", sourceUrl: "https://europarl.europa.eu", category: "Legislation", country: "European Union", flag: "🇪🇺" },
  eec_council_v1: { label: "EEC Council", description: "Historical European Economic Community council legislation", sourceUrl: "https://eur-lex.europa.eu", category: "Legislation", country: "European Union", flag: "🇪🇺" },
  echr_judgments_v1: { label: "ECHR Judgments", description: "European Court of Human Rights judgments via HUDOC", sourceUrl: "https://hudoc.echr.coe.int", category: "Courts", country: "Council of Europe", flag: "🇪🇺" },

  // ── UK / Ireland ───────────────────────────────────────────────────────────────
  uk_legislation_v1: { label: "UK Legislation", description: "Public General Acts via legislation.gov.uk", sourceUrl: "https://www.legislation.gov.uk", category: "Legislation", country: "United Kingdom", flag: "🇬🇧" },
  scotland_legislation_v1: { label: "Scottish Parliament", description: "Acts of the Scottish Parliament", sourceUrl: "https://www.legislation.gov.uk", category: "Legislation", country: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  wales_senedd_v1: { label: "Welsh Senedd", description: "Legislation from the Senedd Cymru", sourceUrl: "https://senedd.wales", category: "Legislation", country: "Wales", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  oireachtas_v1: { label: "Irish Oireachtas", description: "Irish enacted Acts via api.oireachtas.ie open API", sourceUrl: "https://www.oireachtas.ie", category: "Legislation", country: "Ireland", flag: "🇮🇪" },

  // ── Continental Europe ─────────────────────────────────────────────────────────
  bundestag_v1: { label: "German Bundestag", description: "Federal enacted laws via the Bundestag DIP REST API", sourceUrl: "https://bundestag.de", category: "Legislation", country: "Germany", flag: "🇩🇪" },
  nationalrat_v1: { label: "Austrian National Council", description: "Enacted laws (Beschlüsse des Nationalrates) via Parlament.gv.at", sourceUrl: "https://www.parlament.gv.at", category: "Legislation", country: "Austria", flag: "🇦🇹" },
  parlament_at_v1: { label: "Austrian Parliament", description: "Additional Austrian parliament legislation", sourceUrl: "https://www.parlament.gv.at", category: "Legislation", country: "Austria", flag: "🇦🇹" },
  riksdag_v1: { label: "Swedish Riksdag", description: "Swedish parliamentary bills and resolutions (1994/95–present) via riksdag.se open API", sourceUrl: "https://riksdagen.se", category: "Legislation", country: "Sweden", flag: "🇸🇪" },
  tweedekamer_v1: { label: "Dutch Parliament", description: "Dutch enacted legislation via Tweede Kamer OData API", sourceUrl: "https://www.tweedekamer.nl", category: "Legislation", country: "Netherlands", flag: "🇳🇱" },
  france_legislation_v1: { label: "French Legislation", description: "Laws from Légifrance", sourceUrl: "https://www.legifrance.gouv.fr", category: "Legislation", country: "France", flag: "🇫🇷" },
  spain_legislation_v1: { label: "Spanish Legislation", description: "Laws from the Boletín Oficial del Estado (BOE)", sourceUrl: "https://www.boe.es", category: "Legislation", country: "Spain", flag: "🇪🇸" },
  portugal_legislation_v1: { label: "Portuguese Legislation", description: "Laws from Diário da República", sourceUrl: "https://dre.pt", category: "Legislation", country: "Portugal", flag: "🇵🇹" },
  poland_legislation_v1: { label: "Polish Legislation", description: "Laws from the Polish Law Journal (ISAP)", sourceUrl: "https://isap.sejm.gov.pl", category: "Legislation", country: "Poland", flag: "🇵🇱" },
  denmark_legislation_v1: { label: "Danish Legislation", description: "Laws from Retsinformation", sourceUrl: "https://www.retsinformation.dk", category: "Legislation", country: "Denmark", flag: "🇩🇰" },
  finland_legislation_v1: { label: "Finnish Legislation", description: "Laws from Finlex", sourceUrl: "https://www.finlex.fi", category: "Legislation", country: "Finland", flag: "🇫🇮" },
  norway_legislation_v1: { label: "Norwegian Legislation", description: "Laws from Lovdata", sourceUrl: "https://lovdata.no", category: "Legislation", country: "Norway", flag: "🇳🇴" },
  iceland_legislation_v1: { label: "Icelandic Legislation", description: "Laws from the Althingi", sourceUrl: "https://www.althingi.is", category: "Legislation", country: "Iceland", flag: "🇮🇸" },
  switzerland_legislation_v1: { label: "Swiss Legislation", description: "Laws from the Swiss Federal Chancellery (Fedlex)", sourceUrl: "https://www.fedlex.admin.ch", category: "Legislation", country: "Switzerland", flag: "🇨🇭" },
  belgium_legislation_v1: { label: "Belgian Legislation", description: "Laws from the Belgian Official Gazette", sourceUrl: "https://www.ejustice.just.fgov.be", category: "Legislation", country: "Belgium", flag: "🇧🇪" },
  italy_legislation_v1: { label: "Italian Legislation", description: "Laws from Normattiva", sourceUrl: "https://www.normattiva.it", category: "Legislation", country: "Italy", flag: "🇮🇹" },
  russia_legislation_v1: { label: "Russian Legislation", description: "Federal laws from pravo.gov.ru", sourceUrl: "http://pravo.gov.ru", category: "Legislation", country: "Russia", flag: "🇷🇺" },

  // ── Americas ───────────────────────────────────────────────────────────────────
  canada_bills_v1: { label: "Canadian Parliament", description: "Bills with Royal Assent (35th–45th Parliament) via LEGISinfo API", sourceUrl: "https://www.parl.ca", category: "Legislation", country: "Canada", flag: "🇨🇦" },
  argentina_legislation_v1: { label: "Argentine Legislation", description: "Laws from InfoLEG", sourceUrl: "http://www.infoleg.gob.ar", category: "Legislation", country: "Argentina", flag: "🇦🇷" },
  brazil_legislation_v1: { label: "Brazilian Legislation", description: "Laws from the Brazilian federal portal (Planalto)", sourceUrl: "https://www.planalto.gov.br", category: "Legislation", country: "Brazil", flag: "🇧🇷" },
  chile_legislation_v1: { label: "Chilean Legislation", description: "Laws from BCN (Biblioteca del Congreso Nacional)", sourceUrl: "https://www.bcn.cl", category: "Legislation", country: "Chile", flag: "🇨🇱" },
  colombia_legislation_v1: { label: "Colombian Legislation", description: "Laws from the Colombian Secretaría Jurídica Distrital", sourceUrl: "https://www.secretariajuridica.gov.co", category: "Legislation", country: "Colombia", flag: "🇨🇴" },
  mexico_legislation_v1: { label: "Mexican Legislation", description: "Laws from the Cámara de Diputados", sourceUrl: "https://www.diputados.gob.mx", category: "Legislation", country: "Mexico", flag: "🇲🇽" },

  // ── Asia-Pacific ───────────────────────────────────────────────────────────────
  japan_legislation_v1: { label: "Japanese Legislation", description: "Laws from the Japanese e-Gov portal (elaws)", sourceUrl: "https://elaws.e-gov.go.jp", category: "Legislation", country: "Japan", flag: "🇯🇵" },
  india_legislation_v1: { label: "Indian Legislation", description: "Acts from India Code", sourceUrl: "https://www.indiacode.nic.in", category: "Legislation", country: "India", flag: "🇮🇳" },
  bangladesh_legislation_v1: { label: "Bangladesh Legislation", description: "Laws from Bangladesh National Portal", sourceUrl: "https://bdlaws.minlaw.gov.bd", category: "Legislation", country: "Bangladesh", flag: "🇧🇩" },
  philippines_legislation_v1: { label: "Philippines Legislation", description: "Laws from the Official Gazette of the Philippines", sourceUrl: "https://www.officialgazette.gov.ph", category: "Legislation", country: "Philippines", flag: "🇵🇭" },
  singapore_legislation_v1: { label: "Singapore Legislation", description: "Acts from Singapore Statutes Online", sourceUrl: "https://sso.agc.gov.sg", category: "Legislation", country: "Singapore", flag: "🇸🇬" },
  taiwan_legislation_v1: { label: "Taiwan Legislation", description: "Laws from the Laws and Regulations Database (全國法規資料庫)", sourceUrl: "https://law.moj.gov.tw", category: "Legislation", country: "Taiwan", flag: "🇹🇼" },
  nz_legislation_v1: { label: "New Zealand Legislation", description: "Acts from the New Zealand Legislation website", sourceUrl: "https://www.legislation.govt.nz", category: "Legislation", country: "New Zealand", flag: "🇳🇿" },
  australia_legislation_v1: { label: "Australian Legislation", description: "Acts from the Federal Register of Legislation", sourceUrl: "https://www.legislation.gov.au", category: "Legislation", country: "Australia", flag: "🇦🇺" },

  // ── Africa / Middle East ───────────────────────────────────────────────────────
  south_africa_legislation_v1: { label: "South African Legislation", description: "Acts from the South African Government", sourceUrl: "https://www.gov.za", category: "Legislation", country: "South Africa", flag: "🇿🇦" },
  israel_knesset_v1: { label: "Israel Knesset", description: "Legislation from the Knesset open data API", sourceUrl: "https://main.knesset.gov.il", category: "Legislation", country: "Israel", flag: "🇮🇱" },

  // ── International ──────────────────────────────────────────────────────────────
  un_sc_resolutions_v1: { label: "UN Security Council", description: "All adopted resolutions (1946–2025) with vote records and subject classification", sourceUrl: "https://www.un.org/securitycouncil", category: "International" },
  nato_official_texts_v1: { label: "NATO Official Texts", description: "Communiqués, declarations, and treaties from nato.int/cps", sourceUrl: "https://www.nato.int", category: "International" },

  // ── Science ────────────────────────────────────────────────────────────────────
  crossref_retractions_v1: { label: "Retracted Papers", description: "Scientific paper retractions indexed by CrossRef (~26,500 records)", sourceUrl: "https://retractiondatabase.org", category: "Science" },
  retraction_watch_v1: { label: "Retraction Watch", description: "Curated retraction records from the Retraction Watch database", sourceUrl: "https://retractiondatabase.org", category: "Science" },
  nasa_exoplanet_v1: { label: "NASA Exoplanet Archive", description: "Confirmed exoplanets from the NASA Exoplanet Archive", sourceUrl: "https://exoplanetarchive.ipac.caltech.edu", category: "Science" },
  usgs_eq_v1: { label: "USGS Earthquakes", description: "M6.5+ seismic events since 1900 from the US Geological Survey", sourceUrl: "https://earthquake.usgs.gov", category: "Science" },
  nobel_v1: { label: "Nobel Prizes", description: "All laureates 1901–2024 across six categories, Nobel Foundation API v2.1", sourceUrl: "https://www.nobelprize.org", category: "Science" },
  pubchem_v1: { label: "PubChem", description: "Chemical compound database from the NIH National Library of Medicine", sourceUrl: "https://pubchem.ncbi.nlm.nih.gov", category: "Science" },
  genbank_v1: { label: "GenBank", description: "NCBI genetic sequence accessions, verified against ncbi.nlm.nih.gov", sourceUrl: "https://www.ncbi.nlm.nih.gov/genbank", category: "Science" },
  nih_reporter_v1: { label: "NIH Reporter", description: "NIH research project grants and funding via the RePORTER API", sourceUrl: "https://reporter.nih.gov", category: "Science" },
  solar_system_v1: { label: "Solar System Bodies", description: "Planets, dwarf planets, and major moons from IAU-recognized data", sourceUrl: "https://www.iau.org", category: "Science" },
  iau_constellations_v1: { label: "IAU Constellations", description: "The 88 official IAU constellation designations", sourceUrl: "https://www.iau.org", category: "Science" },
  iau_v1: { label: "IAU Records", description: "International Astronomical Union official designations and resolutions", sourceUrl: "https://www.iau.org", category: "Science" },

  // ── Health / Clinical ──────────────────────────────────────────────────────────
  icd11_v1: { label: "WHO ICD-11", description: "International Classification of Diseases, 11th revision (WHO MMS 2024-01)", sourceUrl: "https://icd.who.int", category: "Health" },
  clinicaltrials_v1: { label: "ClinicalTrials.gov", description: "Clinical trial registrations from the US NIH", sourceUrl: "https://clinicaltrials.gov", category: "Clinical" },
  faers_normalized_drugs_v1: { label: "FDA FAERS", description: "Drug-level aggregate adverse event counts from the FDA Adverse Event Reporting System", sourceUrl: "https://open.fda.gov", category: "Health" },
  openfda_v1: { label: "OpenFDA", description: "FDA drug approval and adverse event data via the openFDA API", sourceUrl: "https://open.fda.gov", category: "Health" },

  // ── Retired ────────────────────────────────────────────────────────────────────
  uspto_v1: { label: "USPTO Patents (retired)", description: "Retired 2026-05-12 — fabricated patent metadata confirmed on audit; 182 claims flagged DEPRECATED", sourceUrl: "https://patents.google.com", category: "Other", country: "United States", flag: "🇺🇸" },

  // ── Other ──────────────────────────────────────────────────────────────────────
  manual: { label: "Manually Added", description: "Sources added by researchers via the admin interface", sourceUrl: "", category: "Other" },
};

const ALL_CATEGORIES: Category[] = ["Legislation", "Science", "Clinical", "Courts", "Finance", "Health", "International", "Other"];

const CATEGORY_COLORS: Record<Category, string> = {
  Legislation:   "bg-blue-900/60 text-blue-300 border border-blue-800/50",
  Science:       "bg-violet-900/60 text-violet-300 border border-violet-800/50",
  Clinical:      "bg-teal-900/60 text-teal-300 border border-teal-800/50",
  Courts:        "bg-amber-900/60 text-amber-300 border border-amber-800/50",
  Finance:       "bg-emerald-900/60 text-emerald-300 border border-emerald-800/50",
  Health:        "bg-rose-900/60 text-rose-300 border border-rose-800/50",
  International: "bg-sky-900/60 text-sky-300 border border-sky-800/50",
  Other:         "bg-gray-800 text-gray-400 border border-gray-700/50",
};

type DatasetStat = { ingestedBy: string; count: number; lastIngestedAt: string | null };

function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function DatasetCard({ stat }: { stat: DatasetStat }) {
  const meta = PIPELINE_META[stat.ingestedBy];
  const label = meta?.label ?? stat.ingestedBy;
  const description = meta?.description ?? "Ingested dataset";
  const sourceUrl = meta?.sourceUrl ?? "";
  const category: Category = meta?.category ?? "Other";
  const flag = meta?.flag;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-snug">
            {flag && <span className="mr-1.5">{flag}</span>}
            {label}
          </p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{description}</p>
        </div>
        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-medium ${CATEGORY_COLORS[category]}`}>
          {category}
        </span>
      </div>

      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white tabular-nums">
            {stat.count.toLocaleString()}
          </span>
          <span className="text-xs text-gray-500">records</span>
          <span className="text-gray-700 text-xs">·</span>
          <span className="text-xs text-gray-500">{relativeDate(stat.lastIngestedAt)}</span>
        </div>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-blue-400 hover:underline truncate max-w-[120px]"
          >
            {new URL(sourceUrl).hostname.replace(/^www\./, "")}
          </a>
        )}
      </div>
    </div>
  );
}

export default function DatasetsPage() {
  const [stats, setStats] = useState<DatasetStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");

  useEffect(() => {
    fetch("/api/datasets")
      .then(r => r.json())
      .then((data: DatasetStat[]) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const totalCount = stats.reduce((s, r) => s + r.count, 0);
  const totalPipelines = stats.filter(s => s.ingestedBy !== "manual").length;

  const categorized = stats.reduce<Record<string, DatasetStat[]>>((acc, stat) => {
    const cat = PIPELINE_META[stat.ingestedBy]?.category ?? "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(stat);
    return acc;
  }, {});

  const visibleStats = activeCategory === "All"
    ? [...stats].sort((a, b) => b.count - a.count)
    : (categorized[activeCategory] ?? []).sort((a, b) => b.count - a.count);

  const tabCounts = ALL_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = (categorized[cat] ?? []).reduce((s, r) => s + r.count, 0);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Data Sources</h1>
        <p className="mt-1 text-sm text-gray-400">
          Every dataset powering the Epistemic Receipts knowledge graph
        </p>
      </div>

      {loading ? (
        <p className="text-gray-600 text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Total records</div>
              <div className="text-xl font-semibold text-white">{totalCount.toLocaleString()}</div>
            </div>
            <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Active pipelines</div>
              <div className="text-xl font-semibold text-white">{totalPipelines.toLocaleString()}</div>
            </div>
            <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Showing</div>
              <div className="text-xl font-semibold text-white">{visibleStats.reduce((s, r) => s + r.count, 0).toLocaleString()}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCategory("All")}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                activeCategory === "All"
                  ? "border-gray-500 bg-gray-800 text-white"
                  : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
              }`}
            >
              All
              <span className="ml-1.5 text-gray-500">{stats.length}</span>
            </button>
            {ALL_CATEGORIES.filter(cat => (categorized[cat] ?? []).length > 0).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  activeCategory === cat
                    ? "border-gray-500 bg-gray-800 text-white"
                    : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                }`}
              >
                {cat}
                <span className="ml-1.5 text-gray-500">{tabCounts[cat].toLocaleString()}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleStats.map(stat => (
              <DatasetCard key={stat.ingestedBy} stat={stat} />
            ))}
          </div>

          {visibleStats.length === 0 && (
            <p className="text-sm text-gray-500 italic">No datasets in this category.</p>
          )}

          <p className="text-xs text-gray-600 text-center pb-2">
            {totalCount.toLocaleString()} records across {totalPipelines} pipelines · source-level provenance only
          </p>
        </>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRef, useState } from "react";

const C = {
  bg: "#0a0a0a",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#d4a853",
} as const;

// Per-source methodology descriptions. Keys match ingestedBy values from the DB.
const METHODOLOGY: Record<string, { desc: string; method: string; coverage: string; verify: string }> = {
  nara_catalog_v1: {
    desc: "The U.S. National Archives and Records Administration (NARA) Catalog API exposes finding-aid metadata for millions of archival records, including declassified documents, federal records, and historical materials.",
    method: "Ingested via the NARA Catalog REST API (catalog.archives.gov/api/v2) using page-based pagination with a 1,000-record page size. Record groups filtered by RG number (e.g. RG59 State Dept, RG330 SecDef, RG263 CIA, RG238 Nuremberg). Each archival record becomes one Claim with the record title as claim text and NARA's digital-object URL as the source link.",
    coverage: "Tier 1 record groups covering diplomatic cables (RG59), defense records (RG330), intelligence files (RG263/128), Nuremberg trial records (RG238), and presidential commission reports (RG220). Approximately 10,000 records ingested across these groups as of 2026-06-07. Full NARA catalog is 73 record groups — expansion ongoing.",
    verify: "Cross-reference any claim's externalId prefix (nara_catalog_v1:) against the NARA Catalog at catalog.archives.gov. The claim text matches the archival item's title field verbatim.",
  },
  voteview_v1: {
    desc: "Voteview (voteview.com) is the authoritative academic dataset of every U.S. congressional roll-call vote from 1789 to the present, maintained by researchers at UCLA. It includes DW-NOMINATE ideology scores and member voting records.",
    method: "Ingested by downloading the Voteview CSV exports for votes and members, then joining on icpsr member IDs to produce one Claim per roll-call vote. Fields captured: congress number, chamber, rollnumber, date, question, result, party-line breakdown, and majority/minority percentages. 113,319 roll-call votes loaded.",
    coverage: "All U.S. House and Senate roll-call votes, 1st Congress (1789) through the current Congress. Ideology scores are available for all members with sufficient vote histories. Paired vote and absent records are included.",
    verify: "Each claim links back to its Voteview vote page. Cross-check any vote's result against the original Congressional Record or clerk.house.gov / senate.gov.",
  },
  ofac_sdn_v1: {
    desc: "The OFAC Specially Designated Nationals and Blocked Persons (SDN) List is the U.S. Treasury's primary sanctions database, listing individuals, companies, and entities subject to asset freezes and transaction prohibitions.",
    method: "Downloaded as the full XML file from sanctionslist.ofac.treas.gov/api/publicationsV2 and parsed into one Claim per SDN entry. Fields captured: entity name, entity type (individual/vessel/entity), programs (IRAN, RUSSIA, DPRK, etc.), aliases, and alpha-3 country code where available.",
    coverage: "Complete SDN list as of ingest date. Thematic programs (SDGT, GLOMAG, NPWMD) and country-specific programs included. Entries without resolvable alpha-3 country codes (~30%) have no geographic link.",
    verify: "Compare any SDN claim against the live list at sanctionslist.ofac.treas.gov. OFAC publishes a changelog for additions and removals.",
  },
  congress_bills_tracker_v1: {
    desc: "Congress.gov API v3 provides real-time tracking of all legislation introduced in the U.S. House and Senate, including bill status, sponsors, co-sponsors, committee referrals, and action history.",
    method: "Ingested via the Congress.gov API v3 (/bill endpoint) with pagination. Each bill becomes one Claim. Fields captured: bill number, title, congress, chamber, latest action, policy area, sponsors, status (introduced/committee/floor/enacted/vetoed).",
    coverage: "Bills from the 93rd Congress (1973) through the current Congress accessible via the API. Pre-93rd Congresses require separate bulk data downloads. Enacted laws have a separate congress_v1 ingester for full text.",
    verify: "Each claim's source URL links to the bill's Congress.gov page. Committee reports and floor schedules are linked from the same page.",
  },
  congress_v1: {
    desc: "Congress.gov enacted laws — statutes signed into law by the President or passed over a veto, from the 93rd Congress onward.",
    method: "Same Congress.gov API v3 as the bill tracker, filtered to law=true status only. Enacted law claims include the public law number, date signed, and the originating bill number.",
    coverage: "All public laws from 93rd Congress (1973) to present. Private laws and concurrent resolutions not included.",
    verify: "Cross-reference against govinfo.gov/app/collection/PLAW which archives all public laws as PDFs.",
  },
  voteview_member_v1: {
    desc: "Voteview member records — biographical data and DW-NOMINATE ideology scores for all Members of Congress 1789-present.",
    method: "Downloaded from voteview.com/data as HS_members CSV. Each member creates one Claim with their name, chamber, party, congress, and ideology coordinates.",
    coverage: "All Members of Congress with at least one recorded vote. Living members updated each Congress.",
    verify: "Cross-check against bioguide.congress.gov for member biographical data.",
  },
  courtlistener_scotus_v1: {
    desc: "CourtListener is a free legal research platform and PACER data mirror operated by the Free Law Project. The SCOTUS collection covers all U.S. Supreme Court opinions from the founding to the present.",
    method: "Ingested via CourtListener REST API (/api/rest/v4/opinions) filtered to court=scotus. Fields captured: case name, citation, date filed, docket number, opinion text, per-curiam flag, and author. Each opinion is one Claim.",
    coverage: "All published SCOTUS opinions. Slip opinions are typically added within 24h of release. Unpublished orders and cert denials not included.",
    verify: "Each claim's source URL links to the CourtListener case page, which itself links to original PACER filings and the Supreme Court's official PDF.",
  },
  courtlistener_circuits_v1: {
    desc: "Federal circuit court opinions from all 13 circuits (1st through 11th, D.C. Circuit, and Federal Circuit) via CourtListener's PACER mirror.",
    method: "Same CourtListener API filtered by court type = federal_appellate. One Claim per published opinion. Linked to legislation via a separate linker script that matches bill numbers in opinion text.",
    coverage: "Published circuit opinions. Unpublished per-curiam decisions and administrative orders excluded. Coverage depth varies by circuit — some circuits have records back to 1950, others only from the 1990s.",
    verify: "CourtListener source URL → original PACER filing. For recent opinions, compare with the circuit court's own slip opinion PDFs.",
  },
  courtlistener_bia_v1: {
    desc: "Board of Immigration Appeals (BIA) precedent decisions via CourtListener. BIA decisions interpret immigration law and are binding on all immigration judges.",
    method: "CourtListener API filtered to court=bia. Fields captured: case name, citation, decision date, and summary. Immigration case names often include respondent nationality, which is retained.",
    coverage: "Published BIA precedent decisions. Non-precedent decisions (vast majority of BIA output) excluded. Coverage from approximately 1990 onward.",
    verify: "Cross-reference against DOJ EOIR's published BIA decisions at justice.gov/eoir.",
  },
  openalex_v1: {
    desc: "OpenAlex is a fully open catalog of scholarly works, institutions, authors, and concepts, built by OurResearch as a successor to Microsoft Academic Graph. It indexes over 250 million works.",
    method: "Ingested via OpenAlex REST API (/works endpoint) with field-based filters (concepts, publication year, open-access filters). Papers become Claims with title as claim text. Authors, institutions, and journal are stored in claim metadata. DOI, OpenAlex ID, and citation count captured.",
    coverage: "Academic papers with DOIs published in peer-reviewed journals, across 19 scientific fields. Our ingest covers approximately 1.5M papers — a 0.6% sample of OpenAlex, focused on high-citation work. Preprints on arXiv/bioRxiv included when indexed by OpenAlex.",
    verify: "Each claim's openAlexId links to openalex.org/W[id] for full metadata. DOIs resolve to publisher pages.",
  },
  clinicaltrials_v1: {
    desc: "ClinicalTrials.gov is the U.S. government's registry and results database for clinical studies of human participants, operated by NLM/NIH. Registration is mandatory for most clinical trials under the FDAAA 2007.",
    method: "Ingested via ClinicalTrials.gov REST API v2 (/api/v2/studies). Each registered study becomes one Claim. Fields captured: NCT number, official title, status (recruiting/completed/terminated/etc.), phase (1/2/3/4), intervention type, condition, sponsor, and primary completion date.",
    coverage: "All registered interventional trials as of ingest date. Observational studies partially included. Results data (primary endpoints) not yet captured — claims represent registration status, not outcomes.",
    verify: "Each claim's source URL is the direct ClinicalTrials.gov study page at clinicaltrials.gov/study/NCT[id].",
  },
  crossref_retractions_v1: {
    desc: "CrossRef is the DOI registration agency for academic publishing. CrossRef retraction data is sourced from publisher-submitted metadata marking specific DOIs as retracted, corrected, or having expressions of concern.",
    method: "Queried CrossRef API (/works endpoint) filtering for update-type=retraction. Each retracted paper becomes a Claim. Retraction date, retraction DOI, original paper DOI, journal, publisher, and reason (where provided) are captured.",
    coverage: "CrossRef covers approximately 60-70% of retracted papers. Journals that do not register retractions with CrossRef (common outside Western publishing) are missed. Retraction Watch provides supplementary coverage.",
    verify: "Compare against the Retraction Watch database at retractiondatabase.org. For any retracted claim, the original DOI and retraction notice DOI are both captured.",
  },
  drugsatfda_v1: {
    desc: "Drugs@FDA is the FDA's database of approved drug applications (NDAs and ANDAs), including approval dates, drug labels, and related clinical review documents.",
    method: "Ingested via the FDA Drugs@FDA API (api.fda.gov/drug/drugsfda.json). Each New Drug Application approval becomes one Claim. Fields captured: brand name, generic name, applicant, NDA number, approval date, therapeutic equivalence code.",
    coverage: "All FDA-approved prescription and OTC drug applications from 1938 to present. Biologics (BLAs) and biosimilars covered separately. Withdrawn approvals included.",
    verify: "Each claim links to the FDA application page at accessdata.fda.gov/scripts/cder/daf/.",
  },
  faers_normalized_drugs_v1: {
    desc: "FDA Adverse Event Reporting System (FAERS) aggregated post-market safety data. FAERS contains voluntary and mandatory adverse event reports submitted by patients, healthcare providers, and manufacturers.",
    method: "Downloaded quarterly FAERS data dumps, aggregated by normalized drug name (via RxNorm lookup). One Claim per drug captures total report count, serious adverse events count, and top reaction terms. Individual reports are not represented.",
    coverage: "Quarterly updates from 2004 onward. Represents reported events only — severely under-reports actual adverse events (estimated 1-10% reporting rate). Causality is not established from reports alone.",
    verify: "Compare against the FDA FAERS Public Dashboard at fda.gov/drugs/questions-and-answers-fdas-adverse-event-reporting-system-faers.",
  },
  worldbank_v1: {
    desc: "World Bank Open Data provides macroeconomic indicators for ~217 economies across thousands of indicators including GDP, inflation, unemployment, trade, and development metrics.",
    method: "Ingested via World Bank API v2 (/v2/country/{iso3}/indicator/{code}) for selected indicator codes. Each country-year-indicator combination is one Claim. Fields captured: country name, ISO3 code, year, indicator code, value, and unit.",
    coverage: "Indicators: GDP growth, inflation, unemployment, GDP per capita, trade balance. Years: 1960-present where available. Coverage varies by country and indicator — data gaps common for low-income countries pre-1990.",
    verify: "Cross-check at data.worldbank.org/indicator. The World Bank publishes data revisions; historical values may differ slightly between snapshots.",
  },
  fred_v1: {
    desc: "FRED (Federal Reserve Economic Data) from the St. Louis Federal Reserve Bank provides economic time series data including interest rates, money supply, employment, and inflation.",
    method: "Ingested via FRED REST API (api.stlouisfed.org/fred/series/observations). Series IDs selected for key macroeconomic indicators. Each observation (time-series data point) becomes one Claim.",
    coverage: "U.S.-focused. Key series: FEDFUNDS (Fed Funds Rate), CPIAUCSL (CPI), UNRATE (Unemployment), T10Y2Y (yield curve). International series available but not yet ingested.",
    verify: "FRED data is available at fred.stlouisfed.org. Each claim's source URL links to the series page.",
  },
  sipri_v1: {
    desc: "Stockholm International Peace Research Institute (SIPRI) Arms Transfers Database tracks the international trade in major conventional weapons by country.",
    method: "Downloaded from SIPRI's open data exports. Each arms transfer agreement becomes one Claim with supplier, recipient, weapon category, number of units, and year of delivery.",
    coverage: "Major conventional weapons (aircraft, armored vehicles, artillery, missiles, ships). Small arms and light weapons not covered. Data from 1950 onward.",
    verify: "Compare against sipri.org/databases/armstransfers.",
  },
  ucdp_v1: {
    desc: "Uppsala Conflict Data Program (UCDP) provides data on organized violence worldwide, tracking armed conflicts at the country-year level.",
    method: "Downloaded from UCDP's open datasets. Each conflict-year becomes one Claim with conflict name, parties, intensity level (minor/war), and estimated fatalities.",
    coverage: "State-based conflicts (between governments), non-state conflicts (between non-government groups), and one-sided violence (against civilians). Years: 1946-present.",
    verify: "Compare against ucdp.uu.se. UCDP updates annually with the prior year's data.",
  },
  pakistan_code_v1: {
    desc: "Pakistan's Laws of Pakistan — statutes and ordinances compiled in the official legislative database maintained by the National Assembly of Pakistan.",
    method: "Scraped from pakistancode.gov.pk, which publishes the official consolidated statutes of Pakistan. Each act or ordinance becomes one Claim with the short title, year, and subject matter.",
    coverage: "All acts of Parliament and Presidential ordinances as listed in the official database. Regulations and subsidiary legislation not included.",
    verify: "Cross-reference at pakistancode.gov.pk or the National Assembly's website at na.gov.pk.",
  },
  fec_finance_v1: {
    desc: "Federal Election Commission campaign finance data — individual contributions, disbursements, and receipts for federal candidates.",
    method: "Downloaded from FEC bulk data at fec.gov/data/browse-data. Election cycles 2012-2024 loaded. Each disbursement or major contribution aggregation becomes one Claim.",
    coverage: "Federal candidates and committees only. State-level campaign finance not included. FEC data has known late-filing gaps during active election periods.",
    verify: "Cross-check at fec.gov/data. FEC publishes all filings within 48h of receipt.",
  },
  loc_collections_v1: {
    desc: "Library of Congress digital collections — digitized primary sources including photos, manuscripts, maps, and sound recordings from the LOC's 170M-item collection.",
    method: "Ingested via the LOC API (api.loc.gov) across selected collections. Each digitized item becomes one Claim with title, date, subject headings, and digital-object URL.",
    coverage: "Selected LOC collections: American Memory, Chronicling America (newspapers), and special digitization projects. Covers materials from colonial era to mid-20th century primarily.",
    verify: "Each claim links to loc.gov for the original digitized item.",
  },
};

interface SourceEntry {
  ingestedBy: string;
  label: string;
  sourceUrl: string;
  count: number;
}

interface CategoryBucket {
  name: string;
  totalCount: number;
  sourceCount: number;
  sources: SourceEntry[];
}

interface SourcesSummary {
  totalClaims: number;
  totalSources: number;
  generatedAt: string;
  categories: CategoryBucket[];
  unmapped: SourceEntry[];
}

const CATEGORY_COLOR: Record<string, { dot: string; text: string; border: string; bg: string }> = {
  "US Federal Government":              { dot: "#60a5fa", text: "#93c5fd", border: "rgba(96,165,250,0.3)",   bg: "rgba(96,165,250,0.08)" },
  "Courts & Legal":                     { dot: "#fbbf24", text: "#fde68a", border: "rgba(251,191,36,0.3)",   bg: "rgba(251,191,36,0.08)" },
  "Science & Medicine":                 { dot: "#c084fc", text: "#d8b4fe", border: "rgba(192,132,252,0.3)",  bg: "rgba(192,132,252,0.08)" },
  "International Organizations":        { dot: "#38bdf8", text: "#7dd3fc", border: "rgba(56,189,248,0.3)",   bg: "rgba(56,189,248,0.08)" },
  "Pharmaceutical & Health":            { dot: "#f87171", text: "#fca5a5", border: "rgba(248,113,113,0.3)",  bg: "rgba(248,113,113,0.08)" },
  "National Parliaments / Legislation": { dot: "#34d399", text: "#6ee7b7", border: "rgba(52,211,153,0.3)",   bg: "rgba(52,211,153,0.08)" },
  "Archives & Historical":              { dot: "#fb923c", text: "#fdba74", border: "rgba(251,146,60,0.3)",   bg: "rgba(251,146,60,0.08)" },
  "Editorial / Curated":                { dot: "#d4a853", text: "#e7c988", border: "rgba(212,168,83,0.3)",   bg: "rgba(212,168,83,0.08)" },
  Other:                                { dot: "#9ca3af", text: "#d1d5db", border: "rgba(156,163,175,0.3)",  bg: "rgba(156,163,175,0.08)" },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_COLOR);

function hostname(url: string): string {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function MethodologyPanel({ s, color }: { s: SourceEntry; color: typeof CATEGORY_COLOR[string] }) {
  const m = METHODOLOGY[s.ingestedBy];
  return (
    <div
      style={{
        background: "#0d0d1a",
        borderTop: `1px solid ${C.panelEdge}`,
        padding: "1rem 1.1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
      }}
    >
      {m ? (
        <>
          <p style={{ color: C.mut, fontSize: "0.82rem", lineHeight: 1.6, margin: 0 }}>
            {m.desc}
          </p>
          {[
            { label: "Ingestion method", text: m.method },
            { label: "Coverage & limitations", text: m.coverage },
            { label: "How to verify", text: m.verify },
          ].map(({ label, text }) => (
            <div key={label}>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, color: color.text, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                {label}
              </div>
              <p style={{ color: C.mut, fontSize: "0.8rem", lineHeight: 1.55, margin: 0 }}>{text}</p>
            </div>
          ))}
        </>
      ) : (
        <p style={{ color: C.faint, fontSize: "0.82rem", fontStyle: "italic", margin: 0 }}>
          Methodology documentation for <code style={{ fontSize: "0.78rem", color: C.mut }}>{s.ingestedBy}</code> has not yet been written. Each claim from this source includes a source URL pointing to the original record.
        </p>
      )}
      {s.sourceUrl && (
        <a
          href={s.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.78rem",
            fontWeight: 600,
            color: color.text,
            textDecoration: "none",
            border: `1px solid ${color.border}`,
            background: color.bg,
            borderRadius: 8,
            padding: "0.35rem 0.75rem",
            alignSelf: "flex-start",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3.5 1H1v10h10V8.5M7 1h4m0 0v4m0-4L5 7"/>
          </svg>
          {hostname(s.sourceUrl)} — primary source
        </a>
      )}
    </div>
  );
}

function SourceCard({ s, color }: { s: SourceEntry; color: typeof CATEGORY_COLOR[string] }) {
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${open ? color.border : hov ? `${color.dot}55` : C.panelEdge}`,
        background: C.panel,
        overflow: "hidden",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* Card header — click to expand */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0.9rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
          <span style={{ color: C.ink, fontSize: "0.85rem", fontWeight: 500, lineHeight: 1.35, textAlign: "left" }}>
            {s.label}
          </span>
          <span style={{ color: color.text, fontWeight: 700, fontSize: "0.82rem", fontFamily: "monospace", flexShrink: 0 }}>
            {s.count.toLocaleString()}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
          <span style={{ color: C.faint, fontSize: "0.72rem", fontFamily: "monospace" }}>
            {s.ingestedBy}
          </span>
          <span style={{ color: open ? color.text : C.faint, fontSize: "0.72rem", transition: "color 0.15s" }}>
            {open ? "▲ methodology" : "▼ methodology"}
          </span>
        </div>
      </button>

      {/* Expandable methodology panel */}
      {open && <MethodologyPanel s={s} color={color} />}
    </div>
  );
}

function Chip({
  active, onClick, color, children,
}: { active: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  const c = color ?? C.brand;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "0.25rem 0.75rem",
        borderRadius: 9999,
        fontSize: "0.75rem",
        fontWeight: 500,
        border: `1px solid ${active ? c : hov ? `${c}55` : C.panelEdge}`,
        background: active ? `${c}22` : "transparent",
        color: active ? c : hov ? `${c}99` : C.mut,
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export default function SourcesClient({ initialData }: { initialData: SourcesSummary | null }) {
  const [data] = useState<SourcesSummary | null>(initialData);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  if (!data) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", marginTop: "-2rem", marginLeft: "-1.5rem", marginRight: "-1.5rem", display: "flex", alignItems: "center", justifyContent: "center", color: C.faint, fontSize: "0.88rem" }}>
        Loading…
      </div>
    );
  }

  const q = query.trim().toLowerCase();

  const filteredCategories = data.categories
    .filter((cat) => activeCategory === "all" || cat.name === activeCategory)
    .map((cat) => ({
      ...cat,
      sources: cat.sources.filter((s) =>
        !q || s.label.toLowerCase().includes(q) || s.ingestedBy.toLowerCase().includes(q)
      ),
    }))
    .filter((cat) => cat.sources.length > 0);

  const matchCount = filteredCategories.reduce((n, c) => n + c.sources.length, 0);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", marginTop: "-2rem", marginLeft: "-1.5rem", marginRight: "-1.5rem" }}>
      {/* Sub-nav */}
      <div style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(10,10,10,0.85)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.panelEdge}`,
        padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "0.5rem", height: "2.75rem",
      }}>
        <Link href="/" style={{ color: C.faint, fontSize: "0.78rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ fontSize: "1rem" }}>⬡</span> Epistemic Receipts
        </Link>
        <span style={{ color: C.panelEdge }}>/</span>
        <span style={{ color: C.mut, fontSize: "0.78rem" }}>Sources</span>
      </div>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(160deg, #0f0f1e 0%, #0a0a0a 60%)",
        borderBottom: `1px solid ${C.panelEdge}`,
        padding: "3.5rem 1.5rem 3rem",
      }}>
        <div style={{ maxWidth: "64rem", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(212,168,83,0.12)", border: "1px solid rgba(212,168,83,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0,
            }}>
              📡
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: C.brand, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.2rem" }}>
                Data Provenance
              </div>
              <h1 style={{ color: C.ink, fontSize: "1.75rem", fontWeight: 700, margin: 0, lineHeight: 1.1 }}>
                Sources
              </h1>
            </div>
          </div>
          <p style={{ color: C.mut, fontSize: "0.95rem", lineHeight: 1.6, maxWidth: "52rem", margin: "0 0 1.75rem" }}>
            Every external API, archive, and primary-record database that feeds the claim graph. Click any source to see exactly how it was ingested, what coverage it has, and how to independently verify the data.
          </p>

          {/* Stats */}
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {[
              { label: "Total claims", value: data.totalClaims.toLocaleString(), color: C.brand },
              { label: "Distinct sources", value: data.totalSources.toLocaleString(), color: "#93c5fd" },
              { label: "Categories", value: data.categories.length.toString(), color: "#c4b5fd" },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color, lineHeight: 1, fontFamily: "monospace" }}>
                  {s.value}
                </div>
                <div style={{ fontSize: "0.72rem", color: C.faint, marginTop: "0.2rem" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "1.25rem 1.5rem 0" }}>
        {/* Search */}
        <div style={{ position: "relative", marginBottom: "1rem" }}>
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sources by name or ingester tag…"
            style={{
              background: C.panel, border: `1px solid ${C.panelEdge}`,
              color: C.ink, borderRadius: 10, padding: "0.55rem 1rem 0.55rem 2.25rem",
              width: "100%", fontSize: "0.88rem", outline: "none", boxSizing: "border-box",
            }}
          />
          <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: C.faint, fontSize: "0.9rem" }}>
            ⌕
          </span>
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.faint, cursor: "pointer", fontSize: "0.85rem" }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Category chips */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <Chip active={activeCategory === "all"} onClick={() => setActiveCategory("all")}>
            All
          </Chip>
          {data.categories.map((cat) => {
            const col = CATEGORY_COLOR[cat.name] ?? CATEGORY_COLOR.Other;
            return (
              <Chip key={cat.name} active={activeCategory === cat.name} onClick={() => setActiveCategory(activeCategory === cat.name ? "all" : cat.name)} color={col.dot}>
                {cat.name}
              </Chip>
            );
          })}
        </div>

        <div style={{ padding: "0.6rem 0.1rem", fontSize: "0.75rem", color: C.faint }}>
          {matchCount} source{matchCount !== 1 ? "s" : ""}
          {q ? ` matching "${query}"` : ""}
          {activeCategory !== "all" ? ` in ${activeCategory}` : ""}
        </div>
      </div>

      {/* Source grid by category */}
      <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "0 1.5rem 4rem" }}>
        {filteredCategories.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: C.mut, fontSize: "0.88rem" }}>
            No sources match.
          </div>
        ) : (
          filteredCategories.map((cat) => {
            const col = CATEGORY_COLOR[cat.name] ?? CATEGORY_COLOR.Other;
            return (
              <div key={cat.name} style={{ marginBottom: "2.5rem" }}>
                {/* Category header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  borderBottom: `1px solid ${col.border}`,
                  paddingBottom: "0.6rem", marginBottom: "1rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.dot, flexShrink: 0 }} />
                    <h2 style={{ color: col.text, fontSize: "0.88rem", fontWeight: 700, margin: 0, letterSpacing: "0.01em" }}>
                      {cat.name}
                    </h2>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: C.faint, fontFamily: "monospace" }}>
                    {cat.sources.length} source{cat.sources.length !== 1 ? "s" : ""} · {cat.totalCount.toLocaleString()} claims
                  </span>
                </div>

                {/* Source cards grid */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "0.6rem",
                }}>
                  {cat.sources.map((s) => (
                    <SourceCard key={s.ingestedBy} s={s} color={col} />
                  ))}
                </div>
              </div>
            );
          })
        )}

        {/* Unmapped */}
        {data.unmapped.length > 0 && (activeCategory === "all") && !q && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.panelEdge}`, paddingBottom: "0.6rem", marginBottom: "1rem" }}>
              <h2 style={{ color: C.faint, fontSize: "0.88rem", fontWeight: 700, margin: 0 }}>Uncategorized</h2>
              <span style={{ fontSize: "0.75rem", color: C.faint }}>{data.unmapped.length} tags</span>
            </div>
            <p style={{ fontSize: "0.78rem", color: C.faint, fontStyle: "italic", marginBottom: "0.75rem" }}>
              These ingester tags exist in the claim graph but are not yet in the source registry.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {data.unmapped.map((s) => (
                <span key={s.ingestedBy} style={{
                  fontSize: "0.72rem", fontFamily: "monospace", color: C.faint,
                  background: C.panel, border: `1px solid ${C.panelEdge}`,
                  borderRadius: 6, padding: "0.2rem 0.5rem",
                }}>
                  {s.ingestedBy} ({s.count.toLocaleString()})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

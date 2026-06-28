"use client";

import Link from "next/link";
import { useState } from "react";

const C = {
  bg: "#0a0a0a",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#d4a853",
} as const;

interface GlossaryEntry {
  term: string;
  def: string;
  tag?: string;
}

interface GlossarySection {
  id: string;
  title: string;
  icon: string;
  entries: GlossaryEntry[];
}

const SECTIONS: GlossarySection[] = [
  {
    id: "concepts",
    title: "Epistemic Concepts",
    icon: "🧠",
    entries: [
      { term: "Epistemic receipt", def: "The full audit trail of how a claim's consensus was formed, contested, or overturned — every source position, revision, and threshold event in sequence. The name comes from the idea that knowledge claims should carry a receipt of their own provenance." },
      { term: "Settling curve", def: "A visualization of how a claim's epistemic status changes over time. Each node on the curve represents a recorded status transition (e.g. OPEN → CONTESTED → SETTLED). The shape of the curve reveals whether a claim settled quickly, reversed, or is still moving." },
      { term: "Epistemic axis", def: "The current epistemic state of a claim on a four-point scale: SETTLED, CONTESTED, RECORDED, or OPEN. Replaces the older currentStatus field. Assigned by pipeline heuristics and updated automatically as new evidence or retractions are registered." },
      { term: "Epistemic state history", def: "The ordered log of every axis transition a claim has passed through, each timestamped and attributed to a community (e.g. scientific literature, legal record, regulatory body). This log is what produces the settling curve." },
      { term: "Community", def: "The epistemic community that made or recognized a status transition. Examples: scientific_literature, legal_record, regulatory_approval, international_court. A claim can exist in multiple communities simultaneously." },
      { term: "Auditability", def: "The principle that every layer of the system — from raw pipeline data to displayed axis badges — is traceable to a primary source. Every claim links to its origin record, every status transition names its community and timestamp." },
    ],
  },
  {
    id: "axis",
    title: "Epistemic Axis Values",
    icon: "⚖",
    entries: [
      { term: "SETTLED", tag: "axis", def: "The claim has reached stable consensus within its relevant epistemic community. Multiple independent confirmations, no significant unresolved dissent. Example: 'DNA carries genetic information' is SETTLED in molecular biology." },
      { term: "CONTESTED", tag: "axis", def: "The claim has active, credible dissent or contradicting evidence. Reasonable experts disagree, or a retraction or counter-study has challenged the original finding." },
      { term: "RECORDED", tag: "axis", def: "The claim is a matter of official record — a law enacted, a court judgment issued, a treaty ratified, a vote cast. Whether the underlying policy is wise is a separate question; the fact of the record is not in dispute." },
      { term: "OPEN", tag: "axis", def: "The claim exists in the graph but has not yet accumulated enough evidence to assign a more specific axis. Default state for newly ingested claims." },
      { term: "REVERSED", tag: "axis", def: "A once-accepted claim has been formally overturned — a scientific paper retracted, a conviction overturned, a law struck down. The reversal itself becomes part of the trajectory." },
      { term: "ABANDONED", tag: "axis", def: "The claim was never resolved — the research program ended, the legal case was dropped, or the institution stopped tracking it. Distinct from REVERSED because there is no formal refutation, just a cessation of attention." },
    ],
  },
  {
    id: "entities",
    title: "Core Entities",
    icon: "🗂",
    entries: [
      { term: "Claim", def: "A statement being tracked for provenance. Each claim has a text, an epistemic axis, a verification status, a source (ingestedBy pipeline), and optionally a set of ClaimRelations to other claims." },
      { term: "Source", def: "A document, institution, or publication that contributes a position on a claim. Sources are linked to claims via a pipeline's ingestedBy tag." },
      { term: "Trajectory", def: "A named claim with a populated EpistemicStateHistory — a sequence of status transitions that can be visualized on the settling curve. Trajectories are the unit of analysis for studying how knowledge settles." },
      { term: "ClaimRelation", def: "A typed edge between two claims. Types include CONTRADICTS, REVERSED_BY, FUNDED_BY, AUTHORED_BY, DISCOVERED_BY, COMPOUND_IN, MILITARY_CONTEXT, ECONOMIC_CONTEXT, OUTCOME, and others." },
      { term: "EpistemicStateHistory", def: "A log entry recording a single status transition for a claim: from one axis to another, at a specific time, attributed to a named community. Multiple entries form the settling curve." },
      { term: "AcademicField", def: "A top-level domain (Biology, Physics, Law, etc.) used to group claims by discipline. Claims link to fields through ClaimTopic → Topic → AcademicField." },
      { term: "Topic", def: "A specific subject area within an academic field. Topics are derived from source metadata (journal classifications, subject headings, legislative categories) during ingestion." },
      { term: "LegislativeVote", def: "A recorded vote by a legislator on a specific bill or motion, linked to both a Claim (the legislation) and a Member record. Enables analysis of party-line voting and representation gaps." },
      { term: "Polity", def: "A political entity (country, empire, city-state, supranational body) that can be linked to claims. Polities are sourced from Wikidata historical records, spanning from ancient civilizations to present-day states." },
    ],
  },
  {
    id: "relations",
    title: "Claim Relation Types",
    icon: "🔗",
    entries: [
      { term: "CONTRADICTS", def: "Claim A directly contradicts Claim B. Used for retraction↔paper pairs and contested scientific findings." },
      { term: "REVERSED_BY", def: "Claim A was reversed by Claim B (e.g. a conviction overturned by an appellate ruling, or a paper superseded by a correction)." },
      { term: "FUNDED_BY", def: "Claim A (a research output) was funded by Claim B (a grant). Links NIH grants to OpenAlex papers." },
      { term: "AUTHORED_BY", def: "Claim A was authored by the person or entity in Claim B. Links Nobel laureates to their key papers." },
      { term: "DISCOVERED_BY", def: "Claim A (a scientific finding) was discovered or first reported in Claim B (a mission, expedition, or publication)." },
      { term: "COMPOUND_IN", def: "Claim A (a chemical compound from ChEBI) is found in or studied by Claim B (a clinical trial or drug approval)." },
      { term: "DISEASE_STUDIED", def: "Claim A (a disease from OMIM) is the subject of Claim B (a clinical trial)." },
      { term: "MILITARY_CONTEXT", def: "Claim A (an arms transfer or conflict event) provides military context for Claim B (a legislative or diplomatic record)." },
      { term: "ECONOMIC_CONTEXT", def: "Claim A (a World Bank economic indicator) provides economic context for Claim B (a piece of legislation)." },
      { term: "SANCTION_CONTEXT", def: "Claim A (an OFAC sanction) is contextually linked to Claim B (an arbitration or court case)." },
      { term: "OUTCOME", def: "Claim A (a clinical trial) led to Claim B (a drug approval). Links the trial-to-approval chain." },
    ],
  },
  {
    id: "verification",
    title: "Verification Statuses",
    icon: "✓",
    entries: [
      { term: "VERIFIED", def: "Passed pipeline quality gates and editorial review. The claim text and source metadata have been individually checked." },
      { term: "PROVISIONAL", def: "Bulk-ingested from a vetted external source; not individually reviewed. The source (e.g. Congress.gov, ClinicalTrials.gov) is authoritative, but the specific claim record has not been hand-checked." },
      { term: "DISPUTED", def: "The claim or its pipeline is contested. Significant evidence exists on multiple sides without resolution." },
      { term: "DEPRECATED", def: "Pipeline retired due to data quality issues. Records are preserved in the database for audit trail purposes but are excluded from public-facing counts and displays." },
    ],
  },
  {
    id: "pipeline",
    title: "Pipeline & System Terms",
    icon: "🔧",
    entries: [
      { term: "Pipeline", def: "An automated ingestion script that pulls structured data from an external API, archive, or database and writes Claims and Sources into the graph. Each pipeline is identified by a unique ingestedBy tag." },
      { term: "ingestedBy", def: "The pipeline tag attached to every Claim and Source record. Examples: voteview_v1, crossref_retractions_v1, nara_catalog_v1. Used to trace every record back to its origin pipeline." },
      { term: "Dry-run", def: "A pipeline execution that reads and parses data without writing to the database. Used to verify coverage and data quality before committing a full ingest." },
      { term: "Receipt (pipeline)", def: "The full provenance record for a claim: all source positions, axis transitions, and relation edges. The term 'Epistemic Receipts' applies this concept to every claim in the graph." },
      { term: "humanReviewed", def: "A flag on a Claim indicating a human has inspected the record. Distinct from autoApproved — a record can pass automatic quality gates without human review." },
      { term: "autoApproved", def: "A flag indicating the pipeline's own validation logic passed. Does not imply human review or editorial check." },
      { term: "externalId", def: "A stable identifier linking a Claim to its origin record in the source system. Format: {pipeline_tag}:{source_key}. Example: voteview_v1:H1001001 for a specific House roll call." },
      { term: "Settling curve trajectory", def: "A claim with an externalId prefixed trajectory: and a populated EpistemicStateHistory. These are the curated records used for settling curve visualizations and analysis." },
    ],
  },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "0.2rem 0.65rem", borderRadius: 9999, fontSize: "0.72rem", fontWeight: 500,
        border: `1px solid ${active ? C.brand : hov ? `${C.brand}55` : C.panelEdge}`,
        background: active ? `${C.brand}22` : "transparent",
        color: active ? C.brand : hov ? `${C.brand}88` : C.mut,
        cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export default function GlossaryPage() {
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState("all");

  const q = query.trim().toLowerCase();

  const filtered = SECTIONS
    .filter((s) => activeSection === "all" || s.id === activeSection)
    .map((s) => ({
      ...s,
      entries: s.entries.filter(
        (e) => !q || e.term.toLowerCase().includes(q) || e.def.toLowerCase().includes(q)
      ),
    }))
    .filter((s) => s.entries.length > 0);

  const totalMatches = filtered.reduce((n, s) => n + s.entries.length, 0);

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
        <span style={{ color: C.mut, fontSize: "0.78rem" }}>Glossary</span>
      </div>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(160deg, #0f0f1e 0%, #0a0a0a 60%)",
        borderBottom: `1px solid ${C.panelEdge}`,
        padding: "3.5rem 1.5rem 3rem",
      }}>
        <div style={{ maxWidth: "52rem", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(212,168,83,0.12)", border: "1px solid rgba(212,168,83,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0,
            }}>
              📖
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: C.brand, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.2rem" }}>
                Reference
              </div>
              <h1 style={{ color: C.ink, fontSize: "1.75rem", fontWeight: 700, margin: 0, lineHeight: 1.1 }}>
                Glossary
              </h1>
            </div>
          </div>
          <p style={{ color: C.mut, fontSize: "0.95rem", lineHeight: 1.6, margin: "0 0 1.75rem" }}>
            Definitions for every concept, entity, and status used in the Epistemic Receipts knowledge graph. Search across all terms or filter by section.
          </p>
          <div style={{ display: "flex", gap: "2rem" }}>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: C.brand, lineHeight: 1, fontFamily: "monospace" }}>
                {SECTIONS.reduce((n, s) => n + s.entries.length, 0)}
              </div>
              <div style={{ fontSize: "0.72rem", color: C.faint, marginTop: "0.2rem" }}>terms defined</div>
            </div>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#93c5fd", lineHeight: 1, fontFamily: "monospace" }}>
                {SECTIONS.length}
              </div>
              <div style={{ fontSize: "0.72rem", color: C.faint, marginTop: "0.2rem" }}>sections</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search + filter */}
      <div style={{ maxWidth: "52rem", margin: "0 auto", padding: "1.25rem 1.5rem 0" }}>
        <div style={{ position: "relative", marginBottom: "1rem" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search terms and definitions…"
            style={{
              background: C.panel, border: `1px solid ${C.panelEdge}`,
              color: C.ink, borderRadius: 10, padding: "0.55rem 1rem 0.55rem 2.25rem",
              width: "100%", fontSize: "0.88rem", outline: "none", boxSizing: "border-box",
            }}
          />
          <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: C.faint }}>⌕</span>
          {query && (
            <button onClick={() => setQuery("")} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.faint, cursor: "pointer" }}>✕</button>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <Chip active={activeSection === "all"} onClick={() => setActiveSection("all")}>All</Chip>
          {SECTIONS.map((s) => (
            <Chip key={s.id} active={activeSection === s.id} onClick={() => setActiveSection(activeSection === s.id ? "all" : s.id)}>
              {s.icon} {s.title}
            </Chip>
          ))}
        </div>
        <div style={{ padding: "0.6rem 0.1rem", fontSize: "0.75rem", color: C.faint }}>
          {totalMatches} term{totalMatches !== 1 ? "s" : ""}{q ? ` matching "${query}"` : ""}
        </div>
      </div>

      {/* Entries */}
      <div style={{ maxWidth: "52rem", margin: "0 auto", padding: "0.5rem 1.5rem 4rem" }}>
        {filtered.length === 0 && (
          <div style={{ padding: "3rem", textAlign: "center", color: C.mut }}>No matching terms.</div>
        )}
        {filtered.map((section) => (
          <div key={section.id} style={{ marginBottom: "2.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: `1px solid ${C.panelEdge}`, paddingBottom: "0.6rem", marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "1rem" }}>{section.icon}</span>
              <h2 style={{ color: C.ink, fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>{section.title}</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {section.entries.map((e) => (
                <div
                  key={e.term}
                  style={{
                    background: C.panel, border: `1px solid ${C.panelEdge}`,
                    borderRadius: 10, padding: "0.9rem 1rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.45rem" }}>
                    <span style={{
                      color: C.brand, fontWeight: 700, fontSize: "0.9rem",
                      fontFamily: e.tag === "axis" ? "monospace" : "inherit",
                    }}>
                      {e.term}
                    </span>
                    {e.tag && (
                      <span style={{
                        fontSize: "0.65rem", fontWeight: 600, padding: "0.1rem 0.45rem",
                        borderRadius: 9999, background: "rgba(212,168,83,0.12)",
                        border: "1px solid rgba(212,168,83,0.25)", color: `${C.brand}aa`,
                        textTransform: "uppercase", letterSpacing: "0.05em",
                      }}>
                        {e.tag}
                      </span>
                    )}
                  </div>
                  <p style={{ color: C.mut, fontSize: "0.83rem", lineHeight: 1.6, margin: 0 }}>
                    {e.def}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

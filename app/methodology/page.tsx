import Link from "next/link";

export const metadata = {
  title: "Methodology — Epistemic Receipts",
  description:
    "How the Epistemic Receipts data model works: claim types, epistemic status vocabulary, pipeline standards, and the deprecation policy.",
};

/* ───────────────────────────────────────────────────────────────────────────
   NEEDS OWNER READ-THROUGH before merge.
   This page describes factual properties of the system's data model. Every
   claim here should be verifiable against the codebase (prisma/schema.prisma,
   AGENTS.md) or publicly visible site behaviour. Flag anything that isn't.
   ─────────────────────────────────────────────────────────────────────────── */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-8">
      <h2 className="text-base font-semibold text-white border-b border-gray-800 pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Term({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="font-mono text-xs text-gray-300 font-semibold">{term}</dt>
      <dd className="text-sm text-gray-400 leading-relaxed">{children}</dd>
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-10 pb-16">

      {/* Header */}
      <div className="space-y-3">
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">Methodology</p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-snug">
          How this works
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          This page documents the data model, status vocabulary, pipeline standards, and
          editorial policies that govern what is in the graph and how it is labelled. It
          is a reference for readers who want to understand what they are looking at —
          and a contract for anyone building on the{" "}
          <Link href="/api/v1/manifest" className="underline hover:text-gray-300">public API</Link>.
        </p>
      </div>

      {/* Table of contents */}
      <nav className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4 text-sm text-gray-400 space-y-1">
        <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-3">Contents</p>
        {[
          ["#data-model", "Data model overview"],
          ["#epistemic-axis", "Epistemic axis (RECORDED / SETTLED / CONTESTED / OPEN / UNRESOLVABLE)"],
          ["#fact-status", "Fact-status failure modes (REVERSED / ABANDONED)"],
          ["#review-flags", "humanReviewed, autoApproved, and verificationStatus"],
          ["#reference-tier", "The reference-tier test"],
          ["#editorial-scope", "Editorial scope"],
          ["#deprecation", "Deprecation policy"],
        ].map(([href, label]) => (
          <div key={href as string}>
            <a href={href as string} className="hover:text-gray-300 transition-colors">
              {label as string}
            </a>
          </div>
        ))}
      </nav>

      {/* Data model */}
      <Section id="data-model" title="Data model overview">
        <p className="text-sm text-gray-400 leading-relaxed">
          The graph is built around six core tables. Each row in any of these tables carries
          provenance — who wrote it, when, and from what upstream source.
        </p>
        <dl className="space-y-4 mt-2">
          <Term term="Claim">
            A single, discrete statement. Claims have a text field, a type
            (<span className="font-mono text-gray-300">EMPIRICAL</span>,{" "}
            <span className="font-mono text-gray-300">INSTITUTIONAL</span>,{" "}
            <span className="font-mono text-gray-300">INTERPRETIVE</span>, or{" "}
            <span className="font-mono text-gray-300">HYBRID</span>), and an{" "}
            <span className="font-mono text-gray-300">ingestedBy</span> tag that records which
            pipeline produced it. Most bulk-ingested claims are{" "}
            <span className="font-mono text-gray-300">INSTITUTIONAL</span> (legislation, court
            rulings, drug approvals). Case-study claims may be{" "}
            <span className="font-mono text-gray-300">EMPIRICAL</span> or{" "}
            <span className="font-mono text-gray-300">INTERPRETIVE</span>.
          </Term>
          <Term term="Source">
            A citable document or data point that supports or contradicts a Claim. Sources carry
            a URL, publication date, and publisher. They are distinct from Claims: a Source is a
            real document in the world; a Claim is a proposition that can be supported or opposed.
          </Term>
          <Term term="Edge">
            A typed relationship between a Source and a Claim — or between two Claims. The edge
            type encodes the epistemic relationship:{" "}
            <span className="font-mono text-gray-300">SUPPORTS</span>,{" "}
            <span className="font-mono text-gray-300">CONTRADICTS</span>,{" "}
            <span className="font-mono text-gray-300">REFINES</span>,{" "}
            <span className="font-mono text-gray-300">CITES</span>, etc. Most edges in the bulk
            graph are automatically generated at ingest. Case-study edges are curated by hand.
          </Term>
          <Term term="MetaEdge">
            A typed relationship between an actor (person, institution, government) and an Edge.
            MetaEdges capture documented actions on evidence:{" "}
            <span className="font-mono text-gray-300">SUPPRESSED</span>,{" "}
            <span className="font-mono text-gray-300">AMPLIFIED</span>,{" "}
            <span className="font-mono text-gray-300">CHALLENGED</span>,{" "}
            <span className="font-mono text-gray-300">RETRACTED</span>. The tobacco industry
            &ldquo;doubt is our product&rdquo; campaign produced MetaEdges on the smoking–cancer
            evidence chain.
          </Term>
          <Term term="ThresholdEvent">
            A labelled moment when a Claim crossed a threshold — when it entered scientific
            literature, when consensus formed, when it was formally contested, when it was
            reversed. ThresholdEvents are what the Settling Curve visualises.
          </Term>
          <Term term="ClaimStatusHistory">
            An ordered log of epistemic-status transitions for a Claim. Each row records a
            transition:{" "}
            <span className="font-mono text-gray-300">fromAxis</span> →{" "}
            <span className="font-mono text-gray-300">toAxis</span>, who changed it, when, and
            which community ratified the transition (e.g.{" "}
            <span className="font-mono text-gray-300">EXPERT_LITERATURE</span>,{" "}
            <span className="font-mono text-gray-300">JUDICIAL</span>). This is the raw material
            for trajectory analysis.
          </Term>
        </dl>
      </Section>

      {/* Epistemic axis */}
      <Section id="epistemic-axis" title="Epistemic axis">
        <p className="text-sm text-gray-400 leading-relaxed">
          Every Claim carries an{" "}
          <span className="font-mono text-gray-300">epistemicAxis</span> value — a five-way
          classification of where the claim sits on the spectrum from{" "}
          &ldquo;recorded but unevaluated&rdquo; to &ldquo;permanently contested.&rdquo;
          This replaced the original binary{" "}
          <span className="font-mono text-gray-300">HARD_FACT</span> /{" "}
          <span className="font-mono text-gray-300">DISPUTED</span> in the 2026-06-08 migration.
        </p>
        <dl className="space-y-4 mt-2">
          <Term term="RECORDED">
            The claim has been entered into the record — it exists in an authoritative source —
            but no active community consensus has evaluated it. Most bulk-ingested pipeline
            records start here: a drug approval is recorded in the Federal Register, a patent
            is recorded in the USPTO database, a law is recorded in the parliamentary record.
            <br /><br />
            <em className="text-gray-500 text-xs">Example: A clinical trial registration (ClinicalTrials.gov) recording that a phase II trial of drug X has begun. The trial&apos;s outcome is not yet in the record.</em>
          </Term>
          <Term term="SETTLED">
            A community (usually expert literature or institutional bodies) has reached stable
            consensus that the claim is correct. The consensus is not permanent — a SETTLED
            claim can be RE-EVALUATED — but it is stable enough that reversal would require
            new evidence, not just argument.
            <br /><br />
            <em className="text-gray-500 text-xs">Example: The IAU 2006 resolution classifying Pluto as a dwarf planet. Expert consensus was achieved at that assembly; the claim is SETTLED pending new evidence or a subsequent IAU vote.</em>
          </Term>
          <Term term="CONTESTED">
            Active, credentialed dispute. Multiple communities, or credible minority communities
            within the same field, hold incompatible views and are producing evidence on both
            sides. Contested claims are not &ldquo;false&rdquo; — they are genuinely open
            in the scientific or legal record.
            <br /><br />
            <em className="text-gray-500 text-xs">Example: The lab-leak origin hypothesis for SARS-CoV-2 as of 2024. Multiple intelligence agencies and research groups hold incompatible conclusions; no institutional consensus has closed the question.</em>
          </Term>
          <Term term="OPEN">
            The claim is in the record and not currently contested, but the question it poses
            has not been resolved. It is waiting — waiting for data, for a trial to conclude,
            for an appeal to be heard. Open claims are distinct from CONTESTED claims: there
            is no active dispute, just an unresolved question.
            <br /><br />
            <em className="text-gray-500 text-xs">Example: A registered phase III clinical trial for a new oncology drug. The trial endpoint has not been reached; the claim &ldquo;drug X extends median survival vs. standard of care&rdquo; is OPEN.</em>
          </Term>
          <Term term="UNRESOLVABLE">
            The claim cannot be resolved with available methods, even in principle, or the
            question is structured such that no evidence could settle it. This is rare and
            always assigned by hand.
            <br /><br />
            <em className="text-gray-500 text-xs">Example: &ldquo;What was the exact location of Julius Caesar&apos;s death?&rdquo; — the physical evidence no longer exists and no surviving contemporaneous record resolves it precisely.</em>
          </Term>
        </dl>
      </Section>

      {/* Fact status failure modes */}
      <Section id="fact-status" title="Fact-status failure modes">
        <p className="text-sm text-gray-400 leading-relaxed">
          Two additional values are defined in the{" "}
          <span className="font-mono text-gray-300">FactStatus</span> enum as first-class
          outcomes, not errors. They record claims that entered the record but did not survive.
        </p>
        <dl className="space-y-4 mt-2">
          <Term term="REVERSED">
            A claim that was SETTLED and was subsequently formally overturned. Not a correction —
            a reversal. The original claim was genuinely believed by the relevant community;
            new evidence or a formal re-evaluation changed that.
            <br /><br />
            <em className="text-gray-500 text-xs">Example: Korematsu v. United States (1944) was treated as settled law for 40 years. The coram nobis proceedings (1984) and Korematsu&apos;s Supreme Court disavowal in Trump v. Hawaii (2018) are a REVERSED trajectory.</em>
          </Term>
          <Term term="ABANDONED">
            A claim or research programme that was actively pursued but quietly stopped — not
            formally refuted, just no longer pursued. The lack of follow-up is itself a
            data point.
            <br /><br />
            <em className="text-gray-500 text-xs">Example: A clinical trial that was registered, started enrollment, and then had enrollment terminated without publication of results. The claim is ABANDONED — not falsified, but no longer in active consideration.</em>
          </Term>
        </dl>
      </Section>

      {/* Review flags */}
      <Section id="review-flags" title="humanReviewed, autoApproved, and verificationStatus">
        <p className="text-sm text-gray-400 leading-relaxed">
          Three separate flags indicate how a Claim was checked before or after ingest:
        </p>
        <dl className="space-y-4 mt-2">
          <Term term="humanReviewed: true">
            A human reviewer has looked at this specific claim and judged it correct.{" "}
            <strong className="text-gray-300">This flag is never set by any script</strong> to
            work around a filter or visibility issue. Setting it programmatically is documentation
            drift that corrupts the audit trail. In practice, nearly all bulk-ingested pipeline
            claims have{" "}
            <span className="font-mono text-gray-300">humanReviewed: false</span>; curated
            case-study claims are reviewed manually.
          </Term>
          <Term term="autoApproved: true">
            The pipeline&apos;s own quality gates passed at ingest time. For bulk pipelines this
            means the upstream record was well-formed, the identifier resolved correctly, and
            the claim text was generated without error. It does not mean the claim is correct —
            it means the ingestion process worked as designed. A claim can be{" "}
            <span className="font-mono text-gray-300">autoApproved: true</span> and still be
            factually wrong (see{" "}
            <Link href="/corrections" className="underline hover:text-gray-300">Corrections</Link>
            ).
          </Term>
          <Term term="verificationStatus">
            A four-way field for downstream review:{" "}
            <span className="font-mono text-gray-300">VERIFIED</span> (spot-checked correct),{" "}
            <span className="font-mono text-gray-300">PROVISIONAL</span> (ingested but not yet
            spot-checked),{" "}
            <span className="font-mono text-gray-300">DISPUTED</span> (under active review), and{" "}
            <span className="font-mono text-gray-300">DEPRECATED</span> (failed quality audit,
            retained for audit trail, excluded from default views). DEPRECATED records are never
            hard-deleted — see the{" "}
            <a href="#deprecation" className="underline hover:text-gray-300">Deprecation policy</a>
            .
          </Term>
        </dl>
      </Section>

      {/* Reference tier */}
      <Section id="reference-tier" title="The reference-tier test">
        <p className="text-sm text-gray-400 leading-relaxed">
          A dataset is reference-tier — and therefore eligible for bulk ingestion — only if
          individual records will be directly cited by case-study Claims. The test is:
        </p>
        <blockquote className="border-l-2 border-gray-700 pl-4 text-sm text-gray-400 italic leading-relaxed my-3">
          Of the next 20 case studies you might build, how many would directly cite an
          individual record from this dataset?
        </blockquote>
        <p className="text-sm text-gray-400 leading-relaxed">
          If the answer is &ldquo;most of them,&rdquo; the dataset is reference-tier.
          Congress.gov passes: case studies cite specific bills, votes, hearings. SCOTUS
          opinions pass: case studies cite specific rulings. FAERS individual adverse event
          reports fail: case studies cite analyses of FAERS, not individual reports.
        </p>
        <p className="text-sm text-gray-400 leading-relaxed mt-2">
          Background-tier datasets are still valuable — they appear as Sources linked inside
          case studies, not as bulk-ingested Claims. This distinction keeps the graph from
          being overwhelmed by records that can&apos;t be directly cited.
        </p>
        <p className="text-sm text-gray-400 leading-relaxed mt-2">
          A pipeline that fails the reference-tier test after ingestion is retired rather than
          expanded. Its records are set to{" "}
          <span className="font-mono text-gray-300">verificationStatus: DEPRECATED</span> and
          retained for the audit trail.
        </p>
      </Section>

      {/* Editorial scope */}
      <Section id="editorial-scope" title="Editorial scope">
        <p className="text-sm text-gray-400 leading-relaxed">
          The inclusion test is unchanged from the{" "}
          <Link href="/about" className="underline hover:text-gray-300">About page</Link>:
          does receipt-and-provenance treatment of a claim help someone make a better decision
          about their life, politics, health, or understanding of how power works?
        </p>
        <p className="text-sm text-gray-400 leading-relaxed mt-2">
          What this rules out:
        </p>
        <ul className="list-disc pl-5 text-sm text-gray-400 space-y-1 mt-2">
          <li>
            <span className="text-gray-300">Celebrity news and engagement-driven content.</span>{" "}
            The epistemic arc of a celebrity statement is not the kind of fact the graph
            is designed to track.
          </li>
          <li>
            <span className="text-gray-300">Market commentary and investment signal.</span>{" "}
            Financial records appear as <em>accountability instruments</em> — STOCK Act
            disclosures, SEC enforcement filings, FEC campaign finance, macroeconomic series —
            because they document how power works, not how to trade.
          </li>
          <li>
            <span className="text-gray-300">Sports results and entertainment records.</span>{" "}
            Sports science papers appear (they are empirical claims); box scores do not.
          </li>
          <li>
            <span className="text-gray-300">Aggregated views of background-tier data.</span>{" "}
            A pipeline whose per-record audit cost exceeds its per-record editorial value is
            retired rather than audited indefinitely.
          </li>
        </ul>
        <p className="text-sm text-gray-400 leading-relaxed mt-2">
          Domain taxonomies (statistics, finance, sport science, and others) are navigation
          aids for searching the graph — curated reference maps, not ingested Claims.
        </p>
      </Section>

      {/* Deprecation policy */}
      <Section id="deprecation" title="Deprecation policy">
        <p className="text-sm text-gray-400 leading-relaxed">
          <span className="text-gray-300 font-semibold">No record is ever hard-deleted.</span>{" "}
          When a pipeline is retired or a record fails a quality audit, it is flagged with{" "}
          <span className="font-mono text-gray-300">verificationStatus: DEPRECATED</span> and
          a written{" "}
          <span className="font-mono text-gray-300">metadata.deprecation_reason</span>. The
          record remains in the database, excluded from default views, accessible via the
          &ldquo;Show deprecated&rdquo; toggle or a direct URL.
        </p>
        <p className="text-sm text-gray-400 leading-relaxed mt-2">
          This policy exists because the audit trail must outlive any single correction.
          Deleting a deprecated record would destroy the evidence that the pipeline ran, that
          a specific fabrication occurred, or that a given source was found unreliable. The
          receipts are the product.
        </p>
        <p className="text-sm text-gray-400 leading-relaxed mt-2">
          When a pipeline is retired, its ingestion script is relocated to{" "}
          <span className="font-mono text-gray-300">scripts/retired/</span> to prevent
          accidental re-runs. See the{" "}
          <Link href="/corrections" className="underline hover:text-gray-300">Corrections page</Link>{" "}
          for the full log of retired pipelines and their failure modes.
        </p>
        <p className="text-sm text-gray-400 leading-relaxed mt-2">
          The Pipeline 5 (USPTO) retirement is documented in full on the Corrections page. It
          is the clearest illustration of why the reference-tier test and the
          verifiable-sources rule exist: the pipeline used model-recall metadata rather than
          live API data, and the fabrication was confirmed only on audit. 182 records were
          deprecated; 97 patent claims were affected.
        </p>
      </Section>

      {/* Footer links */}
      <div className="pt-2 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-500">
        <Link href="/corrections" className="hover:text-gray-300 transition-colors">
          Corrections &rarr;
        </Link>
        <Link href="/datasets" className="hover:text-gray-300 transition-colors">
          Pipeline data cards &rarr;
        </Link>
        <Link href="/api/v1/manifest" className="hover:text-gray-300 transition-colors">
          Machine-readable manifest &rarr;
        </Link>
        <Link href="/sources" className="hover:text-gray-300 transition-colors">
          Sources &rarr;
        </Link>
      </div>
    </div>
  );
}

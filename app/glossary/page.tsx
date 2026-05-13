export default function GlossaryPage() {
  return (
    <div className="max-w-xl space-y-8 text-sm text-gray-300 leading-relaxed">
      <h1 className="text-lg font-semibold text-white">Glossary</h1>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-white">Core Entities</h2>
        <ul className="space-y-3 list-none pl-0">
          <li>
            <span className="text-white font-medium">Claim</span>
            <span className="text-gray-500"> — </span>
            A statement being tracked for provenance; has a verification status and may have parent
            or child claims.
          </li>
          <li>
            <span className="text-white font-medium">Source</span>
            <span className="text-gray-500"> — </span>
            A document, institution, or publication that takes a position on a claim.
          </li>
          <li>
            <span className="text-white font-medium">Edge</span>
            <span className="text-gray-500"> — </span>
            A source&apos;s position on a claim (FOR, AGAINST, or CITES); append-only, and
            contradictory edges from the same source are allowed.
          </li>
          <li>
            <span className="text-white font-medium">EdgeRevision</span>
            <span className="text-gray-500"> — </span>
            An append-only log of score changes to an Edge; the current score is always the latest
            revision, never stored on the Edge itself.
          </li>
          <li>
            <span className="text-white font-medium">MetaEdge</span>
            <span className="text-gray-500"> — </span>
            A relationship between two Edges (SUPPRESSED, AMPLIFIED, LABELED, or DEMOTED);
            structurally distinct from disagreement.
          </li>
          <li>
            <span className="text-white font-medium">SourceRelationship</span>
            <span className="text-gray-500"> — </span>
            A relationship between two Sources (funder_of, affiliated_with, co_authored_with,
            employed_by); the basis for source independence.
          </li>
          <li>
            <span className="text-white font-medium">SourceCredibilityEvent</span>
            <span className="text-gray-500"> — </span>
            An event that changes a source&apos;s standing: CREDIBILITY_DOWNGRADED or RESTORED.
          </li>
          <li>
            <span className="text-white font-medium">ThresholdEvent</span>
            <span className="text-gray-500"> — </span>
            A human-confirmed event marking a claim as having crossed an epistemic resolution
            threshold.
          </li>
          <li>
            <span className="text-white font-medium">SuggestedThresholdEvent</span>
            <span className="text-gray-500"> — </span>
            An AI-proposed threshold event, kept separate from the human-confirmed ThresholdEvent.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-white">Verification Statuses</h2>
        <ul className="space-y-3 list-none pl-0">
          <li>
            <span className="text-white font-medium">VERIFIED</span>
            <span className="text-gray-500"> — </span>
            Passed pipeline quality gates and editorial review.
          </li>
          <li>
            <span className="text-white font-medium">PROVISIONAL</span>
            <span className="text-gray-500"> — </span>
            Bulk-ingested from a vetted source; not individually reviewed.
          </li>
          <li>
            <span className="text-white font-medium">DISPUTED</span>
            <span className="text-gray-500"> — </span>
            Contested claim or pipeline; significant evidence on both sides without resolution.
          </li>
          <li>
            <span className="text-white font-medium">DEPRECATED</span>
            <span className="text-gray-500"> — </span>
            Pipeline retired due to bad data; records preserved for audit trail only.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-white">Pipeline Terms</h2>
        <ul className="space-y-3 list-none pl-0">
          <li>
            <span className="text-white font-medium">Pipeline</span>
            <span className="text-gray-500"> — </span>
            An automated ingestion script that produces claims from a structured external source.
          </li>
          <li>
            <span className="text-white font-medium">Receipt</span>
            <span className="text-gray-500"> — </span>
            The full provenance record for a claim: all edges, revisions, meta-edges, and threshold
            events.
          </li>
          <li>
            <span className="text-white font-medium">humanReviewed</span>
            <span className="text-gray-500"> — </span>
            Flag indicating a human reviewed the record; distinct from autoApproved.
          </li>
          <li>
            <span className="text-white font-medium">autoApproved</span>
            <span className="text-gray-500"> — </span>
            Flag indicating the pipeline&apos;s own quality gates passed; does not imply human
            review.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-white">Concepts</h2>
        <ul className="space-y-3 list-none pl-0">
          <li>
            <span className="text-white font-medium">Epistemic receipt</span>
            <span className="text-gray-500"> — </span>
            The audit trail of how a claim&apos;s consensus was formed or shifted.
          </li>
          <li>
            <span className="text-white font-medium">Auditability</span>
            <span className="text-gray-500"> — </span>
            The principle that every layer of the system is inspectable.
          </li>
        </ul>
      </section>
    </div>
  );
}

export default function ForthcomingPage() {
  return (
    <div className="max-w-xl space-y-8 text-sm text-gray-300 leading-relaxed">
      <h1 className="text-lg font-semibold text-white">Forthcoming</h1>

      <p>
        What the tool becomes next. These are not aspirations — they are queued work,
        ordered by leverage.
      </p>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-white">Ingestion Pipelines</h2>
        <p>
          Manual entry built the case studies. Pipelines build the infrastructure. Each source below
          produces institutional hard facts — dated, attributable, auditable — which become the
          reference layer the curated case studies sit on top of.
        </p>
        <ul className="space-y-3 list-none pl-0">
          <li>
            <span className="text-white font-medium">ClinicalTrials.gov</span>
            <span className="text-gray-500"> — </span>
            Trial registrations, interventions, primary outcomes, and result dates. The NCT registry
            is a precondition for FDA approval; these are the upstream receipts.
          </li>
          <li>
            <span className="text-white font-medium">NIH Reporter</span>
            <span className="text-gray-500"> — </span>
            Grant awards: who funded what, when, and for how much. Directly populates funding
            relationships between sources — the coordination-network layer the platform is built to surface.
          </li>
          <li>
            <span className="text-white font-medium">PubMed Retractions + Retraction Watch</span>
            <span className="text-gray-500"> — </span>
            Retracted papers with dates and stated reasons. The platform&apos;s thesis is that source
            credibility changes over time; retractions are the canonical example.
          </li>
          <li>
            <span className="text-white font-medium">FDA Safety Communications</span>
            <span className="text-gray-500"> — </span>
            Black box warnings, market withdrawals, and safety signal updates — the post-approval
            arc that the initial drug approval record doesn&apos;t capture.
          </li>
          <li>
            <span className="text-white font-medium">WHO PHEIC Declarations</span>
            <span className="text-gray-500"> — </span>
            Public Health Emergencies of International Concern with declaration and termination dates.
            Geopolitical health events as institutional hard facts.
          </li>
          <li>
            <span className="text-white font-medium">EMA Approvals</span>
            <span className="text-gray-500"> — </span>
            European Medicines Agency drug approvals, parallel to the existing FDA pipeline.
            Jurisdiction divergence — when EMA and FDA disagree — is itself a signal.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-white">Infrastructure</h2>
        <ul className="space-y-3 list-none pl-0">
          <li>
            <span className="text-white font-medium">Homepage redesign</span>
            <span className="text-gray-500"> — </span>
            Three sections sorted by epistemic state change: Recently Shifted, Hovering Near
            Threshold, Just Resolved. Earns its keep at ~50 claims with ThresholdEvents. Not before.
          </li>
          <li>
            <span className="text-white font-medium">Navigation search</span>
            <span className="text-gray-500"> — </span>
            Substring match on claim text and source names. Deferred until the dataset justifies it;
            building search against a small corpus means rebuilding it after the corpus grows.
          </li>
          <li>
            <span className="text-white font-medium">Artifact preservation</span>
            <span className="text-gray-500"> — </span>
            Linked URLs rot. An AGAINST edge pointing to a retracted Nature paper is worthless if
            Nature pulls the page. Archive.org caching or PDF storage, with schema support for
            preserved artifacts alongside live URLs.
          </li>
          <li>
            <span className="text-white font-medium">AI-assisted claim extraction</span>
            <span className="text-gray-500"> — </span>
            LLM proposes claim text, type, and source position from unstructured documents.
            Humans confirm before promotion. The <em>ai_jobs</em> table is already in the schema —
            this is the worker that fills it.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-white">Case Studies in Queue</h2>
        <p>
          Curated case studies are built with full receipts — every source, every edge revision,
          every threshold event. These take weeks, not hours.
        </p>
        <ul className="space-y-3 list-none pl-0">
          <li>
            <span className="text-white font-medium">Proximal Origin / Lab Leak</span>
            <span className="text-gray-500"> — </span>
            The Andersen letter, Daszak network, congressional testimony, NIH grant trail.
            The canonical coordination-network case.
          </li>
          <li>
            <span className="text-white font-medium">Ivermectin</span>
            <span className="text-gray-500"> — </span>
            A full arc from early observational studies through retracted meta-analyses to
            randomized controlled trial results. Source credibility events are the story.
          </li>
          <li>
            <span className="text-white font-medium">Opioid epidemic</span>
            <span className="text-gray-500"> — </span>
            Purdue Pharma&apos;s suppression of addiction data, the Sackler funding trail,
            and the FDA approval record. A MetaEdge case study.
          </li>
        </ul>
      </section>

      <p className="text-gray-500 text-xs pt-2">
        This page reflects current development priorities, not commitments. Order matters:
        ingestion before search, data before redesign.
      </p>
    </div>
  );
}

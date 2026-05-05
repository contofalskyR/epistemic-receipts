export default function ForthcomingPage() {
  return (
    <div className="max-w-xl space-y-8 text-sm text-gray-300 leading-relaxed">
      <h1 className="text-lg font-semibold text-white">Forthcoming</h1>
      <p className="text-xs text-gray-500">Last updated May 4, 2026</p>

      <p>
        What the tool becomes next. These are not aspirations — they are queued work,
        ordered by leverage.
      </p>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-white">Ingestion Pipelines</h2>
        <p>
          Phase 2 is hard-fact substrate. Six ingestion pipelines that build the bedrock layer of
          institutionally-verifiable, time-stable, non-interpretive facts. Bedrock under contested
          case studies.
        </p>
        <ul className="space-y-3 list-none pl-0">
          <li>
            <span className="text-white font-medium">NIH Reporter</span>
            <span className="text-gray-500"> — </span>
            Federal research grant database. Every grant is a funder_of SourceRelationship between
            the funding institution and the recipient researcher or institution. Auto-populates
            entity-to-entity edges that would otherwise be entered manually. Strengthens the lab leak
            case study (NIH–EcoHealth–WIV grant chain) and opens biomedical research provenance generally.
          </li>
          <li>
            <span className="text-white font-medium">PubChem</span>
            <span className="text-gray-500"> — </span>
            NIH chemical compound database. Molecular formulas, structures, CAS numbers, IUPAC names.
            Chemistry bedrock — as close to physical reality as institutional records get. Strengthens
            smoking (carcinogens) and Ozempic (semaglutide structure). The first ingester to create
            cross-reference edges between existing FDA approval claims and chemistry HARD_FACTs.
          </li>
          <li>
            <span className="text-white font-medium">ClinicalTrials.gov</span>
            <span className="text-gray-500"> — </span>
            Trial registrations, protocols, primary endpoints. Trial registration is HARD_FACT; results
            are EMPIRICAL. Provides clinical evidence substrate for medical case studies. Strengthens
            Ozempic and opens case studies on contested medical questions (Vioxx, opioid trials,
            hormone replacement, ivermectin).
          </li>
          <li>
            <span className="text-white font-medium">GenBank / NCBI</span>
            <span className="text-gray-500"> — </span>
            Genetic sequence database. DNA and RNA sequences are physical reality. Strengthens lab leak
            (SARS-CoV-2 sequence provenance) and opens infectious disease provenance broadly.
          </li>
          <li>
            <span className="text-white font-medium">USPTO</span>
            <span className="text-gray-500"> — </span>
            Patent grants. Each patent is a timestamped institutional fact about who claimed what
            invention when. Opens innovation provenance, pharmaceutical patent histories (relevant to
            pricing and access case studies), and technology consensus formation.
          </li>
          <li>
            <span className="text-white font-medium">IAU + NASA Exoplanet Archive</span>
            <span className="text-gray-500"> — </span>
            Astronomical catalogs and reclassifications. Strengthens Pluto and opens space science generally.
          </li>
        </ul>
        <p className="text-gray-500 text-xs">
          Phase 2 is hard-fact substrate. Curated case studies sit on top. Both grow together.
        </p>
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

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:hard-fact-pipeline-rules -->
# Hard-fact pipeline principles

## Editorial-not-algorithmic
Cross-references between bulk-ingested claims and curated case studies are editorial work, not algorithmic. Ingesters produce facts (claims, sources, edges). Humans curate connections (CITES edges). These belong in separate hand-curated scripts, not bulk ingesters.

## Curated lists require verifiable sources
Curated lists in HARD_FACT pipelines must be sourced from a verifiable external record — live API, Wikipedia article with citation, peer-reviewed publication, or government database. Training-data recall is not a verifiable source.

When live APIs are unavailable, the curated list itself becomes the verification surface: every entry must trace to a fetchable URL or document that confirms the patent number, accession, or identifier. Before a pipeline is run against production, spot-check at least the anchor entries against their canonical URLs.

The GenBank pipeline got this right: accessions were verified against ncbi.nlm.nih.gov before approval. The USPTO pipeline (Pipeline 5) did not: the absence of a working API made model memory feel like an acceptable substitute. It was not. At least two patent numbers in the initial run were confirmed fabrications pointing to unrelated patents.
<!-- END:hard-fact-pipeline-rules -->

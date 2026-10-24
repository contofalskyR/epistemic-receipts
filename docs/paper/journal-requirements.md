# *Scientific Data* — requirements that bind this submission

All fetched 2026-10-24 from nature.com (pages fetched with a browser session; quotes verbatim). Nothing here is from
memory. Re-check the APC on the acceptance date: "The APC price will be determined from the date on which the
article is accepted for publication."

## Article processing charge

- **US$2,690** (£2,150 / €2,390), "subject to VAT or local taxes where applicable."
  — https://www.nature.com/sdata/open-access (redirect target of `/sdata/about/open-access`)
- Waivers: automatic for corresponding authors in the lowest-income countries; others "on a case-by-case basis, and
  may be granted in cases of financial need … All applications for discretionary APC waivers and discounts should be
  made at the point of manuscript submission." — same page
- Rutgers coverage: see `external-facts.md` (the Springer Nature agreement covers hybrid titles only).

## Licences

- **The article:** "Scientific Data articles are published open access under a CC BY-NC-ND … or CC BY … licence."
  — https://www.nature.com/sdata/open-access
- **The data:** "Use open licences. CC0 and CC-BY, or their equivalents, are required in most cases to support maximum
  re-use. We do not allow -SA or -NC clauses (or equivalents) other than where applied to secondary data that has been
  generated from primary datasets from third parties where those original licence terms need to be retained in the
  derived output. Note this is not possible where input data has been licensed with an -ND clause."
  — https://www.nature.com/sdata/policies/repositories
- Data policy, fully open route: "Open licences (CC-BY / CC0, or equivalent)."
  — https://www.nature.com/sdata/policies/data-policies
- Consequence: the v1 draft's "ER-Community-1.0 … non-commercial use … Commercial use requires separate agreement" is
  **not allowed** (an -NC equivalent) unless it is inherited from an upstream licence. The current Zenodo record is
  already CC-BY-4.0 (`external-facts.md`). Upstream terms per pipeline still need checking, e.g. ClaimsKG-style
  CC BY-SA sources would force -SA on the derived part (Robert's licence decision).
- Compiled secondary data: "compilers … are not required by the journal to ask permission from the original authors
  to extract small amounts of numerical information or other fields … Care must be taken to ensure all extracted
  fields are accurate and that the DOI, URL, (or equivalent) of the source article is clearly visible at the data
  level." Wholesale reproduction of text "cannot typically be re-shared without permission unless the primary work is
  under a permissive licence." — https://www.nature.com/sdata/policies/data-policies
- Social media is human data: "tweets, data related to handles, and other posts, are classed as human data and cannot
  typically be indexed or re-published without participant consent." — same page. (Check: does any pipeline carry
  social-media text? Phase 5.)

## Repository criteria (non-sensitive data)

From https://www.nature.com/sdata/policies/repositories:

- "Ensure long-term persistence and preservation of datasets in their published form."
- "Make data available for peer review" without revealing reviewer identity.
- "Provide stable persistent identifiers … DOIs are the default for most non-omics datasets."
- "Direct https download of the submitted dataset, preferably as a single download/unit, from the DOI-registered page."
- "Allow public access to data without barriers."
- Open licence as above.
- Generalist repositories are acceptable where no discipline-specific one exists: "Data should be submitted to
  discipline-specific, community-recognised service where available or a generalist repository if not." The journal
  "does not mandate, endorse, or recommend any specific resource" for other data types.
- Timing: "For first round review we require that data are available for download … via any URL that allows anonymous
  download … From the second round of review onwards we require that data are public and available in a formal data
  repository." — https://www.nature.com/sdata/publish/submission-guidelines

Zenodo meets these on its face (DOI, direct https download, open access). The open question is what is deposited
(`external-facts.md`: the current version is a whole-database dump).

## Data Descriptor format

From https://www.nature.com/sdata/publish/submission-guidelines:

**Required order:** Title · Author list · Abstract · Background & Summary · Methods · Data Records · Data Overview
(optional) · Technical Validation · Usage Notes (optional) · Data Availability · Code Availability · References ·
Author Contributions · Competing Interests · Acknowledgements (optional) · Funding · Ethics statement (where relevant
for human or animal studies; recommended as a Methods sub-heading).

**Limits and rules:**

- **Title:** "must not exceed 110 characters, including whitespaces … Colons and parentheses are not permitted … Do not
  include dataset brand names in titles, self-constructed acronyms … do not include advertising claims … (e.g. novel,
  first, AI-ready, open, etc)." → The working title *"Epistemic Receipts: a cross-domain corpus of 1.76 million
  source-linked claims with dated epistemic-status transitions"* breaks three rules: it has a colon, contains the
  brand name, and is 118 characters long (`python3 -c 'print(len("…"))'`).
- **Abstract:** "We recommend the Abstract should not exceed 170 words … should not make any claims regarding new scientific
  findings. We recommend URLs for download … are not included." No sub-headings.
- **Main sections, especially Methods:** "have no word length limits."
- **Background & Summary:** "Please do not include subjective claims on novelty, impact, or utility." Citing some
  related datasets is recommended, with "no formal mandate to cite a given amount of prior art."
- **Methods:** for secondary datasets, "all details of input data should be described … at a level of detail that
  allows readers to source the exact data used (please do not use non-specific URLs or just homepages). Where
  continuously updated input data have been used, authors should provide the version number or search terms." Input
  datasets with DOIs must be cited in the data-citation format. No results or analyses.
- **Data Records:** repository, files, formats, folder structure; define bespoke column names. **"Please do not
  include summary statistics in this section."**
- **Data Overview (optional):** "limit this to a small number of figures or tables (1-2) and a single paragraph of
  text." Descriptive statistics belong here, if anywhere.
- **Technical Validation:** "the experiments, analyses or checks needed to support the technical quality of the
  dataset."
- **Usage Notes (optional):** technical notes on access and processing; "Please do not use this section to write a
  conclusions section, general selling points, worked cases studies, or similar."
- **Data Availability:** required in addition to Data Records; repeat URLs, accession numbers and reference numbers.
- **Code Availability:** required, "immediately before the references"; state how custom code can be accessed,
  versions and parameters.
- **Funding:** required even if unfunded ("please still add a statement and declare this").
- **Competing interests, Author contributions:** required (captured in the SNAPP submission system).
- **Figures:** "We recommend Data Descriptors and Articles not have more than eight figures." Legends ≤ 350 words.
  Sans-serif, white background, thousands separated by commas.
- **Tables:** recommended ≤ 10; tables of hundreds or thousands of rows go in the repository, not the paper.
- **Supplementary information:** discouraged; PDF ≤ 10 MB; csv/xlsx for oversize tables.
- **Data citation:** every dataset cited in the reference list with authors, title, repository, URL, and year;
  DOIs as `https://doi.org/…`.
- **First-round files:** a single PDF is enough; revisions need .docx or .tex.

**Review:** "Most Data Descriptors will be reviewed by two or more referees … acceptance … is not based on the perceived
impact or novelty." — https://www.nature.com/sdata/policies/editorial-and-publishing-policies

## LLM / AI policy

- **Scientific Data editorial policy:** "Large Language Models (LLMs), such as ChatGPT, do not currently satisfy our
  authorship criteria … Use of an LLM should be properly documented in the Methods section (and if a Methods section is
  not available, in a suitable alternative part) of the manuscript." It points to the portfolio AI section.
  — https://www.nature.com/sdata/policies/editorial-and-publishing-policies
- **Springer Nature / Nature Portfolio AI policy** (risk framework; applies to "AI use in research practice and
  manuscript preparation") — https://www.nature.com/nature-portfolio/editorial-policies/ai
  - Core: "Human accountability is non‑transferable"; "AI may support, but must not replace, scholarly judgement";
    "Transparent declaration of AI builds trust."
  - **Green (permitted, disclosure encouraged):** language polishing, structuring, "Data cleaning and deduplication."
    Expectation: "AI use does not introduce new intellectual content."
  - **Amber (permitted with human oversight, verification and disclosure):** AI that "does introduce new intellectual
    content and requires verification and oversight", e.g. "Drafting explanatory summaries", "Extensive copy editing or
    writing support". "Human judgement and accountability must be demonstrable."
  - **Red (not permitted):** "AI use is opaque or creates non‑verifiable outputs"; "Fabricating data, citations or
    results"; "Generating hypotheses, analyses or conclusions and presenting them as human-derived"; "Using an LLM to
    generate core research reasoning without disclosure."
  - Authors "Remain fully accountable for originality, accuracy, and integrity" and "Disclose AI use."
- **LLM-generated dataset content specifically:** none of the five pages fetched (submission guidelines, data policies,
  repositories, editorial policies, portfolio AI policy) has a rule written for datasets whose records were drafted by
  an LLM. A web search found no journal-specific statement either (only third-party summaries, not used). The rules
  that apply by their terms:
  1. Disclosure in **Methods** (editorial policy). For this dataset that means the curated-trajectory drafting (seed
     scripts; git trailers name Claude Sonnet 4.6 / Opus 4.6–4.8), the corpus promoter's `enrich*` transitions
     (`claude-opus-4-8` default), `claude_sourcing_v1` (Haiku 5.5 / Sonnet 5.5, stored per row), the 16 `book-analysis`
     claims, and the use of coding assistants to write the pipelines and this paper's census.
  2. **Verifiability** (the red tier's "non-verifiable outputs" and "Fabricating data"): LLM-drafted records must be
     traceable to a source a reader can check. That argues for reporting T1 (independent dated source) beside T2,
     the source-link and URL-liveness rates, and the human-annotation study (Phase 4), and for flagging the
     LLM-drafted rows in the export.
  3. **Amber oversight:** "Human judgement and accountability must be demonstrable." The database records human review
     on 43 claims (numbers.md §1.1); the annotation study is the main evidence of human verification.
  4. The verifiable-sources doctrine (AGENTS.md; the USPTO retirement) is directly relevant to point 2.

  Recommendation: ask the editorial office before submission, since the policy does not address LLM-drafted records.

# Spec 13 — Licensing & Legal Scaffolding

Phase 1 · Depends on: nothing · Model: Sonnet 5 · Scope: ~1–2 agent sessions
**Every legal text produced here is a DRAFT for lawyer review — label each file "DRAFT — not yet reviewed by counsel" until the human removes it.**

## Objective
The licensable asset is the compilation: graph structure, curation, provenance metadata, trajectories (facts themselves are public record). Put the scaffolding in place so usage terms are explicit before the first commercial conversation.

## Deliverables

### 1. License drafts (`legal/` dir in repo)
- `legal/LICENSE-community.md` — free tier: research/personal/non-commercial use of API + sample snapshot; attribution required ("Data: Epistemic Receipts, epistemic-receipts.vercel.app" + link); no redistribution of bulk data; no use as training data. Base on ODC-By structure but written plainly.
- `legal/LICENSE-commercial.md` — skeleton term sheet, not a contract: grounding/RAG use, training use, redistribution rights, freshness SLA tiers, attribution options, per-seat vs per-request vs flat. Explicit placeholders (`[PRICE]`, `[TERM]`) — do not invent numbers.
- `legal/terms-of-service.md`, `legal/privacy-policy.md` drafts — the site already collects emails (TopicSubscription, Feedback); the privacy draft must describe actual current practice (read the code: what's stored, hashed profile keys, unsubscribe tokens, Resend as processor). Accuracy over boilerplate: describe what the system does, not what generic SaaS does.

### 2. Site surfaces
- `/license` page rendering the community license + a "commercial licensing" contact section (mailto for now).
- Footer links: license, terms, privacy.
- License string surfaced in: `/api/v1/manifest` (replaces Spec 11's placeholder), snapshot `manifest.json` (Spec 12), API response headers (`X-License: ER-Community-1.0` — coordinate with Spec 20).
- Attribution spec: `/license#attribution` with copy-paste HTML/markdown/BibTeX snippets for citing the site, a dataset, or a specific claim (claim URLs are canonical + stable — state this as a commitment).

### 3. Human checklist (`legal/CHECKLIST.md`)
Ordered list with rationale, for the owner: form entity (before first paid contract); counsel review of both licenses + ToS/privacy; confirm CCES/ConstituentOpinion and any other upstream dataset's redistribution terms (flag: several upstreams — HowTheyVote.eu, GCAT, Retraction Watch — have their own licenses; agent compiles the table of upstream license terms per pipeline from the registry, human verifies); decide jurisdiction; trademark search on "Epistemic Receipts".

### 4. Upstream license audit table
`legal/upstream-licenses.md` — for every pipeline in the registry (Spec 11): upstream terms (public domain / CC-BY / database-specific / unknown), redistribution allowed?, attribution required?. Where terms are unknown, write UNKNOWN — never assume. This table determines what can legally be in snapshots; anything UNKNOWN or restrictive gets flagged in the Spec 12 excluded-list until resolved.

## Out of scope
Entity formation, actual legal advice, pricing decisions, signing anything. The agent drafts and compiles; humans decide.

## Acceptance criteria
- All drafts carry the DRAFT banner. Privacy draft's data-practices section matches the code (PR includes the file/line references used).
- Upstream table covers 100% of registry tags; every row cites the URL where terms were found or says UNKNOWN.
- Any pipeline whose upstream prohibits redistribution is listed in a "must resolve before snapshot inclusion" section and cross-referenced in Spec 12's config.
- `/license` renders; manifest license field populated.

## Verification
Paste: upstream-table coverage count vs registry count · 3 spot-checked upstream terms with URLs · privacy-draft-to-code reference list.

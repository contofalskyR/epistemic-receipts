# Eval Transcripts — epistemic-receipts-mcp

10 scripted agent tasks demonstrating the MCP server tools.
These are scaffolded transcripts showing expected tool call patterns and response shapes.
**Populate with live outputs after the server is connected to staging.**

---

## Task 1: "What's the status of the lab-leak claim and how did it change?"

**Tool sequence:** `search_claims` → `get_trajectory`

```
User: What's the documented status of the SARS-CoV-2 lab-leak hypothesis and how has it changed over time?

Assistant calls: search_claims(query="SARS-CoV-2 lab origin lab-leak hypothesis", limit=5)

[Expected response: claims with axis CONTESTED or OPEN, provenanceGrade B/C, pipeline crossref or pubmed]

Assistant calls: get_trajectory(claim_id="<id from search>")

[Expected response: trajectory showing transitions, e.g. OPEN → CONTESTED, with marker sources (IC assessment, Senate report, etc.)]

Assistant answer: The lab-leak hypothesis is documented as CONTESTED in the Epistemic Receipts corpus as of [date]. The trajectory shows [N] documented transitions: initially classified as OPEN (insufficient evidence), shifting toward CONTESTED following [marker source] in [year]. The claim has [N] FOR edges and [M] AGAINST edges from documented sources.

citation: https://epistemic-receipts.vercel.app/claims/[id]
Source: Epistemic Receipts — provenance grades measure documentation depth, not truth.
```

---

## Task 2: "Was this paper retracted?"

**Tool sequence:** `search_claims` → `get_claim_with_receipts`

```
User: Was the 2020 hydroxychloroquine Surgisphere paper retracted?

Assistant calls: search_claims(query="hydroxychloroquine Surgisphere retraction 2020", limit=5)

[Expected response: claim about the Lancet retraction with axis RECORDED]

Assistant calls: get_claim_with_receipts(claim_id="<id>")

[Expected response: CONTRADICTS edges pointing to the original paper, RECORDED axis, pipeline likely crossref_retractions_v1]

Assistant answer: Yes, documented. The corpus contains a RECORDED claim about the Surgisphere/Lancet retraction. Provenance grade [B/C], pipeline [pipeline name]. The claim has [N] CONTRADICTS edges. 

citation: https://epistemic-receipts.vercel.app/claims/[id]
```

---

## Task 3: "State of knowledge on semaglutide as of 2019"

**Tool sequence:** `state_of_knowledge`

```
User: What was the documented state of knowledge on semaglutide for weight loss as of 2019?

Assistant calls: state_of_knowledge(topic="semaglutide weight loss", as_of_date="2019-12-31")

[Expected response: claims with trajectory filtered to ≤2019-12-31; likely OPEN or RECORDED at that date, pre-STEP trial results]

Assistant answer: As of December 2019, documented knowledge on semaglutide for weight loss shows:
- [Claim 1]: Axis at 2019-12-31: RECORDED — Phase 2 trial results documented
- [Claim 2]: Axis at 2019-12-31: OPEN — Weight loss indication not yet established

citation: https://epistemic-receipts.vercel.app/claims/[id1], https://epistemic-receipts.vercel.app/claims/[id2]
```

---

## Task 4: "Find claims about mRNA vaccine myocarditis"

**Tool sequence:** `search_claims` → `get_claim_with_receipts`

```
User: What does the corpus say about mRNA vaccines and myocarditis?

Assistant calls: search_claims(query="mRNA vaccine myocarditis", axis="SETTLED", limit=10)

[Expected: claims with SETTLED or CONTESTED axis depending on corpus state]

Assistant calls: get_claim_with_receipts(claim_id="<top result id>")

[Expected: FOR edges from CDC reports, VAERS, meta-analyses; AGAINST edges if any]

Assistant answer: The corpus documents [N] claims on mRNA vaccines and myocarditis...
```

---

## Task 5: "What's in the Epistemic Receipts corpus?"

**Tool sequence:** `list_datasets`

```
User: What data sources does Epistemic Receipts cover?

Assistant calls: list_datasets()

[Expected: 20+ active pipelines including crossref_retractions_v1, retraction_watch_v1, openfda, pubmed, etc. with claim counts]

Assistant answer: The Epistemic Receipts corpus currently covers [N] pipelines:
- crossref_retractions_v1: [count] claims, last run [date]
- retraction_watch_v1: [count] claims, last run [date]
...
```

---

## Task 6: "Verify: ivermectin is effective against COVID-19"

**Tool sequence:** `verify_statement` → `get_claim_with_receipts`

```
User: Can you verify: "Ivermectin is effective against COVID-19"?

Assistant calls: verify_statement(statement="Ivermectin is effective against COVID-19", limit=5)

[Expected: top matches are CONTESTED or SETTLED claims about ivermectin COVID efficacy]

Note in response: "These are documented claims similar to your statement. The epistemicAxis reflects the claim's documented status — not a verdict on your statement."

Assistant calls: get_claim_with_receipts(claim_id="<best match>")

[Expected: trajectory showing consensus shift, AGAINST edges from TOGETHER trial, FOR edges from earlier observational studies]

Assistant answer: I found [N] similar documented claims. The closest match documents the ivermectin COVID-19 efficacy question as [axis]. Important: this reflects documentation depth, not a truth verdict on your statement...
```

---

## Task 7: "How has the asymptomatic COVID transmission claim evolved?"

**Tool sequence:** `search_claims` → `get_trajectory`

```
User: How has the documented understanding of asymptomatic COVID-19 transmission changed?

Assistant calls: search_claims(query="COVID-19 asymptomatic transmission spread", limit=5)

[Expected: claims around asymptomatic spread with trajectory]

Assistant calls: get_trajectory(claim_id="<id>")

[Expected: transitions from early 2020 uncertainty → documented evidence → settled status]

Assistant answer: The corpus shows [N] transitions documenting how understanding of asymptomatic COVID-19 transmission evolved...
```

---

## Task 8: "What retractions happened in 2023?"

**Tool sequence:** `search_claims` with pipeline filter

```
User: What scientific retractions are documented in the corpus for 2023?

Assistant calls: search_claims(query="retraction 2023", limit=20)

[Expected: RECORDED claims from crossref_retractions_v1 and retraction_watch_v1 with 2023 dates]

Assistant answer: The corpus documents [N] retractions dated to 2023...
```

---

## Task 9: "What's the provenance quality of the clinical trials data?"

**Tool sequence:** `list_datasets` → `search_claims`

```
User: How well-documented are the clinical trials claims in the corpus?

Assistant calls: list_datasets()
[Identifies clinicaltrials pipeline]

Assistant calls: search_claims(query="clinical trial", limit=10)
[Reviews provenance grades]

Assistant answer: The ClinicalTrials pipeline has [count] claims, last run [date]...
```

---

## Task 10: "Find SETTLED claims about statins and cardiovascular risk"

**Tool sequence:** `search_claims` → `get_claim_with_receipts`

```
User: What SETTLED claims exist about statins reducing cardiovascular risk?

Assistant calls: search_claims(query="statins cardiovascular risk reduction", axis="SETTLED", limit=5)

[Expected: claims with SETTLED axis, grade A or B, primary source edges from RCTs]

Assistant calls: get_claim_with_receipts(claim_id="<top result>")

[Expected: multiple FOR edges from major RCTs (4S, WOSCOPS, HPS), grade A or B, SETTLED axis throughout trajectory]

Assistant answer: The corpus contains [N] SETTLED claims about statins and cardiovascular risk...
```

---

## How to run these evals with live data

```bash
# Start the MCP server in stdio mode
EPISTEMIC_RECEIPTS_API_KEY=er_live_... npx epistemic-receipts-mcp

# Or use the hosted endpoint in Claude Code:
# Add to claude.json then run each query in a new conversation
```

Replace `[id]` placeholders and `[Expected: ...]` blocks with actual outputs after connecting to staging.

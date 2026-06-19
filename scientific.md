# Scientific Notes — Epistemic Receipts Settling Curve Corpus

## Overview

Ongoing corpus construction of epistemic state-transition trajectories via automated agentic loops. Two active pipelines as of June 2026:

- **History loop** (`loop-settling-curve.sh`) — cycles geographically and chronologically across world history
- **Medicine loop** (`loop-settling-curve-medicine.sh`) — cycles through drug discovery, clinical trials, post-market surveillance, and regulatory reversals

---

## Corpus Construction Methodology

### Trajectory Generation

Each loop run uses a 3-stage pipeline:
1. **Opus (generate)** — proposes N new trajectory candidates for a given geographic region + era
2. **Sonnet (fix/commit)** — validates, deduplicates against seed file, commits passing candidates
3. **Opus (review)** — quality gate; flags issues before push; loop retries on failure

Trajectories are rejected if they:
- Lack a day/month-precise date anchor
- Cannot be verified against a live primary source (Wikipedia, PubMed, FDA, etc.)
- Duplicate an existing externalId in the seed file
- Fail axis-validity rules (e.g. OPEN→SETTLED skipping RECORDED, SETTLED→REVERSED without prior SETTLED)

### Deduplication Pipeline

The system employs a multi-layer deduplication strategy:

1. **Keyword grep** — the generation prompt instructs the model to grep the seed file by event name and date before proposing candidates
2. **externalId scan** — after generation, proposed externalIds are checked against all existing entries in the seed file
3. **Opus review gate** — a final independent Opus pass catches issues that escaped the generation step

**Known failure mode (observed 2026-06-18):** The keyword grep can miss entries if the grep term doesn't exactly match the stored event name. In one instance, `trajectory:nitrogen-mustard-first-chemotherapy-1946` and `trajectory:farber-aminopterin-leukemia-remission-1948` passed the keyword grep but collided with pre-existing entries at lines 3292 and 3334 respectively. The Opus review gate caught both; Sonnet removed the duplicate blocks and the seeder re-ran clean.

A similar near-miss occurred in the history loop: Battle of the Kalka River and Battle of Ankara both passed the initial keyword grep but were caught by the externalId scan before being written.

**Implication:** The review pipeline is functioning as designed — duplicates are arising at the grep stage but being caught downstream. The Opus gate provides an essential independent verification layer.

### Saturation Dynamics

The loops are open-ended and run until natural saturation — defined as the point at which the model consistently fails to produce N valid, non-duplicate candidates in a given region/era slot.

- **History loop:** Very large search space (all of world history across ~20 geographic cycling regions × multiple era brackets). No saturation signal observed as of June 2026. Estimated runtime: weeks to months.
- **Medicine loop:** More bounded search space (drug classes × clinical phases × post-market periods). Still producing 4–5 valid trajectories per run as of June 2026. Estimated saturation: within hundreds of trajectories.

---

## Running Counts (updated as observed)

| Loop | Approx. trajectories as of | Notes |
|------|---------------------------|-------|
| History | Run ~723 (2026-06-19 ~2am EDT) | ~3-4 added per run |
| Medicine | Run ~731 (2026-06-19 ~2am EDT) | ~4-5 added per run |

---

## Open Questions / To-Do

- [ ] Formal saturation criterion: define threshold for "loop exhausted" (e.g., 3 consecutive runs with 0 valid new trajectories in a region)
- [ ] Cross-loop deduplication: history and medicine loops currently check only their own seed files; overlapping events (e.g. wartime medicine, epidemic response) may produce near-duplicates across corpora
- [ ] Precision of deduplication: assess false-negative rate of keyword grep step empirically

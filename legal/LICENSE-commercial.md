> **DRAFT — not yet reviewed by counsel. This is a skeleton term sheet for discussion purposes only, NOT a binding contract. All placeholders ([PRICE], [TERM], etc.) must be negotiated and filled in before execution. Obtain legal advice before use.**

# Epistemic Receipts Commercial Licence — Skeleton Term Sheet

*This document outlines the key terms for commercial licensing of Epistemic Receipts data. It is a starting point for negotiation, not a final agreement.*

---

## 1. Parties

| Field | Value |
|---|---|
| **Licensor** | Epistemic Receipts / [ENTITY NAME — to be formed] |
| **Licensee** | [COMPANY NAME] |
| **Effective Date** | [DATE] |
| **Term** | [TERM] (e.g., 12 months, auto-renewing) |

---

## 2. Licence Grant Options

*Select one or more tiers; price and scope to be negotiated per customer.*

### Tier A — Grounding / RAG Use

Licensee may use Epistemic Receipts data as a retrieval corpus to ground or augment the responses of a large language model or other AI system, provided:

- The system does not retain or re-serve bulk data outside the context of individual inference calls.
- Attribution to Epistemic Receipts is included in any end-user-visible output that cites the data.
- Pricing model: **[PRICE]** per [seat / month / API request / million tokens retrieved — choose one].

### Tier B — Training Use

Licensee may include Epistemic Receipts data in training datasets for machine-learning models, provided:

- A data-handling addendum is signed describing which model(s) will be trained and on what schedule.
- Model outputs derived substantially from this data carry attribution (to be agreed in the addendum).
- Freshness: training datasets are provided as point-in-time snapshots; Licensor makes no warranty as to snapshot currency.
- Pricing model: **[PRICE]** per [snapshot / claim count tier / model training run — choose one].

### Tier C — Redistribution Rights

Licensee may redistribute database extracts as part of a downstream product or dataset, subject to:

- A maximum claim count or percentage of total database per redistribution event: **[LIMIT]**.
- Attribution requirements (Section 5) applied to all redistributed data.
- Licensee's downstream users are not granted redistribution rights.
- Pricing model: **[PRICE]** per [claim / row / dataset release — choose one].

### Tier D — Enterprise API Access

Dedicated access with higher rate limits, SLA, and priority support:

- Rate limit: **[LIMIT]** requests per [day/month].
- Pricing model: **[PRICE]** flat per month; or **[PRICE]** per request above **[THRESHOLD]**.

---

## 3. Freshness SLA Tiers

*To be confirmed once pipeline cadences are stabilised.*

| Tier | Description | Data Lag | Price Add-on |
|---|---|---|---|
| **Standard** | Best-effort refresh | No guarantee | — |
| **Weekly** | Pipelines run at least weekly | ≤ 7 days | **[PRICE]** |
| **Daily** | Key pipelines run daily | ≤ 24 hours | **[PRICE]** |
| **Real-time** | Webhook / streaming push | Near-real-time | **[PRICE]** — not available at launch |

---

## 4. Attribution Options

| Option | Requirement |
|---|---|
| **Full** | "Data: Epistemic Receipts ([URL])" in all user-visible output and dataset metadata |
| **Metadata-only** | Attribution included in dataset card / API response headers only; not required in end-user UI |
| **White-label** | Attribution waived; additional fee: **[PRICE]** |

---

## 5. Attribution Requirements (Default)

Unless white-label is selected, all commercial uses must include:

> Data sourced from **Epistemic Receipts** — [epistemic-receipts.vercel.app](https://epistemic-receipts.vercel.app)

In machine-readable metadata:
```
"source": "Epistemic Receipts",
"license": "ER-Commercial-[TIER]"
```

---

## 6. Exclusions

This licence does not include:

- Rights to use the Epistemic Receipts name or trademark for endorsement without prior written consent.
- Warranty of accuracy, completeness, or fitness for any particular purpose.
- Indemnification for claims arising from downstream use.

---

## 7. Pricing Models (Summary)

*None of the following figures are final — all are placeholders for negotiation:*

| Model | Placeholder |
|---|---|
| Per-seat / month | **[PRICE]** per named user |
| Per-request | **[PRICE]** per 1,000 API calls |
| Flat monthly | **[PRICE]** per month |
| Annual prepay discount | **[DISCOUNT]%** off monthly rate |
| Training dataset (one-time) | **[PRICE]** per snapshot |

---

## 8. Other Key Terms (to be drafted by counsel)

- Governing law and jurisdiction: **[JURISDICTION]**
- Dispute resolution: **[ARBITRATION / COURTS]**
- Limitation of liability: **[CAP — e.g., fees paid in preceding 12 months]**
- Confidentiality: standard mutual NDA or standalone addendum
- Data processing addendum: if Licensee is subject to GDPR or equivalent, a DPA is required
- Termination: **[TERM]** notice for convenience; immediate for breach
- Audit rights: Licensor may audit usage logs **[FREQUENCY]** with **[NOTICE]** days notice

---

## 9. Contact

To initiate a commercial licence discussion:

**commercial@epistemic-receipts.vercel.app** *(placeholder — update before publication)*

---

*Skeleton Version 1.0 — July 2026 · Epistemic Receipts*

> **DRAFT — not yet reviewed by counsel. Do not publish or rely on this document until a licensed attorney has approved it.**

# Epistemic Receipts Community License — Version 1.0 (ER-Community-1.0)

*Modelled on the structure of the Open Data Commons Attribution License (ODC-By 1.0), written in plain language.*

---

## 1. What this covers

This license covers:

- **API access** — the Epistemic Receipts public API endpoints (currently at `epistemic-receipts.vercel.app/api/`).
- **Sample snapshots** — any dataset files released by Epistemic Receipts under this license (labelled "Community Snapshot").

It does **not** cover the source code of the application (see the code repository for its own license) or any upstream data whose redistribution is governed by the terms of its original provider (see `upstream-licenses.md`).

---

## 2. What you can do

Subject to the conditions in Section 3, you may:

1. Access, query, download, and use the database and its contents for **research, personal, educational, or other non-commercial purposes**.
2. Reproduce and share extracts of the database — meaning portions that are not a substantial part of the whole — for the purposes in (1).
3. Build non-commercial applications, visualisations, or tools that query the API and display results.
4. Cite individual claims by their canonical URL. Claim URLs are stable identifiers; Epistemic Receipts commits to maintaining them.

---

## 3. Conditions

### 3.1 Attribution

Any public use of data from this database must include the following attribution, or one substantially equivalent:

> **Data: Epistemic Receipts** — [epistemic-receipts.vercel.app](https://epistemic-receipts.vercel.app)

In machine-readable contexts (e.g., JSON metadata, dataset cards), include:

```
"source": "Epistemic Receipts",
"source_url": "https://epistemic-receipts.vercel.app",
"license": "ER-Community-1.0"
```

### 3.2 No bulk redistribution

You may not redistribute the database as a whole, a substantial part of it, or any Community Snapshot file in a form that would allow others to use it as a substitute for accessing Epistemic Receipts directly. "Substantial" means any extract that would provide meaningful standalone utility without reference to the live service.

This restriction does not prevent:
- Including small extracts in research papers, blog posts, or educational materials with attribution.
- Sharing API responses in logs, notebooks, or reproducibility materials, provided they are incidental to another primary purpose.

### 3.3 No training use

You may not use the database, any Community Snapshot, or any substantial extract as training data, fine-tuning data, pre-training data, or reinforcement-learning feedback for any machine-learning model, without a separate written agreement with Epistemic Receipts.

### 3.4 Non-commercial only

This license is limited to non-commercial use. Commercial use — including use in a product or service that generates revenue, or use by a for-profit entity for internal business purposes — requires a separate commercial licence (see Section 5).

### 3.5 Upstream terms pass through

Some data in this database originates from upstream providers with their own licence terms. Your use must also comply with those upstream terms, which are documented in `upstream-licenses.md`. Where upstream terms are more restrictive than this licence, the upstream terms govern.

### 3.6 No misrepresentation

You must not represent the data as official government data, as data from any upstream source directly, or as your own original creation when it is derived from Epistemic Receipts.

---

## 4. No warranty

The database is provided "as is." Epistemic Receipts makes no warranty as to accuracy, completeness, fitness for purpose, or continued availability. Epistemic Receipts shall not be liable for any damages arising from use of the database.

---

## 5. Commercial licensing

For commercial use, training use, redistribution, or enterprise access, contact:

**commercial@epistemic-receipts.vercel.app** *(placeholder — update before publication)*

A separate commercial licence is required. See `LICENSE-commercial.md` for the skeleton term sheet.

---

## 6. Termination

This licence terminates automatically if you breach any of its conditions. You may re-apply for access by correcting the breach and notifying Epistemic Receipts.

---

*Version 1.0 — July 2026 · Epistemic Receipts*

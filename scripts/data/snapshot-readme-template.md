# Epistemic Receipts — Snapshot {{SNAPSHOT_ID}}

**Created:** {{CREATED_AT}}
**Schema version (Prisma migration):** {{MIGRATION_ID}}
**License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
**Methodology:** https://epistemic-receipts.com/methodology

---

## What's in this snapshot

This snapshot contains an immutable, checksummed export of the Epistemic Receipts claim graph at the time of publication. It is intended for research, journalism, and AI training use cases where reproducibility and provenance are essential.

### Included tables (22)

| File | Description |
|------|-------------|
| `claim.jsonl.gz` / `claim.parquet` | Core fact claims — the primary unit of the graph. Each row is an empirical, institutional, or interpretive claim with its current epistemic status. |
| `source.jsonl.gz` / `source.parquet` | Sources (papers, APIs, databases, rulings) that support or contradict claims. |
| `edge.jsonl.gz` / `edge.parquet` | Evidence edges connecting sources to claims (FOR, AGAINST, CITES, RETRACTS, CORRECTED). |
| `edge_revision.jsonl.gz` / `edge_revision.parquet` | Score revision history for each edge. Current score = latest revision. |
| `meta_edge.jsonl.gz` / `meta_edge.parquet` | Edges between claims (e.g. SUPERSEDES, CITED_BY). |
| `threshold_event.jsonl.gz` / `threshold_event.parquet` | Epistemic threshold crossings — the moment a community ratified or reversed a claim. |
| `claim_status_history.jsonl.gz` / `claim_status_history.parquet` | Full trajectory of epistemic status transitions per claim. |
| `claim_relation.jsonl.gz` / `claim_relation.parquet` | Relations between claims (CITES, OUTCOME, REVERSED, etc.). |
| `topic.jsonl.gz` / `topic.parquet` | Topic taxonomy entries. |
| `claim_topic.jsonl.gz` / `claim_topic.parquet` | Many-to-many: claim ↔ topic. |
| `legislative_vote.jsonl.gz` / `legislative_vote.parquet` | Legislative vote records (chamber, yes/no/abstain counts, date, result). |
| `member_vote.jsonl.gz` / `member_vote.parquet` | Individual member votes within a legislative vote. |
| `political_context.jsonl.gz` / `political_context.parquet` | Political context enrichment for sources (head of government, majority party, etc.). |
| `polity.jsonl.gz` / `polity.parquet` | Political entities (nations, states, historical polities). |
| `polity_claim.jsonl.gz` / `polity_claim.parquet` | Links between polities and claims. |
| `polity_vote.jsonl.gz` / `polity_vote.parquet` | Links between polities and legislative votes. |
| `historical_event.jsonl.gz` / `historical_event.parquet` | Named historical events (DIPLOMATIC, INTELLIGENCE, MILITARY, LEGISLATIVE). |
| `claim_historical_event.jsonl.gz` / `claim_historical_event.parquet` | Many-to-many: claim ↔ historical event. |
| `wikidata_link.jsonl.gz` / `wikidata_link.parquet` | Wikidata Q-number cross-references for sources. |
| `source_relationship.jsonl.gz` / `source_relationship.parquet` | Relationships between sources (funder_of, affiliated_with, co_authored_with, employed_by). |
| `source_credibility_event.jsonl.gz` / `source_credibility_event.parquet` | Credibility downgrade / restore events for sources. |
| `claim_location.jsonl.gz` / `claim_location.parquet` | Geographic coordinates associated with claims. |

### Excluded tables

The following are intentionally excluded and will never appear in a snapshot:

- `Profile`, `Bookmark`, `TopicSubscription`, `WatchedTopic` — user account data (PII)
- `Feedback` — user-submitted feedback (PII)
- `AiJob`, `PipelineRun` — operational metadata, not graph content
- `SuggestedThresholdEvent` — unreviewed AI suggestions
- `Book*`, `BookChunk`, `BookClaim`, `BookClaimMatch` — licensed upstream content
- `ConstituentOpinion` — licensed CCES data (check CCES terms before ever redistributing)
- `TrajectorySearchDoc` — derived search index
- `BillCoverage` — derived news coverage metadata
- `TransitionClaimsSnapshot` — derived AI extraction cache

---

## Filtering guidance

### DEPRECATED rows

Claims and sources with `verificationStatus = 'DEPRECATED'` are **included** in the export. The audit trail is part of the product — buyers can filter out deprecated rows for clean data, or include them for provenance research.

To exclude deprecated claims:
```sql
-- DuckDB
SELECT * FROM read_parquet('claim.parquet')
WHERE verificationStatus IS DISTINCT FROM 'DEPRECATED'
```

Or in JSONL (Python):
```python
import gzip, json
with gzip.open('claim.jsonl.gz', 'rt') as f:
    claims = [json.loads(l) for l in f if json.loads(l).get('verificationStatus') != 'DEPRECATED']
```

### Deleted rows

Rows with `deleted = true` are **excluded** from the export. They are not in these files.

### Epistemic axis

`epistemicAxis` is the authoritative fact-status field (values: RECORDED, SETTLED, CONTESTED, OPEN, UNRESOLVABLE, REVERSED, ABANDONED). `currentStatus` is a legacy field retained for backwards compatibility — prefer `epistemicAxis`.

---

## Verification

Every file in this snapshot has a SHA-256 checksum listed in `manifest.json`. To verify:

```bash
# Install verify script dependencies
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage

# Verify a local copy
npx tsx scripts/verify-snapshot.ts --local-dir /path/to/snapshot/{{SNAPSHOT_ID}}
```

The verifier checks:
1. SHA-256 checksums for all files
2. Row counts vs. manifest
3. Referential integrity (e.g. every Edge.claimId exists in the claims file)
4. PII scan (zero email addresses or unsubscribeTokens)

---

## Schema

The canonical schema is in `prisma/schema.prisma` at migration `{{MIGRATION_ID}}`.

Key relationships:

```
Claim ──(Edge)──► Source
  │
  ├──(ClaimStatusHistory)──► trajectory of epistemic transitions
  ├──(ClaimRelation)──► other Claims
  ├──(ClaimTopic)──► Topic
  ├──(ClaimHistoricalEvent)──► HistoricalEvent
  ├──(PolityClaim)──► Polity
  └──(ClaimLocation)──► geographic coordinates

Source ──(Edge)──► Claim
  ├──(LegislativeVote) — if source is a legislative record
  ├──(WikidataLink) — Wikidata Q-number enrichment
  ├──(SourceRelationship) — relationships between sources
  └──(SourceCredibilityEvent) — credibility history
```

---

## Citation

If you use this data, please cite:

> Epistemic Receipts ({{SNAPSHOT_ID}}). Versioned snapshot export. https://epistemic-receipts.com/datasets/snapshots. Released under CC BY 4.0.

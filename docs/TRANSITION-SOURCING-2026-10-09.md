# What the curated trajectories' receipts needed — findings from claude_sourcing_v1 (2026-10-09)

The site's claim is that every status change in a curated trajectory has a receipt. This note records what an
audit-and-repair pass over those receipts found. It covers which transitions relied on Wikipedia, where the
dependence concentrates, and what happened when a model with web search was asked for the primary record of
each one. The pipeline is `scripts/source-transitions.ts` (runbook: `scripts/README-sourcing.md`).

All numbers below come from read-only queries on 2026-10-09. **Nothing here has been human-reviewed yet.**
Confidence is the model's own estimate, not a measured accuracy. The candidates sit in `TransitionSourceCandidate`
until someone accepts or rejects them.

## 1. The starting point: sourced, but often from Wikipedia

The curated set has 5,698 trajectories and 11,811 transitions. Almost all transitions already pointed at a
source: 11,808 have a `sourceId`. The brief's premise ("dated but unsourced") is true of the bulk pipelines
(1.79M of 1.82M rows), not of the curated set. The curated set's problem is the kind of source:
**5,512 transitions (47%) cite Wikipedia.** A further 6 have no usable source (missing, or a name without a
URL). Those 5,518 transitions are what needed upgrading.

### Wikipedia dependence belongs almost entirely to one seed set

| curated set | transitions | cite Wikipedia or nothing | share |
|---|---:|---:|---:|
| `seed:human-history-trajectories` | 7,453 | 5,410 | **72.6%** |
| `seed:medicine-trajectories` | 3,479 | 67 | 1.9% |
| `law-settler` | 396 | 31 | 7.8% |
| nutrition, climate, astronomy (3 sets) | 400 | 3 | <1% |
| four small legacy sets | 83 | 7 | 8% |

The medicine set was built from PubMed and FDA records. The history set was built largely from Wikipedia
articles. 98% of the transitions needing an upgrade (5,410 of 5,518) are history transitions.

### It rises with age and with "public" ratification

| era of the transition | transitions | Wikipedia or nothing |
|---|---:|---:|
| before 500 | 345 | 57% |
| 500–1499 | 677 | **83%** |
| 1500–1799 | 923 | 81% |
| 1800–1899 | 1,023 | 69% |
| 1900–1949 | 1,918 | 51% |
| 1950–1999 | 3,175 | 39% |
| 2000 on | 3,750 | 29% |

The share also varies by the community that ratified the transition:

| community | Wikipedia or nothing |
|---|---:|
| `PUBLIC` | 84% |
| `INSTITUTIONAL` | 43% |
| `EXPERT_LITERATURE` | 41% |
| `JUDICIAL` | 36% |
| `MARKET` | 36% |

At the trajectory level:
- 2,230 trajectories rest entirely on Wikipedia, or on nothing.
- 798 are mixed.
- 2,670 cite no Wikipedia at all.

## 2. What the search found

The pipeline processed 3,715 of the 5,518 transitions before the $140 budget ran out:
- a 200-transition pilot ($21.02);
- a full run of 3,515 ($138.98).

Selection order was the 6 unsourced transitions first, then a fixed pseudo-random order (md5 of the
transition id). The 3,709 others are therefore a random sample of the Wikipedia-cited set, and the rates
below should hold for the 1,803 not yet processed.

### Overall

| outcome | count |
|---|---:|
| candidate URL found | 3,666 (98.7%) |
| no source found | 49 |
| candidates the model rated ≥ 0.5 | 1,242 (34%) |
| candidates rated ≥ 0.7 | 370 |

Every stored URL was among the URLs the search tool actually returned. URLs the model named from memory
were discarded (§3). Cost was about 4¢ per transition. Haiku 5.5's answer was kept for 87% of transitions (3,240). In the full
run, Sonnet 5.5 handled the 10% where Haiku had nothing usable, and found a usable source for 309 of 354.

### Events are easier to source than consensus

| transition | n | mean confidence | ≥ 0.5 |
|---|---:|---:|---:|
| ∅ → RECORDED (the event itself) | 1,643 | 0.46 | 37% |
| CONTESTED → SETTLED | 97 | 0.50 | 50% |
| ∅ → CONTESTED | 36 | 0.48 | 47% |
| RECORDED → REVERSED | 64 | 0.46 | 36% |
| RECORDED → CONTESTED | 119 | 0.43 | 31% |
| RECORDED → SETTLED | 1,526 | 0.40 | **27%** |

A first-recorded event (a battle, a paper, a decree) usually has a document that *is* the event. Often it is
a digitised chronicle, a journal's DOI page, or a statute. A transition to SETTLED marks the moment a
community stopped disputing something, and no single document records that. The model said so in its own
words hundreds of times ("no document records a settled consensus"; "a field-consensus shift, not a single
formal event"). 962 rationales describe the best find as secondary, historiographic, or "no single primary
document".

The communities differ the same way:

| community | ≥ 0.5 | why |
|---|---:|---|
| `JUDICIAL` | 49% | rulings are documents |
| `INSTITUTIONAL` | 43% | |
| `EXPERT_LITERATURE` | 31% | |
| `PUBLIC` | 22% | public acceptance leaves no record of its own |

### The history set's "settling" dates look like placeholders

This is the most striking finding. The history set has 1,621 RECORDED→SETTLED transitions dated only to
the year:
- **401 (25%) fall on a century year**;
- 649 (40%) fall on a decade year;
- the single most common year is **2000 (232 transitions)**, followed by **1900 (133)**.

Year-precise RECORDED→SETTLED transitions in the other curated sets show nothing like this: 284
transitions, 5 on a century year. The median gap between a history claim's first record and its "settling" is 14.5 years,
against 4 years elsewhere.

The model's confidence tracks this. For RECORDED→SETTLED:

| date precision | n | ≥ 0.5 |
|---|---:|---:|
| `DAY` | 543 | 44% |
| `MONTH` | 84 | 43% |
| `YEAR` | 899 | **15%** |

Reading the rationales, many of these dates appear to stand for "by the time of the standard modern
reference work" (often a book published around 2000). They do not mark a dated event. The settling curve
plots them as if they were events. Whether that is acceptable, or whether these transitions should carry an
explicit "approximate / historiographic" marker, is an editorial question this data now makes concrete.

### Older is harder, except for antiquity

| era | ≥ 0.5 |
|---|---:|
| before 500 | 28% |
| 500–1499 | **13%** |
| 1500–1799 | 28% |
| 1800–1899 | 32% |
| 1900–1949 | 36% |
| 1950–1999 | 40% |
| 2000 on | 40% |

Medieval transitions are the hardest. Antiquity does better because its canonical texts (Herodotus, the
Han shu, inscriptions) are digitised and well indexed. Medieval chronicles are more often unedited online,
or exist only in translation (196 rationales mention a translation).

### Where the primary records live

The candidate hosts fall into these groups:

| kind of host | candidates | mean confidence |
|---|---:|---:|
| digitised primary texts and libraries (archive.org 269, Gutenberg 40, Google Books 35, ctext 34, Gallica 31, …) | 664 | 0.41 |
| government, official bodies, national archives (loc.gov 37, nobelprize.org 45, legislation sites, …) | 658 | 0.50 |
| journals and publishers (Nature 69, Cambridge 58, Springer 49, Science 41, APS 35, …) | 619 | 0.48 |
| universities and museums | 288 | 0.40 |
| reference works (Britannica, Iranica, …) | 72 | 0.31 |
| news | 42 | 0.38 |
| other / unclassified | 1,323 | 0.41 |

The host classifier is a coarse regex over host names; read the "other" row as unclassified, not as low
quality.

For the history set, the "primary source" is most often a digitised edition of the period text. That is
the eyewitness chronicle, the court record, or the decree, usually in a library scan or a translation. It
is rarely an original-language critical edition.

## 3. Things the pass surfaced that need human attention

**Stored dates that disagree with the source.** About 90 rationales flag a date conflict between the
transition and the record found; 20 mention Julian/Gregorian conversion. Examples:

| transition | stored date | what the record says |
|---|---|---|
| Te Awa Tupua (Whanganui River) Act | 15 March 2017 | royal assent was 20 March; 15 March was the third reading |
| Kahoʻolawe landing | 6 Jan 1976 | a participant's account gives 4 Jan |
| Nagashino | 28 June 1575 | the *Shinchō kōki* entry is Tenshō 3 5/21, ≈ 29 June (Julian) |
| Privy Council sati appeal | 11 July 1832 | the indexed case gives 8 October |

These are leads for curation, not corrections. The counts come from a keyword match on rationales and are
approximate.

**The anti-fabrication rule cost some recall.** 40 of the 49 "no source found" rows are cases where the
model named a URL that never appeared in its search results, so it was discarded. Several look right:
- the Smyth Report on OSTI;
- NASA's NSSDC record for the Mars 3 lander;
- the Académie's *Comptes rendus* on Gallica;
- the NYT archive report of King Abdullah's assassination.

The rule exists because model-recalled identifiers were fabricated before (AGENTS.md, Pipeline 5). Keeping
it was the right default; these 40 are worth a manual look.

**Weak excerpts.** In about 300 candidates the excerpt is catalogue metadata (title, date, publisher) rather
than a passage supporting the transition. In a few the model says the passage came from a different copy of
the text than the URL it returned. Review should check the excerpt, not just the URL.

**A wiki slipped through on purpose.** Wikisource is allowed (owner decision 2026-10-08) because it hosts
transcribed primary texts.

## 4. Method, briefly

- **Request:** one per transition. It gives the model the claim, the from→to statuses, the community, the
  date and its precision, the transition's current source, and the claim's other sources. The model must
  search, and must return either a primary document (ranked: the event's own document > publisher of record
  or archive > reputable secondary only if nothing else exists) or "no source found". Wikipedia and wikis,
  blogs and aggregators are excluded.
- **Validation:** the URL must appear among the search results the API returned; Wikipedia-family hosts are
  rejected; the excerpt is capped at 500 characters and the rationale at 300.
- **Models:** `claude-haiku-5-5` with `web_search_20250305` (at most 3 searches). `claude-sonnet-5-5` re-tries
  only transitions where Haiku had nothing usable. The pilot also re-tried answers below 0.5 confidence.
  That sent 71% to Sonnet at 10.5¢ per transition. Where Haiku had a usable but low-rated URL and Sonnet's
  answer was kept (95 cases), mean confidence rose from 0.33 to 0.51.
- **Liveness:** URL checks on the pilot's 196 candidates found 130 that load. Most of the 50 403s were
  publisher bot walls; 8 timed out; one returned 410.
- **Cost:** $160.00 for 3,715 transitions. Every request is logged in `logs/transition-sourcing-ledger.jsonl`
  (gitignored), and its total equals the table's cost sum.

## 5. Open questions this raises

1. Should SETTLED transitions with no dated event carry their own marker, instead of a year that looks
   precise? In the history set, 401 of them sit on century years.
2. Should a PUBLIC-community transition need a receipt at all, or a different kind (a survey, a monument,
   a holiday law)?
3. The 1,803 unprocessed transitions would cost about $71 at the same rate. Are they worth it before the
   SETTLED-date question is answered? 419 of them (23%) are year-precise SETTLED transitions, where the
   pass rarely finds a strong source.

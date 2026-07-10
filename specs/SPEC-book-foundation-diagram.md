# SPEC — Book Foundation Diagram (V2 flagship)

*One page. One book. One image that carries the site. Gated behind V1 (settling-curve flagship + DOI dataset + methods/corrections page) — the diagram's arcs are only as credible as the status substrate beneath them.*

## Thesis
A nonfiction book is a frozen snapshot of a live graph: confident sentences resting on a citation layer that kept moving after publication. This page renders one book as Harrison's Bible arc-diagram **plus the dimension Harrison didn't have — time and status**. Arcs that can die. The reader sees, in one image, what the book rests on *today*.

## The image
- Book's spine as the horizontal axis: chapters as segments, proportional to length.
- Arcs rise from the passage where a claim is made to the source it rests on. Sources arrayed above; **bedrock layer** (primary documents) below the spine — a book claim may arc UP to a secondary/journal source which arcs DOWN to bedrock.
- Arc color = current `epistemicAxis` of the target claim: emerald SETTLED, amber CONTESTED, red REVERSED, stone ABANDONED, blue OPEN, slate RECORDED. Arc weight = how load-bearing (how many of the chapter's claims route through it).
- The money-shot property: a mostly-emerald book with one chapter bleeding red is legible from a thumbnail. Design for the screenshot first, the interaction second.

## Hover / click
Hover an arc: claim text (book side), source citation (target side), status badge, and the one-line transition reason with date ("Retracted 2017 — failed replication, N=…"). Click: the target claim's full settling-curve page. The diagram is a front door into the corpus, not a dead end.

## Caption (draft — the part strangers read)
"Every arc is a claim this book rests on, colored by its status **today**. [Book] was published in [year]; its foundations kept moving. Sources and methods: [link]. Statuses update as the record does — this figure was generated on [date] and will look different in ten years. That's the point."

## Demo book #1: *Thinking, Fast and Slow* (Kahneman, 2011)
Why: canonical, beloved, and its priming chapter famously rests on literature that collapsed in the replication crisis — conceded by Kahneman publicly. Bedrock layer = journal articles via the existing OpenAlex⇄retraction join. The operator is a cognitive psychologist: domain authority for the hand-verification this image demands.

## Demo book #2 (later, proves generality): one Cold War history
Same instrument, different bedrock: arcs terminate in **NARA records** (RG 263 CIA / RG 59 State / RG 128 Church Committee — already ingested). This is what the NARA catalogs are *for* in the product: the primary-source ground floor under historical claims. Do NOT build #2 until #1 has shipped and survived scrutiny.

## Data pipeline (already in schema — assist, don't automate)
`Book → BookChunk → BookClaim → BookClaimMatch` for text→corpus matching; `ClaimRelation` (CITES / SUPERSEDED_BY / REVERSED) for the arcs; `ClaimStatusHistory` + the now-stamped `epistemicAxis` for color. The v1 book-section grind came from treating matching as automation; here the pipeline is the ASSISTANT: it proposes matches, the human ratifies every arc. Budget: ~150–300 verified arcs for book #1. Every arc in the shipped image is human-verified — this figure will be reviewed like a paper, because it is one.

## Verification protocol (non-negotiable)
1. Every arc's target claim, status, and transition date checked by hand against the primary record.
2. Every RED arc double-checked — the red arcs are the story AND the attack surface.
3. A visible "report an arc" link; corrections land on the public corrections page. The diagram performs the site's thesis by being correctable in public.
4. Freeze a dated snapshot (figure + CSV of arcs) on Zenodo alongside the V1 dataset — citable, versioned.

## Scope fences
- ONE book, hand-verified. No general ingestion UI, no "upload your book," no book #2, until #1 has been public for a month and survived.
- No verdicts on the BOOK ("Kahneman was wrong" appears nowhere) — the diagram reports the status of foundations, with dates. The restraint IS the credibility.
- Static SVG + hover first; fancy interaction only if the static image already works as a thumbnail.

## Success criteria
The image circulates without its caption and still makes sense. At least one academic cites or teaches with it. The "report an arc" link produces its first public correction — and that correction gets celebrated, not buried.

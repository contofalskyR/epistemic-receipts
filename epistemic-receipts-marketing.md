# Epistemic Receipts — Marketing Strategy

*Draft 2026-07-04. Companion to briefings 04 (machine-readability) and 05 (integrity fixes) — several mechanics below depend on them.*

## What we're selling

Not a database, and not outcomes. An identity: **the person who checks the receipt.** Intellectual hygiene as a practice — like the person who reads the label, keeps their sources, cites the primary. "Show me the receipts" is already how the culture talks about proof; the product gives that phrase an instrument.

What we are explicitly NOT selling: life outcomes. No "informed people are healthier/wealthier/more successful." Those are unverifiable causal claims — the exact genre this site audits. Our own corpus contains the FTC's settlement against Lumosity for marketing cognition as a lifestyle benefit it couldn't substantiate. We do not run the play our receipts document as a failure mode. The restraint IS the brand: in a landscape of overclaim, understatement reads as confidence.

## The one rule (everything else follows from it)

**Marketing carries its own receipts.** Every number on a marketing surface is derived live from the database, never hand-written. Every date matches the canonical receipt it comes from. Every content claim links to its curve. If a stat can't be derived, it doesn't ship.

This is a constraint that doubles as the differentiator: no other brand's advertising can footnote itself. A promoted post whose every figure resolves to a receipt is itself a demonstration of the product.

Corollary: before any campaign, the copy gets the same audit the site gets. A skeptic screenshotting a marketing claim that contradicts our own receipt is the single cheapest way to lose the asset we're spending.

## Brand voice

An instrument, not an influencer. Confident minimalism — the aesthetic of a seismograph, not a supplement ad. We describe what the record shows; we never perform certainty the record doesn't contain. House vocabulary: status, not truth ("this claim's status," never "the truth about X"); settled/contested/reversed as documented events; "the receipt" as the unit of everything.

## Front page

The highest-leverage single surface (see HOMEPAGE-REDESIGN-PLAN.md for mechanics; this sets the brief):

1. **One full-bleed interactive settling curve** as the hero — semaglutide (25-year arc: 1996 first evidence → 2017 FDA approval → post-market) or the hot-hand double reversal (a debunking, debunked — the shape only this product can draw). The curve, not the interface, is the hero.
2. **One line:** "Facts have histories. We keep the receipts."
3. **A live counter** — transitions recorded, derived from the DB (per the one rule; the hardcoded "5,000+" dies with briefing 05).
4. **CTA: a single receipt**, beautifully rendered — the first impression should be what a receipt *feels* like, not what the corpus contains. Scale (1.7M+ claims, live-derived) appears below as a trust signal, never as the hook.

## The flywheel

**1. Shareable receipt cards** (the growth mechanic — depends on briefing 04's OG/share work).
Every claim page emits a card: claim text, the mini-curve, dated transitions, source count, URL. Dropped in a group chat, a QT, a lecture slide — each one is an ad that happens to be evidence. Make the share button the most polished element on the page. Card copy is generated from the receipt itself, so it can't drift from the record.

**2. Embeddable status badges.**
A live badge — `[SETTLED since 2017 · 6 transitions]` — that academics, bloggers, and journalists pin next to a citation, like DOI badges. Distribution through the pages of exactly the people whose endorsement matters, and it flatters their rigor rather than ours.

**3. "This week in settling" — the habit product.**
A short weekly digest of claims whose status moved: new contestations, fresh reversals, curves that finally settled, corrections we published about ourselves. Status changes are our native recurring event; a lifestyle is a recurrence, not a slogan. Also the natural home for openalex-promoter and quiet-reversal output as it lands.

## Content pillars

1. **The receipt on [what's circulating]** — when a claim trends, publish its curve. Speed matters; tone stays flat ("here is the documented history"), especially on politically hot topics — the receipt does the arguing.
2. **Settling-speed stories** — "how long does a contested finding take to settle?" Only after we derive it from our own transition data (the survival-analysis work the corpus now supports). Our meta-science content must be our own receipts, not vibes.
3. **The corrections log as content.** /corrections — the USPTO retirement, honestly documented — is the most persuasive page on the site. "We got this wrong, here's the audit trail" posts are the highest-credibility marketing we can produce, and nobody can copy them without earning them.

## Audience, in order

Start with a tribe that already lives this identity and shares aggressively:

1. Researchers, PhD students, science journalists — the retraction curves and export formats (BibTeX/RIS) are built for them.
2. Evidence-based-medicine and meta-science communities — the replication-crisis natives.
3. Rationalist-adjacent readers (LessWrong, ACX orbit) — high shares-per-reader.
4. Policy analysts and fact-checkers.

Mainstream later, through their shares — the receipt cards are the bridge.

## Channels

- **Skeptic/science podcast sponsorships** — the Ground News playbook, aimed at hosts whose audiences already perform epistemic care. Read copy follows the one rule (derived numbers only).
- **Show HN** — the settling-curve visualization is the demo; engineers share instruments.
- **Journalists** — pitch the retraction story (26k+ retraction curves; publication→retraction spans) and, later, the first human-reviewed quiet reversals: findings that died without anyone writing an obituary — until now.
- **Academia** — badges + the export formats + (separately) the cog-sci instrument (PITCH-COGSCI-SETTLING-CURVES.md).

## Taglines (all promise-free by design)

- "Facts have histories. We keep the receipts." (primary)
- "Check the receipt." (the verb; buttons, cards, stickers)
- "How humanity changes its mind, dated and sourced."
- "Settled, contested, reversed — with receipts."

## What NOT to do

- No health/wealth/success outcome claims, ever (see Lumosity, in our own corpus).
- No truth-authority posture ("what's actually true," "how confident you should be") — the product measures documented status, not truth; the marketing may not overclaim what the schema itself refuses to.
- No hand-written statistics anywhere, including this file: figures above marked "live-derived" are placeholders until wired.
- No defensive anti-misinformation framing — we're not against anything; we're the instrument that outlasts the argument.
- No launch before briefings 04+05: share cards need real OG metadata; counters need derived stats; the paper's own footnote claims must be curated first.

## Sequencing

1. Briefing 04 ships → share cards + sitemap + crawlability (free distribution).
2. Briefing 05 ships → live counters, /corrections in nav, cited claims curated.
3. Front-page redesign per the brief above.
4. Quiet index-and-measure week (Search Console, OG validators, load check on Neon).
5. White paper published → Show HN → journalist pitches → podcast tests.
6. "This week in settling" launches once there's a month of visible status motion.

## Measurement

Shares per receipt card; badge embeds (referring domains); digest subscribers and open-rate; return-visitor rate on claim pages; branded search for "epistemic receipts" / "check the receipt." Vanity metric to ignore: raw pageviews on the homepage.

## Open questions

- Card aesthetics: one house style, or per-domain (medicine/law/science) variants?
- Badge tech: SVG endpoint vs. script embed (SVG is safer and cache-friendly; decide in 04's orbit).
- Digest authorship: automated from transitions with a human edit pass — who edits?
- Paid spend at all in year one, or purely organic until the flywheel shows shares-per-card data?

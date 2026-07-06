# Facts Have Histories. The Internet Pretends They Don't.

*A fact is not a verdict handed down once — it's a chain of receipts accumulating over time. I built a knowledge graph of 1.6 million claims to make those chains visible. This is the proposal.*

---

Sometime in 2023, Ozempic arrived in your feed as a new thing: a revolutionary weight-loss drug, a celebrity shortcut, a shortage, a discourse. It arrived, in other words, as a single event.

Here is what the record actually shows. In 1996, a paper in *Nature* reported that a gut hormone signal reduced feeding in mice. In 2001, a follow-up showed lasting weight loss in rats. In 2010, the first human trial of semaglutide was registered. In 2017, the FDA approved it for type 2 diabetes. In 2021, the FDA approved it for chronic weight management. Five receipts, thirty years, one continuous claim — and it entered most people's field of view as a single flattened moment: *novel weight-loss drug*.

Nothing — no fact, verdict, or belief — enters the written record as a singular event. A drug approval, a court ruling, a scientific consensus, a nuclear test: each has a history of claims that preceded it and a future of investigation that will confirm, revise, or overturn it. The moment of consensus is not the end of the story. It's a snapshot of an ongoing one.

The internet stores facts as points. But facts are trajectories.

## The trajectory is not the attitude

Everyone knows smoking causes cancer. But look at the fact-record of that claim and you find a process, not a yes/no binary. The U.S. Surgeon General publicly declared that smoking causes cancer in 1964. Studies associating smoking with lung cancer date back to the 1930s. Why a three-decade gap between the expert literature and the institutional declaration?

The common answer — Big Tobacco suppressed it — is true but shallow. The knowledge was *out there*. Doctors could see that their lung-cancer patients were disproportionately heavy smokers; every one of those patients was an individual information-trajectory of the claim. Whether that knowledge was suppressed, ignored, or empirically validated — those are human *attitudes* toward the information, not the information itself.

This distinction is the whole argument. If a claim's trajectory exists independently of the attitudes taken toward it, then access to the trajectory — not access to a verdict — is what determines who can act on knowledge and who is left reacting to someone else's summary of it.

That is not a repudiation of expert consensus; it's the opposite. Barry Marshall's 1984 self-experiment — he drank a culture of *H. pylori* to prove it caused gastritis — was a single-patient case study, the weakest genre of evidence. Within a year it had secured funding for the randomized controlled trial confirming antibiotics cured peptic ulcers, and eventually a Nobel Prize. The hierarchy of evidence didn't erase that record; it was layered onto it, one receipt at a time. Dated, sourced: what was known, by whom, and how confidently, at that exact moment.

## The curious person in the bookstore

There is too much information — that's not controversial. Less noticed: there are too many information *tools*. Want to learn about the Vietnam War? Wikipedia, or one of 30,000 books, or a documentary (YouTube? PBS? History Channel? good luck), a university course, an AI (which model?). All of these are valid. None of them are equal. And nothing organizes them — the burden lands entirely on the curious person to figure out what's inside the book before they've read it, and to commit or abandon half-blind.

Epistemic Receipts does not solve that problem, and no framework reasonably could. It doesn't tell you which book to buy. What it does is orthogonal to format entirely: it tells you where the *underlying claims* stand, independent of which source delivers them. Whichever Vietnam book you pick up contains hundreds of individual claims — some settled across the historical record, some one historian's contested interpretation, some unresolved — and the book itself may never say which is which. The curious person doesn't need a better book. They need a way to check the claims underneath any book against the dated record.

## What I built

Epistemic Receipts ([epistemic-receipts.vercel.app](https://epistemic-receipts.vercel.app)) is a working version of this. As of July 2026 it holds just over 1.6 million claims from 174 distinct sources across seven categories: national parliaments and legislation, science and medicine, US federal records (declassified archives, congressional roll-calls back to 1789), courts, international organizations, pharmaceutical regulation, historical collections. Every claim traces to a fetchable primary source.

The unit of the site is the **settling curve**: a claim's dated, sourced transitions through statuses like RECORDED, SETTLED, CONTESTED, REVERSED — each transition ratified by a specific community (the expert literature, an institution, a court, the public, a market), because "settled" means nothing until you say settled *by whom*. The semaglutide page draws the whole 1996→2021 arc with the primary documents one click away — the *Nature* paper, the trial registration, the FDA approval letters — no news agency in the middle deciding which part of the story you get.

Two principles keep it honest. **Status, not truth:** the system records what the documentary record shows communities concluded, never the curator's own verdict on reality. **No document, no transition:** a claim's status changes only when something dated and citable changed it. "Everyone knows that finding is dead" is not a receipt until a review, a replication, or a retraction notice wrote it down.

The same logic applies to a claim's death as to its birth. The site's retraction explorer tracks over 26,600 papers formally withdrawn via CrossRef and traces their *citation half-life* — how long, and how often, a paper kept being cited after the scientific community said "this was wrong." The answer, distressingly often, is: for years.

## The honest state of it

Most of those 1.6 million claims are reference scaffolding — bulk-imported, machine-ingested, structurally sound, but not curated into a receipt-by-receipt narrative. The case studies that actually demonstrate this essay's argument — semaglutide, Korematsu, the tobacco record, Pluto's reclassification — took deliberate construction, one trajectory at a time, and they number in the thousands, not the millions.

That imbalance is worth stating plainly rather than glossing over. But it is also the point. A chain of receipts cannot be produced by summarizing a topic faster. It has to be assembled from the actual dated record — which is slower, and more defensible, than a verdict, for exactly the same reason.

The restraint runs deep in the design. An enacted law is *born settled* — its curve is one honest point, and inventing an arc for it would be fabrication. And when an early pipeline was caught fabricating — patent records built from an AI model's memory instead of the registry, one carrying a real patent number with the title and inventors of a different patent entirely — all 182 records were retired and the failure written up on a public corrections page, in the same format the site uses for everyone else's errors. A project whose entire pitch is provenance has one asset: applying its own audit standard to itself first.

## Where this goes

The near-term ceiling is not more data; it's more receipts per claim. Semi-automated trajectory construction, where the existing bulk layer (citation graphs, retraction links, trial registrations) auto-drafts candidate trajectories and a human curator confirms rather than assembles from scratch. Reversal-tracking beyond retraction — because most scientific reversal is quieter than a retraction notice: a finding just stops being cited, or a meta-analysis contradicts it and nobody issues a correction. And cross-domain linking, so a reader can check not just "is this claim settled" but *"is the thing this ruling was built on still standing?"*

Longer term, the more interesting user is not a person browsing the site but other tools querying it — an AI assistant or search engine that, instead of returning a flattened answer, cites a claim's actual current status and lets you see the receipt. Less a destination, more an infrastructure layer other systems check against before stating something as settled.

## The oldest habit in scholarship

None of this is a new idea, and I want to be clear about the lineage. The footnote, the bibliography, the marginal gloss on a medieval manuscript, the Talmudic page with commentary layered around commentary across centuries of disagreement — these are all receipt systems, built by hand, long before the word "database" existed. What has changed is not the impulse but the scale: a citation apparatus that once lived in a single scholar's footnotes, checkable only by someone with access to the same library, can now be built once and checked by anyone, instantly, across a million claims.

My own inspirations are on the table too. Steven Pinker's work on common knowledge — the idea that consensus takes time and is socially ratified, not just discovered. OSINT tools like flight and ship trackers, whose power is precisely their neutrality: a receipt of what is happening, not an opinion about it. Ground News, which showed me how wide the range of reporting on a single fact can be. And a standing frustration with news cycles that never follow through — that cover the moment a story breaks and leave its trajectory to rot.

## Check the receipt

The stakes are not about any one drug, ruling, or retracted paper. They are about whether a person encountering a claim for the first time — in a headline, a doctor's office, a search result — has any way to tell where that claim sits on its own timeline, or whether they're stuck taking someone else's word for it.

Scholarship has always known that a fact is not the end of an inquiry but a position in one. I'm trying to make that position visible to anyone who asks — not just the small number of people trained to go looking for it.

Facts have histories. We keep the receipts.

---

*Epistemic Receipts is at [epistemic-receipts.vercel.app](https://epistemic-receipts.vercel.app). Figures as of July 2026. A companion post covers the technical design — the schema, the bulk promotion waves, and what it takes to keep a language model from inventing history.*

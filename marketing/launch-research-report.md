# Epistemic Receipts: Launch Research Report
**Prepared:** July 8, 2026 | **Scope:** Audiences, channels, positioning, 30/60/90-day plan, funding, adversarial review

---

## 1. Executive Summary

Epistemic Receipts is a genuine category-first product — a dated, sourced record of how knowledge changes — with no direct comparable. That novelty is both its strongest asset and its greatest risk. There is no existing community that calls itself "settling curve users." The launch challenge is not finding the product's niche; it is successfully translating the product into language that maps onto existing communities' self-described needs before those communities dismiss it as a curiosity they don't know how to use.

The three highest-leverage bets based on this research, ranked by probability of producing measurable first-user cohorts quickly:

1. **AI/LLM builders** via MCP registries and AI-developer communities — this is the fastest path to power users who will stress-test the API and generate word-of-mouth in developer channels, where the product's technical distinctiveness matters most.
2. **Meta-science/scientometrics researchers** via the Metascience Alliance community and Bluesky's academic cluster — this audience's whole professional project is exactly what the settling curve formalizes; they will recognize it on contact.
3. **Data journalists and OSINT investigators** via GIJN's toolbox, NICAR tipsheets, and Bellingcat Discord — an audience already conditioned to adopt reference databases and already organized around tool discovery.

The three honest structural constraints that determine sequencing: (a) no custom domain yet is a credibility tax on every channel; fix this before launching publicly; (b) 5,596 rich narratives out of 1.75M claims means the product demo must be built around the best reversal arcs, not the bulk scaffolding; (c) solo founder bandwidth means channels that require sustained content creation (YouTube, Twitter, Reddit) are liabilities unless the content itself is the demo — the reversal arc as a thread or essay rather than a campaign.

Funding reality: at this stage and scale, Sloan (Public Understanding of Science) and Knight (journalism tech challenges) are the most plausible near-term paths; NSF and Mellon require institutional affiliation the project currently lacks.

---

## 2. Ranked Audiences

### Tier 1: Highest Expected Return (move on these immediately)

---

#### Rank 1: AI/LLM Builders and MCP Ecosystem
**Evidence of demand:** The MCP ecosystem reached 97 million monthly SDK downloads by mid-2026, with 10,000+ servers indexed across public registries. ([RoxyAPI MCP Registries 2026](https://roxyapi.com/blogs/mcp-registries-where-to-list-your-server)). The GitHub MCP Registry launched in September 2025 as the official backstop. ([GitHub Changelog](https://github.blog/changelog/2025-09-16-github-mcp-registry-the-fastest-way-to-discover-ai-tools/)). A growing research and practitioner literature documents the need for AI systems to track knowledge status — LLMs need to "know what they don't know," and agentic workflows that cost 5–25x more per query ([arxiv.org](https://arxiv.org/pdf/2506.01114)) are driving demand for uncertainty quantification tools. A 2025 arxiv paper explicitly addresses "AI-Assisted Engineering Should Track the Epistemic Status and Temporal Validity of Architectural Decisions." ([arxiv.org/2601.21116](https://arxiv.org/html/2601.21116))

**What they currently use:** LLM grounding stacks (RAG, structured retrieval, Wikidata SPARQL, internal knowledge graphs). There is no publicly-available, structured, citable database of claim-status transitions with primary source citations that AI systems can query.

**Where they congregate:** GitHub (pull request communities on MCP repos), Hacker News (Show HN and Ask HN), X/Bluesky AI communities, Cursor/Claude Discord servers, the punkpeye/awesome-mcp-servers list ([GitHub](https://github.com/punkpeye/awesome-mcp-servers)).

**Adopt signals:** The MCP server is usable immediately; that's the demo. An AI agent that can query "what is the current epistemic status of claim X and when did it change?" is a concrete capability. Developer communities adopt tools that solve a specific workflow problem; the claim-status retrieval use case is clearly articulable.

**Reject signals:** If the API has rate-limit issues, inconsistent schema, or the MCP server is poorly documented, developers will silently stop using it. Developer communities do not give second chances. [INFERENCE]: The project's "refusal ledger" (186,581 claims with no source-backed date) may actually be a positive differentiator here — it signals that the database is epistemically honest rather than hallucination-padded.

---

#### Rank 2: Meta-Science / Scientometrics Researchers
**Evidence of demand:** The Metascience Alliance launched July 8, 2025 (the day of this report's preparation), announced in *Nature*, with 25+ funders and 830 participants from 65 countries. ([Nature editorial](https://metascience.info/)). The Metascience 2025 conference (UCL, June–July 2025) had 650 speakers. The ISSI 2025 conference (Yerevan, June 23–27, 2025) is the 20th in its series. ([ISSI Society](https://www.issi-society.org/conferences/)) The retraction data (26,595 claims, now also indexed in the Crossref API) and reversal arcs (Roe, Chevron, 75 retracted exoplanets) are directly citable in metascience work.

**What they currently use:** OpenAlex (launched January 2022, now endorsed by Sorbonne University as a Web of Science replacement), Retraction Watch database (acquired by Crossref September 2023, now open via Crossref API, [Crossref blog](https://www.crossref.org/blog/news-crossref-and-retraction-watch)), Elicit (400,000 monthly users as of early 2025, [TechCrunch](https://techcrunch.com/2023/09/25/elicit-is-building-a-tool-to-automate-scientific-literature-review/)), Connected Papers (200,000 users in first month after June 2020 launch, [Medium](https://medium.com/connectedpapers/connected-papers-post-launch-community-update-64d952423d56)).

**Where they congregate:** Bluesky academic cluster (18% of academics identified in a study transitioned to Bluesky after November 2024; Medicine 25.6% of posts; [Science/AAAS](https://www.science.org/content/article/old-twitter-scientific-community-finds-new-home-bluesky)); Wikidata Workshop (annual, AI/LLM focus added 2025); preprint servers (arXiv cs.DL, SocArXiv for social sciences); the Metascience community listservs; METRICS International Forum at Stanford.

**Adopt signals:** Researchers who study how scientific consensus forms and breaks would use the settling curve as a citation or even as a dataset itself. The "suppression and amplification" records are directly analogous to p-hacking or data manipulation studies that metascience researchers already publish on.

**Reject signals:** If the bulk data is not cleanly exportable (the CSV/BibTeX/RIS exports exist — make them prominent), researchers will cite the product but not build on it. Researchers who need to cite claims will want Crossref-indexed DOIs or stable permalinks.

---

#### Rank 3: Data Journalists and Fact-Checkers
**Evidence of demand:** GIJN has 2,000+ resources in 14 languages and hosts the Sigma Awards for data journalism; NICAR 2025 (Minneapolis) had 900+ attendees from 7 countries. ([NICAR](https://www.ire.org/25-things-we-learned-at-nicar25/)). NICAR 2026 (Indianapolis, March 5–8) includes a session on "Coding agents for data analysis." ([IRE](https://www.ire.org/training/conferences/nicar-2026/)). The FactStream app's shutdown in December 2024 after 56,000+ downloads — due to lack of resources, not lack of demand — signals that the constituency exists but is poorly served. ([Duke Reporters' Lab](https://centers-dewitt.sanford.duke.edu/reporterslab/2024/12/03/reporters-lab-discontinues-factstream-app/))

**What they currently use:** ClaimBuster (UT Arlington, claim-scoring for priority checking), InVID Fake News Debunker (video verification), Bellingcat toolkit (OSINT), Google Dataset Search, PACER for court documents, CourtListener. The critical gap: journalists have tools for *finding* claims and *checking* specific claims, but no structured database for tracking how a claim's status evolved over time with primary sources.

**Where they congregate:** GIJN network (member organizations in 90+ countries), NICAR listserv and Slack, IRE (Investigative Reporters and Editors), Bellingcat Discord, SPJ Journalist's Toolbox (has a "Suggest resource" link), r/journalism, Bluesky fact-checker starter packs (41+ lists, [blueskystarterpack.com](https://blueskystarterpack.com/fact-checkers)).

**Adopt signals:** A journalist covering a legal decision reversal (Chevron, Roe) or a scientific retraction cascade who can pull the entire timeline with primary sources in one query has a demonstrable workflow win.

**Reject signals:** Journalists' primary fact-checking need is speed. The product is most useful for deep investigative pieces and background research, not breaking news. The absence of a real-time update layer (this is a reference database, not a live feed) limits utility for daily journalism. Journalists also overwhelmingly use free tools; even $9/month creates friction.

---

### Tier 2: Strong but Requires More Targeted Approach

---

#### Rank 4: OSINT / Verification Community
**Evidence of demand:** Bellingcat's toolkit is continuously updated by a volunteer community via Discord ([Bellingcat Discord](https://bellingcat.gitbook.io/toolkit)). The 2025 OSINT Resource List documents active community curation of new tools ([denniskeefe.me](https://denniskeefe.me/2025-osint-resource-list/)). r/OSINT has 241,000 members and lists "tools" as a top discussion topic.

**What they currently use:** Bellingcat toolkit, OSINT Combine, ShadowDragon, Maltego. For historical record verification: Internet Archive Wayback Machine, newspaper databases, government document repositories.

**Adopt signals:** "Suppression & Amplification" records (the tobacco industry's doubt memo, Korematsu withheld brief) map directly onto OSINT research into information manipulation. A tool that documents documented suppression events is inherently useful to open-source investigators.

**Reject signals:** OSINT investigators focus on individuals, organizations, and current events. A historical knowledge-status database is more useful as background research than as a primary investigation tool. The community may see this as useful but not core to their workflow.

---

#### Rank 5: Law Librarians and Legal Tech
**Evidence of demand:** 94.5% of firm/corporate law librarians are involved with recommending technology products for purchase; 100% are involved in negotiating database contracts. ([AALL State of the Profession 2023](https://www.lawnext.com/2023/05/law-librarians-play-central-role-in-legal-tech-adoption-and-use-aall-state-of-the-profession-report-shows.html)). Law librarians are the gatekeepers, not just users — getting one or two law librarians enthusiastic is a path to institutional adoption.

**What they currently use:** Westlaw, LexisNexis, CourtListener (Free Law Project), Bloomberg Law. For legislative history: Congress.gov, PACER.

**Adopt signals:** Legal reversal arcs (Chevron → Loper Bright, Roe → Dobbs) with full primary-source chains are precisely the kind of legislative history and precedent tracking that law librarians build research guides around. The 86 national statute registries are a differentiated asset.

**Reject signals:** Law librarians operate under tight institutional procurement cycles (quarterly reviews, annual budget decisions). Free-tier access matters enormously for initial evaluation. The existing CourtListener/PACER integration already covers US case law; the product's differentiation is the global statutory coverage and the epistemic status layer, which requires a longer elevator pitch.

---

#### Rank 6: The Rationalist / Epistemics Essay-Reading Public
**Evidence of demand:** Astral Codex Ten (Scott Alexander's Substack) drives the 2025 Metaculus forecasting series that attracted 3,000+ participants as its fastest-growing collection. ([Metaculus](https://www.metaculus.com/)). LessWrong has an active community using "epistemic status" headers in posts as a cultural norm — they already have the vocabulary.

**Where they congregate:** LessWrong.com, Astral Codex Ten (Substack), Gwern.net, Dynomight.net, Works in Progress magazine (accepts submissions; covers scientific progress; ([Works in Progress submissions](https://worksinprogress.co/issue/how-to-write-for-works-in-progress/))). The Gwern recommendations list is an active curation signal in this community.

**Adopt signals:** The rationalist community invented the "epistemic status" post header. The settling curve is a formalization of an informal practice they already do. A well-written essay in this community's idiom about a single reversal arc would circulate organically.

**Reject signals:** This community is large in cultural influence but small in absolute numbers. They are essay-readers, not daily database users. Conversion to returning users after an initial essay spike requires a hook that brings them back (alerts on claims they care about, an API they can play with). [INFERENCE]: LessWrong readers are likely power users of the export/API functionality, but unlikely to return to browse the site daily.

---

#### Rank 7: Wikipedia / Wikidata Editors
**Evidence of demand:** The Wikipedia Library connects editors to databases (500+ edits required for access). ([Wikipedia Library](https://en.wikipedia.org/wiki/Wikipedia:The_Wikipedia_Library/Databases)). Wikidata Workshop 2025 expanded focus to AI/LLM intersection. ([Wikidata Workshop](https://wikidataworkshop.github.io/2025/)). The Wikidata development plan 2025–2028 emphasizes sustainable community and external data partnerships.

**What they currently use:** Wikidata SPARQL, Wikipedia's {{find sources}} template, VIAF, JSTOR (via Wikipedia Library), Internet Archive.

**Adopt signals:** Wikidata already tracks "qualifier" information on statements (point in time, source, etc.). The settling curve data is structurally compatible with Wikidata's data model. A formal data partnership or data import could be a multiplier — getting epistemic receipt data into Wikidata would expose it to millions of downstream consumers.

**Reject signals:** This audience discovers tools through Wikipedia Library's formal database program, not through general discovery channels. Getting into the Wikipedia Library requires a formal proposal and institutional credibility. [INFERENCE]: The correct play here is not targeting Wikidata editors as users; it is proposing a data export or linking arrangement with Wikidata itself, which would happen after the first year.

---

#### Rank 8: Educators (Epistemology, Media Literacy, History of Science)
**Evidence of demand:** NY State issued a Media Literacy Toolkit in January 2025; California, Washington have active media literacy programs. The field is invested in epistemological frameworks.

**Where they congregate:** ACRL (academic librarians, not K-12), National Association for Media Literacy Education (NAMLE), Curriculum & Instruction programs.

**Reject signals:** Education adoption cycles are 2–5 years for any new tool. K-12 adoption requires state or district approval processes. Higher-ed adoption requires faculty champions. This is a Year 2+ audience, not a launch cohort.

---

### Missed Segment Worth Adding: Science Communicators and Science Journalists
**Evidence of demand:** A July 2025 Nature article documented a surge of scientists and science writers to Bluesky ("Science content on Bluesky attracts more engagement and originality than on X," [Chemistry World](https://www.chemistryworld.com/news/science-content-on-bluesky-attracts-more-engagement-and-originality-than-on-x/4022084.article)). These writers regularly cover "science that turned out to be wrong" — retractions, reversals, the replication crisis — and frequently lack a structured data source for the historical record.

**Adopt signals:** A science writer covering the Roe reversal, the Chevron overrule, or CRISPR's contested early IP claims has a concrete reference need. The product demo should include 3–5 "narrative reversal arcs" in formats that can be embedded in articles.

---

## 3. Channel-by-Channel Verdicts

### Show HN (Hacker News)
**Verdict: High potential, narrow window, not a solo play.**

The HN audience is well-matched for this product: technically sophisticated, interested in data infrastructure, skeptical of hype. Reaching the front page requires 30–50 upvotes in the first hour ([markepear.dev](https://www.markepear.dev/blog/dev-tool-hacker-news-launch)), which means coordinating a first-wave of genuine engaged users before launch — not via vote manipulation (which HN detects), but by seeding the community with developers who've already used the MCP server or API.

**What works for data projects on HN:** Plain, honest technical description. The project has two genuinely HN-resonant facts: (a) 1.75 million claims, 1.8 million transition rows, from 185 sources including NARA declassified records and 86 national statute registries; and (b) a public "refusal ledger" of 186,581 claims with no source-backed date. HN loves epistemic honesty, and the refusal ledger is a differentiator against hallucination-padded competitors. The fabricated-patent pipeline retirement, documented publicly on a corrections page, is also HN-resonant — this community loves projects that audit themselves.

**Title pattern that works:** `Show HN: Epistemic Receipts – 1.75M dated, sourced claim-status transitions across US law, science, and 86 national statute registries`

**What to avoid:** Do not use "Wikipedia for X" framing in the HN title. Do not use "AI" as a selling point — HN is currently (mid-2026) skeptical of AI-wrapper products. The MCP server is worth mentioning in the thread, not the title.

**Timing:** Post Tuesday–Thursday, 7–9am US Eastern. Avoid Fridays and weekends.

**Effort:** Medium. The preparation work (writing the comment that explains the product clearly, having 8–10 genuine users ready to upvote and comment) is the actual work. The post itself takes 10 minutes.

---

### Substack / Essay Launch
**Verdict: Best channel for the rationalist and meta-science audiences; requires genuine writing investment, not marketing copy.**

The science-on-Substack wave is real — Nature documented it in July 2025. Works in Progress magazine explicitly accepts submissions covering how scientific knowledge evolves and accepts journalism about breakthroughs ([Works in Progress](https://worksinprogress.co/issue/how-to-write-for-works-in-progress/)). The Marginalia Science newsletter features guest editors. The AI Evaluation Digest covers epistemic topics.

**What works:** A 2,000–4,000 word essay on a single reversal arc (Roe → Dobbs, Chevron → Loper Bright, or the exoplanet retraction cascade) that uses the product's own data as the primary source. The essay demonstrates the product by being the product. This is Retraction Watch's original 2010 strategy — blog posts about interesting cases, not marketing posts about the database.

**Specific targets for guest essays or links:**
- Works in Progress (accepts pitches; covers "speed of science" and "real peer review" — the settling curve fits)
- Gwern's newsletter recommendations (Gwern linked to Dynomight; Gwern's ecosystem endorsement is a force multiplier in the rationalist community)
- Marginalia Science (explicitly runs guest editors)
- The Gradient (covers epistemological topics in AI; editor@thegradient.pub)

**Effort:** High. A good essay takes 10–20 hours including research, drafting, revision. AI agents can assist with the structural research but the voice must be human and specific. [INFERENCE]: The whitepaper draft and two Substack drafts mentioned in the brief are the right starting point; completing and publishing one of them before the Show HN launch provides a canonical "long read" to link to.

---

### YouTube
**Verdict: Not a solo-founder priority; potential collaboration play that needs validating.**

The video-essay ecosystem covering "how we know what we know" (Veritasium, Kurzgesagt, 3Blue1Brown, minutephysics at 6M subscribers) is large. However:

1. These channels take months to years to build; they are not launch channels.
2. Collaboration with existing channels requires that the channel see a story for their audience, not for the product. The correct approach is pitching a *story* (e.g., "75 exoplanets that turned out not to exist — and the database that tracked them disappearing") rather than pitching the product.
3. The ROI of *reaching out to two or three channels with a specific reversal arc story* is potentially very high for zero production cost. The ROI of building your own channel is low unless the founder already has video skills.

**Assumption flagged for validation:** Does the founder have any existing relationship with science communicators? If not, cold pitching channels with 1M+ subscribers is a low-probability play. Start with smaller channels (50k–200k subscribers) in the metascience/epistemics niche.

---

### X and Bluesky Academic Communities
**Verdict: Bluesky is now the correct primary social platform; X is secondary.**

18% of academics migrated to Bluesky after November 2024; science content on Bluesky gets more engagement and originality than X ([Chemistry World](https://www.chemistryworld.com/news/science-content-on-bluesky-attracts-more-engagement-and-originality-than-on-x/4022084.article)). There are 41+ fact-checker starter packs, 56+ historian starter packs, and 230+ academic starter packs on Bluesky ([blueskystarterpack.com](https://blueskystarterpack.com/academic)).

**What works on Bluesky:** Short reversal arc threads with primary source links. "Thread: On [date], the Supreme Court treated Chevron deference as settled law. On [date], Loper Bright Enterprises v. Raimondo reversed it. Here is the full epistemic receipt." The product demo is also the content.

**X:** Post the same content. The rationalist community (ACX, LessWrong-adjacent) remains more active on X than Bluesky. Cross-post.

**Effort:** Low-medium per post, but consistency over 30+ days is needed before seeing any compounding. This is a sustaining activity, not a launch moment.

---

### Reddit
**Verdict: Useful for specific subreddits with careful framing; high downvote risk if framed as marketing.**

Relevant subreddits and their norms:
- **r/OSINT** (241k members): Welcomes tool discussions, but post must lead with utility, not product pitch. Best angle: "I built a database of documented suppression and amplification events with primary sources — useful for verifying information manipulation claims."
- **r/dataisbeautiful**: Requires [OC] tag and data visualization. Build a visualization of a reversal arc (e.g., the epistemic status trajectory of Roe v. Wade from 1973 to 2022) and post it. This is the right format.
- **r/science**: 27M subscribers but heavily moderated; news-peg required. Post when a major reversal arc is in the news.
- **r/DataHoarder**, **r/datasets**: Receptive to "I built a large open dataset" framing.
- **r/skeptic**, **r/AskHistorians**: High standards for sourcing; the product's primary-source emphasis is a fit, but requires engaging in the community before posting.

**Effort:** Medium per successful thread. Requires reading each subreddit's culture carefully. Avoid r/journalism and r/FactCheck (small, low-activity subreddits).

---

### Product Hunt
**Verdict: Low fit; not a priority.**

Ground News reached #1 on Product Hunt in January 2020, but Product Hunt's core audience is SaaS buyers and maker-community members looking for productivity tools. A reference database for researchers and journalists is a poor fit for this audience's intent. The expected upvote ceiling is low; the audience mismatch means even a successful PH launch produces low-quality traffic.

**Exception:** If the project builds a direct user-facing app layer (e.g., a "check this claim's history" browser extension or email digest), Product Hunt becomes more relevant. Not applicable at launch.

---

### Academic Routes
**Verdict: High credibility multiplier; slow returns; sequence after first user cohort is established.**

**Preprint venues:** The whitepaper belongs on arXiv (cs.DL — Digital Libraries, cs.IR — Information Retrieval) and SocArXiv (for the social science framing). A preprint gives the project a citable DOI before peer review, which is the norm in metascience. The metascience community takes preprints seriously.

**Conferences:** Metascience 2025 has already passed; the next ISSI is 2027 (Taipei). However, the Metascience Alliance (launched July 2025) is running ongoing working groups. NICAR 2026 (Indianapolis, March 5–8) is the journalism-data conference; tipsheets from NICAR get wide distribution ([Nieman Lab](https://www.niemanlab.org/2025/03/you-can-learn-a-conferences-worth-of-data-journalism-through-these-nicar-tipsheets/)).

**Effort:** High. Preprint writing is 20–40 hours of real work. Conference abstract submission for NICAR 2026 would need to happen by fall 2025 (window has passed). Target Metascience 2026 working groups as the correct academic conference opportunity.

---

### Librarian and Journalist Tool Directories
**Verdict: High credibility signal, low traffic, worth doing.**

- **GIJN Resource Center:** Has a "Submit a Site" option. GIJN's resource pages are indexed in curricula and reference guides globally. Getting listed requires framing as a verification/source-tracking tool, not a knowledge-status database. ([GIJN](https://gijn.org/resources/))
- **SPJ Journalist's Toolbox** (journaliststoolbox.org): Has a "Suggest resource" link. The Toolbox features a "Tool of the Month" in Quill magazine; this is the promotional lever to pitch.
- **LLRX** (Law and Technology Resources for Legal Professionals): Editorially curated; a brief description of the product's legal content (court opinions, statutory registries) is appropriate for submission.
- **Wikipedia Library:** The formal database proposal path requires the project to first establish institutional presence.

**Effort:** Low per submission (30–60 minutes per directory). These are background tasks, not primary launch channels. Traffic will be small but qualified.

---

### AI-Facing Distribution (MCP Registries)
**Verdict: High priority; low effort; do this immediately.**

The four registries that matter in 2026: mcp.so (20,000+ servers), smithery.ai, glama.ai/mcp, and punkpeye/awesome-mcp-servers (submit via GitHub pull request). ([RoxyAPI 2026](https://roxyapi.com/blogs/mcp-registries-where-to-list-your-server)).

The GitHub MCP Registry ([GitHub](https://github.blog/changelog/2025-09-16-github-mcp-registry-the-fastest-way-to-discover-ai-tools/)) is the official Anthropic-backed backstop and requires the server to adhere to MCP specification version 2025-11-25. The punkpeye list is a PR submission against the GitHub repo at github.com/punkpeye/awesome-mcp-servers.

**Why this is urgent:** MCP directory traffic is growing faster than any other discovery channel in the AI-dev ecosystem. A well-documented server listing here costs almost nothing and provides persistent distribution as AI agent frameworks mature.

---

## 4. Positioning Recommendations

### One-liner per top audience

| Audience | One-liner |
|---|---|
| AI/LLM builders | "An MCP-queryable database of 1.75M claim-status transitions, with primary source receipts — ground your agents in how knowledge actually changed." |
| Meta-science researchers | "The settling curve: a dated, sourced record of how scientific and legal claims move from recorded to settled to contested to reversed — 1.8M transitions, all citable." |
| Data journalists | "The primary-source paper trail for how knowledge changed — pull the full timeline of any major reversal, from the original claim to the reversal ruling, with the receipts." |
| OSINT / verification | "A documented record of suppression and amplification events: where knowledge was withheld, distorted, or amplified — with the primary sources attached." |
| Law librarians | "86 national statute registries, US court opinions, and legislative history — with dated epistemic status transitions and primary citations for every step." |
| Rationalist/epistemics readers | "The settling curve: what it looks like when a fact actually becomes a fact — and when it stops being one. 1.75M claims, with the receipts." |

### Master one-liner (across all audiences)
**"Epistemic Receipts is a reference database of how knowledge changes: 1.75 million claims, dated and sourced from RECORDED to SETTLED to REVERSED, with the primary document behind every transition."**

### Framing tests

- **"The settling curve"** — works best with meta-science researchers and rationalist readers who already understand epistemic vocabulary. Risks being opaque to journalists and developers.
- **"Receipts for facts"** — highly accessible, slightly informal, works for social media. Risks underselling the scholarly rigor.
- **"Wikipedia for how knowledge changes"** — immediately comprehensible framing, but carries Wikipedia's credibility problems (anyone can edit, lacks primary sources, consensus-based). Actively misleading for this product. Do not use.
- **"An epistemic provenance layer for AI"** — correct and precise for developers; completely opaque to journalists and educators. Use only in AI-facing contexts.

**Recommendation:** Lead with the settling curve as own vocabulary in academic and AI contexts. Lead with "the receipts" metaphor in journalism and social contexts. Never use the Wikipedia comparison.

---

## 5. 30/60/90-Day Launch Plan

### Pre-launch hygiene (do before anything else)

1. **Custom domain:** Register epistemicreceipts.com (or similar) and point it to Vercel. The vercel.app subdomain is a credibility tax with every professional audience. Cost: ~$12/year. Time: 20 minutes. This is blocking. [INFERENCE based on solo-founder stack research confirming custom domain as table stakes for credibility].
2. **Analytics:** Install Plausible ($9/month) on the custom domain for privacy-respecting traffic measurement. PostHog free tier for product analytics (event tracking on claim lookups, export usage, API calls). Do not use Google Analytics — academic and journalist communities are GDPR-aware.
3. **MCP server documentation:** Ensure the MCP server has a README with example queries, schema documentation, and a working example that a developer can copy-paste. This takes 4–6 hours but unlocks the AI-builder audience.
4. **Demo pack:** Build 3–5 reversal arc narrative pages — rich, hand-curated settling curves for Chevron, Roe v. Wade, one scientific retraction cascade (75 exoplanets or a high-profile paper), and the tobacco "doubt is our product" suppression arc. These are the demos for every channel.
5. **Landing page copy:** Write a 200-word product description using the master one-liner and the five demo arcs. This becomes the HN comment, the MCP listing description, the GIJN submission, and the Substack introduction paragraph.

---

### Days 1–30: Technical Audience, Infrastructure

**Goal:** 50–100 genuine users from AI-developer and meta-science communities who have actually used the product. Success metric: 50 API calls from distinct sources; 10 GitHub stars or discussions if the repo is public; at least 1 developer sharing the product organically.

| Week | Action | Effort | Success metric | Kill signal |
|---|---|---|---|---|
| 1 | Submit MCP server to punkpeye/awesome-mcp-servers (GitHub PR), mcp.so, smithery.ai, glama.ai/mcp | 2 hrs | Accepted to 2+ registries | PR rejected — fix documentation issues |
| 1 | Submit to GitHub MCP Registry | 1 hr | Pending/accepted | Schema compliance failure |
| 2 | Post Show HN | 4 hrs prep + 2 hrs thread management | Front page (60+ upvotes); if not, 20+ upvotes and 10 meaningful comments | <10 upvotes in first hour: do not engage further that day; revisit title framing |
| 2–3 | Cross-post MCP listing announcement to Bluesky AI community and Cursor/Claude Discord communities | 1 hr/platform | 20+ interactions | <5 interactions — wrong community entry point |
| 3–4 | Publish first Substack essay (reversal arc: Chevron or Roe) to own newsletter as foundation for guest pitches | 15 hrs | 200+ reads on own Substack; use as pitch asset | If Show HN succeeded, this has natural distribution; if not, still proceed |
| 4 | Pitch essay or link to Gwern newsletter / Works in Progress | 2 hrs | Response within 2 weeks | No response — follow up once, then move on |

---

### Days 31–60: Journalist and Researcher Audience

**Goal:** First 500 unique monthly visitors from non-technical audiences; first coverage by a journalist or researcher who references the database. Success metric: 1 external citation or mention in the wild.

| Week | Action | Effort | Success metric | Kill signal |
|---|---|---|---|---|
| 5 | Submit to GIJN Resource Center via "Submit a Site" | 1 hr | Listing accepted | Rejection — revise framing toward verification/source-tracking use case |
| 5 | Submit to SPJ Journalist's Toolbox ("Suggest resource"); also submit to LLRX for legal content | 1 hr each | Listing accepted | No response within 30 days — follow up once |
| 6 | Post r/dataisbeautiful with a visualization of a reversal arc [OC] | 4 hrs (visualization + post) | 100+ upvotes, top comments cite the source data | <20 upvotes — the visualization is not compelling; improve before retry |
| 6 | Post r/OSINT about suppression/amplification records with specific examples | 2 hrs | Positive community engagement, questions about using the database | Downvoted as promotional — reframe as sharing a research resource, not a product |
| 7–8 | Email pitch to 3 Bluesky-active science journalists with a specific reversal arc story pitch (not a product pitch) | 3 hrs | 1 positive response | 0 responses — revise pitch to lead with specific story angle, not the database |
| 7–8 | Contact 2–3 law librarians who blog or tweet about legal tech tools | 2 hrs | 1 blog post or mention | No engagement — try AALL listserv instead |

---

### Days 61–90: Community Embedding and First Institutional Outreach

**Goal:** Established presence in at least two communities where product is mentioned organically by others (not by founder). First institutional inquiry (grant, data partnership, or academic collaboration). Success metric: 3 organic third-party mentions in any channel.

| Week | Action | Effort | Success metric | Kill signal |
|---|---|---|---|---|
| 9 | Pitch whitepaper preprint to arXiv (cs.DL) or SocArXiv | 20 hrs writing | Preprint posted with DOI; shared in meta-science Bluesky community | If whitepaper quality is insufficient, get feedback first — do not rush |
| 9–10 | Engage consistently on Bluesky in fact-checker and meta-science communities (reply to others' posts with relevant data, not self-promotion) | 1 hr/day for 30 days | 50 followers in target communities; 3+ organic retweets/shares of own content | <10 followers after 30 days — change content format (less "here's the database," more "here's the settling curve for X") |
| 10 | Submit Letter of Inquiry to Sloan Foundation (Public Understanding of Science, new media track) | 8 hrs | Invitation to submit full proposal | No response within 8 weeks — move to Knight Foundation inquiry |
| 11–12 | Begin Knight Foundation inquiry for journalism program (applications open January 31, 2026 through September 30 — the next cycle) | 4 hrs research | Clarity on eligibility for current vs. next cycle | If not eligible for current cycle, prepare for next cycle |
| 12 | Prepare Metascience 2026 conference abstract | 4 hrs | Abstract submitted | Conference dates unknown — identify by end of 30-day period |

---

### Uptime and reliability
For a reference database, uptime expectation from professional audiences (librarians, journalists, researchers) is 99%+. Vercel's free tier provides adequate SLA for current scale. Before any professional audience outreach, confirm the site has had no downtime incidents in the prior 30 days.

---

## 6. Funding Paths

### Path 1: Alfred P. Sloan Foundation — Public Understanding of Science & Technology
**Match:** The Sloan PUST program funds works that "mainstream science and technology for general audiences" via books, theater, film, and new media. Epistemic Receipts is explicitly new media — a publicly accessible database about how scientific knowledge evolves. The reversal arcs, suppression records, and retraction data are exactly the kind of "how science actually works" content Sloan funds.

**Requirements:** The foundation does not make grants to individuals — the project needs a fiscal sponsor (a university or nonprofit) to apply. Typical new media grants are $60,000–$250,000. The foundation makes grants year-round but reviews major grants quarterly. Apply via Letter of Inquiry to the program director.

**Realistic timeline:** LOI submission → 8-week response → full proposal → 3-month review = 5–6 months to first decision. [Source: [Sloan Foundation](https://sloan.org/programs/public-understanding/)]

**Action required:** Identify a fiscal sponsor (a university digital humanities center, a journalism school, or a nonprofit like the Center for Scientific Integrity, which sponsors Retraction Watch). Without a fiscal sponsor, this path is closed until the project incorporates as a nonprofit.

---

### Path 2: Knight Foundation — Journalism Program / Next Challenge
**Match:** Knight funds projects that strengthen journalism and democracy. The epistemic receipts project maps onto their core interest in "reliable information infrastructure." The Journalism Program Grants cycle opens January 31 through September 30 annually and is invite-only OR via open calls. ([Knight Foundation](https://knightfoundation.org/apply/)). The Next Challenge competition (which runs separately) focuses on early-stage journalism startups — this closed March 2026, so the next cycle is the target.

**Realistic amount:** Next Challenge awarded up to $50,000 (division winners) + $25,000 grand prize. Journalism Program Grants are larger but invite-only.

**Action required:** Subscribe to Knight's newsletter to receive open call announcements. Build a relationship by submitting to the open call list. Having a GIJN or IRE connection helps (Knight closely follows GIJN).

---

### Path 3: ACLS Digital Justice Grants (Mellon-funded)
**Match:** Supports digital projects that "critically engage with historically marginalized communities through the ethical use of digital tools." The epistemic receipts project has direct relevance — the suppression and amplification records document exactly how knowledge about marginalized communities has been withheld or distorted (Korematsu, tobacco industry targeting, etc.).

**Requirements:** Principal investigator must be a scholar in the humanities or social sciences. Must be administered by a US institution of higher education. Seed grants: $10,000–$25,000; Development grants: $50,000–$100,000. Work plan: 12–18 months. [Source: [ACLS](https://www.acls.org/competitions/acls-digital-justice-seed-grants/)]

**Note:** The 2025 round deadline was November 20, 2025 (now closed). The 2026 round will open in 2026 — watch the ACLS website for the announcement.

**Action required:** Requires an academic partner as principal investigator and a host institution. This is a 12–18 month runway play, not a quick grant.

---

### Summary table

| Funder | Amount | Timeline | Blocker |
|---|---|---|---|
| Sloan (PUST New Media) | $60K–$250K | 5–6 months to decision | Needs fiscal sponsor / nonprofit entity |
| Knight (Next Challenge, next cycle) | Up to $75K | Next cycle likely early 2027 | Open call announcement needed |
| ACLS Digital Justice | $10K–$100K | 12–18 months | Needs academic PI and host institution |

**Near-term bridge:** OurResearch (Unpaywall/OpenAlex) achieved early sustainability via a "Data Feed" subscription model where institutional users pay for bulk/API access while the core database stays free. This is the correct sustainable model if grant timelines extend beyond 18 months — an institutional API subscription tier targeted at law firms, research libraries, and news organizations.

---

## 7. Top 10 Prioritized Action List

| Priority | Action | Effort | Timeline |
|---|---|---|---|
| 1 | Register custom domain and point to Vercel | 30 min | This week |
| 2 | Write MCP server documentation (README + example queries + schema) | 4–6 hrs | This week |
| 3 | Submit MCP server to punkpeye/awesome-mcp-servers, mcp.so, smithery.ai | 2 hrs | This week |
| 4 | Build 3–5 rich reversal arc narrative pages (Chevron, Roe, exoplanet cascade, tobacco suppression) as product demos | 15–20 hrs | Weeks 1–2 |
| 5 | Write landing page copy using master one-liner; prepare Show HN post title and comment | 3 hrs | Week 1 |
| 6 | Post Show HN | 2 hrs (post + thread) | Week 2 |
| 7 | Complete and publish first Substack essay (single reversal arc, ~3,000 words) | 15 hrs | Weeks 2–3 |
| 8 | Submit to GIJN Resource Center and SPJ Journalist's Toolbox | 2 hrs | Week 3 |
| 9 | Post r/dataisbeautiful visualization of a reversal arc [OC] | 4 hrs | Week 4 |
| 10 | Begin LOI preparation for Sloan Foundation; identify fiscal sponsor | 4 hrs research | Weeks 4–8 |

---

## 8. Adversarial Section: Why This Might Fail

This section steelmans the "nobody will use this" position. It is not softened.

---

### The daily-use problem is real and unsolved

The brief honestly flags that "the daily-user question is genuinely unanswered." This is the central risk. Reference databases live or die on whether someone has a reason to return. Retraction Watch succeeded because researchers *needed to check* whether specific papers were retracted before citing them — a recurrent, high-stakes workflow task. CourtListener succeeded because lawyers and journalists needed current case status.

What is the recurrent use case for Epistemic Receipts? The settling curve is the database's invention; it is not yet part of anyone's workflow vocabulary. "Checking what epistemic status a claim is currently in" is not a daily task most professionals consciously perform. Without a recurring pull — an alert system ("notify me when the epistemic status of claim X changes"), an API that other tools pull from, or a scheduled digest — the site risks being a reference destination that people visit once, find impressive, and never return to.

**What the graveyard teaches:** Fiskkit (2016) launched as a fact-checking annotation layer for news articles; it had a Product Hunt presence and a Product Hunt launch. It currently has no active user community and no ongoing development. Fiskkit's failure pattern: technically sound, genuinely useful in specific contexts, but no recurring pull and no path to becoming part of a workflow. FactStream (Duke Reporters' Lab) had 56,000 downloads over six years and still got shut down because resources ran out and it never became essential enough to attract institutional support. [Source: [Duke Reporters' Lab](https://centers-dewitt.sanford.duke.edu/reporterslab/2024/12/03/reporters-lab-discontinues-factstream-app/)]

**What Retraction Watch did differently:** Retraction Watch published *daily* blog posts about specific retractions. The database was a product of that editorial work, not the lead. The editorial product created the recurring visit reason; the database was the asset. Epistemic Receipts currently has no editorial layer.

---

### The "first 5,596 vs. the other 1.75M" problem

5,596 claims have rich narratives. The other 1.75 million are bulk reference scaffolding. A journalist, researcher, or educator who lands on a bulk scaffolding record will see a data row with status fields, not a compelling story. The demo must route every first-time visitor to the rich narratives. If the product demo is a random sample of the corpus, most demos will be unimpressive.

---

### The institutional legitimacy gap

Our World in Data succeeded partly because it was affiliated with the University of Oxford (Max Roser's institutional base) from the start. The Nuffield Foundation gave the first grant because there was an institutional principal. Retraction Watch got MacArthur funding because journalists with established bylines (Ivan Oransky, Adam Marcus) founded it. Epistemic Receipts is solo-founded, non-developer, with no institutional affiliation, no existing audience, and on a vercel.app subdomain. Every grant path requires a fiscal sponsor or academic partner. Every journalist contact works better from an institutional email address. This is not fatal but it requires active mitigation.

---

### The vocabulary problem

"Settling curve," "epistemic status," "RECORDED → SETTLED → CONTESTED → REVERSED" — this vocabulary is invented. It is accurate and elegant. It is also unknown to every audience the project is targeting. Every channel launch requires translating the vocabulary into that community's existing terms. This translation overhead is a launch tax on every channel simultaneously.

---

### Failed comparable projects

**Freebase (Google):** Shut down in 2016 despite Google resources. Lesson: centralized, proprietary knowledge graphs are not sustainable; the Wikipedia/Wikidata community model wins because it distributes the maintenance burden. [Source: [Wikipedia/Freebase](https://en.wikipedia.org/wiki/Freebase_(database))]

**ClaimBuster (UT Arlington):** Technically functional, used by Duke Reporters' Lab, has not achieved mass adoption despite years of availability. Tool quality is insufficient to create workflow dependency without institutional mandate.

**Hypothesis (open annotation):** Raised a $14M seed round in 2022, has an active education community, still has not crossed into mass mainstream use. Annotation layers require workflow integration that most users resist.

**The pattern:** Products that solve real problems but require users to learn new vocabulary, change workflow, or visit a new destination without a pull mechanism plateau early. The projects that escaped this plateau did so by either (a) becoming infrastructure (Crossref, DOI system), (b) having a viral editorial hook (Retraction Watch's daily blog), or (c) becoming embedded in an existing workflow through API integration (Unpaywall browser extension). Epistemic Receipts has a path to (c) via the MCP server, which is the highest-priority path for this reason.

---

### The solo founder bottleneck

The brief is transparent: solo founder, non-developer, AI-agent-assisted. This is a genuine capability constraint. A database launch with 185 sources and 1.75M records is a credibility asset. But responding to HN comments, engaging with Bluesky academics, writing essays, submitting grant applications, and maintaining the product simultaneously is a realistic time budget failure mode. The 30/60/90 plan above is sequenced to avoid parallelizing high-effort activities. Do not attempt all channels at once.

---

### What would make this fail despite everything

1. The MCP server has breaking changes or poor documentation → developer audience never returns.
2. The Show HN post gets buried (fewer than 10 upvotes in the first hour) → no technical community awareness.
3. The first Substack essay is written in the product's vocabulary rather than the audience's vocabulary → rationalist community finds it interesting but not interesting enough to share.
4. The custom domain is not set up before any professional outreach → librarians and journalists dismiss the project as not ready for professional evaluation.
5. No fiscal sponsor is found within 12 months → all three primary grant paths remain closed.

---

*Sources cited throughout:*
- [Retraction Watch 10th anniversary](https://retractionwatch.com/2020/08/03/retraction-watch-turns-10-a-look-back-and-a-look-forward/)
- [Retraction Watch Crossref acquisition 2023](https://retractionwatch.com/2023/09/12/the-retraction-watch-database-becomes-completely-open-and-rw-becomes-far-more-sustainable/)
- [Our World in Data funding](https://ourworldindata.org/funding)
- [OpenAlex Wikipedia](https://en.wikipedia.org/wiki/OpenAlex)
- [OpenAlex $7.5M Arcadia grant](https://blog.openalex.org/ourresearch-receives-7-5m-grant-from-arcadia-to-establish-openalex-a-milestone-development-for-open-science/)
- [Connected Papers launch](https://medium.com/connectedpapers/connected-papers-post-launch-community-update-64d952423d56)
- [Elicit $22M Series A](https://www.creativerly.com/elicits-22m-series-a-deploying-ai-to-radically-increase-good-reasoning-in-the-world/)
- [Metaculus community history](https://ea-crux-project.vercel.app/knowledge-base/organizations/metaculus/)
- [Ground News launch](https://www.editorandpublisher.com/stories/ground-news-allows-consumers-to-judge-the-news-for-themselves,1297)
- [MCP ecosystem 2026](https://roxyapi.com/blogs/mcp-registries-where-to-list-your-server)
- [GitHub MCP Registry](https://github.blog/changelog/2025-09-16-github-mcp-registry-the-fastest-way-to-discover-ai-tools/)
- [punkpeye awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)
- [Metascience 2025](https://metascience.info/)
- [Bluesky academic migration](https://www.science.org/content/article/old-twitter-scientific-community-finds-new-home-bluesky)
- [Bluesky science engagement](https://www.chemistryworld.com/news/science-content-on-bluesky-attracts-more-engagement-and-originality-than-on-x/4022084.article)
- [Bluesky starter packs](https://blueskystarterpack.com/fact-checkers)
- [NICAR 2025](https://www.ire.org/25-things-we-learned-at-nicar25/)
- [NICAR 2026](https://www.ire.org/training/conferences/nicar-2026/)
- [GIJN Tools 2025](https://gijn.org/stories/gijn-top-investigative-tools-2025/)
- [Show HN guidelines](https://www.markepear.dev/blog/dev-tool-hacker-news-launch)
- [Show HN survival study](https://asof.app/research/show-hn-survival)
- [Sloan PUST program](https://sloan.org/programs/public-understanding/)
- [Knight Foundation grants](https://knightfoundation.org/apply/)
- [ACLS Digital Justice grants](https://www.acls.org/programs/acls-digital-justice-grants/)
- [FactStream shutdown](https://centers-dewitt.sanford.duke.edu/reporterslab/2024/12/03/reporters-lab-discontinues-factstream-app/)
- [Works in Progress submissions](https://worksinprogress.co/issue/how-to-write-for-works-in-progress/)
- [Wikipedia Library](https://en.wikipedia.org/wiki/Wikipedia:The_Wikipedia_Library/Databases)
- [AALL State of Profession](https://www.lawnext.com/2023/05/law-librarians-play-central-role-in-legal-tech-adoption-and-use-aall-state-of-the-profession-report-shows.html)
- [Freebase shutdown](https://en.wikipedia.org/wiki/Freebase_(database))
- [Helmsley Trust Retraction Watch](https://retractionwatch.com/2015/12/03/helmsley-trust-helps-retraction-watch-chart-its-future-with-new-130000-grant/)

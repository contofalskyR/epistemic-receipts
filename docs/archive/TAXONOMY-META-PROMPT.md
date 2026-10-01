# META-PROMPT — Build an "Epistemic Receipts" Taxonomy (for any subject)

> **How to use this file.** Paste it into a fresh Claude, then say: **"Read this and build a taxonomy for `<SUBJECT>`."** If no subject is given, ask for one. Then follow the recipe below to produce a single self-contained Markdown **build prompt** for that subject. Don't re-derive the design from scratch or over-deliberate — the decisions are made here; just make the subject-specific calls, verify, and deliver. (This file exists so you don't burn tokens rediscovering all of this.)

---

## 1. What you are making (read this first)

There are **two Claudes** in this workflow:

- **You** write a **build prompt**: one self-contained Markdown document.
- The **user** pastes it into a *separate* **builder Claude** that already has the **Epistemic Receipts** website codebase. The builder just **renders** what you give it.

Therefore **you must supply the ENTIRE taxonomy payload** — every section, every family, every entry with all its fields — plus build instructions, a color scheme, and acceptance criteria. **You are NOT building the website and NOT writing code.** You are writing the content + spec the builder will turn into a page.

**Epistemic Receipts** is a claims-and-evidence site. Taxonomy pages are **siblings** of the existing ones (e.g. `/statistics`, `/finance`, `/governance`, `/ideologies`, `/sports`, `/mathematics`, `/chemistry`). Your new page is `/<subject>`, and it must read as part of that set — same card-based, filterable, collapsible layout.

---

## 2. The quality bar (non-negotiable)

- **"Kill Wikipedia": exhaustive but notable.** Include every entry a knowledgeable person would expect; never pad. Aim for **~240–250 entries**, **~18–21 families**, **~5 color sections** — matching the depth of the existing pages.
- **Accuracy is paramount.** Never fabricate. Flag anything uncertain for review instead of guessing. **Web-search the subject's volatile facts** before shipping (see §6).
- **Neutrality on contested classifications.** State the dispute; do not adjudicate (see §7).
- **No corruption.** If the subject has technical notation, render it properly; always grep the finished file (see §8).

---

## 3. The seven subject-specific decisions

Make these **once, up front**, then write. The three precedents (sports, math, chemistry) are your reference — copy whichever pattern fits.

| Decision | What to choose | Precedents |
|---|---|---|
| **(a) Core field** | The one substantive, searchable field every card carries. Name it for the subject. | sports → `objective` (the catalog) / `key insight` (the science); math → `statement` (in LaTeX); chemistry → `key fact` |
| **(b) Headline graph** | A **directed relationship graph between entries** — the page's differentiator. Reuse the site's **Edges model**. | ideologies → "descended-from" tree; math → prerequisite **DAG** (acyclic); sports → variant/lineage graph; chemistry → **reaction network** (not acyclic) |
| **(c) Second signature view (optional)** | Only if the subject has another iconic structure a graph can't capture. | chemistry → interactive **periodic table** (period × group grid). Most subjects need none. |
| **(d) Rendering mode** | Plain ASCII, or a math/notation engine. | sports → ASCII; math → **MathJax/KaTeX** (all formulas in LaTeX `$…$`); chemistry → **MathJax/KaTeX + `mhchem`** (all formulas in `$\ce{…}$`). Physics/econ/logic → likely LaTeX too. |
| **(e) Sections & families** | ~5 coherent sections: **foundations → core branches → applied → a cross-cutting "gold" family**. | see §4 |
| **(f) xrefs** | Which **sibling pages** overlap; link, don't duplicate. | math ↔ `[xref: statistics]`, `[xref: finance]`; chemistry ↔ `[xref: mathematics]`, `[xref: statistics]`; sports ↔ none |
| **(g) Volatile facts + disputes** | What's recent/changeable to verify, and what's genuinely contested. | see §6 and §7 |

**Always include a cross-cutting "gold" family** — the notable, contested, and open items. It's the most on-brand for a claims site. Precedents: math → "Famous Theorems & Open Problems"; chemistry → "Great Reactions, Industrial Processes & Open Questions"; sports → "the science of sport."

---

## 4. Required output structure (the anatomy)

Produce the file in **exactly this order**. Everything above the `---` after the preamble is *for the user*; everything below is *for the builder*.

```
# Build Prompt — <Subject> Taxonomy (mirrors the sibling pages)

> **For the user (not the builder).** This builds `/<subject>` as a sibling of <list>. Key decisions:
> - <core field>  · <headline graph (+2nd view)>  · <rendering mode>
> - <scale: N sections · M families · ~K entries>
> - <volatile facts to verify before shipping>
> - <xrefs to which siblings>
> Paste everything below the line.

---

## Your task
<1 paragraph: build /<subject> reusing the siblings' components/schema/styling; what the page covers; threaded by <headline graph>.>

## How to build
<Edit the data layer, not the markup. Initialize <rendering engine> once if needed. Populate the core field from the seeds (they are vetted). Build the <graph> from <field>. Recompute counts from data. Cross-link [xref:] entries to siblings, don't fork. Footer note + last-updated.>

## New fields specific to this page
<core field (searchable) + any optional secondary fields the subject needs, e.g. formula / reaction / transforms / prereqs / example / coordinates.>

## Headline feature(s) (mandatory)
<Describe the graph: what are nodes, what are edges, which field defines edges, reuse the Edges model, nodes clickable, acyclic-or-not. Then any 2nd view.>

## Expansion structure
<What each card expands to: intuition · core field · where it sits / neighbors · worked example · related claims. Offer an optional /<subject>/methods deep-dive for the ~10 most foundational entries, or leave a stub.>

## Accuracy / neutrality mandate
<Correctness matters; don't fabricate; flag uncertainty; verify the volatile facts; present the disputed classifications neutrally (list them).>

---

# CONTENT PAYLOAD — FAMILIES

> Format per entry: **Name** — short description. *<Core field>:* … `tags`
> <If technical: every formula is LaTeX/`\ce{}`; render with the engine.>

## SECTION A — <name>
*<one-line section gloss>*

### Family 1 — <name>
> **<Entry>** — <one-line desc>. *<Core field>:* <substance>. *<optional field>:* … `tag` `tag`
> **<Entry>** — …
…(repeat families and sections)…

---

# <OPTIONAL DATA BLOCK if a 2nd view needs it, e.g. an element dataset>

---

# COLOR & GROUPING
<Color BY SECTION (5 hues, ≤~6 total), shade-vary within a section. Note any separate scheme for a 2nd view. Node coloring for the graph.>

# ACCEPTANCE CRITERIA
<A checklist mirroring the siblings — see §9.>
```

### Per-entry line format
Each entry is a single blockquote line:
```
> **Name** — one-line description. *<Core field>:* the substance. *<optional>:* … `tag` `tag`
```
Examples from the precedents:
- math: `> **Pythagorean theorem** — Relates the sides of a right triangle. *Statement:* $a^2+b^2=c^2$. `geometry``
- chemistry (reaction, defines a graph edge): `> **Esterification (Fischer)** — Making an ester. *Key fact:* acid-catalyzed condensation… *Transforms:* carboxylic acid + alcohol → ester. `organic``edge``
- sports: `> **Squash** — Racquet sport in an enclosed court. *Objective:* … `racquet``

---

## 5. The house schema the builder expects

- **Cards:** name · one-line description · the one **core searchable field** · tags · expandable.
- **Families:** collapsible, **color-coded by section**, with **data-driven counts** ("N families · M entries" — never hard-coded).
- **Controls:** a **sticky filter** + **Expand/Collapse all**. The filter indexes the rendered/plain-text form (so searching a formula like "H2O" works).
- **Optional deep-dive:** `/<subject>/methods` for the ~10 most foundational entries, in a problem → mechanism → worked-example → figure → pitfalls → related-claims format. Offer it; a stub is fine.
- **Footer:** the free-text-search caveat + a "claim cross-references pending" roadmap line + a **"last updated"** date.

---

## 6. Verify volatile facts (web search)

Before writing the affected entries, **search** for anything that can change after a training cutoff:
- current record-holders, champions, office-holders ("who currently…");
- latest counts/versions/standards ("how many X are there now", "newest Y");
- recent high-profile claims and whether they held up.

Use the actual current year in queries. Reflect what you find, and tell the user (in the preamble + acceptance criteria) to **re-verify at build time**.

*Precedents:* sports → the current Olympic program (which sports/events are in the next Games); math → the **Millennium Prize Problems** statuses (only Poincaré is solved); chemistry → the periodic table's extent (**118 confirmed elements**, period 7 complete) and the status of **room-temperature superconductivity** (still unachieved; LK-99 refuted).

---

## 7. Neutrality on contested classifications

Where a classification is genuinely disputed, **present it neutrally and leave it open** — an explicit entry or note stating the dispute. Don't pick a side.

*Precedents:* sports → is chess/esports a "sport," boxing governance; math → is statistics/CS "math," pure vs applied, where category theory sits; chemistry → hydrogen's placement, **group-3 membership** (La/Ac vs Lu/Lr), which elements are metalloids, group-12 as transition metals, biochemistry as "chemistry" vs "biology."

---

## 8. Rendering & corruption rules

**Decide the rendering mode (§3d) and stick to it:**
- **Non-technical subject** → keep all prose **plain ASCII**. No stacked sub/superscript unicode.
- **Math-heavy subject** → require **MathJax or KaTeX** in the preamble + How-to; write **every** formula in LaTeX `$…$`. Renaming entry titles to avoid unicode (e.g. "Lp spaces", not the superscript form) is fine — the LaTeX body still shows it correctly.
- **Chemistry-like subject** → require **MathJax/KaTeX + the `mhchem` extension**; write every formula/equation as `$\ce{…}$` (e.g. `$\ce{2H2 + O2 -> 2H2O}$`, `$\ce{SO4^2-}$`, isotopes `$\ce{^{238}U}$`, complexes `$\ce{[Cu(NH3)4]^2+}$`). Use LaTeX `$\mathrm{cm^{-1}}$` rather than unicode `⁻¹`. The degree sign `°` and accented names are fine.

This both fixes the unicode-subscript corruption that bites technical pages **and** is what readers expect for those subjects.

**Legitimate non-ASCII** (don't strip these): em dash `—`, middle dot `·`, the arrow `→` used in graph/`transforms` fields, multiplication `×`, ellipsis `…`, degree `°`, Greek used in prose (`Δ`, `β`), and accented names (Gödel, Poincaré, Brønsted, Hückel, Héroult, Itô, Erdős).

---

## 9. Verification checklist (run before delivering)

If you have file/code tools, grep the finished file:
- **No replacement char** U+FFFD (`grep -nP "\xEF\xBF\xBD" file`).
- **No stray super/subscript modifier letters** (enumerate non-ASCII; confirm none are SUPERSCRIPT/SUBSCRIPT/"MODIFIER LETTER SMALL").
- **No stray standalone `doc`** token.
- **Balanced `$`** if using LaTeX (count is even).
- **`\ce{` present** if using mhchem; LaTeX present if math.
- **Entry count** ≈ target (`grep -c '^> \*\*' file`), ~240–250.
- **All headers present:** every SECTION, every Family, CONTENT PAYLOAD, COLOR & GROUPING, ACCEPTANCE CRITERIA (+ any data block).

Content checks:
- `[xref:]` tags point **only to sibling pages**, not internal families.
- Counts are described as data-driven, never hard-coded.
- The verified volatile facts are reflected and flagged for re-verification.
- Disputed classifications are present and neutral.
- Coverage is exhaustive-but-notable, prose is ASCII with notation only inside LaTeX/`\ce{}`.

The acceptance-criteria section you write **for the builder** should mirror this: sibling-consistent render; engine initialized; collapsible color-by-section families with data-driven counts; sticky filter + expand/collapse; the **headline graph** built from the edge field via the Edges model (nodes clickable); any 2nd view; cards + expansions as specified; optional `/methods`; xrefs link not duplicate; verified facts reflected; disputes neutral; footer with caveat + roadmap + last-updated; ~240–250 notable entries; corruption-free.

---

## 10. Workflow & delivery

- **If you have file/code tools:** build in a scratch dir. For a large file, write in **two passes** — create the file with the header + first sections, then **append** the rest with a quoted heredoc so `$`, backslashes, and backticks stay literal:
  ```
  cat >> file.md << 'EOF'
  …part 2…
  EOF
  ```
  Then run the §9 greps, copy to the outputs location, present the file, and end with a **brief** wrap-up naming only the key decisions (core field · headline graph · rendering mode · xrefs · verified facts · neutral disputes). **No long postamble.**
- **If you have no file tools:** output the entire build prompt in **one fenced Markdown block** so the user can copy it whole, then the same brief wrap-up.

Plain Markdown throughout — no special document skill needed.

---

## 11. Precedents (compact reference)

- **`/sports`** — dual treatment (catalog of sports + science of sport). Core field `objective` (catalog) / `key insight` (science). ASCII. Headline = variant/lineage graph. Verified: Olympic program. Neutral: chess/esports as sport.
- **`/mathematics`** — ~248 entries, 18 families, 4 sections. Core field `statement` (LaTeX) + `prereqs` (defines edges). **MathJax/KaTeX.** Headline = prerequisite **DAG** (acyclic). xrefs: statistics, finance. Verified: Millennium-prize statuses. Neutral: is statistics "math," pure vs applied.
- **`/chemistry`** — ~250 entries, 21 families, 5 sections. Core field `key fact`; reactions add `reaction` + `transforms` (defines edges). **MathJax/KaTeX + `mhchem`** (`$\ce{…}$`). **Two** headline views: reaction network (Edges) + interactive periodic table. xrefs: mathematics, statistics. Verified: 118 elements / period 7 complete, room-temp superconductivity unachieved. Neutral: hydrogen placement, group-3, metalloids, group-12, biochem-as-chemistry.

Match this structure and depth for the new subject, adapting sections, families, the core field, the graph, and the rendering mode to fit it.

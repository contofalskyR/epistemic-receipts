"""
dropped_story_classifier.py
===========================
The "soul" of the dropped-story tracker: decide whether a news thread is
OPEN / STALLED / RESOLVED / ORPHANED — without crying wolf.

Design principle (learned the hard way on the TPS case):
  The LLM makes ONLY semantic judgments. Deterministic code computes the status.
  If you let the model "vibe" a status holistically it will be inconsistent and you
  can't debug it. So the model labels events and detects pending triggers; the rule
  below turns that into a status. The anti-cry-wolf guardrails live in BOTH places.

The four states:
  OPEN      A material (merits/substantive) development happened recently.
  STALLED   No recent movement, BUT there's a reason for the quiet — a known pending
            trigger (an appeal awaiting ruling, a scheduled vote) or coverage is still
            warm. Genuine limbo. THIS is where most "looks dead" threads actually live.
  RESOLVED  The resolution_criteria are met by a *merits* event. Finality required.
  ORPHANED  Open question + coverage dried up + NO pending trigger explaining it.
            "Nobody followed up." Requires positive evidence; it is NEVER the default.

Pipeline:  GDELT articles  ->  LLM (semantic labels)  ->  compute_status()  ->  status
"""

from __future__ import annotations
import json
import datetime as dt
import urllib.parse
import urllib.request

import anthropic  # pip install anthropic

# ----------------------------------------------------------------------------- #
# Thresholds (days). Tune per domain. Litigation moves slowly; breaking news fast.
ACTIVE_WINDOW = 14     # material movement within this window  -> OPEN
SILENCE_WINDOW = 21    # any coverage within this window keeps it STALLED not ORPHANED
ORPHAN_WINDOW = 42     # material silence this long is NECESSARY (not sufficient) for ORPHANED

MODEL = "claude-sonnet-4-6"   # fine for extraction; bump to an Opus model for hard threads
# ----------------------------------------------------------------------------- #


SYSTEM_PROMPT = """\
You are a news-thread status analyst. A "thread" is ONE falsifiable question about an
ongoing story (e.g. "Will rule X take effect?", "Will this termination be upheld on
final appeal?"). You are given: the question, its resolution criteria, what is already
known about any pending trigger, an as-of date, and a list of articles (date, outlet,
title, snippet).

Your job is NARROW. Make only the semantic judgments below. Downstream code computes the
status from your output plus the dates. DO NOT output a status yourself.
Return STRICT JSON matching the schema at the end. No text outside the JSON.

================ STEP 1 — CLASSIFY EACH ARTICLE ================
event_type, one of:
  "merits"      A decision/development that can actually SETTLE the question: a final
                ruling, an official enactment/repeal, an election result, a signed deal,
                an irreversible action on the ground.
  "procedural"  Moves the process but does NOT settle it: emergency stays, injunctions
                pending appeal, motions, scheduled hearings, a case moving up to a higher
                court, interim/temporary orders.
  "substantive" A real-world development relevant to the question but not a resolution:
                new facts, casualties, money moved, a policy action taken, an official
                statement of intent, fresh on-the-ground events.
  "noise"       Re-reporting, recaps, opinion/analysis, anniversaries, listicles — adds
                no new development.

is_material: true ONLY if the article reports a NEW development (a merits, procedural, or
  genuinely advancing substantive event). Recaps and opinion are false EVEN IN BULK.
  >>> "Lots of coverage" is NOT movement. Volume never makes something material. <<<

what_moved: one sentence naming the concrete development, or "" if noise.

================ STEP 2 — RESOLUTION (finality-gated) ================
Decide whether resolution_criteria are now met. GUARDRAILS:
  - ONLY a "merits" event can resolve the question. Procedural/substantive events never
    set resolution, no matter how dramatic.
  - Criteria are written around FINALITY. If a ruling can still be appealed or reversed,
    the outcome is "not_yet" — NOT "yes"/"no". (A party can be currently winning or
    losing while the question stays open.)
  - "Coverage stopped" is NOT resolution. Silence resolves nothing.
  - Default to "not_yet". Only assert yes/no/moot when a merits event plainly meets the
    written criteria.
  Return: outcome ("yes"|"no"|"moot"|"not_yet"), decided_by_article_id (or null), rationale.

================ STEP 3 — PENDING TRIGGER (the key guardrail) ================
A "pending trigger" is any known future or in-progress event whose outcome will move the
question: an appeal awaiting ruling, a scheduled vote/hearing/decision, an announced
deadline, an active negotiation with a defined next step, a body that has said it will act.

This is what separates QUIET-BUT-ALIVE (stalled, waiting) from ABANDONED (orphaned). If a
thread has no material update in weeks but a relevant case is sitting in an appeals court,
it is NOT abandoned — it is waiting.

Derive pending_trigger from BOTH the provided known_pending_trigger AND anything the
articles reveal ("the court will hear argument", "a decision is expected next term",
"Congress is scheduled to vote"). A pending trigger does NOT require a date — "in active
litigation" counts with no date.
  Return: exists (bool), description, date (or null), evidence_article_id (or null).

================ STEP 4 — DATES ================
last_material_date: most recent date among is_material=true articles (or null)
last_coverage_date: most recent date among ALL articles (or null)

================ OUTPUT SCHEMA (return exactly this shape) ================
{
  "events": [
    {"article_id": str, "date": "YYYY-MM-DD", "event_type": str,
     "is_material": bool, "what_moved": str}
  ],
  "resolution": {"outcome": str, "decided_by_article_id": str|null, "rationale": str},
  "pending_trigger": {"exists": bool, "description": str,
                      "date": "YYYY-MM-DD"|null, "evidence_article_id": str|null},
  "last_material_date": "YYYY-MM-DD"|null,
  "last_coverage_date": "YYYY-MM-DD"|null,
  "notes_for_humans": str
}
"""


# --- LABELED EXAMPLE SET ---------------------------------------------------------------
# Each entry is a hand-labeled thread that doubles as (a) few-shot guidance for the model
# and (b) an offline regression test (see eval_examples). All four are immigration-domain,
# and each deliberately lands on a DIFFERENT verdict so the model learns the boundaries:
#   protected-status -> STALLED (only procedural events; pending appeal blocks orphan)
#   sevis-f1         -> RESOLVED (a government walk-back is a merits resolution... but the
#                       storyline isn't closed; flag the successor)
#   h1b-100k-fee     -> STALLED (CONFLICTING merits rulings, both on appeal -> not final)
#   greencard-reexam -> ORPHANED (a huge action that went quiet with NO pending trigger)
# Writing these — sharp questions + finality-worded criteria — is ~80% of the quality.
LABELED_EXAMPLES = [
    {
        "name": "protected-status-stalled",
        "teaches": "procedural != resolution; opinion = noise; a pending appeal (inferred from "
                   "the articles even when known_pending_trigger said false) blocks ORPHANED.",
        "thread": {
            "id": "example-protected-status",
            "question": "Will the termination of a protected-status program be upheld with all "
                        "appeals exhausted?",
            "resolution_criteria": {
                "resolved_yes": "A final, non-appealable judgment upholds the termination.",
                "resolved_no": "A final, non-appealable judgment restores the status.",
                "moot": "Legislation or agency rescission moots the litigation.",
            },
            "known_pending_trigger": {"exists": False, "description": "", "date": None},
            "as_of_date": "2026-06-27",
        },
        "articles": [
            {"id": "x1", "date": "2025-09-05", "outlet": "Wire",
             "title": "Judge sets aside termination on the merits",
             "snippet": "A federal judge issued a final order vacating the agency's termination."},
            {"id": "x2", "date": "2025-10-03", "outlet": "Wire",
             "title": "Supreme Court pauses order, lets termination take effect pending appeal",
             "snippet": "In a brief unsigned emergency order the Court paused the ruling; the "
                        "case returns to the appeals court for merits review."},
            {"id": "x3", "date": "2026-02-10", "outlet": "Opinion Desk",
             "title": "What the status fight means for families",
             "snippet": "An analysis revisiting the dispute. No new developments."},
        ],
        "expected": {
            "events": [
                {"article_id": "x1", "date": "2025-09-05", "event_type": "merits",
                 "is_material": True, "what_moved": "A final district-court order vacated the termination."},
                {"article_id": "x2", "date": "2025-10-03", "event_type": "procedural",
                 "is_material": True, "what_moved": "Supreme Court stayed that order pending appeal and "
                                                    "sent the case back for merits review; does not decide it."},
                {"article_id": "x3", "date": "2026-02-10", "event_type": "noise",
                 "is_material": False, "what_moved": ""},
            ],
            "resolution": {"outcome": "not_yet", "decided_by_article_id": None,
                           "rationale": "The Sept 5 merits order was stayed and is under appeal; nothing is "
                                        "final and non-appealable, so the yes/no criteria are not met."},
            "pending_trigger": {"exists": True,
                                "description": "Merits appeal pending before the appeals court; no scheduled "
                                               "ruling date.", "date": None, "evidence_article_id": "x2"},
            "last_material_date": "2025-10-03",
            "last_coverage_date": "2026-02-10",
            "notes_for_humans": "Procedurally active, substantively unresolved. Quiet since February, but a "
                                "decisive appeal is pending — waiting, not abandoned.",
        },
        "expected_status": "STALLED",
    },
    {
        "name": "sevis-f1-resolved",
        "teaches": "a government REVERSAL of its own action is a merits resolution of the narrow "
                   "question -> RESOLVED. But RESOLVED != storyline closed: flag the successor.",
        "thread": {
            "id": "sevis-f1-2025",
            "question": "Will the spring-2025 NCIC-based mass SEVIS record terminations be reversed?",
            "resolution_criteria": {
                "resolved_yes": "The government rescinds the mass terminations and restores the records.",
                "resolved_no": "Courts uphold the terminations and the records stay terminated.",
                "moot": "A settlement or legislation supersedes the dispute.",
            },
            "known_pending_trigger": {"exists": False, "description": "", "date": None},
            "as_of_date": "2026-06-27",
        },
        "articles": [
            {"id": "f1", "date": "2025-03-28", "outlet": "Inside Higher Ed",
             "title": "Thousands of student SEVIS records terminated without notice",
             "snippet": "About 4,700 F-1 records were quietly terminated on NCIC criminal-record hits, "
                        "many for dismissed or minor infractions."},
            {"id": "f2", "date": "2025-04-24", "outlet": "Reuters",
             "title": "Students sue; judges grant dozens of restraining orders",
             "snippet": "Over 100 suits filed; judges grant TROs in at least 50 cases, skeptical of legality."},
            {"id": "f3", "date": "2025-04-25", "outlet": "AP",
             "title": "ICE reverses course, will restore SEVIS records nationwide",
             "snippet": "A government lawyer told a federal judge ICE will restore records while it "
                        "develops a new termination policy framework."},
            {"id": "f4", "date": "2025-05-23", "outlet": "Politico",
             "title": "Judge issues nationwide injunction as a new termination framework emerges",
             "snippet": "A judge enjoins terminations based solely on visa revocation; ICE's replacement "
                        "framework draws fresh lawsuits."},
        ],
        "expected": {
            "events": [
                {"article_id": "f1", "date": "2025-03-28", "event_type": "substantive",
                 "is_material": True, "what_moved": "Mass SEVIS terminations begin."},
                {"article_id": "f2", "date": "2025-04-24", "event_type": "procedural",
                 "is_material": True, "what_moved": "Lawsuits and dozens of TROs; courts skeptical."},
                {"article_id": "f3", "date": "2025-04-25", "event_type": "merits",
                 "is_material": True, "what_moved": "ICE rescinded the mass terminations and restored "
                                                    "records — reverses the action."},
                {"article_id": "f4", "date": "2025-05-23", "event_type": "substantive",
                 "is_material": True, "what_moved": "Nationwide injunction plus a NEW termination "
                                                    "framework — opens a successor question."},
            ],
            "resolution": {"outcome": "yes", "decided_by_article_id": "f3",
                           "rationale": "ICE rescinded the spring-2025 mass terminations and restored the "
                                        "records, so the narrow question resolves YES. This does NOT mean the "
                                        "storyline is over (see notes)."},
            "pending_trigger": {"exists": False, "description": "", "date": None,
                                "evidence_article_id": None},
            "last_material_date": "2025-05-23",
            "last_coverage_date": "2025-05-23",
            "notes_for_humans": "RESOLVED != storyline closed. The April 25 reversal settled THIS question, "
                                "but ICE's replacement SEVIS-termination framework is in active litigation and "
                                "terminations have continued — spawn a SUCCESSOR thread: 'Will the new framework "
                                "be struck down?'",
        },
        "expected_status": "RESOLVED",
    },
    {
        "name": "h1b-100k-fee-stalled",
        "teaches": "a merits ruling is NOT a resolution when it is appealable — and here two merits "
                   "rulings CONFLICT and are both on appeal, so outcome stays not_yet. A stay is "
                   "procedural. STALLED can apply to a blockbuster, not just a quiet story.",
        "thread": {
            "id": "h1b-100k-fee",
            "question": "Will the $100,000 H-1B fee (Proclamation 10973) be struck down with appeals exhausted?",
            "resolution_criteria": {
                "resolved_yes": "A final, non-appealable judgment (or Supreme Court ruling) vacates the fee.",
                "resolved_no": "A final, non-appealable judgment upholds the fee.",
                "moot": "The proclamation is rescinded or superseded.",
            },
            "known_pending_trigger": {
                "exists": True,
                "description": "Appeals pending: D.C. Circuit argued Mar 2026; First Circuit appeal filed "
                               "Jun 2026; Supreme Court review widely expected to resolve the split.",
                "date": None},
            "as_of_date": "2026-06-27",
        },
        "articles": [
            {"id": "h1", "date": "2025-09-19", "outlet": "AP",
             "title": "Trump proclamation imposes $100,000 H-1B fee",
             "snippet": "Proclamation 10973 imposes a $100,000 fee on new H-1B petitions for beneficiaries "
                        "abroad, effective Sept 21."},
            {"id": "h2", "date": "2025-12-23", "outlet": "Reuters",
             "title": "Federal judge in DC upholds the $100,000 H-1B fee",
             "snippet": "Judge Beryl Howell grants summary judgment for the government; the fee stays in effect."},
            {"id": "h3", "date": "2026-03-18", "outlet": "Bloomberg Law",
             "title": "DC Circuit hears argument on the H-1B fee appeal",
             "snippet": "The appeals court hears the Chamber of Commerce challenge; a decision is pending."},
            {"id": "h4", "date": "2026-06-08", "outlet": "Reuters",
             "title": "Massachusetts court strikes down and vacates the $100,000 H-1B fee",
             "snippet": "A second federal court finds the fee an unlawful tax and vacates the implementing "
                        "policy in full — the opposite of the DC ruling."},
            {"id": "h5", "date": "2026-06-12", "outlet": "AP",
             "title": "Administration appeals; court stays its own vacatur, fee remains in effect",
             "snippet": "DOJ appeals to the First Circuit; the district court stays its vacatur pending "
                        "appeal, so the fee continues for now."},
            {"id": "h6", "date": "2026-06-17", "outlet": "Law firm blog",
             "title": "What the split H-1B rulings mean for employers",
             "snippet": "Analysis of the conflicting decisions; no new court action."},
        ],
        "expected": {
            "events": [
                {"article_id": "h1", "date": "2025-09-19", "event_type": "substantive",
                 "is_material": True, "what_moved": "The $100,000 fee is imposed."},
                {"article_id": "h2", "date": "2025-12-23", "event_type": "merits",
                 "is_material": True, "what_moved": "DC district court upholds the fee."},
                {"article_id": "h3", "date": "2026-03-18", "event_type": "procedural",
                 "is_material": True, "what_moved": "DC Circuit hears the appeal; no decision yet."},
                {"article_id": "h4", "date": "2026-06-08", "event_type": "merits",
                 "is_material": True, "what_moved": "Massachusetts court vacates the fee as an unlawful tax "
                                                    "— conflicts with the DC ruling."},
                {"article_id": "h5", "date": "2026-06-12", "event_type": "procedural",
                 "is_material": True, "what_moved": "Stay keeps the fee in effect pending the First Circuit "
                                                    "appeal — does not decide the merits."},
                {"article_id": "h6", "date": "2026-06-17", "event_type": "noise",
                 "is_material": False, "what_moved": ""},
            ],
            "resolution": {"outcome": "not_yet", "decided_by_article_id": None,
                           "rationale": "Two MERITS rulings exist but they CONFLICT (DC upheld; Massachusetts "
                                        "vacated) and both are on appeal; the vacatur is stayed and SCOTUS review "
                                        "is expected. Nothing is final and non-appealable, so finality is not met."},
            "pending_trigger": {"exists": True,
                                "description": "D.C. Circuit decision pending after March argument; First "
                                               "Circuit appeal just filed; Supreme Court likely to resolve the "
                                               "circuit split.", "date": None, "evidence_article_id": "h5"},
            "last_material_date": "2026-06-12",
            "last_coverage_date": "2026-06-17",
            "notes_for_humans": "A blockbuster, but currently STALLED not OPEN: no NEW movement in ~2 weeks and "
                                "the outcome now waits on appellate courts (a clear pending trigger). Conflicting "
                                "district rulings mean the question is wide open.",
        },
        "expected_status": "STALLED",
    },
    {
        "name": "greencard-reexam-orphaned",
        "teaches": "the product's whole point. A huge, unresolved action goes quiet. Do NOT invent a "
                   "pending trigger from adjacent litigation; an advisory explainer is noise, not "
                   "coverage of THIS thread. ORPHANED requires exactly this positive evidence.",
        "thread": {
            "id": "greencard-reexam-19-countries",
            "question": "Will the mass re-examination of existing green cards from the designated high-risk "
                        "countries lead to large-scale revocations, or be halted?",
            "resolution_criteria": {
                "resolved_yes": "The government moves to revoke or place in proceedings a large share of the "
                                "re-examined green cards.",
                "resolved_no": "The review is rescinded, enjoined, or closed without large-scale action.",
                "moot": "Superseded by a different policy.",
            },
            "known_pending_trigger": {"exists": False, "description": "", "date": None},
            "as_of_date": "2026-06-27",
        },
        "articles": [
            {"id": "g1", "date": "2025-11-27", "outlet": "CNN",
             "title": "US to reexamine all green cards from 19 countries after DC shooting",
             "snippet": "After a deadly DC shooting, the administration orders a re-examination of green cards "
                        "from 19 countries and halts Afghan processing."},
            {"id": "g2", "date": "2025-12-12", "outlet": "News explainer",
             "title": "3.3 million green-card holders reported under federal review",
             "snippet": "Reporting says millions of LPRs are under review as enforcement expands to lawful "
                        "permanent residents."},
            {"id": "g3", "date": "2026-01-15", "outlet": "Reuters",
             "title": "USCIS expands indefinite processing hold to 39 countries",
             "snippet": "The hold now spans virtually all benefit categories, including green cards, for "
                        "nationals of 39 countries."},
            {"id": "g4", "date": "2026-05-20", "outlet": "Law firm blog",
             "title": "Removal grounds for green-card holders in 2026",
             "snippet": "An advisory explainer on how LPRs can lose status; not tied to any new development "
                        "in the re-examination."},
        ],
        "expected": {
            "events": [
                {"article_id": "g1", "date": "2025-11-27", "event_type": "substantive",
                 "is_material": True, "what_moved": "The mass green-card re-examination is ordered."},
                {"article_id": "g2", "date": "2025-12-12", "event_type": "substantive",
                 "is_material": True, "what_moved": "Scale reported: about 3.3M LPRs under review."},
                {"article_id": "g3", "date": "2026-01-15", "event_type": "substantive",
                 "is_material": True, "what_moved": "Processing hold expanded to 39 countries."},
                {"article_id": "g4", "date": "2026-05-20", "event_type": "noise",
                 "is_material": False, "what_moved": ""},
            ],
            "resolution": {"outcome": "not_yet", "decided_by_article_id": None,
                           "rationale": "The review is ongoing; no outcome — neither large-scale revocations nor "
                                        "a halt — has occurred. Silence is not resolution."},
            "pending_trigger": {"exists": False, "description": "", "date": None,
                                "evidence_article_id": None},
            "last_material_date": "2026-01-15",
            "last_coverage_date": "2026-05-20",
            "notes_for_humans": "ORPHAN CANDIDATE. Do NOT invent a pending trigger: this is an executive "
                                "administrative review with no announced decision date and no court case "
                                "adjudicating ITS outcome (adjacent vetting litigation is a different thread). "
                                "The only recent item is an advisory explainer (noise), not coverage of the "
                                "review's progress. A 3.3M-person action grinds on unresolved while the press "
                                "has moved on.",
        },
        "expected_status": "ORPHANED",
    },
]


def build_fewshot(names: list[str]) -> list[dict]:
    """Turn selected labeled examples into in-context example messages for the API call."""
    msgs = []
    for ex in LABELED_EXAMPLES:
        if ex["name"] in names:
            msgs.append({"role": "user",
                         "content": json.dumps({"thread": ex["thread"], "articles": ex["articles"]},
                                               ensure_ascii=False)})
            msgs.append({"role": "assistant", "content": json.dumps(ex["expected"], ensure_ascii=False)})
    return msgs


# Default few-shot spans the three SUBTLE verdicts (the easy OPEN state needs no example).
# Rotate or add your own; more examples = better guidance but more tokens per call.
FEWSHOT = build_fewshot(["protected-status-stalled", "sevis-f1-resolved", "greencard-reexam-orphaned"])


def _days_between(later: str, earlier: str) -> int:
    return (dt.date.fromisoformat(later) - dt.date.fromisoformat(earlier)).days


def compute_status(llm: dict, as_of_date: str) -> dict:
    """Deterministic status from the LLM's semantic output. The orphan guardrails are
    enforced HERE — in plain, auditable code — not by the model."""
    outcome = llm["resolution"]["outcome"]
    pending = bool(llm["pending_trigger"]["exists"])
    last_material = llm.get("last_material_date")
    last_coverage = llm.get("last_coverage_date")

    # 1) Resolved (finality was already enforced in the prompt).
    if outcome in ("yes", "no", "moot"):
        return {"status": "RESOLVED",
                "reason": f"Resolved ({outcome}). {llm['resolution']['rationale']}"}

    # Nothing to judge yet.
    if not last_material and not last_coverage:
        return {"status": "STALLED", "reason": "No material development or coverage on record yet."}

    days_since_material = _days_between(as_of_date, last_material) if last_material else 10_000
    days_since_coverage = _days_between(as_of_date, last_coverage) if last_coverage else 10_000

    # 2) Recent material movement -> OPEN.
    if days_since_material <= ACTIVE_WINDOW:
        return {"status": "OPEN", "reason": f"Material development {days_since_material}d ago."}

    # 3) GUARDRAIL: a known pending trigger means quiet-but-alive, never abandoned.
    #    (This is the line that keeps the TPS thread out of the orphan pile.)
    if pending:
        return {"status": "STALLED",
                "reason": f"Awaiting a known pending trigger: {llm['pending_trigger']['description']}"}

    # 4) Coverage still warm -> still being watched -> STALLED.
    if days_since_coverage <= SILENCE_WINDOW:
        return {"status": "STALLED",
                "reason": f"No new movement, but still covered {days_since_coverage}d ago."}

    # 5) ORPHANED needs POSITIVE evidence: open question, no pending trigger, material
    #    silence past the orphan window, AND coverage itself has gone quiet.
    if days_since_material >= ORPHAN_WINDOW and days_since_coverage > SILENCE_WINDOW:
        return {"status": "ORPHANED",
                "reason": (f"Open question, no pending trigger, no material movement in "
                           f"{days_since_material}d and no coverage in {days_since_coverage}d — "
                           f"the press dropped a still-unresolved story.")}

    # 6) Cautious default. When unsure, it is STALLED, not ORPHANED.
    return {"status": "STALLED", "reason": "Quiet, but evidence is insufficient to call it abandoned."}


def classify_thread(thread: dict, articles: list[dict], client: anthropic.Anthropic | None = None) -> dict:
    """Full pipeline for one thread. `thread` needs: id, question, resolution_criteria,
    known_pending_trigger, as_of_date. `articles`: list of {id,date,outlet,title,snippet}."""
    client = client or anthropic.Anthropic()
    payload = {"thread": thread, "articles": articles}
    resp = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=FEWSHOT + [{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
    )
    text = resp.content[0].text.strip()
    text = text[text.find("{"): text.rfind("}") + 1]   # strip any stray code fences
    llm = json.loads(text)
    status = compute_status(llm, thread["as_of_date"])
    return {**status, "evidence": llm}


def fetch_gdelt_articles(query: str, timespan: str = "12m", maxrecords: int = 250) -> list[dict]:
    """Pull candidate articles for a thread from GDELT DOC 2.0 (artList mode) — the same
    free source behind the coverage curve. Returns rows mapped to the classifier's shape.

    NOTE: GDELT gives you COVERAGE, not ground-truth events. For the 'activity' signal
    (substantive real-world developments) prefer GDELT's Events/GKG stream or an event
    feed like ICG CrisisWatch / ACLED, then merge. See GDELT DOC 2.0 docs for current params.
    """
    base = "https://api.gdeltproject.org/api/v2/doc/doc"
    qs = urllib.parse.urlencode(
        {"query": query, "mode": "artList", "format": "json",
         "timespan": timespan, "maxrecords": maxrecords, "sort": "datedesc"}
    )
    with urllib.request.urlopen(f"{base}?{qs}", timeout=30) as r:
        data = json.loads(r.read().decode("utf-8"))
    out = []
    for i, a in enumerate(data.get("articles", [])):
        seen = a.get("seendate", "")  # "YYYYMMDDTHHMMSSZ"
        iso = f"{seen[0:4]}-{seen[4:6]}-{seen[6:8]}" if len(seen) >= 8 else None
        out.append({"id": f"g{i}", "date": iso, "outlet": a.get("domain", ""),
                    "title": a.get("title", ""), "snippet": a.get("title", "")})
    return out


def eval_examples() -> bool:
    """Offline regression suite — no API key needed. Runs the DETERMINISTIC half on every
    labeled example's expected LLM output and checks it against the labeled verdict. This is
    how you catch a guardrail regression before it ships (e.g. an orphan false-positive)."""
    ok = True
    for ex in LABELED_EXAMPLES:
        got = compute_status(ex["expected"], ex["thread"]["as_of_date"])
        passed = got["status"] == ex["expected_status"]
        ok = ok and passed
        mark = "PASS" if passed else "FAIL"
        print(f"[{mark}] {ex['name']:<28} expected {ex['expected_status']:<9} got {got['status']:<9}")
        print(f"       why: {got['reason']}")
    print("\nAll guardrails holding." if ok else "\n*** A verdict regressed — inspect above. ***")
    return ok


if __name__ == "__main__":
    eval_examples()
    # Full pipeline on a live thread (needs ANTHROPIC_API_KEY):
    #   thread = LABELED_EXAMPLES[3]["thread"]            # the green-card re-exam thread
    #   articles = fetch_gdelt_articles("green card review 19 countries")
    #   print(classify_thread(thread, articles))

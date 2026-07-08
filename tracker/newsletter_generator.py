"""
newsletter_generator.py
=======================
Auto-drafts the "Still Developing" issue from tracked, classified threads — the funnel
that runs off the tracker.

The loop this closes:
  classifier tracks N threads
    -> this SELECTS the lead + status board          (deterministic code — no LLM)
    -> an LLM DRAFTS the issue in house style        (writing only)
    -> it emits a FACT-CHECK CHECKLIST                (for the ~10-minute human glance)

Two rules carried over from the classifier, and they are the whole reason this is a
credible funnel instead of an embarrassment generator:
  1. CODE decides what goes in (selection); the LLM only writes.
  2. The writer may use ONLY the facts handed to it. It must never invent news. Anything
     it can't support becomes a literal [VERIFY: ...] marker, and every load-bearing fact
     is surfaced in the checklist so a human confirms it before send.

Never ship the output untouched. "AI drafts it, you glance for 10 minutes, then send."
"""

from __future__ import annotations
import json

import anthropic  # pip install anthropic

# Reuse the engine: the model default, the date helper, and sample threads for the demo.
from dropped_story_classifier import MODEL, _days_between, LABELED_EXAMPLES, compute_status


# --------------------------------------------------------------------------------------
# 1) SELECTION — deterministic. An orphan IS the newsletter's reason to exist, so it leads
#    when present; lead-worthiness = importance, then how long it's been silent (a longer
#    silence is a better "nobody followed up" story). No LLM here.
# --------------------------------------------------------------------------------------
def _importance(t: dict) -> float:
    return float(t.get("importance", 0.5))


def _silence_days(t: dict, as_of: str) -> int:
    lm = t["classification"]["evidence"].get("last_material_date")
    return _days_between(as_of, lm) if lm else 0


def select_issue_content(threads: list[dict], as_of_date: str, max_status_items: int = 4) -> dict:
    """Pick the lead + status-board threads. `threads` are tracked threads shaped as
    {thread, classification:{status, reason, evidence}, importance?, key_facts?}."""
    if not threads:
        return {"lead": None, "status_board": []}
    orphans = [t for t in threads if t["classification"]["status"] == "ORPHANED"]
    pool = orphans or threads
    lead = max(pool, key=lambda t: (_importance(t), _silence_days(t, as_of_date)))
    rest = sorted((t for t in threads if t is not lead), key=lambda t: -_importance(t))
    return {"lead": lead, "status_board": rest[:max_status_items]}


# --------------------------------------------------------------------------------------
# 2) FACT-CHECK CHECKLIST — deterministic. Everything the human should reconfirm before
#    send: that each status hasn't moved, plus every material event and verified fact used.
# --------------------------------------------------------------------------------------
def fact_check_list(selected: dict) -> list[str]:
    lines: list[str] = []
    picked = ([("LEAD", selected["lead"])] if selected["lead"] else []) \
        + [("BOARD", t) for t in selected["status_board"]]
    for role, t in picked:
        lines.append(f"[{role}] {t['thread']['question']}")
        lines.append(f"    - Status is {t['classification']['status']}: reconfirm it hasn't changed since publish.")
        for e in t["classification"]["evidence"].get("events", []):
            if e.get("is_material"):
                lines.append(f"    - {e['date']}: {e['what_moved']}  (still accurate?)")
        for kf in t.get("key_facts", []):
            lines.append(f"    - VERIFY FACT: {kf}")
    return lines


# --------------------------------------------------------------------------------------
# 3) DRAFTING — the LLM writes, using only the structured facts below.
# --------------------------------------------------------------------------------------
NEWSLETTER_SYSTEM = """\
You draft one issue of "Still Developing," a newsletter about stories the news cycle
dropped and where they now stand. You are given a LEAD thread and a few STATUS-BOARD
threads. Each has: its question, current status, the reason for that status, its material
events (date + what moved), notes, and any verified key facts.

HARD RULES (these make or break the newsletter's credibility):
- Use ONLY the facts provided. Do NOT invent numbers, names, dates, events, or quotes. If
  you want a fact you were not given, either write around it or insert a literal
  [VERIFY: what you'd need] marker. Never fabricate to fill a gap.
- No quotes attributed to real people.
- Framing discipline: this is about ATTENTION, not concealment. Coverage "faded" or "moved
  on" — never say anyone is "hiding," "burying," or "censoring" anything.
- This is a DRAFT for human review; leaving [VERIFY] markers is fine and expected.

OUTPUT — markdown, match this structure exactly:
# STILL DEVELOPING
### The stories the news cycle dropped — and where they actually stand.
**Issue #{issue_number} · {issue_date}**
*<one italic sentence of standfirst>*
---
## <lead headline>
<3-5 short paragraphs on the LEAD: what everyone remembers, then what quietly happened
since, then the honest attention-cycle point. Every claim grounded in the provided facts.>
---
## The status board
<one entry per status-board thread:>
**{badge} {STATUS} — <tight headline>.**
<1-2 sentences on where it stands, from the facts.>
*Last movement / waiting on: ...*
---
*<short sign-off plus a reply-and-subscribe line>*

Status badges: 🟢 OPEN (Developing), 🔴 STALLED, ⚪ RESOLVED, 🟠 ORPHANED.
Keep the whole issue tight — roughly 600-800 words.
"""


def _thread_brief(t: dict) -> dict:
    """The writer-relevant facts for one thread — nothing the model could hallucinate from."""
    ev = t["classification"]["evidence"]
    return {
        "question": t["thread"]["question"],
        "status": t["classification"]["status"],
        "why": t["classification"]["reason"],
        "material_events": [{"date": e["date"], "what_moved": e["what_moved"]}
                            for e in ev.get("events", []) if e.get("is_material")],
        "notes": ev.get("notes_for_humans", ""),
        "key_facts": t.get("key_facts", []),
    }


def draft_issue(threads: list[dict], as_of_date: str, issue_number: int = 1,
                issue_date: str | None = None, client: anthropic.Anthropic | None = None,
                model: str = MODEL) -> dict:
    """Full funnel step: select -> draft -> checklist. Returns markdown + the checklist.
    Needs ANTHROPIC_API_KEY for the drafting call."""
    selected = select_issue_content(threads, as_of_date)
    if not selected["lead"]:
        return {"markdown": "", "fact_check": [], "selected": selected}
    client = client or anthropic.Anthropic()
    payload = {
        "issue_number": issue_number,
        "issue_date": issue_date or as_of_date,
        "lead": _thread_brief(selected["lead"]),
        "status_board": [_thread_brief(t) for t in selected["status_board"]],
    }
    resp = client.messages.create(
        model=model, max_tokens=2000, system=NEWSLETTER_SYSTEM,
        messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
    )
    return {"markdown": resp.content[0].text.strip(),
            "fact_check": fact_check_list(selected), "selected": selected}


# --------------------------------------------------------------------------------------
# Demo: wrap the classifier's labeled threads as "tracked threads" and show the SELECTION
# + CHECKLIST offline (no API key). The orphan should auto-win the lead slot.
# --------------------------------------------------------------------------------------
def _demo_threads() -> list[dict]:
    key_facts = {
        "greencard-reexam-19-countries": ["~3.3 million lawful permanent residents reported under review",
                                          "Review ordered after the November 2025 Washington shooting"],
        "h1b-100k-fee": ["The fee is $100,000 per new H-1B petition (Proclamation 10973)"],
    }
    importance = {"greencard-reexam-19-countries": 0.9, "h1b-100k-fee": 0.7,
                  "sevis-f1-2025": 0.6, "example-protected-status": 0.5}
    out = []
    for ex in LABELED_EXAMPLES:
        tid = ex["thread"]["id"]
        cls = compute_status(ex["expected"], ex["thread"]["as_of_date"])
        out.append({"thread": ex["thread"],
                    "classification": {**cls, "evidence": ex["expected"]},
                    "key_facts": key_facts.get(tid, []),
                    "importance": importance.get(tid, 0.5)})
    return out


if __name__ == "__main__":
    threads = _demo_threads()
    sel = select_issue_content(threads, as_of_date="2026-06-27")
    print("Auto-selected LEAD:")
    print(f"  {sel['lead']['classification']['status']}  {sel['lead']['thread']['question']}\n")
    print("Status board:")
    for t in sel["status_board"]:
        print(f"  {t['classification']['status']:<9} {t['thread']['question']}")
    print("\n--- FACT-CHECK CHECKLIST (your ~10-minute glance before send) ---")
    print("\n".join(fact_check_list(sel)))
    print("\nTo generate the full issue markdown:")
    print("  draft_issue(threads, '2026-06-27')   # needs ANTHROPIC_API_KEY")

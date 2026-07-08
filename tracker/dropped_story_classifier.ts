/**
 * dropped_story_classifier.ts
 * ===========================
 * TypeScript reference port of the classifier core, for integration into a TS site.
 *
 * WHAT THIS IS: the codebase-INDEPENDENT logic — the LLM prompt, the deterministic
 * state machine, and the four labeled test cases. Port this into your conventions; the
 * status rule and the prompt must survive unchanged (that's where the guardrails live).
 *
 * WHAT FABLE STILL WIRES (marked TODO below, against the real codebase): the Anthropic
 * client call, the GDELT fetch, and DB persistence. Those depend on your stack.
 *
 * INVARIANT: after integration, evalExamples() must still return true. The four cases are
 * the guarantee that the port didn't lose the cry-wolf guardrails. Keep them in CI.
 *
 * Design principle (do not collapse): the LLM makes ONLY semantic judgments; computeStatus
 * turns them into a status deterministically. Never let the model output a status directly.
 */

// ---- Types ---------------------------------------------------------------------------
export type EventType = "merits" | "procedural" | "substantive" | "noise";
export type Outcome = "yes" | "no" | "moot" | "not_yet";
export type Status = "OPEN" | "STALLED" | "RESOLVED" | "ORPHANED";

export interface Article { id: string; date: string; outlet: string; title: string; snippet: string; }

export interface ThreadEvent {
  article_id: string; date: string; event_type: EventType; is_material: boolean; what_moved: string;
}
export interface Resolution { outcome: Outcome; decided_by_article_id: string | null; rationale: string; }
export interface PendingTrigger {
  exists: boolean; description: string; date: string | null; evidence_article_id: string | null;
}
export interface LlmOutput {
  events: ThreadEvent[];
  resolution: Resolution;
  pending_trigger: PendingTrigger;
  last_material_date: string | null;
  last_coverage_date: string | null;
  notes_for_humans: string;
}
export interface Thread {
  id: string;
  question: string;
  resolution_criteria: { resolved_yes: string; resolved_no: string; moot: string };
  known_pending_trigger: { exists: boolean; description: string; date: string | null };
  as_of_date: string;
}
export interface StatusResult { status: Status; reason: string; }

// ---- Thresholds (days). Tune per domain; litigation is slow, breaking news is fast. --
export const ACTIVE_WINDOW = 14;   // material movement within this window  -> OPEN
export const SILENCE_WINDOW = 21;  // any coverage within this window keeps it STALLED not ORPHANED
export const ORPHAN_WINDOW = 42;   // material silence this long is NECESSARY (not sufficient) for ORPHANED
export const MODEL = "claude-sonnet-4-6"; // extraction; bump to an Opus model for hard threads

function daysBetween(later: string, earlier: string): number {
  return Math.round((Date.parse(later) - Date.parse(earlier)) / 86_400_000);
}

// ---- The extraction prompt (verbatim canonical — keep in sync across ports) -----------
export const SYSTEM_PROMPT = `You are a news-thread status analyst. A "thread" is ONE falsifiable question about an
ongoing story (e.g. "Will rule X take effect?", "Will this termination be upheld on final appeal?").
You are given: the question, its resolution criteria, what is already known about any pending trigger,
an as-of date, and a list of articles (date, outlet, title, snippet).

Your job is NARROW. Make only the semantic judgments below. Downstream code computes the status from
your output plus the dates. DO NOT output a status yourself. Return STRICT JSON matching the schema at
the end. No text outside the JSON.

STEP 1 — CLASSIFY EACH ARTICLE
event_type, one of:
  "merits"      A decision/development that can SETTLE the question: a final ruling, an official
                enactment/repeal, an election result, a signed deal, an irreversible action.
  "procedural"  Moves the process but does NOT settle it: stays, injunctions pending appeal, motions,
                scheduled hearings, a case moving to a higher court, interim/temporary orders.
  "substantive" A real-world development relevant to the question but not a resolution: new facts,
                casualties, money moved, a policy action taken, an official statement of intent.
  "noise"       Re-reporting, recaps, opinion/analysis, anniversaries — adds no new development.
is_material: true ONLY if the article reports a NEW development. Recaps and opinion are false EVEN IN
  BULK. "Lots of coverage" is NOT movement. Volume never makes something material.
what_moved: one sentence naming the concrete development, or "" if noise.

STEP 2 — RESOLUTION (finality-gated)
  - ONLY a "merits" event can resolve the question. Procedural/substantive never resolve, however dramatic.
  - Criteria are written around FINALITY. If a ruling can still be appealed or reversed, outcome is
    "not_yet" — NOT "yes"/"no". A party can be currently winning/losing while the question stays open.
  - "Coverage stopped" is NOT resolution.
  - Default to "not_yet". Only assert yes/no/moot when a merits event plainly meets the written criteria.
  Return outcome ("yes"|"no"|"moot"|"not_yet"), decided_by_article_id (or null), rationale.

STEP 3 — PENDING TRIGGER (the key guardrail)
A pending trigger is any known future/in-progress event whose outcome will move the question: an appeal
awaiting ruling, a scheduled vote/hearing/decision, an announced deadline, an active negotiation with a
defined next step. This separates QUIET-BUT-ALIVE (stalled, waiting) from ABANDONED (orphaned). If a
thread has no material update in weeks but a relevant case is sitting in an appeals court, it is NOT
abandoned — it is waiting. Derive it from BOTH known_pending_trigger AND the articles. A pending trigger
does NOT require a date — "in active litigation" counts.
  Return exists (bool), description, date (or null), evidence_article_id (or null).

STEP 4 — DATES
last_material_date: most recent date among is_material=true articles (or null)
last_coverage_date: most recent date among ALL articles (or null)

OUTPUT SCHEMA (return exactly this shape):
{
  "events": [{"article_id": str, "date": "YYYY-MM-DD", "event_type": str, "is_material": bool, "what_moved": str}],
  "resolution": {"outcome": str, "decided_by_article_id": str|null, "rationale": str},
  "pending_trigger": {"exists": bool, "description": str, "date": "YYYY-MM-DD"|null, "evidence_article_id": str|null},
  "last_material_date": "YYYY-MM-DD"|null,
  "last_coverage_date": "YYYY-MM-DD"|null,
  "notes_for_humans": str
}`;

// ---- The deterministic state machine. Guardrails live HERE — do not weaken them. -----
export function computeStatus(llm: LlmOutput, asOfDate: string): StatusResult {
  const { outcome, rationale } = llm.resolution;
  const pending = llm.pending_trigger.exists;
  const lastMaterial = llm.last_material_date;
  const lastCoverage = llm.last_coverage_date;

  // 1) Resolved (finality already enforced in the prompt).
  if (outcome === "yes" || outcome === "no" || outcome === "moot") {
    return { status: "RESOLVED", reason: `Resolved (${outcome}). ${rationale}` };
  }
  // Nothing to judge yet.
  if (!lastMaterial && !lastCoverage) {
    return { status: "STALLED", reason: "No material development or coverage on record yet." };
  }
  const dsMaterial = lastMaterial ? daysBetween(asOfDate, lastMaterial) : 10_000;
  const dsCoverage = lastCoverage ? daysBetween(asOfDate, lastCoverage) : 10_000;

  // 2) Recent material movement -> OPEN.
  if (dsMaterial <= ACTIVE_WINDOW) {
    return { status: "OPEN", reason: `Material development ${dsMaterial}d ago.` };
  }
  // 3) GUARDRAIL: a known pending trigger means quiet-but-alive, never abandoned.
  if (pending) {
    return { status: "STALLED", reason: `Awaiting a known pending trigger: ${llm.pending_trigger.description}` };
  }
  // 4) Coverage still warm -> still watched -> STALLED.
  if (dsCoverage <= SILENCE_WINDOW) {
    return { status: "STALLED", reason: `No new movement, but still covered ${dsCoverage}d ago.` };
  }
  // 5) ORPHANED needs POSITIVE evidence: open question, no pending trigger, material silence past the
  //    orphan window, AND coverage itself gone quiet.
  if (dsMaterial >= ORPHAN_WINDOW && dsCoverage > SILENCE_WINDOW) {
    return {
      status: "ORPHANED",
      reason: `Open question, no pending trigger, no material movement in ${dsMaterial}d and no coverage in ${dsCoverage}d — the press dropped a still-unresolved story.`,
    };
  }
  // 6) Cautious default. When unsure, STALLED, never ORPHANED.
  return { status: "STALLED", reason: "Quiet, but evidence insufficient to call it abandoned." };
}

// ---- TODO(Fable): wire against the real codebase -------------------------------------
// Call Anthropic with SYSTEM_PROMPT + few-shot (port LABELED_EXAMPLES to example messages) +
// {thread, articles} as JSON; parse the JSON reply into LlmOutput; then computeStatus(llm, thread.as_of_date).
export async function classifyThread(_thread: Thread, _articles: Article[]): Promise<StatusResult & { evidence: LlmOutput }> {
  throw new Error("TODO(Fable): implement the Anthropic call using your client, then computeStatus().");
}
// GDELT DOC 2.0 artList: https://api.gdeltproject.org/api/v2/doc/doc?query=...&mode=artList&format=json&timespan=12m
// Map each article's seendate (YYYYMMDDTHHMMSSZ) -> "YYYY-MM-DD". GDELT is COVERAGE; for the "still live"
// signal use GDELT Events/GKG or ACLED/CrisisWatch.
export async function fetchGdeltArticles(_query: string): Promise<Article[]> {
  throw new Error("TODO(Fable): implement GDELT DOC 2.0 artList fetch.");
}

// ---- Labeled examples = few-shot guidance AND regression suite. Keep passing in CI. --
interface LabeledExample { name: string; thread: Thread; expected: LlmOutput; expected_status: Status; }

export const LABELED_EXAMPLES: LabeledExample[] = [
  {
    name: "protected-status-stalled",
    thread: {
      id: "example-protected-status",
      question: "Will the termination of a protected-status program be upheld with all appeals exhausted?",
      resolution_criteria: {
        resolved_yes: "A final, non-appealable judgment upholds the termination.",
        resolved_no: "A final, non-appealable judgment restores the status.",
        moot: "Legislation or agency rescission moots the litigation.",
      },
      known_pending_trigger: { exists: false, description: "", date: null },
      as_of_date: "2026-06-27",
    },
    expected: {
      events: [
        { article_id: "x1", date: "2025-09-05", event_type: "merits", is_material: true, what_moved: "A final order vacated the termination." },
        { article_id: "x2", date: "2025-10-03", event_type: "procedural", is_material: true, what_moved: "SCOTUS stayed that order pending appeal; does not decide it." },
        { article_id: "x3", date: "2026-02-10", event_type: "noise", is_material: false, what_moved: "" },
      ],
      resolution: { outcome: "not_yet", decided_by_article_id: null, rationale: "The merits order was stayed and is under appeal; nothing is final and non-appealable." },
      pending_trigger: { exists: true, description: "Merits appeal pending before the appeals court; no scheduled date.", date: null, evidence_article_id: "x2" },
      last_material_date: "2025-10-03",
      last_coverage_date: "2026-02-10",
      notes_for_humans: "Quiet since February, but a decisive appeal is pending — waiting, not abandoned.",
    },
    expected_status: "STALLED",
  },
  {
    name: "sevis-f1-resolved",
    thread: {
      id: "sevis-f1-2025",
      question: "Will the spring-2025 NCIC-based mass SEVIS record terminations be reversed?",
      resolution_criteria: {
        resolved_yes: "The government rescinds the mass terminations and restores the records.",
        resolved_no: "Courts uphold the terminations and the records stay terminated.",
        moot: "A settlement or legislation supersedes the dispute.",
      },
      known_pending_trigger: { exists: false, description: "", date: null },
      as_of_date: "2026-06-27",
    },
    expected: {
      events: [
        { article_id: "f1", date: "2025-03-28", event_type: "substantive", is_material: true, what_moved: "Mass SEVIS terminations begin." },
        { article_id: "f3", date: "2025-04-25", event_type: "merits", is_material: true, what_moved: "ICE rescinded the mass terminations and restored records — reverses the action." },
        { article_id: "f4", date: "2025-05-23", event_type: "substantive", is_material: true, what_moved: "Nationwide injunction plus a NEW framework — opens a successor question." },
      ],
      resolution: { outcome: "yes", decided_by_article_id: "f3", rationale: "ICE rescinded the terminations and restored records; the narrow question resolves YES. Storyline not closed (see notes)." },
      pending_trigger: { exists: false, description: "", date: null, evidence_article_id: null },
      last_material_date: "2025-05-23",
      last_coverage_date: "2025-05-23",
      notes_for_humans: "RESOLVED != storyline closed. The replacement framework is in active litigation — spawn a SUCCESSOR thread.",
    },
    expected_status: "RESOLVED",
  },
  {
    name: "h1b-100k-fee-stalled",
    thread: {
      id: "h1b-100k-fee",
      question: "Will the $100,000 H-1B fee (Proclamation 10973) be struck down with appeals exhausted?",
      resolution_criteria: {
        resolved_yes: "A final, non-appealable judgment (or Supreme Court ruling) vacates the fee.",
        resolved_no: "A final, non-appealable judgment upholds the fee.",
        moot: "The proclamation is rescinded or superseded.",
      },
      known_pending_trigger: {
        exists: true,
        description: "Appeals pending: D.C. Circuit argued Mar 2026; First Circuit appeal filed Jun 2026; SCOTUS review expected.",
        date: null,
      },
      as_of_date: "2026-06-27",
    },
    expected: {
      events: [
        { article_id: "h2", date: "2025-12-23", event_type: "merits", is_material: true, what_moved: "DC district court upholds the fee." },
        { article_id: "h4", date: "2026-06-08", event_type: "merits", is_material: true, what_moved: "Massachusetts court vacates the fee as an unlawful tax — conflicts with DC." },
        { article_id: "h5", date: "2026-06-12", event_type: "procedural", is_material: true, what_moved: "Stay keeps the fee in effect pending appeal — does not decide the merits." },
        { article_id: "h6", date: "2026-06-17", event_type: "noise", is_material: false, what_moved: "" },
      ],
      resolution: { outcome: "not_yet", decided_by_article_id: null, rationale: "Two MERITS rulings CONFLICT and are both on appeal; the vacatur is stayed and SCOTUS review is expected. Not final." },
      pending_trigger: { exists: true, description: "D.C. and First Circuit appeals pending; SCOTUS likely to resolve the split.", date: null, evidence_article_id: "h5" },
      last_material_date: "2026-06-12",
      last_coverage_date: "2026-06-17",
      notes_for_humans: "A blockbuster, but STALLED not OPEN: no NEW movement in ~2 weeks and awaiting appellate courts.",
    },
    expected_status: "STALLED",
  },
  {
    name: "greencard-reexam-orphaned",
    thread: {
      id: "greencard-reexam-19-countries",
      question: "Will the mass re-examination of existing green cards from the designated high-risk countries lead to large-scale revocations, or be halted?",
      resolution_criteria: {
        resolved_yes: "The government moves to revoke or place in proceedings a large share of the re-examined green cards.",
        resolved_no: "The review is rescinded, enjoined, or closed without large-scale action.",
        moot: "Superseded by a different policy.",
      },
      known_pending_trigger: { exists: false, description: "", date: null },
      as_of_date: "2026-06-27",
    },
    expected: {
      events: [
        { article_id: "g1", date: "2025-11-27", event_type: "substantive", is_material: true, what_moved: "The mass green-card re-examination is ordered." },
        { article_id: "g2", date: "2025-12-12", event_type: "substantive", is_material: true, what_moved: "Scale reported: ~3.3M LPRs under review." },
        { article_id: "g3", date: "2026-01-15", event_type: "substantive", is_material: true, what_moved: "Processing hold expanded to 39 countries." },
        { article_id: "g4", date: "2026-05-20", event_type: "noise", is_material: false, what_moved: "" },
      ],
      resolution: { outcome: "not_yet", decided_by_article_id: null, rationale: "The review is ongoing; no outcome has occurred. Silence is not resolution." },
      pending_trigger: { exists: false, description: "", date: null, evidence_article_id: null },
      last_material_date: "2026-01-15",
      last_coverage_date: "2026-05-20",
      notes_for_humans: "ORPHAN CANDIDATE. No pending trigger (an executive review, no announced decision date, no court case on ITS outcome). The lone recent item is an advisory explainer (noise). A 3.3M-person action grinds on unwatched.",
    },
    expected_status: "ORPHANED",
  },
];

export function evalExamples(): boolean {
  let ok = true;
  for (const ex of LABELED_EXAMPLES) {
    const got = computeStatus(ex.expected, ex.thread.as_of_date);
    const passed = got.status === ex.expected_status;
    ok = ok && passed;
    console.log(`[${passed ? "PASS" : "FAIL"}] ${ex.name.padEnd(28)} expected ${ex.expected_status.padEnd(9)} got ${got.status}`);
  }
  console.log(ok ? "\nAll guardrails holding." : "\n*** A verdict regressed — inspect above. ***");
  return ok;
}

// Demo (remove when integrating). Run: npx tsx dropped_story_classifier.ts
evalExamples();

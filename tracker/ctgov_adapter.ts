/**
 * ctgov_adapter.ts
 * ================
 * ClinicalTrials.gov v2 adapter for the dropped-story status engine.
 *
 * THE POINT (read before extending): this is the tracker engine's easy-mode source.
 * Unlike GDELT, CT.gov gives us thread identity for free (the NCT ID *is* the thread)
 * and structured status fields — so the "LLM makes only semantic judgments" layer
 * collapses to a DETERMINISTIC mapping. No Anthropic call is needed for v1. The
 * design principle from dropped_story_classifier.ts is preserved, not violated:
 * semantic judgments still happen upstream of computeStatus — they're just made by
 * a registry's structured fields instead of a model reading news prose.
 *
 * ORPHANED here maps onto a real, documented phenomenon: trials that completed but
 * never posted results (FDAAA 801 results-reporting noncompliance; prior art:
 * TrialsTracker). That's the product: a status board where ORPHANED = "science
 * finished the experiment and never told anyone the answer."
 *
 * INVARIANT: computeStatus() is imported unchanged. evalCtgovExamples() must return
 * true after any edit — keep it in CI next to evalExamples().
 */

import {
  computeStatus,
  type Article,
  type LlmOutput,
  type StatusResult,
  type Thread,
} from "./dropped_story_classifier";

// ---- CT.gov v2 shapes (the subset we read) --------------------------------------------

/** https://clinicaltrials.gov/data-api/api — GET /api/v2/studies/{nctId} */
export interface CtgovStudy {
  protocolSection: {
    identificationModule: { nctId: string; briefTitle: string };
    statusModule: {
      overallStatus: string; // RECRUITING | ACTIVE_NOT_RECRUITING | NOT_YET_RECRUITING | ENROLLING_BY_INVITATION | SUSPENDED | COMPLETED | TERMINATED | WITHDRAWN | UNKNOWN ...
      lastUpdatePostDateStruct?: { date?: string };
      primaryCompletionDateStruct?: { date?: string };
      completionDateStruct?: { date?: string };
      resultsFirstPostDateStruct?: { date?: string };
      whyStopped?: string;
    };
    sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } };
  };
  hasResults?: boolean;
}

// Trial time runs slower than news time. The engine's day-thresholds are module
// constants, so we scale on the INPUT side instead: the reporting-grace window below
// is the domain judgment (12 months post-completion before silence starts counting
// against a trial), after which the engine's ORPHAN_WINDOW does the rest.
export const RESULTS_GRACE_DAYS = 365;

const IN_PROGRESS = new Set([
  "RECRUITING",
  "NOT_YET_RECRUITING",
  "ACTIVE_NOT_RECRUITING",
  "ENROLLING_BY_INVITATION",
]);
const HALTED_FINAL = new Set(["TERMINATED", "WITHDRAWN"]);

function norm(d?: string): string | null {
  if (!d) return null;
  // CT.gov dates arrive as YYYY-MM-DD or YYYY-MM; day-floor the latter.
  return /^\d{4}-\d{2}$/.test(d) ? `${d}-01` : d;
}
function daysBetween(later: string, earlier: string): number {
  return Math.round((Date.parse(later) - Date.parse(earlier)) / 86_400_000);
}

// ---- Study -> Thread -------------------------------------------------------------------

export function studyToThread(study: CtgovStudy, asOfDate: string): Thread {
  const id = study.protocolSection.identificationModule.nctId;
  const title = study.protocolSection.identificationModule.briefTitle;
  return {
    id,
    question: `Will ${id} ("${title}") report results?`,
    resolution_criteria: {
      resolved_yes: "Results posted on ClinicalTrials.gov (resultsFirstPostDate present).",
      resolved_no: "Sponsor formally states results will not be reported.",
      moot: "Trial terminated or withdrawn before meaningful data collection.",
    },
    known_pending_trigger: pendingFor(study, asOfDate).exists
      ? {
          exists: true,
          description: pendingFor(study, asOfDate).description,
          date: pendingFor(study, asOfDate).date,
        }
      : { exists: false, description: "", date: null },
    as_of_date: asOfDate,
  };
}

// ---- Study -> pseudo-articles (the registry's own events, dated) ------------------------

export function studyToArticles(study: CtgovStudy, asOfDate: string): Article[] {
  const s = study.protocolSection.statusModule;
  const nct = study.protocolSection.identificationModule.nctId;
  const outlet = "ClinicalTrials.gov";
  const out: Article[] = [];
  // Future-dated registry fields (a primary completion scheduled for next year) are
  // ANTICIPATED, not materialized — they feed the pending trigger, never the event
  // stream, or a silent trial would look freshly active. Caught by the test suite.
  const push = (id: string, date: string | null, title: string) => {
    if (date && Date.parse(date) <= Date.parse(asOfDate)) out.push({ id: `${nct}:${id}`, date, outlet, title, snippet: title });
  };
  push("update", norm(s.lastUpdatePostDateStruct?.date), `Registry record updated (status: ${s.overallStatus})`);
  push("primary-completion", norm(s.primaryCompletionDateStruct?.date), "Primary completion date");
  push("completion", norm(s.completionDateStruct?.date), "Study completion date");
  push("results", norm(s.resultsFirstPostDateStruct?.date), "Results first posted");
  return out;
}

// ---- The deterministic "semantic" layer (replaces the LLM for this source) --------------

function pendingFor(
  study: CtgovStudy,
  asOfDate: string,
): { exists: boolean; description: string; date: string | null } {
  const s = study.protocolSection.statusModule;
  if (IN_PROGRESS.has(s.overallStatus)) {
    return {
      exists: true,
      description: `Trial in progress (${s.overallStatus}); primary completion ${s.primaryCompletionDateStruct?.date ?? "TBD"}.`,
      date: norm(s.primaryCompletionDateStruct?.date),
    };
  }
  // Completed trials keep a pending trigger through the results-reporting grace window:
  // "quiet but the clock is still legitimately running" is STALLED, not ORPHANED.
  if (s.overallStatus === "COMPLETED" && !study.hasResults) {
    const done = norm(s.completionDateStruct?.date ?? s.primaryCompletionDateStruct?.date);
    if (done && daysBetween(asOfDate, done) <= RESULTS_GRACE_DAYS) {
      return {
        exists: true,
        description: `Completed ${done}; within the ${RESULTS_GRACE_DAYS}d results-reporting window.`,
        date: null,
      };
    }
  }
  return { exists: false, description: "", date: null };
}

export function studyToLlmOutput(study: CtgovStudy, asOfDate: string): LlmOutput {
  const s = study.protocolSection.statusModule;
  const articles = studyToArticles(study, asOfDate);
  const results = norm(s.resultsFirstPostDateStruct?.date);
  const nct = study.protocolSection.identificationModule.nctId;

  const events = articles.map((a) => ({
    article_id: a.id,
    date: a.date,
    event_type: (a.id.endsWith(":results") || (HALTED_FINAL.has(s.overallStatus) && a.id.endsWith(":update"))
      ? "merits"
      : "substantive") as LlmOutput["events"][number]["event_type"],
    is_material: true, // every registry event is a real development; the registry has no "noise"
    what_moved: a.title,
  }));

  let resolution: LlmOutput["resolution"];
  if (results || study.hasResults) {
    resolution = {
      outcome: "yes",
      decided_by_article_id: results ? `${nct}:results` : null,
      rationale: "Results posted on the registry.",
    };
  } else if (HALTED_FINAL.has(s.overallStatus)) {
    resolution = {
      outcome: "moot",
      decided_by_article_id: `${nct}:update`,
      rationale: `Trial ${s.overallStatus.toLowerCase()}${s.whyStopped ? `: ${s.whyStopped}` : ""}.`,
    };
  } else {
    resolution = { outcome: "not_yet", decided_by_article_id: null, rationale: "No results posted; question open." };
  }

  const dates = articles.map((a) => a.date).sort();
  const last = dates.length ? dates[dates.length - 1] : null;
  const pending = pendingFor(study, asOfDate);

  return {
    events,
    resolution,
    pending_trigger: { ...pending, evidence_article_id: null },
    // For a registry, material movement and coverage are the same signal. A completed,
    // resultless trial past the grace window therefore goes silent on BOTH clocks —
    // which is exactly what lets computeStatus's positive-evidence ORPHANED rule fire.
    last_material_date: last,
    last_coverage_date: last,
    notes_for_humans: `Deterministic mapping from CT.gov overallStatus=${s.overallStatus}, hasResults=${!!study.hasResults}.`,
  };
}

/** The one-call entry point: study record -> engine status. computeStatus is untouched. */
export function classifyStudy(study: CtgovStudy, asOfDate: string): StatusResult & { evidence: LlmOutput } {
  const evidence = studyToLlmOutput(study, asOfDate);
  return { ...computeStatus(evidence, asOfDate), evidence };
}

// ---- Fetch (CT.gov v2; no key required) --------------------------------------------------

const CTGOV_FIELDS = [
  "protocolSection.identificationModule.nctId",
  "protocolSection.identificationModule.briefTitle",
  "protocolSection.statusModule",
  "protocolSection.sponsorCollaboratorsModule.leadSponsor.name",
  "hasResults",
].join(",");

export async function fetchStudy(nctId: string): Promise<CtgovStudy> {
  const url = `https://clinicaltrials.gov/api/v2/studies/${nctId}?fields=${CTGOV_FIELDS}`;
  const res = await fetch(url, { headers: { "User-Agent": "epistemic-receipts/1.0 (rct-tracker)" } });
  if (!res.ok) throw new Error(`CT.gov ${res.status} for ${nctId}`);
  return (await res.json()) as CtgovStudy;
}

/** Page through a search (e.g. completed trials in a condition) — same fields, cursor-based. */
export async function searchStudies(queryTerm: string, pageToken?: string): Promise<{ studies: CtgovStudy[]; nextPageToken?: string }> {
  const u = new URL("https://clinicaltrials.gov/api/v2/studies");
  u.searchParams.set("query.term", queryTerm);
  u.searchParams.set("fields", CTGOV_FIELDS);
  u.searchParams.set("pageSize", "100");
  if (pageToken) u.searchParams.set("pageToken", pageToken);
  const res = await fetch(u, { headers: { "User-Agent": "epistemic-receipts/1.0 (rct-tracker)" } });
  if (!res.ok) throw new Error(`CT.gov search ${res.status}`);
  return (await res.json()) as { studies: CtgovStudy[]; nextPageToken?: string };
}

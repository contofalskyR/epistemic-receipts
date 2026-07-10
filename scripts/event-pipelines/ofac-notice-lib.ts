/**
 * ofac-notice-lib.ts — shared parsing for OFAC "Recent Actions" notices.
 *
 * Extracted VERBATIM from ofac-delistings.ts (2026-07-10, after its pilot +
 * full run shipped) so the additions date-backfill can reuse the exact same
 * battle-tested SDN-block parsing instead of forking it. No behavior change
 * for the delistings pipeline — same functions, new home.
 *
 * Notice anatomy (verified 2005→2026, same Drupal rendering throughout):
 *   /recent-actions/YYYYMMDD[_NN] → h1 title, Release Date, sections headed
 *   e.g. "The following deletions have been made to OFAC's SDN List" or
 *   "The following individuals have been added to OFAC's SDN list", each
 *   followed by SDN-format entity blocks (one per <p> or <br>-separated).
 */

import { parseHTML } from "linkedom";
import { isoDay, BROWSERISH_HEADERS } from "../../lib/transition-contract";

export const OFAC_BASE = "https://ofac.treasury.gov";

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchHtml(url: string): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(url, { headers: BROWSERISH_HEADERS, redirect: "follow", signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── Notice refs ───────────────────────────────────────────────────────────────

export interface NoticeRef {
  id: string;        // "20260629" or "20260520_33"
  url: string;
  date: string;      // "YYYY-MM-DD" from the id — matches the Release Date
}

export function noticeIdToDate(id: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:_\d+)?$/.exec(id);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return isNaN(d.getTime()) || isoDay(d) !== iso ? null : iso;
}

/** Extract notice links (id + date) from a listing/search page's HTML. */
export function noticeRefsFromListing(html: string): { refs: NoticeRef[]; undatable: string[] } {
  const { document } = parseHTML(html);
  const refs = new Map<string, NoticeRef>();
  const undatable: string[] = [];
  for (const a of Array.from(document.querySelectorAll("a"))) {
    const m = /\/recent-actions\/(\d{8}(?:_\d+)?)\b/.exec(a.getAttribute("href") ?? "");
    if (!m) continue;
    const id = m[1];
    const date = noticeIdToDate(id);
    if (!date) {
      undatable.push(id);
      continue;
    }
    if (!refs.has(id)) refs.set(id, { id, url: `${OFAC_BASE}/recent-actions/${id}`, date });
  }
  return { refs: [...refs.values()], undatable };
}

// ── SDN entry blocks ──────────────────────────────────────────────────────────

export interface SdnEntryBlock {
  raw: string;            // full SDN-format block
  primaryName: string;    // as printed ("AYDIN, Recep Cetin" / "MEGASAN ...")
  matchNames: string[];   // candidate names to match against the DB
  individual: boolean;
  programs: string[];     // ["RUSSIA-EO14024"]
}

/** "LAST, First Middle" → "First Middle LAST" (the ingest's fullName frame). */
export function reconstructIndividual(name: string): string | null {
  const m = /^([^,]+),\s*(.+)$/.exec(name);
  return m ? `${m[2].trim()} ${m[1].trim()}` : null;
}

export function parseSdnBlock(raw: string): SdnEntryBlock | null {
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;

  // "(Cyrillic: МАЛЬЦЕВ, Сергей ...)" parentheticals carry commas that poison
  // the comma-split name extraction (2026-07-10 preflight #1: most unmatched
  // individuals were this). The DB names are Latin — strip them everywhere.
  // OFAC NESTS these ("(a.k.a. X (Cyrillic: ...))" — preflight #2's stray ")"),
  // so strip innermost-first ([^()]*) and iterate until stable.
  // Two shapes (additions full-walk review, 2026-07-10):
  //  1. any paren containing non-Latin script chars (Cyrillic, Arabic incl.
  //     presentation forms, Hebrew, CJK, kana);
  //  2. script-LABELED parens regardless of content — "(Latin: CANALES
  //     RIVERA, ...)" transliterations carry commas but only Latin chars.
  let prev: string;
  do {
    prev = text;
    text = text
      .replace(/\([^()]*[Ѐ-ӿ؀-ۿﭐ-﷿ﹰ-﻿֐-׿぀-ヿ一-鿿][^()]*\)/g, " ")
      .replace(/\((?:Latin|Cyrillic|Arabic|Chinese|Japanese|Korean|Hebrew|Greek)(?:\s+script)?\s*:[^()]*\)/gi, " ");
  } while (text !== prev);
  text = text.replace(/\(\s*\)/g, " ").replace(/\s+/g, " ").trim();

  const individual = /\(individual\)/i.test(text);
  // Program tags: usually ALL-CAPS ([RUSSIA-EO14024], [SDGT]) but a few carry
  // digits/mixed case ([561-Related]) — require a leading capital/digit only.
  const programs = [...text.matchAll(/\[([A-Z0-9][A-Za-z0-9-]*)\]/g)].map((m) => m[1]);
  // Program tag is what distinguishes an SDN entry block from stray prose.
  if (programs.length === 0) return null;

  // a.k.a. list (inside the parenthetical after the primary name).
  const akas = [...text.matchAll(/a\.k\.a\.\s+([^;)]+)[;)]/g)]
    .map((m) => m[1].replace(/["“”]/g, "").trim())
    .filter(Boolean);

  let primaryName: string;
  const beforeParen = text.split(/\s+\(a\.k\.a\./)[0];
  if (individual) {
    // "LAST, First Middle, City, Country; DOB ..." → first two comma fields.
    const fields = beforeParen.split(",").map((s) => s.trim()).filter(Boolean);
    primaryName = fields.length >= 2 ? `${fields[0]}, ${fields[1]}` : fields[0];
  } else {
    // Entities: name ends at the first comma. Vessels/aircraft have NO comma —
    // "VYACHESLAV ARSHINOV (UBGX2) General Cargo Russia flag; ..." — so also
    // cut at the first " (" (call-sign/paren) and at the first ";".
    primaryName = beforeParen.split(",")[0].split(" (")[0].split(";")[0].trim();
  }
  if (!primaryName) return null;

  const matchNames = [primaryName, ...akas];
  if (individual) {
    const rebuilt = reconstructIndividual(primaryName);
    if (rebuilt) matchNames.unshift(rebuilt); // ingest frame first — best exact hit
  }

  return { raw: text, primaryName, matchNames, individual, programs };
}

// ── Notice sections ───────────────────────────────────────────────────────────

/** Text lines of a block element, split on <br> boundaries. linkedom's
 *  textContent drops <br> entirely, which would concatenate <br>-separated
 *  SDN entries into one undelimited string — so walk child nodes instead. */
export function blockLines(el: Element): string[] {
  const lines: string[] = [];
  let cur = "";
  const walk = (n: Node) => {
    for (const child of Array.from(n.childNodes)) {
      if (child.nodeType === 1 && (child as Element).tagName === "BR") {
        lines.push(cur);
        cur = "";
      } else if (child.nodeType === 3) {
        cur += child.textContent ?? "";
      } else if (child.nodeType === 1) {
        walk(child);
      }
    }
  };
  walk(el);
  lines.push(cur);
  return lines.map((l) => l.trim()).filter(Boolean);
}

export interface ParsedNoticeSection {
  title: string;
  entries: SdnEntryBlock[];
  hadHeading: boolean;
}

/**
 * Parse the SDN-entry blocks under every heading matching `headingRe`.
 * Sections run from the heading's block container to the next h1–h6 (or the
 * next "following …" section marker). A <p> and its inner <strong> matching
 * the same heading are deduped on the container.
 */
export function parseNoticeSections(html: string, headingRe: RegExp, fallbackTitle: string): ParsedNoticeSection {
  const { document } = parseHTML(html);
  const title = document.querySelector("h1")?.textContent?.trim() ?? fallbackTitle;

  const entries: SdnEntryBlock[] = [];
  let hadHeading = false;

  const containers = new Set<Element>();
  for (const el of Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,strong"))) {
    if (!headingRe.test(el.textContent ?? "")) continue;
    containers.add(/^H[1-6]$/.test(el.tagName) ? el : el.closest("p,h1,h2,h3,h4,h5,h6") ?? el);
  }

  for (const heading of containers) {
    hadHeading = true;
    let node: Element = heading;
    while (node.nextElementSibling) {
      node = node.nextElementSibling;
      if (/^H[1-6]$/.test(node.tagName)) break; // next section
      const blockText = node.textContent ?? "";
      if (/following (additions|deletions|changes|individuals|entities|vessels|aircraft)/i.test(blockText) && !headingRe.test(blockText)) break;
      for (const line of blockLines(node)) {
        const entry = parseSdnBlock(line);
        if (entry) entries.push(entry);
      }
    }
  }

  return { title, entries, hadHeading };
}

/** The delistings pipeline's section heading (briefing 16). */
export const DELETIONS_HEADING = /following deletions have been made to OFAC['’]s SDN List/i;

/** Additions headings vary by entity type and casing (2005→2026 verified):
 *  "The following individuals have been added to OFAC's SDN list:",
 *  "The following entities have been added to OFAC's SDN List:", also plain
 *  "additions have been made". Anchored on added/additions + SDN list. */
export const ADDITIONS_HEADING = /following .{0,40}(been added to|additions (have been made )?to) OFAC['’]s SDN list/i;

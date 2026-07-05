/**
 * audit-vote-topics.ts — READ-ONLY audit of LegislativeVote.topics, the data
 * layer under /analysis/topics ("congressional zeitgeist").
 *
 * Companion to the 2026-07-04 offline audit of populate-vote-topics.ts, which
 * found four candidate defects this script quantifies against the live DB:
 *   1. TAXONOMY MISMATCH — the tagger produces 10 modern buckets (defense,
 *      health, economy, …); the page's label map advertises 25 incl. slavery,
 *      tariff_trade, prohibition — which no tagger produces.
 *   2. SUBSTRING FALSE POSITIVES — matching is `title.includes(keyword)` with
 *      NO word boundaries: 'war' hits "award/forward/Warren", 'port' hits
 *      "support/report/deport", 'rail' hits "trail", 'tax' hits "taxonomy".
 *   3. MODERN-BIAS UNDERTAGGING — no buckets for what the 19th century voted
 *      on (slavery, public lands, Indian affairs, tariffs, currency); early
 *      decades may be mostly untagged.
 *   4. DENOMINATOR FLAW — lib/topic-trends.ts divides tagged-topic counts by
 *      ALL votes in a decade (untagged included), so decade "shares" conflate
 *      topic mix with tagging coverage/description verbosity.
 *
 * Run: npx dotenv-cli -e .env.local -- npx tsx scripts/audit-vote-topics.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Keep in sync with scripts/populate-vote-topics.ts (not exported there).
const TOPIC_KEYWORDS: Record<string, string[]> = {
  defense: ["war","military","armed forces","defence","defense","nato","veteran","weapon","army","navy","air force","combat","troop","ammunition","missile","terrorism","national security","intelligence","nuclear deterr","coast guard","homeland security","warfare","soldier"],
  health: ["health","medical","nhs","pandemic","vaccine","vaccination","pharmaceutical","medicine","hospital","disease","mental health","dental","nursing","patient","clinical","medicaid","medicare","public health","drug approval","epidem"],
  economy: ["budget","tax","taxation","finance","fiscal","economic","trade","tariff","revenue","spending","inflation","debt","deficit","appropriation","subsidy","banking","investment","financial","monetary","appropriations","credit","loans","insurance","employment","labor market","wages","minimum wage","pension fund"],
  environment: ["climate","environment","environmental","green","energy","carbon","emission","renewable","pollution","biodiversity","sustainability","fossil fuel","conservation","water quality","air quality","deforestation","wildlife","natural resource","ocean","waste management","recycl"],
  justice: ["justice","crime","criminal","police","court","prison","law enforcement","sentenc","punishment","prosecution","judicial","corrections","firearms","gun control","violence","trafficking","fraud","cybercrime","terrorism prevention","civil rights"],
  immigration: ["immigrat","refugee","asylum","border","visa","citizenship","migrant","deportat","naturalizat","undocumented","foreigner","work permit","residency","entry ban"],
  education: ["education","school","university","student","teacher","curriculum","higher education","college","learning","academic","scholarship","tuition","literacy","training","vocational","apprenticeship","childcare","early childhood"],
  infrastructure: ["infrastructure","transport","housing","road","rail","railway","construction","bridge","highway","transit","airport","port","broadband","internet","utilities","water supply","sewer","electricity grid","public works"],
  foreign_policy: ["foreign","international","treaty","sanction","diplomatic","alliance","bilateral","multilateral","embassy","overseas","foreign aid","global","geopolit","united nations","world trade","foreign relation","extradition"],
  social: ["social","welfare","pension","benefit","disability","equality","diversity","poverty","homeless","unemployment","family","children","elderly","nutrition","food stamp","labour","worker right","maternity","parental leave","housing benefit","discrimination","inclusion"],
};

// Keywords most exposed to substring false positives, with the innocents they hit.
const SUSPECTS: [string, string, RegExp][] = [
  ["defense", "war", /\b(award|forward|warren|warehouse|software|hardware|edward|seward|delaware|warner)\w*/i],
  ["infrastructure", "port", /\b(support|report|deport|important|export|import|portion|opportunit)\w*/i],
  ["infrastructure", "rail", /\b(trail)\w*/i],
  ["economy", "tax", /\b(taxonom|syntax)\w*/i],
  ["justice", "court", /\b(courtesy|courtes)\w*/i],
  ["environment", "green", /\b(green(e|berg|ville|wood|wich)?)\b/i],
  ["social", "benefit", /./],  // legit-ish, counted for scale
];

// What the page's label map advertises (app/analysis/topics/TopicTrendsClient.tsx).
const PAGE_LABEL_SLUGS = ["slavery","civil_rights","military","war","defense","tariff_trade","banking_finance","taxation","immigration","public_lands","native_affairs","infrastructure","postal","judiciary","foreign_policy","health","education","environment","agriculture","labor","housing","appropriations","social_welfare","prohibition","technology"];

function detect(title: string): { topic: string; keyword: string }[] {
  const lower = title.toLowerCase();
  const out: { topic: string; keyword: string }[] = [];
  for (const [topic, kws] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of kws) {
      if (lower.includes(kw)) { out.push({ topic, keyword: kw }); break; }
    }
  }
  return out;
}

async function main() {
  console.log("audit-vote-topics — read-only\n");

  // Voteview votes with their source titles + dates (chunked fetch).
  type Row = { id: string; topics: string | null; voteDate: Date | null; name: string | null };
  const rows: Row[] = [];
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.legislativeVote.findMany({
      where: { source: { ingestedBy: "voteview_v1" } },
      select: { id: true, topics: true, voteDate: true, source: { select: { name: true } } },
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 20_000,
    });
    if (batch.length === 0) break;
    for (const b of batch) rows.push({ id: b.id, topics: b.topics, voteDate: b.voteDate, name: b.source?.name ?? null });
    cursor = batch[batch.length - 1].id;
    process.stdout.write(`\r  fetched ${rows.length} votes…`);
    if (batch.length < 20_000) break;
  }
  console.log();

  // ── 1. Coverage ──────────────────────────────────────────────────────────
  const total = rows.length;
  const tagged = rows.filter((r) => r.topics && r.topics !== "[]").length;
  const emptyProcessed = rows.filter((r) => r.topics === "[]").length;
  const neverProcessed = rows.filter((r) => r.topics == null).length;
  const noName = rows.filter((r) => !r.name || r.name.trim().length < 8).length;
  console.log(`\n═══ COVERAGE`);
  console.log(`  voteview votes:        ${total.toLocaleString()}`);
  console.log(`  tagged:                ${tagged.toLocaleString()} (${((tagged / total) * 100).toFixed(1)}%)`);
  console.log(`  processed, no match:   ${emptyProcessed.toLocaleString()} ("[]" — canonical tagger saw them)`);
  console.log(`  NEVER processed:       ${neverProcessed.toLocaleString()} (NULL — exposed to any stray tagger)`);
  console.log(`  short/missing titles:  ${noName.toLocaleString()} (can never tag)`);

  // ── 2. Coverage by decade (defect 3+4: verbosity/era bias) ───────────────
  console.log(`\n═══ COVERAGE BY DECADE (low early coverage ⇒ decade 'shares' on the page are biased)`);
  const byDecade = new Map<number, { total: number; tagged: number }>();
  for (const r of rows) {
    if (!r.voteDate) continue;
    const d = Math.floor(r.voteDate.getUTCFullYear() / 10) * 10;
    const b = byDecade.get(d) ?? { total: 0, tagged: 0 };
    b.total++; if (r.topics && r.topics !== "[]") b.tagged++;
    byDecade.set(d, b);
  }
  for (const [d, b] of [...byDecade.entries()].sort((a, z) => a[0] - z[0])) {
    const pct = (b.tagged / b.total) * 100;
    const bar = "█".repeat(Math.round(pct / 4)).padEnd(25, "·");
    console.log(`  ${d}s  ${bar} ${pct.toFixed(0).padStart(3)}%  (${b.tagged}/${b.total})`);
  }

  // ── 3. Taxonomy drift (defect 1) ─────────────────────────────────────────
  const dbSlugs = new Set<string>();
  for (const r of rows) {
    if (!r.topics) continue;
    try { for (const t of JSON.parse(r.topics)) dbSlugs.add(String(t)); } catch { /* ignore */ }
  }
  console.log(`\n═══ TAXONOMY DRIFT`);
  console.log(`  slugs actually in DB (${dbSlugs.size}): ${[...dbSlugs].sort().join(", ")}`);
  const phantom = PAGE_LABEL_SLUGS.filter((s) => !dbSlugs.has(s));
  console.log(`  page advertises but DB never contains (${phantom.length}): ${phantom.join(", ")}`);

  // ── 4. False-positive sampler (defect 2) ─────────────────────────────────
  console.log(`\n═══ SUBSTRING FALSE-POSITIVE SAMPLER (keyword fired; title matched an innocent word)`);
  for (const [topic, kw, innocent] of SUSPECTS) {
    if (kw === "benefit") continue;
    const hits: string[] = [];
    let fired = 0;
    for (const r of rows) {
      const name = r.name ?? "";
      if (!name.toLowerCase().includes(kw)) continue;
      fired++;
      // fired via substring but the only occurrence is inside an innocent word?
      const wordRe = new RegExp(`\\b${kw}`, "i");
      if (!wordRe.test(name) && innocent.test(name) && hits.length < 3) hits.push(name.slice(0, 110));
      else if (!wordRe.test(name) && hits.length < 3) hits.push(name.slice(0, 110));
    }
    const falsish = rows.filter((r) => {
      const n = (r.name ?? "");
      return n.toLowerCase().includes(kw) && !new RegExp(`\\b${kw}`, "i").test(n);
    }).length;
    console.log(`  '${kw}' → ${topic}: fired on ${fired.toLocaleString()} titles; ${falsish.toLocaleString()} have NO word-boundary match (pure substring hits)`);
    for (const h of hits) console.log(`      e.g. "${h}"`);
  }

  // ── 5. Tags-per-vote ─────────────────────────────────────────────────────
  const hist = new Map<number, number>();
  for (const r of rows) {
    let n = 0;
    if (r.topics) { try { n = (JSON.parse(r.topics) as unknown[]).length; } catch { /* ignore */ } }
    hist.set(n, (hist.get(n) ?? 0) + 1);
  }
  console.log(`\n═══ TAGS PER VOTE`);
  for (const [n, c] of [...hist.entries()].sort((a, z) => a[0] - z[0]))
    console.log(`  ${n} tags: ${c.toLocaleString()}`);

  // ── 6. What a word-boundary re-tag would change (dry simulation) ─────────
  let differs = 0;
  for (const r of rows) {
    const name = r.name ?? "";
    if (!name) continue;
    const current = detect(name).map((x) => x.topic).sort().join(",");
    const boundary = Object.entries(TOPIC_KEYWORDS)
      .filter(([, kws]) => kws.some((kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(name)))
      .map(([t]) => t).sort().join(",");
    if (current !== boundary) differs++;
  }
  console.log(`\n═══ RE-TAG SIMULATION`);
  console.log(`  votes whose tag set CHANGES under word-boundary matching: ${differs.toLocaleString()} (${((differs / total) * 100).toFixed(1)}%)`);

  // ── 7. ACTUAL-TAG AUDIT (v2, added after first run) ──────────────────────
  // First run proved the live tags come from an UNVERSIONED 25-topic tagger,
  // so keyword-hypothesis tests above don't bind. Interrogate the real pairs:
  // for suspicious (topic ← innocent-substring) combos, count actual tagged
  // votes whose title has the innocent word but no legitimate stem.
  console.log(`\n═══ ACTUAL-TAG ARTIFACT PROBES (real tags vs. title evidence)`);
  // Tuned to the CANONICAL tagger's taxonomy (scripts/enrich-voteview-topics.ts,
  // located after the first audit run): its matcher is substring-based with no
  // word boundaries, so these are its concrete exposure points.
  const PROBES: [string, RegExp, RegExp, string][] = [
    // topic, legitimate stems (word-boundary), innocent substring that also fires, label
    ["native_affairs", /\bindians?\b|\btrib(e|es|al)\b|\bcherokee|\bsioux|\bapache|\biroquois|\bnative american|\bbureau of indian/i, /indiana|indianapolis|west indies/i, "keyword 'indian' matching Indiana/West Indies"],
    ["infrastructure", /\broads?\b|\brailroad|\bcanal|\bbridge|\bharbor|\briver\b|\bnavigation|\bpost road|\bhighway|\binterstate|\binternal improvement/i, /broadcast|abroad|broader|railroading/i, "keyword 'road' matching broadcast/abroad"],
    ["banking_finance", /\bbank|\bcurrenc|\bcoinage|\bmint\b|\bfederal reserve|\bbonds?\b|\btreasury|\bdebt|\bdeficit|\bbudget|\bgold\b|\bsilver\b/i, /goldwater|goldsboro|silverman|silver spring/i, "keyword 'gold'/'silver' matching names"],
    ["judiciary", /\bcourts?\b|\bjudge|\bjudicial|\bhabeas|\bimpeach/i, /courtesy|courteous/i, "keyword 'court' matching courtesy"],
    ["postal", /\bpost(al| office| road|master|age)\b|\bmails?\b/i, /blackmail/i, "keyword 'mail' matching blackmail"],
    ["health", /\bhealth|\bdisease|\bquarantine|\bepidemic|\bhospital|\bmedicare|\bmedicaid|\bpandemic/i, /\binsurance\b/i, "health tag driven only by generic 'insurance' (auto/deposit insurance mis-bucketed)"],
  ];
  // Overlap check: 'pension' lives in BOTH military and social_welfare keyword lists.
  {
    let both = 0;
    for (const r of rows) {
      if (!r.topics || !r.name) continue;
      try {
        const list = JSON.parse(r.topics) as string[];
        if (list.includes("military") && list.includes("social_welfare") && /pension/i.test(r.name)) both++;
      } catch { /* ignore */ }
    }
    console.log(`  military+social_welfare double-tag via 'pension': ${both.toLocaleString()} votes`);
  }
  for (const [topic, legit, innocent, label] of PROBES) {
    let tagged = 0, suspect = 0;
    const samples: string[] = [];
    for (const r of rows) {
      if (!r.topics || !r.name) continue;
      let list: string[] = [];
      try { list = JSON.parse(r.topics) as string[]; } catch { continue; }
      if (!list.includes(topic)) continue;
      tagged++;
      if (!legit.test(r.name) && innocent.test(r.name)) {
        suspect++;
        if (samples.length < 3) samples.push(r.name.slice(0, 110));
      }
    }
    console.log(`  ${topic}: ${tagged.toLocaleString()} tagged; ${suspect.toLocaleString()} suspect (${label})`);
    for (const s of samples) console.log(`      e.g. "${s}"`);
  }

  // Per-topic actual counts + 2 random samples each — the eyeball layer.
  console.log(`\n═══ ACTUAL TAG DISTRIBUTION + SAMPLES`);
  const topicRows = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.topics) continue;
    try {
      for (const t of JSON.parse(r.topics) as string[]) {
        if (!topicRows.has(t)) topicRows.set(t, []);
        const arr = topicRows.get(t)!;
        if (arr.length < 400) arr.push(r); // reservoir-ish cap
      }
    } catch { /* ignore */ }
  }
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!r.topics) continue;
    try { for (const t of JSON.parse(r.topics) as string[]) totals.set(t, (totals.get(t) ?? 0) + 1); } catch { /* ignore */ }
  }
  for (const [t, n] of [...totals.entries()].sort((a, z) => z[1] - a[1])) {
    const pool = topicRows.get(t) ?? [];
    const picks = pool.filter((_, i) => i % Math.max(1, Math.floor(pool.length / 2)) === 0).slice(0, 2);
    console.log(`  ${t.padEnd(16)} ${String(n.toLocaleString()).padStart(8)}`);
    for (const p of picks) console.log(`      "${(p.name ?? "").slice(0, 100)}" (${p.voteDate?.getUTCFullYear() ?? "?"})`);
  }

  // Untagged modern procedural titles — the 2000s-2020s coverage dip.
  // (fixed: untagged rows carry "[]", not NULL — first run printed 0 here)
  const modernUntagged = rows.filter((r) => (!r.topics || r.topics === "[]") && r.voteDate && r.voteDate.getUTCFullYear() >= 2000 && r.name);
  console.log(`\n═══ MODERN COVERAGE DIP — sample untagged 2000s+ titles (${modernUntagged.length.toLocaleString()} total)`);
  for (const r of modernUntagged.slice(0, 6)) console.log(`  "${(r.name ?? "").slice(0, 100)}"`);

  console.log(`\nDone (no writes).`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

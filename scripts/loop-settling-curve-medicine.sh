#!/usr/bin/env bash
# Medicine Loop: Opus→Sonnet split architecture
#
# Opus handles the hard reasoning: what medical claim to add, source verification,
# dedup check against the seed file. Outputs a structured JSON spec.
# Sonnet handles the mechanical build: writes the TypeScript entry, runs the
# seeder, commits. No reasoning required.
#
# Era cycling (4): Drug Discovery / Clinical Trials / Post-Market / Regulatory Reversal
# Domain cycling (10): Oncology / Cardiovascular / Infectious Disease / Neuro-Psych /
#   Endocrinology / Pain & Opioids / Women's Health / Pediatrics / Rare Disease / Vaccines
#
# 4 × 10 = 40 unique combinations before any full repeat.
#
# launchd keeps it alive (KeepAlive=true); the script itself loops forever.
# DO NOT LAUNCH until history loop has run cleanly for another day.
# To launch: say "launch medicine loop" to RobClaw.

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/settling-curve-medicine.log"
DECISIONS_LOG="$PROJECT_DIR/logs/medicine-decisions.jsonl"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"
RUN=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

while true; do
  RUN=$((RUN + 1))
  RUN_TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

  # ERA cycling — 4 medicine-specific time windows
  case $((RUN % 4)) in
    0) ERA="Drug Discovery era (pre-1950): natural compounds, early synthetics, insulin, sulfonamides, pre-FDA drug regulation" ;;
    1) ERA="Clinical Trials era (1950–1990): RCT methodology established, FDA Kefauver-Harris Act, thalidomide aftermath, AIDS/AZT, statins first-generation" ;;
    2) ERA="Post-Market Surveillance era (1990–2010): Vioxx withdrawal, SSRI controversies, statin long-term effects, hormone replacement therapy reversal" ;;
    3) ERA="Regulatory Reversal and Precision Medicine era (2010–present): opioid epidemic reclassification, gene therapy approvals, COVID-19 vaccines, GLP-1 obesity drugs" ;;
  esac

  # DOMAIN cycling — 10 medical domains (mod 10, independent of era)
  case $((RUN % 10)) in
    0) DOMAIN="Oncology and cancer drugs (chemotherapy approvals, cancer screening recommendations, targeted therapies)" ;;
    1) DOMAIN="Cardiovascular medicine (statins, blood pressure guidelines, aspirin therapy, beta-blockers, anticoagulants)" ;;
    2) DOMAIN="Infectious disease and vaccines (vaccine efficacy/safety, antibiotic resistance emergence, pandemic responses)" ;;
    3) DOMAIN="Neurology and psychiatry (antidepressants, antipsychotics, Alzheimer's treatments, lobotomy reversal)" ;;
    4) DOMAIN="Endocrinology and metabolic disease (insulin discovery, diabetes management, obesity drugs, thyroid hormone)" ;;
    5) DOMAIN="Pain management and opioids (opioid prescribing guidelines, addiction reclassification, OxyContin approval and reversal)" ;;
    6) DOMAIN="Women's health (hormone replacement therapy, oral contraceptives, DES teratogenicity, breast cancer screening)" ;;
    7) DOMAIN="Pediatrics and child health (pediatric drug dosing, childhood vaccine schedules, lead exposure limits, SIDS guidelines)" ;;
    8) DOMAIN="Rare and orphan diseases (FDA Orphan Drug Act designations, enzyme replacement therapies, breakthrough therapy designations)" ;;
    9) DOMAIN="Surgical and procedural medicine (hand-washing discovery, antiseptic surgery, radical mastectomy abandonment, lobotomy reversal)" ;;
  esac

  FOCUS="${ERA} — domain focus: ${DOMAIN}"
  log "=== run #${RUN} | Era: ${ERA%(*} | Domain: ${DOMAIN%(*} ==="

  CURRENT_COUNT=$(cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.claimStatusHistory.groupBy({by:['claimId'],_count:true}).then(r=>console.log(r.length)).finally(()=>p.\$disconnect());
" 2>/dev/null || echo "unknown")

  # ─── PHASE 1: OPUS RESEARCH ───────────────────────────────────────────────
  # Opus reads seed file, identifies candidates, verifies URLs, outputs JSON spec.
  # Sonnet does NOT need to do any reasoning — only mechanical execution.

  OPUS_PROMPT="You are a medical research expert and epistemic historian expanding the Epistemic Receipts medicine settling curve dataset.

PROJECT: /Users/robclaw/Projects/epistemic-receipts
SEED FILE: scripts/seed-medicine-trajectories.ts (medicine-specific trajectories)
HISTORY SEED: scripts/seed-human-history-trajectories.ts (check this too — some medical events may already be in there)

Focus area for this run: ${FOCUS}

Your job is RESEARCH ONLY — identifying and verifying candidates. You will NOT write any code.

STEP 1 — CANDIDATE SELECTION:
Think of 3-5 specific medical/pharmaceutical epistemic events in this focus area that meet ALL these strict criteria:
  - A dateable medical claim (drug approval, study publication, guideline change, regulatory reversal, court ruling) pinned to a specific day or month
  - Has verifiable primary sources: PubMed PMID, FDA approval letter, NEJM/Lancet/BMJ paper, WHO bulletin, congressional record, court decision
  - Represents a clear epistemic transition: OPEN→RECORDED (first evidence), RECORDED→SETTLED (institutional adoption), SETTLED→CONTESTED (safety signal), SETTLED→REVERSED (withdrawal/contradicted), etc.
  - NOT already in the seed files: read BOTH seed files and check every candidate against existing entries by event description AND date, not just externalId — ask yourself 'is this the same event already in either file, even under a different name?'

STEP 2 — SOURCE VERIFICATION:
For each candidate, fetch at least one primary source URL:
  - PubMed: https://pubmed.ncbi.nlm.nih.gov/[PMID]/
  - FDA drug approval: https://www.accessdata.fda.gov/drugsatfda_docs/appletter/[YEAR]/[NDA]ltr.pdf
  - Lancet/NEJM/BMJ: fetch the DOI or journal URL directly
  - WHO bulletins: fetch the WHO page
  Confirm: page exists (not 404), contains the specific drug/study name, has a dateable publication or decision.
  DISCARD any candidate where you cannot verify at least one primary source URL.

STEP 3 — OUTPUT a JSON array with one object per verified candidate:
[
  {
    \"externalId\": \"trajectory:descriptive-kebab-case-id-YYYY\",
    \"text\": \"One factual sentence stating what was claimed/established, with the agent and date explicit.\",
    \"claimType\": \"EMPIRICAL\" | \"INSTITUTIONAL\" | \"HYBRID\",
    \"claimEmergedAt\": \"YYYY-MM-DD\",
    \"claimEmergedPrecision\": \"DAY\" | \"MONTH\" | \"YEAR\",
    \"currentAxis\": \"SETTLED\" | \"CONTESTED\" | \"REVERSED\" | \"RECORDED\",
    \"transitions\": [
      {
        \"fromAxis\": null | \"RECORDED\" | \"SETTLED\" | \"CONTESTED\",
        \"toAxis\": \"RECORDED\" | \"SETTLED\" | \"CONTESTED\" | \"REVERSED\" | \"ABANDONED\",
        \"community\": \"EXPERT_LITERATURE\" | \"INSTITUTIONAL\" | \"JUDICIAL\" | \"PUBLIC\" | \"MARKET\",
        \"occurredAt\": \"YYYY-MM-DD\",
        \"datePrecision\": \"DAY\" | \"MONTH\" | \"YEAR\",
        \"reason\": \"2-3 sentences: what happened, who acted, what the epistemic significance was.\",
        \"source\": {
          \"externalId\": \"src:descriptive-source-id\",
          \"name\": \"Author(s). Title. Journal. Year;Vol(Issue):Pages. or Agency. Document title. Date.\",
          \"url\": \"https://verified-url.example.com\",
          \"publishedAt\": \"YYYY-MM-DD\",
          \"methodologyType\": \"primary\" | \"derivative\"
        }
      }
    ],
    \"considered_but_rejected\": \"comma-separated list of candidates you evaluated and why each was rejected\"
  }
]

Output ONLY the JSON array. No prose, no markdown fences. If no candidates pass verification, output: []

REASONING_SUMMARY:[one sentence: what you looked for, what failed and why, what passed]"

  log "Phase 1: Opus research..."
  OPUS_OUTPUT=$(claude --model claude-opus-4-8 --print --permission-mode bypassPermissions --max-turns 20 "$OPUS_PROMPT" 2>&1) || true
  echo "$OPUS_OUTPUT" >> "$LOG"

  # Extract JSON spec from Opus output (between first [ and last ])
  JSON_SPEC=$(echo "$OPUS_OUTPUT" | python3 -c "
import sys, re, json
text = sys.stdin.read()
# Find the JSON array
match = re.search(r'(\[.*\])', text, re.DOTALL)
if match:
    try:
        data = json.loads(match.group(1))
        print(json.dumps(data))
    except:
        print('[]')
else:
    print('[]')
" 2>/dev/null || echo "[]")

  CANDIDATE_COUNT=$(echo "$JSON_SPEC" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(len(d))" 2>/dev/null || echo "0")
  OPUS_REASONING=$(echo "$OPUS_OUTPUT" | grep "^REASONING_SUMMARY:" | tail -1 | sed 's/^REASONING_SUMMARY://')

  log "Opus returned ${CANDIDATE_COUNT} verified candidates"

  if [ "$CANDIDATE_COUNT" = "0" ] || [ "$CANDIDATE_COUNT" = "" ]; then
    log "No verified candidates from Opus — skipping Sonnet phase"
    ADDED=0
    TITLES="none"
    CONSIDERED="(see Opus log)"
  else
    # ─── PHASE 2: SONNET BUILD ───────────────────────────────────────────────
    # Sonnet gets the JSON spec and only does mechanical execution.

    SONNET_PROMPT="You are a code execution agent. You have been given a verified JSON spec of medical epistemic trajectories to add to the Epistemic Receipts database. Do NOT do any research — the research is already done. Just execute.

PROJECT: /Users/robclaw/Projects/epistemic-receipts
SEED FILE TO ADD TO: scripts/seed-medicine-trajectories.ts

VERIFIED JSON SPEC:
${JSON_SPEC}

Your job:
1. Read scripts/seed-medicine-trajectories.ts to understand the exact TypeScript format (the TRAJECTORIES array and upsertTrajectory function).
2. Add each trajectory from the JSON spec to the TRAJECTORIES array in scripts/seed-medicine-trajectories.ts, following EXACTLY the same TypeScript structure as existing entries. Preserve all existing entries — only append new ones.
3. Run: cd /Users/robclaw/Projects/epistemic-receipts && npx dotenv-cli -e .env.local -- npx tsx scripts/seed-medicine-trajectories.ts
4. Commit and push: git add -A && git commit -m '💊 medicine: add [N] verified trajectories — [era/domain]' && git push origin main
5. Output exactly:
ADDED:[N]
TITLES:[title1] | [title2] | ..."

    log "Phase 2: Sonnet build..."
    SONNET_OUTPUT=$(claude --model claude-sonnet-4-6 --print --permission-mode bypassPermissions --max-turns 15 "$SONNET_PROMPT" 2>&1) || true
    echo "$SONNET_OUTPUT" >> "$LOG"

    ADDED=$(echo "$SONNET_OUTPUT" | grep "^ADDED:" | tail -1 | sed 's/^ADDED://' | tr -d ' ')
    TITLES=$(echo "$SONNET_OUTPUT" | grep "^TITLES:" | tail -1 | sed 's/^TITLES://')
    CONSIDERED=$(echo "$JSON_SPEC" | python3 -c "
import sys,json
try:
    d=json.loads(sys.stdin.read())
    ids=[e.get('externalId','?') for e in d]
    print(', '.join(ids))
except:
    print('unknown')
" 2>/dev/null || echo "unknown")
  fi

  log "Run #${RUN} done. Added: ${ADDED:-0}"

  # Write structured decision log
  mkdir -p "$PROJECT_DIR/logs"
  OPUS_RAW_ESC=$(echo "$OPUS_OUTPUT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""')
  printf '{"run":%d,"ts":"%s","loop":"medicine","era":"%s","domain":"%s","added":%s,"titles":"%s","considered":"%s","opus_reasoning":"%s","opus_raw":%s}\n' \
    "$RUN" \
    "$RUN_TS" \
    "${ERA//\"/\\\"}" \
    "${DOMAIN//\"/\\\"}" \
    "${ADDED:-0}" \
    "${TITLES//\"/\\\"}" \
    "${CONSIDERED//\"/\\\"}" \
    "${OPUS_REASONING//\"/\\\"}" \
    "$OPUS_RAW_ESC" \
    >> "$DECISIONS_LOG"

  if [ "${ADDED:-0}" != "0" ] && [ "${ADDED:-0}" != "" ]; then
    bash "$NOTIFY" "💊 Medicine curve +${ADDED} trajectories (run #${RUN})
🔬 ${ERA%(*} / ${DOMAIN%(*}
📚 ${TITLES}
Total claimIds: ${CURRENT_COUNT}"
    cp "$LOG" "$PROJECT_DIR/logs/medicine-$(date +%Y-%m-%d).log"
  fi

  sleep 5
done

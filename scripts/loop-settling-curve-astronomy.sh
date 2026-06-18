#!/usr/bin/env bash
# Astronomy/Physics Loop: Opus→Sonnet→Opus pipeline (v2)
#
# Architecture (per MAST/Anthropic best practices):
#   Phase 1 — Opus research: candidate selection + URL verification → JSON spec
#   Phase 2 — Sonnet build:  TypeScript entry + seeder run + commit
#   Phase 3 — Opus review:   quality gate on what Sonnet committed
#   Phase 3b — Sonnet fix:   one retry if Opus flags issues (max 1 attempt)
#   + Saturation tracking:   novelty rate per run → pivot signal when <10%
#
# Era cycling (5): Ancient / Scientific Revolution / Classical Physics / Modern Physics / Space Age
# Domain cycling (8): Planetary Science / Stellar Astrophysics / Cosmology / Particle Physics /
#   Relativity & Gravitation / Quantum Mechanics / Space Exploration / Instruments & Methods
#
# 5 × 8 = 40 unique combinations before any full repeat.
#
# launchd keeps it alive (KeepAlive=true); the script itself loops forever.
# To launch: say "launch astronomy loop" to RobClaw.

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/settling-curve-astronomy.log"
DECISIONS_LOG="$PROJECT_DIR/logs/astronomy-decisions.jsonl"
SATURATION_LOG="$PROJECT_DIR/logs/astronomy-saturation.jsonl"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"
RUN=0
CONSECUTIVE_LOW_YIELD=0  # saturation counter: runs with novelty rate < 10%

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

while true; do
  RUN=$((RUN + 1))
  RUN_TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

  # ERA cycling — 5 astronomy/physics time windows
  case $((RUN % 5)) in
    0) ERA="Ancient observations (pre-1500): Babylonian/Chinese/Greek eclipses, Ptolemy's Almagest, Aristarchus heliocentrism, Islamic golden age astronomy, astrolabes, early star catalogs" ;;
    1) ERA="Scientific revolution (1500–1800): Copernicus De revolutionibus, Galileo's telescopic observations, Kepler's laws, Newton's Principia, Halley's Comet prediction, transit of Venus expeditions" ;;
    2) ERA="Classical physics and astrophysics (1800–1905): Fraunhofer spectroscopy, Neptune discovery, electromagnetic theory (Maxwell), radioactivity (Becquerel/Curie), X-rays (Röntgen), stellar parallax, thermodynamics" ;;
    3) ERA="Modern physics era (1905–1970): special/general relativity, quantum mechanics, nuclear fission, cosmic microwave background, pulsars, quasars, Chandrasekhar limit, neutron stars" ;;
    4) ERA="Space age and precision cosmology (1970–present): Voyager missions, Hubble Space Telescope, LIGO gravitational waves, Higgs boson, JWST, exoplanet discoveries, black hole imaging, dark energy" ;;
  esac

  # DOMAIN cycling — 8 astronomy/physics domains (mod 8, independent of era)
  case $((RUN % 8)) in
    0) DOMAIN="Planetary science (planet discoveries, reclassifications, Pluto, planetary missions, surface confirmations, ring systems, atmospheres)" ;;
    1) DOMAIN="Stellar astrophysics (spectral classification, Hertzsprung-Russell diagram, stellar evolution, supernovae observations, white dwarfs, neutron stars)" ;;
    2) DOMAIN="Cosmology (Big Bang theory, CMB discovery, Hubble constant measurements, dark matter/dark energy evidence, accelerating expansion, WMAP/Planck)" ;;
    3) DOMAIN="Particle physics (subatomic particle discoveries, Standard Model confirmations, Higgs boson, neutrino oscillations, antimatter, quarks, leptons)" ;;
    4) DOMAIN="Relativity and gravitation (gravitational lensing, frame-dragging, gravitational waves, black hole shadows, time dilation tests, Pound-Rebka experiment)" ;;
    5) DOMAIN="Quantum mechanics (wave-particle duality, Bell test experiments, quantum entanglement verification, decoherence, Stern-Gerlach, double-slit experiments)" ;;
    6) DOMAIN="Space exploration missions (Apollo, Voyager, Cassini, Mars rovers, JWST, Chang'e, Rosetta, New Horizons, Pioneer, Galileo probe)" ;;
    7) DOMAIN="Astronomical instruments and methods (telescopes, interferometry, CCDs, adaptive optics, radio astronomy, spectroscopy, astrometry, photographic plates)" ;;
  esac

  FOCUS="${ERA} — domain focus: ${DOMAIN}"
  log "=== run #${RUN} | Era: ${ERA%(*} | Domain: ${DOMAIN%(*} ==="

  CURRENT_COUNT=$(cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.claimStatusHistory.groupBy({by:['claimId'],_count:true}).then(r=>console.log(r.length)).finally(()=>p.\$disconnect());
" 2>/dev/null || echo "unknown")

  # ─── PHASE 1: OPUS RESEARCH ───────────────────────────────────────────────

  OPUS_PROMPT="You are an astronomy and physics research expert and epistemic historian expanding the Epistemic Receipts astronomy/physics settling curve dataset.

PROJECT: /Users/robclaw/Projects/epistemic-receipts
SEED FILE: scripts/seed-astronomy-trajectories.ts (astronomy/physics-specific trajectories)
HISTORY SEED: scripts/seed-human-history-trajectories.ts (check this too — some physics events may already be in there)

Focus area for this run: ${FOCUS}

Your job is RESEARCH ONLY — identifying and verifying candidates. You will NOT write any code.

STEP 1 — CANDIDATE SELECTION:
Think of 3-5 specific astronomy/physics epistemic events in this focus area that meet ALL these strict criteria:
  - A dateable scientific claim (observation, experimental result, theoretical prediction confirmed, IAU resolution, Nobel recognition, mission result) pinned to a specific day or month
  - Has verifiable primary sources: Nature, Science, Physical Review Letters, Astrophysical Journal, IAU circulars/resolutions, Nobel Prize records, NASA/ESA mission archives, Philosophical Transactions
  - Represents a clear epistemic transition: OPEN→RECORDED (first observation/measurement), RECORDED→SETTLED (community confirmation/Nobel), SETTLED→CONTESTED (anomalous data/reinterpretation), SETTLED→REVERSED (disproven model), etc.
  - NOT already in the seed files: read BOTH seed files and check every candidate against existing entries by event description AND date, not just externalId. Ask: 'is this the same event already in either file, even under a different name?'
  - These should be the cleanest, most precisely dateable events in science — astronomy and physics have excellent archival records.

STEP 2 — SOURCE VERIFICATION:
For each candidate, fetch at least one primary source URL:
  - ADS (NASA Astrophysics Data System): https://ui.adsabs.harvard.edu/abs/[bibcode]
  - Physical Review Letters / Physical Review: https://doi.org/10.1103/PhysRevLett.[vol].[page]
  - Nature: https://doi.org/10.1038/[article-id]
  - Science: https://doi.org/10.1126/science.[id]
  - Astrophysical Journal: https://doi.org/10.3847/[id] or https://doi.org/10.1086/[id]
  - IAU: https://www.iau.org/[path]
  - Nobel Prize: https://www.nobelprize.org/prizes/physics/[year]/summary/
  - NASA: https://www.nasa.gov/ or mission-specific archives
  Confirm: page exists (not 404), contains the specific discovery/result, has a dateable publication or decision.
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

  # Extract JSON spec
  JSON_SPEC=$(echo "$OPUS_OUTPUT" | python3 -c "
import sys, re, json
text = sys.stdin.read()
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

  ADDED=0
  TITLES="none"
  CONSIDERED="(opus returned 0)"
  REVIEW_RESULT="skipped"

  if [ "$CANDIDATE_COUNT" != "0" ] && [ "$CANDIDATE_COUNT" != "" ]; then
    # ─── PHASE 2: SONNET BUILD ─────────────────────────────────────────────

    SONNET_PROMPT="You are a code execution agent. You have been given a verified JSON spec of astronomy/physics epistemic trajectories. Do NOT do any research — just execute.

PROJECT: /Users/robclaw/Projects/epistemic-receipts
SEED FILE TO ADD TO: scripts/seed-astronomy-trajectories.ts

VERIFIED JSON SPEC:
${JSON_SPEC}

CRITICAL: Only perform the 5 steps below. Do NOT run any loop scripts, cron jobs, or start background processes. Do NOT execute loop-settling-curve-*.sh or any variant. Stop after step 5.

Your job:
1. Read scripts/seed-astronomy-trajectories.ts to understand the exact TypeScript format.
2. Append each trajectory from the JSON spec to the TRAJECTORIES array, following EXACTLY the same structure. Preserve all existing entries.
3. Run: cd /Users/robclaw/Projects/epistemic-receipts && npx dotenv-cli -e .env.local -- npx tsx scripts/seed-astronomy-trajectories.ts
4. Commit and push: git add -A && git commit -m '🔭 astronomy: add [N] verified trajectories — [era/domain]' && git push origin main
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

    # ─── PHASE 3: OPUS REVIEW ──────────────────────────────────────────────

    if [ "${ADDED:-0}" != "0" ] && [ "${ADDED:-0}" != "" ]; then
      REVIEW_PROMPT="You are an astronomy/physics epistemic quality reviewer. Verify what Sonnet committed matches the spec and is scientifically correct.

PROJECT: /Users/robclaw/Projects/epistemic-receipts
ORIGINAL SPEC: ${JSON_SPEC}

1. Read scripts/seed-astronomy-trajectories.ts — find the newly added entries at the bottom.
2. For each added entry verify:
   - externalId, text, claimType, claimEmergedAt match the spec
   - Each fromAxis → toAxis transition is scientifically valid (SETTLED→REVERSED requires prior SETTLED; no OPEN→SETTLED without RECORDED first)
   - occurredAt dates are chronologically consistent (cause before effect)
   - source URLs are real (not placeholder or obviously hallucinated)
   - reason fields are substantive and physically/astronomically accurate
3. Run: git log --oneline -3 to confirm commit went through.

Output exactly one of:
REVIEW_OK
REVIEW_ISSUES:[specific description of what is wrong and which externalId is affected]"

      log "Phase 3: Opus review..."
      REVIEW_OUTPUT=$(claude --model claude-opus-4-8 --print --permission-mode bypassPermissions --max-turns 10 "$REVIEW_PROMPT" 2>&1) || true
      echo "$REVIEW_OUTPUT" >> "$LOG"

      REVIEW_STATUS=$(echo "$REVIEW_OUTPUT" | grep -E "^REVIEW_OK|^REVIEW_ISSUES:" | tail -1)

      if echo "$REVIEW_STATUS" | grep -q "REVIEW_ISSUES:"; then
        REVIEW_DETAIL=$(echo "$REVIEW_STATUS" | sed 's/^REVIEW_ISSUES://')
        REVIEW_RESULT="issues:${REVIEW_DETAIL}"
        log "⚠️  Opus review flagged: ${REVIEW_DETAIL}"

        # ─── PHASE 3b: SONNET FIX (max 1 retry) ─────────────────────────
        FIX_PROMPT="You are a code correction agent. An Opus quality reviewer found issues with trajectories you just committed. Fix them now.

PROJECT: /Users/robclaw/Projects/epistemic-receipts
ORIGINAL SPEC: ${JSON_SPEC}
ISSUES FOUND: ${REVIEW_DETAIL}

1. Read scripts/seed-astronomy-trajectories.ts and find the affected entries (listed in ISSUES FOUND).
2. Fix each issue in place — correct the field values to match the spec and the reviewer's feedback.
3. Re-run: cd /Users/robclaw/Projects/epistemic-receipts && npx dotenv-cli -e .env.local -- npx tsx scripts/seed-astronomy-trajectories.ts
4. Commit: git add -A && git commit -m '🔭 astronomy: fix quality issues flagged by Opus reviewer' && git push origin main
5. Output: FIX_DONE:[brief description of what you fixed]"

        log "Phase 3b: Sonnet fix attempt..."
        FIX_OUTPUT=$(claude --model claude-sonnet-4-6 --print --permission-mode bypassPermissions --max-turns 10 "$FIX_PROMPT" 2>&1) || true
        echo "$FIX_OUTPUT" >> "$LOG"

        FIX_STATUS=$(echo "$FIX_OUTPUT" | grep "^FIX_DONE:" | tail -1)
        if [ -n "$FIX_STATUS" ]; then
          log "✓ Sonnet fix applied: ${FIX_STATUS}"
          REVIEW_RESULT="fixed:${FIX_STATUS}"
        else
          log "⚠️  Sonnet fix did not confirm — manual check needed"
          bash "$NOTIFY" "⚠️ Astronomy quality issue — auto-fix uncertain (run #${RUN})
Issues: ${REVIEW_DETAIL}
Check logs/astronomy-$(date +%Y-%m-%d).log"
          REVIEW_RESULT="fix_uncertain"
        fi
      else
        REVIEW_RESULT="ok"
        log "✓ Opus review passed"
      fi
    fi
  fi

  # ─── SATURATION TRACKING ──────────────────────────────────────────────────
  # Novelty rate = ADDED / CANDIDATE_COUNT. If <10% over 5+ consecutive runs,
  # the loop is saturating in this era/domain combination.

  NOVELTY_RATE=0
  if [ "${CANDIDATE_COUNT:-0}" != "0" ] && [ "${CANDIDATE_COUNT:-0}" != "" ]; then
    NOVELTY_RATE=$(python3 -c "
added=${ADDED:-0}; cands=${CANDIDATE_COUNT:-1}
rate = added / cands if cands > 0 else 0
print(f'{rate:.2f}')
" 2>/dev/null || echo "0")
  fi

  # Track consecutive low-yield runs
  IS_LOW=$(python3 -c "print('1' if float('${NOVELTY_RATE}') < 0.10 else '0')" 2>/dev/null || echo "0")
  if [ "$IS_LOW" = "1" ]; then
    CONSECUTIVE_LOW_YIELD=$((CONSECUTIVE_LOW_YIELD + 1))
  else
    CONSECUTIVE_LOW_YIELD=0
  fi

  # Ping if saturating (5+ consecutive low-yield runs)
  if [ "$CONSECUTIVE_LOW_YIELD" -ge 5 ]; then
    log "⚠️  Saturation signal: ${CONSECUTIVE_LOW_YIELD} consecutive low-yield runs (novelty rate: ${NOVELTY_RATE})"
    bash "$NOTIFY" "📉 Astronomy loop saturation signal (run #${RUN})
${CONSECUTIVE_LOW_YIELD} consecutive runs with <10% novelty rate
Era: ${ERA%(*}
Consider: new era/domain combo, pivot to a different seed list, or pause"
    CONSECUTIVE_LOW_YIELD=0  # reset after pinging to avoid spam
  fi

  log "Run #${RUN} done. Added: ${ADDED:-0} | Candidates: ${CANDIDATE_COUNT:-0} | Novelty: ${NOVELTY_RATE} | Consecutive low: ${CONSECUTIVE_LOW_YIELD}"

  # Write decision log
  mkdir -p "$PROJECT_DIR/logs"
  OPUS_RAW_ESC=$(echo "$OPUS_OUTPUT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""')
  printf '{"run":%d,"ts":"%s","loop":"astronomy","era":"%s","domain":"%s","added":%s,"candidates":%s,"novelty_rate":"%s","titles":"%s","considered":"%s","opus_reasoning":"%s","review":"%s","opus_raw":%s}\n' \
    "$RUN" \
    "$RUN_TS" \
    "${ERA//\"/\\\"}" \
    "${DOMAIN//\"/\\\"}" \
    "${ADDED:-0}" \
    "${CANDIDATE_COUNT:-0}" \
    "$NOVELTY_RATE" \
    "${TITLES//\"/\\\"}" \
    "${CONSIDERED//\"/\\\"}" \
    "${OPUS_REASONING//\"/\\\"}" \
    "${REVIEW_RESULT//\"/\\\"}" \
    "$OPUS_RAW_ESC" \
    >> "$DECISIONS_LOG"

  # Write saturation log (every run, for analysis)
  printf '{"run":%d,"ts":"%s","era":"%s","domain":"%s","added":%s,"candidates":%s,"novelty_rate":"%s","consecutive_low":%d}\n' \
    "$RUN" "$RUN_TS" "${ERA%(*}" "${DOMAIN%(*}" \
    "${ADDED:-0}" "${CANDIDATE_COUNT:-0}" "$NOVELTY_RATE" "$CONSECUTIVE_LOW_YIELD" \
    >> "$SATURATION_LOG"

  if [ "${ADDED:-0}" != "0" ] && [ "${ADDED:-0}" != "" ]; then
    bash "$NOTIFY" "🔭 Astronomy curve +${ADDED} trajectories (run #${RUN})
🔬 ${ERA%(*} / ${DOMAIN%(*}
📚 ${TITLES}
Total claimIds: ${CURRENT_COUNT}"
    cp "$LOG" "$PROJECT_DIR/logs/astronomy-$(date +%Y-%m-%d).log"
  fi

  sleep 5
done

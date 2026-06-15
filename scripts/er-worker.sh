#!/bin/bash
# Epistemic Receipts autonomous worker
# Runs every 5 hours via OpenClaw cron.
# Loops through tasks back-to-back until queue is empty or rate limit hit.

set -euo pipefail

REPO="$HOME/Projects/epistemic-receipts"
QUEUE="$REPO/TASK_QUEUE.md"
LOG="$REPO/.worker.log"

TASKS_DONE=0
SUMMARIES=""
BLOCK_SUMMARY="unknown"

echo "[$(date '+%Y-%m-%d %H:%M %Z')] Worker started" >> "$LOG"

cd "$REPO"

# Check current 5-hour billing block via ccusage
BLOCK_JSON=$(npx ccusage claude blocks --active --json --offline 2>/dev/null || echo "{}")
BLOCK_TOKENS=$(echo "$BLOCK_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); b=d.get('blocks',[]); print(f\"{b[0]['totalTokens']:,}\" if b else 'none')" 2>/dev/null || echo "unknown")
BLOCK_COST=$(echo "$BLOCK_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); b=d.get('blocks',[]); print(f\"\${b[0]['costUSD']:.2f}\" if b else '') " 2>/dev/null || echo "")
BLOCK_ENDS=$(echo "$BLOCK_JSON" | python3 -c "import json,sys,datetime; d=json.load(sys.stdin); b=d.get('blocks',[]); t=b[0]['endTime'] if b else ''; print(datetime.datetime.fromisoformat(t.replace('Z','+00:00')).astimezone().strftime('%I:%M%p') if t else '')" 2>/dev/null || echo "")
BLOCK_SUMMARY="${BLOCK_TOKENS} tokens ${BLOCK_COST} (window ends ${BLOCK_ENDS})"
echo "[$(date '+%Y-%m-%d %H:%M %Z')] Current block: $BLOCK_SUMMARY" >> "$LOG"
echo "BLOCK_SUMMARY:$BLOCK_SUMMARY"

while true; do
  DATE=$(date '+%Y-%m-%d %H:%M %Z')

  # Pick next pending task — skip ⏸ blocked items (human-only, not actionable by worker)
  TASK=$(grep -m1 "^- \[ \] [^⏸]" "$QUEUE" 2>/dev/null | sed 's/^- \[ \] //' || true)

  if [ -z "$TASK" ]; then
    echo "[$DATE] Queue empty" >> "$LOG"
    echo "DONE_NO_TASKS"
    break
  fi

  echo "[$DATE] Starting: $TASK" >> "$LOG"

  # Run Claude Code — 20 turns per task to leave room for multiple tasks per session
  OUTPUT=$(claude --print --permission-mode bypassPermissions --max-turns 20 \
"You are the Epistemic Receipts autonomous worker. Your job this session:

TASK: $TASK

Instructions:
1. Read TASK_QUEUE.md and AGENTS.md for project context
2. Check git log --oneline -20 and ls scripts/ BEFORE doing anything — if the task involves building a pipeline that already exists, skip the build and just run the dry-run instead; update the task description in TASK_QUEUE.md accordingly
3. Complete the task above — read relevant files before editing anything
3. When done, edit TASK_QUEUE.md: change '- [ ] $TASK' to '- [x] $TASK (completed $DATE)'
4. Move the completed line under '## Completed' at the bottom
5. Git add and commit all changes with a clear message
6. Output exactly this format at the end:
   TASK_DONE: <one sentence what you did>
   NEXT_TASK: <text of next unchecked task, or NONE>

Rules: One task only. Follow all rules in AGENTS.md and CLAUDE.md." 2>&1)

  EXIT_CODE=$?
  echo "$OUTPUT" >> "$LOG"

  # Detect rate limit — stop and wait for next session window
  if echo "$OUTPUT" | grep -qi "rate limit\|too many requests\|usage limit\|overloaded"; then
    echo "[$DATE] Rate limit hit — stopping, resuming next window" >> "$LOG"
    echo "RATE_LIMITED"
    break
  fi

  if [ $EXIT_CODE -ne 0 ]; then
    echo "[$DATE] Claude exited with code $EXIT_CODE — stopping" >> "$LOG"
    echo "ERROR:$EXIT_CODE"
    break
  fi

  # Extract summary
  SUMMARY=$(echo "$OUTPUT" | grep "^TASK_DONE:" | sed 's/^TASK_DONE: //' || echo "$TASK")
  TASKS_DONE=$((TASKS_DONE + 1))
  SUMMARIES="$SUMMARIES\n✅ $SUMMARY"

  echo "[$DATE] Completed: $TASK" >> "$LOG"
done

echo "[$(date '+%Y-%m-%d %H:%M %Z')] Worker finished. Tasks done: $TASKS_DONE" >> "$LOG"

# Final output for cron notifier to parse
echo "TASKS_DONE:$TASKS_DONE"
echo -e "SUMMARIES:$SUMMARIES"

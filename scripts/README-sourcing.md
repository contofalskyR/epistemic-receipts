# Transition sourcing (`claude_sourcing_v1`) — full curated run

> **2026-10-09:** the first full run was done from the Mac, not the Oracle box: `nohup caffeinate -i npx tsx
> scripts/source-transitions.ts --budget 140`, on AC power with the lid open. It processed 3,515 transitions for
> $138.98 and stopped at its budget. 1,803 remain. Findings are in `docs/TRANSITION-SOURCING-2026-10-09.md`.
> The steps below still apply to any later run on the server.

The full run takes hours and the laptop sleeps, so it runs on the Oracle box inside tmux. The script is
the same one used for the pilot (`scripts/source-transitions.ts`). It writes only to
`"TransitionSourceCandidate"`. Review with `scripts/review-transition-sources.ts`; promote by hand with
`scripts/promote-transition-sources.ts --confirm`.

**Hard limits:** finish every API call before **2026-10-11 18:00 New York (22:00 UTC)**, when the promo
credit's margin runs out. The script stops starting requests at 21:45 UTC on its own. Start no later than
about 12:00 New York on Oct 11.

**What the run does:** curated transitions whose marker source is Wikipedia or missing. 5,318 remained
after the pilot. Haiku 5.5 runs first; Sonnet 5.5 runs only when Haiku has nothing usable. Budget is $140
for this run, with a $180 lifetime cap ($21.02 was spent on the pilot).

**Expect:** about $0.04 per transition, so the $140 budget covers ~3,300 transitions and the run ends
with `■ stopped: run budget $140`. That takes ~3.5 hours at concurrency 4. The pilot did ~16 transitions
a minute with heavier escalation.

## 1. On the Mac: publish the branch

```sh
git push -u origin feat/transition-sourcing
```

## 2. On the Oracle box: Node 22, git, tmux

```sh
ssh opc@<oracle-host>                       # the server from STATUS.md "Environment facts"
sudo dnf module list nodejs                 # confirm a 22 stream is offered
sudo dnf module reset -y nodejs
sudo dnf module enable -y nodejs:22
sudo dnf install -y nodejs git tmux
node -v                                     # must print v22.x
```

If no `nodejs:22` stream is listed (older Oracle Linux), use NodeSource instead:
`curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash - && sudo dnf install -y nodejs`.

```sh
git clone -b feat/transition-sourcing https://github.com/contofalskyR/epistemic-receipts.git ~/epistemic-receipts
cd ~/epistemic-receipts
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci
```

## 3. On the Mac: copy the env file and the spend ledger

```sh
scp .env.local opc@<oracle-host>:~/epistemic-receipts/.env.local
ssh opc@<oracle-host> 'chmod 600 ~/epistemic-receipts/.env.local && mkdir -p ~/epistemic-receipts/logs'
scp logs/transition-sourcing-ledger.jsonl opc@<oracle-host>:~/epistemic-receipts/logs/
```

`.env.local` must hold `DATABASE_URL`, `ANTHROPIC_API_KEY` and `ANTHROPIC_WORKSPACE_ID`. The ledger
carries the pilot's spend. If it is missing, the lifetime cap still holds, because the script also counts
the table's cost sum.

## 4. On the Oracle box: check, then start

```sh
cd ~/epistemic-receipts
npx tsx scripts/source-transitions.ts --dry-run | head -5
```

Expect:
- `5,318 eligible transitions` (fewer if anything has run since)
- `Workspace header: set`
- `spent so far $21.02…`

If the database connection fails from the box itself, point the server copy at localhost and re-run the
dry run:

```sh
sed -i.bak -E '/^DATABASE_URL=/s#@[^@:/]+(:5432)?/#@127.0.0.1:5432/#' .env.local
```

Start the run inside tmux:

```sh
tmux new -s sourcing
npx tsx scripts/source-transitions.ts --budget 140 2>&1 | tee -a logs/full-run.log
```

Detach with `Ctrl-b d`; reattach with `tmux attach -t sourcing`. Spend prints every 50 transitions, for
example `[50/5318] run $2.10 · lifetime $23.12 · candidates …`.

## 5. While it runs

- **Watch progress from anywhere:** `ssh opc@<oracle-host> 'tail -n 3 ~/epistemic-receipts/logs/full-run.log'`
- **Review from the Mac at any time** (the table is in the shared database):
  `npx tsx scripts/review-transition-sources.ts` and `--sample 50`
- **Stop:** press `Ctrl-C` once in the tmux window. In-flight requests finish and are stored. Press it
  twice to abandon them; their cost is already in the ledger.
- **Resume:** run the same command again. Rows already in the table are never reselected, and the
  lifetime cap stops any run that would push total spend past $180.
- **Errors:** the run stops by itself on a fatal API error (400/401/403/404) or after 10 consecutive
  errors. 429/529/5xx back off and retry. Searches the tool reports as failed are not stored, so the next
  run retries them.

## 6. After it finishes

```sh
# on the box: the closing summary (confidence histogram, model split, spend, table counts)
tail -n 25 ~/epistemic-receipts/logs/full-run.log
# on the Mac: bring the ledger back (it already holds the pilot), then remove the server's copy of the key
scp opc@<oracle-host>:~/epistemic-receipts/logs/transition-sourcing-ledger.jsonl logs/
ssh opc@<oracle-host> 'shred -u ~/epistemic-receipts/.env.local ~/epistemic-receipts/.env.local.bak 2>/dev/null; true'
npx tsx scripts/review-transition-sources.ts
```

Then review and promote:

```sh
npx tsx scripts/review-transition-sources.ts --sample 50                      # judge
npx tsx scripts/review-transition-sources.ts --accept <id>,<id> / --reject <id>
npx tsx scripts/promote-transition-sources.ts                                 # plan only
npx tsx scripts/promote-transition-sources.ts --confirm                       # Source + Edge, one transaction
```

## Flags

| flag | default | |
|---|---|---|
| `--budget` | $40 with `--limit`, else $140 | per run |
| `--total-cap` | $180 | lifetime: the ledger total or the table's cost sum, whichever is higher |
| `--escalate-below` | 0 | 0 = Sonnet only when Haiku has nothing usable; the pilot used 0.5 |
| `--no-escalate` | | Haiku only |
| `--max-searches` | 3 | web searches per request ($0.01 each) |
| `--concurrency` | 4 | capped at 4 |
| `--limit` / `--claim` / `--since` | | scope; `--since` is the transition date |
| `--deadline` | 2026-10-11T22:00:00Z | stops starting requests 15 minutes before |
| `--dry-run` | | prints 3 prompts, no API calls |

#!/usr/bin/env bash
# Helper: send a message to Robert via Telegram bot
# Usage: notify-telegram.sh "your message"
#
# Requires environment variables (fail-closed — exits 1 if unset/empty):
#   TELEGRAM_BOT_TOKEN  Telegram bot API token (from BotFather; never hardcode)
#   TELEGRAM_CHAT_ID    Recipient chat id
# Same names as the GitHub Actions secrets and app/api/cron/topic-alerts.
set -euo pipefail

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo "notify-telegram.sh: ERROR: TELEGRAM_BOT_TOKEN is not set. Export it (BotFather token) and retry." >&2
  exit 1
fi
if [[ -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "notify-telegram.sh: ERROR: TELEGRAM_CHAT_ID is not set. Export the recipient chat id and retry." >&2
  exit 1
fi

MSG="${1:-[no message]}"
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d chat_id="${TELEGRAM_CHAT_ID}" \
  -d parse_mode="Markdown" \
  --data-urlencode text="${MSG}" \
  > /dev/null

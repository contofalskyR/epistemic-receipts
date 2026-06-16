#!/usr/bin/env bash
# Helper: send a message to Robert via Telegram bot
# Usage: notify-telegram.sh "your message"
BOT_TOKEN="8678256660:AAFyO3amEh4mcOMq5nrm_gvds1j5PI5mMYA"
CHAT_ID="7688025079"
MSG="${1:-[no message]}"
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d chat_id="${CHAT_ID}" \
  -d parse_mode="Markdown" \
  --data-urlencode text="${MSG}" \
  > /dev/null

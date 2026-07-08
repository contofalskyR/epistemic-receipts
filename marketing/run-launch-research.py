"""
run-launch-research.py — Sonnet 5 executor + Opus 4.8 advisor launch-strategy
research agent for Epistemic Receipts.

Built per the Advisor tool docs (platform.claude.com/docs/en/agents-and-tools/
tool-use/advisor-tool, beta advisor-tool-2026-03-01): a faster executor does
the searching and synthesis; a stronger advisor is consulted at strategic
moments. Advisor output is capped at 2,048 tokens (docs' recommended starting
point) and advisor-side prompt caching is enabled (research loops consult 3+
times, past the caching break-even).

Setup:
  pip install anthropic
  export ANTHROPIC_API_KEY=...   (or put it in your shell env)
Run:
  python marketing/run-launch-research.py
Output:
  marketing/launch-research-report.md  (+ full transcript JSON alongside)

Cost note: expect a few dollars — Sonnet 5 executor tokens + ~25 web searches
+ a handful of Opus 4.8 advisor sub-calls. usage.iterations is printed per
turn so you can watch it.
"""

import json
import os
import sys
from pathlib import Path

import anthropic

HERE = Path(__file__).parent
BRIEF = (HERE / "launch-research-brief.md").read_text()

EXECUTOR_MODEL = "claude-sonnet-5"
ADVISOR_MODEL = "claude-opus-4-8"  # readable advice; Fable 5 also valid but returns encrypted results
BETAS = ["advisor-tool-2026-03-01"]
MAX_TURNS = 30

# Research-flavored advisor timing (adapted from the docs' suggested blocks;
# the docs note research tasks usually need little steering, so this stays light).
SYSTEM = """You are a launch-strategy research agent. Work the brief in the user
message from top to bottom.

You have an `advisor` tool backed by a stronger reviewer model. It takes NO
parameters — when you call advisor(), your entire conversation history is
automatically forwarded; the advisor sees every search you ran and every
result you read. Call it (1) after your initial landscape scan, before
committing research depth to particular audiences or channels, and (2) once
your findings are assembled, before writing the final report — ask it to
challenge your ranking and flag what you missed. Give the advice serious
weight; if your evidence contradicts it, surface the conflict in one more
advisor call rather than silently choosing.

Search norms: prefer primary sources and recent (2025-2026) material; quote
sparingly; keep a running list of citation URLs as you go. When finished,
output the complete final report as markdown between the markers
<<<REPORT>>> and <<<END REPORT>>> — everything between the markers must be
the deliverable itself, self-contained."""

TOOLS = [
    {
        "type": "advisor_20260301",
        "name": "advisor",
        "model": ADVISOR_MODEL,
        "max_tokens": 2048,  # docs' recommended cap: ~7x cheaper, near-zero truncation
        "caching": {"type": "ephemeral", "ttl": "5m"},  # break-even at ~3 calls
    },
    {
        "type": "web_search_20250305",
        "name": "web_search",
        "max_uses": 30,
    },
]


def main() -> None:
    client = anthropic.Anthropic()
    messages = [{"role": "user", "content": BRIEF}]
    report_text = None

    for turn in range(1, MAX_TURNS + 1):
        response = client.beta.messages.create(
            model=EXECUTOR_MODEL,
            max_tokens=16000,
            betas=BETAS,
            system=SYSTEM,
            tools=TOOLS,
            messages=messages,
        )

        # Per-iteration cost visibility (executor vs advisor rates differ).
        usage = getattr(response, "usage", None)
        iterations = getattr(usage, "iterations", None) or []
        for it in iterations:
            it_type = getattr(it, "type", "?")
            model = getattr(it, "model", EXECUTOR_MODEL)
            print(
                f"  turn {turn} · {it_type} ({model}): "
                f"in={getattr(it, 'input_tokens', '?')} out={getattr(it, 'output_tokens', '?')}",
                file=sys.stderr,
            )

        # Round-trip the full content verbatim (advisor_tool_result included).
        messages.append({"role": "assistant", "content": response.content})

        text_parts = [b.text for b in response.content if getattr(b, "type", "") == "text"]
        full_text = "\n".join(text_parts)
        if "<<<REPORT>>>" in full_text:
            report_text = full_text.split("<<<REPORT>>>", 1)[1].split("<<<END REPORT>>>", 1)[0].strip()

        if response.stop_reason == "pause_turn":
            # A server tool (advisor or search) is still pending: resend with
            # the assistant message appended unchanged and the same tools.
            continue
        if response.stop_reason == "end_turn":
            break
        if response.stop_reason == "max_tokens":
            messages.append({"role": "user", "content": "Continue exactly where you left off."})
            continue
        # No client-side tools are defined, so tool_use should not occur;
        # if it somehow does, stop rather than loop blindly.
        print(f"Unexpected stop_reason: {response.stop_reason}", file=sys.stderr)
        break

    out = HERE / "launch-research-report.md"
    if report_text:
        out.write_text(report_text)
        print(f"\nReport → {out}")
    else:
        print("\nNo <<<REPORT>>> markers found — writing full final text instead.")
        out.write_text(full_text if "full_text" in dir() else "(no output)")

    transcript = HERE / "launch-research-transcript.json"
    transcript.write_text(
        json.dumps(
            [
                {"role": m["role"], "content": [getattr(b, "to_dict", lambda b=b: b)() if not isinstance(b, dict) else b for b in (m["content"] if isinstance(m["content"], list) else [m["content"]])]}
                for m in messages
            ],
            default=str,
            indent=1,
        )
    )
    print(f"Transcript → {transcript}")


if __name__ == "__main__":
    main()

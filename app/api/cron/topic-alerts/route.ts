import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TELEGRAM_RECIPIENT = "7688025079";
const OPENCLAW_URL = "https://gateway.openclaw.ai/v1/message/send";
const SITE_BASE = "https://epistemic-receipts.vercel.app";

function truncate(s: string, n: number): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  return trimmed.length > n ? trimmed.slice(0, n - 1).trimEnd() + "…" : trimmed;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function emojiFor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("neuro")) return "🧠";
  if (l.includes("climate")) return "🌍";
  if (l.includes("covid") || l.includes("vaccine") || l.includes("drug")) return "💊";
  if (l.includes("congress") || l.includes("trading")) return "💼";
  if (l.includes("retraction")) return "📕";
  if (l.includes("supreme") || l.includes("scotus")) return "⚖️";
  if (l.includes("ukraine")) return "🇺🇦";
  if (l.includes("china")) return "🇨🇳";
  if (l.includes("ai") || l.includes("machine")) return "🤖";
  return "🔎";
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const topics = await prisma.watchedTopic.findMany({ orderBy: { createdAt: "asc" } });

  const sections: string[] = [];
  const perTopicCounts: Array<{ keyword: string; label: string; total: number }> = [];

  for (const topic of topics) {
    const where = {
      deleted: false,
      createdAt: { gte: since },
      text: { contains: topic.keyword, mode: "insensitive" as const },
    };

    const [total, top] = await Promise.all([
      prisma.claim.count({ where }),
      prisma.claim.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          text: true,
          epistemicAxis: true,
          currentStatus: true,
          edges: {
            where: { deleted: false },
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { source: { select: { name: true } } },
          },
        },
      }),
    ]);

    perTopicCounts.push({ keyword: topic.keyword, label: topic.label, total });
    if (total === 0) continue;

    const lines = top.map((c) => {
      const sourceName = c.edges[0]?.source?.name?.trim();
      const status = (c.epistemicAxis || c.currentStatus || "").trim();
      const tail = [sourceName, status].filter(Boolean).join(" ");
      const head = truncate(c.text, 120);
      return `• ${head}${tail ? ` — ${tail}` : ""}`;
    });

    const url = `${SITE_BASE}/search?q=${encodeURIComponent(topic.keyword)}`;
    sections.push(
      `${emojiFor(topic.label)} ${topic.label} (${total} new claim${total === 1 ? "" : "s"})\n` +
        lines.join("\n") +
        `\nView all: ${url}`,
    );
  }

  const range = `${fmtDate(since)} – ${fmtDate(now)}`;
  const header = `📬 Weekly Epistemic Receipts Digest — ${range}`;
  const body =
    sections.length > 0
      ? sections.join("\n\n")
      : "No new claims matched any watched topic in the last 7 days.";
  const digest = `${header}\n\n${body}`;

  // Always refresh lastAlertAt — we ran the digest job, even if nothing matched.
  await prisma.watchedTopic.updateMany({ data: { lastAlertAt: now } });

  const apiKey = process.env.OPENCLAW_API_KEY;
  let sent = false;
  let sendStatus: number | null = null;
  let sendError: string | null = null;

  if (!apiKey) {
    console.warn("[topic-alerts] OPENCLAW_API_KEY not set — skipping Telegram send.");
  } else {
    try {
      const res = await fetch(OPENCLAW_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: "telegram", to: TELEGRAM_RECIPIENT, text: digest }),
      });
      sendStatus = res.status;
      sent = res.ok;
      if (!res.ok) sendError = await res.text().catch(() => `HTTP ${res.status}`);
    } catch (err) {
      sendError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    ok: true,
    range,
    topics: perTopicCounts,
    digestLength: digest.length,
    sent,
    sendStatus,
    sendError,
  });
}

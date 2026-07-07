import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SITE_URL as SITE_BASE } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TELEGRAM_RECIPIENT = process.env.TELEGRAM_CHAT_ID;
const OPENCLAW_URL = "https://gateway.openclaw.ai/v1/message/send";

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
  const cronSecret = process.env.CRON_SECRETE;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mode = (url.searchParams.get("mode") ?? "weekly") as "daily" | "weekly";
  const windowHours = mode === "daily" ? 24 : 7 * 24;
  const now = new Date();
  const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

  const topics = await prisma.watchedTopic.findMany({ orderBy: { createdAt: "asc" } });

  const sections: string[] = [];
  const perTopicCounts: Array<{
    keyword: string;
    label: string;
    total: number;
    statusChanges: number;
  }> = [];

  for (const topic of topics) {
    const claimWhere = {
      deleted: false,
      createdAt: { gte: since },
      text: { contains: topic.keyword, mode: "insensitive" as const },
    };

    const [total, top] = await Promise.all([
      prisma.claim.count({ where: claimWhere }),
      prisma.claim.findMany({
        where: claimWhere,
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

    // Status changes (epistemic axis transitions) since last alert
    const statusChanges = await prisma.claimStatusHistory.findMany({
      where: {
        occurredAt: { gte: since },
        claim: {
          deleted: false,
          text: { contains: topic.keyword, mode: "insensitive" as const },
        },
        fromAxis: { not: null },
      },
      take: 3,
      orderBy: { occurredAt: "desc" },
      select: {
        fromAxis: true,
        toAxis: true,
        occurredAt: true,
        claim: { select: { id: true, text: true } },
      },
    });

    perTopicCounts.push({
      keyword: topic.keyword,
      label: topic.label,
      total,
      statusChanges: statusChanges.length,
    });
    if (total === 0 && statusChanges.length === 0) continue;

    const lines = top.map((c) => {
      const sourceName = c.edges[0]?.source?.name?.trim();
      const status = (c.epistemicAxis || c.currentStatus || "").trim();
      const tail = [sourceName, status].filter(Boolean).join(" ");
      const head = truncate(c.text, 120);
      return `• ${head}${tail ? ` — ${tail}` : ""}`;
    });

    const changelines = statusChanges.map(
      (s) => `• ${truncate(s.claim.text, 100)} — ${s.fromAxis} → ${s.toAxis}`,
    );

    const searchUrl = `${SITE_BASE}/search?q=${encodeURIComponent(topic.keyword)}`;
    let section = `${emojiFor(topic.label)} ${topic.label}`;
    if (total > 0) section += `\n${total} new claim${total === 1 ? "" : "s"}:\n${lines.join("\n")}`;
    if (statusChanges.length > 0)
      section += `\n${statusChanges.length} status change${statusChanges.length === 1 ? "" : "s"}:\n${changelines.join("\n")}`;
    section += `\nView all: ${searchUrl}`;
    sections.push(section);
  }

  const range = `${fmtDate(since)} – ${fmtDate(now)}`;
  const header = `📬 ${mode === "daily" ? "Daily" : "Weekly"} Epistemic Receipts Digest — ${range}`;
  const body =
    sections.length > 0
      ? sections.join("\n\n")
      : `No new claims or status changes matched any watched topic in the last ${mode === "daily" ? "24 hours" : "7 days"}.`;
  const digest = `${header}\n\n${body}`;

  await prisma.watchedTopic.updateMany({ data: { lastAlertAt: now } });

  // Send Telegram digest (owner)
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

  // Email subscribers (anonymous + userId-linked, filtered by frequency)
  let emailsSent = 0;
  let emailErrors = 0;

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

      for (const { keyword, label, total, statusChanges } of perTopicCounts) {
        if (total === 0 && statusChanges === 0) continue;

        const subscribers = await prisma.topicSubscription.findMany({
          where: { topicKeyword: keyword, frequency: mode },
          select: {
            id: true,
            email: true,
            unsubscribeToken: true,
            userId: true,
          },
        });
        if (subscribers.length === 0) continue;

        const topClaims = await prisma.claim.findMany({
          where: {
            deleted: false,
            createdAt: { gte: since },
            text: { contains: keyword, mode: "insensitive" as const },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, text: true, epistemicAxis: true, currentStatus: true },
        });

        const topChanges = await prisma.claimStatusHistory.findMany({
          where: {
            occurredAt: { gte: since },
            claim: { deleted: false, text: { contains: keyword, mode: "insensitive" as const } },
            fromAxis: { not: null },
          },
          take: 3,
          orderBy: { occurredAt: "desc" },
          select: {
            fromAxis: true,
            toAxis: true,
            claim: { select: { id: true, text: true } },
          },
        });

        const claimLines = topClaims.map((c) => {
          const status = (c.epistemicAxis || c.currentStatus || "").trim();
          return `• ${truncate(c.text, 140)}${status ? ` — ${status}` : ""}`;
        });

        const changeLines = topChanges.map(
          (s) =>
            `• ${truncate(s.claim.text, 120)} — status changed: ${s.fromAxis} → ${s.toAxis}`,
        );

        for (const sub of subscribers) {
          const unsubUrl = `${SITE_BASE}/api/unsubscribe?token=${sub.unsubscribeToken}`;
          const manageUrl = sub.userId ? `${SITE_BASE}/alerts` : null;
          const searchUrl = `${SITE_BASE}/search?q=${encodeURIComponent(keyword)}`;

          const bodyLines = [
            `${mode === "daily" ? "Daily" : "Weekly"} update for "${label}" — ${range}`,
            ``,
          ];

          if (topClaims.length > 0) {
            bodyLines.push(
              `${total} new claim${total === 1 ? "" : "s"}:`,
              ``,
              ...claimLines,
              ``,
            );
          }

          if (topChanges.length > 0) {
            bodyLines.push(
              `${statusChanges} epistemic status change${statusChanges === 1 ? "" : "s"}:`,
              ``,
              ...changeLines,
              ``,
            );
          }

          bodyLines.push(`See all: ${searchUrl}`, ``, `—`, `Unsubscribe: ${unsubUrl}`);
          if (manageUrl) bodyLines.push(`Manage alerts: ${manageUrl}`);

          try {
            await resend.emails.send({
              from,
              to: sub.email,
              subject: `[Epistemic Receipts] ${mode === "daily" ? "Daily" : "Weekly"} digest — "${label}"`,
              text: bodyLines.join("\n"),
            });
            await prisma.topicSubscription.update({
              where: { id: sub.id },
              data: { lastAlertAt: now },
            });
            emailsSent++;
          } catch (err) {
            console.error(`[topic-alerts] Email to ${sub.email} failed:`, err);
            emailErrors++;
          }
        }
      }
    } catch (err) {
      console.error("[topic-alerts] Resend init failed:", err);
    }
  } else {
    console.log("[topic-alerts] RESEND_API_KEY not set — skipping subscriber emails.");
  }

  return NextResponse.json({
    ok: true,
    mode,
    range,
    topics: perTopicCounts,
    digestLength: digest.length,
    sent,
    sendStatus,
    sendError,
    emailsSent,
    emailErrors,
  });
}

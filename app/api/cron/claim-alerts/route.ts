import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SITE_URL as SITE_BASE } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Claim-follow delivery loop. For each ClaimSubscription, find ClaimStatusHistory
 * rows RECORDED since the subscriber's watermark (createdAt > lastAlertAt) — using
 * ingest time, not occurredAt, because backfilled historical transitions should
 * still notify: from the follower's perspective the curve just moved.
 * Auth, mode, and email conventions mirror /api/cron/topic-alerts.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mode = (url.searchParams.get("mode") ?? "weekly") as "daily" | "weekly";
  const now = new Date();
  const fallbackWindowMs = (mode === "daily" ? 24 : 7 * 24) * 60 * 60 * 1000;

  const subs = await prisma.claimSubscription.findMany({
    where: { frequency: mode },
    orderBy: { createdAt: "asc" },
  });
  if (subs.length === 0) {
    return NextResponse.json({ mode, subscriptions: 0, emailsSent: 0 });
  }

  const claimIds = [...new Set(subs.map((s) => s.claimId))];
  const oldestWatermark = subs.reduce<Date>((min, s) => {
    const w = s.lastAlertAt ?? new Date(now.getTime() - fallbackWindowMs);
    return w < min ? w : min;
  }, now);

  const moves = await prisma.claimStatusHistory.findMany({
    where: { claimId: { in: claimIds }, createdAt: { gt: oldestWatermark } },
    orderBy: { createdAt: "asc" },
    select: {
      claimId: true,
      fromAxis: true,
      toAxis: true,
      reason: true,
      occurredAt: true,
      createdAt: true,
      claim: { select: { id: true, text: true } },
    },
  });

  const byClaim = new Map<string, typeof moves>();
  for (const m of moves) {
    const arr = byClaim.get(m.claimId) ?? [];
    arr.push(m);
    byClaim.set(m.claimId, arr);
  }

  let emailsSent = 0;
  const canSend = !!process.env.RESEND_API_KEY;
  let resend: { emails: { send: (o: object) => Promise<unknown> } } | null = null;
  if (canSend) {
    const { Resend } = await import("resend");
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  for (const sub of subs) {
    const since = sub.lastAlertAt ?? new Date(now.getTime() - fallbackWindowMs);
    const relevant = (byClaim.get(sub.claimId) ?? []).filter((m) => m.createdAt > since);
    if (relevant.length === 0) continue;

    const claim = relevant[0].claim;
    const lines = relevant.map(
      (m) =>
        `• ${m.fromAxis ?? "—"} → ${m.toAxis} (occurred ${m.occurredAt.toISOString().slice(0, 10)})${m.reason ? `\n  ${m.reason.slice(0, 240)}` : ""}`,
    );
    const unsubUrl = `${SITE_BASE}/api/unsubscribe?token=${sub.unsubscribeToken}`;
    const claimUrl = `${SITE_BASE}/claims/${claim.id}`;

    if (canSend && resend) {
      try {
        await resend.emails.send({
          from,
          to: sub.email,
          subject: `A claim you follow moved: ${claim.text.slice(0, 80)}`,
          text: [
            `The settling curve moved for a claim you follow:`,
            ``,
            `"${claim.text.slice(0, 200)}"`,
            claimUrl,
            ``,
            ...lines,
            ``,
            `Unfollow: ${unsubUrl}`,
          ].join("\n"),
        });
        emailsSent++;
      } catch (err) {
        console.error(`[cron/claim-alerts] Resend error for ${sub.email}:`, err);
        continue; // don't advance the watermark on a failed send
      }
    } else {
      console.log(`[cron/claim-alerts] Would email ${sub.email}: ${relevant.length} transition(s) on ${sub.claimId}`);
    }

    await prisma.claimSubscription.update({
      where: { id: sub.id },
      data: { lastAlertAt: now },
    });
  }

  return NextResponse.json({ mode, subscriptions: subs.length, claimsMoved: byClaim.size, emailsSent });
}

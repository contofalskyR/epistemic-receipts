import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function cutoffForFrequency(freq: string, lastRunAt: Date | null): Date {
  const now = Date.now();
  if (lastRunAt) return lastRunAt;
  if (freq === "weekly") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (freq === "instant") return new Date(now - 60 * 60 * 1000);
  return new Date(now - 24 * 60 * 60 * 1000);
}

export async function GET(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const queries = await prisma.savedQuery.findMany({
    include: { profile: { select: { email: true, emailVerifiedAt: true } } },
  });

  let sent = 0;

  for (const query of queries) {
    if (!query.profile.email || !query.profile.emailVerifiedAt) continue;

    const filters = query.filters as {
      topics?: string[];
      polityIds?: string[];
      q?: string;
    };

    const cutoff = cutoffForFrequency(query.frequency, query.lastRunAt);

    const alreadySentIds = (
      await prisma.alertSent.findMany({
        where: { savedQueryId: query.id },
        select: { claimId: true },
      })
    ).map(a => a.claimId);

    const claims = await prisma.claim.findMany({
      where: {
        deleted: false,
        verificationStatus: { not: "DEPRECATED" },
        createdAt: { gte: cutoff },
        id: { notIn: alreadySentIds },
        ...(filters.q ? { text: { contains: filters.q, mode: "insensitive" } } : {}),
        ...(filters.topics?.length
          ? { topics: { some: { topic: { slug: { in: filters.topics } } } } }
          : {}),
        ...(filters.polityIds?.length
          ? { polityLinks: { some: { polityId: { in: filters.polityIds } } } }
          : {}),
      },
      select: { id: true, text: true, ingestedBy: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    if (claims.length === 0) continue;

    const claimRows = claims
      .map(
        c => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #1f2937;color:#e5e7eb;font-size:13px;">
          <a href="${SITE_URL}/claims/${c.id}" style="color:#93c5fd;text-decoration:none;">${c.text.slice(0, 200)}${c.text.length > 200 ? "…" : ""}</a>
          <div style="color:#6b7280;font-size:11px;margin-top:2px;">${c.ingestedBy} · ${new Date(c.createdAt).toLocaleDateString()}</div>
        </td>
      </tr>`,
      )
      .join("");

    await resend.emails.send({
      from: "Epistemic Receipts <alerts@epistemic-receipts.com>",
      to: query.profile.email,
      subject: `${claims.length} new claim${claims.length > 1 ? "s" : ""} match your alert "${query.name}"`,
      html: `
        <div style="font-family:monospace;max-width:600px;margin:0 auto;padding:32px;background:#030712;color:#e5e7eb;">
          <h2 style="color:#fff;margin-top:0;">${claims.length} new claim${claims.length > 1 ? "s" : ""} for "${query.name}"</h2>
          <table style="width:100%;border-collapse:collapse;">${claimRows}</table>
          <p style="margin-top:24px;">
            <a href="${SITE_URL}/alerts" style="color:#93c5fd;">Manage alerts →</a>
          </p>
          <p style="color:#374151;font-size:11px;margin-top:32px;">
            You're receiving this because you saved a search alert.
            <a href="${SITE_URL}/alerts" style="color:#6b7280;">Manage alerts</a>
          </p>
        </div>
      `,
    });

    await prisma.alertSent.createMany({
      data: claims.map(c => ({ savedQueryId: query.id, claimId: c.id })),
      skipDuplicates: true,
    });

    await prisma.savedQuery.update({
      where: { id: query.id },
      data: { lastRunAt: new Date() },
    });

    sent++;
  }

  return NextResponse.json({ ok: true, digestsSent: sent });
}

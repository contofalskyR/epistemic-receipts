/**
 * /api/cron/reconcile-pipelines
 *
 * For each pipeline tag that has a PipelineRun in the last 7 days, compares
 * the sum of `rowsWritten` from PipelineRun records against the actual
 * `SELECT count(*) FROM "Claim" WHERE "ingestedBy" = tag` count.
 *
 * On a mismatch > 1%, sends an alert email via Resend.
 *
 * Security: CRON_SECRET check + isReadOnly() fail-closed.
 * Scheduled daily in vercel.json.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/isReadOnly";
import { makeLogger } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = makeLogger("reconcile-pipelines");

const MISMATCH_THRESHOLD = 0.01; // 1%

type PipelineSummary = {
  pipelineTag: string;
  rowsWrittenSum: number;
  claimCount: number;
  mismatchRatio: number;
  alertFired: boolean;
};

export async function GET(request: Request): Promise<NextResponse> {
  // Fail closed: read-only mode means the reconciler should not run
  if (isReadOnly()) {
    return NextResponse.json({ error: "Read-only mode: reconciliation disabled" }, { status: 503 });
  }

  // CRON_SECRET check
  const cronSecret = process.env.CRON_SECRETE;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    log.warn("unauthorized", { path: "/api/cron/reconcile-pipelines" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  log.info("reconcile_start");

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Find pipeline tags with at least one run in the last 7 days
  const recentRuns = await prisma.pipelineRun.groupBy({
    by: ["pipelineTag"],
    where: { createdAt: { gte: since } },
    _sum: { rowsWritten: true },
  });

  if (recentRuns.length === 0) {
    log.info("reconcile_done", { pipelinesChecked: 0, alertsFired: 0 });
    return NextResponse.json({ ok: true, pipelinesChecked: 0, alertsFired: 0, summaries: [] });
  }

  const summaries: PipelineSummary[] = [];
  const mismatches: PipelineSummary[] = [];

  for (const run of recentRuns) {
    const tag = run.pipelineTag;
    const rowsWrittenSum = run._sum.rowsWritten ?? 0;

    const claimCount = await prisma.claim.count({
      where: { ingestedBy: tag, deleted: false },
    });

    // Avoid divide-by-zero; if both are 0, no mismatch
    const denominator = Math.max(rowsWrittenSum, claimCount, 1);
    const mismatchRatio = Math.abs(rowsWrittenSum - claimCount) / denominator;
    const alertFired = mismatchRatio > MISMATCH_THRESHOLD;

    summaries.push({ pipelineTag: tag, rowsWrittenSum, claimCount, mismatchRatio, alertFired });

    if (alertFired) {
      log.warn("pipeline_mismatch", { pipelineTag: tag, rowsWrittenSum, claimCount, mismatchRatio });
      mismatches.push({ pipelineTag: tag, rowsWrittenSum, claimCount, mismatchRatio, alertFired });
    } else {
      log.info("pipeline_ok", { pipelineTag: tag, rowsWrittenSum, claimCount });
    }
  }

  // Send alert email if there are mismatches
  let emailSent = false;
  let emailError: string | null = null;

  if (mismatches.length > 0) {
    const resendKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL ?? process.env.RESEND_FROM_EMAIL;

    if (!resendKey || !adminEmail) {
      log.warn("email_skipped", { reason: "RESEND_API_KEY or ADMIN_EMAIL not set", mismatchCount: mismatches.length });
    } else {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(resendKey);
        const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

        const tableRows = mismatches
          .map(m =>
            `  ${m.pipelineTag}: rowsWritten=${m.rowsWrittenSum} claimCount=${m.claimCount} ` +
            `diff=${(m.mismatchRatio * 100).toFixed(1)}%`,
          )
          .join("\n");

        await resend.emails.send({
          from,
          to: adminEmail,
          subject: `[Epistemic Receipts] Pipeline reconciliation mismatch — ${mismatches.length} pipeline(s)`,
          text: [
            `Pipeline reconciliation alert — ${new Date().toISOString()}`,
            ``,
            `The following pipelines have a >1% discrepancy between PipelineRun.rowsWritten`,
            `totals (last 7 days) and the actual Claim count in the database:`,
            ``,
            tableRows,
            ``,
            `This may indicate a transaction rollback, a counter bug, or deleted claims.`,
            `Run a count query to verify:`,
            ``,
            mismatches.map(m => `SELECT count(*) FROM "Claim" WHERE "ingestedBy" = '${m.pipelineTag}' AND "deleted" = false;`).join("\n"),
          ].join("\n"),
        });
        emailSent = true;
        log.info("alert_email_sent", { to: adminEmail, mismatchCount: mismatches.length });
      } catch (err) {
        emailError = err instanceof Error ? err.message : String(err);
        log.error("alert_email_failed", { message: emailError });
      }
    }
  }

  log.info("reconcile_done", {
    pipelinesChecked: summaries.length,
    alertsFired: mismatches.length,
    emailSent,
  });

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    since: since.toISOString(),
    pipelinesChecked: summaries.length,
    alertsFired: mismatches.length,
    emailSent,
    emailError,
    summaries,
  });
}

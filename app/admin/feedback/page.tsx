import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const adminToken = process.env.ADMIN_TOKEN;
  if (adminToken) {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("admin_auth")?.value;
    const expected = crypto.createHash("sha256").update(adminToken).digest("hex");
    if (adminCookie !== expected) {
      redirect("/login?from=/admin/feedback");
    }
  }

  const rows = await prisma.feedback.findMany({
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Feedback</h1>
        <p className="text-sm text-gray-500">{rows.length} submission{rows.length !== 1 ? "s" : ""}</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No feedback yet.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.id} className="rounded border border-gray-800 bg-gray-900 px-4 py-3 space-y-1">
              <p className="text-white text-sm whitespace-pre-wrap">{row.body}</p>
              <div className="flex gap-4 text-xs text-gray-500 pt-1">
                <span>{new Date(row.submittedAt).toLocaleString("en-US", { timeZone: "America/New_York" })}</span>
                {row.email && <span>{row.email}</span>}
                {row.pageContext && <span>from: {row.pageContext}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

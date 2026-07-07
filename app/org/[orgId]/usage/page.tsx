import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ orgId: string }> };

export default async function OrgUsagePage({ params }: Props) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });
  if (!membership || !["owner", "admin"].includes(membership.role)) redirect("/");

  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) redirect("/");

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const rows = await prisma.orgUsageDaily.findMany({
    where: { orgId, date: { gte: thirtyDaysAgo, lte: today } },
    orderBy: [{ date: "desc" }, { metric: "asc" }],
  });

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-white">{org.name} — Usage (last 30 days)</h1>
        <p className="text-xs text-gray-500 mt-1">
          Daily metric counts.{" "}
          <a
            href={`/api/org/${orgId}/usage?format=csv&since=${thirtyDaysAgo}&until=${today}`}
            className="underline hover:text-gray-300"
          >
            Download CSV
          </a>
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No usage recorded in this period.</p>
      ) : (
        <table className="w-full text-sm text-gray-300">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Metric</th>
              <th className="text-right py-2">Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-gray-900">
                <td className="py-2 font-mono text-xs">{r.date}</td>
                <td className="py-2 text-gray-400">{r.metric}</td>
                <td className="py-2 text-right tabular-nums">{r.count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

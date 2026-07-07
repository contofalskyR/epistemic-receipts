import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/entitlements";
import MatterExportButton from "./MatterExportButton";

type Props = { params: Promise<{ orgId: string; matterId: string }> };

export default async function MatterDetailPage({ params }: Props) {
  const { orgId, matterId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
    include: { org: { select: { id: true, name: true, tier: true } } },
  });
  if (!membership) redirect("/");

  const entitled = can(
    { org: { id: orgId, tier: membership.org.tier as "free" | "pro" | "team" | "enterprise" } },
    "litigation",
  );
  if (!entitled) redirect(`/org/${orgId}/litigation`);

  const matter = await prisma.litigationMatter.findUnique({
    where: { id: matterId },
  });
  if (!matter || matter.orgId !== orgId) notFound();

  const claims = await prisma.matterClaim.findMany({
    where: { matterId },
    include: {
      claim: {
        select: {
          id: true,
          text: true,
          epistemicAxis: true,
          claimEmergedAt: true,
          epistemicStatus: true,
          statusHistory: {
            orderBy: { occurredAt: "desc" },
            take: 1,
            select: { toAxis: true, occurredAt: true, community: true },
          },
        },
      },
      addedBy: { select: { email: true, name: true } },
    },
    orderBy: { addedAt: "desc" },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-2">
        <Link
          href={`/org/${orgId}/litigation`}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ← All matters
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{matter.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                matter.status === "ACTIVE"
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : matter.status === "CLOSED"
                    ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
              }`}
            >
              {matter.status}
            </span>
            {matter.caseNumber && (
              <span className="text-sm text-gray-500 dark:text-gray-400">#{matter.caseNumber}</span>
            )}
            {matter.jurisdiction && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{matter.jurisdiction}</span>
            )}
          </div>
          {matter.description && (
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">{matter.description}</p>
          )}
        </div>
        <MatterExportButton matterId={matterId} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Claims ({claims.length})</h2>
        <Link
          href={`/org/${orgId}/litigation/${matterId}/new-claim`}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Add claim
        </Link>
      </div>

      {claims.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No claims added yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {claims.map((mc) => (
            <li key={mc.id} className="py-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/claims/${mc.claim.id}`}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline line-clamp-2"
                  >
                    {mc.claim.text}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    {mc.claim.epistemicAxis && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                        {mc.claim.epistemicAxis}
                      </span>
                    )}
                    {mc.relevanceTag && (
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                        {mc.relevanceTag}
                      </span>
                    )}
                    {mc.claim.statusHistory[0] && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Latest: {mc.claim.statusHistory[0].toAxis}
                      </span>
                    )}
                  </div>
                  {mc.notes && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{mc.notes}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Added by {mc.addedBy.name ?? mc.addedBy.email} ·{" "}
                    {new Date(mc.addedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/entitlements";

type Props = { params: Promise<{ orgId: string }> };

export default async function LitigationMattersPage({ params }: Props) {
  const { orgId } = await params;
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

  if (!entitled) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-4">Litigation Workbench</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          The Litigation Workbench is available on Team and Enterprise plans.
        </p>
        <Link
          href="/pricing"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Upgrade plan
        </Link>
      </div>
    );
  }

  const matters = await prisma.litigationMatter.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Litigation Workbench</h1>
        <form action={`/api/litigation/matters`} method="post">
          <Link
            href={`/org/${orgId}/litigation/new`}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            New matter
          </Link>
        </form>
      </div>

      {matters.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No matters yet. Create one to get started.</p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {matters.map((m) => (
            <li key={m.id} className="py-4">
              <Link
                href={`/org/${orgId}/litigation/${m.id}`}
                className="block hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-2 py-1 rounded"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      m.status === "ACTIVE"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : m.status === "CLOSED"
                          ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                    }`}
                  >
                    {m.status}
                  </span>
                  <span className="font-medium">{m.name}</span>
                  {m.caseNumber && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">#{m.caseNumber}</span>
                  )}
                </div>
                {m.jurisdiction && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{m.jurisdiction}</p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Created {new Date(m.createdAt).toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

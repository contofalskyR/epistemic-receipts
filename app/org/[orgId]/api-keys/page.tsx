import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/entitlements";

type Props = { params: Promise<{ orgId: string }> };

export default async function OrgApiKeysPage({ params }: Props) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });
  if (!membership || !["owner", "admin"].includes(membership.role)) redirect("/");

  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) redirect("/");

  const ctx = { org: { id: org.id, tier: org.tier as "free" | "pro" | "team" | "enterprise", role: membership.role as "member" | "admin" | "owner" } };
  if (!can(ctx, "api.keys")) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-lg font-semibold text-white">{org.name} — API Keys</h1>
        <p className="text-sm text-gray-500">
          API keys are available on the Enterprise plan. Contact your account manager to upgrade.
        </p>
      </div>
    );
  }

  const keys = await prisma.apiKey.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, expiresAt: true },
  });

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-white">{org.name} — API Keys</h1>
        <p className="text-xs text-gray-500 mt-1">
          Keys are scoped to this organisation. Revoke immediately if compromised.
        </p>
      </div>

      {keys.length === 0 ? (
        <p className="text-sm text-gray-500">No API keys. Create one via the API: POST /api/org/{orgId}/api-keys</p>
      ) : (
        <table className="w-full text-sm text-gray-300">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="text-left py-2">Name</th>
              <th className="text-left py-2">Prefix</th>
              <th className="text-left py-2">Last used</th>
              <th className="text-left py-2">Expires</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(k => (
              <tr key={k.id} className="border-b border-gray-900">
                <td className="py-2">{k.name ?? "—"}</td>
                <td className="py-2 font-mono text-xs">{k.prefix}…</td>
                <td className="py-2 text-gray-500">
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                </td>
                <td className="py-2 text-gray-500">
                  {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : "No expiry"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

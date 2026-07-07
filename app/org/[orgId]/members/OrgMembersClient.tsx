"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = {
  userId: string;
  role: string;
  user: { id: string; email: string; name: string | null };
};

type Props = {
  org: { id: string; name: string; seats: number };
  members: Member[];
  currentRole: string;
};

export default function OrgMembersClient({ org, members: initial, currentRole }: Props) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isAdmin = ["owner", "admin"].includes(currentRole);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(`/api/org/${org.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed to invite"); } else {
      setInviteEmail("");
      router.refresh();
    }
    setLoading(false);
  }

  async function removeMember(userId: string) {
    await fetch(`/api/org/${org.id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-white">{org.name} — Members</h1>
        <p className="text-xs text-gray-500 mt-1">{initial.length} / {org.seats} seats</p>
      </div>

      {isAdmin && (
        <form onSubmit={invite} className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              maxLength={254} required
              className="rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
              placeholder="user@example.com" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as "member" | "admin")}
              className="rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" disabled={loading}
            className="rounded bg-white text-gray-950 text-sm font-medium px-4 py-2 hover:bg-gray-200 disabled:opacity-40">
            {loading ? "Inviting…" : "Invite"}
          </button>
          {error && <p className="text-red-400 text-xs w-full">{error}</p>}
        </form>
      )}

      <table className="w-full text-sm text-gray-300">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-800">
            <th className="text-left py-2">Email</th>
            <th className="text-left py-2">Name</th>
            <th className="text-left py-2">Role</th>
            {isAdmin && <th />}
          </tr>
        </thead>
        <tbody>
          {initial.map(m => (
            <tr key={m.userId} className="border-b border-gray-900">
              <td className="py-2">{m.user.email}</td>
              <td className="py-2 text-gray-500">{m.user.name ?? "—"}</td>
              <td className="py-2 capitalize">{m.role}</td>
              {isAdmin && (
                <td className="py-2 text-right">
                  {m.role !== "owner" && (
                    <button onClick={() => removeMember(m.userId)} className="text-xs text-red-500 hover:text-red-400">
                      Remove
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

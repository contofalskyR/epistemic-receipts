"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Range = {
  id: string;
  cidr: string;
  label: string;
  confirmFlag: boolean;
  createdAt: Date;
};

type Props = {
  org: { id: string; name: string };
  ranges: Range[];
};

export default function OrgIpRangesClient({ org, ranges: initial }: Props) {
  const router = useRouter();
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function addRange(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(`/api/org/${org.id}/ip-ranges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cidr, label, confirmFlag: confirm }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add range");
    } else {
      setCidr("");
      setLabel("");
      setConfirm(false);
      router.refresh();
    }
    setLoading(false);
  }

  async function removeRange(id: string) {
    await fetch(`/api/org/${org.id}/ip-ranges`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-white">{org.name} — IP Ranges</h1>
        <p className="text-xs text-gray-500 mt-1">
          Requests from these ranges are automatically associated with your org.
        </p>
      </div>

      <form onSubmit={addRange} className="space-y-3">
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">CIDR</label>
            <input
              type="text"
              value={cidr}
              onChange={e => setCidr(e.target.value)}
              maxLength={64}
              required
              placeholder="10.0.0.0/24"
              className="rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              maxLength={80}
              placeholder="Office VPN"
              className="rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-white text-gray-950 text-sm font-medium px-4 py-2 hover:bg-gray-200 disabled:opacity-40"
          >
            {loading ? "Adding…" : "Add"}
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={confirm}
            onChange={e => setConfirm(e.target.checked)}
            className="rounded"
          />
          This is a broad range (prefix shorter than /16). I understand the risk.
        </label>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </form>

      {initial.length === 0 ? (
        <p className="text-sm text-gray-500">No IP ranges configured.</p>
      ) : (
        <table className="w-full text-sm text-gray-300">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="text-left py-2">CIDR</th>
              <th className="text-left py-2">Label</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {initial.map(r => (
              <tr key={r.id} className="border-b border-gray-900">
                <td className="py-2 font-mono text-xs">{r.cidr}</td>
                <td className="py-2 text-gray-500">{r.label || "—"}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => removeRange(r.id)}
                    className="text-xs text-red-500 hover:text-red-400"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

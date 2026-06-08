"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type MemberHit = {
  memberId: string;
  memberName: string;
  memberState: string | null;
  memberParty: string | null;
  voteCount: number;
};

type MembersResponse = { members: MemberHit[] };

function partyClass(p: string | null): string {
  if (!p) return "bg-gray-800 text-gray-400 border border-gray-700/50";
  const x = p.toLowerCase();
  if (/republican|gop|\br\b/.test(x)) return "bg-red-950 text-red-300 border border-red-900/60";
  if (/democrat|\bd\b/.test(x)) return "bg-blue-950 text-blue-300 border border-blue-900/60";
  if (/independent|\bi\b/.test(x)) return "bg-purple-950 text-purple-300 border border-purple-900/60";
  return "bg-gray-800 text-gray-400 border border-gray-700/50";
}

export default function MembersClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? "";

  const [input, setInput] = useState(urlQ);
  const [data, setData] = useState<MembersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setInput(urlQ);
  }, [urlQ]);

  const pushUrl = useCallback(
    (q: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      const qs = next.toString();
      router.replace(qs ? `/members?${qs}` : "/members");
    },
    [router, searchParams],
  );

  useEffect(() => {
    if (urlQ.length < 2) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    fetch(`/api/members/search?q=${encodeURIComponent(urlQ)}`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return (await r.json()) as MembersResponse;
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === "AbortError") return;
        setError(err.message || "Search failed");
        setLoading(false);
      });
    return () => controller.abort();
  }, [urlQ]);

  function onInput(v: string) {
    setInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushUrl(v.trim());
    }, 300);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Members</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Search congressional members</h1>
        <p className="mt-2 text-gray-400 max-w-2xl text-sm leading-relaxed">
          12,000+ US House and Senate members from Voteview, indexed by bioguide ID. Search by name to see their full roll-call history.
        </p>
      </div>

      <input
        type="text"
        value={input}
        onChange={e => onInput(e.target.value)}
        placeholder="Search by name (e.g. Pelosi, McCain, Mitchell)…"
        className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
      />

      {input.length > 0 && input.length < 2 && (
        <p className="text-xs text-gray-600 italic">Type at least 2 characters.</p>
      )}

      {loading && <p className="text-sm text-gray-500">Searching…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {data && !loading && (
        <div className="space-y-2">
          {data.members.length === 0 ? (
            <p className="text-sm text-gray-500">No members match that name.</p>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                {data.members.length} member{data.members.length === 1 ? "" : "s"} (top {data.members.length} by recorded votes)
              </p>
              <div className="rounded-lg border border-gray-800 bg-gray-900 divide-y divide-gray-800">
                {data.members.map(m => (
                  <Link
                    key={m.memberId}
                    href={`/members/${encodeURIComponent(m.memberId)}`}
                    className="block px-4 py-3 hover:bg-gray-800/60 transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-gray-200 group-hover:text-white truncate">{m.memberName}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 font-mono">
                          <span>{m.memberState ?? "—"}</span>
                          <span className="text-gray-700">·</span>
                          <span>{m.memberId}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${partyClass(m.memberParty)}`}>
                          {m.memberParty ?? "?"}
                        </span>
                        <div className="text-[10px] text-gray-500 mt-1 font-mono">
                          {m.voteCount.toLocaleString()} votes
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

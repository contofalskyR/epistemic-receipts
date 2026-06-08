"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { isReadOnly } from "@/lib/isReadOnly";

const CLAIM_TYPES = ["EMPIRICAL", "INSTITUTIONAL", "INTERPRETIVE", "HYBRID"] as const;

type ClaimType = typeof CLAIM_TYPES[number];
type Topic = { id: string; name: string; slug: string; domain: string };

const DOMAIN_LABELS: Record<string, string> = {
  astronomy:    "Astronomy",
  history:      "History",
  law:          "Law",
  medicine:     "Medicine",
  psychology:   "Psychology",
  public_health: "Public Health",
};

function TopicSelector({
  allTopics,
  selected,
  onChange,
}: {
  allTopics: Topic[];
  selected: Topic[];
  onChange: (topics: Topic[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const selectedIds = new Set(selected.map(t => t.id));
  const filtered = search.trim()
    ? allTopics.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.domain.toLowerCase().includes(search.toLowerCase()))
    : allTopics;

  function toggle(topic: Topic) {
    if (selectedIds.has(topic.id)) onChange(selected.filter(t => t.id !== topic.id));
    else onChange([...selected, topic]);
  }

  const byDomain = filtered.reduce<Record<string, Topic[]>>((acc, t) => {
    acc[t.domain] = acc[t.domain] ?? [];
    acc[t.domain].push(t);
    return acc;
  }, {});

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">Topics</label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(t => (
            <span
              key={t.id}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300"
            >
              {t.name}
              <button
                type="button"
                onClick={() => toggle(t)}
                className="text-gray-600 hover:text-red-400 transition-colors leading-none ml-0.5"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="text-xs px-2.5 py-1.5 rounded border border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors"
        >
          {selected.length > 0 ? "Add / remove topics ▾" : "Add topics ▾"}
        </button>

        {open && (
          <div className="absolute top-full mt-1 left-0 bg-gray-900 border border-gray-700 rounded-lg py-1 z-30 w-72 max-h-72 overflow-y-auto shadow-2xl">
            <div className="px-2 py-1.5 border-b border-gray-800 sticky top-0 bg-gray-900">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search topics…"
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-gray-500"
              />
            </div>
            {Object.entries(byDomain).sort().map(([domain, topics]) => (
              <div key={domain}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 px-3 pt-2 pb-1">
                  {DOMAIN_LABELS[domain] ?? domain}
                </p>
                {topics.map(topic => (
                  <label
                    key={topic.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-800 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(topic.id)}
                      onChange={() => toggle(topic)}
                      className="accent-blue-500 shrink-0"
                    />
                    {topic.name}
                  </label>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-gray-600 px-3 py-2">No matches</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EditClaimPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("from") === "review" ? "/review" : `/claims/${id}`;

  const [text, setText] = useState("");
  const [claimType, setClaimType] = useState<ClaimType>("EMPIRICAL");
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/claims/${id}`).then(r => r.json()),
      fetch("/api/topics").then(r => r.json()),
    ]).then(([claim, topicsData]) => {
      setText(claim.text ?? "");
      setClaimType(claim.claimType ?? "EMPIRICAL");
      setSelectedTopics((claim.topics ?? []).map((ct: { topic: Topic }) => ct.topic));

      const flat: Topic[] = [];
      for (const nodes of Object.values(topicsData.domains as Record<string, { id: string; name: string; slug: string; domain: string; children: Topic[] }[]>)) {
        function collect(n: { id: string; name: string; slug: string; domain: string; children?: Topic[] }) {
          flat.push({ id: n.id, name: n.name, slug: n.slug, domain: n.domain });
          n.children?.forEach(collect);
        }
        nodes.forEach(collect);
      }
      setAllTopics(flat);
      setLoading(false);
    });
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) { setError("Text is required."); return; }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/claims/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.trim(),
        claimType,
        topicIds: selectedTopics.map(t => t.id),
      }),
    });
    if (res.ok) {
      router.push(returnTo);
    } else {
      const { error: msg } = await res.json();
      setError(msg ?? "Save failed.");
      setSaving(false);
    }
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;
  if (isReadOnly()) return (
    <div>
      <a href={returnTo} className="text-xs text-gray-500 hover:text-gray-300">← Back</a>
      <p className="text-sm text-gray-500 italic mt-4">Editing is disabled in this deployment.</p>
    </div>
  );

  const btnBase = "text-sm px-3 py-1 rounded font-medium transition-colors";

  return (
    <div className="max-w-xl">
      <div className="mb-5">
        <a href={returnTo} className="text-xs text-gray-500 hover:text-gray-300">← Back</a>
        <h1 className="text-lg font-semibold text-white mt-2">Edit Claim</h1>
      </div>

      <form onSubmit={save} className="space-y-5">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Claim text</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-gray-500 resize-y"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-2">Type</label>
          <div className="flex gap-2 flex-wrap">
            {CLAIM_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setClaimType(t)}
                className={`${btnBase} ${claimType === t ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <TopicSelector
          allTopics={allTopics}
          selected={selectedTopics}
          onChange={setSelectedTopics}
        />

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="text-sm px-4 py-1.5 rounded bg-white text-gray-900 font-medium hover:bg-gray-200 disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <a
            href={returnTo}
            className="text-sm px-4 py-1.5 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";

export function IdeologyPicker({
  congress,
  chamber,
  congresses,
  chamberOptions,
}: {
  congress: number;
  chamber: string;
  congresses: number[];
  chamberOptions: string[];
}) {
  const router = useRouter();

  function navigate(newCongress: number, newChamber: string) {
    router.push(`/analysis/ideology?congress=${newCongress}&chamber=${newChamber}`);
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <label className="flex items-center gap-2 text-xs text-gray-400">
        <span className="font-mono text-gray-600 uppercase tracking-widest">Congress</span>
        <select
          value={String(congress)}
          onChange={(e) => navigate(Number(e.target.value), chamber)}
          className="bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-gray-500"
        >
          {congresses.map((c) => (
            <option key={c} value={String(c)}>
              {ordinal(c)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-gray-400">
        <span className="font-mono text-gray-600 uppercase tracking-widest">Chamber</span>
        <select
          value={chamber}
          onChange={(e) => navigate(congress, e.target.value)}
          className="bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-gray-500"
        >
          {chamberOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { AcademicFieldNode } from "@/app/api/fields/route";

const TOP_LEVEL_DESCRIPTIONS: Record<string, string> = {
  "humanities":          "Philosophy, history, languages, literature, and the arts",
  "social-sciences":     "Psychology, economics, political science, sociology, and law",
  "natural-sciences":    "Biology, physics, chemistry, astronomy, and earth sciences",
  "formal-sciences":     "Mathematics, logic, computer science, and statistics",
  "applied-sciences":    "Medicine, engineering, agriculture, and other applied disciplines",
};

export default function FieldsPage() {
  const [fields, setFields] = useState<AcademicFieldNode[] | null>(null);

  useEffect(() => {
    fetch("/api/fields")
      .then(r => r.json())
      .then(d => setFields(d.fields ?? []));
  }, []);

  if (!fields) return <p className="text-gray-600 text-sm">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-xl font-semibold text-white">Academic Fields</h1>
        <p className="mt-2 text-sm text-gray-500">
          Browse claims and topics by academic discipline — from the{" "}
          <span className="font-mono text-gray-400">Wikipedia Outline of Academic Disciplines</span>.
        </p>
      </div>

      <div className="grid gap-4">
        {fields.map(field => {
          const desc = TOP_LEVEL_DESCRIPTIONS[field.slug] ?? `${field.children.length} subfields`;
          const childCount = field.children.length;
          return (
            <Link
              key={field.id}
              href={`/fields/${field.slug}`}
              className="block rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4 hover:border-gray-600 hover:bg-gray-900/70 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-white group-hover:text-gray-100">
                    {field.name}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">{desc}</p>
                  {childCount > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {field.children.slice(0, 8).map(c => (
                        <span
                          key={c.id}
                          className="text-xs px-2 py-0.5 rounded border border-gray-800 text-gray-600"
                        >
                          {c.name}
                        </span>
                      ))}
                      {childCount > 8 && (
                        <span className="text-xs px-2 py-0.5 text-gray-700">
                          +{childCount - 8} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right space-y-1">
                  {field.claimCount > 0 && (
                    <p className="text-xs text-gray-600">
                      <span className="text-gray-400">{field.claimCount.toLocaleString()}</span> claims
                    </p>
                  )}
                  {field.topicCount > 0 && (
                    <p className="text-xs text-gray-600">
                      <span className="text-gray-400">{field.topicCount}</span> topics
                    </p>
                  )}
                  <p className="text-xs text-gray-700">{childCount} subfields</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

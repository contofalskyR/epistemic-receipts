"use client";
import { useRef, useState } from "react";
import { Quote } from "lucide-react";

type Props = {
  type: "claim" | "source";
  id: string;
};

const FORMATS = [
  { label: "BibTeX", value: "bibtex", ext: "bib" },
  { label: "RIS", value: "ris", ext: "ris" },
  { label: "CSL-JSON", value: "csl-json", ext: "json" },
] as const;

export default function CitationButton({ type, id }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  async function copyFormat(format: string) {
    const url = `/api/citations/${type}/${id}?format=${format}`;
    try {
      const res = await fetch(url);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopied(format);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // fallback: open in new tab
      window.open(url, "_blank");
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 transition-colors bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        title="Cite this"
      >
        <Quote size={12} />
        <span>Cite</span>
      </button>

      {open && (
        <div className="absolute left-0 top-7 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-44 py-1">
          {FORMATS.map((f) => (
            <div key={f.value} className="flex items-center justify-between px-3 py-1.5">
              <span className="text-xs text-gray-300">{f.label}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => copyFormat(f.value)}
                  className="text-xs text-gray-400 hover:text-white"
                  title="Copy to clipboard"
                >
                  {copied === f.value ? "✓" : "Copy"}
                </button>
                <a
                  href={`/api/citations/${type}/${id}?format=${f.value}`}
                  download={`${type}-${id}.${f.ext}`}
                  className="text-xs text-gray-400 hover:text-white"
                  title="Download"
                >
                  ↓
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

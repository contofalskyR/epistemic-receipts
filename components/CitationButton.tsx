"use client";
import { useState } from "react";
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
type Format = (typeof FORMATS)[number];

export default function CitationButton({ type, id }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // One fetch for Copy and Download, and only a 2xx body is ever copied or
  // saved: the route answers 422 for an entity with no citable source (237
  // curated trajectories have no live evidence edge), and the old buttons
  // copied or downloaded that JSON error under a ✓ (front door phase 6).
  async function fetchCitation(f: Format): Promise<Response | null> {
    setNote(null);
    setCopied(null);
    let res: Response;
    try {
      res = await fetch(`/api/citations/${type}/${encodeURIComponent(id)}?format=${f.value}`);
    } catch {
      setNote("Couldn't load the citation (network error).");
      return null;
    }
    if (res.status === 422) {
      setNote(`No citable source recorded for this ${type} yet.`);
      return null;
    }
    if (!res.ok) {
      setNote(`Couldn't load the citation (HTTP ${res.status}).`);
      return null;
    }
    return res;
  }

  async function copyFormat(f: Format) {
    const res = await fetchCitation(f);
    if (!res) return;
    try {
      await navigator.clipboard.writeText(await res.text());
      setCopied(f.value);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setNote("Couldn't copy to the clipboard. Use the download button instead.");
    }
  }

  async function downloadFormat(f: Format) {
    const res = await fetchCitation(f);
    if (!res) return;
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = `${type}-${id}.${f.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  }

  return (
    <div className="relative">
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
                  type="button"
                  onClick={() => copyFormat(f)}
                  className="text-xs text-gray-400 hover:text-white"
                  title="Copy to clipboard"
                >
                  {copied === f.value ? "✓" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => downloadFormat(f)}
                  className="text-xs text-gray-400 hover:text-white"
                  title="Download"
                  aria-label={`Download ${f.label}`}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
          <p role="status" aria-live="polite" className="px-3 text-xs text-amber-300/90">
            {note ?? ""}
          </p>
        </div>
      )}
    </div>
  );
}

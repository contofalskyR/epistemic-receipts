"use client";
import { useState } from "react";
import { Code } from "lucide-react";

type Props = {
  slug?: string;
  claimId?: string;
  title?: string;
  siteUrl: string;
};

export default function EmbedButton({ slug, claimId, title = "", siteUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"iframe" | "badge" | null>(null);

  if (!slug && !claimId) return null;

  const safeTitle = title.replace(/"/g, "&quot;");
  const iframeSnippet = slug
    ? `<iframe src="${siteUrl}/embed/trajectory/${slug}" width="100%" height="200" style="border:0" loading="lazy" title="${safeTitle} — settling curve"></iframe>`
    : null;
  const badgeSnippet = claimId
    ? `[![Epistemic status](${siteUrl}/api/badge/claim/${claimId}.svg)](${siteUrl}/claims/${claimId})`
    : null;

  async function copy(text: string, which: "iframe" | "badge") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 transition-colors bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        title="Embed this trajectory"
        aria-expanded={open}
      >
        <Code size={12} />
        <span>Embed</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-8 left-0 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-80 p-3 space-y-3">
            {iframeSnippet && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">
                    iframe embed
                  </span>
                  <button
                    onClick={() => copy(iframeSnippet, "iframe")}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    {copied === "iframe" ? "✓ copied" : "copy"}
                  </button>
                </div>
                <code className="block text-[10px] text-gray-300 bg-gray-800 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {iframeSnippet}
                </code>
              </div>
            )}
            {badgeSnippet && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">
                    badge (markdown)
                  </span>
                  <button
                    onClick={() => copy(badgeSnippet, "badge")}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    {copied === "badge" ? "✓ copied" : "copy"}
                  </button>
                </div>
                <code className="block text-[10px] text-gray-300 bg-gray-800 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {badgeSnippet}
                </code>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

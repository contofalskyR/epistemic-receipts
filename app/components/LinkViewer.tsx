"use client";
import React, { useEffect, useRef, useState } from "react";

type Props = {
  url: string;
  onClose: () => void;
};

type Article = {
  title: string | null;
  byline: string | null;
  siteName: string | null;
  excerpt: string | null;
  content: string;
  length: number;
};

export default function LinkViewer({ url, onClose }: Props) {
  const [mode, setMode] = useState<"loading" | "reader" | "iframe" | "blocked">("loading");
  const [article, setArticle] = useState<Article | null>(null);
  // Server-side verdict from X-Frame-Options / CSP frame-ancestors.
  // null = unknown (proxy couldn't reach the site); browsers hide this
  // from client JS, so only the proxy can tell us.
  const [canEmbed, setCanEmbed] = useState<boolean | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    async function tryReader() {
      let embeddable: boolean | null = null;
      try {
        const res = await fetch(`/api/proxy/reader?url=${encodeURIComponent(url)}`);
        // Error responses still carry the embeddability verdict
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (data && typeof data.embeddable === "boolean") {
          embeddable = data.embeddable;
          setCanEmbed(data.embeddable);
        }
        if (res.ok && data?.content) {
          setArticle(data);
          setMode("reader");
          return;
        }
      } catch {
        // fall through to iframe
      }

      if (cancelled) return;
      // PDF links — go straight to new tab
      if (/\.pdf(\?|#|$)/i.test(url)) {
        setMode("blocked");
        return;
      }
      // Site forbids framing — the iframe would only show the browser's
      // own "content blocked" page, so skip straight to the panel.
      if (embeddable === false) {
        setMode("blocked");
        return;
      }
      setMode("iframe");
    }

    tryReader();
    return () => { cancelled = true; };
  }, [url]);

  function handleIframeLoad() {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc && doc.location.href === "about:blank" && !doc.body?.childElementCount) {
        setMode("blocked");
      }
    } catch {
      // Cross-origin SecurityError = loaded fine
    }
  }

  const displayUrl = url.length > 90 ? url.slice(0, 87) + "..." : url;
  const domain = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  })();

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-stretch sm:items-center justify-center bg-black/75 backdrop-blur-sm link-viewer-fade"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Link viewer"
    >
      <div className="relative flex flex-col bg-gray-950 border border-gray-700 shadow-2xl w-full h-full sm:rounded-lg sm:w-[85vw] sm:h-[85vh] sm:max-w-[1400px] overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors"
            />
            <span className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <span className="w-3 h-3 rounded-full bg-green-500/50" />
          </div>
          <div className="flex-1 mx-2 px-3 py-1 bg-gray-800 border border-gray-700/60 rounded text-gray-300 font-mono text-xs truncate">
            {displayUrl}
          </div>
          {mode === "reader" && canEmbed !== false && (
            <button
              onClick={() => setMode("iframe")}
              className="text-xs text-gray-400 hover:text-gray-200 border border-gray-600 hover:border-gray-400 rounded px-2 py-1 transition-colors shrink-0"
            >
              Show original
            </button>
          )}
          {mode === "iframe" && article && (
            <button
              onClick={() => setMode("reader")}
              className="text-xs text-gray-400 hover:text-gray-200 border border-gray-600 hover:border-gray-400 rounded px-2 py-1 transition-colors shrink-0"
            >
              Reader view
            </button>
          )}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            data-no-viewer="1"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-amber-300 hover:text-amber-200 border border-amber-500/40 hover:border-amber-400 rounded px-2 py-1 transition-colors shrink-0 font-medium"
          >
            Open in new tab ↗
          </a>
          <button
            onClick={onClose}
            aria-label="Close link viewer"
            className="ml-1 text-gray-400 hover:text-gray-100 px-2 py-0.5 text-xl leading-none shrink-0"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-hidden">
          {mode === "loading" && (
            <div className="flex items-center justify-center h-full bg-gray-950 text-gray-500 font-mono text-xs">
              loading {displayUrl}…
            </div>
          )}

          {mode === "reader" && article && (
            <div className="h-full overflow-y-auto bg-gray-950">
              <article className="max-w-3xl mx-auto px-6 sm:px-10 py-8">
                {article.siteName && (
                  <div className="text-amber-400/70 text-xs font-mono tracking-widest uppercase mb-3">
                    {article.siteName}
                  </div>
                )}
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 leading-tight mb-3">
                  {article.title || domain}
                </h1>
                {article.byline && (
                  <div className="text-gray-400 text-sm mb-6">{article.byline}</div>
                )}
                <div className="h-px bg-gray-800 mb-6" />
                <div
                  className={[
                    "reader-content prose prose-invert prose-amber max-w-none",
                    "prose-headings:text-gray-200 prose-p:text-gray-300",
                    "prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline",
                    "prose-strong:text-gray-200 prose-img:rounded-lg prose-img:mx-auto",
                    "prose-blockquote:border-amber-500/40",
                    "prose-code:text-amber-300 prose-code:bg-gray-800 prose-code:px-1 prose-code:rounded",
                    "prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800",
                    "prose-li:text-gray-300 prose-table:text-gray-300",
                    "prose-th:text-gray-200 prose-td:border-gray-800 prose-th:border-gray-800",
                  ].join(" ")}
                  dangerouslySetInnerHTML={{ __html: article.content }}
                />
                <div className="mt-10 pt-6 border-t border-gray-800 text-center">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    data-no-viewer="1"
                    className="text-sm text-amber-400 hover:text-amber-300 font-mono"
                  >
                    View original on {domain} ↗
                  </a>
                </div>
              </article>
            </div>
          )}

          {mode === "iframe" && (
            <>
              <iframe
                ref={iframeRef}
                src={url}
                onLoad={handleIframeLoad}
                className="w-full h-full border-0 bg-white"
                title="External link preview"
                referrerPolicy="no-referrer"
              />
            </>
          )}

          {mode === "blocked" && (
            <div className="flex flex-col items-center justify-center h-full bg-gray-950 text-gray-300 p-8 text-center">
              <div className="mb-3 text-gray-500 font-mono text-[10px] tracking-widest">
                EMBED BLOCKED
              </div>
              <p className="mb-1 text-gray-200">This site does not allow embedding.</p>
              <p className="mb-6 text-xs text-gray-500 font-mono break-all max-w-xl">{url}</p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                data-no-viewer="1"
                className="px-4 py-2 bg-amber-500/15 border border-amber-500/50 text-amber-200 rounded hover:bg-amber-500/25 transition-colors text-sm font-mono"
              >
                Open in new tab ↗
              </a>
            </div>
          )}
        </div>
      </div>
      <style jsx global>{`
        @keyframes link-viewer-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .link-viewer-fade {
          animation: link-viewer-fade-in 140ms ease-out;
        }
        .reader-content img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
}

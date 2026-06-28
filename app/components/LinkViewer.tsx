"use client";
import React, { useEffect, useRef, useState } from "react";

type Props = {
  url: string;
  onClose: () => void;
};

export default function LinkViewer({ url, onClose }: Props) {
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
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
    setBlocked(false);
    setLoading(true);
    const timeout = window.setTimeout(() => {
      setLoading((stillLoading) => {
        if (stillLoading) {
          setBlocked(true);
          window.open(url, "_blank", "noopener,noreferrer");
        }
        return stillLoading;
      });
    }, 6_000);
    return () => window.clearTimeout(timeout);
  }, [url]);

  function handleLoad() {
    setLoading(false);
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc && doc.location.href === "about:blank" && !doc.body?.childElementCount) {
        setBlocked(true);
      }
    } catch {
      // SecurityError on cross-origin access means the frame loaded fine.
    }
  }

  const displayUrl = url.length > 90 ? url.slice(0, 87) + "..." : url;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-stretch sm:items-center justify-center bg-black/75 backdrop-blur-sm link-viewer-fade"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="External link viewer"
    >
      <div className="relative flex flex-col bg-gray-950 border border-gray-700 shadow-2xl w-full h-full sm:rounded-lg sm:w-[85vw] sm:h-[85vh] sm:max-w-[1400px] overflow-hidden">
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

        <div className="relative flex-1 bg-gray-100">
          {blocked ? (
            <div className="flex flex-col items-center justify-center h-full bg-gray-950 text-gray-300 p-8 text-center">
              <div className="mb-3 text-gray-500 font-mono text-[10px] tracking-widest">EMBED BLOCKED</div>
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
          ) : (
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-950 text-gray-500 font-mono text-xs pointer-events-none">
                  loading {displayUrl}…
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={url}
                onLoad={handleLoad}
                className="w-full h-full border-0 bg-white"
                title="External link preview"
                referrerPolicy="no-referrer"
              />
            </>
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
      `}</style>
    </div>
  );
}

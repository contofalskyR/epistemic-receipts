"use client";
import { useState } from "react";
import { Link } from "lucide-react";

interface ShareButtonsProps {
  url: string;
  text: string;
  imageCardUrl?: string;
}

export function ShareButtons({ url, text, imageCardUrl }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const btnBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: "0.05em",
    padding: "3px 9px",
    borderRadius: 5,
    border: "1px solid #2a2a40",
    background: "transparent",
    color: "#6b6b84",
    cursor: "pointer",
    textDecoration: "none",
    transition: "color 0.15s, border-color 0.15s",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {/* X / Twitter */}
      <a
        href={tweetUrl}
        target="_blank"
        rel="noreferrer"
        style={btnBase}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#e9e9f2"; (e.currentTarget as HTMLElement).style.borderColor = "#4a4a60"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#6b6b84"; (e.currentTarget as HTMLElement).style.borderColor = "#2a2a40"; }}
        aria-label="Share on X"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.257 5.626zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Share
      </a>

      {/* LinkedIn */}
      <a
        href={linkedinUrl}
        target="_blank"
        rel="noreferrer"
        style={btnBase}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#e9e9f2"; (e.currentTarget as HTMLElement).style.borderColor = "#4a4a60"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#6b6b84"; (e.currentTarget as HTMLElement).style.borderColor = "#2a2a40"; }}
        aria-label="Share on LinkedIn"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        Share
      </a>

      {/* Copy link */}
      <button
        type="button"
        onClick={handleCopy}
        style={{
          ...btnBase,
          color: copied ? "#d4a853" : "#6b6b84",
          borderColor: copied ? "#d4a85355" : "#2a2a40",
        }}
        onMouseEnter={e => { if (!copied) { (e.currentTarget as HTMLElement).style.color = "#e9e9f2"; (e.currentTarget as HTMLElement).style.borderColor = "#4a4a60"; } }}
        onMouseLeave={e => { if (!copied) { (e.currentTarget as HTMLElement).style.color = "#6b6b84"; (e.currentTarget as HTMLElement).style.borderColor = "#2a2a40"; } }}
        aria-label="Copy link"
      >
        <Link size={11} aria-hidden />
        {copied ? "Copied!" : "Copy link"}
      </button>

      {/* Download card */}
      {imageCardUrl && (
        <a
          href={imageCardUrl}
          download
          style={btnBase}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#e9e9f2"; (e.currentTarget as HTMLElement).style.borderColor = "#4a4a60"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#6b6b84"; (e.currentTarget as HTMLElement).style.borderColor = "#2a2a40"; }}
          aria-label="Download image card"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Card
        </a>
      )}
    </div>
  );
}

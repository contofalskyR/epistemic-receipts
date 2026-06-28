"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useBookmarks } from "@/hooks/useBookmarks";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";

const C = {
  bg: "#0a0a0a",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#d4a853",
} as const;

type BookmarkedClaim = {
  id: string;
  text: string;
  currentStatus: string;
  epistemicAxis: string | null;
  claimType: string;
  verificationStatus: string | null;
  ingestedBy: string;
  createdAt: string;
  bookmarkedAt: string;
};

export default function BookmarksPage() {
  const { profileKey, copyKey, copied, restoreFromKey, toggle } = useBookmarks();
  const [claims, setClaims] = useState<BookmarkedClaim[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoreInput, setRestoreInput] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const fetchClaims = useCallback(async (key: string | null) => {
    if (!key) { setClaims([]); setLoading(false); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/bookmarks/claims?key=${encodeURIComponent(key)}`, { cache: "no-store" });
      if (!r.ok) { setClaims([]); }
      else {
        const data: { claims: BookmarkedClaim[] } = await r.json();
        setClaims(data.claims ?? []);
      }
    } catch { setClaims([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClaims(profileKey); }, [profileKey, fetchClaims]);

  async function handleRemove(claimId: string) {
    if (!claims) return;
    setClaims(claims.filter(c => c.id !== claimId));
    await toggle(claimId);
  }

  function handleRestore() {
    setRestoreError(null);
    const ok = restoreFromKey(restoreInput);
    if (!ok) { setRestoreError("Please paste a valid key (at least 8 characters)."); return; }
    setRestoreInput("");
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", marginTop: "-2rem", marginLeft: "-1.5rem", marginRight: "-1.5rem" }}>
      {/* Sub-nav */}
      <div style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(10,10,10,0.85)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.panelEdge}`,
        padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "0.5rem", height: "2.75rem",
      }}>
        <Link href="/" style={{ color: C.faint, fontSize: "0.78rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ fontSize: "1rem" }}>⬡</span> Epistemic Receipts
        </Link>
        <span style={{ color: C.panelEdge }}>/</span>
        <span style={{ color: C.mut, fontSize: "0.78rem" }}>Bookmarks</span>
      </div>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(160deg, #0f0f1e 0%, #0a0a0a 60%)",
        borderBottom: `1px solid ${C.panelEdge}`,
        padding: "3.5rem 1.5rem 3rem",
      }}>
        <div style={{ maxWidth: "48rem", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(212,168,83,0.12)", border: "1px solid rgba(212,168,83,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0,
            }}>
              🔖
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: C.brand, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.2rem" }}>
                Personal
              </div>
              <h1 style={{ color: C.ink, fontSize: "1.75rem", fontWeight: 700, margin: 0, lineHeight: 1.1 }}>
                Bookmarks
              </h1>
            </div>
          </div>
          <p style={{ color: C.mut, fontSize: "0.95rem", lineHeight: 1.6, margin: "0 0 1.5rem" }}>
            Save claims to revisit later. No account needed — your bookmarks live in your browser and are linked to a private key you control.
          </p>

          {/* Profile key card */}
          <div style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 12, padding: "1.25rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.85rem" }}>
              <span style={{ fontSize: "0.85rem" }}>🔑</span>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: C.brand, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Your profile key
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <code style={{
                fontSize: "0.75rem", color: "#fbbf24", background: "#0a0a0a",
                border: `1px solid ${C.panelEdge}`, borderRadius: 8,
                padding: "0.4rem 0.75rem", fontFamily: "monospace", wordBreak: "break-all", flex: 1,
              }}>
                {profileKey ?? "— will be generated when you bookmark a claim —"}
              </code>
              <button
                type="button"
                onClick={copyKey}
                disabled={!profileKey}
                style={{
                  fontSize: "0.78rem", padding: "0.4rem 0.9rem", borderRadius: 8,
                  background: copied ? "rgba(34,197,94,0.15)" : C.panelEdge,
                  border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : C.faint}`,
                  color: copied ? "#86efac" : C.mut,
                  cursor: profileKey ? "pointer" : "not-allowed", opacity: profileKey ? 1 : 0.4,
                  display: "flex", alignItems: "center", gap: "0.35rem", whiteSpace: "nowrap",
                }}
              >
                {copied ? "✓ Copied" : "Copy key"}
              </button>
            </div>
            <p style={{ fontSize: "0.72rem", color: C.faint, margin: 0, lineHeight: 1.5 }}>
              This key is your only way to recover your bookmarks on a new device or after clearing storage.
            </p>
          </div>

          {/* Restore card */}
          <div style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
              Restore from key
            </div>
            <p style={{ fontSize: "0.8rem", color: C.faint, margin: "0 0 0.75rem", lineHeight: 1.5 }}>
              Paste a key from another device to switch to that profile.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <input
                type="text"
                value={restoreInput}
                onChange={e => setRestoreInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRestore()}
                placeholder="paste profile key…"
                style={{
                  flex: 1, minWidth: "14rem",
                  background: "#0a0a0a", border: `1px solid ${C.panelEdge}`,
                  borderRadius: 8, padding: "0.45rem 0.85rem",
                  fontSize: "0.78rem", fontFamily: "monospace", color: C.ink,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={handleRestore}
                style={{
                  fontSize: "0.78rem", fontWeight: 600, padding: "0.45rem 1rem",
                  borderRadius: 8, cursor: "pointer",
                  background: "rgba(212,168,83,0.15)", border: `1px solid rgba(212,168,83,0.35)`,
                  color: C.brand,
                }}
              >
                Restore
              </button>
            </div>
            {restoreError && (
              <p style={{ fontSize: "0.75rem", color: "#f87171", marginTop: "0.5rem" }}>{restoreError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Claim list */}
      <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h2 style={{ color: C.mut, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            Saved claims
          </h2>
          {claims && claims.length > 0 && (
            <span style={{ fontSize: "0.75rem", color: C.faint, fontFamily: "monospace" }}>
              {claims.length} saved
            </span>
          )}
        </div>

        {loading && (
          <p style={{ fontSize: "0.82rem", color: C.faint, fontStyle: "italic" }}>Loading bookmarks…</p>
        )}

        {!loading && (!claims || claims.length === 0) && (
          <div style={{
            borderRadius: 12, border: `1px dashed ${C.panelEdge}`,
            padding: "3rem", textAlign: "center",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🔖</div>
            <p style={{ color: C.mut, fontSize: "0.9rem", margin: "0 0 0.4rem" }}>No bookmarks yet.</p>
            <p style={{ color: C.faint, fontSize: "0.8rem", margin: 0 }}>
              Click the bookmark icon on any claim to save it.
            </p>
          </div>
        )}

        {!loading && claims && claims.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {claims.map(c => (
              <div
                key={c.id}
                style={{
                  borderRadius: 10, border: `1px solid ${C.panelEdge}`,
                  background: C.panel, padding: "0.9rem 1rem",
                  display: "flex", flexDirection: "column", gap: "0.6rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
                  <Link
                    href={`/claims/${c.id}`}
                    style={{
                      color: C.ink, fontSize: "0.88rem", lineHeight: 1.4,
                      textDecoration: "none", flex: 1,
                      display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}
                  >
                    {c.text}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRemove(c.id)}
                    title="Remove bookmark"
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: C.brand, fontSize: "1rem", flexShrink: 0, padding: "0.1rem",
                    }}
                  >
                    🔖
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <EpistemicAxisBadge
                    axis={c.epistemicAxis}
                    className="px-1.5 py-0.5 rounded-full font-medium text-[10px]"
                  />
                  <span style={{
                    fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: 9999,
                    background: C.panelEdge, color: C.faint,
                  }}>
                    {c.claimType}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: C.faint, fontFamily: "monospace" }}>
                    {c.ingestedBy}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: C.faint, marginLeft: "auto" }}>
                    saved {new Date(c.bookmarkedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

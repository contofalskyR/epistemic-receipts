"use client";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "er_profile_key";
const BROADCAST_EVENT = "er_bookmarks_changed";

function readKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeKey(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* ignore */
  }
}

function generateKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateProfileKey(): string {
  let key = readKey();
  if (!key) {
    key = generateKey();
    writeKey(key);
  }
  return key;
}

export function useBookmarks() {
  const [profileKey, setProfileKey] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setProfileKey(readKey());
  }, []);

  const refresh = useCallback(async (key: string | null) => {
    if (!key) {
      setBookmarks(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/bookmarks?key=${encodeURIComponent(key)}`, { cache: "no-store" });
      if (!r.ok) {
        setBookmarks(new Set());
      } else {
        const data: { claimIds?: string[] } = await r.json();
        setBookmarks(new Set(data.claimIds ?? []));
      }
    } catch {
      setBookmarks(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(profileKey);
  }, [profileKey, refresh]);

  useEffect(() => {
    function onChange() {
      setProfileKey(readKey());
    }
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setProfileKey(readKey());
    }
    window.addEventListener(BROADCAST_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(BROADCAST_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const isBookmarked = useCallback(
    (claimId: string) => bookmarks.has(claimId),
    [bookmarks]
  );

  const toggle = useCallback(
    async (claimId: string) => {
      const key = profileKey ?? getOrCreateProfileKey();
      if (!profileKey) {
        setProfileKey(key);
      }
      const wasBookmarked = bookmarks.has(claimId);
      const next = new Set(bookmarks);
      if (wasBookmarked) next.delete(claimId);
      else next.add(claimId);
      setBookmarks(next);

      try {
        const method = wasBookmarked ? "DELETE" : "POST";
        const r = await fetch("/api/bookmarks", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, claimId }),
        });
        if (!r.ok) {
          setBookmarks(bookmarks);
        }
      } catch {
        setBookmarks(bookmarks);
      }
    },
    [profileKey, bookmarks]
  );

  const copyKey = useCallback(async () => {
    const key = profileKey ?? getOrCreateProfileKey();
    if (!profileKey) setProfileKey(key);
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [profileKey]);

  const restoreFromKey = useCallback(
    (newKey: string) => {
      const trimmed = newKey.trim();
      if (!trimmed || trimmed.length < 8) return false;
      writeKey(trimmed);
      setProfileKey(trimmed);
      window.dispatchEvent(new Event(BROADCAST_EVENT));
      return true;
    },
    []
  );

  return {
    profileKey,
    bookmarks,
    isBookmarked,
    toggle,
    copyKey,
    copied,
    restoreFromKey,
    loading,
  };
}

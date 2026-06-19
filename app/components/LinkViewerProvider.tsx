"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import LinkViewer from "./LinkViewer";

type Ctx = { openLink: (url: string) => void };

const LinkViewerContext = createContext<Ctx>({ openLink: () => {} });

export function useLinkViewer() {
  return useContext(LinkViewerContext);
}

export default function LinkViewerProvider({ children }: { children: React.ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);

  const openLink = useCallback((u: string) => setUrl(u), []);
  const closeLink = useCallback(() => setUrl(null), []);

  useEffect(() => {
    function isExternal(anchor: HTMLAnchorElement): string | null {
      const rawHref = anchor.getAttribute("href");
      if (!rawHref) return null;
      if (
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("javascript:")
      ) {
        return null;
      }
      try {
        const u = new URL(anchor.href, window.location.href);
        if (u.protocol !== "http:" && u.protocol !== "https:") return null;
        if (u.origin === window.location.origin) return null;
        return u.toString();
      } catch {
        return null;
      }
    }

    function handleClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== "function") return;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.hasAttribute("data-no-viewer")) return;
      if (anchor.getAttribute("download") !== null) return;
      const external = isExternal(anchor);
      if (!external) return;
      e.preventDefault();
      openLink(external);
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openLink]);

  return (
    <LinkViewerContext.Provider value={{ openLink }}>
      {children}
      {url && <LinkViewer url={url} onClose={closeLink} />}
    </LinkViewerContext.Provider>
  );
}

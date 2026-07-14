import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Embed layout — hides root layout chrome (Nav, footer, feedback button) for
 * /embed/* pages so the iframe widget is chrome-free.
 * CSS injection is safe because next.config.ts already requires 'unsafe-inline'
 * in script-src/style-src for Next.js RSC streaming.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        nav,
        footer,
        button[aria-label="Send feedback"] {
          display: none !important;
        }
        main {
          padding: 0 !important;
          min-height: 0 !important;
        }
      `}</style>
      {children}
    </>
  );
}

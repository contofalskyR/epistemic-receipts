import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Epistemic Receipts",
  description: "Privacy policy describing what data Epistemic Receipts collects and how it is used.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        {/* TODO(owner): remove this banner once counsel has reviewed */}
        <h1 className="text-2xl font-bold text-gray-100 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-xs">Effective date: July 1, 2026 · Last updated: September 30, 2026</p>
      </div>

      <div className="text-gray-400 text-sm space-y-6">
        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">1. What we collect</h2>

          <h3 className="text-sm font-semibold text-gray-300 mb-2">Feedback submissions</h3>
          <p className="mb-2">
            Feedback is stored with your message (max 300 chars), an optional email (max 254 chars), and an
            optional page context field. Each submission is forwarded to the site owner via Telegram.
            Your IP address is used in-memory for rate limiting (max 5/hour) but not stored in the database.
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Code refs: <code>prisma/schema.prisma:331</code> · <code>app/api/feedback/route.ts</code>
          </p>

          <h3 className="text-sm font-semibold text-gray-300 mb-2">Retired features</h3>
          <p className="mb-2 text-xs text-gray-500">
            Until September 2026 the site offered email topic alerts and browser-key bookmarks. Both were
            removed on 2026-09-30; the subscription and bookmark tables (which held one bookmark and no
            subscriptions) are dropped by the same change. Any browser key left in your{" "}
            <code>localStorage</code> under <code>er_profile_key</code> is never sent anywhere now and can be
            cleared from your browser settings.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">2. What we do NOT collect</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>No tracking cookies</li>
            <li>No third-party analytics</li>
            <li>No advertising networks</li>
            <li>No precise location data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">3. Data sharing</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-gray-300">Resend</strong> — email delivery for operational alerts to the site owner only (no visitor email is sent).</li>
            <li><strong className="text-gray-300">Vercel</strong> — hosting infrastructure; see vercel.com/legal/privacy-policy.</li>
            <li><strong className="text-gray-300">Telegram</strong> — feedback forwarded to the site owner&rsquo;s private account.</li>
          </ul>
          <p className="mt-2">We do not sell personal data or share it with advertisers.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">4. Your rights</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-gray-300">Request deletion</strong> of feedback records by contacting us.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">5. Retention</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Feedback: indefinitely (contact us to request deletion).</li>
            <li>In-memory rate-limit data: ephemeral.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">6. Security</h2>
          <p>
            Database connections use TLS. HSTS and CSP headers
            are enforced. Admin authentication uses timing-safe comparison.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">7. Contact</h2>
          <p>
            Privacy questions:{" "}
            <a href="mailto:robert.contofalsky@rutgers.edu" className="text-blue-400 underline hover:text-blue-300">
              robert.contofalsky@rutgers.edu
            </a>
          </p>
        </section>
      </div>

      <div className="border-t border-gray-800 pt-6 mt-8 text-xs text-gray-600 space-y-1">
        <p>
          <a href="/license" className="underline hover:text-gray-400">License</a>
          {" · "}
          <a href="/terms" className="underline hover:text-gray-400">Terms of Service</a>
        </p>
      </div>
    </div>
  );
}

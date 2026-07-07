> **DRAFT — not yet reviewed by counsel. Do not publish or rely on this document until a licensed attorney has approved it.**

# Epistemic Receipts — Privacy Policy

*Effective date: [DATE — to be set on public launch]*
*Last updated: July 2026 (draft)*

---

## 1. Who we are

Epistemic Receipts ("we", "us") is operated by [ENTITY NAME — to be formed]. Contact: **privacy@epistemic-receipts.vercel.app** *(placeholder — update before publication)*

---

## 2. What data we collect and why

This section describes **actual current practice** based on the code. Code file and line references are included for auditability; they were current as of the date of this draft.

### 2.1 Topic-alert subscriptions

When you subscribe to email alerts for a topic, we collect and store:

| Field | What it is | Where stored |
|---|---|---|
| Email address | Your email | `TopicSubscription.email` (plaintext) |
| Topic keyword | The topic tag you subscribed to | `TopicSubscription.topicKeyword` |
| Topic label | The human-readable topic name | `TopicSubscription.topicLabel` |
| Unsubscribe token | A unique random token (cuid) used to unsubscribe | `TopicSubscription.unsubscribeToken` |
| Confirmed | Whether a confirmation email was sent | `TopicSubscription.confirmed` |
| Timestamps | When you subscribed and when an alert was last sent | `TopicSubscription.createdAt`, `.lastAlertAt` |

*Code refs:* `prisma/schema.prisma:659–671` (schema); `app/api/subscribe/topic/route.ts` (subscription handler); `app/api/unsubscribe/route.ts` (unsubscribe handler).

**Why:** To send you weekly email notifications when new claims matching your topic are added.

**Email processor:** Confirmation emails are sent via **Resend** (resend.com), which acts as our email service provider. Your email address is passed to Resend to deliver confirmation messages. See Resend's privacy policy at resend.com/legal/privacy-policy.

*Code ref:* `app/api/subscribe/topic/route.ts` (Resend send call, uses `RESEND_API_KEY` environment variable).

**Retention:** We retain your subscription record until you unsubscribe. Unsubscribing deletes the record from our database (`app/api/unsubscribe/route.ts`).

### 2.2 Feedback submissions

When you submit feedback (via the feedback button on any page), we collect:

| Field | What it is | Where stored |
|---|---|---|
| Feedback body | Your message text (max 300 characters) | `Feedback.body` |
| Email (optional) | Your email if you choose to provide it (max 254 chars) | `Feedback.email` |
| Page context (optional) | The URL or page name you were on | `Feedback.pageContext` |
| Timestamp | When you submitted | `Feedback.submittedAt` |

*Code refs:* `prisma/schema.prisma:331–337` (schema); `app/api/feedback/route.ts:55–78` (submission handler, field caps).

**Telegram notification:** Each feedback submission is also sent as a private message to the site owner via Telegram. This message includes the body, optional email, and page context. The Telegram chat ID is hardcoded in `app/api/feedback/route.ts:9` and belongs to the site owner only.

*Code ref:* `app/api/feedback/route.ts:7–17` (`notifyTelegram` function).

**IP-based rate limiting:** We use your IP address to enforce a rate limit of 5 feedback submissions per IP per hour. IP addresses are held in-memory only (not written to the database) and are discarded when the server process resets.

*Code ref:* `app/api/feedback/route.ts:33–41` (in-memory `rateLimitMap`).

**Why:** To receive and respond to corrections, bug reports, and suggestions.

**Retention:** Feedback records are retained indefinitely unless deleted by the site owner.

### 2.3 Bookmarks (profile key)

The bookmarking feature does not require an account or email. Instead:

1. When you first save a bookmark, your browser generates a random UUID using `crypto.randomUUID()`.
2. This UUID is stored in your browser's `localStorage` under the key `er_profile_key`.
3. When the UUID is sent to our API, we hash it with SHA-256 before storing it. **We never store the raw UUID.**
4. Your bookmarks are stored as a list of claim IDs associated with the SHA-256 hash of your profile key.

| Field | What it is | Where stored |
|---|---|---|
| Hashed profile key | SHA-256 hash of your browser-generated UUID | `Profile.key` |
| Bookmark list | Claim IDs you have bookmarked | `Bookmark.claimId` (linked to `Profile`) |

*Code refs:* `hooks/useBookmarks.ts:4–29` (key generation and localStorage storage); `app/api/bookmarks/route.ts:1–13` (SHA-256 hashing, `hashKey` function); `prisma/schema.prisma:599–617` (Profile and Bookmark schemas).

**Privacy implication:** Because we only store the hash, we cannot identify who a profile belongs to. If you clear your `localStorage`, your bookmarks become inaccessible (but are not deleted from the database — see below).

**Retention:** Hashed profile records and bookmark lists persist indefinitely. There is currently no UI to delete your bookmarks. To request deletion, contact us.

### 2.4 Server logs and hosting infrastructure

The site is hosted on **Vercel** (vercel.com). Vercel may collect server logs including IP addresses, request paths, and HTTP headers as part of normal infrastructure operation. See Vercel's privacy policy at vercel.com/legal/privacy-policy.

We do not control or separately retain Vercel's infrastructure logs.

### 2.5 What we do NOT collect

- We do not use tracking cookies.
- We do not use third-party analytics (e.g., Google Analytics).
- We do not use advertising networks.
- We do not store passwords (the admin authentication mechanism uses tokens, not passwords in the conventional sense).
- We do not collect precise location data.

---

## 3. Legal basis for processing (GDPR note)

*[If and when the site is offered to EU users, counsel should confirm the appropriate legal basis for each processing activity listed above. Likely bases: performance of a contract / legitimate interest for feedback; consent for topic subscriptions.]*

---

## 4. Data sharing

We share data with:

- **Resend** (email delivery) — email addresses for confirmed subscription emails only.
- **Vercel** (hosting infrastructure) — all request data as part of normal hosting.
- **Telegram** (site owner notification) — feedback message content forwarded to the site owner's private Telegram account.

We do not sell personal data. We do not share personal data with advertisers or data brokers.

---

## 5. Your rights

You may:

- **Unsubscribe** from topic alerts at any time using the unsubscribe link in any alert email, or by visiting `/api/unsubscribe?token=<your-token>`.
- **Request deletion** of your feedback record or bookmark profile by contacting us at the address in Section 1.
- **Access** the data we hold about you by contacting us.

*[Counsel should confirm whether GDPR, CCPA, or other privacy law rights apply and expand this section accordingly.]*

---

## 6. Data security

- Database connections use TLS.
- Bookmark profile keys are stored as SHA-256 hashes, not in plaintext.
- Admin authentication tokens are compared using timing-safe comparison to prevent timing attacks.
- The site enforces Content-Security-Policy and HTTP Strict Transport Security headers.

*Code ref:* `middleware.ts`, `next.config.ts` (security headers), `lib/adminAuth.ts` (timing-safe comparison).

---

## 7. Data retention

| Data type | Retention |
|---|---|
| Topic subscription | Until you unsubscribe |
| Feedback | Indefinitely (no auto-deletion currently) |
| Hashed profile key and bookmarks | Indefinitely (contact us to request deletion) |
| Vercel server logs | Per Vercel's policy |
| In-memory IP rate-limit data | Until server process resets (ephemeral) |

---

## 8. Children

The site is not directed at children under 13 (or under 16 in the EU). We do not knowingly collect data from children.

---

## 9. Changes

We may update this policy. The "last updated" date at the top will reflect changes. We will try to notify subscribed users of material changes via email.

---

## 10. Contact

Privacy questions or deletion requests: **privacy@epistemic-receipts.vercel.app** *(placeholder — update before publication)*

---

*Draft Version 1.0 — July 2026 · Epistemic Receipts*

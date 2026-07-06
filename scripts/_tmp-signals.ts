import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const [fb, subs, watched, profiles, bms] = await Promise.all([
    p.feedback.findMany({ orderBy: { submittedAt: "desc" } }),
    p.topicSubscription.findMany({ orderBy: { createdAt: "desc" } }),
    p.watchedTopic.findMany({ orderBy: { createdAt: "desc" } }),
    p.profile.count(),
    p.bookmark.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  console.log("=== FEEDBACK:", fb.length);
  for (const f of fb) console.log(`[${f.submittedAt.toISOString().slice(0,10)}] page=${f.pageContext ?? "-"} email=${f.email ?? "-"} :: ${f.body.slice(0,200).replace(/\n/g," ")}`);
  console.log("\n=== TOPIC SUBSCRIPTIONS:", subs.length);
  for (const s of subs) console.log(`[${s.createdAt.toISOString().slice(0,10)}] ${s.email} -> "${s.topicLabel}" confirmed=${s.confirmed} lastAlert=${s.lastAlertAt?.toISOString().slice(0,10) ?? "-"}`);
  console.log("\n=== WATCHED TOPICS:", watched.length);
  for (const w of watched) console.log(`[${w.createdAt.toISOString().slice(0,10)}] ${w.label} (${w.keyword})`);
  console.log("\n=== PROFILES (bookmark users):", profiles, "| BOOKMARKS (last 50):", bms.length);
  const byProfile: Record<string, number> = {};
  for (const b of bms) byProfile[b.profileId] = (byProfile[b.profileId] ?? 0) + 1;
  console.log("bookmarks per profile:", JSON.stringify(byProfile));
  console.log("bookmark dates:", bms.map(b => b.createdAt.toISOString().slice(0,10)).join(", "));
}
main().finally(() => p.$disconnect());

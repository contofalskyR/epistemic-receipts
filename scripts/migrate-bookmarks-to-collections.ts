/**
 * Migrate existing Bookmark rows into a default "Bookmarks" Collection per user.
 *
 * Idempotent: running twice is a no-op.
 * Anonymous profiles (userId = null) keep working — they have no User to own
 * a Collection, so their bookmarks remain in the Bookmark table untouched.
 *
 * Run: npx tsx scripts/migrate-bookmarks-to-collections.ts
 */

import { prisma } from "@/lib/prisma";

async function run() {
  // Profiles with a linked user that have bookmarks
  const profilesWithUser = await prisma.profile.findMany({
    where: { userId: { not: null }, bookmarks: { some: {} } },
    select: {
      id: true,
      userId: true,
      bookmarks: {
        select: { claimId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  console.log(`Found ${profilesWithUser.length} profiles with user + bookmarks`);

  let created = 0;
  let skipped = 0;
  let itemsCreated = 0;

  for (const profile of profilesWithUser) {
    const userId = profile.userId!;

    // Check if a "Bookmarks" collection already exists for this user
    const existing = await prisma.collection.findFirst({
      where: { ownerId: userId, name: "Bookmarks" },
      select: { id: true, items: { select: { claimId: true } } },
    });

    let collectionId: string;
    const existingClaimIds = new Set<string>();

    if (existing) {
      collectionId = existing.id;
      for (const item of existing.items) existingClaimIds.add(item.claimId);
      skipped++;
    } else {
      const col = await prisma.collection.create({
        data: { ownerId: userId, name: "Bookmarks", description: "Migrated from bookmarks" },
        select: { id: true },
      });
      collectionId = col.id;
      created++;
    }

    // Add bookmarks not yet in the collection
    let position = existingClaimIds.size;
    for (const bm of profile.bookmarks) {
      if (existingClaimIds.has(bm.claimId)) continue;

      // Verify the claim still exists (may have been deleted)
      const claimExists = await prisma.claim.findUnique({
        where: { id: bm.claimId },
        select: { id: true },
      });
      if (!claimExists) continue;

      await prisma.collectionItem.upsert({
        where: { collectionId_claimId: { collectionId, claimId: bm.claimId } },
        create: { collectionId, claimId: bm.claimId, position, addedAt: bm.createdAt },
        update: {},
      });
      existingClaimIds.add(bm.claimId);
      position++;
      itemsCreated++;
    }
  }

  console.log(
    `Done. Collections created: ${created}, already existed: ${skipped}, items added: ${itemsCreated}`,
  );
  console.log(`Profiles without userId (anonymous): untouched, bookmarks remain.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

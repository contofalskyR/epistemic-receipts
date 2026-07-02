import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const claim = await p.claim.findUnique({
    where: { externalId: "trajectory:compelled-abortion-notice-crisis-pregnancy-centers-nifla-2018" },
    include: { statusHistory: true },
  });

  if (!claim) {
    console.error("Claim not found");
    process.exit(1);
  }

  const transition = claim.statusHistory.find(
    (h) => h.fromAxis === "CONTESTED" && h.toAxis === "SETTLED"
  );

  if (!transition) {
    console.error("CONTESTED→SETTLED transition not found");
    process.exit(1);
  }

  console.log("Current reason:", transition.reason?.slice(0, 80));

  const updated = await p.claimStatusHistory.update({
    where: { id: transition.id },
    data: {
      reason: transition.reason?.replace("A 6–3 Supreme Court per Justice Thomas", "A 5–4 Supreme Court per Justice Thomas"),
    },
  });

  console.log("Fixed reason:", updated.reason?.slice(0, 80));
  console.log("Done.");
}

main().finally(() => p.$disconnect());

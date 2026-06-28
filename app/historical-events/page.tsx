import { prisma } from "@/lib/prisma";
import HistoricalEventsClient from "./HistoricalEventsClient";

export const revalidate = 300;

export const metadata = { title: "Historical Events — Epistemic Receipts" };

export default async function HistoricalEventsPage() {
  const raw = await prisma.historicalEvent.findMany({
    orderBy: [{ startDate: "asc" }],
    include: {
      _count: { select: { claims: true, votes: true, polities: true } },
    },
  });

  const events = raw.map((e) => ({
    id: e.id,
    slug: e.slug,
    name: e.name,
    category: e.category ?? null,
    startDate: e.startDate?.toISOString() ?? null,
    endDate: e.endDate?.toISOString() ?? null,
    description: e.description ?? null,
    voteCount: e._count.votes,
    claimCount: e._count.claims,
    polityCount: e._count.polities,
  }));

  return <HistoricalEventsClient events={events} />;
}

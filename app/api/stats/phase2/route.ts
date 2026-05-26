import { NextResponse } from "next/server";
import {
  getTopTopicsByLegislature,
  getPassRateByTopic,
} from "@/lib/stats-queries";

export const revalidate = 300;

const LEGISLATURE_LABELS: Record<string, string> = {
  uk_legislation_v1: "UK Parliament",
  congress_v1: "US Congress",
  canada_bills_v1: "Canada Parliament",
  eu_parliament_v1: "EU Parliament",
};

export async function GET() {
  const [rawTopicsByLeg, rawPassRates] = await Promise.all([
    getTopTopicsByLegislature(),
    getPassRateByTopic(),
  ]);

  const topicsByLegislature = rawTopicsByLeg.map((l) => ({
    legislature: l.legislature,
    label: LEGISLATURE_LABELS[l.legislature] ?? l.legislature,
    // top 5 per legislature
    topics: l.topics.slice(0, 5),
  }));

  // Cross-country matrix: { topic, legislatureCounts: { [legislature]: count } }
  const allTopics = Array.from(
    new Set(rawTopicsByLeg.flatMap((l) => l.topics.map((t) => t.topic)))
  );
  const crossCountry = allTopics.map((topic) => {
    const legislatureCounts: Record<string, number> = {};
    for (const l of rawTopicsByLeg) {
      const entry = l.topics.find((t) => t.topic === topic);
      legislatureCounts[LEGISLATURE_LABELS[l.legislature] ?? l.legislature] =
        entry?.count ?? 0;
    }
    return { topic, legislatureCounts };
  });

  return NextResponse.json({
    topicsByLegislature,
    passRateByTopic: rawPassRates,
    crossCountry,
  });
}

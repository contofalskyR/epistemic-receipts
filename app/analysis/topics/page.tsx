export const revalidate = 3600;

import { getTopicTrends } from "@/lib/topic-trends";
import TopicTrendsClient from "./TopicTrendsClient";

export default async function TopicTrendsPage() {
  const data = await getTopicTrends();
  return <TopicTrendsClient data={data} />;
}

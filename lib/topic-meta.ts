import type { Metadata } from "next";
import { socialMetadata } from "@/lib/og";

// Per-topic metadata for /topics/[slug] (phase 6b). Pure, so it is unit-tested.

export type TopicMeta = { name: string; description: string | null; domain: string };

const domainLabel = (d: string) => d.replace(/_/g, " ");

export function buildTopicMetadata(slug: string, topic: TopicMeta | null): Metadata {
  if (!topic) return { title: "Topic not found — Epistemic Receipts", robots: { index: false } };
  const title = `${topic.name} — Topics — Epistemic Receipts`;
  const description =
    topic.description?.trim() ||
    `Sourced claims about ${topic.name} (${domainLabel(topic.domain)}), each with its epistemic status and the dated receipts behind it.`;
  const url = `/topics/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    ...socialMetadata({ title, description, url }),
  };
}

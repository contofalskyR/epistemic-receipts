import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { buildTopicMetadata } from "@/lib/topic-meta";
import { pageParam } from "@/lib/route-param";
import TopicSlugClient from "./TopicSlugClient";

// Server shell for the client topic view: per-topic metadata and a real 404
// for unknown slugs (the client view alone answered 200 "Topic not found.").
// On-demand ISR; the list itself is still fetched by the client.
export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

const getTopicMeta = cache((slug: string) =>
  prisma.topic.findUnique({ where: { slug }, select: { name: true, description: true, domain: true } }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildTopicMetadata(slug, await getTopicMeta(slug));
}

export default async function TopicSlugPage({ params }: Props) {
  const slug = pageParam((await params).slug);
  if (!(await getTopicMeta(slug))) notFound();
  return <TopicSlugClient />;
}

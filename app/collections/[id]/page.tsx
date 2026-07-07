import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import CollectionDetailClient from "./CollectionDetailClient";

export const metadata: Metadata = {
  title: "Collection — Epistemic Receipts",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function CollectionDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/collections");
  }
  const { id } = await params;
  return <CollectionDetailClient id={id} />;
}

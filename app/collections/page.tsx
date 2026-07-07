import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import CollectionsClient from "./CollectionsClient";

export const metadata: Metadata = {
  title: "My Collections — Epistemic Receipts",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/collections");
  }
  return <CollectionsClient />;
}

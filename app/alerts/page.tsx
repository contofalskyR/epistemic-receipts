import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AlertsClient from "./AlertsClient";

export const metadata: Metadata = {
  title: "My Alerts — Epistemic Receipts",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/alerts");
  }
  return <AlertsClient />;
}

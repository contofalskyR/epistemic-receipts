import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import AlertsClient from "./AlertsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Alerts — Epistemic Receipts",
};

export default async function AlertsPage() {
  const profile = await getSessionProfile();
  if (!profile || !profile.emailVerifiedAt) {
    redirect("/alerts/signup");
  }
  return <AlertsClient initialEmail={profile.email!} />;
}

import { redirect } from "next/navigation";


export const metadata = {
  title: 'Timeline — Epistemic Receipts',
  description:
    'The claim graph in time — dated claims and status transitions across the corpus.',
};

export default function TimelinePage() {
  redirect("/settling-curve");
}

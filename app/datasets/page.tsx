import { redirect } from "next/navigation";


export const metadata = {
  title: 'Datasets — Epistemic Receipts',
  description:
    'The datasets feeding the claim graph, with provenance and coverage notes.',
};

// /datasets merged into /sources — which now has full methodology + audit panels.
export default function DatasetsPage() {
  redirect("/sources");
}

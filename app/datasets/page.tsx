import { redirect } from "next/navigation";

// /datasets merged into /sources — which now has full methodology + audit panels.
export default function DatasetsPage() {
  redirect("/sources");
}

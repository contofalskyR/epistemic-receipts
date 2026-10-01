import { LoadingState } from "@/components/DataState";

// Root loading state: shown while a dynamically rendered page (search,
// opinions, settling curve, split ledger, a topic) streams in on navigation.
export default function RootLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <LoadingState label="Loading…" lines={5} />
    </div>
  );
}

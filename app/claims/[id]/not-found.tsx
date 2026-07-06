import Link from "next/link";

// Rendered when getClaimDetail(id) returns null — mirrors the old client
// page's inline "Claim not found." view (Next serves it with a 404 status).
export default function ClaimNotFound() {
  return (
    <div className="space-y-4">
      <Link href="/" className="text-xs text-gray-500 hover:text-white">← back</Link>
      <p className="text-gray-500">Claim not found.</p>
    </div>
  );
}

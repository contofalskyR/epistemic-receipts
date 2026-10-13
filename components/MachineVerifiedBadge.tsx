import { isMachineVerified, MACHINE_VERIFIED_LABEL, MACHINE_VERIFIED_TITLE } from "@/lib/verification";

/** "machine-verified", with its one-line explanation on hover, when automated
 *  checks added a link and no person has reviewed it. Server- and client-safe. */
export function MachineVerifiedBadge({ link }: { link: { autoApproved: boolean; humanReviewed: boolean } }) {
  if (!isMachineVerified(link)) return null;
  return (
    <span
      title={MACHINE_VERIFIED_TITLE}
      className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-500 whitespace-nowrap cursor-help"
    >
      {MACHINE_VERIFIED_LABEL}
    </span>
  );
}

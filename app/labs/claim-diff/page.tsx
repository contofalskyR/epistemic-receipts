import type { Metadata } from "next";
import ClaimDiffLab from "./ClaimDiffLab";

export const metadata: Metadata = {
  title: "Labs — Claim Inheritance — Epistemic Receipts",
  description:
    "See which factual claims a trajectory's evidence carried forward, changed, dropped, or added between adjacent sources.",
};

export default function ClaimDiffLabPage() {
  return <ClaimDiffLab />;
}

import type { Metadata } from "next";
import SettlingCurve from "./SettlingCurve";
import SettlingCurveNav from "./SettlingCurveNav";

export const metadata: Metadata = {
  title: "Settling Curve — Epistemic Receipts",
  description:
    "Trace how scientific confidence in a claim builds — or unravels — across expert literature, institutions, courts, and public consensus.",
};

export default function SettlingCurvePage() {
  return (
    <>
      <SettlingCurveNav active="individual" />
      <SettlingCurve />
    </>
  );
}

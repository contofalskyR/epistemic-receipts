import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

const METHOD_TERMS: Record<string, string[]> = {
  "p-value":             ["p-value", "p < 0.05", "statistical significance", "null hypothesis"],
  "confidence-interval": ["confidence interval", "margin of error", "95% CI"],
  "effect-size":         ["effect size", "Cohen's d", "eta squared", "standardized mean"],
  "correlation":         ["spurious correlation", "correlation coefficient", "confounding variable"],
  "odds-ratio":          ["odds ratio", "relative risk", "risk ratio"],
  "regression":          ["regression analysis", "linear regression", "logistic regression"],
  "meta-analysis":       ["meta-analysis", "systematic review", "forest plot"],
  "power":               ["statistical power", "underpowered", "sample size calculation"],
  "bayesian":            ["bayesian", "posterior probability", "prior probability", "Bayes factor"],
  "multiple-comparisons":["multiple comparisons", "Bonferroni", "false discovery rate", "GWAS"],
};

type ClaimHit = {
  id: string;
  text: string;
  verificationStatus: string | null;
  currentStatus: string;
};

async function findClaims(terms: string[], limit = 3): Promise<ClaimHit[]> {
  const rows = await prisma.claim.findMany({
    where: {
      deleted: false,
      OR: terms.map(t => ({ text: { contains: t, mode: "insensitive" as const } })),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, text: true, verificationStatus: true, currentStatus: true },
  });
  return rows.map(r => ({
    id: r.id,
    text: r.text,
    verificationStatus: r.verificationStatus,
    currentStatus: r.currentStatus,
  }));
}

export async function GET() {
  const entries = await Promise.all(
    Object.entries(METHOD_TERMS).map(async ([method, terms]) => {
      const claims = await findClaims(terms);
      return [method, claims] as [string, ClaimHit[]];
    }),
  );
  return NextResponse.json(Object.fromEntries(entries));
}

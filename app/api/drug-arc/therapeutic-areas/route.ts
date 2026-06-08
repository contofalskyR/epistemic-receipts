import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

// Keyword buckets for drugsatfda_v1 claim text (case-insensitive)
const AREA_KEYWORDS: { key: string; label: string; keywords: string[] }[] = [
  {
    key: "oncology",
    label: "Oncology",
    keywords: ["cancer", "tumor", "carcinoma", "lymphoma", "leukemia", "melanoma", "myeloma", "sarcoma", "oncol", "neoplasm"],
  },
  {
    key: "cardiology",
    label: "Cardiology",
    keywords: ["cardiovascular", "cardiac", "heart failure", "hypertension", "coronary", "arrhythmia", "atrial fibrillation", "thrombosis", "anticoagul"],
  },
  {
    key: "metabolic",
    label: "Metabolic / Endocrine",
    keywords: ["diabetes", "insulin", "obesity", "thyroid", "metabolic", "hyperlipidemia", "cholesterol", "glucose", "GLP-1", "semaglutide"],
  },
  {
    key: "infectious",
    label: "Infectious Disease",
    keywords: ["infection", "bacterial", "viral", "HIV", "antibiotic", "antiviral", "hepatitis", "pneumonia", "tuberculosis", "fungal"],
  },
  {
    key: "neurology",
    label: "Neurology / CNS",
    keywords: ["neurolog", "epilepsy", "seizure", "Alzheimer", "Parkinson", "schizophrenia", "depression", "anxiety", "bipolar", "migraine", "multiple sclerosis"],
  },
  {
    key: "immunology",
    label: "Immunology / Autoimmune",
    keywords: ["autoimmune", "rheumatoid", "lupus", "inflammatory", "immunol", "psoriatic arthritis", "Crohn", "colitis", "monoclonal antibody"],
  },
  {
    key: "gastroenterology",
    label: "Gastroenterology",
    keywords: ["gastro", "hepatic", "liver", "bowel", "colon", "esophag", "irritable bowel", "ulcer", "Crohn"],
  },
  {
    key: "respiratory",
    label: "Respiratory",
    keywords: ["pulmonary", "lung", "asthma", "COPD", "respiratory", "bronchial", "cystic fibrosis"],
  },
  {
    key: "dermatology",
    label: "Dermatology",
    keywords: ["dermatitis", "psoriasis", "eczema", "skin", "acne", "rosacea", "alopecia"],
  },
  {
    key: "hematology",
    label: "Hematology",
    keywords: ["anemia", "hemophilia", "platelet", "hematolog", "sickle cell", "blood disorder", "clotting"],
  },
];

export async function GET() {
  // Fetch all drugsatfda_v1 claim texts (just the text column, batched)
  const claims = await prisma.claim.findMany({
    where: {
      ingestedBy: "drugsatfda_v1",
      deleted: false,
      verificationStatus: { not: "DEPRECATED" },
    },
    select: { text: true },
  });

  const total = claims.length;

  // Count per area (a claim can match multiple areas)
  const counts: Record<string, number> = {};
  for (const area of AREA_KEYWORDS) {
    counts[area.key] = 0;
  }
  let uncategorized = 0;

  for (const c of claims) {
    const lower = c.text.toLowerCase();
    let matched = false;
    for (const area of AREA_KEYWORDS) {
      if (area.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
        counts[area.key]++;
        matched = true;
      }
    }
    if (!matched) uncategorized++;
  }

  const areas = AREA_KEYWORDS.map((area) => ({
    key: area.key,
    label: area.label,
    count: counts[area.key],
  })).sort((a, b) => b.count - a.count);

  return NextResponse.json({
    total,
    uncategorized,
    areas,
  });
}

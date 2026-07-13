// Pipelines that ingest claims in a language other than English.
// Used to exclude or label non-English claims on English-language pages.
// Guardrail: never overwrite or alter source-language text — only label or exclude.

export const NON_ENGLISH_PIPELINES: ReadonlySet<string> = new Set([
  "riksdag_v1",       // Swedish
  "bundestag_v1",     // German
  "jacar_v1",         // Japanese
  "japan_legislation_v1", // Japanese
  "stasi_v1",         // German
  "portugal_legislation_v1", // Portuguese
  "poland_legislation_v1",   // Polish
  "brunei_legislation_v1",   // Malay
]);

export const PIPELINE_LANGUAGE: Record<string, string> = {
  riksdag_v1: "Swedish",
  bundestag_v1: "German",
  jacar_v1: "Japanese",
  japan_legislation_v1: "Japanese",
  stasi_v1: "German",
  portugal_legislation_v1: "Portuguese",
  poland_legislation_v1: "Polish",
  brunei_legislation_v1: "Malay",
};

export function isNonEnglish(ingestedBy: string | null | undefined): boolean {
  if (!ingestedBy) return false;
  return NON_ENGLISH_PIPELINES.has(ingestedBy);
}

export function pipelineLanguage(ingestedBy: string | null | undefined): string | null {
  if (!ingestedBy) return null;
  return PIPELINE_LANGUAGE[ingestedBy] ?? null;
}

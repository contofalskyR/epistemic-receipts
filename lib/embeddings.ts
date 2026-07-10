/**
 * Embedding provider interface wrapping text-embedding-3-small via @ai-sdk/openai.
 *
 * Single provider — swap by changing MODEL_ID and DIMS if we ever migrate.
 * Spend guard: MAX_TOKENS_PER_RUN env var enforced before each batch call.
 * Estimated cost: ~$0.02 / 1M tokens (text-embedding-3-small as of 2026).
 *
 * The legacy MiniLM (384-dim) embedText/embedTexts exports are preserved below
 * for TrajectorySearchDoc backfill compatibility; they are NOT used by the new
 * ClaimEmbedding pipeline.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import crypto from "node:crypto";

export const MODEL_ID = "text-embedding-3-small";
export const DIMS = 1536;

// ── Spend guard ───────────────────────────────────────────────────────────────
// Estimated token cost per embed call. text-embedding-3-small: 1 token ≈ 4 chars.
// This is an approximation — exact billing is from the API response.

let tokensSpentThisRun = 0;

function maxTokensPerRun(): number {
  const raw = process.env.EMBEDDING_MAX_TOKENS_PER_RUN;
  if (!raw) return Infinity;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Infinity;
}

export function getTokensSpent(): number {
  return tokensSpentThisRun;
}

export function resetTokensSpent(): void {
  tokensSpentThisRun = 0;
}

function checkSpendGuard(estimatedTokens: number): void {
  const max = maxTokensPerRun();
  if (max === Infinity) return;
  if (tokensSpentThisRun + estimatedTokens > max) {
    throw new Error(
      `Embedding spend guard triggered: would exceed ${max} tokens/run ` +
      `(already spent ${tokensSpentThisRun}, want ${estimatedTokens}). ` +
      `Raise EMBEDDING_MAX_TOKENS_PER_RUN or split across multiple runs.`
    );
  }
}

// ── Content hash ──────────────────────────────────────────────────────────────
// Deterministic text → re-embed only when content changes.

export function hashContent(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

// ── Embed text composition ────────────────────────────────────────────────────
// claim text + top-3 topic names + pipeline display name → one string.

export function buildEmbedText(claimText: string, topics: string[], pipeline: string): string {
  const topicPart = topics.slice(0, 3).join(", ");
  const parts = [claimText.trim()];
  if (topicPart) parts.push(`Topics: ${topicPart}`);
  if (pipeline && pipeline !== "manual") parts.push(`Source: ${pipeline}`);
  return parts.join(" | ");
}

// ── Provider ──────────────────────────────────────────────────────────────────

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Set it in .env.local (dev) or Vercel env (prod). " +
      "Required for text-embedding-3-small embeddings."
    );
  }
  return createOpenAI({ apiKey });
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Embed a single text string using text-embedding-3-small.
 * Returns a 1536-dim float array.
 */
export async function embedText3Small(text: string): Promise<number[]> {
  const estimatedTokens = Math.ceil(text.length / 4);
  checkSpendGuard(estimatedTokens);

  const openai = getOpenAI();
  const { embedding, usage } = await embed({
    model: openai.embedding(MODEL_ID),
    value: text,
  });

  tokensSpentThisRun += usage?.tokens ?? estimatedTokens;
  return embedding;
}

/**
 * Embed multiple texts in one batch call using text-embedding-3-small.
 * Returns an array of 1536-dim float arrays.
 *
 * Max batch size for text-embedding-3-small: 2048 inputs per request.
 */
export async function embedMany3Small(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const estimatedTokens = texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);
  checkSpendGuard(estimatedTokens);

  const openai = getOpenAI();
  const { embeddings, usage } = await embedMany({
    model: openai.embedding(MODEL_ID),
    values: texts,
  });

  tokensSpentThisRun += usage?.tokens ?? estimatedTokens;
  return embeddings;
}

// ── Legacy MiniLM interface removed (2026-07) ────────────────────────────────
// The 384-dim MiniLM embedder (embedText/embedTexts) was only used by the
// orphaned /api/search/semantic route, which has been deleted. Its top-level
// `import "@xenova/transformers"` pulled onnxruntime-web → protobufjs (a
// critical-severity chain) into the SERVER bundle. Removing it drops that
// dependency from anything that runs at request time.
//
// The maintenance scripts that still populate TrajectorySearchDoc
// (scripts/populate-trajectory-embeddings.ts) import @xenova/transformers
// directly via their own require(), so they are unaffected. If a MiniLM
// runtime path is ever needed again, add it to a script-only module — never
// import @xenova/transformers from a file reachable by an API route.

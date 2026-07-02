/**
 * Local embedding utility using all-MiniLM-L6-v2 via transformers.js.
 * Produces 384-dimensional vectors — no API key needed.
 *
 * Singleton pattern: the model loads once per Vercel function instance
 * (Fluid Compute reuses instances, so subsequent calls are fast).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { pipeline } from "@xenova/transformers";

let _pipe: any = null;

async function getPipeline(): Promise<any> {
  if (!_pipe) {
    _pipe = await (pipeline as any)(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );
  }
  return _pipe;
}

/**
 * Embed a single text string. Returns a 384-dim float array.
 */
export async function embedText(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Embed multiple texts in one call. Returns an array of 384-dim float arrays.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const pipe = await getPipeline();
  const output = await pipe(texts, { pooling: "mean", normalize: true });
  const dim = 384;
  const results: number[][] = [];
  const data = output.data as Float32Array;
  for (let i = 0; i < texts.length; i++) {
    results.push(Array.from(data.slice(i * dim, (i + 1) * dim)));
  }
  return results;
}

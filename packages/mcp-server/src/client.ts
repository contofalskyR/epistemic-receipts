/**
 * Thin HTTP client for the Epistemic Receipts /v1 API.
 *
 * All methods throw McpApiError on non-2xx responses so tool handlers can
 * surface helpful messages instead of raw stack traces.
 */

export interface ApiConfig {
  baseUrl: string;
  apiKey: string | undefined;
}

export class McpApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail: string,
    public readonly retryAfter?: number,
  ) {
    super(`${status} ${title}: ${detail}`);
    this.name = "McpApiError";
  }
}

export function buildConfig(): ApiConfig {
  const baseUrl = (
    process.env.EPISTEMIC_RECEIPTS_API_BASE_URL ?? "https://epistemic-receipts.vercel.app"
  ).replace(/\/$/, "");
  const apiKey = process.env.EPISTEMIC_RECEIPTS_API_KEY;
  return { baseUrl, apiKey };
}

async function apiFetch(config: ApiConfig, path: string): Promise<unknown> {
  const url = `${config.baseUrl}/api/v1${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const res = await fetch(url, { headers });

  if (res.ok) {
    return res.json();
  }

  // Parse RFC 7807 error body
  const retryAfter = res.headers.get("Retry-After");
  let title = res.statusText;
  let detail = `HTTP ${res.status} from ${url}`;

  try {
    const body = (await res.json()) as Record<string, unknown>;
    if (typeof body.title === "string") title = body.title;
    if (typeof body.detail === "string") detail = body.detail;
  } catch {
    // ignore parse errors
  }

  throw new McpApiError(
    res.status,
    title,
    detail,
    retryAfter ? Number(retryAfter) : undefined,
  );
}

// --- typed wrappers ---

export interface SearchResult {
  id: string;
  text: string;
  epistemicAxis: string | null;
  claimType: string | null;
  ingestedBy: string | null;
  verificationStatus: string | null;
  rank: number;
  provenanceGrade: string;
}

export interface SearchResponse {
  query: string;
  total: number;
  limit: number;
  offset: number;
  data: SearchResult[];
}

export async function searchClaims(
  config: ApiConfig,
  query: string,
  filters?: { axis?: string; limit?: number },
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (filters?.axis) params.set("axis", filters.axis);
  if (filters?.limit) params.set("limit", String(filters.limit));
  return apiFetch(config, `/search?${params}`) as Promise<SearchResponse>;
}

export interface Edge {
  id: string;
  type: string;
  evidenceType: string | null;
  source: {
    id: string;
    name: string;
    url: string | null;
    methodologyType: string | null;
    publishedAt: string | null;
  };
}

export interface StatusHistoryEntry {
  id: string;
  fromAxis: string | null;
  toAxis: string | null;
  community: string | null;
  reason: string | null;
  occurredAt: string;
  datePrecision: string | null;
  markerSourceId: string | null;
}

export interface ClaimDetail {
  id: string;
  text: string;
  claimType: string | null;
  epistemicAxis: string | null;
  verificationStatus: string | null;
  ingestedBy: string | null;
  humanReviewed: boolean;
  provenanceGrade: string;
  provenanceDetail: {
    grade: string;
    description: string;
    primarySourceEdgeCount: number;
  };
  edges: Edge[];
  statusHistory: StatusHistoryEntry[];
  topics: Array<{ id: string; name: string; slug: string; domain: string | null }>;
  claimEmergedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getClaimWithReceipts(
  config: ApiConfig,
  claimId: string,
): Promise<ClaimDetail> {
  return apiFetch(config, `/claims/${encodeURIComponent(claimId)}`) as Promise<ClaimDetail>;
}

export interface TrajectoryEntry {
  id: string;
  fromAxis: string | null;
  toAxis: string | null;
  community: string | null;
  reason: string | null;
  occurredAt: string;
  datePrecision: string | null;
  markerSource: {
    id: string;
    name: string;
    url: string | null;
    methodologyType: string | null;
  } | null;
}

export interface TrajectoryResponse {
  claimId: string;
  claimText: string;
  statusHistory: TrajectoryEntry[];
}

export async function getTrajectory(
  config: ApiConfig,
  claimId: string,
): Promise<TrajectoryResponse> {
  return apiFetch(
    config,
    `/trajectories/${encodeURIComponent(claimId)}`,
  ) as Promise<TrajectoryResponse>;
}

export interface VerifyResult {
  id: string;
  text: string;
  epistemicAxis: string | null;
  claimType: string | null;
  ingestedBy: string | null;
  verificationStatus: string | null;
  similarity: number;
}

export interface VerifyResponse {
  text: string;
  disclaimer: string;
  results: VerifyResult[];
}

export async function verifyStatement(
  config: ApiConfig,
  statement: string,
  limit = 5,
): Promise<VerifyResponse> {
  const params = new URLSearchParams({ text: statement, limit: String(limit) });
  return apiFetch(config, `/verify?${params}`) as Promise<VerifyResponse>;
}

export interface ManifestEntry {
  tag: string;
  name: string;
  retired: boolean;
  upstreamName: string | null;
  upstreamUrl: string | null;
  method: string | null;
  cadence: string | null;
  caveats: string | null;
  counts: {
    total: number;
    humanReviewed: number;
    autoApproved: number;
    verificationMix: Record<string, number>;
  };
  lastRunAt: string | null;
  license: string;
  licenseUrl: string;
}

export async function listDatasets(config: ApiConfig): Promise<ManifestEntry[]> {
  return apiFetch(config, "/manifest") as Promise<ManifestEntry[]>;
}

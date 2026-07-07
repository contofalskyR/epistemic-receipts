// All feature gates go through this module. No inline tier checks in routes.

export type Tier = "free" | "pro" | "team" | "enterprise";

export type EntitlementContext = {
  user?: { id: string; tier?: Tier } | null;
  org?: { id: string; tier: Tier } | null;
  isOrgAdmin?: boolean;
};

export type Feature =
  | "alerts.max"
  | "collections.max"
  | "export.citations"
  | "export.bulk"
  | "api.keys";

type FeatureConfig = {
  type: "max";
  values: Record<Tier, number> & { org: number };
} | {
  type: "flag";
  values: Record<Tier, boolean> & { org: boolean; orgAdmin?: boolean };
};

const FEATURES: Record<Feature, FeatureConfig> = {
  "alerts.max": {
    type: "max",
    values: { free: 3, pro: 10, team: 25, enterprise: 50, org: 50 },
  },
  "collections.max": {
    type: "max",
    values: { free: 10, pro: 50, team: 200, enterprise: Infinity, org: Infinity },
  },
  "export.citations": {
    type: "flag",
    values: { free: false, pro: false, team: true, enterprise: true, org: true },
  },
  "export.bulk": {
    type: "flag",
    values: { free: false, pro: true, team: true, enterprise: true, org: true },
  },
  "api.keys": {
    type: "flag",
    values: { free: false, pro: false, team: false, enterprise: true, org: false, orgAdmin: true },
  },
};

export function can(ctx: EntitlementContext | null, feature: Feature): boolean | number {
  const config = FEATURES[feature];

  if (ctx?.org) {
    if (config.type === "max") return config.values.org;
    if (feature === "api.keys") return !!ctx.isOrgAdmin;
    return config.values.org;
  }

  const tier: Tier = ctx?.user?.tier ?? "free";
  if (config.type === "max") return config.values[tier] ?? config.values.free;
  return config.values[tier] ?? false;
}

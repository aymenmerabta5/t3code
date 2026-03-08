type CodexPlanType =
  | "free"
  | "go"
  | "plus"
  | "pro"
  | "business"
  | "enterprise"
  | "edu"
  | "unknown"
  | "team";

export interface CodexAccountSnapshot {
  readonly type: "apiKey" | "chatgpt" | "unknown";
  readonly planType: CodexPlanType | null;
  readonly sparkEnabled: boolean;
}

const CODEX_SPARK_DISABLED_PLAN_TYPES = new Set<CodexPlanType>([
  "free",
  "go",
  "plus",
  "business",
]);

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizePlanType(value: unknown): CodexPlanType {
  if (value === "team") {
    return "business";
  }
  switch (value) {
    case "free":
    case "go":
    case "plus":
    case "pro":
    case "business":
    case "enterprise":
    case "edu":
      return value;
    default:
      return "unknown";
  }
}

export function createUnknownCodexAccountSnapshot(): CodexAccountSnapshot {
  return {
    type: "unknown",
    planType: null,
    sparkEnabled: false,
  };
}

export function planLabelFromSnapshot(snapshot: CodexAccountSnapshot): string | undefined {
  if (snapshot.type === "apiKey") return "API Key";
  if (snapshot.type === "chatgpt" && snapshot.planType && snapshot.planType !== "unknown") {
    return snapshot.planType.charAt(0).toUpperCase() + snapshot.planType.slice(1);
  }
  return undefined;
}

export function readCodexAccountSnapshot(response: unknown): CodexAccountSnapshot {
  const record = asObject(response);
  const account = asObject(record?.account) ?? record;
  const accountType = asString(account?.type);

  if (accountType === "apiKey") {
    return {
      type: "apiKey",
      planType: null,
      sparkEnabled: true,
    };
  }

  if (accountType === "chatgpt") {
    const planType = normalizePlanType(account?.planType);
    return {
      type: "chatgpt",
      planType,
      sparkEnabled: !CODEX_SPARK_DISABLED_PLAN_TYPES.has(planType),
    };
  }

  return createUnknownCodexAccountSnapshot();
}

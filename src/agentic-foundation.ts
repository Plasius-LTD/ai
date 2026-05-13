import type { AICapability } from "./platform/index.js";

const TASK_KIND_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TASK_KIND_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

function normalizeTaskKindSegment(segment: string, label: string): string {
  const trimmed = segment.trim();
  if (!TASK_KIND_SEGMENT_PATTERN.test(trimmed)) {
    throw new Error(
      `${label} must use lowercase letters, numbers, and single hyphen separators.`
    );
  }

  return trimmed;
}

function requireNonEmptyString(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return trimmed;
}

export const AI_FEATURE_FLAGS = {
  agenticFoundation: "ai.agentic.foundation.enabled",
} as const;

export type AIFeatureFlagKey =
  (typeof AI_FEATURE_FLAGS)[keyof typeof AI_FEATURE_FLAGS];

export type AIFeatureFlagSnapshot = Readonly<
  Record<string, boolean | undefined>
>;

export const AI_ROLLOUT_EVALUATORS = [
  "remote-flag-service",
  "host-application",
  "break-glass-env",
] as const;

export type AIRolloutEvaluator = (typeof AI_ROLLOUT_EVALUATORS)[number];

export const AI_ROLLOUT_FALLBACK_MODES = ["fail-closed", "fail-open"] as const;

export type AIRolloutFallbackMode =
  (typeof AI_ROLLOUT_FALLBACK_MODES)[number];

export interface AIRolloutControl {
  featureFlag: string;
  evaluator: AIRolloutEvaluator;
  defaultEnabled: boolean;
  fallbackMode: AIRolloutFallbackMode;
}

export interface AIRolloutDecision extends AIRolloutControl {
  enabled: boolean;
  source: "snapshot" | "default";
}

export const AI_AGENTIC_FOUNDATION_ROLLOUT: AIRolloutControl = Object.freeze({
  featureFlag: AI_FEATURE_FLAGS.agenticFoundation,
  evaluator: "remote-flag-service",
  defaultEnabled: false,
  fallbackMode: "fail-closed",
});

export function resolveAIRolloutDecision(
  control: AIRolloutControl,
  snapshot: AIFeatureFlagSnapshot = {}
): AIRolloutDecision {
  const resolved = snapshot[control.featureFlag];
  if (typeof resolved === "boolean") {
    return {
      ...control,
      enabled: resolved,
      source: "snapshot",
    };
  }

  return {
    ...control,
    enabled: control.defaultEnabled,
    source: "default",
  };
}

export function isAgenticFoundationEnabled(
  snapshot: AIFeatureFlagSnapshot = {}
): boolean {
  return resolveAIRolloutDecision(
    AI_AGENTIC_FOUNDATION_ROLLOUT,
    snapshot
  ).enabled;
}

export interface AITaskKindParts {
  domain: string;
  action: string;
  variant?: string;
}

export type AITaskKind = `${string}.${string}`;

export function isAITaskKind(value: string): value is AITaskKind {
  return TASK_KIND_PATTERN.test(value.trim());
}

export function createAITaskKind(parts: AITaskKindParts): AITaskKind {
  const segments = [
    normalizeTaskKindSegment(parts.domain, "Task kind domain"),
    normalizeTaskKindSegment(parts.action, "Task kind action"),
  ];

  if (parts.variant) {
    segments.push(normalizeTaskKindSegment(parts.variant, "Task kind variant"));
  }

  return segments.join(".") as AITaskKind;
}

export const AI_ACTOR_TYPES = [
  "user",
  "service",
  "system",
  "moderator",
] as const;

export type AIActorType = (typeof AI_ACTOR_TYPES)[number];

export const AI_RISK_TIERS = ["low", "medium", "high", "critical"] as const;

export type AIRiskTier = (typeof AI_RISK_TIERS)[number];

export const AI_DATA_CLASSIFICATIONS = [
  "public",
  "internal",
  "personal",
  "sensitive",
] as const;

export type AIDataClassification =
  (typeof AI_DATA_CLASSIFICATIONS)[number];

export const AI_PROVIDER_STAGES = [
  "development",
  "preview",
  "stable",
  "deprecated",
] as const;

export type AIProviderStage = (typeof AI_PROVIDER_STAGES)[number];

export const AI_LATENCY_TIERS = ["fast", "balanced", "slow"] as const;

export type AILatencyTier = (typeof AI_LATENCY_TIERS)[number];

export const AI_CACHE_REUSE_POLICIES = [
  "none",
  "exact",
  "near-text",
] as const;

export type AICacheReusePolicy =
  (typeof AI_CACHE_REUSE_POLICIES)[number];

export const AI_COST_UNITS = [
  "1k-tokens",
  "characters",
  "seconds",
  "images",
  "requests",
] as const;

export type AICostUnit = (typeof AI_COST_UNITS)[number];

export const AI_COST_CATEGORIES = [
  "input",
  "output",
  "cache",
  "request",
  "storage",
] as const;

export type AICostCategory = (typeof AI_COST_CATEGORIES)[number];

export const AI_CONFIDENCE_BANDS = ["low", "medium", "high"] as const;

export type AIConfidenceBand = (typeof AI_CONFIDENCE_BANDS)[number];

export interface AIRequestActor {
  actorId: string;
  actorType: AIActorType;
  sessionId?: string;
}

export interface AIExecutionBudget {
  maxLatencyMs?: number;
  maxCostUsd?: number;
  minimumConfidence?: number;
}

export interface AIRequestPolicy {
  riskTier: AIRiskTier;
  dataClassification: AIDataClassification;
  budget?: AIExecutionBudget;
  allowProviderIds?: readonly string[];
  denyProviderIds?: readonly string[];
}

export interface AIRequestEnvelope<
  TInput = unknown,
  TContext = unknown,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  requestId: string;
  createdAt: string;
  taskKind: AITaskKind;
  actor: AIRequestActor;
  input: TInput;
  context?: TContext;
  metadata?: TMetadata;
  rollout: AIRolloutControl;
  policy: AIRequestPolicy;
}

export interface CreateAIRequestEnvelopeInput<
  TInput = unknown,
  TContext = unknown,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  requestId: string;
  createdAt?: string;
  taskKind: AITaskKind | AITaskKindParts;
  actor: AIRequestActor;
  input: TInput;
  context?: TContext;
  metadata?: TMetadata;
  rollout?: AIRolloutControl;
  policy?: Partial<AIRequestPolicy>;
}

export function createAIRequestEnvelope<
  TInput = unknown,
  TContext = unknown,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  input: CreateAIRequestEnvelopeInput<TInput, TContext, TMetadata>
): AIRequestEnvelope<TInput, TContext, TMetadata> {
  const requestId = requireNonEmptyString(input.requestId, "Request id");
  const actorId = requireNonEmptyString(input.actor.actorId, "Actor id");
  const taskKind =
    typeof input.taskKind === "string"
      ? input.taskKind
      : createAITaskKind(input.taskKind);

  if (!isAITaskKind(taskKind)) {
    throw new Error(
      "Task kind must use dot-delimited lowercase segments such as 'routing.select'."
    );
  }

  return {
    requestId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    taskKind,
    actor: {
      ...input.actor,
      actorId,
    },
    input: input.input,
    context: input.context,
    metadata: input.metadata,
    rollout: input.rollout ?? AI_AGENTIC_FOUNDATION_ROLLOUT,
    policy: {
      riskTier: input.policy?.riskTier ?? "low",
      dataClassification: input.policy?.dataClassification ?? "internal",
      budget: input.policy?.budget,
      allowProviderIds: input.policy?.allowProviderIds,
      denyProviderIds: input.policy?.denyProviderIds,
    },
  };
}

export interface AIUsageMetrics {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  characters?: number;
  audioSeconds?: number;
  images?: number;
  cacheReadUnits?: number;
  cacheWriteUnits?: number;
  vendor?: Record<string, number>;
}

export interface AIPricingRate {
  category: AICostCategory;
  unit: AICostUnit;
  unitAmount: number;
  currency: string;
}

export interface AICostLineItem extends AIPricingRate {
  units: number;
  totalAmount: number;
  description?: string;
}

export interface AICostEstimate {
  currency: string;
  estimatedAmount: number;
  billedAmount?: number;
  pricingVersion?: string;
  lineItems?: readonly AICostLineItem[];
}

export interface AIConfidenceScore {
  score: number;
  scale: "0-1" | "0-100";
  band?: AIConfidenceBand;
  reasonCodes?: readonly string[];
}

export interface AIExecutionMetrics {
  durationMs?: number;
  usage?: AIUsageMetrics;
  cost?: AICostEstimate;
  confidence?: AIConfidenceScore;
}

export interface AIProviderDescriptor {
  id: string;
  displayName: string;
  stage: AIProviderStage;
  capabilities: readonly AICapability[];
  supportedTaskKinds?: readonly AITaskKind[];
  supportsPersonalData: boolean;
  cacheReuse: AICacheReusePolicy;
  dataResidency?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface AIModelCatalogEntry {
  providerId: string;
  modelId: string;
  displayName: string;
  stage: AIProviderStage;
  taskKinds: readonly AITaskKind[];
  capabilities?: readonly AICapability[];
  latencyTier?: AILatencyTier;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  pricing?: readonly AIPricingRate[];
  defaultConfidence?: AIConfidenceScore;
  cacheReuse?: AICacheReusePolicy;
  supportsBatch?: boolean;
  supportsStreaming?: boolean;
  supportsPersonalData?: boolean;
}

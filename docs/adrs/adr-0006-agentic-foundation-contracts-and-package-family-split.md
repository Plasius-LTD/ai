# ADR-0006: Keep Agentic Foundation Contracts in @plasius/ai and Move Orchestration Downstream

- Date: 2026-05-13
- Status: Accepted

## Context

The Plasius agentic AI package family now spans provider configuration, routing, speech, governance, MCP, RAG, game workloads, and evaluation packages. Those packages need a shared contract vocabulary for task kinds, request envelopes, provider/model catalogs, usage metering, confidence, and cost without turning `@plasius/ai` into the runtime orchestrator for every AI concern.

The parent feature is controlled by `ai.agentic.foundation.enabled`, but feature-flag evaluation belongs to host control planes rather than to this public contract package. The foundation package still needs to publish the canonical flag key and a fail-closed fallback shape so downstream packages can document and test the same rollout contract consistently.

## Decision

Keep `@plasius/ai` as the contracts-first foundation package and add only additive agentic primitives:

- canonical task-kind formatting and validation helpers;
- generic request-envelope, rollout-control, and actor/policy contracts;
- provider and model catalog descriptor contracts;
- usage, pricing, cost, confidence, and execution-metrics contracts;
- the canonical `ai.agentic.foundation.enabled` rollout descriptor with fail-closed default behavior.

Do not move provider orchestration, routing policies, moderation logic, MCP policy, RAG packing, or gameplay-specific behavior into `@plasius/ai`. Those concerns belong in downstream `@plasius/ai-*` packages that import the shared foundation contracts.

## Consequences

- Existing `AICapability` and `AIPlatform` exports remain source-compatible for current consumers.
- Downstream packages gain a stable public vocabulary without depending on provisional runtime glue.
- Feature-flag evaluation remains remote and host-owned; this package only defines the canonical key and fallback shape.
- Future package work can add package-specific task kinds and policies without reopening the `@plasius/ai` runtime boundary.

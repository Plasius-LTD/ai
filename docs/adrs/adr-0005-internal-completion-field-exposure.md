# ADR-0005: Internal Completion Field Exposure

- Date: 2026-03-09
- Status: Accepted

## Context

`@plasius/ai` completion records include a `partitionKey` that ties persisted completions to an internal user or system actor. Consumers also use the same schema objects when shaping payloads for client responses. Without an explicit exposure rule, that persistence metadata can be serialized into client-facing payloads by default.

## Decision

Mark `completionSchema.partitionKey` as an internal field using `@plasius/schema` exposure metadata and treat `completionSchema.serialize(...)` as the default path for client-safe completion payloads.

## Consequences

- Public serialization omits ownership metadata by default.
- Validation still accepts the full persisted completion shape.
- Callers that need internal metadata for server-side workflows must opt in explicitly during serialization.

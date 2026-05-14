# API Reference

## Enums

### `AICapability`

Routing capability enum:

- `Chat`
- `Text`
- `Speech`
- `Image`
- `Video`
- `Balance`
- `Model`

## Core Interfaces

### `AIPlatform`

Contract for runtime adapters:

- `chatWithAI(userId, input, context, model)`
- `synthesizeSpeech(userId, input, voice, context, model)`
- `transcribeSpeech(userId, input, context, model)`
- `generateImage(userId, input, context, model)`
- `produceVideo(userId, input, image, context, model)`
- `generateModel(userId, input, context, model)`
- `checkBalance(userId)`
- `currentBalance`

Optional:

- `canHandle(userId, capabilities)`

### `VideoProviderPlatform`

Video-only platform contract used by `createVideoProviderPlatform`:

- `produceVideo(userId, input, image, context, model)`
- `checkBalance(userId)`
- `currentBalance`

### `AIRequestEnvelope<TInput, TContext, TMetadata>`

Canonical request shape for downstream agentic workflows:

- `requestId`
- `createdAt`
- `taskKind`
- `actor`
- `input`
- `context?`
- `metadata?`
- `rollout`
- `policy`

Create envelopes with `createAIRequestEnvelope(...)` to get fail-closed rollout defaults and validated task-kind formatting.

## Completion Models

Base type:

- `Completion`
  - `id`
  - `partitionKey`
  - `type`
  - `model`
  - `durationMs`
  - `createdAt`
  - `usage?`

Specialized variants:

- `ChatCompletion`
- `TextCompletion`
- `ImageCompletion`
- `SpeechCompletion`
- `VideoCompletion`
- `ModelCompletion`
- `BalanceCompletion`

## Agentic Foundation Contracts

### Feature flags and rollout

- `AI_FEATURE_FLAGS`
- `AI_AGENTIC_FOUNDATION_ROLLOUT`
- `VIDEO_PROVIDER_PLATFORM_HARDENING_FEATURE_FLAG`
- `resolveAIRolloutDecision(control, snapshot?)`
- `isAgenticFoundationEnabled(snapshot?)`

Rollout descriptors are public contracts only. Host applications remain the source of truth for remote flag evaluation.

### Task-kind helpers

- `AITaskKind`
- `AITaskKindParts`
- `createAITaskKind(parts)`
- `isAITaskKind(value)`

Task kinds use dot-delimited lowercase segments such as `routing.select` or `game.npc-dialogue.near-cache`.

### Policy, catalog, and metering types

- `AIRequestActor`
- `AIRequestPolicy`
- `AIExecutionBudget`
- `AIProviderDescriptor`
- `AIModelCatalogEntry`
- `AIUsageMetrics`
- `AIPricingRate`
- `AICostEstimate`
- `AICostLineItem`
- `AIConfidenceScore`
- `AIExecutionMetrics`

## Adapter Composition

### `AICapabilityAdapter`

Provider adapter contract with capability declarations and optional operation handlers:

- `id`
- `capabilities`
- `chatWithAI(request)?`
- `synthesizeSpeech(request)?`
- `transcribeSpeech(request)?`
- `generateImage(request)?`
- `produceVideo(request)?`
- `generateModel(request)?`
- `checkBalance(request)?`

### `createAdapterPlatform(userId, props)`

Builds an `AIPlatform` by routing capability calls to registered adapters and injecting developer-supplied API keys from `props.apiKeys`.

### `HttpClientPolicy`

Shared HTTP resilience policy used by built-in adapters:

- `maxAttempts?`
- `timeoutMs?`
- `baseDelayMs?`
- `maxDelayMs?`
- `jitterRatio?`
- `respectRetryAfter?`
- `retryableMethods?`
- `retryableStatusCodes?`

### `createOpenAIAdapter(options?)`

Creates a built-in OpenAI adapter implementing:

- `chatWithAI`
- `synthesizeSpeech`
- `transcribeSpeech`
- `generateImage`
- `generateModel`

`options.httpPolicy` applies retry/timeout behavior to all OpenAI adapter HTTP requests.

### `createGeminiAdapter(options?)`

Creates a built-in Gemini adapter implementing:

- `chatWithAI`
- `generateImage`
- `generateModel`

`options.httpPolicy` applies retry/timeout behavior to all Gemini adapter HTTP requests.

### `createGrokAdapter(options?)`

Creates an xAI Grok adapter (OpenAI-compatible transport) implementing:

- `chatWithAI`
- `generateImage`
- `generateModel`

### `createMetaAIAdapter(options?)`

Creates a Meta AI adapter (Llama-compatible transport) implementing:

- `chatWithAI`
- `generateModel`

### `createPixelverseAdapter(options?)`

Creates a Pixelverse adapter implementing:

- `produceVideo`
- `checkBalance`

### `createVideoProviderPlatform`

Builds a `VideoProviderPlatform` from a `VideoProviderAdapter`.

## Exported Schemas

- `completionSchema`
- `chatCompletionSchema`
- `textCompletionSchema`
- `imageCompletionSchema`
- `speechCompletionSchema`
- `videoCompletionSchema`
- `modelCompletionSchema`
- `balanceCompletionSchema`

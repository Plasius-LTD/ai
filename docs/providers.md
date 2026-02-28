# Provider Guidance

This package defines provider contracts but does not require consumers to use a
specific provider implementation.

## Recommended Integration Pattern

1. Use built-in adapters (`createOpenAIAdapter`, `createGeminiAdapter`) or build provider adapters in your host app.
2. Compose adapters with `createAdapterPlatform(...)` and an `apiKeys` map keyed by adapter id.
3. Keep provider secrets in runtime environment variables, not in UI bundles.
4. Normalize results into exported completion models.

## Built-In Adapters

- `createOpenAIAdapter(options?)`
  - Default adapter id: `openai`
  - Capabilities: chat, speech synthesis, transcription, image generation, model generation
- `createGeminiAdapter(options?)`
  - Default adapter id: `gemini`
  - Capabilities: chat, image generation, model generation
- `createGrokAdapter(options?)`
  - Default adapter id: `grok`
  - Capabilities: chat, image generation, model generation
- `createMetaAIAdapter(options?)`
  - Default adapter id: `meta-ai`
  - Capabilities: chat, model generation
- `createPixelverseAdapter(options?)`
  - Default adapter id: `pixelverse`
  - Capabilities: video generation, balance

## Network Citizenship Defaults

Built-in adapters and the generic HTTP video adapter apply resilient request behavior by default:

- Timeout per request (`30s` default).
- Exponential backoff with jitter for transient failures.
- Retry on common transient statuses (`408`, `409`, `425`, `429`, `500`, `502`, `503`, `504`).
- Honor `Retry-After` when present.

Override these values using `httpPolicy` in adapter options.

## Adapter Checklist

- Map provider-specific response IDs to `Completion.id`.
- Populate `durationMs` from measured execution time.
- Set `partitionKey` to your stable user/session key.
- Attach provider usage/cost metadata to `usage`.
- Use stable adapter ids and provide matching API keys in `AdapterPlatformProps.apiKeys`.
- Return strongly typed completion variants for each capability.

## Stability Notes

- Prefer `createOpenAIAdapter` and `createGeminiAdapter` for out-of-the-box provider integration.

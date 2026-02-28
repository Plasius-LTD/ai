# Architecture

`@plasius/ai` is structured as a contracts-first package:

- **Capability model**: `AICapability` describes the logical feature set.
- **Platform contract**: `AIPlatform` defines the async operations required by a runtime adapter.
- **Completion contracts**: typed completion outputs normalize chat/text/image/speech/video/model/balance results.
- **Schema layer**: schema definitions ensure consistent metadata and persistence shape across runtimes.
- **Adapter composition**: `createAdapterPlatform` routes capabilities across multiple adapters and injects API keys supplied by the package consumer.
- **Built-in providers**: OpenAI and Gemini adapters are included for out-of-the-box capability wiring.
- **Resilient transport**: adapters use a shared HTTP resilience policy (timeouts, exponential backoff + jitter, and `Retry-After` handling).

## Design Intention

This package is not tied to a single provider runtime. Host applications should:

1. Implement or wrap an `AIPlatform` adapter.
2. Keep provider credentials and network execution outside this package boundary.
3. Emit normalized completion objects based on the exported contract types.
4. Register per-provider API keys through `AdapterPlatformProps.apiKeys`.

## Current Boundaries

- Public API: contracts and schemas from `src/platform/index.ts`.
- Internal/provisional: files under `src/lib` and in-progress provider runtime glue.

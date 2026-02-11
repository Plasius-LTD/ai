# Provider Guidance

This package defines provider contracts but does not require consumers to use a
specific provider implementation.

## Recommended Integration Pattern

1. Build provider adapters in your host app or a dedicated integration package.
2. Implement `AIPlatform` for each provider.
3. Keep provider secrets in runtime environment variables, not in UI bundles.
4. Normalize results into exported completion models.

## Adapter Checklist

- Map provider-specific response IDs to `Completion.id`.
- Populate `durationMs` from measured execution time.
- Set `partitionKey` to your stable user/session key.
- Attach provider usage/cost metadata to `usage`.
- Return strongly typed completion variants for each capability.

## Stability Notes

- `src/platform/openai.ts` and `src/platform/pixelverse.ts` are implementation
  work areas and should be treated as provisional until explicit public export
  and API freeze.
- Prefer composition from host apps until adapter APIs are finalized.

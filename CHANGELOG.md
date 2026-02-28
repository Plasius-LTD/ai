# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

- **Added**
  - Added built-in provider adapter factories:
    - `createOpenAIAdapter` for chat, speech synthesis, transcription, image generation, and model generation.
    - `createGeminiAdapter` for chat, image generation, and model generation.
  - Added shared HTTP resilience policy contracts (`HttpClientPolicy`) and transport helper for consistent retry/timeout behavior across adapters.
  - Added generic multi-capability adapter contracts (`AICapabilityAdapter`, request context/request types) and `createAdapterPlatform` for routing chat/voice/image/video/model operations.
  - Added `AICapability.Model`, `ModelCompletion`, `modelCompletionSchema`, and `AIPlatform.generateModel(...)`.
  - Added generic video-provider adapter contracts (`VideoProviderAdapter`, request/result types).
  - Added `createHttpVideoProviderAdapter` for host-defined HTTP endpoint mapping.
  - Added `createVideoProviderPlatform` to compose `AIPlatform` video/balance behavior from adapters.

- **Changed**
  - Updated docs and examples to use built-in OpenAI/Gemini adapter factories with developer-supplied API keys.
  - Hardened OpenAI/Gemini/video HTTP adapters with internet-friendly client behavior:
    - request timeout defaults
    - exponential backoff with jitter
    - `Retry-After` handling
    - retry on transient status codes (`408`, `409`, `425`, `429`, `500`, `502`, `503`, `504`)
  - Hardened provisional adapters to align with injected-key usage:
    - Removed provisional `OpenAIPlatform` runtime scaffold (`src/platform/openai.ts`) in favor of `createOpenAIAdapter`.
    - `createVideoProviderPlatform` now validates non-empty API key input.
    - `createHttpVideoProviderAdapter` now validates API keys and uses request-scoped `fetchFn` for URL image uploads.
  - Hardened GitHub CD publish flow to publish only after successful install, test, and build, then push tags/releases post-publish.
  - Standardized npm publish path on workflow-dispatched `.github/workflows/cd.yml` using provenance and production environment secrets.
  - Replaced `audit:deps` from `depcheck` to `npm ls --all --omit=optional --omit=peer > /dev/null 2>&1 || true` to avoid deprecated dependency-chain risk.
  - Refactored video editor/balance components to rely on injected provider adapters instead of hardcoded vendor wiring.
  - Removed provider-specific identifiers from code roots to enforce public package boundaries.

- **Fixed**
  - `pack:check` now passes vendor-namespace checks for `src/**` by using generic provider naming in runtime/editor code.

- **Security**
  - Removed `depcheck` (and its `multimatch`/`minimatch` chain) from devDependencies to resolve reported high-severity audit findings.

## [1.0.4] - 2026-02-21

- **Added**
  - Added `npm run demo:run` for one-command local package/demo verification.

- **Changed**
  - Aligned OpenAI requirement to `^5.23.2` to match current `plasius-ltd-site` resolved baseline.
  - Updated React Router and toolchain dependency minimums to current `plasius-ltd-site` requirements.

- **Fixed**
  - Updated demo docs to run via the package script instead of manual multi-step commands.

- **Security**
  - (placeholder)

## [1.0.4] - 2026-02-21

- **Added**
  - Add a typed chatbot API client (`chatWithAI`, `getChatbotUsage`) for `/ai/chatbot`.
  - Add `ChatbotApiError` with HTTP status/code/usage metadata for auth and quota handling.
  - Add CSRF bootstrap support (GET-first cookie hydration, then `x-csrf-token` on POST).

- **Changed**
  - Export chatbot client utilities from the package root.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.3] - 2026-02-12

- **Added**
  - Standalone public package scaffold at repository root with independent CI/CD, ADRs, and legal governance assets.
  - Contracts-first documentation set:
    - architecture overview
    - API reference
    - provider integration guidance
  - ADR-0003 for contracts-first documentation baseline.

- **Changed**
  - Add dual ESM + CJS build outputs with `exports` entries and CJS artifacts in `dist-cjs/`.
  - Expanded README with stable API scope, known limitations, and host-integration expectations.

- **Fixed**
  - Removed monorepo-relative TypeScript configuration coupling for standalone builds.

- **Security**
  - Added baseline public package governance and CLA documentation.

---

## Release process (maintainers)

1. Update `CHANGELOG.md` under **Unreleased** with user-visible changes.
2. Bump version in `package.json` following SemVer (major/minor/patch).
3. Move entries from **Unreleased** to a new version section with the current date.
4. Tag the release in Git (`vX.Y.Z`) and push tags.
5. Publish to npm (via CI/CD or `npm publish`).

> Tip: Use Conventional Commits in PR titles/bodies to make changelog updates easier.

---

[Unreleased]: https://github.com/Plasius-LTD/ai/compare/v1.0.4...HEAD
[1.0.4]: https://github.com/Plasius-LTD/ai/releases/tag/v1.0.4

## [1.0.0] - 2026-02-11

- **Added**
  - Initial release.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)
[1.0.3]: https://github.com/Plasius-LTD/ai/releases/tag/v1.0.3
[1.0.4]: https://github.com/Plasius-LTD/ai/releases/tag/v1.0.4

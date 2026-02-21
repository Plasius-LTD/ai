# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

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

[Unreleased]: https://github.com/Plasius-LTD/ai/compare/v1.0.3...HEAD

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

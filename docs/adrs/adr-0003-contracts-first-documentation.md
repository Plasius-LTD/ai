# ADR-0003: Contracts-First Documentation Baseline

- Date: 2026-02-11
- Status: Accepted

## Context

As `@plasius/ai` moves to public npm usage, consumers need clear guidance on
what is stable API versus what is provisional runtime code. Previous
documentation did not clearly separate these concerns.

## Decision

Document `@plasius/ai` around the current stable contract surface:

- Publish architecture guidance for contracts-first usage.
- Provide explicit API reference for `AICapability`, `AIPlatform`, completion
  models, and schemas.
- Add provider guidance for host-app adapter composition.
- Record known limitations and provisional runtime areas in README/docs.

## Consequences

- Integrators can safely adopt stable exports without relying on unfinished internals.
- Migration to future provider packages can happen with less ambiguity.

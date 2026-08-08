# ADR-0002: Public Repository Governance Baseline

- Date: 2026-02-11
- Status: Accepted

## Context

Public npm distribution requires transparent contributor and security policy
artifacts and consistent release automation.

## Decision

Include these baseline governance assets:

- `CODE_OF_CONDUCT.md`
- `CONTRIBUTORS.md`
- `SECURITY.md`
- `legal/` CLA documents
- CI/CD GitHub Actions workflows
- Same-repository pull-request integrity checks before any self-hosted CI job
- GitHub-hosted, `production`-gated npm publication using OIDC trusted publishing
- Exact push-commit CI success as a prerequisite for package publication

## Consequences

- Public contributors and consumers can follow a predictable governance process.
- Release quality gates (build, test, coverage, publish) are standardized.
- Fork pull requests cannot execute repository-controlled code on self-hosted
  runners, and npm publication does not depend on a long-lived write token.

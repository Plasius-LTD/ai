# ADR-0007: Use npm Trusted Publishing for CD

- Status: Accepted
- Date: 2026-08-08

## Context

The public package release workflow must publish `@plasius/ai` from the
GitHub-hosted `production` environment. The previous workflow required
`NPM_TOKEN` and configured npm registry authentication through
`NODE_AUTH_TOKEN`, which created a long-lived write credential and could mask
trusted-publisher configuration errors as npm `E404` responses.

## Decision

Publication is phase-isolated: dependency installation, package validation,
SBOM generation, and immutable tarball packing run in `validate_and_pack`
without the `production` environment or OIDC permission. The final hosted
`publish` job downloads only that sealed artifact, explicitly installs npm
11.6.2, runs no repository dependency code, and publishes the tarball with
lifecycle scripts disabled. It re-fetches current `main` immediately before
the first release mutation and again immediately before npm publication.
`.npmrc` contains no registry-auth placeholder, and release preparation returns
the reviewed current `main` HEAD rather than package-file history.

Use npm Trusted Publishing through GitHub Actions OIDC. The CD workflow keeps
`id-token: write`, runs the publish job on `ubuntu-latest` in the `production`
environment, and invokes `npm publish --provenance` without `NPM_TOKEN`,
`NODE_AUTH_TOKEN`, or a generated registry auth line. The npm package owner
must bind the repository, workflow filename, and environment to the matching
trusted publisher configuration.

The publish job must additionally prove that the prepared commit is still the
exact remote `main` head and that a push-triggered `ci.yml` run succeeded for
that SHA. It fails closed unless the release runtime is Node 24 with npm 11.5.1
or newer, which is the minimum npm release line supporting this OIDC flow.

## Alternatives considered

- Keep a long-lived npm write token: rejected because compromise would grant
  persistent publish authority and conflicts with the release-readiness
  acceptance criteria.
- Use a read-only npm token for publication: rejected because read-only
  credentials cannot publish and still add unnecessary token handling to the
  release path.

## Consequences

The npm account configuration becomes a release prerequisite, and the workflow
will fail until the trusted publisher fields exactly match the GitHub workflow
identity. In return, publication uses short-lived credentials, retains
provenance, and removes the need to rotate or expose a publish token.

## Test implications

The workflow contract test must reject legacy npm token names and registry auth
configuration while requiring the OIDC permission, production environment,
GitHub-hosted runner, exact-main successful-CI admission, supported runtime,
and provenance-enabled publish command.

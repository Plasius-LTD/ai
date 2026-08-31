import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const ciWorkflow = fs.readFileSync(
  path.join(projectRoot, ".github/workflows/ci.yml"),
  "utf8"
);
const cdWorkflow = fs.readFileSync(
  path.join(projectRoot, ".github/workflows/cd.yml"),
  "utf8"
);
const selfHostedWorkflow = fs.readFileSync(
  path.join(projectRoot, ".github/workflows/ci-self-hosted.yml"),
  "utf8"
);
describe("public release readiness workflow contracts", () => {
  it("admits same-repository pull requests through the approved reusable workflow", () => {
    expect(ciWorkflow).toContain("pull_request:\n    branches: [main]");
    expect(ciWorkflow).toContain("workflow_dispatch:");
    expect(ciWorkflow).toContain(
      "self-hosted-validation:\n    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}\n    uses: ./.github/workflows/ci-self-hosted.yml"
    );
    expect(selfHostedWorkflow).toContain("on:\n  workflow_call:");
    expect(selfHostedWorkflow).toContain(
      "uses: codecov/codecov-action@b9fd7d16f6d7d1b5d2bec1a2887e65ceed900238"
    );
    expect(selfHostedWorkflow).toContain("build-test:\n    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}");
    expect(selfHostedWorkflow).toContain("public_artifact_integrity:\n    name: Public artifact integrity\n    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}");
    expect(selfHostedWorkflow.match(/runs-on: ubuntu-latest/gu)).toHaveLength(2);
    expect(ciWorkflow).not.toContain("runs-on:");
    expect(ciWorkflow).not.toContain("pull_request_target");
    expect(selfHostedWorkflow).not.toContain("pull_request_target");
    expect(selfHostedWorkflow).not.toMatch(/runs-on:\s*\$\{\{/u);
  });
  it("publishes only after exact-SHA CI and through npm OIDC", () => {
    expect(cdWorkflow).toContain("validate_and_pack:");
    expect(cdWorkflow).toContain("Enforce exact-main successful CI");
    expect(cdWorkflow).toContain('-f head_sha="${EXPECTED_SHA}"');
    expect(cdWorkflow).toContain("publish:\n    if: inputs.phase == 'publish'");
    expect(cdWorkflow).toContain("needs: validate_and_pack");
    expect(cdWorkflow).toContain(
      "uses: codecov/codecov-action@b9fd7d16f6d7d1b5d2bec1a2887e65ceed900238"
    );
    expect(cdWorkflow).toContain("id-token: write");
    expect(cdWorkflow).toContain("Install pinned npm release client");
    expect(cdWorkflow).toContain('npm publish "./${TARBALL}" --ignore-scripts');
    expect(cdWorkflow).not.toContain("NPM_TOKEN");
    expect(cdWorkflow).not.toContain("NODE_AUTH_TOKEN");
  });
});

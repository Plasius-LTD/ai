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
const workflowRepository = ["Plasius", "LTD/ai"].join("-");

describe("public release readiness workflow contracts", () => {
  it("admits same-repository pull requests through the approved reusable workflow", () => {
    expect(ciWorkflow).toContain("pull_request:\n    branches: [main]");
    expect(ciWorkflow).toContain("workflow_dispatch:");
    expect(ciWorkflow).toContain(
      "self-hosted-validation:\n    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}\n    uses: " +
        workflowRepository +
        "/.github/workflows/ci-self-hosted.yml@main"
    );
    expect(selfHostedWorkflow).toContain("on:\n  workflow_call:");
    expect(selfHostedWorkflow).toContain(
      "uses: codecov/codecov-action@b9fd7d16f6d7d1b5d2bec1a2887e65ceed900238"
    );
    expect(selfHostedWorkflow).toContain("build-test:\n    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}");
    expect(selfHostedWorkflow).toContain("public_artifact_integrity:\n    name: Public artifact integrity\n    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}");
    expect(selfHostedWorkflow.match(
      /runs-on:\n {6}group: Public CI - Quarantined\n {6}labels: \[self-hosted, Linux, X64\]/gu
    )).toHaveLength(2);
    expect(ciWorkflow).not.toContain("runs-on:");
    expect(ciWorkflow).not.toContain("pull_request_target");
    expect(selfHostedWorkflow).not.toContain("pull_request_target");
    expect(selfHostedWorkflow).not.toMatch(/runs-on:\s*\$\{\{/u);
  });
  it("publishes only after exact-SHA CI and through npm OIDC", () => {
    expect(cdWorkflow).toContain("verify_ci:");
    expect(cdWorkflow).toContain("--workflow ci.yml");
    expect(cdWorkflow).toContain(
      "gh workflow run ci.yml --repo \"${GITHUB_REPOSITORY}\" --ref \"${GITHUB_REF_NAME}\""
    );
    expect(cdWorkflow).toContain(
      'select(.event == "push" or .event == "workflow_dispatch")'
    );
    expect(cdWorkflow).toContain("--commit \"${COMMIT_SHA}\"");
    expect(cdWorkflow).toContain(
      "COMMIT_SHA: ${{ needs.prepare_release.outputs.commit_sha }}"
    );
    expect(cdWorkflow).toContain("publish:\n    needs: [prepare_release, verify_ci]");
    expect(cdWorkflow).toContain(
      "uses: codecov/codecov-action@b9fd7d16f6d7d1b5d2bec1a2887e65ceed900238"
    );
    expect(cdWorkflow).toContain("id-token: write");
    expect(cdWorkflow).toContain("ACTIONS_ID_TOKEN_REQUEST_URL");
    expect(cdWorkflow).toContain("npm publish ${FLAGS} --provenance");
    expect(cdWorkflow).not.toContain("NPM_TOKEN");
    expect(cdWorkflow).not.toContain("NODE_AUTH_TOKEN");
  });
});

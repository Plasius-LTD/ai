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

describe("public release readiness workflow contracts", () => {
  it("admits the artifact gate on same-repository pull requests only", () => {
    expect(ciWorkflow).toContain("pull_request:\n    branches: [main]");
    expect(ciWorkflow).toContain(
      "build-test:\n    if: \${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}"
    );
    expect(ciWorkflow).toContain(
      "public_artifact_integrity:\n    name: Public artifact integrity\n    if: \${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}"
    );
    expect(ciWorkflow.match(
      /runs-on:\n      group: Public CI - Quarantined\n      labels: \[self-hosted, Linux, X64\]/gu
    )).toHaveLength(2);
    expect(ciWorkflow).not.toContain("pull_request_target");
    expect(ciWorkflow).not.toMatch(/runs-on:\s*\$\{\{/u);
  });

  it("publishes only after exact-SHA CI and through npm OIDC", () => {
    expect(cdWorkflow).toContain("verify_ci:");
    expect(cdWorkflow).toContain("--workflow ci.yml");
    expect(cdWorkflow).toContain("--commit \"\${COMMIT_SHA}\"");
    expect(cdWorkflow).toContain(
      "COMMIT_SHA: \${{ needs.prepare_release.outputs.commit_sha }}"
    );
    expect(cdWorkflow).toContain("publish:\n    needs: [prepare_release, verify_ci]");
    expect(cdWorkflow).toContain("id-token: write");
    expect(cdWorkflow).toContain("ACTIONS_ID_TOKEN_REQUEST_URL");
    expect(cdWorkflow).toContain("npm publish \${FLAGS} --provenance");
    expect(cdWorkflow).not.toContain("NPM_TOKEN");
    expect(cdWorkflow).not.toContain("NODE_AUTH_TOKEN");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/cd.yml", import.meta.url), "utf8");

describe("npm release workflow", () => {
  it("uses OIDC trusted publishing without legacy npm write-token auth", () => {
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("runs-on: ubuntu-latest");
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain('npm publish "./${TARBALL}" --ignore-scripts');
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).not.toContain("NODE_AUTH_TOKEN");
    expect(workflow).not.toContain("registry-url:");
  });

  it("admits only the prepared main commit after exact successful push CI", () => {
    expect(workflow).toContain("Enforce exact-main successful CI");
    expect(workflow).toContain("needs.prepare_release.outputs.commit_sha");
    expect(workflow).toContain("refs/remotes/origin/main");
    expect(workflow).toContain("-f branch=main");
    expect(workflow).toContain("-f event=push");
    expect(workflow).toContain('-f head_sha="${EXPECTED_SHA}"');
    expect(workflow).toContain('conclusion == "success"');
  });

  it("fails closed when the release runtime cannot use npm OIDC", () => {
    expect(workflow).toContain("Verify release runtime");
    expect(workflow).toContain('ACTUAL_NODE%%.*');
    expect(workflow).toContain('"11.5.1"');
    expect(workflow).toContain("--provenance");
  });
});

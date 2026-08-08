import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(new URL("../.github/workflows/cd.yml", import.meta.url), "utf8");

describe("npm release workflow", () => {
  it("uses OIDC trusted publishing without legacy npm write-token auth", () => {
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("runs-on: ubuntu-latest");
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("npm publish ${FLAGS} --provenance --registry https://registry.npmjs.org");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).not.toContain("NODE_AUTH_TOKEN");
    expect(workflow).not.toContain("registry-url:");
  });
});

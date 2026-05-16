import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = path.resolve(projectRoot, "src");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function collectZeroByteSourceFiles(root: string): string[] {
  const zeroByteFiles: string[] = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      zeroByteFiles.push(...collectZeroByteSourceFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!sourceExtensions.has(path.extname(entry.name))) {
      continue;
    }

    if (fs.statSync(fullPath).size === 0) {
      zeroByteFiles.push(path.relative(projectRoot, fullPath));
    }
  }

  return zeroByteFiles.sort();
}

describe("@plasius/ai published source surface", () => {
  it("does not keep zero-byte source scaffolds under src", () => {
    expect(collectZeroByteSourceFiles(sourceRoot)).toEqual([]);
  });
});

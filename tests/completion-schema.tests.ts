import { describe, expect, it } from "vitest";

import { completionSchema } from "../src/index.js";

describe("completionSchema serialization", () => {
  const completion = {
    id: "completion-1",
    type: "chat",
    model: "gpt-4.1-mini",
    durationMs: 42,
    createdAt: "2026-03-09T12:00:00.000Z",
    partitionKey: "user-123",
    usage: { tokens: 128 },
  };

  it("omits partitionKey from default public serialization", () => {
    expect(completionSchema.serialize(completion)).toEqual({
      id: "completion-1",
      type: "chat",
      model: "gpt-4.1-mini",
      durationMs: 42,
      createdAt: "2026-03-09T12:00:00.000Z",
      usage: { tokens: 128 },
    });
  });

  it("can include internal fields when explicitly requested", () => {
    expect(
      completionSchema.serialize(completion, {
        includeInternal: true,
      })
    ).toEqual(completion);
  });
});

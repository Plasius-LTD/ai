import { describe, expect, it } from "vitest";

import {
  AI_AGENTIC_FOUNDATION_ROLLOUT,
  AI_FEATURE_FLAGS,
  createAIRequestEnvelope,
  createAITaskKind,
  isAITaskKind,
  isAgenticFoundationEnabled,
  resolveAIRolloutDecision,
} from "../src/index.js";

describe("agentic foundation contracts", () => {
  it("exports the canonical foundation feature flag key", () => {
    expect(AI_FEATURE_FLAGS.agenticFoundation).toBe(
      "ai.agentic.foundation.enabled"
    );
  });

  it("creates dot-delimited task kinds", () => {
    expect(
      createAITaskKind({
        domain: "game",
        action: "npc-dialogue",
        variant: "near-cache",
      })
    ).toBe("game.npc-dialogue.near-cache");
  });

  it("rejects invalid task kind segments", () => {
    expect(() =>
      createAITaskKind({
        domain: "game",
        action: "NPC Dialogue",
      })
    ).toThrow(/Task kind action/);
  });

  it("recognizes valid task kinds", () => {
    expect(isAITaskKind("routing.select")).toBe(true);
    expect(isAITaskKind("routing select")).toBe(false);
  });

  it("resolves rollout state from a remote snapshot", () => {
    expect(
      resolveAIRolloutDecision(AI_AGENTIC_FOUNDATION_ROLLOUT, {
        [AI_FEATURE_FLAGS.agenticFoundation]: true,
      })
    ).toMatchObject({
      enabled: true,
      source: "snapshot",
    });
  });

  it("fails closed when the foundation flag is missing", () => {
    expect(
      resolveAIRolloutDecision(AI_AGENTIC_FOUNDATION_ROLLOUT, {})
    ).toMatchObject({
      enabled: false,
      source: "default",
    });
    expect(isAgenticFoundationEnabled({})).toBe(false);
  });

  it("creates request envelopes with safe defaults", () => {
    expect(
      createAIRequestEnvelope({
        requestId: "req-1",
        createdAt: "2026-05-13T09:30:00.000Z",
        taskKind: {
          domain: "routing",
          action: "select",
        },
        actor: {
          actorId: "user-1",
          actorType: "user",
        },
        input: {
          prompt: "Choose the cheapest safe model.",
        },
      })
    ).toEqual({
      requestId: "req-1",
      createdAt: "2026-05-13T09:30:00.000Z",
      taskKind: "routing.select",
      actor: {
        actorId: "user-1",
        actorType: "user",
      },
      input: {
        prompt: "Choose the cheapest safe model.",
      },
      context: undefined,
      metadata: undefined,
      rollout: AI_AGENTIC_FOUNDATION_ROLLOUT,
      policy: {
        riskTier: "low",
        dataClassification: "internal",
        budget: undefined,
        allowProviderIds: undefined,
        denyProviderIds: undefined,
      },
    });
  });

  it("rejects envelopes with blank actor ids", () => {
    expect(() =>
      createAIRequestEnvelope({
        requestId: "req-2",
        taskKind: "routing.select",
        actor: {
          actorId: "   ",
          actorType: "service",
        },
        input: {},
      })
    ).toThrow(/Actor id/);
  });
});

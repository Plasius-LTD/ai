import {
  ChatbotApiError,
  chatWithAI,
  getChatbotUsage,
  type ChatWithAIClientOptions,
} from "../src/lib/chatWithAI.js";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("@plasius/ai chatWithAI", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { cookie: "" },
    });
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).document;
  });

  it("sends a chatbot request and attaches CSRF header after bootstrap", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => {
        (globalThis as { document: { cookie: string } }).document.cookie =
          "csrf-token=csrf123";
        return jsonResponse({ usage: { limit: 10, used: 0, remaining: 10, exhausted: false } });
      })
      .mockResolvedValueOnce(
        jsonResponse({
          reply: "Hello from AI",
          model: "gpt-4o-mini",
          usage: { limit: 10, used: 1, remaining: 9, exhausted: false },
        })
      );

    const result = await chatWithAI(
      { message: "hello" },
      { fetchFn: fetchMock } satisfies ChatWithAIClientOptions
    );

    expect(result.reply).toBe("Hello from AI");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, postInit] = fetchMock.mock.calls[1] ?? [];
    const postHeaders = postInit?.headers as Record<string, string>;
    expect(postHeaders["x-csrf-token"]).toBe("csrf123");
  });

  it("returns usage for authenticated users", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({
          usage: { limit: 10, used: 4, remaining: 6, exhausted: false },
        })
      );

    const result = await getChatbotUsage({ fetchFn: fetchMock });
    expect(result.usage.used).toBe(4);
    expect(result.usage.remaining).toBe(6);
  });

  it("throws a typed error when API returns non-2xx", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => {
        (globalThis as { document: { cookie: string } }).document.cookie =
          "csrf-token=csrf123";
        return jsonResponse({ usage: { limit: 10, used: 10, remaining: 0, exhausted: true } });
      })
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: "CHATBOT_LIMIT_REACHED",
            message: "Message limit reached.",
            usage: { limit: 10, used: 10, remaining: 0, exhausted: true },
          },
          429
        )
      );

    await expect(chatWithAI({ message: "hello" }, { fetchFn: fetchMock })).rejects.toMatchObject<
      Partial<ChatbotApiError>
    >({
      name: "ChatbotApiError",
      status: 429,
      code: "CHATBOT_LIMIT_REACHED",
    });
  });
});

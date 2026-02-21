export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatWithAIRequest {
  message: string;
  history?: ChatMessage[];
  systemPrompt?: string;
}

export interface ChatbotUsage {
  limit: number;
  used: number;
  remaining: number;
  exhausted: boolean;
}

export interface ChatbotResponse {
  reply: string;
  model: string;
  usage: ChatbotUsage;
}

export interface ChatbotUsageResponse {
  usage: ChatbotUsage;
}

export interface ChatWithAIClientOptions {
  endpoint?: string;
  credentials?: RequestCredentials;
  fetchFn?: typeof fetch;
  authHeaders?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  csrfCookieName?: string;
  csrfHeaderName?: string;
  bootstrapCsrf?: boolean;
}

interface ErrorBody {
  error?: string;
  message?: string;
  usage?: ChatbotUsage;
}

const DEFAULT_ENDPOINT = "/ai/chatbot";
const DEFAULT_CSRF_COOKIE_NAME = "csrf-token";
const DEFAULT_CSRF_HEADER_NAME = "x-csrf-token";

export class ChatbotApiError extends Error {
  status: number;
  code?: string;
  usage?: ChatbotUsage;

  constructor(status: number, message: string, code?: string, usage?: ChatbotUsage) {
    super(message);
    this.name = "ChatbotApiError";
    this.status = status;
    this.code = code;
    this.usage = usage;
  }
}

function resolveFetch(fetchFn?: typeof fetch): typeof fetch {
  const resolved = fetchFn ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (!resolved) {
    throw new Error("No fetch implementation available for chatWithAI.");
  }
  return resolved;
}

async function resolveAuthHeaders(
  authHeaders?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>)
): Promise<HeadersInit | undefined> {
  if (!authHeaders) return undefined;
  if (typeof authHeaders === "function") {
    return await authHeaders();
  }
  return authHeaders;
}

function readCookie(cookieName: string): string | undefined {
  if (typeof document === "undefined" || typeof document.cookie !== "string") {
    return undefined;
  }

  const entries = document.cookie.split(";").map((part) => part.trim());
  const match = entries.find((entry) => entry.startsWith(`${cookieName}=`));
  if (!match) return undefined;

  const [, value = ""] = match.split("=");
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return await response.json();
  }

  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function ensureCsrfToken(
  fetcher: typeof fetch,
  endpoint: string,
  options: ChatWithAIClientOptions,
  headers: HeadersInit
): Promise<string | undefined> {
  const csrfCookieName = options.csrfCookieName ?? DEFAULT_CSRF_COOKIE_NAME;
  const existingToken = readCookie(csrfCookieName);
  if (existingToken || options.bootstrapCsrf === false) {
    return existingToken;
  }

  await fetcher(endpoint, {
    method: "GET",
    credentials: options.credentials ?? "include",
    headers,
  });

  return readCookie(csrfCookieName);
}

function normalizeError(status: number, body: unknown): ChatbotApiError {
  const payload = body && typeof body === "object" ? (body as ErrorBody) : undefined;
  const message =
    payload?.message ||
    (status === 401
      ? "You must be signed in to use chatbot."
      : "Chatbot request failed.");

  return new ChatbotApiError(status, message, payload?.error, payload?.usage);
}

function buildUsage(payload: unknown): ChatbotUsage | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const maybe = payload as Record<string, unknown>;
  const limit = maybe.limit;
  const used = maybe.used;
  const remaining = maybe.remaining;
  const exhausted = maybe.exhausted;

  if (
    typeof limit !== "number" ||
    typeof used !== "number" ||
    typeof remaining !== "number" ||
    typeof exhausted !== "boolean"
  ) {
    return undefined;
  }

  return { limit, used, remaining, exhausted };
}

function mapToChatbotResponse(body: unknown): ChatbotResponse {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid chatbot response payload.");
  }

  const payload = body as Record<string, unknown>;
  const reply = payload.reply;
  const model = payload.model;
  const usage = buildUsage(payload.usage);

  if (typeof reply !== "string" || typeof model !== "string" || !usage) {
    throw new Error("Invalid chatbot response payload.");
  }

  return { reply, model, usage };
}

function mapToChatbotUsageResponse(body: unknown): ChatbotUsageResponse {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid chatbot usage payload.");
  }

  const payload = body as Record<string, unknown>;
  const usage = buildUsage(payload.usage);
  if (!usage) {
    throw new Error("Invalid chatbot usage payload.");
  }

  return { usage };
}

export async function getChatbotUsage(
  options: ChatWithAIClientOptions = {}
): Promise<ChatbotUsageResponse> {
  const fetcher = resolveFetch(options.fetchFn);
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const authHeaders = await resolveAuthHeaders(options.authHeaders);
  const response = await fetcher(endpoint, {
    method: "GET",
    credentials: options.credentials ?? "include",
    headers: {
      Accept: "application/json",
      ...(authHeaders ?? {}),
    },
  });

  const body = await parseResponseBody(response);
  if (!response.ok) {
    throw normalizeError(response.status, body);
  }

  return mapToChatbotUsageResponse(body);
}

export async function chatWithAI(
  request: ChatWithAIRequest,
  options: ChatWithAIClientOptions = {}
): Promise<ChatbotResponse> {
  const fetcher = resolveFetch(options.fetchFn);
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const authHeaders = await resolveAuthHeaders(options.authHeaders);
  const baseHeaders: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(authHeaders ?? {}),
  };

  const csrfToken = await ensureCsrfToken(fetcher, endpoint, options, baseHeaders);
  const csrfHeaderName = options.csrfHeaderName ?? DEFAULT_CSRF_HEADER_NAME;
  const headers = csrfToken
    ? {
        ...baseHeaders,
        [csrfHeaderName]: csrfToken,
      }
    : baseHeaders;

  const response = await fetcher(endpoint, {
    method: "POST",
    credentials: options.credentials ?? "include",
    headers,
    body: JSON.stringify({
      message: request.message,
      history: request.history ?? [],
      systemPrompt: request.systemPrompt,
    }),
  });

  const body = await parseResponseBody(response);
  if (!response.ok) {
    throw normalizeError(response.status, body);
  }

  return mapToChatbotResponse(body);
}

export interface HttpClientPolicy {
  maxAttempts?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  respectRetryAfter?: boolean;
  retryableMethods?: string[];
  retryableStatusCodes?: number[];
}

export interface FetchWithPolicyOptions {
  url: string;
  operation: string;
  fetchFn: typeof fetch;
  policy?: HttpClientPolicy;
  createRequestInit: () => RequestInit | Promise<RequestInit>;
}

const DEFAULT_RETRYABLE_STATUS_CODES = [408, 409, 425, 429, 500, 502, 503, 504];
const DEFAULT_RETRYABLE_METHODS = ["GET", "HEAD", "OPTIONS", "PUT", "DELETE", "POST"];

function normalizePolicy(policy: HttpClientPolicy | undefined): Required<HttpClientPolicy> {
  return {
    maxAttempts: Math.max(1, policy?.maxAttempts ?? 3),
    timeoutMs: Math.max(1, policy?.timeoutMs ?? 30_000),
    baseDelayMs: Math.max(0, policy?.baseDelayMs ?? 250),
    maxDelayMs: Math.max(0, policy?.maxDelayMs ?? 4_000),
    jitterRatio: Math.max(0, policy?.jitterRatio ?? 0.2),
    respectRetryAfter: policy?.respectRetryAfter ?? true,
    retryableMethods:
      policy?.retryableMethods?.map((method) => method.toUpperCase()) ??
      DEFAULT_RETRYABLE_METHODS,
    retryableStatusCodes: policy?.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS_CODES,
  };
}

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) {
    return undefined;
  }

  const asNumber = Number(header);
  if (Number.isFinite(asNumber)) {
    return Math.max(0, Math.round(asNumber * 1000));
  }

  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now());
  }

  return undefined;
}

function computeBackoffDelayMs(
  retryIndex: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterRatio: number
): number {
  const exponent = Math.max(0, retryIndex - 1);
  const cappedExponential = Math.min(maxDelayMs, baseDelayMs * 2 ** exponent);
  if (cappedExponential === 0) {
    return 0;
  }

  const jitter = cappedExponential * jitterRatio * Math.random();
  return Math.round(cappedExponential + jitter);
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isRetryableError(error: unknown): boolean {
  return error instanceof TypeError || isAbortError(error);
}

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const externalSignal = init.signal ?? null;
  if (externalSignal?.aborted) {
    throw externalSignal.reason;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms.`));
  }, timeoutMs);

  const abortRelay = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    externalSignal.addEventListener("abort", abortRelay, { once: true });
  }

  try {
    return await fetchFn(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", abortRelay);
    }
  }
}

export async function fetchWithPolicy(options: FetchWithPolicyOptions): Promise<Response> {
  const policy = normalizePolicy(options.policy);
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    const requestInit = await options.createRequestInit();
    const method = (requestInit.method ?? "GET").toUpperCase();

    try {
      const response = await fetchWithTimeout(
        options.fetchFn,
        options.url,
        requestInit,
        policy.timeoutMs
      );

      if (response.ok || attempt >= policy.maxAttempts) {
        return response;
      }

      const canRetryMethod = policy.retryableMethods.includes(method);
      const canRetryStatus = policy.retryableStatusCodes.includes(response.status);
      if (!canRetryMethod || !canRetryStatus) {
        return response;
      }

      const retryAfterMs = policy.respectRetryAfter
        ? parseRetryAfterMs(response.headers.get("retry-after"))
        : undefined;
      const backoffMs = computeBackoffDelayMs(
        attempt,
        policy.baseDelayMs,
        policy.maxDelayMs,
        policy.jitterRatio
      );
      const delayMs = Math.max(retryAfterMs ?? 0, backoffMs);

      try {
        await response.body?.cancel();
      } catch {
        // Ignore cancellation errors and continue retry flow.
      }

      await sleep(delayMs);
      continue;
    } catch (error) {
      lastError = error;

      const canRetryMethod = policy.retryableMethods.includes(method);
      const externalAborted = requestInit.signal?.aborted ?? false;
      const shouldRetry =
        attempt < policy.maxAttempts &&
        canRetryMethod &&
        !externalAborted &&
        isRetryableError(error);

      if (!shouldRetry) {
        throw error;
      }

      const delayMs = computeBackoffDelayMs(
        attempt,
        policy.baseDelayMs,
        policy.maxDelayMs,
        policy.jitterRatio
      );
      await sleep(delayMs);
    }
  }

  throw (
    lastError ??
    new Error(`${options.operation} failed without a recoverable response.`)
  );
}

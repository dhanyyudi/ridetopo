export interface AbortableRequestResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
  /** HTTP status, when the request reached the server at all. */
  status?: number;
  /** Provider-specific failure code parsed from the error body. */
  code?: number | string;
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

export async function abortableFetch<T>(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<AbortableRequestResult<T>> {
  try {
    const response = await fetch(url, { ...init, signal: signal ?? null });
    if (!response.ok) {
      /* Keep the provider's own reason. Without it a 400 is indistinguishable
         from any other 400, and the cause cannot be diagnosed from a report.
         It never reaches the UI — callers map it to their own copy. */
      const detail = await readErrorDetail(response);
      return {
        ok: false,
        data: null,
        error: detail.message ?? `HTTP ${response.status}`,
        status: response.status,
        ...(detail.code === undefined ? {} : { code: detail.code }),
      };
    }
    const data = (await response.json()) as T;
    return { ok: true, data, error: null };
  } catch (err: unknown) {
    if (isAbortError(err)) {
      throw new DOMException("Request dibatalkan.", "AbortError");
    }
    return {
      ok: false,
      data: null,
      error: "Network error",
    };
  }
}

interface ErrorDetail {
  message: string | null;
  code?: number | string;
}

async function readErrorDetail(response: Response): Promise<ErrorDetail> {
  try {
    const body: unknown = await response.clone().json();
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      const code =
        typeof record.error_code === "number" || typeof record.error_code === "string"
          ? record.error_code
          : undefined;
      const message = typeof record.error === "string" ? record.error : null;
      return {
        message: message ? `HTTP ${response.status}: ${message}` : `HTTP ${response.status}`,
        ...(code === undefined ? {} : { code }),
      };
    }
  } catch {
    /* Not JSON, or already consumed — the status alone will have to do. */
  }
  return { message: `HTTP ${response.status}` };
}

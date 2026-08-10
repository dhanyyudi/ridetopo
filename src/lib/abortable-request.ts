export interface AbortableRequestResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

export async function abortableFetch<T>(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<AbortableRequestResult<T>> {
  try {
    const response = await fetch(url, { ...init, signal: signal ?? null });
    if (!response.ok) {
      return { ok: false, data: null, error: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as T;
    return { ok: true, data, error: null };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, data: null, error: "aborted" };
    }
    return {
      ok: false,
      data: null,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

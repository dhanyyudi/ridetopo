import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createNominatimProvider } from "../../src/providers/geocoding/nominatim-provider";
import { setRuntimeConfig } from "../../src/config/runtime-config";

const RESULTS = [
  {
    place_id: 101,
    display_name: "Monumen Nasional, Jakarta Pusat, Jakarta, Indonesia",
    lat: "-6.1754",
    lon: "106.8272",
    category: "tourism",
  },
];

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe("public Nominatim provider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    setRuntimeConfig({
      version: 1,
      valhallaBaseUrl: "https://valhalla.example",
      nominatimBaseUrl: "https://nominatim.example",
      basemapStyleUrl: "https://tiles.example/style",
      geocodingEnabled: true,
    });
    fetchMock = vi.fn(async () => jsonResponse(RESULTS));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("requests Indonesia only, five results, submitted query", async () => {
    const provider = createNominatimProvider();
    await provider.search("Monas", new AbortController().signal);

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("countrycodes=id");
    expect(url).toContain("limit=5");
    expect(url).toContain("accept-language=id");
    expect(url).toContain("q=Monas");
  });

  it("does not set a User-Agent header the browser would drop anyway", async () => {
    const provider = createNominatimProvider();
    await provider.search("Monas", new AbortController().signal);

    const init = fetchMock.mock.calls[0]![1] as RequestInit | undefined;
    expect(init?.headers).toBeUndefined();
  });

  it("serves an identical query from the session cache", async () => {
    const provider = createNominatimProvider();
    const first = await provider.search("Monas", new AbortController().signal);
    const second = await provider.search("  monas  ", new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("keeps two searches in the same second one second apart", async () => {
    const provider = createNominatimProvider();
    const first = provider.search("Monas", new AbortController().signal);
    const second = provider.search("Kota Tua", new AbortController().signal);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await first;
    await second;
  });

  it("normalizes into domain results without leaking raw fields", async () => {
    const provider = createNominatimProvider();
    const results = await provider.search("Monas", new AbortController().signal);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: "101",
      label: "Monumen Nasional, Jakarta Pusat, Jakarta, Indonesia",
      position: [106.8272, -6.1754],
      category: "tourism",
    });
    expect(Object.keys(results[0]!)).not.toContain("place_id");
  });

  it("returns nothing at all when the kill switch is off", async () => {
    setRuntimeConfig({
      version: 1,
      valhallaBaseUrl: "https://valhalla.example",
      nominatimBaseUrl: "https://nominatim.example",
      basemapStyleUrl: "https://tiles.example/style",
      geocodingEnabled: false,
    });

    const provider = createNominatimProvider();
    expect(await provider.search("Monas", new AbortController().signal)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

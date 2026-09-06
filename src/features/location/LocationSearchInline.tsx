import { useState, useRef, useCallback, useEffect } from "react";
import { COPY } from "@/content/id";
import type { GeocodingResult } from "@/providers/contracts";
import { Search } from "lucide-react";

interface Props {
  /** Ties the field to its visible label — "Titik mulai", "Tujuan", … */
  labelId: string;
  /** The name already chosen for this point, shown until it is edited. */
  value: string;
  onSearch: (query: string, signal: AbortSignal) => Promise<readonly GeocodingResult[]>;
  onSelect: (result: GeocodingResult) => void;
  offline: boolean;
}

/**
 * Search for a place from inside the composer row.
 *
 * Nominatim is submit-only — one request a second, no autocomplete — so
 * typing never fires a request on its own. The rider types, presses Cari or
 * Enter, and the matches appear under the field rather than over the page:
 * a dialog here would cover the map, the other points, and the route it is
 * being added to.
 */
export function LocationSearchInline({ labelId, value, onSearch, onSelect, offline }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<readonly GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* A point set from the map or from GPS renames the field under us. */
  useEffect(() => {
    setQuery(value);
    setResults([]);
  }, [value]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const data = await onSearch(trimmed, controller.signal);
      setResults(data);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(COPY.errorSearch);
    } finally {
      setLoading(false);
    }
  }, [query, loading, onSearch]);

  if (offline) {
    return <p className="inline-error">{COPY.offlineSearchDisabled}</p>;
  }

  return (
    <div className="location-search">
      <div className="location-search-row">
        <Search size={16} aria-hidden="true" className="location-search-icon" />
        <input
          type="text"
          className="text-input location-search-input"
          value={query}
          placeholder={COPY.searchPlaceholder}
          aria-labelledby={labelId}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            /* Enter searches; it must not submit the surrounding form. */
            if (e.key !== "Enter") return;
            e.preventDefault();
            void runSearch();
          }}
        />
        <button
          type="button"
          className="btn btn-secondary location-search-submit"
          onClick={() => void runSearch()}
          disabled={loading || !query.trim()}
        >
          {loading ? COPY.loading : COPY.searchButton}
        </button>
      </div>

      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="location-search-results" role="listbox" aria-label="Hasil pencarian">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="search-result"
              role="option"
              aria-selected="false"
              onClick={() => {
                setResults([]);
                onSelect(r);
              }}
            >
              <span className="search-result-name">{r.label.split(",")[0]}</span>
              <span className="search-result-detail">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

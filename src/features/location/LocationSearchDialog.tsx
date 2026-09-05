import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { COPY } from "@/content/id";
import { useFocusTrap } from "@/lib/use-focus-trap";
import type { GeocodingResult } from "@/providers/contracts";
import { Search, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (result: GeocodingResult) => void;
  onSearch: (query: string, signal: AbortSignal) => Promise<readonly GeocodingResult[]>;
  offline: boolean;
}

export function LocationSearchDialog({ open, onClose, onSelect, onSearch, offline }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setError(null);
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    abortRef.current?.abort();
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
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
    },
    [query, loading, onSearch],
  );

  if (!open) return null;

  return createPortal(
    <div
      className="dialog-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="dialog-panel search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={COPY.searchButton}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 className="dialog-title">{COPY.searchButton}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {offline ? (
          <p className="inline-error">{COPY.offlineSearchDisabled}</p>
        ) : (
          <form onSubmit={handleSubmit} className="search-form">
            <div className="search-input-row">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={COPY.searchPlaceholder}
                className="text-input"
                aria-label={COPY.searchPlaceholder}
              />
              <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()}>
                <Search size={16} aria-hidden="true" />
                {loading ? COPY.loading : COPY.searchButton}
              </button>
            </div>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </form>
        )}

        <div className="search-results" role="listbox" aria-label="Hasil pencarian">
          {results.length === 0 && !loading && !error && !offline && (
            <p className="dialog-hint">{COPY.searchHint}</p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="search-result"
              role="option"
              aria-selected="false"
              onClick={() => onSelect(r)}
            >
              <span className="search-result-name">{r.label.split(",")[0]}</span>
              <span className="search-result-detail">{r.label}</span>
            </button>
          ))}
        </div>

        <p className="attribution-line">Data © OpenStreetMap contributors</p>
      </div>
    </div>,
    document.body,
  );
}

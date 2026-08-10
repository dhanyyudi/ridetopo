import { useState, useEffect, useCallback, useRef } from "react";
import { COPY } from "@/content/id";
import type { GeocodingResult } from "@/providers/contracts";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (result: GeocodingResult) => void;
  onSearch: (query: string) => Promise<readonly GeocodingResult[]>;
}

export function LocationSearchDialog({ open, onClose, onSelect, onSearch }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const data = await onSearch(query.trim());
        setResults(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Pencarian gagal");
      } finally {
        setLoading(false);
      }
    },
    [query, onSearch],
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-white)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          width: "100%",
          maxWidth: "480px",
          maxHeight: "70dvh",
          display: "flex",
          flexDirection: "column",
          padding: "var(--space-4)",
          gap: "var(--space-3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem" }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={COPY.searchPlaceholder}
            className="text-input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? COPY.loading : COPY.searchButton}
          </button>
        </form>

        {error && (
          <p style={{ color: "var(--color-error)", fontSize: "var(--text-sm)" }}>{error}</p>
        )}

        <div style={{ overflowY: "auto", flex: 1 }}>
          {results.length === 0 && !loading && !error && (
            <p style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-sm)", textAlign: "center", padding: "var(--space-6)" }}>
              Ketik nama lokasi dan tekan Cari
            </p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "0.75rem",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-sm)",
                cursor: "pointer",
                borderBottom: "1px solid var(--color-border-light)",
              }}
            >
              <div style={{ fontWeight: 600 }}>{r.label.split(",")[0]}</div>
              <div style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-xs)" }}>{r.label}</div>
            </button>
          ))}
        </div>

        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)", textAlign: "center" }}>
          Data © OpenStreetMap contributors
        </p>
      </div>
    </div>
  );
}

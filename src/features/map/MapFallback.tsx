import { COPY } from "@/content/id";

interface Props {
  message?: string;
}

export function MapFallback({ message }: Props) {
  return (
    <div className="map-fallback">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.4}>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5"/>
      </svg>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
        {message ?? COPY.errorBasemap}
      </p>
    </div>
  );
}

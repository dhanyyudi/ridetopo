import { COPY } from "@/content/id";

interface Props {
  onExportGpx: () => void;
  onShareImage: () => void;
  gpxAvailable: boolean;
  imageAvailable: boolean;
}

export function ExportActions({ onExportGpx, onShareImage, gpxAvailable, imageAvailable }: Props) {
  return (
    <div style={{ display: "flex", gap: "var(--space-2)" }}>
      <button
        onClick={onExportGpx}
        className="btn btn-secondary"
        disabled={!gpxAvailable}
        style={{ flex: 1 }}
      >
        {COPY.exportGpx}
      </button>
      <button
        onClick={onShareImage}
        className="btn btn-secondary"
        disabled={!imageAvailable}
        style={{ flex: 1 }}
      >
        {COPY.shareImage}
      </button>
    </div>
  );
}

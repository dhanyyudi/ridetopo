import { COPY } from "@/content/id";

interface Props {
  open: boolean;
  imageUrl: string | null;
  imageFilename: string;
  onClose: () => void;
  onShare: () => void;
  onDownload: () => void;
}

export function ImagePreviewDialog({ open, imageUrl, onClose, onShare, onDownload }: Props) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
      }}
      onClick={onClose}
    >
      <div
        style={{ maxWidth: "360px", width: "100%", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ color: "white", fontSize: "var(--text-sm)", textAlign: "center" }}>
          {COPY.imagePrivacyWarning}
        </p>

        {imageUrl && (
          <img
            src={imageUrl}
            alt="Pratinjau rute"
            style={{ width: "100%", borderRadius: "var(--radius-lg)" }}
          />
        )}

        <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "center" }}>
          <button onClick={onShare} className="btn btn-primary">
            {COPY.shareSheet}
          </button>
          <button onClick={onDownload} className="btn btn-secondary">
            {COPY.downloadImage}
          </button>
        </div>
      </div>
    </div>
  );
}

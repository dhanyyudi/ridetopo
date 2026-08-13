import { createPortal } from "react-dom";
import { COPY } from "@/content/id";
import { X, Share2, Download } from "lucide-react";

interface Props {
  open: boolean;
  imageUrl: string | null;
  onClose: () => void;
  onShare: () => void;
  onDownload: () => void;
}

export function ImagePreviewDialog({ open, imageUrl, onClose, onShare, onDownload }: Props) {
  if (!open) return null;

  return createPortal(
    <div className="image-preview-backdrop" role="presentation" onClick={onClose}>
      <div
        className="image-preview-panel"
        role="dialog"
        aria-modal="true"
        aria-label={COPY.imagePreview}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p className="image-preview-warning">{COPY.imagePrivacyWarning}</p>
          <button
            type="button"
            className="icon-btn"
            style={{ color: "var(--color-surface-raised)" }}
            onClick={onClose}
            aria-label="Tutup"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {imageUrl && (
          <img src={imageUrl} alt="Pratinjau gambar rute" className="image-preview-img" />
        )}

        <div className="image-preview-actions">
          <button type="button" className="btn btn-primary" onClick={onShare}>
            <Share2 size={16} aria-hidden="true" />
            {COPY.shareSheet}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onDownload}>
            <Download size={16} aria-hidden="true" />
            {COPY.downloadImage}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

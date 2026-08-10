interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (position: readonly [number, number]) => void;
}

export function MapPicker({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        background: "var(--color-surface)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "var(--space-4)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-white)", borderBottom: "1px solid var(--color-border)" }}>
        <button onClick={onClose} className="btn btn-ghost">Batal</button>
        <span style={{ fontWeight: 600 }}>Pilih di peta</span>
        <div style={{ width: "44px" }} />
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-tertiary)" }}>
        Ketuk peta untuk memilih lokasi
      </div>
    </div>
  );
}

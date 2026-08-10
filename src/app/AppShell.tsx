import { type ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import type { AppView } from "./app-view";

interface Props {
  view: AppView;
  onNavigate: (view: AppView) => void;
  offline: boolean;
  children: ReactNode;
}

export function AppShell({ view, onNavigate, offline, children }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        background: "var(--color-surface, #F7FAF9)",
      }}
    >
      <AppHeader view={view} onNavigate={onNavigate} />
      {offline && (
        <div
          role="status"
          style={{
            padding: "0.5rem 1rem",
            background: "var(--color-warning-light, #FFFBEB)",
            color: "var(--color-warning, #D97706)",
            fontSize: "var(--text-sm, 0.875rem)",
            textAlign: "center",
            fontWeight: 500,
          }}
        >
          Anda sedang offline. Rute tersimpan tetap dapat diakses.
        </div>
      )}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {children}
      </main>
    </div>
  );
}

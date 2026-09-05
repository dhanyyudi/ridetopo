import { useState, useRef, useEffect } from "react";
import { COPY } from "@/content/id";
import { AppHeader } from "./AppHeader";

interface Props {
  offline: boolean;
  onNavigate: (view: "composer" | "privacy" | "about") => void;
  activeView: string;
  children: React.ReactNode;
}

export function AppShell({ offline, onNavigate, activeView, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div className="app-shell">
      <AppHeader
        onNavigate={(view) => {
          setMenuOpen(false);
          onNavigate(view);
        }}
        activeView={activeView}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
        menuRef={menuRef}
      />
      {offline && (
        <div className="offline-banner" role="status">
          {COPY.offlineBanner} {COPY.offlineExportAvailable}
        </div>
      )}
      <main className="app-main">{children}</main>
    </div>
  );
}

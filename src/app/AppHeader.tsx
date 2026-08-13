import { COPY } from "@/content/id";
import { Menu, X } from "lucide-react";

interface Props {
  onNavigate: (view: "composer" | "privacy" | "about") => void;
  activeView: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

export function AppHeader({ onNavigate, activeView, menuOpen, onToggleMenu, menuRef }: Props) {
  return (
    <header className="app-header">
      <button
        type="button"
        className="header-brand"
        onClick={() => onNavigate("composer")}
        aria-label={`${COPY.appName} — ${COPY.navComposer}`}
      >
        <img src="/brand/logo-mark.svg" alt="" width={32} height={32} />
        <span className="header-wordmark">{COPY.appName}</span>
      </button>

      <div className="header-nav-wide">
        <button
          type="button"
          className={`header-link ${activeView === "privacy" ? "active" : ""}`}
          onClick={() => onNavigate("privacy")}
        >
          {COPY.navPrivacy}
        </button>
        <button
          type="button"
          className={`header-link ${activeView === "about" ? "active" : ""}`}
          onClick={() => onNavigate("about")}
        >
          {COPY.navAbout}
        </button>
      </div>

      <div className="header-nav-compact" ref={menuRef}>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleMenu}
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        {menuOpen && (
          <div className="header-menu">
            <button
              type="button"
              className="header-menu-item"
              onClick={() => onNavigate("privacy")}
            >
              {COPY.navPrivacy}
            </button>
            <button
              type="button"
              className="header-menu-item"
              onClick={() => onNavigate("about")}
            >
              {COPY.navAbout}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

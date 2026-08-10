import type { AppView } from "./app-view";
import { COPY } from "@/content/id";

interface Props {
  view: AppView;
  onNavigate: (view: AppView) => void;
}

export function AppHeader({ view, onNavigate }: Props) {
  const showNav =
    view === "privacy" || view === "about" || view === "composer";

  return (
    <header
      style={{
        height: "var(--header-height-compact, 56px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--space-4, 1rem)",
        background: "var(--color-white)",
        borderBottom: "1px solid var(--color-border, #DDE8E5)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      <h1
        style={{
          fontSize: "var(--text-lg, 1.125rem)",
          fontWeight: 700,
          color: "var(--color-primary, #0F766E)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <img
          src="/brand/logo-mark.svg"
          alt=""
          width="28"
          height="28"
          style={{ display: "block" }}
        />
        {COPY.appName}
      </h1>

      {showNav && (
        <nav style={{ display: "flex", gap: "0.25rem" }}>
          <button
            onClick={() => onNavigate("privacy")}
            style={{
              padding: "0.5rem 0.75rem",
              fontSize: "var(--text-sm, 0.875rem)",
              color: "var(--color-text-secondary)",
              borderRadius: "var(--radius-md, 0.5rem)",
              minHeight: "44px",
              minWidth: "44px",
            }}
          >
            {COPY.navPrivacy}
          </button>
          <button
            onClick={() => onNavigate("about")}
            style={{
              padding: "0.5rem 0.75rem",
              fontSize: "var(--text-sm, 0.875rem)",
              color: "var(--color-text-secondary)",
              borderRadius: "var(--radius-md, 0.5rem)",
              minHeight: "44px",
              minWidth: "44px",
            }}
          >
            {COPY.navAbout}
          </button>
        </nav>
      )}
    </header>
  );
}

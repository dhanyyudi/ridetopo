import { useState, useEffect, useCallback } from "react";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { AppShell } from "./AppShell";
import { loadRuntimeConfig } from "@/config/load-runtime-config";
import type { AppView } from "./app-view";
import { COPY } from "@/content/id";
import { RouteComposer } from "@/features/route/RouteComposer";
import "@/styles/global.css";
import "@/styles/components.css";
import "@/styles/map.css";

function PrivacyView({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ padding: "var(--space-6, 1.5rem)", maxWidth: "640px", margin: "0 auto", width: "100%" }}>
      <button onClick={onBack} className="btn btn-ghost" style={{ marginBottom: "1rem" }}>
        &larr; Kembali
      </button>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "1rem" }}>
        {COPY.privacyTitle}
      </h2>
      <p style={{ color: "var(--color-text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
        {COPY.privacyText}
      </p>
    </div>
  );
}

function AboutView({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ padding: "var(--space-6, 1.5rem)", maxWidth: "640px", margin: "0 auto", width: "100%" }}>
      <button onClick={onBack} className="btn btn-ghost" style={{ marginBottom: "1rem" }}>
        &larr; Kembali
      </button>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "1rem" }}>
        {COPY.aboutTitle}
      </h2>
      <p style={{ color: "var(--color-text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
        {COPY.aboutText}
      </p>
    </div>
  );
}

function ComposerView() {
  return <RouteComposer />;
}

export function App() {
  const [view, setView] = useState<AppView>("composer");
  const [configReady, setConfigReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    loadRuntimeConfig(controller.signal)
      .then(() => {
        if (!cancelled) {
          setConfigReady(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          setConfigError(err instanceof Error ? err.message : COPY.errorConfig);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const handleNavigate = useCallback((v: AppView) => {
    setView(v);
  }, []);

  if (configError) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        padding: "2rem",
        textAlign: "center",
        gap: "1rem",
      }}>
        <h1 style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--color-primary, #0F766E)",
        }}>
          {COPY.appName}
        </h1>
        <p style={{ color: "var(--color-error, #DC2626)" }}>{configError}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary"
        >
          Muat ulang
        </button>
      </div>
    );
  }

  if (!configReady) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        padding: "2rem",
        textAlign: "center",
        gap: "1rem",
      }}>
        <div className="loading-spinner" />
        <p style={{ color: "var(--color-text-secondary)" }}>
          {COPY.loading}
        </p>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <AppShell view={view} onNavigate={handleNavigate} offline={offline}>
        {view === "privacy" ? (
          <PrivacyView onBack={() => setView("composer")} />
        ) : view === "about" ? (
          <AboutView onBack={() => setView("composer")} />
        ) : (
          <ComposerView />
        )}
      </AppShell>
    </AppErrorBoundary>
  );
}

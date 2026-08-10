import { Component, type ErrorInfo, type ReactNode } from "react";
import { COPY } from "@/content/id";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AppErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100dvh",
            padding: "2rem",
            textAlign: "center",
            gap: "1rem",
          }}
        >
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--color-primary, #0F766E)",
            }}
          >
            {COPY.appName}
          </h1>
          <p style={{ color: "var(--color-text-secondary, #5E6F6D)" }}>
            {COPY.errorGeneric}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: "0.75rem 1.5rem",
              background: "var(--color-primary, #0F766E)",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              fontWeight: 600,
              cursor: "pointer",
              minHeight: "44px",
            }}
          >
            Coba lagi
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

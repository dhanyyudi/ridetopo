import { runtimeConfigSchema, type RuntimeConfig } from "./runtime-config-schema";
import { setRuntimeConfig } from "./runtime-config";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export async function loadRuntimeConfig(signal?: AbortSignal): Promise<RuntimeConfig> {
  const response = await fetch("/config.json", {
    signal: signal ?? null,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new ConfigError("Gagal memuat konfigurasi aplikasi.");
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ConfigError("Format konfigurasi tidak valid.");
  }

  const result = runtimeConfigSchema.safeParse(json);
  if (!result.success) {
    throw new ConfigError("Konfigurasi tidak lengkap atau tidak valid.");
  }

  const config = result.data;
  const isLocalhost = globalThis.location?.hostname === "localhost";

  if (!isLocalhost) {
    for (const value of Object.values(config)) {
      if (typeof value === "string" && value.startsWith("http://")) {
        throw new ConfigError("Konfigurasi produksi harus menggunakan HTTPS.");
      }
    }
  }

  setRuntimeConfig(config);
  return config;
}

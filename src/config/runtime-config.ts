import type { RuntimeConfig } from "./runtime-config-schema";

let cached: RuntimeConfig | null = null;

export function getRuntimeConfig(): RuntimeConfig | null {
  return cached;
}

export function setRuntimeConfig(config: RuntimeConfig): void {
  cached = config;
}

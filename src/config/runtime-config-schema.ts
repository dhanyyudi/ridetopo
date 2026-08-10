import { z } from "zod";

export const runtimeConfigSchema = z.object({
  version: z.literal(1),
  valhallaBaseUrl: z.string().url(),
  nominatimBaseUrl: z.string().url(),
  basemapStyleUrl: z.string().url(),
  geocodingEnabled: z.boolean(),
}).strict();

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

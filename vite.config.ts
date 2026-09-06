import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      /* "prompt" needs the app to ask the rider to reload, and nothing here
         ever did — so a new service worker installed and then waited forever
         while returning visitors kept getting the previous app shell from the
         precache. Three releases reached production without reaching anyone
         who had opened the site before. Updates now take over on their own. */
      registerType: "autoUpdate",
      includeAssets: ["brand/*.png", "brand/*.svg", "fonts/*.woff2", "fonts/OFL.txt", "_headers", "_redirects"],
      workbox: {
        /* Precache only versioned app-shell artifacts. Never precache
           /config.json, provider responses, or map tiles. */
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
        navigateFallback: "/index.html",
        /* Drop the previous build's precache instead of carrying it along. */
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            /* Runtime config and shell use network-first revalidation so an
               installed app can still boot offline from the last valid copy. */
            urlPattern: ({ url }) =>
              url.pathname === "/config.json" || url.pathname === "/",
            handler: "NetworkFirst",
            options: {
              cacheName: "ridetopo-runtime",
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
      manifest: {
        name: "RideTopo",
        short_name: "RideTopo",
        description: "Rencanakan rute sepeda Anda",
        theme_color: "#0F766E",
        background_color: "#F7FAF9",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/brand/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/brand/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/brand/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": "/src" },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: false,
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,ico,json}"],
        runtimeCaching: [],
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
    sourcemap: true,
  },
});

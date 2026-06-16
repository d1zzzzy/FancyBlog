import { defineConfig } from "vite";

// Monuments is a single-page static app. Markdown content is imported at
// build time via import.meta.glob, so no server runtime is needed.
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist",
  },
});

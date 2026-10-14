import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        // Protótipo isolado da vista 3D de jogadas (abre em /prototype-3d.html).
        prototype3d: resolve(__dirname, "prototype-3d.html"),
      },
    },
  },
});

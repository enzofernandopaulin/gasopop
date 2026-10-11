import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

const mobileShim = fileURLToPath(new URL("./src/mobile/tanstack-start.ts", import.meta.url));
const mobileServerShim = fileURLToPath(new URL("./src/mobile/tanstack-start-server.ts", import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react(), tsconfigPaths(), tailwindcss()],
  resolve: {
    alias: {
      "@tanstack/react-start/server": mobileServerShim,
      "@tanstack/react-start": mobileShim,
    },
  },
  build: {
    outDir: ".output/public-mobile",
    emptyOutDir: true,
    rollupOptions: {
      input: "mobile/index.html",
    },
  },
});

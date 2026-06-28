import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deployed to GitHub Pages at /genetic-algo-llm-testing/, built into ../docs.
export default defineConfig({
  base: "/genetic-algo-llm-testing/",
  plugins: [react()],
  build: { outDir: "../docs", emptyOutDir: true },
  server: { port: 5182 },
});

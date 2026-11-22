import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = "http://localhost:5000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      "/api": backend,
      "/uploads": backend,
      "/mcp": backend,
      "/graphql": { target: backend, ws: true },
    },
  },
});

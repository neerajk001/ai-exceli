import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Read .env from the repository root. Only VITE_* vars reach the browser.
  envDir: "../../",
  server: {
    port: 3000,
    strictPort: true,
  },
});

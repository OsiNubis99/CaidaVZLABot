import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Output goes to ./dist (default Vite location). The Dockerfile's
// stage-1 builder copies dist into the runtime image at
// /app/public/dashboard so Express serves it as static files. Relative
// `base` so the same build works under /dashboard, /caidavzlabot, or
// any other prefix nginx might proxy to.
//
// For pure local iteration, prefer `npm run dev` (Vite dev server on
// :5173) over `npm run build` — Express won't pick up dist/ unless
// you also copy it manually.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "./dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
});

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: "site",
  plugins: [tailwindcss()],
  build: { outDir: "../dist", emptyOutDir: true },
  // The page lives in site/, the tests next to the compiler.
  test: { root: "." },
});

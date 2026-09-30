import fs from "node:fs"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// Los chunks de manualChunks son entry points para Rollup: si listan un paquete que
// ya no está instalado, el build muere. Derivar la lista de package.json + node_modules
// evita que la lista se pudra y haya que recordarla a mano.
const pkg = JSON.parse(
  fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { dependencies?: Record<string, string> }
const radixInstalled = Object.keys(pkg.dependencies ?? {}).filter(
  (dep) =>
    dep.startsWith("@radix-ui/") &&
    fs.existsSync(path.resolve("node_modules", dep, "package.json")),
)

// https://vite.dev/config/
export default defineConfig({
  // Base ABSOLUTA: con './' las rutas anidadas (/admin/dashboard) pedían
  // ./assets/*.js y el rewrite de SPA devolvía HTML → pantalla en blanco.
  base: '/',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router'],
          charts: ['recharts'],
          ui: radixInstalled,
        },
      },
    },
  },
});

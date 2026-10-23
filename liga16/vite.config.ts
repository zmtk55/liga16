import fs from "node:fs"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"


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

/**
 * Proxy de JEV para desarrollo.
 *
 * `api.typesafe.ai` no manda cabeceras CORS: desde el navegador la llamada
 * muere. En producción la atiende `api/jev.ts` en Vercel; aquí se replica para
 * que `npm run dev` haga lo mismo y la llave no viaje al bundle.
 */
function jevProxy(apiKey: string | undefined): Plugin {
  return {
    name: "liga16-jev-proxy",
    configureServer(server) {
      server.middlewares.use("/api/jev", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405
          res.end("Method not allowed")
          return
        }
        if (!apiKey) {
          res.statusCode = 500
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({ error: "TYPESAFE_API_KEY no está definida" }))
          return
        }

        const chunks: Buffer[] = []
        req.on("data", (c: Buffer) => chunks.push(c))
        req.on("end", async () => {
          try {
            const upstream = await fetch("https://api.typesafe.ai/v1/systemone", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: Buffer.concat(chunks).toString("utf8"),
            })
            const text = await upstream.text()
            res.statusCode = upstream.status
            res.setHeader("Content-Type", "application/json")
            res.end(text)
          } catch (err) {
            res.statusCode = 502
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ error: String(err) }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const jevKey = env.TYPESAFE_API_KEY || env.VITE_JEV_API_KEY

  return {
    // Base ABSOLUTA: con './' las rutas anidadas (/admin/dashboard) pedían
    // ./assets/*.js y el rewrite de SPA devolvía HTML → pantalla en blanco.
    base: '/',
    plugins: [react(), jevProxy(jevKey)],
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
  }
});

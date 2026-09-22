import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
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
          ui: ['@radix-ui/react-slot', '@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tooltip', '@radix-ui/react-popover', '@radix-ui/react-scroll-area', '@radix-ui/react-tabs'],
        },
      },
    },
  },
});

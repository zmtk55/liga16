// Config SOLO para capturas locales con datos sintéticos (npm run dev normal no la usa).
// Aliasea los módulos de datos/sesión a fixtures; el resto de la app es real.
import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    {
      // Headless no corre las animaciones de entrada: forzar el estado final.
      name: "liga16-shots-no-anim",
      transformIndexHtml(html: string) {
        return html.replace(
          "</head>",
          "<script>if(new URLSearchParams(location.search).get('theme')==='dark')localStorage.setItem('theme','dark');</script>" +
          "<style>[style*=opacity]{opacity:1!important;transform:none!important}*{animation:none!important;transition:none!important}</style></head>",
        );
      },
    },
  ],
  resolve: {
    alias: [
      { find: "@/lib/organizer-admin", replacement: path.resolve(__dirname, "./src/__fixtures__/organizer-admin.fixture.ts") },
      { find: "@/lib/data", replacement: path.resolve(__dirname, "./src/__fixtures__/data.fixture.ts") },
      { find: "@/contexts/AuthContext", replacement: path.resolve(__dirname, "./src/__fixtures__/auth.fixture.tsx") },
      { find: "@/lib/supabase", replacement: path.resolve(__dirname, "./src/__fixtures__/supabase.fixture.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});

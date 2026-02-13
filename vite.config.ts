import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icons/icon.svg", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "Hisabia - Accounting & POS",
        short_name: "Hisabia",
        description: "Accounting & POS untuk segala jenis usaha",
        theme_color: "#1D8B7A",
        background_color: "#ffffff",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnon),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
};
});

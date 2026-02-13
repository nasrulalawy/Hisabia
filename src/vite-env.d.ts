/// <reference types="vite/client" />

declare module "qrcode" {
  export function toDataURL(url: string, opts?: { width?: number }): Promise<string>;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

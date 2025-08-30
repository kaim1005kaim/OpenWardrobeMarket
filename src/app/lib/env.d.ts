// Environment variables type definitions
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    DEEPSEEK_API_KEY?: string;
    IMAGINEAPI_BEARER?: string;
    R2_ACCESS_KEY_ID?: string;
    R2_SECRET_ACCESS_KEY?: string;
    R2_BUCKET?: string;
    R2_REGION?: string;
    R2_S3_ENDPOINT?: string;
    NEXT_PUBLIC_APP_URL?: string;
  }
}
/// Isi URL dan anon key dari project Supabase yang sama dengan web (Settings → API).
/// Untuk development bisa pakai .env atau flutter_dotenv; di sini pakai konstanta.
const String supabaseUrl = String.fromEnvironment(
  'SUPABASE_URL',
  defaultValue: 'https://tmuiumuxxhdjxfssqpmi.supabase.co',
);
const String supabaseAnonKey = String.fromEnvironment(
  'SUPABASE_ANON_KEY',
  defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtdWl1bXV4eGhkanhmc3NxcG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NjU3NTMsImV4cCI6MjA4NjI0MTc1M30.wr1HZjIAFmi0oxqLDxhQCAzdtW7y0pKAU-3T6S6uIHw',
);

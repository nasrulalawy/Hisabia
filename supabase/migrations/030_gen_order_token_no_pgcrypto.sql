-- Replace gen_order_token to avoid pgcrypto dependency
-- Uses gen_random_uuid() (built-in) instead of gen_random_bytes (pgcrypto)
CREATE OR REPLACE FUNCTION public.gen_order_token()
RETURNS text
LANGUAGE sql
AS $$
  SELECT replace(replace(replace(
    encode(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 'base64'),
    '+', '-'), '/', '_'), '=', '');
$$;

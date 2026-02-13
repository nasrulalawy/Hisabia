-- Enable pgcrypto for gen_random_bytes (used by gen_order_token)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

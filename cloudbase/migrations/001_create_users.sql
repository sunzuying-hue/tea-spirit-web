BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid varchar(64) NOT NULL UNIQUE,
  auth_provider varchar(32) NOT NULL CHECK (auth_provider IN ('phone','wechat','apple','email','dev')),
  phone varchar(32), openid varchar(255), unionid varchar(255),
  nickname varchar(120), avatar_url text, first_visit_at timestamptz NOT NULL DEFAULT now(),
  companion_count integer NOT NULL DEFAULT 0 CHECK (companion_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_phone_unique UNIQUE (phone)
);
CREATE INDEX IF NOT EXISTS users_auth_uid_idx ON public.users (auth_uid);
COMMIT;

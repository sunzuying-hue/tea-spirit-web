BEGIN;
CREATE TABLE IF NOT EXISTS public.letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tea_spirit_id uuid REFERENCES public.tea_spirits(id) ON DELETE SET NULL,
  event_key varchar(255) NOT NULL UNIQUE,
  type varchar(32) NOT NULL CHECK (type IN ('spirit_grown','mid_autumn','spring_festival','qixi')),
  title varchar(255) NOT NULL, image_url text NOT NULL, read boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS letters_user_created_idx ON public.letters (user_id, created_at DESC);
COMMIT;

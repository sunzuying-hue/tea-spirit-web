BEGIN;
CREATE TABLE IF NOT EXISTS public.tea_spirits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  obtained_at timestamptz NOT NULL,
  stage varchar(16) NOT NULL DEFAULT 'early' CHECK (stage IN ('early','middle','late','completed')),
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  completed_at timestamptz, completion_event_key varchar(255) UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tea_spirits_user_status_idx ON public.tea_spirits (user_id, status);
CREATE INDEX IF NOT EXISTS tea_spirits_user_obtained_idx ON public.tea_spirits (user_id, obtained_at DESC);
COMMIT;

BEGIN;

-- Production invariant: a user can own at most one active tea spirit.
-- Run the duplicate audit query before this migration; this migration never
-- deletes or modifies existing business data.
CREATE UNIQUE INDEX IF NOT EXISTS tea_spirits_one_active_per_user_idx
  ON public.tea_spirits (user_id)
  WHERE status = 'active';

COMMIT;

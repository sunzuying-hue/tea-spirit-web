BEGIN;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tea_spirits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.users TO authenticated;
GRANT UPDATE (nickname, avatar_url, updated_at) ON public.users TO authenticated;
GRANT SELECT, INSERT ON public.tea_spirits TO authenticated;
GRANT SELECT, INSERT ON public.letters TO authenticated;
GRANT UPDATE (read, read_at) ON public.letters TO authenticated;

DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users FOR SELECT TO authenticated
  USING (auth_uid = auth.uid());
DROP POLICY IF EXISTS users_insert_own ON public.users;
CREATE POLICY users_insert_own ON public.users FOR INSERT TO authenticated
  WITH CHECK (auth_uid = auth.uid());
DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users FOR UPDATE TO authenticated
  USING (auth_uid = auth.uid()) WITH CHECK (auth_uid = auth.uid());

DROP POLICY IF EXISTS tea_spirits_select_own ON public.tea_spirits;
CREATE POLICY tea_spirits_select_own ON public.tea_spirits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id=user_id AND u.auth_uid=auth.uid()));
DROP POLICY IF EXISTS tea_spirits_insert_own ON public.tea_spirits;
CREATE POLICY tea_spirits_insert_own ON public.tea_spirits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id=user_id AND u.auth_uid=auth.uid()));
DROP POLICY IF EXISTS letters_select_own ON public.letters;
CREATE POLICY letters_select_own ON public.letters FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id=user_id AND u.auth_uid=auth.uid()));
DROP POLICY IF EXISTS letters_insert_own ON public.letters;
CREATE POLICY letters_insert_own ON public.letters FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id=user_id AND u.auth_uid=auth.uid()));
DROP POLICY IF EXISTS letters_update_own ON public.letters;
CREATE POLICY letters_update_own ON public.letters FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id=user_id AND u.auth_uid=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id=user_id AND u.auth_uid=auth.uid()));

COMMIT;

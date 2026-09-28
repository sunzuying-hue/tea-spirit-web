BEGIN;
CREATE OR REPLACE FUNCTION public.complete_tea_spirit(p_tea_spirit_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE v_spirit public.tea_spirits%ROWTYPE; v_event_key varchar(255);
BEGIN
  SELECT ts.* INTO v_spirit FROM public.tea_spirits ts
    JOIN public.users u ON u.id=ts.user_id
    WHERE ts.id=p_tea_spirit_id AND u.auth_uid=auth.uid()
    FOR UPDATE OF ts;
  IF NOT FOUND OR v_spirit.status='completed' THEN RETURN false; END IF;
  v_event_key := 'spirit-grown-' || v_spirit.id::text;
  UPDATE public.tea_spirits SET status='completed', stage='completed',
    completed_at=COALESCE(completed_at,now()), completion_event_key=v_event_key, updated_at=now()
    WHERE id=v_spirit.id;
  UPDATE public.users SET companion_count=companion_count+1, updated_at=now()
    WHERE id=v_spirit.user_id;
  INSERT INTO public.letters(user_id,tea_spirit_id,event_key,type,title,image_url,payload)
    VALUES(v_spirit.user_id,v_spirit.id,v_event_key,'spirit_grown','茶灵长大啦',
      '/letters/spirit-grown.png',
      '{"coupon":{"type":"amount_off","amount":5,"status":"placeholder"}}'::jsonb)
    ON CONFLICT(event_key) DO NOTHING;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_tea_spirit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_tea_spirit(uuid) TO authenticated;
COMMIT;

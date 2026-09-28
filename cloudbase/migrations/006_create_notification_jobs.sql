BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  letter_id uuid REFERENCES public.letters(id) ON DELETE SET NULL,
  tea_spirit_id uuid REFERENCES public.tea_spirits(id) ON DELETE SET NULL,
  event_key varchar(255) NOT NULL UNIQUE,
  channel varchar(32) NOT NULL CHECK (channel IN ('sms')),
  type varchar(64) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  recipient varchar(32) NOT NULL,
  template_id varchar(255),
  template_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  deep_link text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  last_error text,
  provider_message_id varchar(255),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  processing_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_jobs_status_scheduled_idx
  ON public.notification_jobs (status, scheduled_at);
CREATE INDEX IF NOT EXISTS notification_jobs_user_created_idx
  ON public.notification_jobs (user_id, created_at DESC);

ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_jobs FROM PUBLIC;
REVOKE ALL ON TABLE public.notification_jobs FROM authenticated;

CREATE OR REPLACE FUNCTION public.claim_notification_jobs(p_limit integer DEFAULT 10)
RETURNS SETOF public.notification_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.notification_jobs
    WHERE (
      status = 'pending' AND scheduled_at <= now()
    ) OR (
      status = 'processing' AND processing_at < now() - interval '10 minutes'
    )
    ORDER BY scheduled_at, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50)
  )
  UPDATE public.notification_jobs AS job
  SET status = 'processing',
      processing_at = now(),
      attempt_count = job.attempt_count + 1,
      updated_at = now()
  FROM candidates
  WHERE job.id = candidates.id
  RETURNING job.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_job_sent(
  p_job_id uuid,
  p_provider_message_id varchar DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notification_jobs
  SET status = 'sent',
      sent_at = now(),
      processing_at = NULL,
      provider_message_id = p_provider_message_id,
      last_error = NULL,
      updated_at = now()
  WHERE id = p_job_id AND status = 'processing';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_notification_job(
  p_job_id uuid,
  p_error text,
  p_retry_delay_seconds integer DEFAULT 300
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notification_jobs
  SET status = CASE WHEN attempt_count < max_attempts THEN 'pending' ELSE 'failed' END,
      scheduled_at = CASE
        WHEN attempt_count < max_attempts
          THEN now() + make_interval(secs => GREATEST(COALESCE(p_retry_delay_seconds, 300), 0))
        ELSE scheduled_at
      END,
      processing_at = NULL,
      last_error = LEFT(COALESCE(p_error, 'UNKNOWN_ERROR'), 1000),
      updated_at = now()
  WHERE id = p_job_id AND status = 'processing';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_jobs(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_notification_jobs(integer) FROM authenticated;
REVOKE ALL ON FUNCTION public.mark_notification_job_sent(uuid, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notification_job_sent(uuid, varchar) FROM authenticated;
REVOKE ALL ON FUNCTION public.fail_notification_job(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_notification_job(uuid, text, integer) FROM authenticated;

CREATE OR REPLACE FUNCTION public.complete_tea_spirit(p_tea_spirit_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_spirit public.tea_spirits%ROWTYPE;
  v_event_key varchar(255);
  v_letter_id uuid;
  v_phone varchar(32);
BEGIN
  SELECT ts.* INTO v_spirit
  FROM public.tea_spirits ts
  JOIN public.users u ON u.id = ts.user_id
  WHERE ts.id = p_tea_spirit_id AND u.auth_uid = auth.uid()
  FOR UPDATE OF ts;

  IF NOT FOUND OR v_spirit.status = 'completed' THEN
    RETURN false;
  END IF;

  v_event_key := 'spirit-grown-' || v_spirit.id::text;

  UPDATE public.tea_spirits
  SET status = 'completed',
      stage = 'completed',
      completed_at = COALESCE(completed_at, now()),
      completion_event_key = v_event_key,
      updated_at = now()
  WHERE id = v_spirit.id;

  UPDATE public.users
  SET companion_count = companion_count + 1,
      updated_at = now()
  WHERE id = v_spirit.user_id;

  INSERT INTO public.letters (
    user_id, tea_spirit_id, event_key, type, title, image_url, payload
  ) VALUES (
    v_spirit.user_id,
    v_spirit.id,
    v_event_key,
    'spirit_grown',
    '茶灵长大啦',
    '/letters/spirit-grown.png',
    '{"coupon":{"type":"amount_off","amount":5,"status":"placeholder"}}'::jsonb
  )
  ON CONFLICT (event_key) DO UPDATE SET event_key = EXCLUDED.event_key
  RETURNING id INTO v_letter_id;

  SELECT phone INTO v_phone FROM public.users WHERE id = v_spirit.user_id;

  IF NULLIF(BTRIM(v_phone), '') IS NOT NULL THEN
    INSERT INTO public.notification_jobs (
      user_id,
      letter_id,
      tea_spirit_id,
      event_key,
      channel,
      type,
      status,
      recipient,
      template_params,
      deep_link
    ) VALUES (
      v_spirit.user_id,
      v_letter_id,
      v_spirit.id,
      'sms-spirit-grown-' || v_spirit.id::text,
      'sms',
      'spirit_grown',
      'pending',
      v_phone,
      jsonb_build_object('values', jsonb_build_array('{{deep_link}}')),
      '/?letter=' || v_letter_id::text
    )
    ON CONFLICT (event_key) DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_tea_spirit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_tea_spirit(uuid) TO authenticated;

COMMIT;

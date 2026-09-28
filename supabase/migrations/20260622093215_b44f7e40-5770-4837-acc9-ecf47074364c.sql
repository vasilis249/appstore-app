-- Phase 2b safety: moderation columns, FK cascades, anti-abuse helpers.

-- 1) message_reports: add FK constraints + audit columns
ALTER TABLE public.message_reports
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS action text;

-- Add FKs so account deletion cascades / nullifies reports correctly
DO $$ BEGIN
  ALTER TABLE public.message_reports
    ADD CONSTRAINT message_reports_reporter_id_fkey
    FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.message_reports
    ADD CONSTRAINT message_reports_reported_user_id_fkey
    FOREIGN KEY (reported_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.message_reports
    ADD CONSTRAINT message_reports_message_id_fkey
    FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.message_reports
    ADD CONSTRAINT message_reports_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Status check
ALTER TABLE public.message_reports DROP CONSTRAINT IF EXISTS message_reports_status_check;
ALTER TABLE public.message_reports ADD CONSTRAINT message_reports_status_check
  CHECK (status IN ('open','dismissed','actioned'));

CREATE INDEX IF NOT EXISTS idx_message_reports_status_created
  ON public.message_reports (status, created_at DESC);
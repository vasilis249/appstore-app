
-- profiles.discoverable
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT false;

-- friendships
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships_select_own" ON public.friendships
  FOR SELECT TO authenticated
  USING (auth.uid() IN (requester_id, addressee_id));

CREATE POLICY "friendships_insert_requester" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "friendships_update_addressee" ON public.friendships
  FOR UPDATE TO authenticated
  USING (addressee_id = auth.uid())
  WITH CHECK (addressee_id = auth.uid());

CREATE POLICY "friendships_delete_either" ON public.friendships
  FOR DELETE TO authenticated
  USING (auth.uid() IN (requester_id, addressee_id));

CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);

-- user_blocks
CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_blocks_all_own" ON public.user_blocks
  FOR ALL TO authenticated
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());

CREATE INDEX idx_user_blocks_blocked ON public.user_blocks(blocked_id);

-- Notification trigger for friend requests / acceptance
CREATE OR REPLACE FUNCTION public.notify_on_friendship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_name text;
  v_addressee_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT full_name INTO v_requester_name FROM public.profiles WHERE user_id = NEW.requester_id;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.addressee_id,
      'friend_request',
      'Νέο αίτημα φιλίας',
      COALESCE(v_requester_name, 'Ένας παίκτης') || ' σου έστειλε αίτημα φιλίας.',
      jsonb_build_object('friendship_id', NEW.id, 'requester_id', NEW.requester_id)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.status,'') <> 'accepted'
     AND NEW.status = 'accepted' THEN
    SELECT full_name INTO v_addressee_name FROM public.profiles WHERE user_id = NEW.addressee_id;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.requester_id,
      'friend_accepted',
      'Το αίτημα φιλίας έγινε αποδεκτό',
      COALESCE(v_addressee_name, 'Ένας παίκτης') || ' αποδέχθηκε το αίτημα φιλίας σου.',
      jsonb_build_object('friendship_id', NEW.id, 'addressee_id', NEW.addressee_id)
    );
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_friendships_notify_insert
AFTER INSERT ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.notify_on_friendship();

CREATE TRIGGER trg_friendships_notify_update
AFTER UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.notify_on_friendship();

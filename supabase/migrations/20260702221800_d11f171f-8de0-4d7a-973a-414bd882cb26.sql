-- Group chat: admin-managed membership
CREATE OR REPLACE FUNCTION public.is_conversation_admin(_conv uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conv AND user_id = _user AND role = 'admin'
  );
$$;

-- Admins can remove any member from a group conversation (defense in depth;
-- the removeGroupMember server function is the primary enforcement path).
DROP POLICY IF EXISTS "Admins can remove members" ON public.conversation_members;
CREATE POLICY "Admins can remove members"
ON public.conversation_members
FOR DELETE
TO authenticated
USING (public.is_conversation_admin(conversation_id, auth.uid()));

-- Admins can add members to their group conversations (defense in depth).
DROP POLICY IF EXISTS "Admins can add members" ON public.conversation_members;
CREATE POLICY "Admins can add members"
ON public.conversation_members
FOR INSERT
TO authenticated
WITH CHECK (public.is_conversation_admin(conversation_id, auth.uid()));
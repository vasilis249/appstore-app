-- Speak groups: public/private, join / request / invite, roles, owner hand-over, group-only voices, reports.
\set ON_ERROR_STOP 0
\set QUIET on
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'anna@x', '{"full_name":"Anna"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@x', '{"full_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'chris@x', '{"full_name":"Chris"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dora@x', '{"full_name":"Dora"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@x', '{"full_name":"Eve"}');
INSERT INTO private.admins (user_id) VALUES ('00000000-0000-0000-0000-00000000000e');
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('voices', '00000000-0000-0000-0000-00000000000a/g1.m4a'),
  ('voices', '00000000-0000-0000-0000-00000000000a/p1.m4a'),
  ('voices', '00000000-0000-0000-0000-00000000000b/r1.m4a'),
  ('voices', '00000000-0000-0000-0000-00000000000b/x1.m4a'),
  ('voices', '00000000-0000-0000-0000-00000000000d/d1.m4a');

CREATE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claim.sub', u, false);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false); END $$;
CREATE FUNCTION pg_temp.ok(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE NOTICE '% %', CASE WHEN coalesce(cond, false) THEN 'PASS' ELSE 'FAIL' END, label; END $$;
CREATE FUNCTION pg_temp.fails(stmt text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN EXECUTE stmt; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN true; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated, anon;

\set A '''00000000-0000-0000-0000-00000000000a'''
\set B '''00000000-0000-0000-0000-00000000000b'''
\set C '''00000000-0000-0000-0000-00000000000c'''
\set D '''00000000-0000-0000-0000-00000000000d'''
\set E '''00000000-0000-0000-0000-00000000000e'''

-- friends: A ↔ D (mutual follow); A → C only
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.follow_user(:D); SELECT public.follow_user(:C);
RESET ROLE; SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT public.follow_user(:A);
RESET ROLE;

-- 01 create
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.create_group('Ομάδα Φωτογραφίας', 'tech', 'private', 'Φωτογραφικές μηχανές') AS g \gset
SELECT public.create_group('Ποδόσφαιρο Τώρα', 'sports', 'public') AS pg \gset
SELECT pg_temp.ok('01a creator is the owner, 1 member',
  (SELECT my_role FROM public.group_detail(:'g')) = 'owner' AND (SELECT members_count FROM public.groups WHERE id = :'g') = 1);
SELECT pg_temp.ok('01b bad privacy / short name refused',
  pg_temp.fails($$SELECT public.create_group('Xyz', 'tech', 'secret')$$) AND pg_temp.fails($$SELECT public.create_group('ab', 'tech', 'public')$$));
SELECT pg_temp.ok('01c no direct writes', pg_temp.fails(format($$INSERT INTO public.group_members (group_id, user_id) VALUES (%L, %L)$$, :'g', :B)));
SELECT public.create_post(p_group := :'g', p_title := 'Private voice', p_path := '00000000-0000-0000-0000-00000000000a/g1.m4a', p_mime := 'audio/mp4', p_duration_ms := 3000) AS gp \gset
SELECT public.create_post(p_group := :'pg', p_title := 'Public group voice', p_path := '00000000-0000-0000-0000-00000000000a/p1.m4a', p_mime := 'audio/mp4', p_duration_ms := 3000) AS pp \gset
SELECT pg_temp.ok('01d group voice takes the group''s section', (SELECT section_id FROM public.posts WHERE id = :'gp') = 'tech'
  AND (SELECT posts_count FROM public.groups WHERE id = :'g') = 1);
RESET ROLE;

-- 02 discovery + private walls
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('02a find a group in Greek or Latin, accents ignored',
  EXISTS (SELECT 1 FROM public.discover_groups('φωτογραφ') WHERE id = :'g') AND EXISTS (SELECT 1 FROM public.discover_groups('podosfairo') WHERE id = :'pg'));
SELECT pg_temp.ok('02b private group: name visible, voices and members not',
  (SELECT name FROM public.group_detail(:'g')) = 'Ομάδα Φωτογραφίας'
  AND NOT EXISTS (SELECT 1 FROM public.feed_posts('group', p_group := :'g'))
  AND NOT EXISTS (SELECT 1 FROM public.posts WHERE id = :'gp')
  AND pg_temp.fails(format('SELECT public.group_members_list(%L)', :'g'))
  AND pg_temp.fails(format('SELECT public.like_post(%L)', :'gp')));
SELECT pg_temp.ok('02c public group: voices readable by anyone',
  EXISTS (SELECT 1 FROM public.feed_posts('group', p_group := :'pg') WHERE post_id = :'pp'));
SELECT pg_temp.ok('02d only members speak (posts and replies)',
  pg_temp.fails(format($$SELECT public.create_post(p_group := %L, p_path := '00000000-0000-0000-0000-00000000000b/x1.m4a', p_mime := 'audio/mp4', p_duration_ms := 2000)$$, :'pg'))
  AND pg_temp.fails(format($$SELECT public.create_post(p_reply_to := %L, p_path := '00000000-0000-0000-0000-00000000000b/x1.m4a', p_mime := 'audio/mp4', p_duration_ms := 2000)$$, :'pp')));
SELECT pg_temp.ok('02e group voices stay out of For you / all / sections / profiles',
  NOT EXISTS (SELECT 1 FROM public.feed_posts('foryou', p_limit := 50) WHERE group_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.feed_posts('all') WHERE group_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.feed_posts('section', p_section := 'sports') WHERE post_id = :'pp')
  AND NOT EXISTS (SELECT 1 FROM public.feed_posts('author', p_author := :A)));
SELECT pg_temp.ok('02f group voices can''t be reposted', pg_temp.fails(format('SELECT public.create_post(p_repost_of := %L)', :'pp')));
RESET ROLE;

-- 03 public join
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT public.join_group(:'pg') AS j \gset
SELECT pg_temp.ok('03a public group: join at once', :'j' = 'joined'
  AND (SELECT members_count FROM public.groups WHERE id = :'pg') = 2);
RESET ROLE;

-- 04 request → approve
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT public.join_group(:'g') AS j \gset
SELECT pg_temp.ok('04a private group: a request', :'j' = 'requested'
  AND (SELECT my_pending FROM public.group_detail(:'g')) = 'request');
RESET ROLE;
SELECT pg_temp.ok('04b admins get a request notification', EXISTS (SELECT 1 FROM public.notifications WHERE user_id = :A AND kind = 'group_request' AND group_id = :'g'));
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT pg_temp.ok('04c non-admins can''t approve or see requests',
  pg_temp.fails(format('SELECT public.respond_group_request(%L, %L, true)', :'g', :B))
  AND pg_temp.fails(format('SELECT public.group_requests_list(%L)', :'g')));
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('04d owner sees 1 pending request', (SELECT pending_requests FROM public.group_detail(:'g')) = 1
  AND (SELECT count(*) FROM public.group_requests_list(:'g')) = 1);
SELECT public.respond_group_request(:'g', :B, true);
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('04e approved: member, notified, reads the voices',
  (SELECT my_role FROM public.group_detail(:'g')) = 'member'
  AND EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'group_accepted' AND group_id = :'g')
  AND EXISTS (SELECT 1 FROM public.feed_posts('group', p_group := :'g') WHERE post_id = :'gp'));
SELECT public.create_post(p_reply_to := :'gp', p_path := '00000000-0000-0000-0000-00000000000b/r1.m4a', p_mime := 'audio/mp4', p_duration_ms := 2000) AS gr \gset
SELECT pg_temp.ok('04f a reply stays in the group', (SELECT group_id FROM public.posts WHERE id = :'gr') = :'g'::uuid);
SELECT pg_temp.ok('04g "groups" feed = voices from your groups', EXISTS (SELECT 1 FROM public.feed_posts('groups') WHERE post_id = :'gp')
  AND (SELECT count(*) FROM public.my_groups()) = 1);
RESET ROLE;

-- 05 invites (friends only)
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT pg_temp.ok('05a can''t invite someone who isn''t a friend', pg_temp.fails(format('SELECT public.invite_to_group(%L, %L)', :'g', :C)));
SELECT public.invite_to_group(:'g', :D);
RESET ROLE;
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT pg_temp.ok('05b non-members can''t invite', pg_temp.fails(format('SELECT public.invite_to_group(%L, %L)', :'g', :A)));
RESET ROLE; SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT pg_temp.ok('05c invite: notification + listed', EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'group_invite' AND group_id = :'g')
  AND (SELECT invited_by_name FROM public.my_group_invites() WHERE id = :'g') = 'Anna'
  AND (SELECT my_pending FROM public.group_detail(:'g')) = 'invite');
SELECT pg_temp.ok('05d accepting an invite joins a private group at once', public.join_group(:'g') = 'joined');
RESET ROLE;
SELECT pg_temp.ok('05e inviter told', EXISTS (SELECT 1 FROM public.notifications WHERE user_id = :A AND actor_id = :D AND kind = 'group_joined'));

-- 06 cancel a request
SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT public.join_group(:'g');
SELECT public.leave_group(:'g');
SELECT pg_temp.ok('06a leave_group cancels a request', (SELECT my_pending FROM public.group_detail(:'g')) IS NULL);
RESET ROLE;

-- 07 roles
SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT pg_temp.ok('07a members can''t change roles or remove people',
  pg_temp.fails(format($$SELECT public.set_group_role(%L, %L, 'admin')$$, :'g', :D))
  AND pg_temp.fails(format('SELECT public.remove_group_member(%L, %L)', :'g', :D)));
RESET ROLE; SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.set_group_role(:'g', :B, 'admin');
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT public.remove_group_member(:'g', :D);
SELECT pg_temp.ok('07b an admin removes a member, not the owner',
  NOT EXISTS (SELECT 1 FROM public.group_members_list(:'g') WHERE user_id = :D)
  AND pg_temp.fails(format('SELECT public.remove_group_member(%L, %L)', :'g', :A))
  AND pg_temp.fails(format('SELECT public.delete_group(%L)', :'g')));
RESET ROLE;

-- 08 owner leaves → the admin takes over
SELECT pg_temp.as_user(:A); SET ROLE authenticated;
SELECT public.leave_group(:'g');
RESET ROLE;
SELECT pg_temp.ok('08a owner left: admin is the new owner', (SELECT role FROM public.group_members WHERE group_id = :'g' AND user_id = :B) = 'owner'
  AND (SELECT members_count FROM public.groups WHERE id = :'g') = 1);

-- 09 going public lets waiting people in
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT public.join_group(:'g');
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT public.update_group(:'g', 'Ομάδα Φωτογραφίας', 'tech', 'public', 'Για όλους');
RESET ROLE;
SELECT pg_temp.ok('09a public now: pending request became a member', EXISTS (SELECT 1 FROM public.group_members WHERE group_id = :'g' AND user_id = :C)
  AND NOT EXISTS (SELECT 1 FROM public.group_requests WHERE group_id = :'g'));

-- 10 report a group → admin deletes it
SELECT pg_temp.as_user(:D); SET ROLE authenticated;
SELECT public.report_content('group', :'pg', 'spam');
RESET ROLE; SELECT pg_temp.as_user(:E); SET ROLE authenticated;
SELECT pg_temp.ok('10a admin sees the group report', (SELECT group_name FROM public.admin_reports() WHERE kind = 'group') = 'Ποδόσφαιρο Τώρα');
SELECT pg_temp.ok('10b delete_group only for group reports',
  pg_temp.fails(format($$SELECT public.admin_resolve_report(id, 'hide_post') FROM public.reports WHERE kind = 'group'$$)));
SELECT public.admin_resolve_report(id, 'delete_group') FROM public.admin_reports() WHERE kind = 'group';
RESET ROLE;
SELECT pg_temp.ok('10c group and its voices gone', NOT EXISTS (SELECT 1 FROM public.groups WHERE id = :'pg')
  AND NOT EXISTS (SELECT 1 FROM public.posts WHERE id = :'pp'));

-- 11 owner deletes; last member leaving deletes the group
SELECT pg_temp.as_user(:C); SET ROLE authenticated;
SELECT pg_temp.ok('11a only the owner deletes', pg_temp.fails(format('SELECT public.delete_group(%L)', :'g')));
RESET ROLE; SELECT pg_temp.as_user(:B); SET ROLE authenticated;
SELECT public.delete_group(:'g');
SELECT public.create_group('Μόνος μου', 'humor', 'private') AS solo \gset
SELECT public.leave_group(:'solo');
RESET ROLE;
SELECT pg_temp.ok('11b deleted by the owner; empty group removed', NOT EXISTS (SELECT 1 FROM public.groups WHERE id IN (:'g', :'solo')));

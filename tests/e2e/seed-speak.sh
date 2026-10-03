#!/bin/bash
# Local Speak seed: reset DB (+ voice seed users), follows, topics, posts with real WAV files.
S="$(cd "$(dirname "$0")" && pwd)"
bash $S/reset-local.sh
rm -rf $S/storage-files
python3 - <<PY
import wave, struct, math, os
S='$S'
posts=[('33333333-0000-0000-0000-000000000003','n1',3,330),('22222222-0000-0000-0000-000000000002','m1',3,440),
       ('44444444-0000-0000-0000-000000000004','g1',2,550),('55555555-0000-0000-0000-000000000005','e1',2,660),
       ('22222222-0000-0000-0000-000000000002','m2',2,500)]
for uid,name,secs,freq in posts:
    f=f'{S}/storage-files/voices/{uid}/{name}.m4a'; os.makedirs(os.path.dirname(f), exist_ok=True)
    w=wave.open(f,'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000)
    w.writeframes(b''.join(struct.pack('<h', int(6000*math.sin(2*math.pi*freq*i/8000))) for i in range(8000*secs))); w.close()
    open(f+'.type','w').write('audio/wav')
PY
PGHOST=/tmp PGPORT=54329 PGUSER=postgres psql -q -d courtsie <<'SQL'
-- follows come from seed_voice.sql
INSERT INTO private.admins (user_id) VALUES ('11111111-0000-0000-0000-000000000001');
INSERT INTO storage.objects (bucket_id, name) VALUES
 ('voices','33333333-0000-0000-0000-000000000003/n1.m4a'),('voices','22222222-0000-0000-0000-000000000002/m1.m4a'),
 ('voices','44444444-0000-0000-0000-000000000004/g1.m4a'),('voices','55555555-0000-0000-0000-000000000005/e1.m4a'),
 ('voices','22222222-0000-0000-0000-000000000002/m2.m4a');
INSERT INTO public.topics (id, section_id, kind, title, summary, source_name, source_url, created_at) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','career','news','Κυκλοφόρησε το iPhone 18: αξίζει την αναβάθμιση;','Η Apple παρουσίασε τη νέα σειρά με νέο chip και κάμερα.','Kathimerini','https://www.kathimerini.gr/', now() - interval '5 hours'),
 ('aaaaaaaa-0000-0000-0000-000000000002','unis','topic','Νέα μέτρα για το στεγαστικό',NULL,NULL,NULL, now() - interval '3 hours');
INSERT INTO public.posts (id, author_id, section_id, topic_id, title, audio_path, mime, duration_ms, created_at) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000003','career','aaaaaaaa-0000-0000-0000-000000000001','Το iPhone 18 δεν αξίζει τα λεφτά του','33333333-0000-0000-0000-000000000003/n1.m4a','audio/mp4',3000, now() - interval '2 hours'),
 ('bbbbbbbb-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000002','unis','aaaaaaaa-0000-0000-0000-000000000002','Τι λέτε για το στεγαστικό;','22222222-0000-0000-0000-000000000002/m1.m4a','audio/mp4',3000, now() - interval '1 hour'),
 ('bbbbbbbb-0000-0000-0000-000000000003','44444444-0000-0000-0000-000000000004','unis',NULL,'Ο τελικός χθες ήταν απίστευτος','44444444-0000-0000-0000-000000000004/g1.m4a','audio/mp4',2000, now() - interval '30 minutes'),
 ('bbbbbbbb-0000-0000-0000-000000000004','55555555-0000-0000-0000-000000000005','unis',NULL,'Όταν ξεχνάς το μικρόφωνο ανοιχτό','55555555-0000-0000-0000-000000000005/e1.m4a','audio/mp4',2000, now() - interval '10 minutes');
INSERT INTO public.posts (author_id, section_id, topic_id, reply_to, audio_path, mime, duration_ms, created_at) VALUES
 ('22222222-0000-0000-0000-000000000002','career','aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002/m2.m4a','audio/mp4',2000, now() - interval '20 minutes');
INSERT INTO public.posts (author_id, section_id, repost_of, created_at) VALUES
 ('33333333-0000-0000-0000-000000000003','unis','bbbbbbbb-0000-0000-0000-000000000003', now() - interval '5 minutes');
INSERT INTO public.post_likes (user_id, post_id) VALUES ('22222222-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001'),('44444444-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000001');
-- feature flows predate the student gate: off here, gate-flow (seed-gate.sh) turns it on
UPDATE private.app_flags SET enabled = false WHERE key = 'student_gate';
SQL

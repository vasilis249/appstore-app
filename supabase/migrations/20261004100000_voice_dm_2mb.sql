-- Safari's MediaRecorder may ignore the requested bitrate (AAC ~128 kbps → ~1 MB per minute),
-- so allow up to 2 MB per voice message (still ≤ 60 s).
-- Send a recorded voice message to a friend. Audio comes base64-encoded (max 2 MB decoded).
CREATE OR REPLACE FUNCTION public.send_voice_message(p_to uuid, p_audio_b64 text, p_mime text, p_duration_ms int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.me();
  bytes bytea;
  mid uuid;
BEGIN
  IF NOT private.are_friends(uid, p_to) OR private.is_blocked(uid, p_to)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_to AND NOT disabled) THEN
    RAISE EXCEPTION 'not_friends' USING ERRCODE = '42501';
  END IF;
  IF p_audio_b64 IS NULL OR char_length(p_audio_b64) > 2800000 THEN
    RAISE EXCEPTION 'audio_too_large' USING ERRCODE = '22023';
  END IF;
  bytes := decode(p_audio_b64, 'base64');
  IF octet_length(bytes) < 100 OR octet_length(bytes) > 2097152 THEN
    RAISE EXCEPTION 'audio_too_large' USING ERRCODE = '22023';
  END IF;
  PERFORM private.rate_limit('voice_message', 30, interval '1 minute');
  PERFORM private.rate_limit('voice_message_day', 500, interval '1 day');
  INSERT INTO public.voice_messages (sender_id, recipient_id, duration_ms)
  VALUES (uid, p_to, p_duration_ms) RETURNING id INTO mid;
  INSERT INTO private.voice_message_audio (message_id, mime, audio)
  VALUES (mid, private.normalize_audio_mime(p_mime), bytes);
  RETURN mid;
END $$;

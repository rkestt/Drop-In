-- Update trigger function to populate nickname and avatar_url from OAuth metadata

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_nickname TEXT;
  v_avatar_url TEXT;
BEGIN
  -- Extract display name: full_name > name > nickname > email prefix
  v_nickname := NEW.raw_user_meta_data->>'full_name';
  IF v_nickname IS NULL OR trim(v_nickname) = '' THEN
    v_nickname := NEW.raw_user_meta_data->>'name';
  END IF;
  IF v_nickname IS NULL OR trim(v_nickname) = '' THEN
    v_nickname := NEW.raw_user_meta_data->>'nickname';
  END IF;
  IF v_nickname IS NULL OR trim(v_nickname) = '' THEN
    v_nickname := split_part(NEW.email, '@', 1);
  END IF;

  -- Extract avatar: avatar_url > picture
  v_avatar_url := NEW.raw_user_meta_data->>'avatar_url';
  IF v_avatar_url IS NULL OR trim(v_avatar_url) = '' THEN
    v_avatar_url := NEW.raw_user_meta_data->>'picture';
  END IF;

  INSERT INTO public.profiles (user_id, nickname, avatar_url, karma_score)
  VALUES (NEW.id, v_nickname, v_avatar_url, 90);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

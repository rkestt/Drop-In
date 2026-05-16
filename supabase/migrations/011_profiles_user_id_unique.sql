-- Fix: add UNIQUE constraint on profiles.user_id to enable ON CONFLICT
-- and prevent duplicate profiles per auth user.

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

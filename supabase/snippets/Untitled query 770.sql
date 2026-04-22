-- ============================================================
-- Phase 2 Step 1: Profiles table — member lookup by email
-- Migration: 20260422010000
-- ============================================================
-- Minimal profile row for every authenticated user.
-- Purpose: let collaboration features look up users by email
-- before inviting them to a workspace.
-- ============================================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Quick lookup: find a user by email
CREATE UNIQUE INDEX idx_profiles_email ON public.profiles(email);

-- Auto-update updated_at
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. AUTO-CREATE PROFILE ON SIGNUP
-- Supabase Auth trigger: fires when a new user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supabase provides auth.users trigger support via the
-- supabase_auth_admin role. Connect the trigger:
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can look up profiles by email (needed for invites)
CREATE POLICY "profiles: authenticated can view"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can update their own profile only
CREATE POLICY "profiles: self update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

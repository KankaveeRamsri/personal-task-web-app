-- ============================================================
-- Phase 2 Step 7: Database-level owner role protection
-- Migration: 20260422040000
-- ============================================================
-- Defense in depth: service/UI already block these operations,
-- but if a bug or direct API call bypasses them, the database
-- will still reject invalid owner role mutations.
--
-- Protection 1: block INSERT of role='owner' into workspace_members
--   when the workspace already has an owner.
--   The add_owner_to_workspace trigger (SECURITY DEFINER, AFTER INSERT
--   on workspaces) is NOT affected because at that point no owner
--   row exists yet for the new workspace.
--
-- Protection 2: block UPDATE that changes the owner's role
--   (demotion) or promotes anyone to owner.
-- ============================================================

-- 1. Block INSERT with role = 'owner' when workspace already has one
CREATE OR REPLACE FUNCTION public.block_owner_insert()
RETURNS trigger AS $$
BEGIN
  IF NEW.role = 'owner' AND EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = NEW.workspace_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'ไม่สามารถเพิ่ม owner ใหม่ได้';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_block_owner_insert
  BEFORE INSERT ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.block_owner_insert();

-- 2. Block UPDATE that demotes owner or promotes anyone to owner
CREATE OR REPLACE FUNCTION public.block_owner_role_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
    RAISE EXCEPTION 'ไม่สามารถเปลี่ยน role ของ owner ได้';
  END IF;
  IF OLD.role != 'owner' AND NEW.role = 'owner' THEN
    RAISE EXCEPTION 'ไม่สามารถตั้งสมาชิกเป็น owner ได้';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_block_owner_role_change
  BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.block_owner_role_change();

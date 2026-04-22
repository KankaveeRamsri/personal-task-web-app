select
  p.proname,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_workspace_member',
    'can_manage_workspace',
    'get_workspace_role',
    'add_owner_to_workspace'
  );
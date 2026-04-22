insert into public.workspace_members (workspace_id, user_id, role)
select
  w.id,
  p.id,
  'member'
from public.workspaces w
cross join public.profiles p
where w.name = 'Workspace Test A'
  and p.email = 'userb@test.com'
on conflict do nothing;
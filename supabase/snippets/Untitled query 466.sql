select
  w.id as workspace_id,
  w.name,
  p.id as user_id,
  p.email
from public.workspaces w
cross join public.profiles p
where w.name = 'Workspace Test A'
  and p.email = 'userb@test.com';
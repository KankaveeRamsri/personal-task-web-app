select workspace_id, user_id, role
from public.workspace_members
order by joined_at desc;
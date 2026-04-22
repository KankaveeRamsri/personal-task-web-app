select
  au.id as auth_user_id,
  au.email as auth_email,
  p.id as profile_id,
  p.email as profile_email
from auth.users au
left join profiles p on p.id = au.id
order by au.created_at desc;
insert into workspace_members (
  workspace_id,
  user_id,
  role
)
values (
  '9ebf6480-0a67-4f11-99a9-ec3bc935f6b8',
  '69de01ee-77c6-4df0-a840-240e5550a488',
  'member'
)
returning *;
insert into boards (
  workspace_id,
  title,
  position,
  created_by
)
values (
  '9ebf6480-0a67-4f11-99a9-ec3bc935f6b8',
  'Board A',
  1,
  'cd975756-cfb2-4453-a8b9-7d6253aa45cd'
)
returning *;
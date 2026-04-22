insert into tasks (
  list_id,
  title,
  position,
  created_by
)
values (
  '659fc37e-db3a-4573-81da-1b2cf7e6a972',
  'First Task',
  1,
  'cd975756-cfb2-4453-a8b9-7d6253aa45cd'
)
returning *;
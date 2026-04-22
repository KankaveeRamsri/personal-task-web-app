insert into public.workspaces (id, name, owner_id)
values (gen_random_uuid(), 'Workspace A', 'de8f1b85-e6d5-4b75-a66e-45414f186f76')
returning *;
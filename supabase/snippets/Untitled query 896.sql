insert into public.workspace_members (workspace_id, user_id, role)
values ('8593752f-03ac-4486-837d-f8431c4e05bc', 'de8f1b85-e6d5-4b75-a66e-45414f186f76', 'owner')
on conflict do nothing;
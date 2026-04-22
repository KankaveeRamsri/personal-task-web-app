
set local role authenticated;
set local request.jwt.claim.sub = 'b8f1ccd4-7ccb-4e2f-8a0f-bfa0b8b19734';

delete from tasks
where id = '73c0b1f6-8843-446c-908a-7214748e5569'
returning *;
alter table public.notifications
  add constraint notifications_activity_id_fkey
  foreign key (activity_id) references public.activities (id) on delete cascade;

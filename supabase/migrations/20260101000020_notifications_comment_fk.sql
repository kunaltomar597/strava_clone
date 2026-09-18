alter table public.notifications
  add constraint notifications_comment_id_fkey
  foreign key (comment_id) references public.comments (id) on delete cascade;

-- Ranks a new best effort among the user's all-time efforts at the same
-- distance (top 3 get a badge) and notifies on a new #1, i.e. a PR.
create function public.best_efforts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rank int;
begin
  select count(*) + 1 into v_rank
  from public.best_efforts
  where user_id = new.user_id
    and effort_key = new.effort_key
    and elapsed_time_s < new.elapsed_time_s;

  new.pr_rank := case when v_rank <= 3 then v_rank else null end;
  return new;
end;
$$;

create trigger best_efforts_before_insert
  before insert on public.best_efforts
  for each row
  execute function public.best_efforts_before_insert();

create function public.best_efforts_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pr_rank = 1 then
    insert into public.notifications (recipient_id, actor_id, type, activity_id, data)
    values (
      new.user_id,
      new.user_id,
      'personal_record',
      new.activity_id,
      jsonb_build_object('effortKey', new.effort_key, 'elapsedTimeS', new.elapsed_time_s)
    );
  end if;
  return new;
end;
$$;

create trigger best_efforts_after_insert
  after insert on public.best_efforts
  for each row
  execute function public.best_efforts_after_insert();

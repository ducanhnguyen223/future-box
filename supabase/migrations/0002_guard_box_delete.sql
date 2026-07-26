-- Guard: block deleting a box once opened or past open_at (AC #7, feature 07 race condition).
-- Mirrors guard_box_edit but for DELETE — RLS boxes_owner_delete only checks ownership,
-- not "still locked", so this trigger is the enforcement point for "delete only while locked".
create or replace function public.guard_box_delete()
returns trigger as $$
begin
  if old.opened_at is not null or now() >= old.open_at then
    raise exception 'box is locked-expired or already opened, cannot delete';
  end if;
  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_guard_box_delete on public.boxes;
create trigger trg_guard_box_delete
  before delete on public.boxes
  for each row execute function public.guard_box_delete();

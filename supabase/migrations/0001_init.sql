-- FutureBoxes initial schema, per design/database/schema.md
-- Tables: boxes, box_attachments, push_tokens + view boxes_with_status + RLS + guard trigger + open_box RPC

create extension if not exists pgcrypto;

-- =========================================
-- boxes
-- =========================================
create table if not exists public.boxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_text text not null check (char_length(content_text) <= 2000),
  open_at timestamptz not null,
  opened_at timestamptz null,
  follow_up_question text null check (follow_up_question is null or char_length(follow_up_question) <= 200),
  follow_up_answer boolean null,
  follow_up_answered_at timestamptz null,
  notified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boxes_open_at_future check (open_at > created_at),
  constraint boxes_answer_requires_question check (follow_up_answer is null or follow_up_question is not null)
);

create index if not exists idx_boxes_user_id on public.boxes(user_id);
create index if not exists idx_boxes_open_at_pending on public.boxes(open_at)
  where opened_at is null and notified_at is null;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_boxes_updated_at on public.boxes;
create trigger trg_boxes_updated_at
  before update on public.boxes
  for each row execute function public.set_updated_at();

-- guard: block editing content_text/open_at/follow_up_question once opened or past open_at (AC #2, #7)
create or replace function public.guard_box_edit()
returns trigger as $$
begin
  if old.opened_at is not null or now() >= old.open_at then
    if new.content_text is distinct from old.content_text
      or new.open_at is distinct from old.open_at
      or new.follow_up_question is distinct from old.follow_up_question then
      raise exception 'box is locked-expired or already opened, cannot edit content/open_at/follow_up_question';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_guard_box_edit on public.boxes;
create trigger trg_guard_box_edit
  before update on public.boxes
  for each row execute function public.guard_box_edit();

-- =========================================
-- box_attachments
-- =========================================
create table if not exists public.box_attachments (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null unique references public.boxes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png')),
  size_bytes integer not null check (size_bytes <= 5242880),
  created_at timestamptz not null default now()
);

create index if not exists idx_box_attachments_box_id on public.box_attachments(box_id);

-- =========================================
-- push_tokens
-- =========================================
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  device_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists idx_push_tokens_user_id on public.push_tokens(user_id);

drop trigger if exists trg_push_tokens_updated_at on public.push_tokens;
create trigger trg_push_tokens_updated_at
  before update on public.push_tokens
  for each row execute function public.set_updated_at();

-- =========================================
-- view: boxes_with_status (feature #3)
-- =========================================
create or replace view public.boxes_with_status as
select b.*,
  case
    when b.opened_at is not null then 'opened'
    when now() >= b.open_at then 'ready'
    else 'locked'
  end as status
from public.boxes b;

-- =========================================
-- RLS
-- =========================================
alter table public.boxes enable row level security;
alter table public.box_attachments enable row level security;
alter table public.push_tokens enable row level security;

create policy boxes_owner_select on public.boxes for select using (user_id = auth.uid());
create policy boxes_owner_insert on public.boxes for insert with check (user_id = auth.uid());
create policy boxes_owner_update on public.boxes for update using (user_id = auth.uid());
create policy boxes_owner_delete on public.boxes for delete using (user_id = auth.uid());

create policy box_attachments_owner_select on public.box_attachments for select using (user_id = auth.uid());
create policy box_attachments_owner_insert on public.box_attachments for insert with check (user_id = auth.uid());
create policy box_attachments_owner_delete on public.box_attachments for delete using (user_id = auth.uid());

create policy push_tokens_owner_all on public.push_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================
-- RPC: open_box (feature #4) — server-time gated, prevents client clock tampering
-- =========================================
create or replace function public.open_box(
  p_box_id uuid,
  p_follow_up_answer boolean default null
)
returns public.boxes
security definer
set search_path = public
language plpgsql as $$
declare
  v_box public.boxes;
begin
  select * into v_box from public.boxes where id = p_box_id and user_id = auth.uid();

  if v_box.id is null then
    raise exception 'box not found';
  end if;

  if v_box.opened_at is not null then
    return v_box; -- idempotent: already opened, return as-is (read-only replay)
  end if;

  if now() < v_box.open_at then
    raise exception 'box not ready yet';
  end if;

  if v_box.follow_up_question is not null and p_follow_up_answer is null then
    raise exception 'follow_up_answer is required for this box';
  end if;

  update public.boxes
  set opened_at = now(),
      follow_up_answer = p_follow_up_answer,
      follow_up_answered_at = case when p_follow_up_answer is not null then now() else null end
  where id = p_box_id
  returning * into v_box;

  return v_box;
end;
$$;

revoke all on function public.open_box(uuid, boolean) from public;
grant execute on function public.open_box(uuid, boolean) to authenticated;

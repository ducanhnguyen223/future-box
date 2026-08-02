# Box Kinds + Opening Ritual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four box kinds (letter, goal, prediction, postcard) that differ in structure, and replace the flat navigation into box detail with a gesture-driven opening ritual.

**Architecture:** Four kinds are four kinds of stationery inside one postal world — they share the locked Airmail palette, Lora typography and hard shadows from `design/design-system.md`, and differ only in shape and structure. A single `OpeningRitual` frame drives a `progress` shared value from 0 to 1; four interchangeable seal layers render that progress differently per kind. The server stays authoritative: opening a box and ticking a goal checklist both go through the `open_box` RPC, and the client loses direct UPDATE rights on the columns that decide those outcomes.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, TypeScript, Supabase (Postgres + RLS + RPC), `react-native-reanimated` 4.5, `react-native-gesture-handler` 2.32, `react-native-svg` 15.15, Jest + `jest-expo` + `@testing-library/react-native`.

## Global Constraints

- No new dependencies. `react-native-gesture-handler`, `react-native-reanimated`, `react-native-svg` are already in `package.json`.
- All colours come from `src/constants/theme.ts`. No hex literal may appear anywhere under `src/`.
- All animation uses `Easing.steps()` — deliberately stepped, never smooth. From `design/design-system.md` §3.
- `Radius` is `2` everywhere. `Shadow.flat` and `Shadow.lift` both use `shadowRadius: 0`.
- Every kind × status combination must be distinguishable in a black-and-white screenshot without reading text. From `design/design-system.md` §5.
- Touch targets minimum 44×44 with at least 8px between them.
- Respect `useReducedMotion()` from `src/hooks/use-reduced-motion.ts` in every animated component.
- `npx tsc --noEmit` must be clean and `npm test` fully green before every commit.
- UI copy is Vietnamese. Comments in existing files are Vietnamese — match the file you are editing. Commit messages are English.
- Supabase project id is `mbfhbqdaercybjnsdfev`. Migrations are applied with the Supabase MCP `apply_migration` tool **and** written to `supabase/migrations/` as a file. Never one without the other.

---

### Task 1: Backfill the two missing migration files

The remote database has four futurebox migrations (`futurebox_init`, `futurebox_guard_box_delete`, `futurebox_security_hardening`, `futurebox_storage_bucket`) but `supabase/migrations/` only holds the first two. The last two were applied through MCP without writing files, so the repository cannot reproduce the live schema. Fix that before adding a fifth migration, otherwise the numbering stays wrong forever.

These two files record what is **already applied**. Do not re-apply them.

**Files:**
- Create: `supabase/migrations/0003_security_hardening.sql`
- Create: `supabase/migrations/0004_storage_bucket.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: a correct migration sequence so Task 2 can be numbered `0005`.

- [ ] **Step 1: Write `0003_security_hardening.sql`**

This is the exact SQL already applied as `futurebox_security_hardening`:

```sql
-- Fix advisor findings for FutureBoxes objects
-- ALREADY APPLIED REMOTELY as futurebox_security_hardening (20260728192631).
-- Recorded here so the repository can reproduce the live schema.

-- 1) view should run with querying user's permissions/RLS, not creator's
create or replace view public.boxes_with_status
with (security_invoker = true) as
select b.*,
  case
    when b.opened_at is not null then 'opened'
    when now() >= b.open_at then 'ready'
    else 'locked'
  end as status
from public.boxes b;

-- 2) pin search_path on all FutureBoxes functions
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.guard_box_edit()
returns trigger
language plpgsql
set search_path = public
as $$
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
$$;

create or replace function public.guard_box_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.opened_at is not null or now() >= old.open_at then
    raise exception 'box is locked-expired or already opened, cannot delete';
  end if;
  return old;
end;
$$;

-- 3) open_box must only be callable by signed-in users, never anon
revoke all on function public.open_box(uuid, boolean) from public;
revoke all on function public.open_box(uuid, boolean) from anon;
grant execute on function public.open_box(uuid, boolean) to authenticated;
```

- [ ] **Step 2: Write `0004_storage_bucket.sql`**

```sql
-- Storage bucket for box photos (private, per-user path convention: {user_id}/{filename})
-- ALREADY APPLIED REMOTELY as futurebox_storage_bucket (20260728192652).
-- Recorded here so the repository can reproduce the live schema.
insert into storage.buckets (id, name, public)
values ('box-photos', 'box-photos', false)
on conflict (id) do nothing;

create policy box_photos_owner_select on storage.objects
  for select using (bucket_id = 'box-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy box_photos_owner_insert on storage.objects
  for insert with check (bucket_id = 'box-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy box_photos_owner_delete on storage.objects
  for delete using (bucket_id = 'box-photos' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 3: Verify the sequence is complete**

Run: `ls supabase/migrations/`
Expected exactly:
```
0001_init.sql
0002_guard_box_delete.sql
0003_security_hardening.sql
0004_storage_bucket.sql
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_security_hardening.sql supabase/migrations/0004_storage_bucket.sql
git commit -m "chore: backfill migration files applied only through MCP

The remote database had four futurebox migrations but the repo only held
two files, so the repo could not reproduce the live schema."
```

---

### Task 2: Migration — box kinds, checklist, hardened open_box

**Files:**
- Create: `supabase/migrations/0005_box_kinds.sql`

**Interfaces:**
- Consumes: existing `public.boxes`, `public.boxes_with_status`, `public.guard_box_edit`, `public.open_box(uuid, boolean)`.
- Produces:
  - type `public.box_kind` = `'letter' | 'goal' | 'prediction' | 'postcard'`
  - `boxes.kind public.box_kind not null default 'letter'`
  - `boxes.checklist jsonb` shaped `[{"text": string, "done": boolean}]`
  - `public.open_box(p_box_id uuid, p_follow_up_answer boolean default null, p_checklist jsonb default null) returns boxes`

Three details that will silently break things if skipped:

1. Adding a third parameter with a `DEFAULT` creates an **overload**. Calling `open_box(uuid, boolean)` would then be ambiguous and fail. The old function must be dropped first, and grants re-issued against the new three-argument signature.
2. `create or replace view boxes_with_status` will **fail** — `b.*` expands the two new columns in before `status`, changing column order, which `create or replace` forbids. The view must be dropped and recreated.
3. The client currently holds table-wide `UPDATE` on `boxes`, meaning it can set `opened_at` itself. Replacing that with column-level grants closes the pre-existing hole and blocks direct `checklist` writes in the same stroke.

- [ ] **Step 1: Write the migration**

```sql
-- Feature: four box kinds + goal checklist, with the server still deciding outcomes.

create type public.box_kind as enum ('letter', 'goal', 'prediction', 'postcard');

alter table public.boxes
  add column kind public.box_kind not null default 'letter',
  add column checklist jsonb;

alter table public.boxes
  add constraint boxes_goal_has_checklist
    check ((kind = 'goal') = (checklist is not null)),
  add constraint boxes_goal_checklist_size
    check (kind <> 'goal' or jsonb_array_length(checklist) between 1 and 7),
  add constraint boxes_prediction_has_question
    check (kind <> 'prediction' or follow_up_question is not null);

-- The view must be dropped: b.* would reorder columns and create-or-replace forbids that.
drop view public.boxes_with_status;

create view public.boxes_with_status
with (security_invoker = true) as
select b.*,
  case
    when b.opened_at is not null then 'opened'
    when now() >= b.open_at then 'ready'
    else 'locked'
  end as status
from public.boxes b;

-- kind is immutable once the box exists.
create or replace function public.guard_box_edit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'kind is immutable';
  end if;

  if old.opened_at is not null or now() >= old.open_at then
    if new.content_text is distinct from old.content_text
      or new.open_at is distinct from old.open_at
      or new.follow_up_question is distinct from old.follow_up_question then
      raise exception 'box is locked-expired or already opened, cannot edit content/open_at/follow_up_question';
    end if;
  end if;
  return new;
end;
$$;

-- Column-level grants: the client may edit only what it is allowed to edit.
-- This also closes a pre-existing hole where a client could set opened_at directly.
revoke update on public.boxes from authenticated;
grant update (content_text, open_at, follow_up_question) on public.boxes to authenticated;

-- Adding a defaulted third parameter would create an ambiguous overload. Drop first.
drop function public.open_box(uuid, boolean);

create function public.open_box(
  p_box_id uuid,
  p_follow_up_answer boolean default null,
  p_checklist jsonb default null
)
returns public.boxes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_box public.boxes;
  v_expected_texts jsonb;
  v_given_texts jsonb;
begin
  select * into v_box from public.boxes where id = p_box_id and user_id = auth.uid();

  if v_box.id is null then
    raise exception 'box not found';
  end if;

  if v_box.opened_at is not null then
    return v_box;
  end if;

  if now() < v_box.open_at then
    raise exception 'box not ready yet';
  end if;

  if v_box.follow_up_question is not null and p_follow_up_answer is null then
    raise exception 'follow_up_answer is required for this box';
  end if;

  if v_box.kind = 'goal' then
    if p_checklist is null then
      raise exception 'checklist is required for this box';
    end if;

    if exists (
      select 1 from jsonb_array_elements(p_checklist) as e(value)
      where jsonb_typeof(e.value -> 'done') <> 'boolean'
    ) then
      raise exception 'checklist done flags must be boolean';
    end if;

    select jsonb_agg(t.value -> 'text' order by t.ord)
      into v_expected_texts
      from jsonb_array_elements(v_box.checklist) with ordinality as t(value, ord);

    select jsonb_agg(t.value -> 'text' order by t.ord)
      into v_given_texts
      from jsonb_array_elements(p_checklist) with ordinality as t(value, ord);

    if v_expected_texts is distinct from v_given_texts then
      raise exception 'checklist items were modified';
    end if;
  elsif p_checklist is not null then
    raise exception 'checklist is only allowed for goal boxes';
  end if;

  update public.boxes
  set opened_at = now(),
      follow_up_answer = p_follow_up_answer,
      follow_up_answered_at = case when p_follow_up_answer is not null then now() else null end,
      checklist = case when v_box.kind = 'goal' then p_checklist else checklist end
  where id = p_box_id
  returning * into v_box;

  return v_box;
end;
$$;

revoke all on function public.open_box(uuid, boolean, jsonb) from public;
revoke all on function public.open_box(uuid, boolean, jsonb) from anon;
grant execute on function public.open_box(uuid, boolean, jsonb) to authenticated;
```

- [ ] **Step 2: Apply it remotely**

Use the Supabase MCP tool `apply_migration` with `project_id: mbfhbqdaercybjnsdfev`, `name: futurebox_box_kinds`, and the SQL above.

Expected: success, no error.

- [ ] **Step 3: Verify the constraints reject bad data**

Run each of these through the Supabase MCP `execute_sql` tool. Each must **fail**:

```sql
-- goal without checklist
insert into public.boxes (user_id, content_text, open_at, kind)
values ('00000000-0000-0000-0000-000000000000', 'x', now() + interval '1 day', 'goal');
```
Expected: violates `boxes_goal_has_checklist`.

```sql
-- letter with a checklist
insert into public.boxes (user_id, content_text, open_at, kind, checklist)
values ('00000000-0000-0000-0000-000000000000', 'x', now() + interval '1 day', 'letter', '[]'::jsonb);
```
Expected: violates `boxes_goal_has_checklist`.

```sql
-- goal with eight items
insert into public.boxes (user_id, content_text, open_at, kind, checklist)
values ('00000000-0000-0000-0000-000000000000', 'x', now() + interval '1 day', 'goal',
  '[{"text":"1","done":false},{"text":"2","done":false},{"text":"3","done":false},{"text":"4","done":false},{"text":"5","done":false},{"text":"6","done":false},{"text":"7","done":false},{"text":"8","done":false}]'::jsonb);
```
Expected: violates `boxes_goal_checklist_size`.

```sql
-- prediction without a question
insert into public.boxes (user_id, content_text, open_at, kind)
values ('00000000-0000-0000-0000-000000000000', 'x', now() + interval '1 day', 'prediction');
```
Expected: violates `boxes_prediction_has_question`.

- [ ] **Step 4: Verify the client can no longer write the protected columns**

```sql
select array_agg(column_name order by column_name)
from information_schema.column_privileges
where table_name = 'boxes' and grantee = 'authenticated' and privilege_type = 'UPDATE';
```
Expected exactly: `{content_text,follow_up_question,open_at}`. If `opened_at`, `checklist` or `kind` appear, the grant step did not take.

- [ ] **Step 5: Verify only the three-argument RPC exists**

```sql
select pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'open_box';
```
Expected exactly one row: `p_box_id uuid, p_follow_up_answer boolean, p_checklist jsonb`.

- [ ] **Step 6: Run the advisors**

Use the Supabase MCP `get_advisors` tool with `type: security`.
Expected: no new findings for `boxes`, `boxes_with_status` or `open_box`. The view must still report as `security_invoker`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0005_box_kinds.sql
git commit -m "feat(db): add box kinds, goal checklist and column-level update grants

Adds the box_kind enum and checklist column with integrity constraints,
makes kind immutable, and rebuilds open_box so ticking a goal checklist
is decided server-side. Replaces the table-wide UPDATE grant with
column-level grants, which also closes a pre-existing hole where a
client could set opened_at itself."
```

---

### Task 3: Types and service layer

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/services/boxes.ts:40-61` (`InsertBoxParams`, `insertBox`) and `src/services/boxes.ts:124-132` (`openBox`)
- Test: `src/services/__tests__/boxes.test.ts` (add to the existing file)

**Interfaces:**
- Consumes: the RPC signature from Task 2.
- Produces:
  - `export type BoxKind = 'letter' | 'goal' | 'prediction' | 'postcard'`
  - `export interface ChecklistItem { text: string; done: boolean }`
  - `Box` gains `kind: BoxKind` and `checklist: ChecklistItem[] | null`
  - `InsertBoxParams` gains `kind: BoxKind` and `checklist: ChecklistItem[] | null`
  - `openBox(boxId: string, followUpAnswer?: boolean, checklist?: ChecklistItem[] | null): Promise<Box>`

- [ ] **Step 1: Write the failing tests**

Append to `src/services/__tests__/boxes.test.ts`:

```ts
describe('insertBox with kinds', () => {
  it('sends kind and checklist to the boxes table', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'box-1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    (supabase.from as jest.Mock).mockReturnValue({ insert });

    await insertBox({
      userId: 'user-1',
      contentText: 'hello',
      openAt: '2030-01-01T00:00:00.000Z',
      followUpQuestion: null,
      kind: 'goal',
      checklist: [{ text: 'Chạy 10km', done: false }],
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'goal',
        checklist: [{ text: 'Chạy 10km', done: false }],
      })
    );
  });

  it('sends a null checklist for non-goal kinds', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'box-1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    (supabase.from as jest.Mock).mockReturnValue({ insert });

    await insertBox({
      userId: 'user-1',
      contentText: 'hello',
      openAt: '2030-01-01T00:00:00.000Z',
      followUpQuestion: null,
      kind: 'letter',
      checklist: null,
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'letter', checklist: null }));
  });
});

describe('openBox with checklist', () => {
  it('passes the checklist to the RPC', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: { id: 'box-1' }, error: null });

    await openBox('box-1', undefined, [{ text: 'Chạy 10km', done: true }]);

    expect(supabase.rpc).toHaveBeenCalledWith('open_box', {
      p_box_id: 'box-1',
      p_follow_up_answer: null,
      p_checklist: [{ text: 'Chạy 10km', done: true }],
    });
  });

  it('passes a null checklist when none is given', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: { id: 'box-1' }, error: null });

    await openBox('box-1');

    expect(supabase.rpc).toHaveBeenCalledWith('open_box', {
      p_box_id: 'box-1',
      p_follow_up_answer: null,
      p_checklist: null,
    });
  });
});
```

If `src/services/__tests__/boxes.test.ts` does not already mock `@/lib/supabase`, mirror the mock style used by the existing tests in that file rather than inventing a new one.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/services/__tests__/boxes.test.ts`
Expected: FAIL — `insert` called without `kind`, and `rpc` called without `p_checklist`.

- [ ] **Step 3: Add the types**

In `src/types/database.ts`, above `interface Box`:

```ts
export type BoxKind = 'letter' | 'goal' | 'prediction' | 'postcard';

export interface ChecklistItem {
  text: string;
  done: boolean;
}
```

Then add these two fields to `interface Box`, after `content_text`:

```ts
  kind: BoxKind;
  checklist: ChecklistItem[] | null;
```

- [ ] **Step 4: Update the service**

In `src/services/boxes.ts`, extend `InsertBoxParams`:

```ts
export type InsertBoxParams = {
  userId: string;
  contentText: string;
  openAt: string;
  followUpQuestion: string | null;
  kind: BoxKind;
  checklist: ChecklistItem[] | null;
};
```

and the insert payload inside `insertBox`:

```ts
    .insert({
      user_id: params.userId,
      content_text: params.contentText,
      open_at: params.openAt,
      follow_up_question: params.followUpQuestion,
      kind: params.kind,
      checklist: params.checklist,
    })
```

Replace `openBox` with:

```ts
export async function openBox(
  boxId: string,
  followUpAnswer?: boolean,
  checklist?: ChecklistItem[] | null
): Promise<Box> {
  const { data, error } = await supabase.rpc('open_box', {
    p_box_id: boxId,
    p_follow_up_answer: followUpAnswer ?? null,
    p_checklist: checklist ?? null,
  });

  if (error) throw error;
  return data as Box;
}
```

Add `BoxKind` and `ChecklistItem` to the existing type import at the top of the file.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/services/__tests__/boxes.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in call sites that do not yet pass `kind`/`checklist` — note them, they are fixed in Task 12. If `tsc` is clean, no call site needed updating.

- [ ] **Step 7: Commit**

```bash
git add src/types/database.ts src/services/boxes.ts src/services/__tests__/boxes.test.ts
git commit -m "feat: thread box kind and checklist through the service layer"
```

---

### Task 4: Checklist validation

**Files:**
- Modify: `src/lib/validation.ts`
- Test: `src/lib/__tests__/validation.test.ts` (add to the existing file)

**Interfaces:**
- Consumes: `ChecklistItem` from Task 3.
- Produces:
  - `export const MAX_CHECKLIST_ITEMS = 7`
  - `export const MAX_CHECKLIST_ITEM_LENGTH = 120`
  - `export function isValidChecklist(items: ChecklistItem[]): boolean`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/validation.test.ts`:

```ts
describe('isValidChecklist', () => {
  it('accepts one to seven non-empty items', () => {
    expect(isValidChecklist([{ text: 'Chạy 10km', done: false }])).toBe(true);
    expect(
      isValidChecklist(
        Array.from({ length: 7 }, (_, index) => ({ text: `Mục ${index}`, done: false }))
      )
    ).toBe(true);
  });

  it('rejects an empty list', () => {
    expect(isValidChecklist([])).toBe(false);
  });

  it('rejects more than seven items', () => {
    expect(
      isValidChecklist(
        Array.from({ length: 8 }, (_, index) => ({ text: `Mục ${index}`, done: false }))
      )
    ).toBe(false);
  });

  it('rejects an item that is empty or only whitespace', () => {
    expect(isValidChecklist([{ text: '', done: false }])).toBe(false);
    expect(isValidChecklist([{ text: '   ', done: false }])).toBe(false);
  });

  it('rejects an item longer than the limit', () => {
    expect(isValidChecklist([{ text: 'x'.repeat(121), done: false }])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/lib/__tests__/validation.test.ts -t isValidChecklist`
Expected: FAIL — `isValidChecklist is not defined`.

- [ ] **Step 3: Implement**

Append to `src/lib/validation.ts`:

```ts
export const MAX_CHECKLIST_ITEMS = 7;
export const MAX_CHECKLIST_ITEM_LENGTH = 120;

/** Mục tiêu phải có ít nhất 1 mục, tối đa 7, không mục nào rỗng — khớp CHECK ở migration 0005. */
export function isValidChecklist(items: ChecklistItem[]): boolean {
  if (items.length < 1 || items.length > MAX_CHECKLIST_ITEMS) return false;
  return items.every((item) => {
    const trimmed = item.text.trim();
    return trimmed.length > 0 && trimmed.length <= MAX_CHECKLIST_ITEM_LENGTH;
  });
}
```

Import `ChecklistItem` from `@/types/database` at the top of the file.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/lib/__tests__/validation.test.ts`
Expected: PASS, including the pre-existing tests in that file.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts src/lib/__tests__/validation.test.ts
git commit -m "feat: validate goal checklists client-side to match the DB constraint"
```

---

### Task 5: KindPicker component

Four small stamp-shaped tiles. Each tile draws the silhouette of its stationery so the choice reads without labels. No emoji as icons.

**Files:**
- Create: `src/components/paper/kind-picker.tsx`
- Test: `src/components/paper/__tests__/kind-picker.test.tsx`

**Interfaces:**
- Consumes: `BoxKind` from Task 3; `Colors`, `Radius`, `Spacing` from `@/constants/theme`.
- Produces: `export function KindPicker(props: { value: BoxKind; onChange: (kind: BoxKind) => void }): JSX.Element`
- Produces: `export const KIND_LABELS: Record<BoxKind, string>` = `{ letter: 'Thư', goal: 'Mục tiêu', prediction: 'Dự đoán', postcard: 'Bưu thiếp' }` — exported so any later screen naming a kind uses one spelling, though no task in this plan imports it yet.

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { KindPicker } from '@/components/paper/kind-picker';

describe('KindPicker', () => {
  it('renders all four kinds', () => {
    render(<KindPicker value="letter" onChange={jest.fn()} />);

    expect(screen.getByText('Thư')).toBeTruthy();
    expect(screen.getByText('Mục tiêu')).toBeTruthy();
    expect(screen.getByText('Dự đoán')).toBeTruthy();
    expect(screen.getByText('Bưu thiếp')).toBeTruthy();
  });

  it('marks the selected kind as selected for assistive tech', () => {
    render(<KindPicker value="goal" onChange={jest.fn()} />);

    expect(screen.getByLabelText('Mục tiêu').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Thư').props.accessibilityState.selected).toBe(false);
  });

  it('reports the chosen kind', () => {
    const onChange = jest.fn();
    render(<KindPicker value="letter" onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('Dự đoán'));

    expect(onChange).toHaveBeenCalledWith('prediction');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/components/paper/__tests__/kind-picker.test.tsx`
Expected: FAIL — cannot resolve `@/components/paper/kind-picker`.

- [ ] **Step 3: Implement**

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { BoxKind } from '@/types/database';

export const KIND_LABELS: Record<BoxKind, string> = {
  letter: 'Thư',
  goal: 'Mục tiêu',
  prediction: 'Dự đoán',
  postcard: 'Bưu thiếp',
};

const KIND_ORDER: BoxKind[] = ['letter', 'goal', 'prediction', 'postcard'];

/** Bóng của từng loại văn phòng phẩm — nhận ra được mà không cần đọc nhãn. */
function KindGlyph({ kind, color }: { kind: BoxKind; color: string }) {
  return (
    <Svg width={34} height={26} viewBox="0 0 34 26">
      <Rect x={1} y={1} width={32} height={24} rx={1} stroke={color} strokeWidth={1.4} fill="none" />
      {kind === 'letter' ? <Path d="M1 1 L17 14 L33 1" stroke={color} strokeWidth={1.4} fill="none" /> : null}
      {kind === 'goal' ? (
        <>
          <Line x1={7} y1={9} x2={27} y2={9} stroke={color} strokeWidth={1.2} />
          <Line x1={7} y1={14} x2={27} y2={14} stroke={color} strokeWidth={1.2} />
          <Line x1={7} y1={19} x2={20} y2={19} stroke={color} strokeWidth={1.2} />
        </>
      ) : null}
      {kind === 'prediction' ? <Path d="M22 1 L33 12" stroke={color} strokeWidth={3} /> : null}
      {kind === 'postcard' ? (
        <>
          <Line x1={17} y1={1} x2={17} y2={25} stroke={color} strokeWidth={1.2} />
          <Rect x={24} y={5} width={6} height={7} stroke={color} strokeWidth={1.2} fill="none" />
          <Circle cx={9} cy={9} r={2.5} stroke={color} strokeWidth={1.2} fill="none" />
        </>
      ) : null}
    </Svg>
  );
}

export function KindPicker({ value, onChange }: { value: BoxKind; onChange: (kind: BoxKind) => void }) {
  return (
    <View style={styles.row}>
      {KIND_ORDER.map((kind) => {
        const selected = kind === value;
        return (
          <Pressable
            key={kind}
            accessibilityRole="radio"
            accessibilityLabel={KIND_LABELS[kind]}
            accessibilityState={{ selected }}
            onPress={() => onChange(kind)}
            style={[styles.tile, selected && styles.tileSelected]}
          >
            <KindGlyph kind={kind} color={selected ? Colors.blue : Colors.ink3} />
            <ThemedText type="monoLabel" themeColor={selected ? 'blue' : 'ink3'}>
              {KIND_LABELS[kind]}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.rule,
    borderRadius: Radius,
    backgroundColor: Colors.paper,
  },
  tileSelected: {
    borderStyle: 'solid',
    borderColor: Colors.blue,
    backgroundColor: Colors.paperDim,
  },
});
```

`ThemedText` must already accept `themeColor="blue"`. If it does not, add `blue` to its `themeColor` union in `src/components/themed-text.tsx` rather than reaching for a hex literal.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/components/paper/__tests__/kind-picker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/paper/kind-picker.tsx src/components/paper/__tests__/kind-picker.test.tsx
git commit -m "feat: add kind picker with per-kind stationery glyphs"
```

---

### Task 6: ChecklistField component

Used twice: to write the goals when creating a goal box, and to tick them when opening one. One component, two modes.

**Files:**
- Create: `src/components/paper/checklist-field.tsx`
- Test: `src/components/paper/__tests__/checklist-field.test.tsx`

**Interfaces:**
- Consumes: `ChecklistItem` from Task 3, `MAX_CHECKLIST_ITEMS` and `MAX_CHECKLIST_ITEM_LENGTH` from Task 4.
- Produces: `export function ChecklistField(props: { items: ChecklistItem[]; mode: 'edit' | 'tick'; onChange: (items: ChecklistItem[]) => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ChecklistField } from '@/components/paper/checklist-field';

const ITEMS = [
  { text: 'Chạy 10km', done: false },
  { text: 'Đọc 12 cuốn sách', done: false },
];

describe('ChecklistField in edit mode', () => {
  it('adds an empty item', () => {
    const onChange = jest.fn();
    render(<ChecklistField items={ITEMS} mode="edit" onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('Thêm mục'));

    expect(onChange).toHaveBeenCalledWith([...ITEMS, { text: '', done: false }]);
  });

  it('hides the add control at seven items', () => {
    const full = Array.from({ length: 7 }, (_, index) => ({ text: `Mục ${index}`, done: false }));
    render(<ChecklistField items={full} mode="edit" onChange={jest.fn()} />);

    expect(screen.queryByLabelText('Thêm mục')).toBeNull();
  });

  it('removes the item at the given index', () => {
    const onChange = jest.fn();
    render(<ChecklistField items={ITEMS} mode="edit" onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('Xóa mục 1'));

    expect(onChange).toHaveBeenCalledWith([{ text: 'Đọc 12 cuốn sách', done: false }]);
  });

  it('edits the text of one item without touching the others', () => {
    const onChange = jest.fn();
    render(<ChecklistField items={ITEMS} mode="edit" onChange={onChange} />);

    fireEvent.changeText(screen.getByLabelText('Mục 1'), 'Chạy 21km');

    expect(onChange).toHaveBeenCalledWith([
      { text: 'Chạy 21km', done: false },
      { text: 'Đọc 12 cuốn sách', done: false },
    ]);
  });
});

describe('ChecklistField in tick mode', () => {
  it('toggles done and never exposes a text input', () => {
    const onChange = jest.fn();
    render(<ChecklistField items={ITEMS} mode="tick" onChange={onChange} />);

    expect(screen.queryByLabelText('Mục 1')).toBeNull();
    fireEvent.press(screen.getByLabelText('Chạy 10km'));

    expect(onChange).toHaveBeenCalledWith([
      { text: 'Chạy 10km', done: true },
      { text: 'Đọc 12 cuốn sách', done: false },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/components/paper/__tests__/checklist-field.test.tsx`
Expected: FAIL — cannot resolve `@/components/paper/checklist-field`.

- [ ] **Step 3: Implement**

```tsx
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { MAX_CHECKLIST_ITEMS, MAX_CHECKLIST_ITEM_LENGTH } from '@/lib/validation';
import type { ChecklistItem } from '@/types/database';

type ChecklistFieldProps = {
  items: ChecklistItem[];
  /** 'edit' khi tạo hộp, 'tick' khi mở hộp — mở hộp không được sửa nội dung mục tiêu. */
  mode: 'edit' | 'tick';
  onChange: (items: ChecklistItem[]) => void;
};

export function ChecklistField({ items, mode, onChange }: ChecklistFieldProps) {
  const replaceAt = (index: number, next: ChecklistItem) =>
    onChange(items.map((item, position) => (position === index ? next : item)));

  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={index} style={styles.row}>
          {mode === 'tick' ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={item.text}
              accessibilityState={{ checked: item.done }}
              onPress={() => replaceAt(index, { ...item, done: !item.done })}
              style={styles.tickRow}
              hitSlop={8}
            >
              <View style={[styles.box, item.done && styles.boxChecked]}>
                {item.done ? (
                  <ThemedText type="monoLabel" style={styles.checkMark}>
                    ×
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText type="default" style={styles.tickLabel}>
                {item.text}
              </ThemedText>
            </Pressable>
          ) : (
            <>
              <TextInput
                accessibilityLabel={`Mục ${index + 1}`}
                value={item.text}
                onChangeText={(text) =>
                  replaceAt(index, { ...item, text: text.slice(0, MAX_CHECKLIST_ITEM_LENGTH) })
                }
                placeholder="Một mục tiêu"
                placeholderTextColor={Colors.ink3}
                style={styles.input}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Xóa mục ${index + 1}`}
                onPress={() => onChange(items.filter((_, position) => position !== index))}
                style={styles.removeButton}
                hitSlop={8}
              >
                <ThemedText type="monoLabel" style={styles.removeLabel}>
                  Xóa
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>
      ))}

      {mode === 'edit' && items.length < MAX_CHECKLIST_ITEMS ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thêm mục"
          onPress={() => onChange([...items, { text: '', done: false }])}
          style={styles.addButton}
        >
          <ThemedText type="default" themeColor="ink2">
            + Thêm mục
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
  },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius,
    color: Colors.ink,
    fontFamily: Fonts.serif,
    fontSize: 16,
  },
  removeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeLabel: {
    color: Colors.red,
  },
  tickRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 44,
  },
  box: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: Colors.ink2,
    borderRadius: Radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    borderColor: Colors.red,
  },
  checkMark: {
    color: Colors.red,
    fontSize: 16,
  },
  tickLabel: {
    flex: 1,
  },
  addButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.ink3,
    borderRadius: Radius,
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/components/paper/__tests__/checklist-field.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/paper/checklist-field.tsx src/components/paper/__tests__/checklist-field.test.tsx
git commit -m "feat: add checklist field with separate edit and tick modes"
```

---

### Task 7: PaperCard kind variants

`PaperCard` currently renders one shape for all boxes. It gains a `kind` prop and four silhouettes. The three-status rules from `design/design-system.md` §5 still hold on top of the kind.

**Files:**
- Modify: `src/components/paper/paper-card.tsx`
- Test: `src/components/paper/__tests__/paper-card.test.tsx` (extend the existing three tests)

**Interfaces:**
- Consumes: `BoxKind`, `ChecklistItem` from Task 3.
- Produces: `PaperCardProps` gains `kind: BoxKind`, `checklist?: ChecklistItem[] | null`, `photoUrl?: string`.

Visual markers, each carried by its own `testID` so a test can assert it without reading colour:

| kind | locked / ready marker | testID | opened marker | testID |
|---|---|---|---|---|
| `letter` | folded flap triangle | `card-flap` | torn top edge (existing `TornEdge`) | `card-torn` |
| `goal` | ruled lines + `N MỤC` label | `card-ruled` | ruled lines + `done/total` stamp | `card-score` |
| `prediction` | diagonal red seal band | `card-seal` | broken seal band | `card-seal-broken` |
| `postcard` | back side: divider line + empty stamp box, **no photo** | `card-back` | front side, photo only when `photoUrl` is given | `card-front` |

`photoUrl` is optional and the list screen does not pass it — see Task 13. An opened postcard therefore renders the front frame with an empty photo well, which still reads as "flipped over" against the locked back side. The prop exists so a detail-level or preview caller can supply a real URL without changing this component.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/paper/__tests__/paper-card.test.tsx`:

```tsx
const OPEN_AT = '2030-01-01T00:00:00.000Z';

describe('PaperCard kind silhouettes', () => {
  it('shows the envelope flap for a locked letter', () => {
    render(
      <PaperCard kind="letter" status="locked" title="Gửi tôi" openAt={OPEN_AT} onPress={jest.fn()} />
    );
    expect(screen.getByTestId('card-flap')).toBeTruthy();
  });

  it('shows ruled lines and the item count for a locked goal', () => {
    render(
      <PaperCard
        kind="goal"
        status="locked"
        title="Mục tiêu 2030"
        openAt={OPEN_AT}
        checklist={[
          { text: 'a', done: false },
          { text: 'b', done: false },
        ]}
        onPress={jest.fn()}
      />
    );
    expect(screen.getByTestId('card-ruled')).toBeTruthy();
    expect(screen.getByText('2 MỤC')).toBeTruthy();
  });

  it('shows the score stamp for an opened goal', () => {
    render(
      <PaperCard
        kind="goal"
        status="opened"
        title="Mục tiêu 2030"
        openAt={OPEN_AT}
        checklist={[
          { text: 'a', done: true },
          { text: 'b', done: false },
          { text: 'c', done: true },
        ]}
        onPress={jest.fn()}
      />
    );
    expect(screen.getByTestId('card-score')).toBeTruthy();
    expect(screen.getByText('2/3')).toBeTruthy();
  });

  it('shows an intact seal for a locked prediction and a broken one when opened', () => {
    const { rerender } = render(
      <PaperCard kind="prediction" status="locked" title="Tôi sẽ" openAt={OPEN_AT} onPress={jest.fn()} />
    );
    expect(screen.getByTestId('card-seal')).toBeTruthy();

    rerender(
      <PaperCard kind="prediction" status="opened" title="Tôi sẽ" openAt={OPEN_AT} onPress={jest.fn()} />
    );
    expect(screen.getByTestId('card-seal-broken')).toBeTruthy();
  });

  it('shows the postcard back while locked and never the photo', () => {
    render(
      <PaperCard kind="postcard" status="locked" title="Hè 2026" openAt={OPEN_AT} onPress={jest.fn()} />
    );
    expect(screen.getByTestId('card-back')).toBeTruthy();
    expect(screen.queryByTestId('card-front')).toBeNull();
  });

  it('shows the postcard front once opened, with or without a photo', () => {
    const { rerender } = render(
      <PaperCard kind="postcard" status="opened" title="Hè 2026" openAt={OPEN_AT} onPress={jest.fn()} />
    );
    expect(screen.getByTestId('card-front')).toBeTruthy();
    expect(screen.queryByTestId('card-back')).toBeNull();

    rerender(
      <PaperCard
        kind="postcard"
        status="opened"
        title="Hè 2026"
        openAt={OPEN_AT}
        photoUrl="https://example.test/p.jpg"
        onPress={jest.fn()}
      />
    );
    expect(screen.getByTestId('card-front')).toBeTruthy();
  });
});
```

Update the three pre-existing tests in this file to pass `kind="letter"`, since `kind` is now required.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/components/paper/__tests__/paper-card.test.tsx`
Expected: FAIL — the new testIDs do not exist.

- [ ] **Step 3: Implement**

In `src/components/paper/paper-card.tsx`, extend the props:

```tsx
type PaperCardProps = {
  kind: BoxKind;
  status: PaperCardStatus;
  title: string;
  preview?: string;
  openAt: string;
  meta?: string;
  checklist?: ChecklistItem[] | null;
  photoUrl?: string;
  onPress?: () => void;
};
```

Keep the existing shell — the `Animated.View` wrapper, the `nudge` shake on a locked press, the `paperDim`/`paper` background rule and `PostmarkStamp`. Add these silhouette pieces to the file:

```tsx
/** Nắp phong bì gập xuống — dấu hiệu của loại Thư khi chưa mở. */
function EnvelopeFlap() {
  return (
    <Svg testID="card-flap" width="100%" height={22} viewBox="0 0 100 22" preserveAspectRatio="none">
      <Path d="M0,0 L50,20 L100,0 Z" fill={Colors.paperDim} stroke={Colors.rule} strokeWidth={0.6} />
    </Svg>
  );
}

/** Dòng kẻ của tờ biểu mẫu — dấu hiệu của loại Mục tiêu. */
function RuledLines() {
  return (
    <Svg testID="card-ruled" width="100%" height={34} viewBox="0 0 100 34" preserveAspectRatio="none">
      <Line x1={0} y1={8} x2={100} y2={8} stroke={Colors.ruleSoft} strokeWidth={0.8} />
      <Line x1={0} y1={18} x2={100} y2={18} stroke={Colors.ruleSoft} strokeWidth={0.8} />
      <Line x1={0} y1={28} x2={100} y2={28} stroke={Colors.ruleSoft} strokeWidth={0.8} />
    </Svg>
  );
}

/** Băng niêm đỏ chéo góc — dấu hiệu của loại Dự đoán. Bóc rồi thì đứt đoạn. */
function SealBand({ broken }: { broken: boolean }) {
  return (
    <Svg
      testID={broken ? 'card-seal-broken' : 'card-seal'}
      width={54}
      height={54}
      viewBox="0 0 54 54"
      style={styles.sealBand}
    >
      {broken ? (
        <>
          <Path d="M14 0 L54 40" stroke={Colors.red} strokeWidth={6} opacity={0.5} />
          <Path d="M30 16 L34 20" stroke={Colors.paper} strokeWidth={7} />
        </>
      ) : (
        <Path d="M14 0 L54 40" stroke={Colors.red} strokeWidth={6} />
      )}
    </Svg>
  );
}

/** Mặt sau bưu thiếp: vạch chia đôi và ô tem trống. Cố ý không tải ảnh khi còn khóa. */
function PostcardBack() {
  return (
    <Svg testID="card-back" width="100%" height={54} viewBox="0 0 100 54" preserveAspectRatio="none">
      <Line x1={50} y1={4} x2={50} y2={50} stroke={Colors.ruleSoft} strokeWidth={0.8} />
      <Rect
        x={78}
        y={6}
        width={16}
        height={18}
        stroke={Colors.rule}
        strokeWidth={0.8}
        strokeDasharray="2 2"
        fill="none"
      />
    </Svg>
  );
}

function checklistScore(checklist: ChecklistItem[] | null | undefined): string | null {
  if (!checklist || checklist.length === 0) return null;
  return `${checklist.filter((item) => item.done).length}/${checklist.length}`;
}
```

Render the kind layer with a single switch inside the card, before `styles.body`:

- `letter` + not opened → `<EnvelopeFlap />`; opened → the existing `<TornEdge />`, which must be given `testID="card-torn"`.
- `goal` → always `<RuledLines />`; when locked or ready also render a `monoLabel` reading `` `${checklist?.length ?? 0} MỤC` ``; when opened render `<View testID="card-score">` containing a `monoLabel` with `checklistScore(checklist)`.
- `prediction` → `<SealBand broken={status === 'opened'} />`.
- `postcard` → when `status === 'opened'`, render `<View testID="card-front" style={styles.cardPhoto}>` holding an `expo-image` `<Image source={{ uri: photoUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />` only when `photoUrl` is set; otherwise, when not opened, render `<PostcardBack />`. The front/back decision keys off `status`, never off `photoUrl` — an opened postcard with no URL must still read as flipped.

Import `Line`, `Rect` alongside the existing `Path` from `react-native-svg`, `Image` from `expo-image`, and `BoxKind`/`ChecklistItem` from `@/types/database`. Add to the stylesheet:

```tsx
  sealBand: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  cardPhoto: {
    width: '100%',
    height: 132,
  },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/components/paper/__tests__/paper-card.test.tsx`
Expected: PASS, all previous and new tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: an error at `src/app/(app)/index.tsx` because `kind` is now required — that is fixed in Task 13.

- [ ] **Step 6: Commit**

```bash
git add src/components/paper/paper-card.tsx src/components/paper/__tests__/paper-card.test.tsx
git commit -m "feat: give PaperCard a distinct silhouette per box kind"
```

---

### Task 8: OpeningRitual frame

The frame owns the three beats and the release decision. Gesture behaviour itself is verified by hand on a device; the unit tests cover the release rule and the reduced-motion path, which is where the bugs actually live.

The Jest environment needs two additions before this component is testable: `react-native-gesture-handler`'s own jest setup, and three Reanimated APIs the hand-written mock in `jest.setup.js` does not yet expose (`runOnJS`, `withSpring`, `useAnimatedReaction`). Fold both into this task.

Implement Task 9 before this task, or the four seal imports will not resolve.

**Files:**
- Create: `src/components/paper/opening-ritual.tsx`
- Modify: `jest.setup.js`
- Test: `src/components/paper/__tests__/opening-ritual.test.tsx`

**Interfaces:**
- Consumes: `BoxKind` from Task 3; `useReducedMotion` from `@/hooks/use-reduced-motion`; the four seals from Task 9.
- Produces:
  - `export const OPEN_THRESHOLD = 0.6`
  - `export function resolveRelease(progress: number): 'open' | 'reset'`
  - `export function OpeningRitual(props: { kind: BoxKind; onOpened: () => void; disabled?: boolean; children: React.ReactNode }): JSX.Element`

- [ ] **Step 1: Extend the Jest setup**

In `jest.setup.js`, inside the hand-written `react-native-reanimated` mock factory, add these three to the returned object:

```js
  runOnJS: (fn) => fn,
  withSpring: (toValue) => toValue,
  useAnimatedReaction: () => {},
```

Then append at the end of the file:

```js
require('react-native-gesture-handler/jestSetup');
```

- [ ] **Step 2: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { OpeningRitual, OPEN_THRESHOLD, resolveRelease } from '@/components/paper/opening-ritual';

const mockUseReducedMotion = jest.fn();
jest.mock('@/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

describe('resolveRelease', () => {
  it('opens at or past the threshold', () => {
    expect(resolveRelease(OPEN_THRESHOLD)).toBe('open');
    expect(resolveRelease(1)).toBe('open');
  });

  it('resets below the threshold', () => {
    expect(resolveRelease(0)).toBe('reset');
    expect(resolveRelease(OPEN_THRESHOLD - 0.01)).toBe('reset');
  });
});

describe('OpeningRitual with reduced motion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReducedMotion.mockReturnValue(true);
  });

  it('offers a button instead of a gesture', () => {
    render(
      <OpeningRitual kind="letter" onOpened={jest.fn()}>
        <Text>nội dung</Text>
      </OpeningRitual>
    );

    expect(screen.getByLabelText('Mở hộp')).toBeTruthy();
  });

  it('opens straight away when the button is pressed', () => {
    const onOpened = jest.fn();
    render(
      <OpeningRitual kind="letter" onOpened={onOpened}>
        <Text>nội dung</Text>
      </OpeningRitual>
    );

    fireEvent.press(screen.getByLabelText('Mở hộp'));

    expect(onOpened).toHaveBeenCalledTimes(1);
  });

  it('does not open when disabled', () => {
    const onOpened = jest.fn();
    render(
      <OpeningRitual kind="letter" onOpened={onOpened} disabled>
        <Text>nội dung</Text>
      </OpeningRitual>
    );

    fireEvent.press(screen.getByLabelText('Mở hộp'));

    expect(onOpened).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/components/paper/__tests__/opening-ritual.test.tsx`
Expected: FAIL — cannot resolve `@/components/paper/opening-ritual`.

- [ ] **Step 4: Implement**

```tsx
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';

import { GoalSeal } from '@/components/paper/seals/goal';
import { LetterSeal } from '@/components/paper/seals/letter';
import { PostcardSeal } from '@/components/paper/seals/postcard';
import { PredictionSeal } from '@/components/paper/seals/prediction';
import { StampButton } from '@/components/paper/stamp-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import type { BoxKind } from '@/types/database';

/** Kéo qua mốc này thì hộp mở; chưa tới thì bật ngược về nguyên trạng. */
export const OPEN_THRESHOLD = 0.6;

/** Tách riêng để test được luật thả tay mà không cần giả lập cử chỉ. */
export function resolveRelease(progress: number): 'open' | 'reset' {
  return progress >= OPEN_THRESHOLD ? 'open' : 'reset';
}

/** Quãng kéo tính bằng pixel để progress đi trọn 0 → 1. */
const DRAG_DISTANCE = 220;

const SEALS = {
  letter: LetterSeal,
  goal: GoalSeal,
  prediction: PredictionSeal,
  postcard: PostcardSeal,
} as const;

type OpeningRitualProps = {
  kind: BoxKind;
  onOpened: () => void;
  disabled?: boolean;
  children: React.ReactNode;
};

export function OpeningRitual({ kind, onOpened, disabled = false, children }: OpeningRitualProps) {
  const reducedMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const progress = useSharedValue(0);
  const Seal = SEALS[kind];

  const open = () => {
    if (disabled) return;
    setRevealed(true);
    onOpened();
  };

  if (revealed) {
    return <View>{children}</View>;
  }

  if (reducedMotion) {
    return (
      <View style={styles.sealedArea}>
        <Seal progress={progress} />
        <StampButton label="Mở hộp" variant="primary" disabled={disabled} onPress={open} />
      </View>
    );
  }

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((event) => {
      const next = event.translationX / DRAG_DISTANCE;
      progress.value = Math.min(1, Math.max(0, next));
    })
    .onEnd(() => {
      if (resolveRelease(progress.value) === 'open') {
        progress.value = withTiming(1, { duration: 420, easing: Easing.steps(4) }, (finished) => {
          if (finished) runOnJS(open)();
        });
      } else {
        progress.value = withTiming(0, { duration: 260, easing: Easing.steps(2) });
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={styles.sealedArea}>
        <Seal progress={progress} />
        <ThemedText type="monoLabel" themeColor="ink3">
          Kéo sang phải để mở
        </ThemedText>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  sealedArea: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.six,
  },
});
```

`StampButton` must forward `accessibilityLabel` from its `label` prop for `getByLabelText('Mở hộp')` to resolve. Check `src/components/paper/stamp-button.tsx`; if it does not, add `accessibilityLabel={label}` to its `Pressable`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/components/paper/__tests__/opening-ritual.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: green. The Jest setup changes touch every test file, so a regression here shows up immediately.

- [ ] **Step 7: Commit**

```bash
git add jest.setup.js src/components/paper/opening-ritual.tsx src/components/paper/__tests__/opening-ritual.test.tsx
git commit -m "feat: add gesture-driven opening ritual frame"
```

Not covered by these tests, on purpose: the drag itself. Simulating a Reanimated worklet gesture under Jest tests the mock more than the code. The release rule is unit-tested through `resolveRelease`, and the drag is verified by hand in Task 11 Step 7.

---

### Task 9: Four seal layers

Each seal renders the same `progress` shared value as a different physical act. They share one interface so `OpeningRitual` can swap them without knowing anything about them.

**Files:**
- Create: `src/components/paper/seals/letter.tsx`
- Create: `src/components/paper/seals/goal.tsx`
- Create: `src/components/paper/seals/prediction.tsx`
- Create: `src/components/paper/seals/postcard.tsx`
- Test: `src/components/paper/seals/__tests__/seals.test.tsx`

**Interfaces:**
- Consumes: `SharedValue` from `react-native-reanimated`; `Colors`, `Radius`, `Shadow` from `@/constants/theme`.
- Produces: `LetterSeal`, `GoalSeal`, `PredictionSeal`, `PostcardSeal`, each typed `(props: { progress: SharedValue<number> }) => JSX.Element`, each rendering a root node with `testID` `seal-letter`, `seal-goal`, `seal-prediction`, `seal-postcard` respectively.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

import { GoalSeal } from '@/components/paper/seals/goal';
import { LetterSeal } from '@/components/paper/seals/letter';
import { PostcardSeal } from '@/components/paper/seals/postcard';
import { PredictionSeal } from '@/components/paper/seals/prediction';

type SealComponent = (props: { progress: SharedValue<number> }) => JSX.Element;

function Harness({ Seal }: { Seal: SealComponent }) {
  const progress = useSharedValue(0);
  return <Seal progress={progress} />;
}

describe('seals', () => {
  it.each([
    ['seal-letter', LetterSeal],
    ['seal-goal', GoalSeal],
    ['seal-prediction', PredictionSeal],
    ['seal-postcard', PostcardSeal],
  ])('%s renders without crashing', (testID, Seal) => {
    render(<Harness Seal={Seal as SealComponent} />);
    expect(screen.getByTestId(testID as string)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/components/paper/seals/__tests__/seals.test.tsx`
Expected: FAIL — cannot resolve the seal modules.

- [ ] **Step 3: Implement `letter.tsx`**

```tsx
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Colors, Radius, Shadow } from '@/constants/theme';

/** Phong bì airmail: nắp bật lên theo progress. */
export function LetterSeal({ progress }: { progress: SharedValue<number> }) {
  const flapStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateX: `${-160 * progress.value}deg` }],
    opacity: 1 - progress.value * 0.35,
  }));

  return (
    <Animated.View testID="seal-letter" style={styles.envelope}>
      <Animated.View style={[styles.flap, flapStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
          <Path d="M0,0 L50,38 L100,0 Z" fill={Colors.paperDim} stroke={Colors.rule} strokeWidth={0.8} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  envelope: {
    width: 260,
    height: 168,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius,
    ...Shadow.lift,
  },
  flap: {
    height: 66,
    transformOrigin: 'top',
  },
});
```

If `transformOrigin` is unsupported in this React Native version, remove it and offset the flap with a `translateY` inside the same `useAnimatedStyle` instead. Do not add a dependency to solve it.

- [ ] **Step 4: Implement `goal.tsx`**

```tsx
import { StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';

import { Colors, Radius, Shadow } from '@/constants/theme';

/** Tờ biểu mẫu gập đôi duỗi ra, kẹp giấy trượt khỏi mép trên. */
export function GoalSeal({ progress }: { progress: SharedValue<number> }) {
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: interpolate(progress.value, [0, 1], [0.5, 1]) }],
  }));

  const clipStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -48]) }],
    opacity: 1 - progress.value,
  }));

  return (
    <Animated.View testID="seal-goal" style={styles.sheet}>
      <Animated.View style={sheetStyle}>
        <Svg width="100%" height={140} viewBox="0 0 100 140" preserveAspectRatio="none">
          {[24, 46, 68, 90, 112].map((y) => (
            <Line key={y} x1={10} y1={y} x2={90} y2={y} stroke={Colors.ruleSoft} strokeWidth={0.9} />
          ))}
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.clip, clipStyle]}>
        <Svg width={22} height={44} viewBox="0 0 22 44">
          <Rect x={4} y={2} width={14} height={40} rx={7} stroke={Colors.ink3} strokeWidth={2} fill="none" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: 260,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius,
    ...Shadow.lift,
  },
  clip: {
    position: 'absolute',
    top: -12,
    left: 26,
  },
});
```

- [ ] **Step 5: Implement `prediction.tsx`**

```tsx
import { StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Colors, Radius, Shadow } from '@/constants/theme';

/** Điện tín: băng niêm đỏ bóc chéo, hé dần chữ bên dưới. */
export function PredictionSeal({ progress }: { progress: SharedValue<number> }) {
  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: '-38deg' }, { translateX: interpolate(progress.value, [0, 1], [0, 300]) }],
    opacity: 1 - progress.value * 0.6,
  }));

  return (
    <Animated.View testID="seal-prediction" style={styles.telegram}>
      <Animated.View style={[styles.band, bandStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  telegram: {
    width: 260,
    height: 130,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius,
    overflow: 'hidden',
    ...Shadow.lift,
  },
  band: {
    position: 'absolute',
    top: 44,
    left: -60,
    width: 380,
    height: 26,
    backgroundColor: Colors.red,
  },
});
```

- [ ] **Step 6: Implement `postcard.tsx`**

```tsx
import { StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';

import { Colors, Radius, Shadow } from '@/constants/theme';

/** Bưu thiếp lật mặt: mặt sau quay đi, ảnh chờ ở mặt trước. */
export function PostcardSeal({ progress }: { progress: SharedValue<number> }) {
  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateY: `${interpolate(progress.value, [0, 1], [0, 180])}deg` },
    ],
    opacity: interpolate(progress.value, [0, 0.5, 1], [1, 1, 0]),
  }));

  return (
    <Animated.View testID="seal-postcard" style={[styles.card, backStyle]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 66" preserveAspectRatio="none">
        <Line x1={50} y1={6} x2={50} y2={60} stroke={Colors.ruleSoft} strokeWidth={0.9} />
        <Rect
          x={74}
          y={8}
          width={18}
          height={20}
          stroke={Colors.rule}
          strokeWidth={0.9}
          strokeDasharray="2 2"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 260,
    height: 172,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius,
    ...Shadow.lift,
  },
});
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx jest src/components/paper/seals/__tests__/seals.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/paper/seals
git commit -m "feat: add four per-kind seal layers for the opening ritual"
```

---

### Task 10: Move opening out of mount and into the ritual

`useOpenBox` currently calls the RPC from an effect as soon as a box without a follow-up question becomes eligible (`src/hooks/use-open-box.ts:84-88`). With a ritual, the box must not open until the user finishes the gesture. Remove the auto-open effect and expose an explicit trigger.

**Files:**
- Modify: `src/hooks/use-open-box.ts`
- Test: `src/hooks/__tests__/use-open-box.test.ts` (extend the existing file)

**Interfaces:**
- Consumes: `openBox` and `ChecklistItem` from Task 3.
- Produces: the hook's return object keeps every current key and gains
  `openWithRitual: (options?: { answer?: boolean; checklist?: ChecklistItem[] }) => Promise<void>`.
  `submitAnswer` and `retryOpen` keep their current signatures.

- [ ] **Step 1: Write the failing tests**

Append to `src/hooks/__tests__/use-open-box.test.ts`. Match the mock variable names already used in that file — if it names them differently, substitute rather than redeclaring:

```ts
describe('useOpenBox does not open on mount', () => {
  it('leaves a ready box with no follow-up unopened until asked', async () => {
    mockFetchBoxById.mockResolvedValue({
      id: 'box-1',
      kind: 'letter',
      checklist: null,
      open_at: '2020-01-01T00:00:00.000Z',
      opened_at: null,
      follow_up_question: null,
      follow_up_answered_at: null,
    });

    const { result } = renderHook(() => useOpenBox('box-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockOpenBox).not.toHaveBeenCalled();
  });

  it('opens only when openWithRitual is called', async () => {
    mockFetchBoxById.mockResolvedValue({
      id: 'box-1',
      kind: 'letter',
      checklist: null,
      open_at: '2020-01-01T00:00:00.000Z',
      opened_at: null,
      follow_up_question: null,
      follow_up_answered_at: null,
    });
    mockOpenBox.mockResolvedValue({ id: 'box-1', opened_at: '2020-01-02T00:00:00.000Z' });

    const { result } = renderHook(() => useOpenBox('box-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.openWithRitual();
    });

    expect(mockOpenBox).toHaveBeenCalledWith('box-1', undefined, undefined);
  });

  it('forwards the ticked checklist for a goal box', async () => {
    mockFetchBoxById.mockResolvedValue({
      id: 'box-2',
      kind: 'goal',
      checklist: [{ text: 'Chạy 10km', done: false }],
      open_at: '2020-01-01T00:00:00.000Z',
      opened_at: null,
      follow_up_question: null,
      follow_up_answered_at: null,
    });
    mockOpenBox.mockResolvedValue({ id: 'box-2', opened_at: '2020-01-02T00:00:00.000Z' });

    const { result } = renderHook(() => useOpenBox('box-2'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.openWithRitual({ checklist: [{ text: 'Chạy 10km', done: true }] });
    });

    expect(mockOpenBox).toHaveBeenCalledWith('box-2', undefined, [{ text: 'Chạy 10km', done: true }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/hooks/__tests__/use-open-box.test.ts`
Expected: FAIL — `openBox` is called on mount, and `openWithRitual` is not a function.

- [ ] **Step 3: Implement**

In `src/hooks/use-open-box.ts`, change `performOpen` to accept the checklist:

```ts
  const performOpen = useCallback(
    async (answer?: boolean, checklist?: ChecklistItem[]) => {
      if (!boxId) return;
      if (answer !== undefined) setPendingAnswer(answer);
      setOpening(true);
      setOpenError(null);
      try {
        const updated = await openBox(boxId, answer, checklist);
        setBox(updated);
        if (answer === true) setJustAnsweredYes(true);
      } catch (err) {
        setOpenError(mapError(err));
      } finally {
        setOpening(false);
      }
    },
    [boxId]
  );
```

Delete the auto-open effect at lines 83-88 entirely, including its comment.

Add the explicit trigger next to `submitAnswer`:

```ts
  /** Chỉ nghi thức mở hộp gọi hàm này — không tự chạy khi mount, vì mở hộp là hành động của user. */
  const openWithRitual = useCallback(
    (options?: { answer?: boolean; checklist?: ChecklistItem[] }) =>
      performOpen(options?.answer, options?.checklist),
    [performOpen]
  );
```

Add `openWithRitual` to the returned object and import `ChecklistItem` from `@/types/database`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/hooks/__tests__/use-open-box.test.ts`
Expected: PASS. Any pre-existing test in the file that asserted auto-open must be rewritten to call `openWithRitual` — the behaviour change is intended, so change the assertion, never re-add the effect.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-open-box.ts src/hooks/__tests__/use-open-box.test.ts
git commit -m "refactor: open a box only when the user completes the ritual"
```

---

### Task 11: Wire the box detail screen

**Files:**
- Modify: `src/app/(app)/box/[id].tsx`

**Interfaces:**
- Consumes: `OpeningRitual` (Task 8), `ChecklistField` (Task 6), `openWithRitual` (Task 10).
- Produces: nothing consumed by later tasks.

Who calls the RPC differs by kind, and getting this wrong either opens boxes too early or never records the answer:

| kind | what completes the ritual | what calls the RPC |
|---|---|---|
| `letter` | the drag | `onOpened` — nothing left to commit |
| `postcard` | the drag | `onOpened` — nothing left to commit |
| `prediction` | the drag reveals the question | the `Có`/`Chưa` stamp button, through the existing `submitAnswer` |
| `goal` | the drag reveals the list | the `Chốt kết quả` button, through `openWithRitual({ checklist })` |

- [ ] **Step 1: Keep the locked and error branches untouched**

The `loading`, `fetchError` and `blocked` branches stay exactly as they are. A locked box still shows the countdown and the edit/delete buttons and never shows the ritual.

- [ ] **Step 2: Add the goal tick state**

Add near the top of the component, after the hooks:

```tsx
  const [tickedChecklist, setTickedChecklist] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    if (box?.checklist) setTickedChecklist(box.checklist);
  }, [box?.checklist]);
```

Import `useState` alongside the existing `useEffect`, and `ChecklistItem` from `@/types/database`.

- [ ] **Step 3: Extract the revealed content**

Move the existing `LetterSheet` block and follow-up block into a single `content` element declared just before the `return`, and add the goal block to it:

```tsx
  const goalCommitted = !!box.opened_at;

  const content = (
    <>
      <LetterSheet>
        {attachmentUrl ? (
          <Image source={{ uri: attachmentUrl }} style={styles.photo} contentFit="cover" />
        ) : null}
        <ThemedText type="default">{box.content_text}</ThemedText>
      </LetterSheet>

      {box.kind === 'goal' ? (
        <View style={styles.followUpBlock}>
          <ThemedText type="monoLabel" themeColor="ink3">
            Đã làm được những gì?
          </ThemedText>
          <ChecklistField
            items={goalCommitted ? (box.checklist ?? []) : tickedChecklist}
            mode="tick"
            onChange={goalCommitted ? () => {} : setTickedChecklist}
          />
          {goalCommitted ? null : (
            <StampButton
              label="Chốt kết quả"
              variant="primary"
              disabled={opening}
              loading={opening}
              onPress={() => openWithRitual({ checklist: tickedChecklist })}
            />
          )}
        </View>
      ) : null}

      {/* the existing follow-up question block moves here unchanged */}

      {showDone ? (
        <Pressable onPress={() => router.back()} style={styles.doneButton}>
          <ThemedText type="default" style={styles.doneButtonLabel}>
            Xong
          </ThemedText>
        </Pressable>
      ) : null}
    </>
  );
```

- [ ] **Step 4: Gate the content behind the ritual**

Inside the `ScrollView`, replace the previous children with:

```tsx
          {wasAlreadyOpened ? (
            content
          ) : (
            <OpeningRitual
              kind={box.kind}
              disabled={opening}
              onOpened={() => {
                if (box.kind === 'goal' || box.follow_up_question) return;
                openWithRitual();
              }}
            >
              {content}
            </OpeningRitual>
          )}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Run the suite**

Run: `npm test`
Expected: green.

- [ ] **Step 7: Verify by hand on a device**

Start the app with `npx expo start` and open it on the phone. Check all of these:
- A ready letter shows a sealed envelope and does not open until the drag passes roughly two thirds.
- A short drag released early snaps back and leaves the box closed. Reopening the screen still shows it sealed.
- A ready goal reveals its list; ticking and confirming stamps the score, and the score survives a screen reload.
- A ready prediction reveals the question and both stamp buttons.
- A ready postcard flips to show the photo.
- With Reduce Motion on in iOS settings, every kind shows a `Mở hộp` button instead and opens on tap.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/box/[id].tsx"
git commit -m "feat: open boxes through the ritual and reveal per-kind content"
```

---

### Task 12: Wire the create screen

**Files:**
- Modify: `src/app/(app)/create-box.tsx`
- Modify: `src/hooks/use-create-box.ts`

**Interfaces:**
- Consumes: `KindPicker` (Task 5), `ChecklistField` (Task 6), `isValidChecklist` (Task 4), `InsertBoxParams` (Task 3).
- Produces: `useCreateBox().createBox` gains `kind: BoxKind` and `checklist: ChecklistItem[] | null` in its params, forwarded straight to `insertBox`.

- [ ] **Step 1: Thread the two fields through the hook**

In `src/hooks/use-create-box.ts`, add `kind: BoxKind` and `checklist: ChecklistItem[] | null` to the params type and pass both to `insertBox`. Change nothing else about the photo upload or the rollback flow.

- [ ] **Step 2: Add the kind state and picker**

In `src/app/(app)/create-box.tsx`, add to the state block:

```tsx
  const [kind, setKind] = useState<BoxKind>('letter');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([{ text: '', done: false }]);
```

Render the picker as the first field inside the `ScrollView`, above the content field:

```tsx
          <View style={styles.field}>
            <ThemedText type="smallBold" themeColor="ink2">
              Loại hộp
            </ThemedText>
            <KindPicker value={kind} onChange={setKind} />
          </View>
```

- [ ] **Step 3: Make the form follow the kind**

A prediction always asks for its question and never shows the optional toggle. A goal shows its checklist and no toggle. The other two keep the existing optional follow-up switch.

Add these two blocks where the follow-up toggle currently sits:

```tsx
          {kind === 'prediction' ? (
            <FormField
              label="Dự đoán của bạn"
              value={followUpQuestion}
              onChangeText={(text) => setFollowUpQuestion(text.slice(0, MAX_FOLLOW_UP_QUESTION_LENGTH))}
              onBlur={() => setTouched((value) => ({ ...value, followUpQuestion: true }))}
              error={followUpError}
              placeholder="Điều bạn nghĩ sẽ xảy ra"
            />
          ) : null}

          {kind === 'goal' ? (
            <View style={styles.field}>
              <ThemedText type="smallBold" themeColor="ink2">
                Danh sách mục tiêu
              </ThemedText>
              <ChecklistField items={checklist} mode="edit" onChange={setChecklist} />
            </View>
          ) : null}
```

Wrap the existing `wantsFollowUp` switch row and its conditional `FormField` so they render only when `kind !== 'prediction' && kind !== 'goal'`.

For `postcard`, change the photo field label from `Ảnh đính kèm (tùy chọn)` to `Ảnh bưu thiếp`.

- [ ] **Step 4: Extend the validity rule**

```tsx
  const isFormValid =
    isValidBoxContentText(contentText) &&
    isFutureOpenAt(openAt) &&
    (kind !== 'goal' || isValidChecklist(checklist)) &&
    (kind !== 'prediction' || isValidFollowUpQuestion(followUpQuestion)) &&
    (kind !== 'postcard' || !!photo) &&
    (kind === 'prediction' ||
      kind === 'goal' ||
      !wantsFollowUp ||
      isValidFollowUpQuestion(followUpQuestion)) &&
    (!photo || isValidBoxImage(photo));
```

- [ ] **Step 5: Send the right payload**

```tsx
    const { error } = await createBox({
      userId: session.user.id,
      contentText,
      openAt,
      followUpQuestion:
        kind === 'prediction' ? followUpQuestion : wantsFollowUp ? followUpQuestion : '',
      photo,
      kind,
      checklist:
        kind === 'goal'
          ? checklist.map((item) => ({ text: item.text.trim(), done: false }))
          : null,
    });
```

Trimming here matters: `isValidChecklist` trims before checking, so an untrimmed item could pass the client check and then be stored with padding that the server's later text comparison would carry along.

- [ ] **Step 6: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: both clean.

- [ ] **Step 7: Verify by hand**

Create one box of each kind on the device. Confirm the Save button stays disabled for a goal with an empty item, a prediction with no question, and a postcard with no photo.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/create-box.tsx" src/hooks/use-create-box.ts
git commit -m "feat: pick a box kind when creating and adapt the form to it"
```

---

### Task 13: Wire the list screen

**Files:**
- Modify: `src/app/(app)/index.tsx:25-28` (`openedMeta`) and `src/app/(app)/index.tsx:84-92` (`renderItem`)

**Interfaces:**
- Consumes: `PaperCard` with its new `kind` and `checklist` props (Task 7).
- Produces: nothing.

- [ ] **Step 1: Pass the kind and checklist through**

```tsx
            renderItem={({ item }) => (
              <PaperCard
                kind={item.kind}
                status={item.status}
                title={firstLine(item.content_text)}
                openAt={item.open_at}
                checklist={item.checklist}
                meta={item.status === 'opened' ? openedMeta(item) : undefined}
                onPress={() => handleBoxPress(item)}
              />
            )}
```

- [ ] **Step 2: Let an opened goal report its score**

Replace `openedMeta` with:

```tsx
function openedMeta(box: BoxWithStatus): string | undefined {
  if (box.kind === 'goal' && box.checklist) {
    return `ĐÃ LÀM: ${box.checklist.filter((item) => item.done).length}/${box.checklist.length}`;
  }
  if (!box.follow_up_question || box.follow_up_answer === null) return undefined;
  return box.follow_up_answer ? 'ĐÃ TRẢ LỜI: CÓ' : 'ĐÃ TRẢ LỜI: CHƯA';
}
```

- [ ] **Step 3: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: both clean, with no remaining `kind`-missing errors anywhere in the project.

Note deliberately not done here: the list does **not** pass `photoUrl`. `fetchBoxesWithStatus` returns rows only, and a signed Storage URL is a separate request per photo, so showing real thumbnails would mean one extra round trip per postcard on every list render. An opened postcard shows the empty front frame instead, which is still visually distinct from the locked back side. Revisit only if the list gains a batch signed-URL fetch.

- [ ] **Step 4: Verify the list by eye**

With one box of each kind on the device, take a screenshot and desaturate it. All four must still be tellable apart, and each must still read as locked, ready or opened.

Confirm too that scrolling a list holding a postcard of either status fires no Storage request.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/index.tsx"
git commit -m "feat: render each box kind distinctly in the list"
```

---

## Done when

- [ ] `npx tsc --noEmit` clean
- [ ] `npm test` green, including every test added by this plan
- [ ] Four kinds distinguishable in a black-and-white screenshot of the list
- [ ] Releasing a short drag leaves the box closed, and it is still closed after a reload
- [ ] With Reduce Motion on, every kind opens through a button and no gesture is required
- [ ] The RPC rejects a checklist whose item text was altered
- [ ] A locked postcard triggers no Storage request
- [ ] `information_schema.column_privileges` shows `authenticated` may update only `content_text`, `open_at`, `follow_up_question`
- [ ] Verified by hand on the iPhone through Expo

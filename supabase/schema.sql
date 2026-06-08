create table if not exists public.training_splits (
  id bigint generated always as identity primary key,
  name text not null,
  sort_order integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id bigint generated always as identity primary key,
  name text not null,
  category text,
  created_at timestamptz not null default now(),
  constraint exercises_name_unique unique (name)
);

create table if not exists public.muscle_groups (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamptz not null default now(),
  constraint muscle_groups_name_unique unique (name)
);

create table if not exists public.training_plans (
  id bigint generated always as identity primary key,
  split_id bigint references public.training_splits(id) on delete set null,
  name text not null,
  sort_order integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.training_plans
add column if not exists split_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'training_plans_split_id_fkey'
  ) then
    alter table public.training_plans
    add constraint training_plans_split_id_fkey
    foreign key (split_id) references public.training_splits(id) on delete set null;
  end if;
end $$;

create table if not exists public.exercise_muscle_groups (
  id bigint generated always as identity primary key,
  exercise_id bigint not null references public.exercises(id) on delete cascade,
  muscle_group_id bigint not null references public.muscle_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint exercise_muscle_groups_unique unique (exercise_id, muscle_group_id)
);

create table if not exists public.plan_exercises (
  id bigint generated always as identity primary key,
  plan_id bigint not null references public.training_plans(id) on delete cascade,
  exercise_id bigint not null references public.exercises(id) on delete restrict,
  position integer not null default 1,
  created_at timestamptz not null default now(),
  constraint plan_exercises_plan_position_unique unique (plan_id, position)
);

create table if not exists public.workout_sessions (
  id bigint generated always as identity primary key,
  plan_id bigint references public.training_plans(id) on delete set null,
  title text not null,
  trained_on date not null default current_date,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  constraint workout_sessions_duration_positive check (duration_seconds >= 0)
);

create table if not exists public.set_entries (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.workout_sessions(id) on delete cascade,
  exercise_id bigint not null references public.exercises(id) on delete restrict,
  set_number integer not null,
  weight_kg numeric(7, 2) not null default 0,
  reps integer not null,
  created_at timestamptz not null default now(),
  constraint set_entries_reps_positive check (reps > 0),
  constraint set_entries_weight_positive check (weight_kg >= 0),
  constraint set_entries_set_number_positive check (set_number > 0),
  constraint set_entries_session_set_unique unique (session_id, exercise_id, set_number)
);

create table if not exists public.bodyweight_entries (
  id bigint generated always as identity primary key,
  measured_on date not null default current_date,
  weight_kg numeric(5, 2) not null,
  created_at timestamptz not null default now(),
  constraint bodyweight_entries_weight_positive check (weight_kg > 0)
);

create index if not exists training_plans_split_id_idx on public.training_plans(split_id);
create index if not exists plan_exercises_plan_id_idx on public.plan_exercises(plan_id);
create index if not exists plan_exercises_exercise_id_idx on public.plan_exercises(exercise_id);
create index if not exists exercise_muscle_groups_exercise_id_idx on public.exercise_muscle_groups(exercise_id);
create index if not exists exercise_muscle_groups_muscle_group_id_idx on public.exercise_muscle_groups(muscle_group_id);
create index if not exists workout_sessions_plan_id_idx on public.workout_sessions(plan_id);
create index if not exists workout_sessions_trained_on_idx on public.workout_sessions(trained_on desc);
create index if not exists set_entries_session_id_idx on public.set_entries(session_id);
create index if not exists set_entries_exercise_id_idx on public.set_entries(exercise_id);
create index if not exists bodyweight_entries_measured_on_idx on public.bodyweight_entries(measured_on);

alter table public.training_splits enable row level security;
alter table public.exercises enable row level security;
alter table public.muscle_groups enable row level security;
alter table public.exercise_muscle_groups enable row level security;
alter table public.training_plans enable row level security;
alter table public.plan_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.set_entries enable row level security;
alter table public.bodyweight_entries enable row level security;

insert into public.training_splits (name, sort_order)
values ('Meine Pläne', 1)
on conflict do nothing;

insert into public.muscle_groups (name)
values
  ('Brust'),
  ('Rücken'),
  ('Schulter'),
  ('Bizeps'),
  ('Trizeps'),
  ('Beine'),
  ('Bauch'),
  ('Waden'),
  ('Glutes')
on conflict (name) do nothing;

insert into public.exercises (name, category)
values
  ('Bankdrücken', 'Brust'),
  ('Klimmzug', 'Rücken'),
  ('Kniebeuge', 'Beine'),
  ('Schulterdrücken', 'Schulter')
on conflict (name) do nothing;

update public.training_plans
set split_id = (select id from public.training_splits where name = 'Meine Pläne' order by id limit 1)
where split_id is null;

insert into public.training_plans (split_id, name, sort_order)
select s.id, seed.name, seed.sort_order
from (
  values
    ('Oberkörper', 1),
    ('Unterkörper', 2)
) as seed(name, sort_order)
cross join lateral (
  select id from public.training_splits where name = 'Meine Pläne' order by id limit 1
) s
where not exists (
  select 1 from public.training_plans tp where tp.name = seed.name
);

insert into public.plan_exercises (plan_id, exercise_id, position)
select tp.id, e.id, seed.position
from (
  values
    ('Oberkörper', 'Bankdrücken', 1),
    ('Oberkörper', 'Klimmzug', 2),
    ('Oberkörper', 'Schulterdrücken', 3),
    ('Unterkörper', 'Kniebeuge', 1)
) as seed(plan_name, exercise_name, position)
join public.training_plans tp on tp.name = seed.plan_name
join public.exercises e on e.name = seed.exercise_name
on conflict (plan_id, position) do nothing;

insert into public.exercise_muscle_groups (exercise_id, muscle_group_id)
select e.id, mg.id
from public.exercises e
join public.muscle_groups mg on mg.name = e.category
where e.category is not null
on conflict (exercise_id, muscle_group_id) do nothing;

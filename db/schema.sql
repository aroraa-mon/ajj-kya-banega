-- Aaj Kya Banega: schema. Safe to run more than once.
-- Run in the Supabase SQL editor, or with: npm run db:setup

do $$ begin create type meal_type     as enum ('breakfast', 'lunch', 'dinner');            exception when duplicate_object then null; end $$;
do $$ begin create type protein_level as enum ('High', 'Medium', 'Low');                   exception when duplicate_object then null; end $$;
do $$ begin create type season_type   as enum ('All', 'Winter', 'Summer');                 exception when duplicate_object then null; end $$;
do $$ begin create type final_reason  as enum ('votes', 'default', 'cook-reroll');         exception when duplicate_object then null; end $$;

create table if not exists members (
  id               text primary key,
  name             text not null,
  is_cook          boolean not null default false,
  whatsapp_number  text unique,
  active           boolean not null default true
);

create table if not exists dishes (
  id              text primary key,
  meal            meal_type not null,
  name_en         text not null,
  name_hinglish   text not null,
  name_hi         text not null,
  protein         protein_level not null,
  season          season_type not null default 'All',
  tags            text[] not null default '{}',
  base_weight     double precision not null default 1,
  occasional      boolean not null default false,
  surprise        boolean not null default false,
  max_per_week    int,
  max_per_month   int,
  min_gap_days    int,
  notes           text,
  enabled         boolean not null default true
);

-- One row per meal per day: the app's pick and how it ended up.
create table if not exists day_plans (
  plan_date      date not null,
  meal           meal_type not null,
  pick           text not null references dishes(id),
  surprise       boolean not null default false,
  final_dish     text references dishes(id),
  final_reason   final_reason,
  rerolled_from  text references dishes(id),
  rerolled_by    text references members(id),
  created_at     timestamptz not null default now(),
  primary key (plan_date, meal)
);

-- Re-rolls used for this breakfast (the cook gets RULES.rerollsPerDay). Added after the table existed.
alter table day_plans add column if not exists reroll_count int not null default 0;

-- The vote options for a day (the app's pick first).
create table if not exists plan_options (
  plan_date  date not null,
  meal       meal_type not null,
  dish_id    text not null references dishes(id),
  position   smallint not null,
  primary key (plan_date, meal, dish_id),
  foreign key (plan_date, meal) references day_plans (plan_date, meal) on delete cascade
);

-- One vote per member per meal. Voting again is an upsert.
create table if not exists votes (
  plan_date  date not null,
  meal       meal_type not null,
  member_id  text not null references members(id),
  dish_id    text not null,
  voted_at   timestamptz not null default now(),
  primary key (plan_date, meal, member_id),
  foreign key (plan_date, meal, dish_id) references plan_options (plan_date, meal, dish_id) on delete cascade
);

-- Learned multipliers (winners up, cook-rejected down).
create table if not exists dish_weights (
  dish_id     text primary key references dishes(id),
  weight      double precision not null default 1 check (weight between 0.4 and 2),
  updated_at  timestamptz not null default now()
);

-- Voting for a day closes at 11:59 pm IST the night before. The database enforces it too.
create or replace function enforce_vote_cutoff() returns trigger language plpgsql as $$
begin
  if now() >= ((new.plan_date - 1)::timestamp + time '23:59') at time zone 'Asia/Kolkata' then
    raise exception 'Voting closed';
  end if;
  return new;
end $$;

drop trigger if exists votes_cutoff on votes;
create trigger votes_cutoff before insert or update on votes
  for each row execute function enforce_vote_cutoff();

-- PIN (scrypt hash) and a lock after repeated wrong tries. The PIN itself is never stored.
alter table members add column if not exists pin_hash text;
alter table members add column if not exists pin_fails int not null default 0;
alter table members add column if not exists pin_locked_until timestamptz;

-- One row per phone that entered the right PIN. Only the hash of the token is stored.
create table if not exists device_tokens (
  token_hash  text primary key,
  member_id   text not null references members(id),
  created_at  timestamptz not null default now()
);

-- Lock the tables against the public API. Only the server (direct connection) uses them.
alter table members       enable row level security;
alter table dishes        enable row level security;
alter table day_plans     enable row level security;
alter table plan_options  enable row level security;
alter table votes         enable row level security;
alter table dish_weights  enable row level security;
alter table device_tokens enable row level security;

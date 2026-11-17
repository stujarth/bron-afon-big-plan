-- One Bron Afon Plan — the Big Plan. Core schema, security and audit (live).

create extension if not exists pgcrypto;

create table public.teams (
  id          text primary key,
  name        text not null unique,
  colour      text not null,
  text_colour text not null,
  sort_order  integer not null,
  active      boolean not null default true
);

create type public.project_status as enum ('Not started','In delivery','Paused','Complete');
create type public.elt_decision   as enum ('Progress','Pause','Re-sequence','Deprioritise','Stop');

create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text not null,
  full_name            text,
  role                 text not null default 'viewer' check (role in ('viewer','editor','elt','admin')),
  must_change_password boolean not null default false,
  onboarded_at         timestamptz,
  created_at           timestamptz not null default now()
);

create table public.projects (
  id                 uuid primary key default gen_random_uuid(),
  ref                text unique,
  name               text not null check (char_length(name) between 1 and 200),
  purpose            text not null default '' check (char_length(purpose) <= 400),
  lead_team_id       text references public.teams(id),
  owner              text not null default '' check (char_length(owner) <= 120),
  start_date         date,
  end_date           date,
  status             public.project_status not null default 'Not started',
  impact_regulatory  smallint not null default 0 check (impact_regulatory  between 0 and 3),
  impact_financial   smallint not null default 0 check (impact_financial   between 0 and 3),
  impact_customer    smallint not null default 0 check (impact_customer    between 0 and 3),
  impact_foundations smallint not null default 0 check (impact_foundations between 0 and 3),
  impact_digital     smallint not null default 0 check (impact_digital     between 0 and 3),
  impact_score       smallint generated always as
                       (impact_regulatory + impact_financial + impact_customer + impact_foundations + impact_digital) stored,
  decision           public.elt_decision,
  priority           integer check (priority is null or priority > 0),
  rationale          text not null default '' check (char_length(rationale) <= 400),
  notes              text not null default '' check (char_length(notes) <= 2000),
  confirmed          boolean not null default false,
  source             text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id),
  rag                text not null default 'Green' check (rag in ('Green','Amber','Red')),
  constraint projects_dates_ok check (start_date is null or end_date is null or end_date >= start_date)
);
create index projects_lead_team_idx on public.projects(lead_team_id);
create index projects_dates_idx on public.projects(start_date, end_date);

create table public.project_teams (
  project_id uuid not null references public.projects(id) on delete cascade,
  team_id    text not null references public.teams(id),
  primary key (project_id, team_id)
);

create table public.project_history (
  id         bigserial primary key,
  project_id uuid not null,
  changed_at timestamptz not null default now(),
  changed_by uuid,
  action     text not null,
  changes    jsonb not null
);
create index project_history_project_idx on public.project_history(project_id, changed_at desc);

-- helpers
create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'viewer');
$$;
create or replace function public.can_edit()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('editor','elt','admin');
$$;
create or replace function public.can_decide()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('elt','admin');
$$;

-- sign-in restricted to Bron Afon
create or replace function public.enforce_allowed_email_domain()
returns trigger language plpgsql security definer set search_path = public as $$
declare d text := lower(split_part(new.email, '@', 2));
begin
  if d <> 'bronafon.org.uk' then raise exception 'Sign-in is limited to Bron Afon email addresses.'; end if;
  return new;
end $$;
create trigger auth_users_domain_check before insert on auth.users
  for each row execute function public.enforce_allowed_email_domain();

create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', null))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger auth_users_create_profile after insert on auth.users
  for each row execute function public.create_profile_for_user();

-- project triggers
create or replace function public.projects_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.can_decide() then
    if new.decision is distinct from old.decision
       or new.priority is distinct from old.priority
       or new.rationale is distinct from old.rationale then
      raise exception 'Only ELT can record or change a prioritisation decision.';
    end if;
  end if;
  return new;
end $$;
create trigger projects_before_write before insert or update on public.projects
  for each row execute function public.projects_before_write();

create sequence public.project_ref_seq;
create or replace function public.projects_assign_ref()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ref is null or btrim(new.ref) = '' then
    new.ref := 'BP-' || lpad(nextval('public.project_ref_seq')::text, 3, '0');
  end if;
  return new;
end $$;
create trigger projects_assign_ref before insert on public.projects
  for each row execute function public.projects_assign_ref();

create or replace function public.projects_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare diff jsonb := '{}'::jsonb; k text; o jsonb; n jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.project_history(project_id, changed_by, action, changes)
      values (new.id, auth.uid(), 'created', to_jsonb(new) - 'updated_at' - 'updated_by' - 'created_at');
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.project_history(project_id, changed_by, action, changes)
      values (old.id, auth.uid(), 'removed', jsonb_build_object('name', old.name, 'ref', old.ref));
    return old;
  end if;
  o := to_jsonb(old); n := to_jsonb(new);
  for k in select jsonb_object_keys(n) loop
    if k in ('updated_at','updated_by','impact_score') then continue; end if;
    if o->k is distinct from n->k then
      diff := diff || jsonb_build_object(k, jsonb_build_object('from', o->k, 'to', n->k));
    end if;
  end loop;
  if diff <> '{}'::jsonb then
    insert into public.project_history(project_id, changed_by, action, changes)
      values (new.id, auth.uid(), 'updated', diff);
  end if;
  return new;
end $$;
create trigger projects_audit after insert or update or delete on public.projects
  for each row execute function public.projects_audit();

create or replace function public.project_teams_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_history(project_id, changed_by, action, changes)
    values (coalesce(new.project_id, old.project_id), auth.uid(),
            case when tg_op = 'INSERT' then 'team_added' else 'team_removed' end,
            jsonb_build_object('team_id', coalesce(new.team_id, old.team_id)));
  return coalesce(new, old);
end $$;
create trigger project_teams_audit after insert or delete on public.project_teams
  for each row execute function public.project_teams_audit();

create view public.projects_with_teams with (security_invoker = true) as
select p.*,
       coalesce(array_agg(pt.team_id order by pt.team_id) filter (where pt.team_id is not null), '{}') as team_ids
from public.projects p
left join public.project_teams pt on pt.project_id = p.id
group by p.id;

-- row-level security
alter table public.teams           enable row level security;
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.project_teams   enable row level security;
alter table public.project_history enable row level security;

create policy teams_read on public.teams for select to authenticated using (true);
create policy teams_manage_insert on public.teams for insert to authenticated with check (public.current_role() in ('elt','admin'));
create policy teams_manage_update on public.teams for update to authenticated using (public.current_role() in ('elt','admin')) with check (public.current_role() in ('elt','admin'));

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_role() = 'admin');
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy projects_read   on public.projects for select to authenticated using (true);
create policy projects_insert on public.projects for insert to authenticated with check (public.can_edit());
create policy projects_update on public.projects for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy projects_delete on public.projects for delete to authenticated using (public.current_role() = 'admin');

create policy project_teams_read   on public.project_teams for select to authenticated using (true);
create policy project_teams_insert on public.project_teams for insert to authenticated with check (public.can_edit());
create policy project_teams_delete on public.project_teams for delete to authenticated using (public.can_edit());

create policy history_read on public.project_history for select to authenticated using (true);

alter publication supabase_realtime add table public.projects, public.project_teams, public.teams;

-- reference data
insert into public.teams (id, name, colour, text_colour, sort_order) values
 ('org','Whole organisation','#3C4A58','#FFFFFF',0),
 ('property','Property','#981B45','#FFFFFF',1),
 ('communities','Communities & Placemaking','#00B259','#081D2D',2),
 ('development','Development','#E8871E','#081D2D',3),
 ('retirement','Retirement Living','#C9A227','#081D2D',4),
 ('ardal','Ardal Homes','#8B5E3C','#FFFFFF',5),
 ('finance','Finance & Procurement','#007DC3','#FFFFFF',6),
 ('people','People Services','#6B4C9A','#FFFFFF',7),
 ('learning','Learning & Development','#B39DDB','#081D2D',8),
 ('comms','Communications & Customer Voice','#1B9AAA','#FFFFFF',9),
 ('portfolio','Portfolio & Performance','#081D2D','#FFFFFF',10),
 ('technology','Technology & Digital Services','#5BB8E8','#081D2D',11),
 ('governance','Governance & Assurance','#717073','#FFFFFF',12);

-- Mapa podróży — database schema for Supabase.
-- Paste the whole file into Supabase → SQL Editor → Run. Safe to re-run.
--
-- Model: a "space" is a shared map (e.g. the two of you). Every row of data
-- belongs to a space, and row-level security only lets members of that
-- space read or change it. A partner joins through a one-time invite code.

-- ── profiles (display name + avatar from the Google account) ──────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── spaces & membership ──────────────────────────────────────────────────────
create table if not exists public.spaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Nasza mapa',
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.space_members (
  space_id  uuid not null references public.spaces on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index if not exists space_members_user_idx on public.space_members (user_id);

-- security definer so policies can check membership without recursing into
-- space_members' own RLS
create or replace function public.is_member(p_space uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space and user_id = auth.uid()
  );
$$;

create or replace function public.is_owner(p_space uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space and user_id = auth.uid() and role = 'owner'
  );
$$;

-- whoever creates a space becomes its owner
create or replace function public.handle_new_space()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.space_members (space_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end $$;

drop trigger if exists on_space_created on public.spaces;
create trigger on_space_created
  after insert on public.spaces
  for each row execute function public.handle_new_space();

-- ── invites ──────────────────────────────────────────────────────────────────
create table if not exists public.space_invites (
  code       text primary key default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  space_id   uuid not null references public.spaces on delete cascade,
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  used_by    uuid references auth.users on delete set null,
  used_at    timestamptz
);

-- joining goes through this function: the invite table itself is only
-- readable by existing members
create or replace function public.accept_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_space uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  update public.space_invites
     set used_by = auth.uid(), used_at = now()
   where code = p_code and used_at is null and expires_at > now()
  returning space_id into v_space;

  if v_space is null then
    raise exception 'invite is invalid, used or expired';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (v_space, auth.uid(), 'member')
  on conflict do nothing;
  return v_space;
end $$;

-- ── trips, places, countries, photos ─────────────────────────────────────────
create table if not exists public.trips (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces on delete cascade,
  title      text not null,
  start_date date,
  end_date   date,
  notes      text,
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists trips_space_idx on public.trips (space_id, start_date desc);

create table if not exists public.places (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references public.spaces on delete cascade,
  status          text not null check (status in ('visited', 'wishlist')),
  category        text not null default 'other'
                  check (category in ('restaurant', 'hotel', 'attraction', 'city', 'other')),
  name            text not null,
  address         text,
  lat             double precision not null,
  lng             double precision not null,
  country_code    char(2),             -- ISO 3166-1 alpha-2, from Google
  country_name    text,
  city            text,
  google_place_id text,
  google_maps_uri text,
  rating          numeric(2, 1),       -- Google rating at the time of saving
  trip_id         uuid references public.trips on delete set null,
  visited_on      date,
  notes           text,
  created_by      uuid default auth.uid() references auth.users on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists places_space_idx on public.places (space_id, status);
create index if not exists places_trip_idx on public.places (trip_id);
-- the same Google place once per list
create unique index if not exists places_unique_google
  on public.places (space_id, google_place_id, status) where google_place_id is not null;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists places_touch on public.places;
create trigger places_touch before update on public.places
  for each row execute function public.touch_updated_at();

-- countries marked by hand (visited without any saved place)
create table if not exists public.extra_countries (
  space_id     uuid not null references public.spaces on delete cascade,
  country_code char(2) not null,
  primary key (space_id, country_code)
);

create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces on delete cascade,
  trip_id      uuid references public.trips on delete cascade,
  place_id     uuid references public.places on delete cascade,
  storage_path text not null,          -- '<space_id>/<uuid>.<ext>' in the photos bucket
  caption      text,
  created_by   uuid default auth.uid() references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  check (trip_id is not null or place_id is not null)
);
create index if not exists photos_trip_idx on public.photos (trip_id);
create index if not exists photos_place_idx on public.photos (place_id);

-- all visited countries of a space: from visited places + marked by hand
create or replace view public.visited_countries with (security_invoker = true) as
  select space_id, upper(country_code) as country_code
    from public.places
   where status = 'visited' and country_code is not null
  union
  select space_id, upper(country_code) from public.extra_countries;

-- ── row-level security ───────────────────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.spaces          enable row level security;
alter table public.space_members   enable row level security;
alter table public.space_invites   enable row level security;
alter table public.trips           enable row level security;
alter table public.places          enable row level security;
alter table public.extra_countries enable row level security;
alter table public.photos          enable row level security;

-- profiles: yourself + people you share a space with
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.space_members a
    join public.space_members b on a.space_id = b.space_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- spaces
drop policy if exists spaces_read on public.spaces;
-- the creator can always read it: INSERT ... RETURNING checks this policy
-- before the membership row added by the trigger is visible
create policy spaces_read on public.spaces for select to authenticated
  using (public.is_member(id) or created_by = auth.uid());
drop policy if exists spaces_insert on public.spaces;
create policy spaces_insert on public.spaces for insert to authenticated with check (created_by = auth.uid());
drop policy if exists spaces_update on public.spaces;
create policy spaces_update on public.spaces for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));
drop policy if exists spaces_delete on public.spaces;
create policy spaces_delete on public.spaces for delete to authenticated using (public.is_owner(id));

-- members: see co-members; leave yourself, or the owner removes someone
drop policy if exists members_read on public.space_members;
create policy members_read on public.space_members for select to authenticated using (public.is_member(space_id));
drop policy if exists members_delete on public.space_members;
create policy members_delete on public.space_members for delete to authenticated
  using (user_id = auth.uid() or public.is_owner(space_id));

-- invites: members create and see them; joining happens via accept_invite()
drop policy if exists invites_read on public.space_invites;
create policy invites_read on public.space_invites for select to authenticated using (public.is_member(space_id));
drop policy if exists invites_insert on public.space_invites;
create policy invites_insert on public.space_invites for insert to authenticated
  with check (public.is_member(space_id) and created_by = auth.uid());
drop policy if exists invites_delete on public.space_invites;
create policy invites_delete on public.space_invites for delete to authenticated using (public.is_member(space_id));

-- shared data: full access for members of the space
do $$
declare t text;
begin
  foreach t in array array['trips', 'places', 'extra_countries', 'photos'] loop
    execute format('drop policy if exists %1$s_member_all on public.%1$s', t);
    execute format(
      'create policy %1$s_member_all on public.%1$s for all to authenticated
         using (public.is_member(space_id)) with check (public.is_member(space_id))', t);
  end loop;
end $$;

-- a place can only be attached to a trip of the same space
create or replace function public.check_place_trip()
returns trigger language plpgsql as $$
begin
  if new.trip_id is not null and not exists (
    select 1 from public.trips where id = new.trip_id and space_id = new.space_id
  ) then
    raise exception 'trip belongs to a different space';
  end if;
  return new;
end $$;
drop trigger if exists places_trip_check on public.places;
create trigger places_trip_check before insert or update on public.places
  for each row execute function public.check_place_trip();

-- ── storage: private photos bucket, files under '<space_id>/...' ────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists photos_member_read on storage.objects;
create policy photos_member_read on storage.objects for select to authenticated using (
  bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists photos_member_write on storage.objects;
create policy photos_member_write on storage.objects for insert to authenticated with check (
  bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists photos_member_delete on storage.objects;
create policy photos_member_delete on storage.objects for delete to authenticated using (
  bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid)
);

-- ── realtime: partner's changes show up live ─────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['places', 'trips', 'extra_countries', 'photos'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

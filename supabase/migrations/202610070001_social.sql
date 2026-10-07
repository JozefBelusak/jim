begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.social_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  bio text not null default '' check (length(bio) <= 280),
  created_at timestamptz not null default now()
);
create table public.direct_chats (
  id uuid primary key default gen_random_uuid(),
  member_a uuid not null references public.social_profiles(id) on delete cascade,
  member_b uuid not null references public.social_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  read_a_at timestamptz, read_b_at timestamptz,
  check (member_a < member_b), unique(member_a, member_b)
);
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.direct_chats(id) on delete cascade,
  sender_id uuid not null references public.social_profiles(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  client_id text not null check (length(client_id) between 8 and 100),
  created_at timestamptz not null default clock_timestamp(),
  unique(sender_id, client_id)
);
create index chat_messages_page on public.chat_messages(chat_id, created_at desc, id desc);
create index chat_messages_rate on public.chat_messages(sender_id, created_at desc);
create index direct_chats_member_b on public.direct_chats(member_b);
create table public.social_blocks (
  blocker_id uuid not null references public.social_profiles(id) on delete cascade,
  blocked_id uuid not null references public.social_profiles(id) on delete cascade,
  primary key(blocker_id, blocked_id), check(blocker_id <> blocked_id)
);

alter table public.social_profiles enable row level security;
alter table public.direct_chats enable row level security;
alter table public.chat_messages enable row level security;
alter table public.social_blocks enable row level security;
create policy profiles_public on public.social_profiles for select to anon, authenticated using (true);
create policy profiles_create on public.social_profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_edit on public.social_profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy chats_participants on public.direct_chats for select to authenticated using ((select auth.uid()) in (member_a, member_b));
create policy messages_participants on public.chat_messages for select to authenticated using (
  exists(select 1 from public.direct_chats c where c.id = chat_id and (select auth.uid()) in (c.member_a, c.member_b))
);
create policy blocks_read on public.social_blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy blocks_add on public.social_blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy blocks_remove on public.social_blocks for delete to authenticated using (blocker_id = (select auth.uid()));

revoke all on public.social_profiles, public.direct_chats, public.chat_messages, public.social_blocks from public, anon, authenticated;
grant select on public.social_profiles to anon, authenticated;
grant insert(id,username,display_name,bio), update(username,display_name,bio) on public.social_profiles to authenticated;
grant select on public.direct_chats, public.chat_messages, public.social_blocks to authenticated;
grant insert, delete on public.social_blocks to authenticated;

create function private.start_direct_chat(other_user_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); result uuid;
begin
  if me is null or not exists(select 1 from public.social_profiles where id = me) then raise exception 'profile_required'; end if;
  if me = other_user_id or not exists(select 1 from public.social_profiles where id = other_user_id) or exists(
    select 1 from public.social_blocks where (blocker_id = me and blocked_id = other_user_id) or (blocker_id = other_user_id and blocked_id = me)
  ) then raise exception 'chat_unavailable'; end if;
  insert into public.direct_chats(member_a, member_b) values(least(me, other_user_id), greatest(me, other_user_id))
    on conflict(member_a,member_b) do update set member_a = excluded.member_a returning id into result;
  return result;
end $$;
create function public.start_direct_chat(other_user_id uuid) returns uuid
language sql security invoker set search_path = '' as $$ select private.start_direct_chat(other_user_id) $$;

create function private.send_direct_message(chat_id uuid, message_body text, client_id text) returns setof public.chat_messages
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); peer uuid; existing public.chat_messages; sent public.chat_messages;
begin
  if me is null then raise exception 'profile_required'; end if;
  -- Serialize this sender's attempts, including simultaneous tabs and nonce retries.
  perform 1 from public.social_profiles p where p.id = me for update;
  select case when c.member_a = me then c.member_b else c.member_a end into peer from public.direct_chats c
    where c.id = send_direct_message.chat_id and me in (c.member_a,c.member_b);
  if peer is null then raise exception 'chat_unavailable'; end if;
  select * into existing from public.chat_messages m where m.sender_id = me and m.client_id = send_direct_message.client_id;
  if existing.id is not null then
    if existing.chat_id <> chat_id or existing.body <> btrim(message_body) then raise exception 'nonce_reused'; end if;
    return next existing; return;
  end if;
  if exists(select 1 from public.social_blocks where (blocker_id = me and blocked_id = peer) or (blocker_id = peer and blocked_id = me)) then raise exception 'chat_unavailable'; end if;
  if (select count(*) from public.chat_messages where sender_id = me and created_at > clock_timestamp() - interval '1 minute') >= 30 then raise exception 'rate_limit'; end if;
  insert into public.chat_messages(chat_id,sender_id,body,client_id) values(chat_id,me,btrim(message_body),client_id) returning * into sent;
  update public.direct_chats c set last_message_at = greatest(c.last_message_at, sent.created_at) where c.id = chat_id;
  return next sent;
end $$;
create function public.send_direct_message(chat_id uuid, message_body text, client_id text) returns setof public.chat_messages
language sql security invoker set search_path = '' as $$ select * from private.send_direct_message(chat_id,message_body,client_id) $$;

create function public.get_direct_messages(chat_id uuid, before_time timestamptz default null, before_id uuid default null)
returns setof public.chat_messages language sql stable security invoker set search_path = '' as $$
  select m.* from public.chat_messages m where m.chat_id = get_direct_messages.chat_id
    and (before_time is null or (m.created_at,m.id) < (before_time,before_id)) order by m.created_at desc,m.id desc limit 50
$$;
create function public.list_direct_chats() returns table(
  id uuid, peer_id uuid, username text, display_name text, bio text,
  last_body text, last_message_at timestamptz, unread_count bigint
) language sql stable security invoker set search_path = '' as $$
  select c.id,p.id,p.username,p.display_name,p.bio,latest.body,c.last_message_at,
    (select count(*) from public.chat_messages m where m.chat_id = c.id and m.sender_id <> auth.uid()
      and m.created_at > coalesce(case when c.member_a = auth.uid() then c.read_a_at else c.read_b_at end,'-infinity'::timestamptz))
  from public.direct_chats c join public.social_profiles p on p.id = case when c.member_a = auth.uid() then c.member_b else c.member_a end
  left join lateral(select body from public.chat_messages m where m.chat_id = c.id order by m.created_at desc,m.id desc limit 1) latest on true
  order by coalesce(c.last_message_at,c.created_at) desc
$$;
create function private.mark_direct_chat_read(chat_id uuid, message_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); seen timestamptz;
begin
  select m.created_at into seen from public.chat_messages m join public.direct_chats c on c.id = m.chat_id
    where c.id = mark_direct_chat_read.chat_id and m.id = mark_direct_chat_read.message_id and me in(c.member_a,c.member_b);
  if seen is null then raise exception 'chat_unavailable'; end if;
  update public.direct_chats c set
    read_a_at = case when c.member_a = me then greatest(c.read_a_at,seen) else c.read_a_at end,
    read_b_at = case when c.member_b = me then greatest(c.read_b_at,seen) else c.read_b_at end where c.id = chat_id;
end $$;
create function public.mark_direct_chat_read(chat_id uuid, message_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.mark_direct_chat_read(chat_id,message_id) $$;

revoke all on function private.start_direct_chat(uuid), private.send_direct_message(uuid,text,text), private.mark_direct_chat_read(uuid,uuid) from public,anon;
grant execute on function private.start_direct_chat(uuid), private.send_direct_message(uuid,text,text), private.mark_direct_chat_read(uuid,uuid) to authenticated;
revoke all on function public.start_direct_chat(uuid), public.send_direct_message(uuid,text,text), public.get_direct_messages(uuid,timestamptz,uuid), public.list_direct_chats(), public.mark_direct_chat_read(uuid,uuid) from public,anon;
grant execute on function public.start_direct_chat(uuid), public.send_direct_message(uuid,text,text), public.get_direct_messages(uuid,timestamptz,uuid), public.list_direct_chats(), public.mark_direct_chat_read(uuid,uuid) to authenticated;

-- Existing Supabase projects have this publication. Standalone PostgreSQL tests need none.
do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_messages, public.direct_chats;
  end if;
end $$;
commit;

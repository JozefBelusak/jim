begin;
-- Run after 202610070001_social.sql. Existing accounts/messages stay intact.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-photos','chat-photos',false,5242880,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table public.chat_photos (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.direct_chats(id) on delete cascade,
  user_id uuid not null references public.social_profiles(id) on delete cascade,
  client_id text not null check(length(client_id) between 8 and 100),
  byte_size integer not null check(byte_size between 1 and 5242880),
  width integer not null check(width between 1 and 2560),
  height integer not null check(height between 1 and 2560),
  object_path text generated always as(user_id::text || '/' || chat_id::text || '/' || id::text || '.jpg') stored unique,
  created_at timestamptz not null default now(),
  unique(user_id,client_id)
);
alter table public.chat_messages add column photo_path text references public.chat_photos(object_path);
alter table public.chat_messages add column photo_width integer;
alter table public.chat_messages add column photo_height integer;
alter table public.chat_messages drop constraint chat_messages_body_check;
alter table public.chat_messages add constraint chat_messages_content_check check(
  length(btrim(body)) <= 2000 and (length(btrim(body)) > 0 or photo_path is not null)
);
alter table public.chat_messages add constraint chat_messages_photo_check check(
  (photo_path is null and photo_width is null and photo_height is null) or
  (photo_path is not null and photo_width is not null and photo_height is not null and photo_width between 1 and 2560 and photo_height between 1 and 2560)
);
create unique index chat_messages_photo_unique on public.chat_messages(photo_path) where photo_path is not null;

alter table public.chat_photos enable row level security;
revoke all on public.chat_photos from public,anon,authenticated;
grant select on public.chat_photos to authenticated;
create policy chat_photos_owner on public.chat_photos for select to authenticated using(user_id=(select auth.uid()));

create function private.can_upload_chat_photo(object_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.chat_photos p join public.direct_chats c on c.id=p.chat_id
    where p.object_path=can_upload_chat_photo.object_path and p.user_id=auth.uid()
      and auth.uid() in(c.member_a,c.member_b)
      and not exists(select 1 from public.chat_messages m where m.photo_path=p.object_path)
      and not exists(select 1 from public.social_blocks b where
        (b.blocker_id=c.member_a and b.blocked_id=c.member_b) or (b.blocker_id=c.member_b and b.blocked_id=c.member_a)))
$$;
create function private.can_read_chat_photo(object_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.chat_photos p join public.direct_chats c on c.id=p.chat_id
    where p.object_path=can_read_chat_photo.object_path and auth.uid() in(c.member_a,c.member_b)
      and (p.user_id=auth.uid() or exists(select 1 from public.chat_messages m where m.photo_path=p.object_path)))
$$;
create policy chat_photos_upload on storage.objects for insert to authenticated
  with check(bucket_id='chat-photos' and private.can_upload_chat_photo(name));
create policy chat_photos_read on storage.objects for select to authenticated
  using(bucket_id='chat-photos' and private.can_read_chat_photo(name));
-- Uploaded objects are immutable. Retrying cannot replace an already sent image.

create function private.reserve_chat_photo(chat_id uuid,client_id text,byte_size integer,width integer,height integer)
returns setof public.chat_photos language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); peer uuid; existing public.chat_photos; reserved public.chat_photos;
begin
  if me is null then raise exception 'profile_required'; end if;
  perform 1 from public.social_profiles p where p.id=me for update;
  select case when c.member_a=me then c.member_b else c.member_a end into peer from public.direct_chats c
    where c.id=reserve_chat_photo.chat_id and me in(c.member_a,c.member_b);
  if peer is null or exists(select 1 from public.social_blocks where
    (blocker_id=me and blocked_id=peer) or (blocker_id=peer and blocked_id=me)) then raise exception 'chat_unavailable'; end if;
  if byte_size is null or byte_size not between 1 and 5242880 or width is null or width not between 1 and 2560
    or height is null or height not between 1 and 2560 then raise exception 'photo_invalid'; end if;
  select * into existing from public.chat_photos p where p.user_id=me and p.client_id=reserve_chat_photo.client_id;
  if existing.id is not null then
    if existing.chat_id<>chat_id or existing.byte_size<>byte_size or existing.width<>width or existing.height<>height then raise exception 'nonce_reused'; end if;
    return next existing; return;
  end if;
  if (select count(*) from public.chat_photos p where p.user_id=me
    and not exists(select 1 from public.chat_messages m where m.photo_path=p.object_path))>=20 then raise exception 'photo_limit'; end if;
  insert into public.chat_photos(chat_id,user_id,client_id,byte_size,width,height)
    values(chat_id,me,client_id,byte_size,width,height) returning * into reserved;
  return next reserved;
end $$;
create function public.reserve_chat_photo(chat_id uuid,client_id text,byte_size integer,width integer,height integer)
returns setof public.chat_photos language sql security invoker set search_path='' as $$
  select * from private.reserve_chat_photo(chat_id,client_id,byte_size,width,height)
$$;

-- Text and photos share sender authorization, rate limits, nonce retries and timestamps.
create function private.send_chat_message(chat_id uuid,message_body text,client_id text,photo_path text)
returns setof public.chat_messages language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); peer uuid; existing public.chat_messages; sent public.chat_messages; photo public.chat_photos;
begin
  if me is null then raise exception 'profile_required'; end if;
  perform 1 from public.social_profiles p where p.id=me for update;
  select case when c.member_a=me then c.member_b else c.member_a end into peer from public.direct_chats c
    where c.id=send_chat_message.chat_id and me in(c.member_a,c.member_b);
  if peer is null then raise exception 'chat_unavailable'; end if;
  select * into existing from public.chat_messages m where m.sender_id=me and m.client_id=send_chat_message.client_id;
  if existing.id is not null then
    if existing.chat_id<>chat_id or existing.body is distinct from btrim(message_body)
      or existing.photo_path is distinct from photo_path then raise exception 'nonce_reused'; end if;
    return next existing; return;
  end if;
  if exists(select 1 from public.social_blocks where
    (blocker_id=me and blocked_id=peer) or (blocker_id=peer and blocked_id=me)) then raise exception 'chat_unavailable'; end if;
  if (select count(*) from public.chat_messages where sender_id=me and created_at>clock_timestamp()-interval '1 minute')>=30 then raise exception 'rate_limit'; end if;
  if photo_path is not null then
    select * into photo from public.chat_photos p where p.object_path=send_chat_message.photo_path and p.user_id=me
      and p.chat_id=send_chat_message.chat_id and p.client_id=send_chat_message.client_id;
    if photo.id is null then raise exception 'photo_invalid'; end if;
    if not exists(select 1 from storage.objects o where o.bucket_id='chat-photos' and o.name=photo.object_path
      and o.metadata->>'mimetype'='image/jpeg' and (o.metadata->>'size')::bigint=photo.byte_size) then raise exception 'photo_missing'; end if;
  end if;
  insert into public.chat_messages(chat_id,sender_id,body,client_id,photo_path,photo_width,photo_height)
    values(chat_id,me,btrim(message_body),client_id,photo_path,photo.width,photo.height) returning * into sent;
  update public.direct_chats c set last_message_at=greatest(c.last_message_at,sent.created_at) where c.id=chat_id;
  return next sent;
end $$;
create or replace function private.send_direct_message(chat_id uuid,message_body text,client_id text)
returns setof public.chat_messages language sql security definer set search_path='' as $$
  select * from private.send_chat_message(chat_id,message_body,client_id,null)
$$;
create function public.send_direct_photo(chat_id uuid,message_body text,client_id text,photo_path text)
returns setof public.chat_messages language sql security invoker set search_path='' as $$
  select * from private.send_chat_message(chat_id,message_body,client_id,photo_path)
$$;
-- Keep the return shape of the existing inbox RPC; photo-only messages have a useful preview.
create or replace function public.list_direct_chats() returns table(
  id uuid,peer_id uuid,username text,display_name text,bio text,last_body text,last_message_at timestamptz,unread_count bigint
) language sql stable security invoker set search_path='' as $$
  select c.id,p.id,p.username,p.display_name,p.bio,latest.body,c.last_message_at,
    (select count(*) from public.chat_messages m where m.chat_id=c.id and m.sender_id<>auth.uid()
      and m.created_at>coalesce(case when c.member_a=auth.uid() then c.read_a_at else c.read_b_at end,'-infinity'::timestamptz))
  from public.direct_chats c join public.social_profiles p on p.id=case when c.member_a=auth.uid() then c.member_b else c.member_a end
  left join lateral(select case when m.photo_path is not null then 'Fotka' || case when m.body<>'' then ' · ' || m.body else '' end else m.body end as body
    from public.chat_messages m where m.chat_id=c.id order by m.created_at desc,m.id desc limit 1) latest on true
  order by coalesce(c.last_message_at,c.created_at) desc
$$;
revoke all on function private.can_upload_chat_photo(text),private.can_read_chat_photo(text),private.reserve_chat_photo(uuid,text,integer,integer,integer),private.send_chat_message(uuid,text,text,text) from public,anon;
grant execute on function private.can_upload_chat_photo(text),private.can_read_chat_photo(text),private.reserve_chat_photo(uuid,text,integer,integer,integer),private.send_chat_message(uuid,text,text,text) to authenticated;
revoke all on function public.reserve_chat_photo(uuid,text,integer,integer,integer),public.send_direct_photo(uuid,text,text,text) from public,anon;
grant execute on function public.reserve_chat_photo(uuid,text,integer,integer,integer),public.send_direct_photo(uuid,text,text,text) to authenticated;
commit;

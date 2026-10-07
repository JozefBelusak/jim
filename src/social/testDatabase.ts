import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
export async function applyChatPhotoMigration(db: PGlite) {
  await db.exec(readFileSync(new URL('../../supabase/migrations/202610070002_chat_photos.sql', import.meta.url), 'utf8'));
}
export async function createSocialTestDatabase(photos = true): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;`);
  await db.exec(readFileSync(new URL('../../supabase/migrations/202610070001_social.sql', import.meta.url), 'utf8'));
  if (photos) await applyChatPhotoMigration(db);
  return db;
}
export async function asSocialUser(db: PGlite, id: string | null) {
  await db.exec(`reset role; set role ${id ? 'authenticated' : 'anon'};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
}

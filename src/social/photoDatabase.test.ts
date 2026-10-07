import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyChatPhotoMigration, asSocialUser, createSocialTestDatabase } from './testDatabase';
import { PhotoReservation } from './types';
const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
const stranger = '00000000-0000-4000-8000-000000000003';
let db: PGlite; let chat: string; let otherChat: string;
const asUser = (id: string | null) => asSocialUser(db, id);
async function reserve(nonce = 'photo-nonce-1', chatId = chat) {
  return (await db.query<PhotoReservation>('select * from public.reserve_chat_photo($1,$2,1000,100,200)', [chatId, nonce])).rows[0];
}
async function upload(path: string, size = 1000, mime = 'image/jpeg') {
  return db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)', ['chat-photos', path, JSON.stringify({ size, mimetype: mime })]);
}
async function send(path: string, nonce = 'photo-nonce-1', caption = '', chatId = chat) {
  return db.query<{ id: string; photo_path: string; body: string; sender_id: string; photo_width: number; photo_height: number }>('select * from public.send_direct_photo($1,$2,$3,$4)', [chatId, caption, nonce, path]);
}
describe('private photo storage and photo message RPCs in PostgreSQL', () => {
  beforeAll(async () => {
    db = await createSocialTestDatabase();
    await db.query('insert into auth.users(id) values($1),($2),($3)', [alice,bob,stranger]);
    for (const [id,name] of [[alice,'alice'],[bob,'bob'],[stranger,'stranger']]) { await asUser(id); await db.query('insert into public.social_profiles(id,username,display_name) values($1,$2,$2)',[id,name]); }
    await asUser(alice);
    chat = (await db.query<{id:string}>('select public.start_direct_chat($1) as id',[bob])).rows[0].id;
    otherChat = (await db.query<{id:string}>('select public.start_direct_chat($1) as id',[stranger])).rows[0].id;
  },30000);
  beforeEach(async () => { await db.exec('reset role; truncate public.chat_messages, public.chat_photos, storage.objects; delete from public.social_blocks;'); await asUser(alice); });
  afterAll(async () => { await db?.close(); });
  it('reserves a stable private path and validates dimensions/size/nonce', async () => {
    const first = await reserve(); expect(first.object_path).toMatch(new RegExp(`^${alice}/${chat}/.+\\.jpg$`));
    expect((await reserve()).object_path).toBe(first.object_path);
    await expect(db.query('select * from public.reserve_chat_photo($1,$2,1001,100,200)',[chat,'photo-nonce-1'])).rejects.toThrow(/nonce_reused/);
    await expect(db.query('select * from public.reserve_chat_photo($1,$2,5242881,100,200)',[chat,'too-large-photo'])).rejects.toThrow(/photo_invalid/);
    await expect(db.query('select * from public.reserve_chat_photo($1,$2,1000,3000,200)',[chat,'too-wide-photo'])).rejects.toThrow(/photo_invalid/);
    await db.exec('reset role');
    const bucket = (await db.query<{public:boolean;file_size_limit:number;allowed_mime_types:string[]}>('select * from storage.buckets')).rows[0];
    expect(bucket.public).toBe(false); expect(Number(bucket.file_size_limit)).toBe(5242880); expect(bucket.allowed_mime_types).toEqual(['image/jpeg']);
  });
  it('requires an actual uploaded JPEG before publishing', async () => {
    const photo = await reserve(); await expect(send(photo.object_path)).rejects.toThrow(/photo_missing/);
    await upload(photo.object_path,1000,'image/png'); await expect(send(photo.object_path)).rejects.toThrow(/photo_missing/);
    await db.exec('reset role; delete from storage.objects;'); await asUser(alice);
    await upload(photo.object_path,999); await expect(send(photo.object_path)).rejects.toThrow(/photo_missing/);
  });
  it('allows only the reserving sender to upload and only chat members to read sent photos', async () => {
    const photo = await reserve();
    await expect(upload('forged/path.jpg')).rejects.toThrow(/row-level security/);
    await asUser(bob); await expect(upload(photo.object_path)).rejects.toThrow(/row-level security/);
    await asUser(alice); await upload(photo.object_path);
    await asUser(bob); expect((await db.query('select * from storage.objects')).rows).toEqual([]);
    await asUser(alice); const message = (await send(photo.object_path)).rows[0];
    expect(message.sender_id).toBe(alice); expect(message.body).toBe(''); expect(message.photo_width).toBe(100);
    await asUser(bob); expect((await db.query('select * from storage.objects')).rows).toHaveLength(1);
    const inbox = (await db.query<{last_body:string;unread_count:number}>('select * from public.list_direct_chats()')).rows[0];
    expect(inbox.last_body).toBe('Fotka'); expect(Number(inbox.unread_count)).toBe(1);
    await asUser(stranger); expect((await db.query('select * from storage.objects')).rows).toEqual([]);
    await expect(reserve('stranger-photo')).rejects.toThrow(/chat_unavailable/);
    await asUser(null); await expect(db.query('select * from storage.objects')).rejects.toThrow(/permission denied/);
  });
  it('never overwrites/deletes published photos and deduplicates lost acknowledgements', async () => {
    const photo = await reserve(); await upload(photo.object_path);
    const first = (await send(photo.object_path,'photo-nonce-1','caption')).rows[0];
    expect((await send(photo.object_path,'photo-nonce-1','caption')).rows[0].id).toBe(first.id);
    await expect(send(photo.object_path,'photo-nonce-1','changed')).rejects.toThrow(/nonce_reused/);
    expect((await db.query("update storage.objects set metadata='{}' where name=$1 returning *",[photo.object_path])).rows).toEqual([]);
    expect((await db.query('delete from storage.objects where name=$1 returning *',[photo.object_path])).rows).toEqual([]);
    await expect(upload(photo.object_path)).rejects.toThrow();
    expect((await db.query('select * from public.chat_messages')).rows).toHaveLength(1);
  });
  it('prevents another sender, nonce or conversation from reusing a photo', async () => {
    const photo = await reserve(); await upload(photo.object_path);
    await expect(send(photo.object_path,'different-nonce')).rejects.toThrow(/photo_invalid/);
    await expect(send(photo.object_path,'photo-nonce-1','',otherChat)).rejects.toThrow(/photo_invalid/);
    await asUser(bob); await expect(send(photo.object_path)).rejects.toThrow(/photo_invalid/);
  });
  it('blocks new reservation/upload/publish in both directions', async () => {
    const photo = await reserve();
    await asUser(bob); await db.query('insert into public.social_blocks values($1,$2)',[bob,alice]);
    await asUser(alice); await expect(upload(photo.object_path)).rejects.toThrow(/row-level security/);
    await expect(reserve('blocked-photo')).rejects.toThrow(/chat_unavailable/);
    await expect(send(photo.object_path)).rejects.toThrow(/chat_unavailable/);
  });
  it('shares rate limits with text messages and limits unfinished reservations', async () => {
    const photo = await reserve(); await upload(photo.object_path);
    for (let i=0;i<30;i++) await db.query('select * from public.send_direct_message($1,$2,$3)',[chat,'Text',`text-rate-${i}`]);
    await expect(send(photo.object_path)).rejects.toThrow(/rate_limit/);
    for (let i=1;i<20;i++) await reserve(`reserve-limit-${i}`);
    expect((await reserve()).object_path).toBe(photo.object_path);
    await expect(reserve('reserve-over-limit')).rejects.toThrow(/photo_limit/);
  });
});
it('migrates already used text chats without changing accounts or old messages', async () => {
  const legacy = await createSocialTestDatabase(false);
  try {
    await legacy.query('insert into auth.users(id) values($1),($2)', [alice,bob]);
    for (const [id,name] of [[alice,'alice'],[bob,'bob']]) { await asSocialUser(legacy,id); await legacy.query('insert into public.social_profiles(id,username,display_name) values($1,$2,$2)',[id,name]); }
    await asSocialUser(legacy,alice);
    const id = (await legacy.query<{id:string}>('select public.start_direct_chat($1) as id',[bob])).rows[0].id;
    const original = (await legacy.query<{id:string}>('select * from public.send_direct_message($1,$2,$3)',[id,'Old message','legacy-nonce'])).rows[0];
    await legacy.query('select * from public.get_direct_messages($1)',[id]); await legacy.query('select * from public.list_direct_chats()');
    await legacy.exec('reset role'); await applyChatPhotoMigration(legacy);
    expect((await legacy.query('select * from auth.users')).rows).toHaveLength(2);
    expect((await legacy.query('select * from public.social_profiles')).rows).toHaveLength(2);
    await asSocialUser(legacy,alice);
    const migrated = (await legacy.query<{id:string;body:string;photo_path:null}>('select * from public.get_direct_messages($1)',[id])).rows[0];
    expect(migrated.id).toBe(original.id); expect(migrated.body).toBe('Old message'); expect(migrated.photo_path).toBeNull();
    expect((await legacy.query<{id:string}>('select * from public.send_direct_message($1,$2,$3)',[id,'Old message','legacy-nonce'])).rows[0].id).toBe(original.id);
  } finally { await legacy.close(); }
},30000);

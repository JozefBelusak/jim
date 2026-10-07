import { PGlite } from '@electric-sql/pglite';
import { asSocialUser, createSocialTestDatabase } from './testDatabase';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
const stranger = '00000000-0000-4000-8000-000000000003';
let db: PGlite;
let chatId: string;
const asUser = (id: string | null) => asSocialUser(db, id);
async function send(body: string, nonce: string) {
  return db.query<{ id: string; sender_id: string; body: string }>('select * from public.send_direct_message($1,$2,$3)', [chatId, body, nonce]);
}

describe('actual PostgreSQL social permissions and chat RPCs', () => {
  beforeAll(async () => {
    db = await createSocialTestDatabase();
    await db.query('insert into auth.users(id,email) values($1,$4),($2,$5),($3,$6)', [alice, bob, stranger, 'private@alice.test', 'private@bob.test', 'private@stranger.test']);
    for (const [id, name] of [[alice, 'alice'], [bob, 'bob'], [stranger, 'stranger']]) {
      await asUser(id);
      await db.query('insert into public.social_profiles(id,username,display_name) values($1,$2,$2)', [id, name]);
    }
  }, 30000);
  afterAll(async () => { await db?.close(); });
  it('lets guests read public profiles but denies email and chats', async () => {
    await asUser(null);
    expect((await db.query('select * from public.social_profiles')).rows).toHaveLength(3);
    await expect(db.query('select email from auth.users')).rejects.toThrow(/permission denied/);
    await expect(db.query('select * from public.chat_messages')).rejects.toThrow(/permission denied/);
    await expect(db.query('select public.start_direct_chat($1)', [alice])).rejects.toThrow(/permission denied/);
  });
  it('denies impersonated profile inserts and edits', async () => {
    await asUser(alice);
    await expect(db.query("update public.social_profiles set id=$1 where id=$2", [stranger, alice])).rejects.toThrow(/permission denied/);
    expect((await db.query("update public.social_profiles set bio='spoof' where id=$1 returning *", [bob])).rows).toEqual([]);
    await expect(db.query('insert into public.social_profiles(id,username,display_name) values($1,$2,$2)', ['00000000-0000-4000-8000-000000000004', 'spoof'])).rejects.toThrow(/row-level security/);
  });
  it('creates the same conversation from either participant and denies self chat', async () => {
    await asUser(alice);
    chatId = (await db.query<{ id: string }>('select public.start_direct_chat($1) as id', [bob])).rows[0].id;
    await expect(db.query('select public.start_direct_chat($1)', [alice])).rejects.toThrow(/chat_unavailable/);
    await asUser(bob);
    expect((await db.query<{ id: string }>('select public.start_direct_chat($1) as id', [alice])).rows[0].id).toBe(chatId);
  });
  it('assigns sender server-side and makes retries idempotent', async () => {
    await asUser(alice);
    const first = (await send(' Hi Bob ', 'retry-nonce-1')).rows[0];
    expect(first.sender_id).toBe(alice); expect(first.body).toBe('Hi Bob');
    expect((await send('Hi Bob', 'retry-nonce-1')).rows[0].id).toBe(first.id);
    await expect(send('different', 'retry-nonce-1')).rejects.toThrow(/nonce_reused/);
    await expect(db.query('insert into public.chat_messages(chat_id,sender_id,body,client_id) values($1,$2,$3,$4)', [chatId, bob, 'spoof', 'nonce-spoof'])).rejects.toThrow(/permission denied/);
  });
  it('hides conversation and messages from a third account', async () => {
    await asUser(stranger);
    expect((await db.query('select * from public.direct_chats')).rows).toEqual([]);
    expect((await db.query('select * from public.get_direct_messages($1)', [chatId])).rows).toEqual([]);
    await expect(send('intrusion', 'nonce-intrusion')).rejects.toThrow(/chat_unavailable/);
  });
  it('counts unread and marks only actual messages in own conversation as read', async () => {
    await asUser(bob);
    const chat = (await db.query<{ unread_count: number }>('select * from public.list_direct_chats()')).rows[0];
    expect(Number(chat.unread_count)).toBe(1);
    const message = (await db.query<{ id: string }>('select * from public.get_direct_messages($1)', [chatId])).rows[0];
    await db.query('select public.mark_direct_chat_read($1,$2)', [chatId, message.id]);
    expect(Number((await db.query<{ unread_count: number }>('select * from public.list_direct_chats()')).rows[0].unread_count)).toBe(0);
    await asUser(stranger);
    await expect(db.query('select public.mark_direct_chat_read($1,$2)', [chatId, message.id])).rejects.toThrow(/chat_unavailable/);
  });
  it('enforces message length, bidirectional blocks and private block lists', async () => {
    await asUser(bob);
    await expect(send(' ', 'nonce-empty')).rejects.toThrow();
    await expect(send('x'.repeat(2001), 'nonce-long')).rejects.toThrow();
    await db.query('insert into public.social_blocks values($1,$2)', [bob, alice]);
    await expect(send('blocked', 'nonce-block-b')).rejects.toThrow(/chat_unavailable/);
    await asUser(alice);
    expect((await db.query('select * from public.social_blocks')).rows).toEqual([]);
    await expect(send('blocked', 'nonce-block-a')).rejects.toThrow(/chat_unavailable/);
    await expect(db.query('select public.start_direct_chat($1)', [bob])).rejects.toThrow(/chat_unavailable/);
    await asUser(bob); await db.query('delete from public.social_blocks where blocked_id=$1', [alice]);
    expect((await send('Unblocked', 'nonce-unblocked')).rows).toHaveLength(1);
  });
  it('limits abuse server-side, retries still work at the rate limit', async () => {
    await asUser(alice);
    for (let index = 0; index < 29; index++) await send('hello', `rate-nonce-${index}`);
    await expect(send('too fast', 'rate-over-limit')).rejects.toThrow(/rate_limit/);
    expect((await send('Hi Bob', 'retry-nonce-1')).rows).toHaveLength(1);
  });
  it('paginates equal timestamps without losing or repeating messages', async () => {
    await db.exec('reset role');
    const timestamp = '2026-01-01T12:00:00Z';
    for (let index = 0; index < 60; index++) {
      await db.query('insert into public.chat_messages(chat_id,sender_id,body,client_id,created_at) values($1,$2,$3,$4,$5)', [chatId, alice, `Page ${index}`, `page-nonce-${index}`, timestamp]);
    }
    await asUser(bob);
    type PageMessage = { id: string; created_at: string };
    const first = (await db.query<PageMessage>('select * from public.get_direct_messages($1)', [chatId])).rows;
    const cursor = first[first.length - 1];
    const second = (await db.query<PageMessage>('select * from public.get_direct_messages($1,$2,$3)', [chatId, cursor.created_at, cursor.id])).rows;
    expect(first).toHaveLength(50);
    expect(new Set([...first, ...second].map((message) => message.id)).size).toBe(91);
    expect(second).toHaveLength(41);
  });

});

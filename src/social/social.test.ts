import { describe, expect, it } from 'vitest';
import { mergeMessages, searchTerm, socialError, validateMessage, validateProfile } from './domain';
import { createOutbox } from './outbox';
import { ChatMessage } from './types';

describe('social domain', () => {
  it('normalizes profiles and rejects invalid public handles', () => {
    expect(validateProfile({ username: ' Alice_1 ', display_name: ' Alice ', bio: ' hi ' })).toEqual({ username: 'alice_1', display_name: 'Alice', bio: 'hi' });
    for (const username of ['a', 'j@no', 'x),id.eq.secret', 'jožo']) expect(() => validateProfile({ username, display_name: 'Name', bio: '' })).toThrow();
  });
  it('sanitizes search operators without removing diacritics', () => { expect(searchTerm('Žofia),id.eq.%')).toBe('Žofiaideq'); });
  it('rejects empty and oversized messages', () => { expect(validateMessage(' hi ')).toBe('hi'); expect(() => validateMessage(' ')).toThrow(); expect(() => validateMessage('x'.repeat(2001))).toThrow(); });
  it('merges realtime and acknowledgements without duplicate messages', () => {
    const message: ChatMessage = { id: 'a', chat_id: 'chat', sender_id: 'sender', body: 'hi', client_id: 'nonce', created_at: '2026-10-07T10:00:00Z' };
    expect(mergeMessages([message], [message, { ...message, id: 'b', created_at: '2026-10-06T10:00:00Z' }]).map((m) => m.id)).toEqual(['b', 'a']);
  });
  it('maps internal errors without exposing database details', () => { expect(socialError({ code: '23505', message: 'private sql' })).toContain('obsadené'); expect(socialError(new Error('SELECT service_role'))).not.toContain('SELECT'); });
});

describe('durable message outbox', () => {
  const fixture = () => {
    const data = new Map<string, string>();
    const storage = { getItem: async (key: string) => data.get(key) ?? null, setItem: async (key: string, value: string) => { data.set(key, value); }, removeItem: async (key: string) => { data.delete(key); }, getAllKeys: async () => [...data.keys()] };
    return { data, storage };
  };
  it('retains failed messages across reload and isolates users/chats', async () => {
    const { storage } = fixture(); const queue = createOutbox('alice', 'chat1', storage);
    await queue.add({ clientId: 'nonce123', body: 'Hello', createdAt: '2026-10-07' });
    expect(await createOutbox('alice', 'chat1', storage).read()).toHaveLength(1);
    expect(await createOutbox('bob', 'chat1', storage).read()).toHaveLength(0);
    expect(await createOutbox('alice', 'chat2', storage).read()).toHaveLength(0);
    await queue.remove('nonce123'); expect(await queue.read()).toEqual([]);
  });
  it('preserves concurrent tab writes and reuses the same retry nonce', async () => {
    const { storage } = fixture(); const queue = createOutbox('alice', 'chat1', storage);
    const first = { clientId: 'nonce123', body: 'Hello', createdAt: '2026-10-07' };
    await Promise.all([queue.add(first), createOutbox('alice', 'chat1', storage).add({ ...first, clientId: 'nonce456' }), queue.add(first)]);
    expect(await queue.read()).toHaveLength(2);
  });
});

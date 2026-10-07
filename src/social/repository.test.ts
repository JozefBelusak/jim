import { createClient } from '@supabase/supabase-js';
import { expect, it } from 'vitest';
import { socialRepository } from './repository';
import { ChatMessage, Database } from './types';

function fixture() {
  const authorizations: (string | null)[] = [];
  const uploadBodies: (BodyInit | null | undefined)[] = [];
  const message: ChatMessage = { id: 'message', chat_id: 'chat', sender_id: 'alice', body: 'hello', client_id: 'nonce123', created_at: '2026-10-07T12:00:00Z' };
  const transport: typeof fetch = async (input, init) => {
    authorizations.push(new Headers(init?.headers).get('Authorization'));
    if (String(input).includes('/storage/')) uploadBodies.push(init?.body);
    const result = String(input).includes('start_direct_chat') ? 'chat' : String(input).includes('reserve_chat_photo') ? [{ object_path: 'alice/chat/photo.jpg' }] : [message];
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  };
  // The shared SDK has switched to Bob while an operation from Alice is still pending.
  const client = createClient<Database>('https://fixture.test', 'sb_publishable_fixture', { accessToken: async () => 'bob-current-session', global: { fetch: transport } });
  return { repository: socialRepository(client), authorizations, message, uploadBodies };
}
it('binds pending message delivery to the account that composed it', async () => {
  const { repository, authorizations, message } = fixture();
  expect(await repository.send('chat', 'hello', 'nonce123', 'alice-session-snapshot')).toEqual(message);
  expect(authorizations).toEqual(['Bearer alice-session-snapshot']);
});
it('binds conversation creation to the initiating account', async () => {
  const { repository, authorizations } = fixture();
  expect(await repository.startChat('peer', 'alice-session-snapshot')).toBe('chat');
  expect(authorizations).toEqual(['Bearer alice-session-snapshot']);
});
it('binds photo reservation, upload and publication to the composing account', async () => {
  const { repository, authorizations, uploadBodies } = fixture();
  const photo = { width: 100, height: 200, byteSize: 3, blob: new Blob(['jpg'], { type: 'image/jpeg' }) };
  const path = await repository.reservePhoto('chat', 'photo-nonce', photo, 'alice-session-snapshot');
  await repository.uploadPhoto(path, photo, 'alice-session-snapshot');
  await repository.sendPhoto('chat', '', 'photo-nonce', path, 'alice-session-snapshot');
  expect(authorizations).toEqual(Array(3).fill('Bearer alice-session-snapshot'));
  expect(uploadBodies[0]).toBeInstanceOf(ArrayBuffer);
  expect(new Uint8Array(uploadBodies[0] as ArrayBuffer)).toEqual(new TextEncoder().encode('jpg'));
});

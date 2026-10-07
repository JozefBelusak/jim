import { createClient } from '@supabase/supabase-js';
import { expect, it } from 'vitest';
import { socialRepository } from './repository';
import { ChatMessage, Database } from './types';

function fixture() {
  const authorizations: (string | null)[] = [];
  const message: ChatMessage = { id: 'message', chat_id: 'chat', sender_id: 'alice', body: 'hello', client_id: 'nonce123', created_at: '2026-10-07T12:00:00Z' };
  const transport: typeof fetch = async (input, init) => {
    authorizations.push(new Headers(init?.headers).get('Authorization'));
    const result = String(input).includes('start_direct_chat') ? 'chat' : [message];
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  };
  // The shared SDK has switched to Bob while an operation from Alice is still pending.
  const client = createClient<Database>('https://fixture.test', 'sb_publishable_fixture', { accessToken: async () => 'bob-current-session', global: { fetch: transport } });
  return { repository: socialRepository(client), authorizations, message };
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

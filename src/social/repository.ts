import { SupabaseClient } from '@supabase/supabase-js';
import { searchTerm, validateMessage, validateProfile } from './domain';
import { ChatMessage, Database, ProfileInput } from './types';

export function socialRepository(client: SupabaseClient<Database>) {
  return {
    async profile(id: string) {
      const { data, error } = await client.from('social_profiles').select('*').eq('id', id).maybeSingle();
      if (error) throw error; return data;
    },
    async byUsername(username: string) {
      const { data, error } = await client.from('social_profiles').select('*').eq('username', username).maybeSingle();
      if (error) throw error; return data;
    },
    async saveProfile(id: string, input: ProfileInput, exists: boolean) {
      const profile = validateProfile(input);
      const query = exists ? client.from('social_profiles').update(profile).eq('id', id) : client.from('social_profiles').insert({ ...profile, id });
      const { data, error } = await query.select().single();
      if (error) throw error; return data;
    },
    async search(query: string) {
      const term = searchTerm(query); if (term.length < 2) return [];
      const { data, error } = await client.from('social_profiles').select('*').or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).order('username').limit(30);
      if (error) throw error; return data;
    },
    async chats() {
      const { data, error } = await client.rpc('list_direct_chats');
      if (error) throw error; return data;
    },
    async startChat(peerId: string, accessToken: string) {
      const { data, error } = await client.rpc('start_direct_chat', { other_user_id: peerId }).setHeader('Authorization', `Bearer ${accessToken}`);
      if (error) throw error; return data;
    },
    async messages(chatId: string, before?: ChatMessage) {
      const { data, error } = await client.rpc('get_direct_messages', { chat_id: chatId, ...(before ? { before_time: before.created_at, before_id: before.id } : {}) });
      if (error) throw error; return data;
    },
    async send(chatId: string, body: string, clientId: string, accessToken: string) {
      const { data, error } = await client.rpc('send_direct_message', { chat_id: chatId, message_body: validateMessage(body), client_id: clientId }).setHeader('Authorization', `Bearer ${accessToken}`);
      if (error) throw error; if (!data[0]) throw new Error('Missing acknowledgement'); return data[0];
    },
    async read(chatId: string, messageId: string) {
      const { error } = await client.rpc('mark_direct_chat_read', { chat_id: chatId, message_id: messageId }); if (error) throw error;
    },
    async isBlocked(me: string, peer: string) {
      const { data, error } = await client.from('social_blocks').select('*').eq('blocker_id', me).eq('blocked_id', peer).maybeSingle();
      if (error) throw error; return Boolean(data);
    },
    async block(me: string, peer: string, blocked: boolean) {
      const query = blocked ? client.from('social_blocks').insert({ blocker_id: me, blocked_id: peer }) : client.from('social_blocks').delete().eq('blocker_id', me).eq('blocked_id', peer);
      const { error } = await query; if (error) throw error;
    },
  };
}
export type SocialRepository = ReturnType<typeof socialRepository>;

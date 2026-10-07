import { SupabaseClient } from '@supabase/supabase-js';
import { searchTerm, validateChatContent, validateMessage, validateProfile } from './domain';
import { PHOTO_BUCKET, validatePhotoMetadata } from './photos';
import { ChatMessage, Database, PhotoMetadata, PreparedPhoto, ProfileInput } from './types';

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
    async reservePhoto(chatId: string, clientId: string, photo: PhotoMetadata, accessToken: string) {
      validatePhotoMetadata(photo);
      const { data, error } = await client.rpc('reserve_chat_photo', { chat_id: chatId, client_id: clientId, byte_size: photo.byteSize, width: photo.width, height: photo.height }).setHeader('Authorization', `Bearer ${accessToken}`);
      if (error) throw error; if (!data[0]) throw new Error('Missing photo reservation'); return data[0].object_path;
    },
    async uploadPhoto(path: string, photo: PreparedPhoto, accessToken: string) {
      validatePhotoMetadata(photo);
      // Raw JPEG bytes avoid multipart/file handling differences in mobile Safari.
      const bytes = await photo.blob.arrayBuffer();
      const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false, headers: { Authorization: `Bearer ${accessToken}` } });
      // A lost upload acknowledgement is safe to retry: reserved objects are immutable.
      if (error && !('statusCode' in error && String(error.statusCode) === '409') && !/already exists|Duplicate/i.test(error.message)) throw error;
    },
    async sendPhoto(chatId: string, body: string, clientId: string, path: string, accessToken: string) {
      const { data, error } = await client.rpc('send_direct_photo', { chat_id: chatId, message_body: validateChatContent(body, true), client_id: clientId, photo_path: path }).setHeader('Authorization', `Bearer ${accessToken}`);
      if (error) throw error; if (!data[0]) throw new Error('Missing acknowledgement'); return data[0];
    },
    async downloadPhoto(path: string, signal: AbortSignal) {
      const { data, error } = await client.storage.from(PHOTO_BUCKET).download(path, {}, { signal, cache: 'no-store' });
      if (error) throw error; return data;
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

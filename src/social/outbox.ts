import { validateChatContent } from './domain';
import { validatePhotoMetadata } from './photos';
import { PendingMessage } from './types';

export type OutboxStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  getAllKeys: () => Promise<readonly string[]>;
};
function parseMessage(raw: string): PendingMessage {
  const item: unknown = JSON.parse(raw);
  if (typeof item !== 'object' || item === null || !('clientId' in item) || typeof item.clientId !== 'string' || !('body' in item) || typeof item.body !== 'string' || !('createdAt' in item) || typeof item.createdAt !== 'string') throw new Error('Invalid outbox');
  let photo: PendingMessage['photo'];
  if ('photo' in item && item.photo !== undefined) {
    const value = item.photo;
    if (typeof value !== 'object' || !value || !('width' in value) || typeof value.width !== 'number' || !('height' in value) || typeof value.height !== 'number' || !('byteSize' in value) || typeof value.byteSize !== 'number' || ('objectPath' in value && typeof value.objectPath !== 'string')) throw new Error('Invalid photo outbox');
    photo = { width: value.width, height: value.height, byteSize: value.byteSize, ...('objectPath' in value ? { objectPath: String(value.objectPath) } : {}) }; validatePhotoMetadata(photo);
  }
  return { clientId: item.clientId, body: validateChatContent(item.body, Boolean(photo)), createdAt: item.createdAt, ...(photo ? { photo } : {}) };
}
export function createOutbox(userId: string, chatId: string, storage: OutboxStorage) {
  // One key per message: simultaneous tabs cannot overwrite each other's pending queue.
  const prefix = `jimappka:outbox:${userId}:${chatId}:`;
  return {
    async read(): Promise<PendingMessage[]> {
      const keys = (await storage.getAllKeys()).filter((key) => key.startsWith(prefix));
      const values = await Promise.all(keys.map((key) => storage.getItem(key)));
      return values.filter((value): value is string => value !== null).map(parseMessage).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.clientId.localeCompare(b.clientId));
    },
    add: (message: PendingMessage) => storage.setItem(`${prefix}${message.clientId}`, JSON.stringify(message)),
    remove: (clientId: string) => storage.removeItem(`${prefix}${clientId}`),
  };
}

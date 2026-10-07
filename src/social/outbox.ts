import { validateMessage } from './domain';
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
  return { clientId: item.clientId, body: validateMessage(item.body), createdAt: item.createdAt };
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

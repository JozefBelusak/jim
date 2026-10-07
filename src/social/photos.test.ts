import { describe, expect, it } from 'vitest';
import { validateChatContent } from './domain';
import { createOutbox } from './outbox';
import { photoDimensions, photoKey, restorePhoto, validatePhotoMetadata } from './photos';

describe('chat photos', () => {
  it('allows a photo with an optional caption but still rejects empty text messages', () => {
    expect(validateChatContent(' ', true)).toBe(''); expect(validateChatContent(' caption ', true)).toBe('caption');
    expect(() => validateChatContent(' ', false)).toThrow(); expect(() => validateChatContent('x'.repeat(2001), true)).toThrow();
  });
  it('resizes portrait/landscape without upscaling', () => {
    expect(photoDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(photoDimensions(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(photoDimensions(200, 100)).toEqual({ width: 200, height: 100 });
    expect(() => photoDimensions(0, 10)).toThrow(); expect(() => photoDimensions(20000, 20000)).toThrow();
  });
  it('rejects invalid metadata and separates photo blobs by account/chat/message', () => {
    for (const byteSize of [0, -1, NaN, 5242881]) expect(() => validatePhotoMetadata({ width: 100, height: 100, byteSize })).toThrow();
    expect(() => validatePhotoMetadata({ width: 3000, height: 100, byteSize: 100 })).toThrow();
    expect(photoKey('alice', 'chat', 'nonce')).not.toBe(photoKey('bob', 'chat', 'nonce'));
    expect(photoKey('alice', 'chat', 'nonce')).not.toBe(photoKey('alice', 'other', 'nonce'));
  });
  it('restores portable IndexedDB bytes and rejects missing or truncated photos', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const photo = restorePhoto({ bytes, width: 10, height: 20, byteSize: 3 });
    expect(photo.blob.type).toBe('image/jpeg');
    expect(new Uint8Array(await photo.blob.arrayBuffer())).toEqual(new Uint8Array(bytes));
    expect(() => restorePhoto({ bytes, width: 10, height: 20, byteSize: 4 })).toThrow();
    expect(() => restorePhoto(undefined)).toThrow();
  });
  it('persists photo-only messages and their server reservation through retries/reload', async () => {
    const data = new Map<string, string>();
    const storage = { getItem: async (key: string) => data.get(key) ?? null, setItem: async (key: string, value: string) => { data.set(key, value); }, removeItem: async (key: string) => { data.delete(key); }, getAllKeys: async () => [...data.keys()] };
    const item = { clientId: 'photo-nonce', body: '', createdAt: '2026-10-07', photo: { width: 100, height: 200, byteSize: 1000, objectPath: 'reserved.jpg' } };
    await createOutbox('alice', 'chat', storage).add(item);
    expect(await createOutbox('alice', 'chat', storage).read()).toEqual([item]);
    expect(await createOutbox('bob', 'chat', storage).read()).toEqual([]);
    data.set([...data.keys()][0], JSON.stringify({ ...item, photo: { ...item.photo, width: 0 } }));
    await expect(createOutbox('alice', 'chat', storage).read()).rejects.toThrow();
  });
});

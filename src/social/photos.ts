import { PhotoMetadata, PreparedPhoto } from './types';

export const PHOTO_BUCKET = 'chat-photos';
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_INPUT_MAX_BYTES = 25 * 1024 * 1024;
export function validatePhotoMetadata(photo: PhotoMetadata): void {
  if (!Number.isInteger(photo.byteSize) || photo.byteSize < 1 || photo.byteSize > PHOTO_MAX_BYTES ||
      !Number.isInteger(photo.width) || photo.width < 1 || photo.width > 2560 ||
      !Number.isInteger(photo.height) || photo.height < 1 || photo.height > 2560) throw new Error('Fotka je príliš veľká alebo poškodená.');
}
export function photoDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width * height > 100_000_000) throw new Error('Fotka je príliš veľká alebo poškodená.');
  const ratio = Math.min(1, PHOTO_MAX_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) throw new Error('Vyber fotku vo formáte JPEG, PNG, WebP alebo HEIC.');
  if (file.size > PHOTO_INPUT_MAX_BYTES) throw new Error('Fotka môže mať pred úpravou najviac 25 MB.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = objectUrl;
    try { await image.decode(); } catch { throw new Error('Fotka sa nedá otvoriť v tomto prehliadači. Skús JPEG alebo PNG.'); }
    const dimensions = photoDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas'); canvas.width = dimensions.width; canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Fotka sa nepodarila pripraviť. Skús znova.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Re-encode pixels: no original EXIF/GPS metadata, one consistent Storage format.
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Fotka sa nepodarila pripraviť.')), 'image/jpeg', 0.8));
    const result = { ...dimensions, byteSize: blob.size, blob }; validatePhotoMetadata(result); return result;
  } finally { URL.revokeObjectURL(objectUrl); }
}
export function selectPhoto(): Promise<File | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';
    input.style.display = 'none'; document.body.appendChild(input);
    const finish = (file: File | null) => { input.remove(); resolve(file); };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    try { input.click(); } catch (error) { input.remove(); reject(error); }
  });
}
export function photoKey(userId: string, chatId: string, clientId: string) { return `${userId}:${chatId}:${clientId}`; }
export function restorePhoto(value: unknown): PreparedPhoto {
  if (typeof value !== 'object' || !value || !('width' in value) || typeof value.width !== 'number' ||
      !('height' in value) || typeof value.height !== 'number' || !('byteSize' in value) || typeof value.byteSize !== 'number') throw new Error('Fotka už nie je uložená v zariadení. Vyber ju znova.');
  const blob = 'bytes' in value && value.bytes instanceof ArrayBuffer ? new Blob([value.bytes], { type: 'image/jpeg' })
    : 'blob' in value && value.blob instanceof Blob ? value.blob : null;
  if (!blob || blob.size !== value.byteSize) throw new Error('Fotka už nie je uložená v zariadení. Vyber ju znova.');
  const photo = { blob, width: value.width, height: value.height, byteSize: value.byteSize }; validatePhotoMetadata(photo); return photo;
}

let database: Promise<IDBDatabase> | null = null;
function openPhotoDatabase(): Promise<IDBDatabase> {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Úložisko fotiek nie je dostupné v tomto prehliadači.')); return; }
    const request = indexedDB.open('jimrat-chat-photos', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('photos'); };
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); database = null; }; resolve(db); };
    request.onerror = () => reject(new Error('Úložisko fotiek sa nepodarilo otvoriť.'));
    request.onblocked = () => reject(new Error('Úložisko fotiek je blokované. Zatvor ostatné okná appky.'));
  }).catch((error: unknown) => { database = null; throw error; });
  return database;
}
async function photoTransaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openPhotoDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction('photos', mode);
    const request = action(transaction.objectStore('photos'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(new Error('Úložisko fotiek je plné alebo nedostupné. Fotka zostáva vo výbere.'));
    transaction.onerror = () => reject(new Error('Úložisko fotiek je plné alebo nedostupné. Fotka zostáva vo výbere.'));
  });
}
export const photoStore = {
  async put(key: string, photo: PreparedPhoto) {
    // ArrayBuffer is portable across Safari/WebKit IndexedDB implementations;
    // some of them reject storing Blob objects despite supporting IndexedDB.
    const bytes = await photo.blob.arrayBuffer();
    const stored = { width: photo.width, height: photo.height, byteSize: photo.byteSize, bytes };
    restorePhoto(stored);
    return photoTransaction('readwrite', (store) => store.put(stored, key));
  },
  async get(key: string): Promise<PreparedPhoto> {
    const value: unknown = await photoTransaction('readonly', (store) => store.get(key));
    return restorePhoto(value);
  },
  remove: (key: string) => photoTransaction('readwrite', (store) => store.delete(key)),
};

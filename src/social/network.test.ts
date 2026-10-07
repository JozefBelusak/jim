import { afterEach, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from './network';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('aborts a stalled request so the UI can offer retry', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', (_input: unknown, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
  }));
  const request = fetchWithTimeout('https://fixture.test');
  const result = expect(request).rejects.toThrow('Aborted');
  await vi.advanceTimersByTimeAsync(15000);
  await result;
});
it('preserves caller cancellation and clears the deadline after success', async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | null | undefined;
  vi.stubGlobal('fetch', async (_input: unknown, options: RequestInit) => { signal = options.signal; return new Response('ok'); });
  const controller = new AbortController(); controller.abort();
  await fetchWithTimeout('https://fixture.test', { signal: controller.signal });
  expect(signal?.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

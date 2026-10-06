import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

type WorkerEvent = {
  request?: { url: string; method: string; mode?: string };
  waitUntil: (promise: Promise<unknown>) => void;
  respondWith: (promise: Promise<unknown>) => void;
};
const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

function prepareBundle() {
  const directory = mkdtempSync(path.join(tmpdir(), 'jimrat-offline-'));
  temporaryDirectories.push(directory);
  mkdirSync(path.join(directory, '_expo/static/js/web'), { recursive: true });
  writeFileSync(path.join(directory, 'index.html'), '<html><script src="/_expo/static/js/web/index-abc.js"></script></html>');
  writeFileSync(path.join(directory, '_expo/static/js/web/index-abc.js'), 'const app = true;');
  writeFileSync(path.join(directory, 'icon-192.png'), 'icon');
  writeFileSync(path.join(directory, 'export.json'), '{"private":"data"}');
  const build = () => {
    const result = spawnSync(process.execPath, [path.resolve('scripts/create-offline-bundle.cjs'), directory], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    return readFileSync(path.join(directory, 'sw.js'), 'utf8');
  };
  return { directory, build };
}

function runWorker(source: string, installFailure = false) {
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const cachedIndex = { ok: true, html: 'installed index' };
  const match = vi.fn(async () => cachedIndex);
  const addAll = vi.fn<(requests: { url: string; options: { cache: string } }[]) => Promise<void>>(async () => { if (installFailure) throw new Error('Asset download failed'); });
  const cache = { match, addAll };
  const deleteCache = vi.fn(async () => true);
  const open = vi.fn(async () => cache);
  const fetch = vi.fn<(request: unknown) => Promise<unknown>>(async () => { throw new Error('Offline'); });
  runInNewContext(source, {
    self: { location: { origin: 'https://jimrat.example' }, addEventListener: (type: string, handler: (event: WorkerEvent) => void) => handlers.set(type, handler) },
    caches: { open, delete: deleteCache, keys: async () => ['jimrat-static-old', 'other-app-cache'] },
    fetch,
    URL,
    Request: class Request { constructor(readonly url: string, readonly options: object) {} },
    Response,
  });
  return { handlers, match, addAll, deleteCache, open, fetch, cachedIndex };
}

function eventWithRequest(request?: WorkerEvent['request']) {
  let result: Promise<unknown> | undefined;
  const event: WorkerEvent = { request, waitUntil: (promise) => { result = promise; }, respondWith: (promise) => { result = promise; } };
  return { event, result: () => result };
}

describe('offline export bundle', () => {
  it('hashes exported content and precaches only application assets', () => {
    const { directory, build } = prepareBundle();
    const first = build();
    expect(first).toContain('/_expo/static/js/web/index-abc.js');
    expect(first).toContain('/icon-192.png');
    expect(first).not.toContain('/export.json');
    expect(first).not.toContain('skipWaiting(');
    expect(first).not.toContain('clients.claim(');
    expect(build()).toBe(first);
    writeFileSync(path.join(directory, 'index.html'), '<html>updated app</html>');
    expect(build()).not.toBe(first);
  });

  it('removes a failed installation and cleans only obsolete app caches', async () => {
    const source = prepareBundle().build();
    const failed = runWorker(source, true);
    const installEvent = eventWithRequest();
    failed.handlers.get('install')?.(installEvent.event);
    await expect(installEvent.result()).rejects.toThrow('Asset download failed');
    expect(failed.deleteCache).toHaveBeenCalledWith(expect.stringMatching(/^jimrat-static-/));

    const successful = runWorker(source);
    const completeInstall = eventWithRequest();
    successful.handlers.get('install')?.(completeInstall.event);
    await completeInstall.result();
    expect(successful.addAll.mock.calls[0][0]).toHaveLength(3);
    expect(successful.addAll.mock.calls[0][0].every((request) => request.options.cache === 'reload')).toBe(true);
    expect(successful.deleteCache).not.toHaveBeenCalled();
    const activateEvent = eventWithRequest();
    successful.handlers.get('activate')?.(activateEvent.event);
    await activateEvent.result();
    expect(successful.deleteCache).toHaveBeenCalledExactlyOnceWith('jimrat-static-old');
  });

  it('uses a successful network navigation without overwriting the installed snapshot', async () => {
    const worker = runWorker(prepareBundle().build());
    const networkPage = { ok: true, html: 'new network version' };
    worker.fetch.mockResolvedValue(networkPage);
    const navigation = eventWithRequest({ url: 'https://jimrat.example/', method: 'GET', mode: 'navigate' });
    worker.handlers.get('fetch')?.(navigation.event);
    expect(await navigation.result()).toBe(networkPage);
    expect(worker.open).not.toHaveBeenCalled();
    expect(worker.match).not.toHaveBeenCalled();
  });

  it('falls back to the matching installed index offline and leaves API/export/external requests alone', async () => {
    const worker = runWorker(prepareBundle().build());
    const navigation = eventWithRequest({ url: 'https://jimrat.example/', method: 'GET', mode: 'navigate' });
    worker.handlers.get('fetch')?.(navigation.event);
    expect(await navigation.result()).toBe(worker.cachedIndex);
    expect(worker.match).toHaveBeenCalledWith('/index.html');
    for (const request of [
      { url: 'https://jimrat.example/api/workouts', method: 'GET' },
      { url: 'https://jimrat.example/export.json', method: 'GET' },
      { url: 'https://media.example/icon-192.png', method: 'GET' },
      { url: 'https://jimrat.example/icon-192.png?user=private', method: 'GET' },
      { url: 'https://jimrat.example/icon-192.png', method: 'POST' },
    ]) {
      const unchecked = eventWithRequest(request);
      worker.handlers.get('fetch')?.(unchecked.event);
      expect(unchecked.result()).toBeUndefined();
    }
    const staticAsset = eventWithRequest({ url: 'https://jimrat.example/icon-192.png', method: 'GET' });
    worker.handlers.get('fetch')?.(staticAsset.event);
    expect(await staticAsset.result()).toBe(worker.cachedIndex);
  });
});

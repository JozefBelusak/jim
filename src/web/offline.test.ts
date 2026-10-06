import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('__DEV__', false);
  vi.stubGlobal('document', { readyState: 'complete' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('production offline registration', () => {
  it('registers once and allows browser lifecycle updates without forcing a reload', async () => {
    const register = vi.fn(async () => ({}));
    const reload = vi.fn();
    vi.stubGlobal('navigator', { serviceWorker: { register } });
    vi.stubGlobal('window', { isSecureContext: true, location: { reload } });
    const { registerOfflineSupport } = await import('./offline');
    registerOfflineSupport();
    registerOfflineSupport();
    expect(register).toHaveBeenCalledExactlyOnceWith('/sw.js', { scope: '/', updateViaCache: 'none' });
    expect(reload).not.toHaveBeenCalled();
  });

  it('waits for page load to avoid competing with the initial app startup', async () => {
    const register = vi.fn(async () => ({}));
    const addEventListener = vi.fn<(type: string, listener: () => void, options: { once: boolean }) => void>();
    vi.stubGlobal('document', { readyState: 'loading' });
    vi.stubGlobal('navigator', { serviceWorker: { register } });
    vi.stubGlobal('window', { isSecureContext: true, addEventListener });
    const { registerOfflineSupport } = await import('./offline');
    registerOfflineSupport();
    expect(register).not.toHaveBeenCalled();
    expect(addEventListener).toHaveBeenCalledWith('load', expect.any(Function), { once: true });
    addEventListener.mock.calls[0][1]();
    expect(register).toHaveBeenCalledOnce();
  });

  it('skips development, unsupported browsers and insecure origins', async () => {
    const register = vi.fn(async () => ({}));
    vi.stubGlobal('navigator', { serviceWorker: { register } });
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('__DEV__', true);
    const { registerOfflineSupport } = await import('./offline');
    registerOfflineSupport();
    vi.stubGlobal('__DEV__', false);
    vi.stubGlobal('window', { isSecureContext: false });
    registerOfflineSupport();
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('navigator', {});
    registerOfflineSupport();
    expect(register).not.toHaveBeenCalled();
  });

  it('permits another registration attempt after a reported failure', async () => {
    const register = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue({});
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('navigator', { serviceWorker: { register } });
    vi.stubGlobal('window', { isSecureContext: true });
    const { registerOfflineSupport } = await import('./offline');
    registerOfflineSupport();
    await Promise.resolve();
    await Promise.resolve();
    registerOfflineSupport();
    expect(register).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledWith('Offline preparation could not finish.', 'Unavailable');
  });
});

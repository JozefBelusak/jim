let registrationRequested = false;

/** Register only in production. Worker updates wait for existing app tabs to close. */
export function registerOfflineSupport(): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) return;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
  if (registrationRequested) return;
  registrationRequested = true;

  const register = () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((error: unknown) => {
      registrationRequested = false;
      console.warn('Offline preparation could not finish.', error instanceof Error ? error.message : error);
    });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}

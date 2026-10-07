export type AuthCallbackError = 'expired' | 'failed';

const errorKeys = ['error', 'error_code', 'error_description'];

// Fast SDK initialization can emit PASSWORD_RECOVERY before React subscribes.
// Match only the session returned by the SDK, never trust a URL flag alone.
export function recoverySessionMatcher(href: string) {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const invalid = [fragment, url.searchParams].some((params) => errorKeys.some((key) => params.has(key)));
  let token = !invalid && fragment.get('type') === 'recovery' && fragment.get('refresh_token') ? fragment.get('access_token') : null;
  return (accessToken?: string): boolean => {
    if (!token || accessToken !== token) return false;
    token = null; return true;
  };
}

// Capture errors before the auth SDK initializes. Never show URL-supplied text.
export function readAuthCallback(href: string): { error: AuthCallbackError | null; cleanUrl: string } {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const sources = [fragment, url.searchParams];
  const hasError = sources.some((params) => errorKeys.some((key) => params.has(key)));
  if (!hasError) return { error: null, cleanUrl: href };
  const expired = sources.some((params) => params.get('error_code') === 'otp_expired');
  for (const params of sources) {
    for (const key of errorKeys) params.delete(key);
    if (params.get('sb') === '') params.delete('sb');
  }
  url.hash = fragment.toString();
  return { error: expired ? 'expired' : 'failed', cleanUrl: url.href };
}

export function authCallbackMessage(error: AuthCallbackError): string {
  return error === 'expired'
    ? 'E-mailový odkaz vypršal alebo už bol použitý. Ak sa vieš prihlásiť, môžeš pokračovať s existujúcim účtom.'
    : 'E-mailový odkaz sa nepodarilo overiť. Skús sa prihlásiť alebo si vyžiadaj nový odkaz.';
}

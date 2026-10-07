import { describe, expect, it } from 'vitest';
import { authCallbackMessage, readAuthCallback } from './authCallback';
import { socialError } from './domain';

describe('auth callback errors', () => {
  it('recognizes an expired link and removes the error fragment from the URL', () => {
    expect(readAuthCallback('https://gymratturbo.netlify.app/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=')).toEqual({
      error: 'expired', cleanUrl: 'https://gymratturbo.netlify.app/',
    });
  });
  it('preserves profile links, unrelated fragments and history location', () => {
    expect(readAuthCallback('https://app.test/workout?profile=alice&error=access_denied#error_code=otp_expired&section=history')).toEqual({
      error: 'expired', cleanUrl: 'https://app.test/workout?profile=alice#section=history',
    });
  });
  it('does not consume successful confirmation or recovery tokens', () => {
    const href = 'https://app.test/?account=1#access_token=test&refresh_token=refresh&type=recovery';
    expect(readAuthCallback(href)).toEqual({ error: null, cleanUrl: href });
  });
  it('never displays untrusted error descriptions', () => {
    const callback = readAuthCallback('https://app.test/#error_description=%3Cscript%3Esecret%3C%2Fscript%3E');
    expect(callback.error).toBe('failed');
    expect(authCallbackMessage(callback.error!)).not.toMatch(/secret|script/);
    expect(callback.cleanUrl).toBe('https://app.test/');
  });
  it('keeps unrelated links byte-for-byte unchanged', () => {
    const href = 'https://app.test/?profile=alice#exercise-details';
    expect(readAuthCallback(href)).toEqual({ error: null, cleanUrl: href });
  });
  it('explains email rate limits returned as codes', () => {
    expect(socialError({ code: 'over_email_send_rate_limit', message: 'Email delivery delayed' })).toContain('Počkaj');
  });
});

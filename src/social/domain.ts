import { ChatMessage, ProfileInput } from './types';

export function validateProfile(input: ProfileInput): ProfileInput {
  const result = { username: input.username.trim().toLowerCase(), display_name: input.display_name.trim(), bio: input.bio.trim() };
  if (!/^[a-z0-9_]{3,24}$/.test(result.username)) throw new Error('Používateľské meno: 3–24 malých písmen bez diakritiky, číslic alebo _.');
  if (!result.display_name || result.display_name.length > 60) throw new Error('Meno musí mať 1–60 znakov.');
  if (result.bio.length > 280) throw new Error('Bio môže mať najviac 280 znakov.');
  return result;
}
export function validateMessage(body: string): string {
  const value = body.trim();
  if (!value || value.length > 2000) throw new Error('Správa musí mať 1–2000 znakov.');
  return value;
}
export function searchTerm(value: string) {
  return value.replace(/[^\p{L}\p{N}_\s]/gu, '').trim().slice(0, 60);
}
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
export function socialError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === '23505') return 'Toto používateľské meno je už obsadené.';
  if (/profile_required/.test(message)) return 'Najprv si vytvor profil.';
  if (/chat_unavailable/.test(message)) return 'S týmto profilom teraz nie je možné chatovať. Môže byť zablokovaný alebo už neexistuje.';
  if (/rate_limit|rate limit/i.test(message)) return 'Odosielaš príliš rýchlo. Počkaj chvíľu a skús znova.';
  if (/Invalid login credentials/i.test(message)) return 'Nesprávny e-mail alebo heslo.';
  if (/Email not confirmed/i.test(message)) return 'Najprv potvrď e-mail cez odkaz v správe.';
  if (/User already registered/i.test(message)) return 'Tento účet už existuje. Prihlás sa.';
  if (/Password should|weak password/i.test(message)) return 'Použi silnejšie heslo, aspoň 8 znakov.';
  if (/^(Používateľské meno:|Meno musí|Bio môže|Správa musí)/.test(message)) return message;
  return 'Nepodarilo sa spojiť so službou. Skontroluj pripojenie a skús znova.';
}
export function createMessageId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
export function profileUrl(username: string): string {
  return typeof window === 'undefined' ? `?profile=${encodeURIComponent(username)}` : `${window.location.origin}${window.location.pathname}?profile=${encodeURIComponent(username)}`;
}
export function linkedUsername(): string | null {
  if (typeof window === 'undefined') return null;
  const username = new URLSearchParams(window.location.search).get('profile');
  return username && /^[a-z0-9_]{3,24}$/.test(username) ? username : null;
}

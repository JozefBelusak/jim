import { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { consumeAuthCallbackError, initialAuthCallbackError, socialClient } from './client';
import { socialError } from './domain';
import { socialRepository } from './repository';
import { PublicProfile } from './types';

export function useSocialAccount() {
  const client = socialClient;
  const repository = useMemo(() => client ? socialRepository(client) : null, [client]);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, updateProfile] = useState<PublicProfile | null>(null);
  const currentUser = useRef(session?.user.id); currentUser.current = session?.user.id;
  const setProfile = useCallback((next: PublicProfile | null) => { if (!next || next.id === currentUser.current) updateProfile(next); }, []);
  const [loading, setLoading] = useState(Boolean(client));
  const [error, setError] = useState('');
  const [callbackError, setCallbackError] = useState(initialAuthCallbackError);
  const [recovery, setRecovery] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onLink = () => {
      const next = consumeAuthCallbackError();
      if (next) setCallbackError(next);
    };
    window.addEventListener('hashchange', onLink);
    return () => window.removeEventListener('hashchange', onLink);
  }, []);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    // No awaited database calls inside the auth callback: the SDK holds its auth lock here.
    const { data: subscription } = client.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      setSession(next); setError('');
      if (event === 'SIGNED_IN') setCallbackError(null);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') { setProfile(null); setRecovery(false); }
    });
    client.auth.getSession().then(({ data, error: authError }) => {
      if (!alive) return;
      if (authError) { setError(socialError(authError)); setLoading(false); }
      else { setSession(data.session); if (!data.session) setLoading(false); }
    });
    return () => { alive = false; subscription.subscription.unsubscribe(); };
  }, [client, revision, setProfile]);
  const userId = session?.user.id;
  useEffect(() => {
    if (!repository || !userId) { setProfile(null); setLoading(false); return; }
    let alive = true;
    setLoading(true); setError(''); setProfile(null);
    repository.profile(userId).then((next) => { if (alive) setProfile(next); }).catch((reason: unknown) => { if (alive) setError(socialError(reason)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, repository, revision, setProfile]);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  return { client, repository, session, profile: profile?.id === session?.user.id ? profile : null, setProfile, loading, error, callbackError, dismissCallbackError: () => setCallbackError(null), recovery, finishRecovery: () => setRecovery(false), retry };
}
export type SocialAccount = ReturnType<typeof useSocialAccount>;

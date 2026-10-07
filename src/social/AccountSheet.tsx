import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { authRedirectUrl } from './client';
import { socialError } from './domain';
import { SocialAccount } from './useSocialAccount';
import { SocialButton, SocialFeedback, SocialField, socialStyles } from './ui';

type Mode = 'login' | 'signup' | 'reset' | 'recovery';
export function AccountSheet({ account, visible, onClose }: { account: SocialAccount; visible: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { if (account.recovery) setMode('recovery'); }, [account.recovery]);
  useEffect(() => { if (!visible) { setPassword(''); setError(''); setNotice(''); } }, [visible]);
  useEffect(() => { if (account.session && !account.recovery && (mode === 'login' || mode === 'signup')) onClose(); }, [account.session, account.recovery, mode, onClose]);
  const switchMode = (next: Mode) => { setMode(next); setError(''); setNotice(''); setPassword(''); };
  const submit = async () => {
    if (!account.client || busy) return;
    setError(''); setNotice('');
    if (mode !== 'recovery' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Zadaj platný e-mail.'); return; }
    if ((mode === 'signup' || mode === 'recovery') && password.length < 8) { setError('Heslo musí mať aspoň 8 znakov.'); return; }
    setBusy(true);
    try {
      const auth = account.client.auth;
      if (mode === 'signup') {
        const { data, error } = await auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authRedirectUrl() } });
        if (error) throw error;
        if (!data.session) setNotice('Skontroluj e-mail a potvrď účet cez odkaz. Potom sa prihlás. Ak účet už máš, použi prihlásenie.');
      } else if (mode === 'login') {
        const { error } = await auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error;
      } else if (mode === 'reset') {
        const { error } = await auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl() }); if (error) throw error;
        setNotice('Ak účet existuje, príde ti odkaz na nastavenie nového hesla.');
      } else {
        const { error } = await auth.updateUser({ password }); if (error) throw error;
        account.finishRecovery(); setNotice('Nové heslo je uložené.'); setPassword(''); onClose();
      }
    } catch (reason) { setError(socialError(reason)); } finally { setBusy(false); }
  };
  const title = mode === 'signup' ? 'Vytvoriť účet' : mode === 'login' ? 'Prihlásiť sa' : 'Obnoviť heslo';
  return <BottomSheet visible={visible} title={title} subtitle="Účet slúži pre verejný profil a súkromné správy." onClose={() => { if (!busy) onClose(); }}>
    <View style={socialStyles.gap}>
      {mode !== 'recovery' ? <SocialField label="E-mail" value={email} onChange={setEmail} email /> : null}
      {mode !== 'reset' ? <SocialField label={mode === 'recovery' ? 'Nové heslo' : 'Heslo'} value={password} onChange={setPassword} password /> : null}
      {error ? <SocialFeedback error>{error}</SocialFeedback> : null}
      {notice ? <SocialFeedback>{notice}</SocialFeedback> : null}
      <SocialButton primary label={mode === 'reset' ? 'Poslať odkaz' : mode === 'recovery' ? 'Uložiť heslo' : title} onPress={() => void submit()} busy={busy} />
      {mode !== 'recovery' ? <><SocialButton label={mode === 'login' ? 'Nemám účet — vytvoriť' : 'Už mám účet — prihlásiť'} onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')} disabled={busy} />{mode === 'login' ? <SocialButton label="Zabudnuté heslo" onPress={() => switchMode('reset')} disabled={busy} /> : null}</> : null}
      <SocialFeedback>Tvoj e-mail ani tréningy sa nezobrazia vo verejnom profile.</SocialFeedback>
    </View>
  </BottomSheet>;
}

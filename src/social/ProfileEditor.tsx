import { useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { socialError } from './domain';
import { SocialAccount } from './useSocialAccount';
import { SocialButton, SocialFeedback, SocialField } from './ui';

export function ProfileEditor({ account, onClose }: { account: SocialAccount; onClose: () => void }) {
  const [username, setUsername] = useState(account.profile?.username ?? '');
  const [name, setName] = useState(account.profile?.display_name ?? '');
  const [bio, setBio] = useState(account.profile?.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (!account.repository || !account.session || busy) return;
    setBusy(true); setError('');
    try {
      const profile = await account.repository.saveProfile(account.session.user.id, { username, display_name: name, bio }, Boolean(account.profile));
      account.setProfile(profile); onClose();
    } catch (reason) { setError(socialError(reason)); } finally { setBusy(false); }
  }
  return <BottomSheet visible title={account.profile ? 'Upraviť profil' : 'Vytvoriť verejný profil'} subtitle="Podľa @mena ťa nájdu kamoši. Meno a bio budú verejné." onClose={() => { if (!busy) onClose(); }}>
    <SocialField label="Používateľské meno" value={username} onChange={setUsername} maxLength={24} />
    <SocialFeedback>3–24 písmen bez diakritiky, číslic alebo _. Napríklad jozef_gym.</SocialFeedback>
    <SocialField label="Meno na profile" value={name} onChange={setName} maxLength={60} />
    <SocialField label="Bio (voliteľné)" value={bio} onChange={setBio} multiline maxLength={280} />
    {error ? <SocialFeedback error>{error}</SocialFeedback> : null}
    <SocialButton primary label="Uložiť profil" onPress={() => void save()} busy={busy} />
  </BottomSheet>;
}

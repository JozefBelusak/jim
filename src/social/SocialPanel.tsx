import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { colors, styles } from '../theme/styles';
import { AccountSheet } from './AccountSheet';
import { ChatSheet } from './ChatSheet';
import { linkedUsername, profileUrl, socialError } from './domain';
import { ProfileEditor } from './ProfileEditor';
import { ChatSummary, OpenChat, PublicProfile } from './types';
import { SocialAccount } from './useSocialAccount';
import { SocialButton, SocialFeedback, SocialField, socialStyles } from './ui';

type Sheet = 'auth' | 'editor' | 'people' | 'public' | 'chat' | null;
export function SocialPanel({ account }: { account: SocialAccount }) {
  const { repository, session, profile } = account;
  const userId = session?.user.id;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState<PublicProfile | null>(null);
  const [chat, setChat] = useState<OpenChat | null>(null);
  const [publicError, setPublicError] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [shared, setShared] = useState('');
  const [pendingPeer, setPendingPeer] = useState<PublicProfile | null>(null);
  const alive = useRef(true);
  const ownId = useRef(userId); ownId.current = userId;
  const refreshChats = useCallback(async () => {
    if (!repository || !userId || !profile) return;
    try { const next = await repository.chats(); if (alive.current && ownId.current === userId) { setChats(next); setChatError(''); } }
    catch (reason) { if (alive.current && ownId.current === userId) setChatError(socialError(reason)); }
    finally { if (alive.current) setChatsLoading(false); }
  }, [repository, userId, profile]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    setChats([]); setChat(null); setChatError('');
    if (!userId) { setSheet((current) => current === 'chat' || current === 'editor' ? null : current); return; }
    setChatsLoading(true); void refreshChats();
    const timer = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') void refreshChats(); }, 15000);
    const focus = () => void refreshChats();
    if (typeof window !== 'undefined') window.addEventListener('focus', focus);
    return () => { clearInterval(timer); if (typeof window !== 'undefined') window.removeEventListener('focus', focus); };
  }, [userId, refreshChats]);
  useEffect(() => { if (account.recovery) setSheet('auth'); }, [account.recovery]);
  useEffect(() => {
    if (!repository || sheet !== 'people') return;
    let current = true;
    setPeople([]); setSearchError('');
    if (query.trim().length < 2) { setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      repository.search(query).then((results) => { if (current) setPeople(results); }).catch((reason: unknown) => { if (current) setSearchError(socialError(reason)); }).finally(() => { if (current) setSearching(false); });
    }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [query, repository, sheet]);
  useEffect(() => {
    const username = linkedUsername(); if (!username || !repository) return;
    let current = true;
    repository.byUsername(username).then((found) => {
      if (!current) return;
      setSelected(found); setPublicError(found ? '' : 'Tento profil sa nenašiel.'); setSheet('public');
    }).catch((reason: unknown) => { if (current) { setPublicError(socialError(reason)); setSheet('public'); } });
    return () => { current = false; };
  }, [repository]);
  useEffect(() => {
    setBlocked(false); setShared(''); setPublicError('');
    if (!selected || !repository || !userId || userId === selected.id) { setBlockLoading(false); return; }
    let current = true; setBlockLoading(true);
    repository.isBlocked(userId, selected.id).then((value) => { if (current) setBlocked(value); }).catch((reason: unknown) => { if (current) setPublicError(socialError(reason)); }).finally(() => { if (current) setBlockLoading(false); });
    return () => { current = false; };
  }, [selected, userId, repository]);
  const openProfile = (person: PublicProfile) => { setSelected(person); setPublicError(''); setSheet('public'); };
  async function startChat(person: PublicProfile) {
    if (!repository) return;
    if (!session || !profile) { setPendingPeer(person); setSheet(session ? 'editor' : 'auth'); return; }
    if (busy) return;
    const initiatingUser = session.user.id;
    setBusy(true); setPublicError('');
    try {
      const id = await repository.startChat(person.id, session.access_token);
      if (!alive.current || ownId.current !== initiatingUser) return;
      setChat({ id, peer: person }); setSheet('chat'); setPendingPeer(null); void refreshChats();
    } catch (reason) { if (alive.current) setPublicError(socialError(reason)); } finally { if (alive.current) setBusy(false); }
  }
  const closeAuth = useCallback(() => { setSheet(pendingPeer ? 'public' : null); }, [pendingPeer]);
  async function logout() {
    if (!account.client || busy) return;
    setBusy(true); setChatError('');
    try {
      // Local sign-out works even with an expired session; other devices keep their session.
      const { error } = await account.client.auth.signOut({ scope: 'local' }); if (error) throw error;
      setChat(null); setChats([]); setSheet(null); setPendingPeer(null);
    } catch (reason) { setChatError(socialError(reason)); } finally { setBusy(false); }
  }
  async function toggleBlock() {
    if (!repository || !selected || !userId || busy) return;
    setBusy(true); setPublicError('');
    try { await repository.block(userId, selected.id, !blocked); setBlocked(!blocked); }
    catch (reason) { setPublicError(socialError(reason)); } finally { setBusy(false); }
  }
  async function share(person: PublicProfile) {
    const link = profileUrl(person.username); setShared(link);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try { await navigator.clipboard.writeText(link); setShared(`Odkaz skopírovaný: ${link}`); } catch { /* Selectable link remains available. */ }
    }
  }
  if (!account.client) return <View style={[styles.card, socialStyles.gap]}><Text style={styles.cardTitle}>Profil a správy</Text><SocialFeedback>Komunita zatiaľ nie je dostupná. Tréningový denník môžeš používať ďalej.</SocialFeedback></View>;
  return <View style={socialStyles.gap}>
    <View style={[styles.card, socialStyles.gap]}>
      {account.loading ? <ActivityIndicator color={colors.accent} accessibilityLabel="Načítavam účet" /> : account.error ? <><SocialFeedback error>{account.error}</SocialFeedback><SocialButton label="Zopakovať načítanie účtu" onPress={account.retry} /></> : profile ? <>
        <ProfileHeading person={profile} />
        {profile.bio ? <Text style={socialStyles.note}>{profile.bio}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><SocialButton label="Upraviť profil" onPress={() => setSheet('editor')} /></View><View style={{ flex: 1 }}><SocialButton label="Zdieľať profil" onPress={() => void share(profile)} /></View></View>
        {shared ? <Text selectable style={socialStyles.note}>{shared}</Text> : null}
      </> : session ? <><Text style={styles.cardTitle}>Dokonči svoj profil</Text><SocialFeedback>Vyber si @meno, aby ťa kamoši vedeli nájsť a napísať ti.</SocialFeedback><SocialButton primary label="Vytvoriť profil" onPress={() => setSheet('editor')} /></> : <>
        <Text style={styles.cardTitle}>Spoj sa s kamošmi</Text><SocialFeedback>Vytvor si verejný profil a píšte si súkromne priamo tu.</SocialFeedback><SocialButton primary label="Vytvoriť účet / prihlásiť sa" onPress={() => setSheet('auth')} />
      </>}
      <SocialButton label="Nájsť ľudí" onPress={() => setSheet('people')} />
    </View>
    {profile ? <View style={[styles.card, socialStyles.gap]}>
      <Text style={styles.cardTitle}>Správy{chats.some((item) => item.unread_count) ? ` · ${chats.reduce((sum, item) => sum + Number(item.unread_count), 0)} nových` : ''}</Text>
      {chatsLoading ? <SocialFeedback>Načítavam konverzácie…</SocialFeedback> : !chats.length && !chatError ? <SocialFeedback>Zatiaľ nemáš správy. Cez „Nájsť ľudí“ otvor profil a napíš mu.</SocialFeedback> : null}
      {chatError ? <><SocialFeedback error>{chatError}</SocialFeedback><SocialButton label="Obnoviť konverzácie" onPress={() => void refreshChats()} /></> : null}
      {chats.map((item) => <Pressable key={item.id} style={socialStyles.listRow} accessibilityRole="button" accessibilityLabel={`Chat s ${item.display_name}${item.unread_count ? `, ${item.unread_count} nových správ` : ''}`} onPress={() => { setChat({ id: item.id, peer: { id: item.peer_id, username: item.username, display_name: item.display_name, bio: item.bio } }); setSheet('chat'); }}>
        <View style={styles.rowBetween}><Text style={[socialStyles.label, { flex: 1 }]}>{item.display_name}</Text>{item.unread_count ? <Text style={socialStyles.badge}>{item.unread_count}</Text> : null}</View>
        <Text style={styles.rowMuted}>@{item.username}{item.last_message_at ? ` · ${new Date(item.last_message_at).toLocaleDateString('sk-SK')}` : ''}</Text>
        <Text style={socialStyles.note} numberOfLines={1}>{item.last_body ?? 'Začni konverzáciu'}</Text>
      </Pressable>)}
    </View> : null}
    {session ? <View style={[styles.card, socialStyles.gap]}><Text style={styles.rowMuted}>{session.user.email}</Text><SocialButton label="Odhlásiť sa" onPress={() => void logout()} busy={busy} /><SocialFeedback>Tréningový denník je uložený v tomto zariadení. Účet ho zatiaľ nesynchronizuje.</SocialFeedback></View> : null}
    <AccountSheet account={account} visible={sheet === 'auth'} onClose={closeAuth} />
    {sheet === 'editor' && session ? <ProfileEditor account={account} onClose={() => setSheet(pendingPeer ? 'public' : null)} /> : null}
    <BottomSheet visible={sheet === 'people'} title="Nájsť ľudí" subtitle="Vyhľadaj @meno alebo meno na profile." onClose={() => setSheet(null)}>
      <SocialField label="Vyhľadať profil" value={query} onChange={setQuery} maxLength={60} />
      {searchError ? <SocialFeedback error>{searchError}</SocialFeedback> : searching ? <SocialFeedback>Hľadám…</SocialFeedback> : query.trim().length < 2 ? <SocialFeedback>Napíš aspoň 2 znaky. Kamoška ti môže poslať aj priamy odkaz na profil.</SocialFeedback> : !people.length ? <SocialFeedback>Nenašiel sa žiadny profil.</SocialFeedback> : null}
      {people.map((person) => <Pressable key={person.id} style={socialStyles.listRow} accessibilityRole="button" accessibilityLabel={`Profil ${person.display_name}`} onPress={() => openProfile(person)}><ProfileHeading person={person} /></Pressable>)}
    </BottomSheet>
    <BottomSheet visible={sheet === 'public'} title="Verejný profil" onClose={() => { setSheet(null); setPendingPeer(null); }}>
      {selected ? <><ProfileHeading person={selected} />{selected.bio ? <Text style={socialStyles.note}>{selected.bio}</Text> : null}
        {selected.id !== userId ? <SocialButton primary label={blocked ? 'Profil je zablokovaný' : !session ? 'Prihlásiť sa a napísať' : !profile ? 'Vytvoriť profil a napísať' : 'Napísať správu'} onPress={() => void startChat(selected)} busy={busy} disabled={blocked || blockLoading} /> : <SocialButton label="Upraviť svoj profil" onPress={() => setSheet('editor')} />}
        <SocialButton label="Zdieľať odkaz na profil" onPress={() => void share(selected)} />
        {shared ? <Text selectable style={socialStyles.note}>{shared}</Text> : null}
        {session && profile && selected.id !== userId ? <SocialButton label={blocked ? 'Odblokovať profil' : 'Zablokovať profil'} onPress={() => void toggleBlock()} busy={busy || blockLoading} /> : null}
        {blocked ? <SocialFeedback>Blokovanie zastaví nové správy v oboch smeroch. Existujúca história zostáva zachovaná.</SocialFeedback> : null}
      </> : null}
      {publicError ? <SocialFeedback error>{publicError}</SocialFeedback> : null}
      <SocialButton label="Späť na vyhľadávanie" onPress={() => setSheet('people')} />
    </BottomSheet>
    {sheet === 'chat' && chat && profile && session ? <ChatSheet key={`${userId}:${chat.id}`} account={account} chat={chat} onClose={() => { setSheet(null); void refreshChats(); }} onUpdated={() => void refreshChats()} onProfile={() => {
      setSelected({ ...chat.peer, created_at: '' }); setSheet('public');
    }} /> : null}
  </View>;
}
function ProfileHeading({ person }: { person: Pick<PublicProfile, 'display_name' | 'username'> }) {
  return <View style={socialStyles.row}><View style={socialStyles.avatar}><Text style={socialStyles.initials}>{person.display_name.trim().slice(0, 2).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={socialStyles.name}>{person.display_name}</Text><Text style={socialStyles.handle}>@{person.username}</Text></View></View>;
}

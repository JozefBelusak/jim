import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { colors, styles } from '../theme/styles';
import { createMessageId, mergeMessages, socialError, validateChatContent } from './domain';
import { ChatPhoto, PhotoViewer } from './ChatPhoto';
import { photoKey, photoStore, preparePhoto, selectPhoto } from './photos';
import { createOutbox } from './outbox';
import { ChatMessage, OpenChat, PendingMessage, PreparedPhoto } from './types';
import { SocialAccount } from './useSocialAccount';
import { SocialButton, SocialFeedback } from './ui';

type Delivery = 'sending' | 'failed';
export function ChatSheet({ account, chat, onClose, onUpdated, onProfile }: { account: SocialAccount; chat: OpenChat; onClose: () => void; onUpdated: () => void; onProfile: () => void }) {
  const userId = account.session!.user.id;
  const repository = account.repository!;
  const client = account.client!;
  const outbox = useMemo(() => createOutbox(userId, chat.id, AsyncStorage), [userId, chat.id]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messageRef = useRef(messages);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [delivery, setDelivery] = useState<Record<string, Delivery>>({});
  const [draft, setDraft] = useState('');
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [enqueueing, setEnqueueing] = useState(false);
  const enqueueingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [olderBusy, setOlderBusy] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const failedMessage = useRef<string | null>(null);
  const [connection, setConnection] = useState('Pripájam živé správy…');
  const [outboxReady, setOutboxReady] = useState(false);
  const alive = useRef(true);
  const scroll = useRef<ScrollView>(null);
  const atBottom = useRef(true);
  const scrollOffset = useRef(0);
  const scrollHeight = useRef(0);
  const prependHeight = useRef<number | null>(null);
  const sending = useRef(new Set<string>());
  const syncing = useRef(false);
  const updated = useRef(onUpdated);
  updated.current = onUpdated;
  const markRead = useCallback((message?: ChatMessage) => {
    if (!message || !atBottom.current || (typeof document !== 'undefined' && document.visibilityState !== 'visible')) return;
    void repository.read(chat.id, message.id).then(() => { if (alive.current) updated.current(); }).catch(() => undefined);
  }, [repository, chat.id]);
  const receive = useCallback((incoming: ChatMessage[]) => {
    const merged = mergeMessages(messageRef.current, incoming);
    messageRef.current = merged; setMessages(merged);
    if (incoming.some((message) => message.sender_id === userId && message.client_id === failedMessage.current)) {
      failedMessage.current = null; setError('');
    }
    setPending((current) => current.filter((item) => !incoming.some((message) => message.sender_id === userId && message.client_id === item.clientId)));
    for (const message of incoming) if (message.sender_id === userId) {
      void outbox.remove(message.client_id).catch(() => undefined);
      if (message.photo_path) void photoStore.remove(photoKey(userId, chat.id, message.client_id)).catch(() => undefined);
    }
    markRead(merged[merged.length - 1]);
  }, [userId, chat.id, outbox, markRead]);
  const refresh = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      let page = await repository.messages(chat.id);
      const oldLatest = messageRef.current[messageRef.current.length - 1];
      const incoming = [...page];
      if (!oldLatest) { if (alive.current) setHasOlder(page.length === 50); }
      // Repair missed realtime events after reconnect, even after more than a page of messages.
      while (oldLatest && page.length === 50 && page[page.length - 1].created_at >= oldLatest.created_at) {
        page = await repository.messages(chat.id, page[page.length - 1]); incoming.push(...page);
      }
      if (alive.current) { receive(incoming); setLoadError(''); }
    } catch (reason) { if (alive.current) setLoadError(socialError(reason)); }
    finally { syncing.current = false; if (alive.current) setLoading(false); }
  }, [repository, chat.id, receive]);
  useEffect(() => {
    alive.current = true;
    outbox.read().then((saved) => { if (alive.current) {
      const remaining = saved.filter((item) => !messageRef.current.some((message) => message.sender_id === userId && message.client_id === item.clientId));
      setPending(remaining); setDelivery(Object.fromEntries(remaining.map((item) => [item.clientId, 'failed']))); setOutboxReady(true);
    } }).catch(() => { if (alive.current) setError('Neodoslané správy sa nepodarilo načítať. Skús chat otvoriť znova.'); });
    void refresh();
    const channel = client.channel(`chat:${userId}:${chat.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${chat.id}` }, () => { void refresh(); }).subscribe((status) => {
      if (!alive.current) return;
      setConnection(status === 'SUBSCRIBED' ? '' : 'Živé pripojenie sa obnovuje. Správy kontrolujem priebežne.');
      if (status === 'SUBSCRIBED') void refresh();
    });
    const foreground = () => { if (typeof document === 'undefined' || document.visibilityState === 'visible') void refresh(); };
    const interval = setInterval(foreground, 15000);
    if (typeof window !== 'undefined') window.addEventListener('online', foreground);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', foreground);
    return () => { alive.current = false; clearInterval(interval); void client.removeChannel(channel); if (typeof window !== 'undefined') window.removeEventListener('online', foreground); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', foreground); };
  }, [chat.id, client, userId, outbox, refresh]);
  async function send(item: PendingMessage) {
    if (sending.current.has(item.clientId)) return;
    sending.current.add(item.clientId); setDelivery((current) => ({ ...current, [item.clientId]: 'sending' })); failedMessage.current = null; setError('');
    try {
      const accessToken = account.session!.access_token;
      let path = item.photo?.objectPath;
      if (item.photo) {
        // Reserving again is idempotent; refresh/ack can race local blob cleanup.
        path = await repository.reservePhoto(chat.id, item.clientId, item.photo, accessToken);
        const next = { ...item, photo: { ...item.photo, objectPath: path } };
        await outbox.add(next);
        if (alive.current) setPending((current) => current.map((value) => value.clientId === item.clientId ? next : value));
        try {
          const prepared = await photoStore.get(photoKey(userId, chat.id, item.clientId));
          await repository.uploadPhoto(path, prepared, accessToken);
        } catch (reason) {
          // If the blob was cleaned after a server acknowledgement, RPC retry still
          // succeeds. An absent remote object is rejected by the server below.
          if (!(reason instanceof Error && reason.message.startsWith('Fotka už nie je uložená'))) throw reason;
        }
      }
      const message = path ? await repository.sendPhoto(chat.id, item.body, item.clientId, path, accessToken)
        : await repository.send(chat.id, item.body, item.clientId, accessToken);
      await outbox.remove(item.clientId);
      if (item.photo) await photoStore.remove(photoKey(userId, chat.id, item.clientId));
      if (alive.current) { receive([message]); updated.current(); }
    } catch (reason) { if (alive.current && !messageRef.current.some((message) => message.sender_id === userId && message.client_id === item.clientId)) { failedMessage.current = item.clientId; setDelivery((current) => ({ ...current, [item.clientId]: 'failed' })); setError(socialError(reason)); } }
    finally { sending.current.delete(item.clientId); }
  }
  async function submit() {
    if (!outboxReady || enqueueingRef.current) return;
    enqueueingRef.current = true; setEnqueueing(true);
    try {
      const body = validateChatContent(draft, Boolean(photo));
      const item: PendingMessage = { clientId: createMessageId(), body, createdAt: new Date().toISOString(), ...(photo ? { photo: { width: photo.width, height: photo.height, byteSize: photo.byteSize } } : {}) };
      const key = photoKey(userId, chat.id, item.clientId);
      if (photo) await photoStore.put(key, photo);
      try { await outbox.add(item); } catch (reason) { if (photo) await photoStore.remove(key).catch(() => undefined); throw reason; }
      if (!alive.current) return;
      setPending((current) => [...current, item]); setDraft(''); setPhoto(null); setPhotoUri(null); atBottom.current = true;
      void send(item);
    } catch (reason) { if (alive.current) { failedMessage.current = null; setError(socialError(reason)); } }
    finally { enqueueingRef.current = false; if (alive.current) setEnqueueing(false); }
  }
  async function choosePhoto() {
    if (preparingPhoto || enqueueingRef.current) return;
    // Open the native file picker directly in the tap event (required by Safari).
    const selection = selectPhoto(); setPreparingPhoto(true); failedMessage.current = null; setError('');
    try { const file = await selection; if (!file || !alive.current) return; const next = await preparePhoto(file); if (alive.current) { setPhoto(next); setPhotoUri(null); } }
    catch (reason) { if (alive.current) setError(socialError(reason)); }
    finally { if (alive.current) setPreparingPhoto(false); }
  }
  async function loadOlder() {
    if (olderBusy || !messages[0]) return;
    setOlderBusy(true);
    try {
      const page = await repository.messages(chat.id, messages[0]);
      if (!alive.current) return;
      prependHeight.current = scrollHeight.current; atBottom.current = false;
      const merged = mergeMessages(messageRef.current, page); messageRef.current = merged; setMessages(merged); setHasOlder(page.length === 50);
    } catch (reason) { if (alive.current) setError(socialError(reason)); } finally { if (alive.current) setOlderBusy(false); }
  }
  return <><BottomSheet visible fullHeight title={chat.peer.display_name} subtitle={`@${chat.peer.username} · Súkromný chat`} onClose={onClose} scrollRef={scroll}
    onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => { scrollOffset.current = contentOffset.y; const wasBottom = atBottom.current; atBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 60; if (!wasBottom && atBottom.current) markRead(messages[messages.length - 1]); }}
    onContentSizeChange={(_, height) => {
      if (prependHeight.current !== null) { scroll.current?.scrollTo({ y: scrollOffset.current + height - prependHeight.current, animated: false }); prependHeight.current = null; }
      else if (atBottom.current) scroll.current?.scrollToEnd({ animated: false });
      scrollHeight.current = height;
    }}
    footer={<View style={{ gap: 8 }}>
      {error || loadError ? <><SocialFeedback error>{error || loadError}</SocialFeedback>{loadError ? <Pressable accessibilityRole="button" onPress={() => void refresh()}><Text style={{ color: colors.accent, paddingVertical: 8 }}>Obnoviť správy</Text></Pressable> : null}</> : null}
      {connection ? <SocialFeedback>{connection}</SocialFeedback> : null}
      {photo ? <View style={chatStyles.preview}><ChatPhoto repository={repository} prepared={photo} compact onOpen={setPhotoUri} /><SocialButton label="Odobrať fotku" onPress={() => { setPhoto(null); setPhotoUri(null); }} disabled={enqueueing} /></View> : null}
      {Platform.OS === 'web' ? <Pressable accessibilityRole="button" accessibilityLabel={photo ? 'Vybrať inú fotku' : 'Pridať fotku'} disabled={preparingPhoto || enqueueing} onPress={() => void choosePhoto()} style={chatStyles.attach}><Text style={styles.secondaryText}>{preparingPhoto ? 'Pripravujem fotku…' : photo ? 'Vybrať inú fotku' : 'Pridať fotku'}</Text></Pressable> : null}
      <View style={chatStyles.composer}>
        <TextInput accessibilityLabel="Správa" placeholder="Napíš správu…" placeholderTextColor={colors.muted} value={draft} onChangeText={setDraft} multiline maxLength={2000} style={[styles.textInput, chatStyles.input]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Odoslať správu" accessibilityState={{ disabled: (!draft.trim() && !photo) || !outboxReady || enqueueing || preparingPhoto }} disabled={(!draft.trim() && !photo) || !outboxReady || enqueueing || preparingPhoto} onPress={() => void submit()} style={[chatStyles.send, ((!draft.trim() && !photo) || !outboxReady || enqueueing || preparingPhoto) && { opacity: 0.45 }]}><Text style={styles.primaryText}>Odoslať</Text></Pressable>
      </View>
    </View>}>
    <Pressable accessibilityRole="button" onPress={onProfile}><Text style={{ color: colors.accent, paddingVertical: 8 }}>Zobraziť profil a možnosti</Text></Pressable>
    {hasOlder ? <SocialButton label="Staršie správy" onPress={() => void loadOlder()} busy={olderBusy} /> : null}
    {loading ? <SocialFeedback>Načítavam správy…</SocialFeedback> : !messages.length && !pending.length ? <SocialFeedback>Začni konverzáciu s @{chat.peer.username}.</SocialFeedback> : null}
    {messages.map((message, index) => {
      const mine = message.sender_id === userId;
      const day = new Date(message.created_at).toLocaleDateString('sk-SK');
      const previousDay = index ? new Date(messages[index - 1].created_at).toLocaleDateString('sk-SK') : '';
      return <View key={message.id} style={{ gap: 10 }}>
        {day !== previousDay ? <Text style={chatStyles.date}>{day}</Text> : null}
        <View style={[chatStyles.bubble, mine ? chatStyles.mine : chatStyles.theirs]}>{message.photo_path ? <ChatPhoto repository={repository} path={message.photo_path} onOpen={setPhotoUri} /> : null}{message.body ? <Text selectable style={chatStyles.body}>{message.body}</Text> : null}<Text style={chatStyles.time}>{new Date(message.created_at).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}{mine ? ' · Odoslané' : ''}</Text></View>
      </View>;
    })}
    {pending.map((item) => <View key={item.clientId} style={[chatStyles.bubble, chatStyles.mine]}>
      {item.photo ? <ChatPhoto repository={repository} localKey={photoKey(userId, chat.id, item.clientId)} onOpen={setPhotoUri} /> : null}
      {item.body ? <Text selectable style={chatStyles.body}>{item.body}</Text> : null}
      {delivery[item.clientId] === 'sending' ? <Text style={chatStyles.time}>Odosielam…</Text> : <Pressable accessibilityRole="button" accessibilityLabel={`Zopakovať správu: ${item.body || 'Fotka'}`} onPress={() => void send(item)} style={{ paddingVertical: 8 }}><Text style={{ color: colors.pink, fontSize: 13 }}>Neodoslané · Zopakovať</Text></Pressable>}
    </View>)}
  </BottomSheet><PhotoViewer uri={photoUri} onClose={() => setPhotoUri(null)} /></>;
}
const chatStyles = StyleSheet.create({
  date: { alignSelf: 'center', color: colors.muted, fontSize: 12, paddingVertical: 8 },
  bubble: { maxWidth: '88%', borderRadius: 14, padding: 12, gap: 6, borderWidth: 1 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderColor: '#734496' },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.panelAlt, borderColor: colors.line },
  body: { color: colors.onPrimary, fontSize: 16, lineHeight: 23 },
  time: { color: '#D4C3DF', fontSize: 11, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  preview: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  attach: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 },
  input: { flex: 1, marginTop: 0, maxHeight: 110 },
  send: { minHeight: 46, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10, backgroundColor: colors.primary, borderWidth: 1, borderColor: '#734496' },
});

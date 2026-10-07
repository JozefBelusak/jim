import { useEffect, useId, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, styles } from '../theme/styles';
import { useDialogFocus } from '../components/useDialogFocus';
import { photoStore } from './photos';
import { SocialRepository } from './repository';
import { PreparedPhoto } from './types';
import { SocialButton, SocialFeedback } from './ui';

export function ChatPhoto({ repository, path, localKey, prepared, onOpen, compact = false }: {
  repository: SocialRepository; path?: string; localKey?: string; prepared?: PreparedPhoto; onOpen: (uri: string) => void; compact?: boolean;
}) {
  const id = `chat-photo-${useId().replace(/:/g, '')}`;
  const [uri, setUri] = useState('');
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true; let objectUrl = ''; const abort = new AbortController();
    setUri(''); setError(false);
    const load = async () => {
      try {
        const blob = prepared?.blob ?? (localKey ? (await photoStore.get(localKey)).blob : path ? await repository.downloadPhoto(path, abort.signal) : null);
        if (!alive || !blob) return;
        objectUrl = URL.createObjectURL(blob); setUri(objectUrl);
      } catch { if (alive) setError(true); }
    };
    // Avoid downloading every historical photo when a chat opens.
    const element = typeof document !== 'undefined' ? document.getElementById(id) : null;
    const observer = typeof IntersectionObserver !== 'undefined' && element && !prepared ? new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer?.disconnect(); void load(); }
    }, { rootMargin: '160px' }) : null;
    if (observer && element) observer.observe(element); else void load();
    return () => { alive = false; abort.abort(); observer?.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, repository, path, localKey, prepared, attempt]);
  return <View nativeID={id} style={[photoStyles.frame, compact && { width: 104, height: 76 }]}>
    {uri ? <Pressable accessibilityRole="button" accessibilityLabel="Otvoriť fotku" onPress={() => onOpen(uri)} style={photoStyles.fill}>
      <Image source={{ uri }} accessibilityLabel="Fotka v chate" style={photoStyles.fill} resizeMode="cover" onError={() => setError(true)} />
    </Pressable> : !error ? <ActivityIndicator color={colors.text} accessibilityLabel="Načítavam fotku" /> : null}
    {error ? <View style={photoStyles.failure}><SocialFeedback error>Fotku sa nepodarilo načítať.</SocialFeedback><SocialButton label="Znova načítať fotku" onPress={() => setAttempt((value) => value + 1)} /></View> : null}
  </View>;
}
export function PhotoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  useDialogFocus('app-sheet-overlay-photo-viewer', Boolean(uri));
  if (!uri) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose} accessibilityLabel="Fotka v plnej veľkosti">
    <View nativeID="app-sheet-overlay-photo-viewer" style={photoStyles.viewer}>
      <Pressable accessibilityRole="button" accessibilityLabel="Zavrieť fotku" onPress={onClose} style={photoStyles.close}><Text style={styles.primaryText}>Zavrieť fotku ×</Text></Pressable>
      <Image source={{ uri }} style={{ flex: 1, width: '100%' }} resizeMode="contain" accessibilityLabel="Zväčšená fotka v chate" />
    </View>
  </Modal>;
}
const photoStyles = StyleSheet.create({
  frame: { width: 220, maxWidth: '100%', height: 180, borderRadius: 9, overflow: 'hidden', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  failure: { padding: 8, width: '100%' },
  viewer: { flex: 1, backgroundColor: colors.ink },
  close: { alignSelf: 'flex-end', minHeight: 48, justifyContent: 'center', paddingHorizontal: 18 },
});

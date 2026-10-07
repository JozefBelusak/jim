import { Pressable, Text, View } from 'react-native';
import { SavingStatus } from '../storage/useTrainingState';
import { colors, styles } from '../theme/styles';

export function SavingIndicator({ status, error, onRetry }: { status: SavingStatus; error: string | null; onRetry?: () => void }) {
  return <View style={{ gap: 8 }}>
    <View style={styles.savingStatusRow}>
      <View style={[styles.statusDot, { backgroundColor: status === 'error' ? colors.pink : status === 'saving' || status === 'loading' ? colors.muted : colors.accent }]} />
      <Text accessibilityLiveRegion="polite" style={[styles.savingStatusText, status === 'error' ? { color: colors.pink } : null]}>{status === 'loading' ? 'Načítavam…' : status === 'saving' ? 'Ukladám…' : status === 'error' ? `Ukladanie zlyhalo: ${error ?? 'Skús uloženie zopakovať.'}` : 'Uložené v tomto zariadení'}</Text>
    </View>
    {status === 'error' && onRetry ? <Pressable accessibilityRole="button" style={styles.smallButton} onPress={onRetry}><Text style={styles.smallButtonText}>Zopakovať uloženie</Text></Pressable> : null}
  </View>;
}

import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, styles } from '../theme/styles';

export function SocialButton({ label, onPress, primary = false, busy = false, disabled = false }: { label: string; onPress: () => void; primary?: boolean; busy?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy }} disabled={disabled || busy} onPress={onPress} style={[primary ? styles.primaryWide : styles.secondaryFull, (disabled || busy) && { opacity: 0.55 }]}>
    {busy ? <ActivityIndicator color={primary ? colors.onPrimary : colors.text} /> : <Text style={primary ? styles.primaryText : styles.secondaryText}>{label}</Text>}
  </Pressable>;
}
export function SocialField({ label, value, onChange, password = false, email = false, multiline = false, maxLength }: { label: string; value: string; onChange: (value: string) => void; password?: boolean; email?: boolean; multiline?: boolean; maxLength?: number }) {
  return <View style={{ gap: 4 }}><Text style={socialStyles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} secureTextEntry={password} keyboardType={email ? 'email-address' : 'default'} autoCapitalize={email || password || label.includes('Používateľské') ? 'none' : 'sentences'} autoCorrect={!(email || password || label.includes('Používateľské'))} multiline={multiline} maxLength={maxLength} style={[styles.textInput, multiline && { minHeight: 84, textAlignVertical: 'top' }]} /></View>;
}
export function SocialFeedback({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[socialStyles.note, error && { color: colors.pink }]}>{children}</Text>;
}
export const socialStyles = StyleSheet.create({
  label: { color: colors.text, fontSize: 14, fontWeight: '500' },
  note: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  gap: { gap: 12 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { backgroundColor: colors.primary, borderColor: colors.accent, borderWidth: 1, width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  initials: { color: colors.onPrimary, fontSize: 18, fontWeight: '700' },
  name: { color: colors.text, fontSize: 18, fontWeight: '600' },
  handle: { color: colors.accent, fontSize: 14, marginTop: 3 },
  listRow: { paddingVertical: 14, minHeight: 64, borderBottomColor: colors.line, borderBottomWidth: 1, gap: 4 },
  badge: { backgroundColor: colors.primary, color: colors.onPrimary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, overflow: 'hidden' },
});

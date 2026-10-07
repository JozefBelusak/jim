import { ReactNode, useEffect, useId, useRef } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors } from '../theme/styles';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function BottomSheet({ visible, title, subtitle, onClose, children, footer }: Props) {
  const { height, width } = useWindowDimensions();
  const id = useId().replace(/:/g, '');
  const sheetId = `sheet-${id}`;
  const titleId = `${sheetId}-title`;
  const desktop = width >= 680;
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const previousFocus = document.activeElement;
    const focusableElements = () => {
      const sheet = document.getElementById(sheetId);
      return sheet ? Array.from(sheet.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.getClientRects().length > 0 && !element.matches(':disabled') && element.getAttribute('aria-disabled') !== 'true') : [];
    };
    const focusFirst = () => {
      const first = focusableElements()[0];
      if (first) first.focus();
      else document.getElementById(sheetId)?.focus();
    };
    const focusTimer = setTimeout(focusFirst, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      if (!document.getElementById(sheetId)?.closest('[role="dialog"]')) return;
      const elements = focusableElements();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) {
        event.preventDefault();
        document.getElementById(sheetId)?.focus();
      } else if (event.shiftKey && (document.activeElement === first || !document.getElementById(sheetId)?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !document.getElementById(sheetId)?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown, true);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [visible, sheetId]);

  if (!visible) return null;

  return <Modal transparent visible animationType="fade" onRequestClose={() => closeRef.current()} accessibilityLabelledBy={titleId} accessibilityLabel={title}>
    <KeyboardAvoidingView style={[sheetStyles.overlay, desktop && sheetStyles.desktopOverlay]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={`Dismiss ${title}`} accessibilityRole="button" onPress={onClose} importantForAccessibility="no" accessibilityElementsHidden tabIndex={-1} />
      <View nativeID={sheetId} style={[sheetStyles.sheet, { maxHeight: height * 0.85 }, desktop && sheetStyles.desktopSheet]}
        accessibilityViewIsModal>
        {!desktop ? <View style={sheetStyles.handle} /> : null}
        <View style={sheetStyles.header}>
          <View style={sheetStyles.heading}>
            <Text nativeID={titleId} style={sheetStyles.title} accessibilityRole="header">{title}</Text>
            {subtitle ? <Text style={sheetStyles.subtitle}>{subtitle}</Text> : null}
          </View>
          <Pressable style={sheetStyles.close} accessibilityRole="button" accessibilityLabel={`Close ${title}`} onPress={onClose}>
            <Text style={sheetStyles.closeText}>×</Text>
          </Pressable>
        </View>
        <ScrollView style={sheetStyles.scroll} contentContainerStyle={sheetStyles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {footer ? <View style={sheetStyles.footer}>{footer}</View> : null}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const sheetStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#0009' },
  desktopOverlay: { justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 560, flexShrink: 1, backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  desktopSheet: { borderRadius: 18 },
  handle: { alignSelf: 'center', height: 4, width: 34, borderRadius: 2, backgroundColor: colors.line, marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderBottomColor: colors.line, borderBottomWidth: 1 },
  heading: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  close: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surface },
  closeText: { color: colors.muted, fontSize: 26, lineHeight: 30 },
  scroll: { flexShrink: 1 },
  content: { padding: 18, paddingBottom: 28, gap: 14 },
  footer: { borderTopColor: colors.line, borderTopWidth: 1, padding: 16, paddingBottom: 20 },
});

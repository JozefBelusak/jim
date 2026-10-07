import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, styles } from '../theme/styles';

type Props = { label: string; accessibilityLabel: string; value?: number; minimum?: number; maximum?: number; optional?: boolean; onCommit: (value: number | undefined) => void };

/** Keep partially typed input local; only valid targets reach the plan domain. */
export function PlanNumberField({ label, accessibilityLabel, value, minimum = 1, maximum = Number.MAX_SAFE_INTEGER, optional = false, onCommit }: Props) {
  const [draft, setDraft] = useState(value === undefined ? '' : `${value}`);
  const [error, setError] = useState('');
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value === undefined ? '' : `${value}`); }, [value]);
  return <View style={local.field}>
    <Text style={local.label}>{label}</Text>
    <TextInput value={draft} accessibilityLabel={accessibilityLabel} accessibilityHint={optional ? 'Optional. Clear to turn off.' : 'Enter a whole number.'} keyboardType="number-pad" selectTextOnFocus placeholder={optional ? 'Off' : undefined} placeholderTextColor={colors.muted} style={[styles.textInput, local.input, error ? local.invalid : null]}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setDraft(value === undefined ? '' : `${value}`); setError(''); }}
      onChangeText={(raw) => {
        setDraft(raw);
        if (!raw.trim() && optional) { setError(''); onCommit(undefined); return; }
        const parsed = Number(raw);
        if (!raw.trim() || !Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
          setError(maximum === Number.MAX_SAFE_INTEGER ? `Minimum ${minimum}` : `${minimum}–${maximum}`);
          return;
        }
        setError('');
        onCommit(parsed);
      }} />
    {error ? <Text accessibilityLiveRegion="polite" style={local.error}>{error}</Text> : null}
  </View>;
}

const local = StyleSheet.create({
  field: { flex: 1, minWidth: 76, gap: 6 },
  label: { color: colors.muted, fontSize: 12 },
  input: { marginTop: 0, minHeight: 44, textAlign: 'center' },
  invalid: { borderColor: colors.pink },
  error: { color: colors.pink, fontSize: 11 },
});

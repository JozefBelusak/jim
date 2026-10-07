import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/styles';

type Props = {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
};

export function DisclosureSection({ title, summary, children, defaultOpen = false, open, onToggle }: Props) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const isOpen = open ?? expanded;

  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setExpanded(next);
    onToggle?.(next);
  };

  return <View style={disclosureStyles.section}>
    <Pressable style={disclosureStyles.header} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: isOpen }} onPress={toggle}>
      <View style={disclosureStyles.heading}>
        <Text style={disclosureStyles.title}>{title}</Text>
        {summary && !isOpen ? <Text style={disclosureStyles.summary} numberOfLines={2}>{summary}</Text> : null}
      </View>
      <Text style={disclosureStyles.chevron}>{isOpen ? '−' : '+'}</Text>
    </Pressable>
    {isOpen ? <View style={disclosureStyles.content}>{children}</View> : null}
  </View>;
}

const disclosureStyles = StyleSheet.create({
  section: { borderBottomColor: colors.line, borderBottomWidth: 1 },
  header: { minHeight: 48, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heading: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 14, fontWeight: '600' },
  summary: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  chevron: { color: colors.muted, fontSize: 22, width: 24, textAlign: 'center' },
  content: { gap: 12, paddingBottom: 16 },
});

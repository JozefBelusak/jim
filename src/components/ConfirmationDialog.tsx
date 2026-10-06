import { Modal, Pressable, Text, View } from 'react-native';
import { styles } from '../theme/styles';

export function ConfirmationDialog({ visible, title, description, onConfirm, onCancel }: {
  visible: boolean; title: string; description: string; onConfirm: () => void; onCancel: () => void;
}) {
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
    <View style={{ flex: 1, backgroundColor: '#000B', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={[styles.card, { width: '100%', maxWidth: 440 }]} accessibilityViewIsModal>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.compactText}>{description}</Text>
        <Pressable style={styles.dangerOutlineFull} onPress={onConfirm}><Text style={styles.dangerOutlineText}>Áno, zrušiť tréning</Text></Pressable>
        <Pressable style={styles.secondaryFull} onPress={onCancel}><Text style={styles.secondaryText}>Pokračovať v tréningu</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

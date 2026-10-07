import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { parseTrainingBackup, serializeTrainingBackup } from '../storage/backup';
import { TrainingState } from '../storage/trainingStorage';
import { colors, styles } from '../theme/styles';

type Props = { state: TrainingState; onImport: (state: TrainingState) => Promise<void>; allowExport?: boolean };

export function BackupPanel({ state, onImport, allowExport = true }: Props) {
  const [raw, setRaw] = useState('');
  const [candidate, setCandidate] = useState<TrainingState | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showText, setShowText] = useState(false);

  function validate(text: string) {
    try {
      const imported = parseTrainingBackup(text);
      setCandidate(imported);
      setMessage('Záloha je platná. Potvrď nahradenie aktuálnych dát.');
    } catch (error: unknown) {
      setCandidate(null);
      setMessage(error instanceof Error ? error.message : 'Import zlyhal.');
    }
  }

  function chooseFile() {
    setCandidate(null);
    setMessage('');
    if (Platform.OS !== 'web' || typeof document === 'undefined') { setShowText(true); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 20_000_000) { setMessage('Maximum je 20 MB.'); return; }
      file.text().then(validate).catch(() => setMessage('Súbor sa nepodarilo prečítať.'));
    };
    input.click();
  }

  function exportFile() {
    const text = serializeTrainingBackup(state);
    if (Platform.OS !== 'web' || typeof document === 'undefined') { setRaw(text); setShowText(true); return; }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `jimrat-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setMessage('Záloha bola pripravená na stiahnutie.');
  }

  async function confirmImport() {
    if (!candidate || busy) return;
    setBusy(true);
    try {
      await onImport(candidate);
      setCandidate(null);
      setRaw('');
      setMessage('Záloha bola importovaná a uložená.');
    } catch (error: unknown) { setMessage(error instanceof Error ? error.message : 'Import sa nepodarilo uložiť. Pôvodné dáta zostali zachované.'); }
    finally { setBusy(false); }
  }

  return <View style={styles.card}>
    <Text style={styles.cardTitle}>Záloha a prenos dát</Text>
    <Text style={styles.compactText}>JSON obsahuje históriu, rozbehnutý tréning, plány, vlastné cviky aj pamäť strojov.</Text>
    <View style={local.actions}>
      {allowExport ? <Pressable style={[styles.secondaryFull, local.button]} onPress={exportFile} accessibilityRole="button"><Text style={styles.secondaryText}>Stiahnuť JSON zálohu</Text></Pressable> : null}
      <Pressable style={[styles.secondaryFull, local.button]} onPress={chooseFile} accessibilityRole="button"><Text style={styles.secondaryText}>Vybrať JSON na import</Text></Pressable>
      <Pressable style={local.textImportButton} onPress={() => setShowText(!showText)} accessibilityRole="button" accessibilityState={{ expanded: showText }}><Text style={styles.secondaryText}>{showText ? 'Skryť import cez text' : 'Import cez text'}</Text></Pressable>
    </View>
    {showText ? <View>
      <TextInput value={raw} onChangeText={(text) => { setRaw(text); setCandidate(null); }} style={styles.noteInput} multiline placeholder="Vlož obsah JSON zálohy" placeholderTextColor={colors.muted} accessibilityLabel="JSON záloha" />
      <Pressable style={styles.secondaryFull} onPress={() => validate(raw)}><Text style={styles.secondaryText}>Overiť zálohu</Text></Pressable>
    </View> : null}
    {candidate ? <View>
      <Text style={styles.compactText}>{candidate.logs.length} tréningov · {candidate.templates.length} plánov · {candidate.customExercises.length} vlastných cvikov. Import nahradí aktuálne dáta{candidate.activeWorkout ? ' a obnoví rozbehnutý tréning' : ''}.</Text>
      <Pressable disabled={busy} style={styles.primaryWide} onPress={confirmImport}><Text style={styles.primaryText}>{busy ? 'Ukladám…' : 'Potvrdiť nahradenie dát'}</Text></Pressable>
      <Pressable disabled={busy} style={styles.secondaryFull} onPress={() => setCandidate(null)}><Text style={styles.secondaryText}>Zrušiť import</Text></Pressable>
    </View> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={styles.compactText}>{message}</Text> : null}
  </View>;
}

const local = StyleSheet.create({
  actions: { gap: 12, marginTop: 14 },
  button: { marginTop: 0 },
  textImportButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
});

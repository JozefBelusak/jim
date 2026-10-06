import { useCallback, useEffect, useRef, useState } from 'react';
import { currentStorageKey, flushTrainingState, trainingRepository } from './trainingRepository';
import { TrainingState, trainingStatesEqual } from './trainingStorage';

const emptyState: TrainingState = { schedule: {}, logs: [], activeWorkout: null, customExercises: [], templates: [], machineMemories: [] };
export type SavingStatus = 'loading' | 'saving' | 'saved' | 'error';

export function useTrainingState() {
  const [state, setState] = useState<TrainingState>(emptyState);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SavingStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const revision = useRef(0);
  const importing = useRef(false);
  const conflictRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let mounted = true;
    setReady(false);
    setStatus('loading');
    trainingRepository.load().then((stored) => {
      if (!mounted) return;
      setState(stored ?? emptyState);
      conflictRef.current = false;
      setHasConflict(false);
      setReady(true);
      setError(null);
      setStatus('saved');
    }).catch((reason: unknown) => {
      if (!mounted) return;
      setStatus('error');
      setError(reason instanceof Error ? reason.message : 'Dáta sa nepodarilo načítať.');
    });
    return () => { mounted = false; };
  }, [loadAttempt]);

  useEffect(() => {
    if (!ready || hasConflict) return;
    const currentRevision = ++revision.current;
    let obsolete = false;
    setStatus('saving');
    const timer = setTimeout(() => {
      if (importing.current || conflictRef.current) return;
      trainingRepository.save(state).then(() => {
        if (obsolete || conflictRef.current || revision.current !== currentRevision) return;
        setStatus('saved');
        setError(null);
      }).catch((reason: unknown) => {
        if (obsolete || conflictRef.current || revision.current !== currentRevision) return;
        setStatus('error');
        setError(reason instanceof Error ? reason.message : 'Ukladanie zlyhalo.');
      });
    }, 150);
    return () => { clearTimeout(timer); obsolete = true; };
  }, [ready, hasConflict, saveAttempt, state]);

  // A tab close may happen before the debounced effect; flush the current snapshot synchronously on web.
  useEffect(() => {
    if (!ready || typeof window === 'undefined') return;
    const flush = () => {
      if (conflictRef.current) return;
      try { flushTrainingState(stateRef.current); } catch {
        setStatus('error');
        setError('Ukladanie zlyhalo. Exportuj zálohu pred zatvorením.');
      }
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [ready]);

  useEffect(() => {
    if (!ready || typeof window === 'undefined') return;
    const changed = (event: StorageEvent) => {
      if (event.key !== currentStorageKey || !event.newValue) return;
      let external: unknown;
      try { external = JSON.parse(event.newValue) as unknown; } catch { return; }
      if (typeof external !== 'object' || external === null || !('data' in external) ||
          trainingStatesEqual(external.data, stateRef.current)) return;
      conflictRef.current = true;
      setHasConflict(true);
      setStatus('error');
      setError('Dáta zmenila iná karta. Ukladanie tejto karty je zastavené, aby neprepísala novšiu históriu. Môžeš exportovať svoju zálohu a načítať aktuálne dáta.');
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [ready]);

  const importState = useCallback(async (imported: TrainingState) => {
    // Persist first. Failed imports keep the existing in-memory training state intact.
    importing.current = true;
    revision.current++;
    try { await trainingRepository.save(imported); } catch (reason: unknown) {
      setSaveAttempt((attempt) => attempt + 1);
      throw reason;
    } finally { importing.current = false; }
    revision.current++;
    setState(imported);
    conflictRef.current = false;
    setHasConflict(false);
    setReady(true);
    setStatus('saved');
    setError(null);
  }, []);

  return { state, setState, status, error, ready, hasConflict, importState,
    retrySave: () => setSaveAttempt((attempt) => attempt + 1),
    reload: () => setLoadAttempt((attempt) => attempt + 1) };
}

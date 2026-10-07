import { useEffect } from 'react';
import { Platform } from 'react-native';

const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useDialogFocus(containerId: string, visible: boolean) {
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const previousFocus = document.activeElement;
    const elements = () => {
      const container = document.getElementById(containerId);
      return container ? Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.getClientRects().length > 0 && !element.matches(':disabled') && element.getAttribute('aria-disabled') !== 'true') : [];
    };
    const focusFirst = () => { (elements()[0] ?? document.getElementById(containerId))?.focus(); };
    const timer = setTimeout(focusFirst, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const container = document.getElementById(containerId);
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (container?.closest('[role="dialog"]') !== dialogs[dialogs.length - 1]) return;
      const controls = elements();
      const first = controls[0]; const last = controls[controls.length - 1];
      if (!first || !last) { event.preventDefault(); container?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !container?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !container?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      clearTimeout(timer); document.removeEventListener('keydown', onKeyDown, true);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [visible, containerId]);
}

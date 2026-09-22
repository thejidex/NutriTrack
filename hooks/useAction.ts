import { useRef, useState } from 'react';
import { s } from '../i18n/zh-CN';
import { type NoticeAction, showNotice } from '../components/NoticeHost';
export function notice(message: string, action?: NoticeAction) {
  showNotice(message, action);
}
export function confirm(_title: string, _message: string, action: () => void) {
  // Destructive actions are intentionally immediate; the app has no confirmation dialogs.
  action();
}
export function useAction() {
  const guard = useRef(false);
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      notice(error instanceof Error ? error.message : s.unknown);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return { busy, run };
}
